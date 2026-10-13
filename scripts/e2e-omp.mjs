#!/usr/bin/env node
/**
 * End-to-end check for the OMP Studio bridge: drives the real `omp --mode rpc-ui`
 * child through the HTTP/SSE API and asserts the wire behaviour the UI relies on.
 *
 *   node scripts/e2e-omp.mjs [--base http://127.0.0.1:3000]
 *
 * Exits non-zero on the first failed assertion.
 */
const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://127.0.0.1:3000";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

/** Collects omp frames from the SSE stream until `stop()` is called. */
async function openStream() {
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/events`, { signal: controller.signal });
  const frames = [];
  const logs = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.indexOf("\n");
        while (index >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) {
            const payload = JSON.parse(line.slice(5).trim());
            if (event === "frame") frames.push(payload);
            else if (event === "log") logs.push(payload);
          }
          index = buffer.indexOf("\n");
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return {
    frames,
    logs,
    close: async () => {
      controller.abort();
      await pump.catch(() => {});
    },
    until: async (predicate, timeoutMs) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      return predicate();
    },
  };
}

const health = await api("/api/health");
check("bridge is running", health.status === 200 && health.body?.ok === true, JSON.stringify(health.body));

const workspace = process.env.E2E_CWD || process.cwd();
const stream = await openStream();
const firstSession = await api("/api/session/new", { cwd: workspace });
// Which child of the bridge runs this conversation; every frame carries it.
const keyA = firstSession.body?.sessionKey;
// The SSE stream replays the last frames for late joiners; only frames after the
// restart belong to this run.
const mark = stream.frames.length;
const frames = () => stream.frames.slice(mark);

const fresh = await api("/api/commands", { type: "get_state" });
check("fresh session reports a session id", typeof fresh.body?.data?.sessionId === "string", fresh.body?.data?.sessionId);
check("fresh session starts empty", fresh.body?.data?.messageCount === 0, `messageCount=${fresh.body?.data?.messageCount}`);

const promptStarted = Date.now();
await api("/api/commands", { type: "prompt", message: "Reply with exactly: pong" });
const settled = await stream.until(
  () => frames().some((frame) => frame.type === "prompt_result"),
  120000
);
check("prompt_result arrives", settled, `${Date.now() - promptStarted}ms`);

const promptResult = frames().findLast((frame) => frame.type === "prompt_result");
check("prompt completed", promptResult?.status === "completed", JSON.stringify(promptResult));
check("agent was invoked", promptResult?.agentInvoked === true);
const assistantEnd = frames().findLast(
  (frame) => frame.type === "message_end" && frame.message?.role === "assistant"
);
const assistantText = (assistantEnd?.message?.content ?? [])
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("");
check("assistant text streamed", assistantText.trim().toLowerCase().includes("pong"), JSON.stringify(assistantText.slice(0, 80)));
check(
  "text deltas streamed before the end",
  frames().some((frame) => frame.type === "message_update" && frame.assistantMessageEvent?.type === "text_delta"),
  `${frames().filter((f) => f.type === "message_update").length} update frames`
);
const turnEnd = frames().findLast((frame) => frame.type === "turn_end");
check("turn_end carries usage", (turnEnd?.message?.usage?.totalTokens ?? 0) > 0, `tokens=${turnEnd?.message?.usage?.totalTokens}`);
check("session_settled arrives", frames().some((frame) => frame.type === "session_settled"));

// --- abort path -----------------------------------------------------------
const beforeAbort = stream.frames.length;
await api("/api/commands", { type: "prompt", message: "Count slowly from 1 to 200, one number per line." });
await new Promise((resolve) => setTimeout(resolve, 1500));
await api("/api/commands", { type: "abort" });
const aborted = await stream.until(
  () => stream.frames.slice(beforeAbort).some((frame) => frame.type === "prompt_result"),
  60000
);
const abortResult = stream.frames.slice(beforeAbort).findLast((frame) => frame.type === "prompt_result");
check("abort ends the turn", aborted && (abortResult?.status === "aborted" || abortResult?.status === "completed"), JSON.stringify(abortResult));

// --- persistence + resume --------------------------------------------------
const sessions = await api("/api/sessions");
const summary = (sessions.body?.sessions ?? []).find((item) => item.id === fresh.body?.data?.sessionId);
check("session is listed on disk", Boolean(summary), summary ? `${summary.title} (${summary.messageCount} msgs)` : "not found");
if (summary) {
  const opened = await api("/api/session/open", { path: summary.path });
  const roles = (opened.body?.messages ?? []).map((message) => message.role);
  check("resume returns the transcript", roles.length > 0, `${roles.length} messages`);
  check("resume exposes log entry ids for branching", (opened.body?.entries ?? []).some((entry) => entry.type === "message" && entry.id), `${opened.body?.entries?.length} entries`);
  check("resume attaches to the conversation already running it", opened.body?.sessionKey === keyA, `${opened.body?.sessionKey} vs ${keyA}`);
  const state = await api("/api/commands", { type: "get_branch_messages" });
  check("branch anchors are available", Array.isArray(state.body?.data?.messages), `${state.body?.data?.messages?.length} anchors`);
  const blocked = await api("/api/sessions/delete", { path: summary.path });
  check(
    "deletion refuses a session that is still being written",
    blocked.status === 409,
    String(blocked.body?.error ?? blocked.status)
  );
}
const outside = await api("/api/sessions/delete", { path: "C:/Windows/system.ini" });
check("deletion refuses paths outside the session root", outside.status === 400, String(outside.body?.error));

// --- switching conversations must not interrupt a running turn --------------
// The bridge used to own one child and kill it on every session switch, so
// opening another conversation aborted the turn that was running.
await api("/api/commands", { type: "prompt", message: "Count slowly from 1 to 60, one number per line." });
const started = await stream.until(
  () => stream.frames.some((frame) => frame.sessionKey === keyA && frame.type === "message_update"),
  60000
);
check("the first conversation streams", started);
const switchMark = stream.frames.length;
const second = await api("/api/session/new", { cwd: tmpdir() });
check(
  "a second conversation opens with its own child",
  second.status === 200 && Boolean(second.body?.sessionKey) && second.body.sessionKey !== keyA,
  `${second.body?.sessionKey} vs ${keyA}`
);
const keptStreaming = await stream.until(
  () => stream.frames.slice(switchMark).some((frame) => frame.sessionKey === keyA && frame.type === "message_update"),
  30000
);
check("the first conversation keeps streaming after the switch", keptStreaming);
const open = await api("/api/health");
check(
  "both conversations stay open in the bridge",
  (open.body?.openSessions ?? []).filter((entry) => entry.status === "ready").length >= 2,
  JSON.stringify(open.body?.openSessions ?? [])
);
const finished = await stream.until(
  () =>
    stream.frames
      .slice(switchMark)
      .some((frame) => frame.sessionKey === keyA && frame.type === "prompt_result" && frame.status === "completed"),
  240000
);
check("the first conversation finishes its turn in the background", finished);
const back = await api("/api/session/open", { path: summary?.path ?? "" });
check("reopening attaches to the same child", back.body?.sessionKey === keyA, `${back.body?.sessionKey} vs ${keyA}`);
const lastAssistant = [...(back.body?.messages ?? [])].reverse().find((message) => message.role === "assistant");
const lastText = (lastAssistant?.content ?? [])
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("\n");
check("the background turn finished in the transcript", /\b60\b/.test(lastText), `${lastText.length} chars`);

// A just-written session is intentionally protected by the API, so the harness removes it itself.
if (summary) {
  rmSync(summary.path, { force: true });
  const afterCleanup = await api("/api/sessions");
  check(
    "test session removed from disk",
    !(afterCleanup.body?.sessions ?? []).some((item) => item.id === fresh.body?.data?.sessionId)
  );
}
// The second conversation lived in a temp folder: its log goes too.
const leftover = ((await api("/api/sessions")).body?.sessions ?? []).find((item) => item.cwd === tmpdir());
if (leftover) rmSync(leftover.path, { force: true });

await stream.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log("failed:", failed.map((result) => result.name).join(", "));
  if (stream.logs.length > 0) console.log("bridge logs:", JSON.stringify(stream.logs.slice(-5)));
}
process.exit(process.exitCode ?? 0);
