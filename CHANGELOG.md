# Changelog

All notable changes to OMP Studio. Versions match the app version shown in
Settings (`v<version> · <build date>`).

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
