# Changelog

All notable changes to OMP Studio. Versions match the app version shown in
Settings (`v<version> · <build date>`).

## 0.3.35

- README: a screenshot gallery for the panels. Both panels in place around the
  conversation, then a 2x3 grid with bilingual captions: the left panel with
  sessions grouped by project folder, the right panel with CSV/workbook tables,
  the quote-and-annotate flow with its notes tray, the side chat, the provider
  quota and model-test view, and the skill scanner. Eight images live in
  `assets/screenshots/`, all captured from a running session.

## 0.3.34

- **The file panel reads the formats a real workspace is made of.** Beyond
  images, Markdown and text, `/api/fs/file` now previews the files people
  actually keep next to code: CSV/TSV as a table (delimiter sniffed, and decoded
  through the same encoding detection as text, so a GBK export from a Chinese
  tool no longer renders as mojibake), `.xlsx`/`.xlsm`/`.xlsb`/`.xls`/`.ods`
  workbooks sheet by sheet, `.docx` through mammoth and `.odt` through its own
  `content.xml`, `.pptx` slide by slide (text runs only), `.ipynb` as markdown
  and code cells with their outputs, and PDFs in the browser's own viewer via
  `/api/fs/raw`. Legacy `.doc`/`.ppt`/`.rtf` say what they are and what to do
  instead of dumping bytes; a parser that fails reports its error in the panel.
  Verified against generated fixtures: 2-sheet xlsx, a docx round-tripped through
  mammoth, a 3-slide pptx, an odt with a heading, a notebook with a stream and a
  traceback output, a one-page PDF, a quoted CSV and a GBK CSV.
- **Quote and annotate in the preview, like the Codex panel.** Highlight text in
  the source view (line numbers come from `data-line` anchors, so a quote is
  `@file:12-18`), or click a paragraph, notebook cell, slide or code block to
  quote the whole block — a rendered document has no line anchors, so the range
  is recovered by searching the snippet in the file. A small box opens at the
  selection: write what should change, then either add it to the note tray or ask
  straight away. The tray collects every note across files, shows them with their
  quotes, and `发送到输入框` turns them into one prompt with each `@file:lines`
  reference and its quoted text.
- **Circle a region on an image and talk about it.** Drag a rectangle over the
  rendered image (the panel shows the region while you drag, and an image with
  `dragstart` blocked), write the note, then either quote the crop into the
  composer or add it as a note: the crop is written to
  `.omp-studio/annotations/` and referenced as a real `@path` with its region and
  pixel size, so the agent can open the exact pixels you drew on. Crops are
  runtime data, now git-ignored. Verified: a 130x90 CSS-pixel drag on a 1200x800
  PNG saved a 431x298 crop, and both buttons produced the expected composer text.
- Also fixed here: the viewer header printed `undefined 行` for structured kinds
  (it now names the row/slide/cell count), the panel's `select-none` made text
  impossible to highlight in the viewer, and opening an image left the previous
  note box floating over it.

## 0.3.33

- **Settings no longer start a new conversation.** Toggling a skill or extension
  (global or per project), enabling/disabling a skill, changing the model scope
  or the approval mode restarts the omp child so it picks up the new flags, and
  that restart dropped the session: `restartChild({})` cleared the resume path,
  so every switch began a fresh chat. The bridge now asks the running child for
  the session file it is writing (a fresh session has no `--resume` path yet) and
  resumes it, so the transcript survives the restart. Verified: 2 messages before
  a project-scope toggle, 2 after, same session file.
- **File preview decodes instead of garbling.** The viewer read every file as
  UTF-8, which turned the usual Windows workspace mix into noise: registry hives
  and archives showed as text, Notepad's UTF-16 files showed as CJK salad, and
  GBK files from Chinese tools showed as mojibake. The bridge now detects the
  encoding (UTF-8 with or without BOM, UTF-16LE/BE, GBK fallback), reports
  `binary` for files with NUL bytes and says so in the panel instead of printing
  junk, and `/api/fs/raw` labels text as `text/plain; charset=utf-8` instead of
  `application/octet-stream`.
- **Side chat in the right panel.** The tab promised by the panel tooltip now
  exists: each message is one standalone omp run (`-p --no-session`), so scratch
  questions and prompt drafts never touch the session log. Tools are off unless
  the toggle is on, replies show their latency, and the panel says what it is
  doing.
- **Your own prompts are editable, like the omp terminal.** The message action
  row (copy / edit / resend / quote) was hidden until hover, which made editing
  look missing; it is now always visible. The pencil pre-fills the composer and
  sending branches the session at that turn and re-runs it, and editing works
  while a turn is running too (the running turn is aborted first).
- Project files: bilingual README (English + 中文), Apache-2.0 `LICENSE`, package
  metadata, brand art moved to `assets/brand/`, README screenshots under
  `assets/screenshots/`, and the AI Studio scaffolding file removed.

## 0.3.32

- Settings → Providers has a **custom endpoints** panel: it edits the file omp
  actually reads (`~/.omp/agent/models.yml`), so a compatible gateway becomes a
  provider here instead of by hand. List with masked keys, edit, delete, and a
  form for name / baseUrl / api / apiKey / model ids (one per line, `id | name`).
  Saving restarts the omp session so the provider is selectable immediately.
- The parser preserves every line it does not manage (headers, cost, thinking,
  discovery, …) verbatim and re-emits them, so hand-written fields survive an
  edit here. Verified idempotent: two consecutive saves of the same provider
  produce byte-identical files, and a probe provider added through the API shows
  up in `omp models --json` and disappears again on delete.
- The panel writes `apiKey` literals (omp resolves env-var-name-or-literal) and
  leaves the stored key alone when the field is left empty; the key is never
  sent back to the browser, only a masked preview.

## 0.3.31

- Adding a model by id now respects what was typed. A `provider/model` prefix
  beats the card the text was entered in, so pasting a full selector into the
  wrong provider still installs it in the right one (previously the card won and
  the request failed). A bare id that belongs to another provider is reported as
  such: the card says which provider owns the id and shows the exact selector to
  type, in the UI language, instead of an English internal sentence.

## 0.3.30

- A stale bridge now says so. `vite.config.ts` bakes a sha1 of `server.ts` into
  the SPA, the bridge reports the sha1 of the code it actually started with, and
  the header shows an amber "桥接代码已过期 / bridge code stale" chip when they
  differ, with the restart command in its tooltip (click copies it). Until now a
  process started before the last build answered the first new route with
  `unknown bridge endpoint: POST /api/omp/models/add`, which looks like a bug in
  the new feature instead of a process that needs a restart.
- The bridge reports how it was started (`omp-studio`, `bun run start`,
  `bun run dev`) so the chip's hint is the command that actually applies.

## 0.3.29

- Models can be added by id, and every model can be tested for real. In the
  providers tab each provider's expanded list gained a typed-id field
  (`provider/` prefix optional), an **添加** button and **刷新目录**
  (`omp models refresh <provider>`, the native way a provider's new ids reach
  omp). A typed id is validated against omp's catalog after that refresh: if omp
  knows it, it is enabled through the same `enabledModels` write the toggles use;
  if not, the card says so instead of adding a row that cannot run.
- **测试** on every model row (both the providers tab and the routing table):
  one real request through omp itself
  (`omp -p "…" --model <provider/id> --no-tools --no-session --no-extensions
  --no-skills --no-rules --no-lsp`), reporting latency on success and the
  provider's own line on failure, e.g. `400 Model does not support this
  protocol.` or `Model "…" not found`. Tests run one at a time; each costs a few
  dozen tokens (the tooltip says so).
- Two fixes found by testing: the probe must be spawned with stdin closed (omp's
  print mode waits for piped input and the request hung until it was killed), and
  the routing row needed 11 inner columns after the test button took one.

## 0.3.28

- Skill installation follows the ecosystem instead of a hand-rolled `git clone`.
  The old flow cloned a repository into `~/.agents/skills/<repo>`: a collection
  like taste-skill (`skills/<name>/SKILL.md`) landed as one directory with no
  top-level `SKILL.md`, so omp never listed it, and a single skill went to the
  user scope whether you wanted that or not. The install dialog now has three
  real sources:
  - **Git repository** — `npx skills add <repo>` (the Agent Skills CLI): scan a
    repo without installing (`-l`), pick from the discovered skills, install the
    selection into `.agents/skills` (project) or `~/.agents/skills` (global).
  - **Skillshare registry** — omp's own `omp skill install` / `search`, with
    `--global` wired to the same scope switch.
  - **Write one** — creates a real `<root>/<name>/SKILL.md` with front matter
    instead of the fake in-memory skill the old "upload" tab produced.
  Install output is the CLI's result lines only (banner, spinner frames and the
  ~50-agent link list are stripped), and the skills list reloads itself.
- Uninstall goes through the same CLIs (`npx skills remove`, then omp's registry
  uninstall, then the scanned directory) and reports the outcome, not a Windows
  fault code. Installs are pinned to `-a pi` (omp's agent id): without it the CLI
  copies every skill into every agent directory it knows, which put 47 stray
  dot-directories into this repository.
- UI pass (design-taste skill, product-UI scope): em-dashes removed from every
  visible string, entrance animations honour `prefers-reduced-motion`, icon
  stroke standardised (2, or 3 for glyphs at or below 12px), the shape scale
  documented in `index.css` (4px controls, 2px glyph boxes, 8px surfaces,
  full for switches), the git panel's commit field got a real label instead of
  placeholder-as-label, and the skills copy no longer describes the mock era
  ("prompt-to-AST pipelines"); it names the directories omp actually reads.

## 0.3.27

- Session metrics are the session's, not a window's. The top-bar token/cost and
  cache-hit chips used to sum the transcript omp hands the UI, which after
  compaction is only the current window: a 1 118-call session showed
  30.87M tokens / 96.0% / $0.3346 while omp's own log says
  403.71M prompt tokens / **97.1%** / $3.3860 — off by 10× on cost.
  `GET /api/session/usage` now walks the session log (cached by mtime + size),
  `fetchSessionUsage(sessionFile)` is fed the file omp reports in `get_state`
  (a fresh session has no resume path yet), and the hook refreshes it when the
  session changes, after every turn and every 20s. The chips read
  `本会话 Token（omp 会话日志全量）` with the call count, and totals are formatted
  as `403.7M` rather than `403713.0k`.
- The `pi-cache-stats` chip is hidden too: its counter is per-process (it reads
  `0/0·0M/0M 0.0%` right after a restart) while the session-log figure survives
  restarts, so two cache numbers on one row read as a contradiction. Both hidden
  extensions are listed in `HIDDEN_STATUS_CHIP_PREFIXES`.
- Verified against an independent sum of the same log: 4 calls → 25 201 tokens,
  24 320 cached, 96.92%, $0.000254, byte-identical to the endpoint's answer.

## 0.3.26

- Composer toolbar: the controls are two clusters again. `justify-between` was
  spreading every control it found — model/thinking/attach, the context chip,
  voice input and read-aloud ended up as separate columns, and the tool-permission
  button floated dead centre. The left cluster is now flush left, the
  permission + action cluster is flush right, and everything inside each cluster
  sits 7px apart.
- Top bar: the two permission readouts are gone (omp's `pi-permission-system`
  status chip and this UI's `· 全权 (YOLO)` suffix) as is the `● ready` omp-bridge
  readout. The permission mode still lives where it is actionable — the shield
  button in the composer toolbar.
- Git outside a repository is a state, not a failure. Launching the app from a
  plain folder (e.g. `C:\Users\<you>`) made `/api/git/branches` answer
  `400 fatal: not a git repository`, so the panel showed a red error and the
  commit form stayed dead. `git branches/log/diff` now answer `200` with
  `isRepo: false` and empty lists, the panel says *非 git 仓库* (with the folder
  it looked at and the hint to switch workspaces), and checkout/commit reply
  `409` with a plain sentence. Inside a repository nothing changed.

## 0.3.25

- Composer toolbar rearranged, left → right: **model** (name only — the brain glyph
  is gone), **thinking level**, **attach file**, then the action cluster:
  **context/compact** (moved down from the top banner, with its menu), **voice
  input**, **read aloud**, **tool permission**, and a **wider action button**.
- The action button now carries the state: `发送` while idle, a wide red `停止`
  while a turn runs with an empty composer, and `引导` / `排队` with its mode
  switcher once you type mid-turn. The old icon-only send/stop buttons are gone.
- The working clock moved next to the reply's "正在生成回复…" label and reads
  `m:ss` (no "工作" label); it no longer sits in the top banner.
- Readability in the light theme: the permission menu labels (`每次询问`,
  `允许写入`) were white on the light menu — they now use the theme's ink colour.
  The tool-block name (`bash`) and the cyan accents in thinking/tool blocks also
  moved onto palette tokens instead of dark-theme literals.

## 0.3.24

- Tool approval in the composer. The shield sits with the other action icons
  (right of read-aloud, next to Send) and opens omp's own modes — `每次询问 /
  always-ask`, `允许写入 / write`, `全权 (YOLO) / yolo` — with a hint per mode, the
  current one ticked, and a warning colour for full access. The choice is written
  to omp's setting (`omp config set tools.approvalMode <mode>`) and the session is
  restarted so the running agent picks it up; verified end-to-end (UI → config →
  read back → `omp config list` shows the new value, then restored).
  The active mode is also appended to the session status strip (`ready · 全权 (YOLO)`)
  the way omp's TUI and Codex show it in their status line.
- The session status strip shows how long the current turn has been working
  (`· 工作 1m23s`, omp-terminal style), ticking once a second while a turn runs.

## 0.3.23

- `npm i -g .` now installs a real command. `bin/omp-studio.mjs` runs the bridge in
  production mode through tsx (no build step for the server), the SPA is resolved
  relative to the installation instead of the process cwd, and `tsx` moved to
  runtime dependencies. `prepare` builds `dist/` during the install.
  Verified from `D:\Data\Temp\Temp`: the SPA loads, `/api/health` reports that
  directory as the workspace, and omp is spawned there.
- Removed the global reasoning-visibility switch from the composer (`折叠思考块`).
  Each reasoning block still folds on its own and is collapsed by default; the
  state, its persistence effect and the stored-preference helpers are gone with it.

## 0.3.22

- Typing no longer re-renders the whole transcript. The turn rows are built once
  per transcript change (stable `transcript` identity, memoized rows, memoized
  `AssistantBlocks` with primitive props, markdown parsed once per text block,
  stable handlers). Measured on a 64-turn session with 251 reasoning folds:
  dev build 78 ms → 35 ms per keystroke, **production build 4.5 ms** (was 7 ms
  before, 30+ ms with everything expanded). For daily use prefer
  `bun run build && bun run start`; the dev server's JSX runtime is most of the
  remaining cost.
- Fixed a regression that removed the global reasoning-visibility toggle: the
  composer toolbar has its brain button back (next to the thinking level) and the
  preference persists again (`omp-studio:show-thinking`).
- Removed dead weight: `DeployModal.tsx` (160 lines, imported nowhere),
  `usageSummary`, `hasModifier`, and eight unused type aliases
  (`ChatSession`, `WorktreeItem`, `PluginItem`, `SkillCategory`, `LLMProvider`,
  `OmpModelRole`).

## 0.3.21

- Your prompt appears the moment you send it. omp only reports the user message
  once the turn starts, so the reply (and the "generating…" placeholder) used to
  show up first and your own words landed above it a beat later. The prompt is now
  echoed locally (`pending`, slightly dimmed, no actions), and omp's own copy of
  it replaces the echo when it arrives (matched by text). A rejected command takes
  the echo back instead of leaving a message that was never sent.
  Verified: 0.7 s after Enter the bubble is on screen with the turn not yet
  started, and the settled transcript reads `you → agent` with no duplicates.

## 0.3.20

- The task list (composer HUD and the right panel's 任务 tab) updates live again.
  Two causes:
  - Tool results arrive as their own `toolResult` message, and the live path only
    appended assistant messages, so a tool block kept its empty output until the
    session was reloaded — which is why the todo list never appeared while the
    agent worked. Results are now folded into the calling block
    (`attachToolResult`, matched by tool-call id), and into the streaming turn.
  - The list was read from the settled transcript and unscoped, so a new turn kept
    showing the previous turn's finished list. It is now derived from the rendered
    transcript (settled turns **plus** the live one) and scoped to the turn in
    flight (`currentTurnStart`).
  Verified in the browser on a real todo turn: the HUD went 0/3 → 2/3 → 3/3 while
  the agent was still streaming, and the tool rows show their outputs immediately.

## 0.3.19

- Completion alerts (Settings → 界面主题与偏好 → 完成提醒), both off by default:
  - **浏览器消息提示** — a desktop notification when a turn finishes, titled with
    the workspace and previewing the reply. The switch asks for the browser
    permission the first time; a `测试` button fires one on demand.
  - **声音提醒** — a two-tone chime synthesized with WebAudio (nothing is
    downloaded); a `试听` button plays it.
  Both stay quiet while the window is focused (the point of an alert is that you
  looked away) and both are remembered per browser. Verified end-to-end: with the
  window backgrounded, a finished turn produced one notification
  (`OMP-WebUI / 收到`) and one chime.

## 0.3.18

- Chat history works again. Two separate defects:
  - Session rows reported the **session start** time (the header entry) as
    "… ago"; they now use the log's last entry, and the message count is the real
    number of messages in the file instead of the first 80 lines. Summaries are
    cached per file revision.
  - Some logs were written without omp's `session` header. `omp --resume` refuses
    those ("the session header is missing or malformed") and never reports ready,
    so opening them hung for about a minute and then blanked the transcript. The
    bridge now checks the header first and answers in ~30 ms with a clear 409, the
    conversation keeps its previous content, and the UI shows a dismissible red
    banner. Such rows are dimmed with an explanation and a wrench button that
    rebuilds the header (id + timestamp come from the file name, the original is
    kept as `<name>.bak.jsonl`). The three real logs in this workspace that were
    missing a header were repaired, so their replies are readable again.
- Text selection works in the transcript: the workspace no longer disables it, so
  a few characters or a few paragraphs can be copied instead of the whole turn.
- Your own prompts can be quoted (`引用自己这条指令`) like model replies.
- Assistant turns are labelled with the model **and provider**
  (`DeepSeek V4.1 Flash (opencode-go)`) — the same label as the top-right chip.
- Reasoning blocks are readable: the body uses the muted text tier instead of the
  dim one, and the folded preview uses the dim tier instead of 70% of it.
- A live generation readout (rate + output tokens) sits above the turn's blocks
  while it streams.
- Settings → 提供商与模型: the 计费与用量 panel and the provider list both have a
  **刷新** button that re-reads `omp usage` and bypasses the quota cache
  (`/api/omp/provider-usage?force=1`), showing a spinner and the time of the last
  refresh next to the source label.

## 0.3.17

- The omp-bridge status pill is gone from the top bar (and with it the header's
  10s `/api/health` poll and its state). The bridge status stays where it belongs:
  the session panel footer still shows `omp 桥接 / ready`, and the chat status
  row keeps its dot + status.

## 0.3.16

- The task list above the composer drops its progress bar; the count stays
  (`任务列表 9/9`).

## 0.3.15

- Extension status chips are no longer cut off mid-number. The row used to join
  every `setStatus` chip into one `truncate max-w-[160px]` span, so a value like
  `· DS cache 324/324 · 68.8M/…` lost its tail; each chip is now its own span
  with its own tooltip and a wider budget.

## 0.3.14

- The streaming line no longer claims "子代理正在调度执行图与隔离沙箱..." — that was
  a static label shown whenever omp was generating, unrelated to subagents. It
  now reads 正在生成回复… and appends the real count (`· 2 个子代理在跑`) only when
  omp actually reports running subagents through `get_subagents`.
- The bottom console's MCP tab no longer fabricates events. It used to append
  invented lines every few seconds ("mcp.daemon heartbeat", "subagent.call:
  validated AST sandbox isolation…", "filesystem-server: read_file cached
  buffer…", "github-api-mcp: rate limit token bucket…") behind a Pause/Play
  toggle. The generator and that toggle are gone; the tab shows only what really
  arrives (bridge/omp log lines, your own actions, the ping round-trip).

## 0.3.13

- The "expand thinking blocks" button is gone from the composer toolbar. Thinking
  folds still open and close one at a time (each block keeps its own toggle); the
  only thing removed is the global switch, and its stored default is still read
  at startup for anyone who had set it.

## 0.3.12

- Slash completion works mid-conversation again. Root cause: the app only knew
  omp's command catalog from the `available_commands_update` frame omp *pushes*,
  and after a bridge restart / session resume omp never re-sent it, so the
  catalog was empty (measured: `slashCommands: 0`) and `/` completion closed the
  popup silently — exactly "typing a slash command shows no candidates". The
  workspace now also asks omp directly (`get_available_commands`, the same rpc
  behind omp's own `getAvailableCommands()`) whenever it refreshes models and
  thinking levels, so the popup has the catalog from the first keystroke.
- An empty completion list is no longer silent: a query with no match, or a
  catalog omp has not sent yet, keeps the popup open and says which it is
  (`没有匹配「/co」的命令。输入 / 查看全部 71 条。`).

## 0.3.11

- Your own message's actions (copy · edit-from-here · resend · quote) sit under
  the bubble instead of inside it, so the bubble keeps a clean edge — same
  buttons, same hover reveal, just outside the box.

## 0.3.10

- Tasks and subagents are visible in both places now, and both fold:
  above the composer the HUD is one summary row (`任务列表 x/y` + progress +
  `子代理 n`) that expands into the grouped task list and the running subagent
  rows; its "详情" button opens the right panel on the 任务 tab, which renders
  the same work state (previously that tab was empty even though the workspace
  already published the data to it).
- The omp steering / follow-up queue above the composer expands into the actual
  queued messages, tagged `steer` / `next`.
- Every queued message has a withdraw button: it calls omp's own
  `remove_queued_message` and drops the text back into the composer for editing
  (focused, ready to resend). If the message was already delivered, omp reports
  `removed: false` and the UI says so instead of duplicating it.

## 0.3.9

- The top-right generation-rate chip is gone (and the "throughput" row in the
  context popover with it). The live `≈ tok/s` line above a streaming turn stays,
  since that is what makes the rate readable while it is still moving.

## 0.3.8

- Light theme is the classic one now: white paper `#ffffff`, cool grey panels
  `#f6f8fa`, hairline borders `#d8dee4`, ink text `#1f2328` and a single blue
  accent `#0969da`. Measured contrast on the page background: text 15.8:1,
  muted 6.1:1, dim 5.2:1, accent 5.2:1, white on the accent fill 5.2:1 — every
  tier also clears 4.5:1 on the panel and hover surfaces.
- 配色方案 card: the English note inside the title and the description line under
  it are gone; only the name remains.
- Left panel: 项目 and 最近 fold independently again (collapsing 项目 used to take
  最近 with it, because both lived in one wrapper).
- Text is selectable again: the workspace root had `select-none`, so partial
  copy of a reply or of your own prompt was impossible; only the whole-message
  copy button worked. Message bodies opt back into selection explicitly.
- Your own prompts can be quoted now (the quote action exists on user turns too).
- Assistant turns are labelled with the model and provider
  (`DeepSeek V4.1 Flash (opencode-go)`) instead of "Agent (…)".
- Thinking blocks are readable: they used an unmapped `bg-[#0c0c0e]/60`, which
  stayed dark-grey in the light theme with light-grey text on top. The surface,
  the nest surfaces and the secondary (cyan) accent now go through the theme
  bridge — light theme: `#f6f8fa` panel + 6.1:1 text; dark: `#0a0a0c` + 12.8:1.
- Streaming shows a live generation rate above the turn's blocks (`≈ 99.8 tok/s`
  from a rolling 3s window over streamed characters, divided by the
  chars-per-token ratio measured on the last finished step). omp's own per-turn
  `tokensPerSecond` — a fixed figure during a turn — is the settled value, and
  the fallback when no window exists yet.
- Settings → 界面主题与偏好 → 快捷键: rebind left panel (default Ctrl+B), right
  panel (Ctrl+Alt+B) and search (Ctrl+F). Press Backspace/Delete or ✕ to leave a
  binding empty, which disables that shortcut; Ctrl means ⌘ on macOS.

## 0.3.7

- Assistant turns now render the way pi-web does. omp's `message.content` order
  is preserved as a list of blocks — thinking / text / tool — and each kind has
  its own component: thinking blocks are low-emphasis and fold (consecutive
  thinking is one fold, thinking separated by text or a tool call stays split;
  a redacted block says so instead of leaking its signature), text blocks go
  through a real markdown renderer (GFM tables, ordered and unordered lists,
  code fences, links, quotes) and tool blocks show the command, the arguments on
  demand and the output. The brain button in the composer is the global default;
  every block still overrides it, and folding only affects the DOM.
- Because omp emits one message per step, a turn is folded into one bubble whose
  blocks stay in the order the model produced them (verified on a real 123-tool
  turn: one bubble, one thinking fold) while keeping the turn's first
  session-log entry as the branch/fork anchor. Reasoning is no longer merged to
  the top of the turn.
- Replies are markdown on screen, and the copy button still yields the untouched
  markdown source.
- Left panel: **项目 / Projects** and **最近 / Recent** columns. The "removed
  projects" section is gone — dropping a project from the list is still possible
  (hover a folder) and its sessions stay reachable in Recent, which also unhides
  the project when opened.
- The message rail's ticks show a preview card on hover (role, time, step/tool
  counts and the turn's text) instead of only a tooltip.
- The bottom terminal / event console is resizable while expanded (drag its top
  edge, arrow keys nudge, double-click resets); the height is remembered.
- Composer: no focus box while typing (the accent border and the focus outline
  are gone; buttons keep the cyan omp focus ring) and its text is the same size
  as the conversation (13.5px).
- The provider card's balance slot shows real quota windows from
  `omp usage --json` (see 0.3.5) — unchanged, listed here for continuity.

## 0.3.6

- Theme: the dark palette is now omp's own midnight look — pure black surfaces
  (#000000 / #0A0A0C panels), magenta accent (#EC5BAB) with the cyan secondary
  (#7DD7E8) used for focus rings, magenta text selection, and omp's text tiers
  (#F5F5F5 / #C9C9D1 / #8E8E96). Light stays untouched; "omp Magenta" and
  "omp Cyan" joined the accent swatches. All of it flows through the existing
  token bridge, so no component markup changed.
- Branding: the new conversation shows the pixel `omp web` wordmark
  (`public/logo-chat.png`, background keyed out so it works on both themes) and
  the browser tab uses the pixel `omp` ring (`public/favicon.png`,
  `public/apple-touch-icon.png`) exactly as drawn, background included.
- Ping (event console, bottom right) is real now: it times `GET /api/health`
  against the bridge, prints the round-trip next to the button ("4.3 ms"), opens
  the log body and appends `manual.ping: bridge /api/health 200 in 4.3 ms · omp
  ready · <workspace>`. It used to append a canned "pulse sent to
  /var/run/omp.sock" line that never showed up.
- Git: the uncommitted dot on the header button is gone — the git panel carries
  that state instead, and now actually loads it. The panel (and the git dialog)
  list every uncommitted file with a status chip (修改/新增/删除/未跟踪/重命名),
  +/− line counts, and the patch inline. Two parser bugs fixed on the way:
  paths containing `b/` (`src/lib/…`) were truncated, and a status could be read
  out of patched text; statuses now come from the same `git status --porcelain`
  the header count uses, untracked files included.

## 0.3.5

- Settings: every module title is the same size (`text-sm`), and section titles
  consistently sit one step below (`text-xs`) — the providers page was the last
  outlier. Sizes follow the 排版密度 setting (compact 14px root → titles 12.25px,
  standard 16px → 14px), which is the intended way to scale the whole UI.
- Conversation text is larger: message bodies render at 13.5px with 1.7 line
  height instead of inheriting the 10.5px label size.

- Header: the top-left logo image is gone; the wordmark `OMP WebUI` stays (the
  mark is still the favicon and the new-conversation logo).

- Providers: the balance slot is real now. `GET /api/omp/provider-usage` runs
  omp's own `omp usage --json --redact` (cached five minutes) and each provider
  card shows every quota window omp reports — 5-hour / weekly / monthly / 30-day
  — with used percentage, remaining time until reset, plan type, the redacted
  account and reset credits (opencode zen, OpenAI/Codex accounts, …). Providers
  that report nothing say so honestly instead of "no balance API".
- Session sidebar: project folders can be removed from the list (hover the
  folder row → eye-off). The removal is a UI preference stored in
  `omp-studio:hidden-projects`; session files stay on disk, a "Removed projects"
  row puts them back, and opening one of its sessions restores it automatically.

## 0.3.4

- Logo: the full `logo.png` lockup (prompt ring + wordmark) is used in the header
  and on new conversations, with per-theme variants derived from it
  (`logo-dark.png` light glyphs / `logo-light.png` navy glyphs, transparent) and
  `logo.png` as the favicon. The supplied original is kept in `.assets-backup/`
  (git-ignored) and every derived file is written to a new path.
- New conversations: the quick chips are plain commands (`/skill` `/todo`
  `/compact` `/context`) — no descriptions; `/skill` still opens the
  skill-filtered completion.
- Header: the global-search shortcut hint is gone.
- Thinking level: the picker lists the levels omp reports for the active model
  and refreshes when the model changes, with `auto` always available first.
- Settings: Chinese strings no longer carry English parentheses anywhere, and
  the theme module now uses the same type scale as the other settings pages.

## 0.3.3

- Header: the search hint reads **⌘/Ctrl+K** (works on macOS and Windows).
- New conversations: the first quick chip is **挑技能** — it inserts `/skill:` and
  opens the completion list already filtered to skills.
- Settings: Chinese labels no longer carry trailing English parentheses
  (技能库 · 智能体编排 · 提供商与模型 · 主题色调 · 显示与事件流偏好 · 界面语言).
- Theme settings: the `Active:` badge, the curated palette gallery and the
  custom-studio blurb are gone; the language choice is a list; the accent
  section is titled **主题色调** and accepts any colour through a colour picker
  in addition to the swatches.
- Logo: the mark was switched to the supplied `logo.webp`, but that file was
  overwritten while trimming its whitespace and could not be recovered from git,
  the omp blob store or the image caches — the SVG mark is back in the meantime.

## 0.3.2

Choice prompts
- Extension UI requests (confirm / select / input / editor / **ask**) are now
  rendered **inline in the conversation** instead of a modal, so a question with
  options is answered where it appears. The `ask` method is fully supported:
  single- and multi-select questions, `recommended` preselecting an option,
  optional custom text per question, and omp's exact response contract (one
  answer per question in order, ids echoed, a custom input replacing the
  selection on single-select questions).

Theme
- The curated preset gallery and its 600-line preset table are gone; the
  section is now titled **主题** with exactly 跟随系统 / 深色 / 浅色 / 自定义.
  The custom studio persists a full palette (background, panel, border, text,
  accent) and paints its tokens directly.
- The header's `.omprc` shortcut is gone (the config view stays in Settings).

Skills and extensions
- Both sections render the same three-column cards with **one switch per card**
  (on/off) instead of scope text controls.
- Skills: the switch writes omp's own front-matter flag
  (`hide` / `disable-model-invocation`) — a real enable/disable — and a small
  action still moves a skill between the global and the project root.
- Extensions: the switch drives `omp plugin enable|disable`.
- New endpoint: `POST /api/skills/enable`; `GET /api/omp/skills` now reports
  `enabled`.

## 0.3.1

Fixes
- Unknown `/api/*` paths now answer JSON (`unknown_endpoint` + a hint to restart
  the bridge) instead of falling through to the SPA. A dev server started before
  a route existed used to hand the client `index.html`, which surfaced as
  `Unexpected token '<'` in the right panel and as 404s on
  `/api/skills/scope` / `/api/extensions/scope`. Restart `bun run dev` after
  pulling so the bridge serves the new routes.
- Opening a session always switches back to the chat view (the diffs view could
  stick and made a freshly opened session look empty).
- The diffs view and the right panel's diff tab now show the real working-tree
  diff instead of an empty placeholder.
- The provider/model scope read (`/api/omp/models/scope`) and the plugin
  inventory no longer 500 when omp answers with a warning line.

Changes
- Palettes reduced to **跟随系统 / 深色 / 浅色 / 自定义** (auto · dark · light ·
  custom); mist, rose and pine are gone. Custom keeps the light/dark base and
  the accent picked below it.
- The workspace panel is now files · diffs · git, and files can be **previewed**:
  markdown renders (headings, code, lists, quotes, links), images stream from
  the raw endpoint, anything else opens as source with line numbers.
- The terminal and the omp event stream are back at the bottom of the chat
  column (left of the right panel).
- The project-name badge in the chat header and the `.omprc` shortcut in the
  header are gone (the config view stays in Settings).
- Settings → MCP services has an **打开配置文件** button: the real `mcp.json`
  path, its contents, copy, and reveal-in-file-manager.
- New endpoints: `GET /api/fs/raw` (image/binary preview), `POST /api/reveal`
  (reveal one of omp's own config files), `raw` added to `GET /api/omp/mcp`.

## 0.3.0

Design system ported from `agegr/pi-web`
- One 15-token palette (`--bg`, `--bg-panel`, `--bg-hover`, `--bg-selected`,
  `--border`, `--text`, `--text-muted`, `--text-dim`, `--accent`,
  `--accent-hover`, `--accent-contrast`, `--user-bg`, `--assistant-bg`,
  `--tool-bg`, `--bg-subtle`) switched by `data-theme` on `<html>`, painted
  before first render: `light · dark · mist · rose · pine · auto`, dark by
  default. Existing literal utility classes are remapped onto the tokens, so a
  theme switch restyles the whole app without touching markup.
- System fonts only — the Google Fonts link is gone; UI text uses the system
  sans stack, mono text the system mono stack, both with CJK fallbacks. Base
  size 14px, `letter-spacing: 0`, pi-web scrollbars.
- Settings → 界面主题与偏好 opens with the palette row; the blueprint-grid
  toggle is gone (the overlay was deleted) and the font list now offers system
  mono faces.
- Chat column and composer share `--chat-content-max-width` (960px).
- Assistant messages are no longer boxed; only user turns are bubbles.

Shell
- The header wordmark is plain `OMP WebUI` (π monogram, `omp` and `oh-my-pi`
  text removed).
- The top-left branch selector is gone; branches/commits live in the git dialog
  and the right panel, and the git button shows a dirty dot.
- Token / context / rate / cache / cost moved to the top-right of the
  conversation as icon chips with hover text; the separate metrics bar and the
  composer gauge are gone (their `/compact` and auto-compaction controls moved
  onto the context chip).
- The quick command chips above the composer are gone (`/` completion covers
  discovery), and the docked event-stream terminal is gone — the stream is a
  right-panel tab.
- Git running indicators: a session lights up only while it is streaming (the
  bridge's session) or while another process appended to it in the last 90s —
  merely opening a session no longer shows a dot.

Right panel (pi-web layout)
- Rebuilt as a tabbed toolbox: **文件** (real workspace tree, lazy per
  directory, git badges, file viewer with line numbers and an `@` button that
  inserts the path into the composer), **改动** (real working-tree diff),
  **终端** (live omp event stream), **Git** (branch, changed files, commits,
  real commit form). The fixture side-chat and task-checklist tabs are gone.
- New endpoints: `GET /api/fs/list`, `GET /api/fs/file`.

Toggles
- Skills and extensions use pi-web-style switches instead of text controls:
  a globe switch (global scope) and a folder switch (this project). Clicking
  the active switch again turns the extension off; skills move between
  `~/.agents/skills` and `<project>/.agents/skills`.
- Providers and their models use the same switches (provider on/off, model
  use/off) with hover text explaining the effect.

## 0.2.0

Chat
- Assistant turns now use the same three-level progressive disclosure as
  `kahme247/ompweb`: one collapsed **Process details · N steps · M tool calls**
  fold per turn, one collapsed row per thinking/tool activity with a single-line
  preview, and expansion that reveals the `$ command`, the raw input on demand,
  the thinking text and tool output capped at 260px. The duplicated "current
  command" panel, the `Args: {…}` JSON dump and the unbounded tool output are
  gone.
- `/` completion is grouped by omp's own command `source` — 系统内置 Built-in,
  技能 Skills, 扩展 Extensions, 提示词 Prompts — ranked by match quality, with a
  460px two-column card panel (`@` file completion stays a flat list).

Layout
- Left session list, right side panel and the settings sidebar are
  width-resizable by dragging their edge (double-click resets, arrow keys nudge).
  Widths persist in `localStorage` (`omp-studio:session-panel-width`,
  `omp-studio:side-panel-width`, `omp-studio:settings-panel-width`).
- Session history groups by project folder and each folder collapses/expands on
  click (chevron in the group header); the active project opens automatically,
  the expanded set persists in `omp-studio:expanded-projects`, and an active
  search keeps matching folders open.
- The composer's top edge is draggable to change the input height
  (`omp-studio:composer-height`, 64–560px, double-click resets).

Scopes (global vs. project)
- Skills get a 全局 / 仅本项目 toggle: the skill directory is really moved
  between `~/.agents/skills` and `<project>/.agents/skills` — both roots omp
  discovers — and the session is restarted so it takes effect.
- Extensions get a 全局 / 仅本项目 / 停用 toggle: global and off go through omp's
  own `omp plugin enable|disable`, "仅本项目" pins the extension in
  `<project>/.omp/omp-studio.json` and the bridge loads it with omp's `-e` flag
  only for that workspace.

Updates
- New Settings → 更新与版本 tab: shows the OMP Studio version, probes the
  installed omp version, checks `omp update --check` and installs an update with
  one click. The bridge stops the omp session before installing (the running
  binary cannot be replaced) and restarts it afterwards, then re-probes the
  version. `omp update --force` is available for a forced reinstall.
- Settings → Providers: every provider expands to its full model list (from
  `omp models --json`) with a 使用 / 停用 toggle per model and an on/off switch
  per provider, plus a search box. Toggles write omp's own `enabledModels` /
  `disabledProviders` settings through `omp config set|reset` and restart the
  session so the catalog matches. Model roles (`modelRoles`) are shown as
  badges, and the allowlist is always materialized over the whole catalog so
  re-enabling works.
- Git is real: the header branch selector, the git dialog and the side panel's
  git tab list the repository's branches (`git for-each-ref`), the live HEAD,
  the dirty flag, real commits (`git log`) and the real `origin` URL; selecting
  a branch runs `git checkout` (git refuses a dirty tree and the refusal is
  shown), and the side panel commits for real with `git add -A` + `git commit`.
  The fabricated branch list, commit history and the "pushed to remote" claim
  are gone.
- New endpoints: `GET /api/omp/version`, `POST /api/omp/update`,
  `POST /api/skills/scope`, `POST /api/extensions/scope`,
  `GET /api/omp/models/scope`, `POST /api/omp/models/scope`,
  `GET /api/git/branches`, `POST /api/git/checkout`, `GET /api/git/log`,
  `POST /api/git/commit`.

## 0.1.0

- Initial OMP Studio: browser workspace over a real `omp --mode rpc-ui` session
  (streaming transcript, sessions, models, metrics, extension dialogs, voice,
  git diff, plugin/skill management).
