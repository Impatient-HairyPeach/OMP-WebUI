# OMP Studio

Browser workspace for the locally installed [`omp`](https://github.com/can1357/oh-my-pi) coding agent. The chat is driven by a real `omp --mode rpc-ui` process; sessions, transcripts, models, slash commands, token usage and the queue all come from omp itself.

## Requirements

- `omp` on `PATH` (or set `OMP_BIN`). Verified against `omp/18.8.3`.
- Node.js 22+ (or Bun). Dependencies: `bun install` / `npm install`.

## Run

```bash
bun install
bun run dev            # http://localhost:3000
```

`bun run dev` starts one process that serves the SPA (vite middleware) **and** the bridge API, and spawns `omp` in the current directory.

Production build: `bun run build && bun run start`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | HTTP listener |
| `OMP_BIN` | `omp` | Agent executable |
| `OMP_CWD` | process cwd | Working directory for the omp session |
| `OMP_RESUME` | – | Session `.jsonl` to resume on startup |
| `OMP_ARGS` | – | Extra argv passed to `omp` |
| `OMP_SESSION_ROOT` | `~/.omp/agent/sessions` | Where sessions are listed from |
| `OMP_ARCHIVE_ROOT` | `<session root>/../archive/sessions` | omp gc archive location |
| `OMP_SKILLS_DIR` | `~/.agents/skills` | Where GitHub skill imports land |

## API (bridge)

- `GET /api/health` — bridge + omp status, workspace, resumed session
- `GET /api/events` — SSE: `status`, `log`, `frame` (one omp JSONL frame each)
- `POST /api/commands` — send any omp RPC command, resolves its response
- `GET /api/sessions` — real sessions on disk + `archived` (gzip archive) + roots
- `POST /api/session/open` `{path}` — resume; returns transcript + log entries + branch anchors
- `POST /api/session/new` `{cwd}` — fresh session
- `POST /api/workspace` `{cwd}` — restart the agent in another directory
- `POST /api/sessions/archive` `{path}` / `POST /api/sessions/restore` `{key}` — move a session into / out of `~/.omp/agent/archive/sessions` (omp's own gc layout, `.jsonl.gz`); refuses sessions written in the last two minutes or the session the bridge is running
- `POST /api/sessions/delete` `{path}` — delete a session file (same guard)
- `POST /api/cli` `{args}` — run an allowlisted `omp` subcommand (`plugin`, `skill`, `install`, `models`, `agents`, …)
- `POST /api/skills/import` `{repo}` — `git clone` a skill repo into `~/.agents/skills/<repo>`
- `POST /api/skills/scope` `{name, scope}` — move a skill directory between `~/.agents/skills` (global) and `<workspace>/.agents/skills` (project), then restart the session
- `POST /api/extensions/scope` `{name, scope}` — `global` / `project` / `off` for an installed extension: global+off drive omp's own `omp plugin enable|disable`, `project` pins it in `<workspace>/.omp/omp-studio.json` and the bridge loads it with omp's `-e` flag only in that workspace
- `GET /api/omp/version` — real `omp --version` probe
- `POST /api/omp/update` `{action: "check" | "update", force?}` — `omp update --check` (cached an hour) / `omp update`; the update stops the session, installs, restarts the session and re-probes the version
- `GET /api/omp/models/scope` / `POST /api/omp/models/scope` `{kind: "model" | "provider", selector? | provider?, enabled}` — every model in `omp models --json` plus omp's own `enabledModels` / `disabledProviders` settings; toggling writes them with `omp config set|reset` and restarts the session
- `GET /api/git/branches` — real branches (`git for-each-ref`), HEAD, dirty flag, `origin` URL
- `POST /api/git/checkout` `{branch}` — real `git checkout` (only branches that exist in `refs/heads`)
- `GET /api/git/log?limit=` — real `git log` of the current branch
- `POST /api/git/commit` `{message}` — real `git add -A` + `git commit -m`
- `GET /api/fs/list` — one directory of the workspace for the file explorer (paths confined to the workspace)
- `GET /api/fs/file` `{path, limit?}` — one text file for the viewer (line count, size, truncation flag)
- `POST /api/say` `{text}` — omp's local TTS engine, returns `audio/wav`
- `GET /api/git/diff` — real working-tree diff of the agent's workspace

## Chat features

- Streaming transcript from omp: text, thinking, tool calls with real results, abort, steer, follow-up queue.
- Assistant activity uses three-level progressive disclosure (same shape as `kahme247/ompweb` and `agegr/pi-web`): a collapsed **Process details** fold per turn → collapsed per-activity rows with one-line previews → expansion showing the `$ command`, the raw input on demand, the thinking text and tool output capped at 260px.
- `/` completion is grouped by omp's own command source (系统内置 / 技能 / 扩展 / 提示词) in a 460px two-column panel; `@` completion lists workspace files.
- Token, context, generation-rate and cache figures are icon chips at the top-right of the conversation (hover for the numbers); the context chip opens `/compact` and the auto-compaction toggle.
- Message actions: copy, edit-from-here (session-log branch), retry, fork the session at a turn, quote, read aloud.
- Right rail: one tick per turn — click to jump, highlights the visible turn, jump-to-latest button.
- Voice: browser dictation into the composer (mic) and read-aloud through `omp say`, with the browser voice as fallback.
- Sessions: grouped by project directory (each folder collapses, the active folder opens automatically), searchable, archive/restore, delete, plus model + thinking-level switching from omp's own catalogs.

## Theme

The palette is a port of pi-web's: 15 tokens on `data-theme`, six choices
(`light · dark · mist · rose · pine · auto`, dark by default), applied before
first paint, plus system-only font stacks for Latin and CJK. Settings →
界面主题与偏好 switches it; nothing else needs to change because components read
tokens rather than colours.

## Right panel

Tabs: **文件** (real workspace tree, file viewer with line numbers, `@` path
insertion into the composer), **改动** (real working-tree diff), **终端** (live
omp event stream), **Git** (branch, changed files, commits, real commit form).
Width is draggable and remembered.

## Layout

- The session list, the right panel and the settings sidebar are width-resizable by dragging their edge; double-click resets, arrow keys nudge.
- The composer's top edge is draggable to change its height; the chat column and composer share `--chat-content-max-width` (960px).
- All preferences persist in `localStorage` (`omp-studio:session-panel-width`, `omp-studio:side-panel-width`, `omp-studio:settings-panel-width`, `omp-studio:composer-height`, `omp-studio:expanded-projects`, `omp_palette`).

## Scopes, updates

- Skills: a globe switch stores the skill in `~/.agents/skills`, a folder switch moves it to `<project>/.agents/skills` (both discovered by omp) and the session restarts.
- Extensions: the same two switches — globe = enabled everywhere (`omp plugin enable`), folder = pinned to this project only (`omp plugin disable` + omp's `-e <entry>` for that workspace), both off = disabled.
- Providers and models: switches per provider and per model, written to omp's own `enabledModels` / `disabledProviders`.
- Settings → 更新与版本 checks the installed omp (`omp update --check`) and installs an update with one click, stopping and restarting the session around it. The app's own version/build date is shown there and in the settings sidebar footer.

## Verification

```bash
bun run dev                 # in one terminal
bun run test:e2e            # real prompt, streaming, abort, resume, guards, cleanup
```

## What is real vs. fixture data

Real: chat transcript, streaming text/thinking/tool calls, abort, steer/queue, model + thinking-level switching, slash commands and their source categories, `/compact` and auto-compaction, context/cost/token-rate/cache metrics, session list/open/delete/archive/restore, edit-from-here (session-log branch), fork, extension dialogs and status chips, working-tree diffs, plugin/skill install through the omp CLI, GitHub skill import, local-voice read-aloud and dictation, MCP/plugin/skill/agent/provider/config inventories read from omp's own files, skill + extension + model scope switches, the omp update check/install, the workspace file tree and file viewer (with `@` insertion), the palette/theme system, and every git surface (branches, checkout, commits, diff, commit).

Still fixture data: the local-only `DeployModal`, `InstallSkillModal`'s non-CLI fields (name/description the user types), and the `ThemeView` preset gallery (the live control is the palette row above it).
