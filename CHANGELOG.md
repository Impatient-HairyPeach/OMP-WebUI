# Changelog

All notable changes to OMP Studio. Versions match the app version shown in
Settings (`v<version> · <build date>`).

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
