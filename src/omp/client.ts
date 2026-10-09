/**
 * Browser-side client for the OMP Studio bridge (`/api/*`), which owns the
 * `omp --mode rpc-ui` child process. Frames arrive over SSE; commands are
 * plain JSON posts.
 */
import type { OmpArchivedSession, OmpBridgeStatus, OmpFrame, OmpSessionPayload, OmpSessionSummary } from "./protocol";

export interface OmpBridgeHandlers {
  onFrame: (frame: OmpFrame) => void;
  onStatus: (status: OmpBridgeStatus, detail: { workspace?: string; resumePath?: string | null; exit?: string | null }) => void;
  onLog: (level: "info" | "warn" | "error" | "stderr", message: string) => void;
}

export class OmpBridge {
  #source: EventSource | null = null;
  #closed = false;

  constructor(private readonly handlers: OmpBridgeHandlers) {}

  connect() {
    if (this.#source) return;
    this.#closed = false;
    this.handlers.onStatus("connecting", {});
    const source = new EventSource("/api/events");
    this.#source = source;

    source.addEventListener("hello", (event) => {
      const payload = parseJson(event.data);
      this.handlers.onStatus((payload.status as OmpBridgeStatus) ?? "starting", {
        workspace: typeof payload.workspace === "string" ? payload.workspace : undefined,
      });
    });

    source.addEventListener("status", (event) => {
      const payload = parseJson(event.data);
      this.handlers.onStatus((payload.status as OmpBridgeStatus) ?? "starting", {
        workspace: typeof payload.workspace === "string" ? payload.workspace : undefined,
        resumePath: typeof payload.resumePath === "string" ? payload.resumePath : null,
        exit: typeof payload.exit === "string" ? payload.exit : null,
      });
    });

    source.addEventListener("log", (event) => {
      const payload = parseJson(event.data);
      const message = typeof payload.message === "string" ? payload.message : "";
      const level = payload.level === "warn" || payload.level === "error" || payload.level === "stderr" ? payload.level : "info";
      if (message) this.handlers.onLog(level, message);
    });

    source.addEventListener("frame", (event) => {
      const frame = parseJson(event.data) as OmpFrame;
      if (frame && typeof frame.type === "string") this.handlers.onFrame(frame);
    });

    source.onerror = () => {
      this.handlers.onStatus("offline", {});
    };
  }

  close() {
    this.#closed = true;
    this.#source?.close();
    this.#source = null;
  }

  async command(command: Record<string, unknown>): Promise<OmpFrame> {
    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    return (await res.json()) as OmpFrame;
  }

  /** The session the bridge is already running (used on page load). */
  async currentSession(): Promise<OmpSessionPayload> {
    const res = await fetch("/api/session/current");
    return (await res.json()) as OmpSessionPayload;
  }

  async openSession(path: string): Promise<OmpSessionPayload> {
    return postJson<OmpSessionPayload>("/api/session/open", { path });
  }

  async newSession(cwd: string): Promise<OmpSessionPayload> {
    return postJson<OmpSessionPayload>("/api/session/new", { cwd });
  }

  async setWorkspace(cwd: string): Promise<{ workspace: string }> {
    return postJson<{ workspace: string }>("/api/workspace", { cwd });
  }

  async listSessions(): Promise<{ sessions: OmpSessionSummary[]; archived: OmpArchivedSession[]; sessionRoot: string; archiveRoot: string }> {
    const res = await fetch("/api/sessions");
    return (await res.json()) as { sessions: OmpSessionSummary[]; archived: OmpArchivedSession[]; sessionRoot: string; archiveRoot: string };
  }

  async archiveSession(path: string): Promise<{ ok: boolean; key: string; sessions: OmpSessionSummary[]; archived: OmpArchivedSession[] }> {
    return postJson<{ ok: boolean; key: string; sessions: OmpSessionSummary[]; archived: OmpArchivedSession[] }>("/api/sessions/archive", { path });
  }

  async restoreSession(key: string): Promise<{ ok: boolean; path: string; sessions: OmpSessionSummary[]; archived: OmpArchivedSession[] }> {
    return postJson<{ ok: boolean; path: string; sessions: OmpSessionSummary[]; archived: OmpArchivedSession[] }>("/api/sessions/restore", { key });
  }

  async deleteSession(path: string): Promise<{ ok: boolean; sessions: OmpSessionSummary[] }> {
    return postJson<{ ok: boolean; sessions: OmpSessionSummary[] }>("/api/sessions/delete", { path });
  }

  /** Content search across omp session logs (real files). */
  async searchSessions(query: string): Promise<{ matches: Array<{ path: string; id: string; snippet: string; hits: number }> }> {
    const res = await fetch(`/api/sessions/search?q=${encodeURIComponent(query)}`);
    return (await res.json()) as { matches: Array<{ path: string; id: string; snippet: string; hits: number }> };
  }

  async health(): Promise<{ status: string; workspace: string; resumePath: string | null }> {
    const res = await fetch("/api/health");
    return (await res.json()) as { status: string; workspace: string; resumePath: string | null };
  }

  /** Real working-tree diff of the agent's workspace. */
  async workspaceDiff(): Promise<{ workspace: string; files: Array<{ path: string; status: string; additions: number; deletions: number; diff: string }> }> {
    const res = await fetch("/api/git/diff");
    return (await res.json()) as { workspace: string; files: Array<{ path: string; status: string; additions: number; deletions: number; diff: string }> };
  }
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || `request failed: ${res.status}`);
  return payload;
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
