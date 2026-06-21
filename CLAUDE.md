# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Scratch Addons is a Manifest V3 browser extension (Chrome/Firefox/Edge) that injects community-built
features ("addons") into the Scratch website and project editor. **There is no build step and no
`package.json`** — the repo is loaded directly as an unpacked extension (`chrome://extensions` → Load
unpacked, or `about:debugging` → Load Temporary Add-on → `manifest.json`). Code ships as raw ES modules.

Most contributions are new addons or tweaks to existing ones, not changes to the core extension. Optimize
for that case.

## Commands

There is no compile/run command. The only local tooling is lint and format:

```sh
# Lint (CI runs this on every push/PR touching *.js)
npm i globals@^17.3.0 eslint@^9.39.2 @eslint/js@^9.39.2 @eslint/eslintrc
npx eslint . --config eslint.config.mjs

# Format — Prettier 3.2.5, config: printWidth 120, trailingComma es5, LF endings
npx prettier --write .
```

CI auto-formats PRs, so manual Prettier runs are optional. Unit tests run only via an external GitHub
Action (`ScratchAddons/meow@main`, `workflow_dispatch`) and have no local runner. `addon.json` files are
validated against `https://raw.githubusercontent.com/ScratchAddons/manifest-schema/dist/schema.json` (also
wired into VS Code via `.vscode/settings.json`).

### Lint rules that bite (Firefox compatibility)

- `event.path` is banned — use `event.composedPath()`.
- `import()` is banned in `content-scripts/*.js` — declare scripts directly in `manifest.json` instead.
- `no-unused-vars` is **off**, so dead vars won't fail CI.

## Architecture (big picture)

Three execution contexts, talking over `chrome.runtime` messaging:

- **`background/`** — the service worker (`background/background.js` is the entry; it imports the rest in
  order). Owns global state on the `scratchAddons.*` object, loads/parses every `addon.json`
  (`load-addon-manifests.js`), resolves user settings (`get-addon-settings.js`), decides which userscripts
  match the current URL (`get-userscripts.js`), and exposes handlers for fetch/auth/l10n/notifications.
- **`content-scripts/`** — `cs.js` runs at `document_start` in the page, receives the matching addon list
  from the background, and injects userstyles plus a page-world `<script type="module">`
  (`content-scripts/inject/module.js` + `run-userscript.js`) that actually executes userscripts in the
  page's **main world** (where `chrome.*` is unavailable but the Scratch VM/Redux are reachable).
- **`webpages/`** — extension UI (the Vue-based settings page `webpages/settings/`, popup, error pages).

`addon-api/` implements the `addon.*` API objects handed to userscripts (`content-script/`), popups
(`popup/`), and shared base classes (`common/`). `libraries/` holds shared helpers (`libraries/common/`)
and vendored third-party code (`libraries/thirdparty/`, excluded from lint/format).

## Writing an addon

An addon is a directory under `addons/<addon-id>/` containing an `addon.json` manifest plus its
userscripts (`.js`) and/or userstyles (`.css`). To make it load, **add the `<addon-id>` string to
`addons/addons.json`** (the ordered list of all addons).

### `addon.json` essentials

```jsonc
{
  "name": "Human-readable name",
  "description": "What it does.",
  "credits": [{ "name": "username", "link": "https://scratch.mit.edu/users/username/" }],
  "userscripts": [{ "url": "userscript.js", "matches": ["projects"], "runAtComplete": true }],
  "userstyles": [{ "url": "style.css", "matches": ["projects"] }],
  "settings": [{ "name": "Label", "id": "settingId", "type": "boolean", "default": true }],
  "tags": ["editor", "codeEditor"],        // drives categorization/search in settings UI
  "versionAdded": "1.46.0",
  "enabledByDefault": false,
  "dynamicEnable": true,                     // can toggle on without page reload
  "dynamicDisable": true                     // can toggle off without page reload
}
```

- `matches` accepts **URL-group keywords** or literal URL patterns (`https://scratch.mit.edu/...`, may use
  `*`). The keywords are defined as `WELL_KNOWN_PATTERNS` in `background/get-userscripts.js`:
  `projects` (editor/player), `projectEmbeds`, `studios`, `profiles`, `topics`, `forums`,
  `scratchWWWNoProject`, plus matchers like `isNotScratchWWW`. Read that file for the exact regexes.
- `runAtComplete: true` waits for the page (and Scratch's CSS class names) to be ready before running;
  `false` runs as early as possible.
- If a userscript reads settings live and reacts to changes, set `dynamicEnable`/`dynamicDisable: true`.
  Userstyles toggle dynamically by design; userscripts must listen for the settings-change event.

### Userscript shape

A userscript is an ES module with a default export receiving the API bag:

```js
export default async function ({ addon, console, msg, safeMsg }) {
  if (addon.settings.get("settingId")) { /* ... */ }
  const button = await addon.tab.waitForElement("[class*='green-flag_green-flag_']", { markAsSeen: true });
  button.title = msg("tooltip");
}
```

Key API surface (all under `addon`, see `addon-api/content-script/` for full signatures):

- **`addon.tab`** — DOM/page helpers. `waitForElement(selector, { markAsSeen, condition, reduxEvents })`
  is the workhorse for reacting to Scratch's React-rendered DOM (used by ~100 addons). Also
  `addon.tab.traps.vm` (the Scratch VM), `addon.tab.redux` (Redux store + events),
  `addon.tab.scratchClass("green-flag_green-flag")` to resolve Scratch's hashed CSS class names,
  `loadScript`, `editorMode`, `clientVersion`.
- **`addon.settings`** — `get(id)`, plus a settings-changed event (listen via the `Listenable` base).
- **`addon.self`** — `addon.self.dir` (this addon's URL prefix, for referencing `svg/foo.svg` assets),
  `addon.self.id`, `addon.self.browser`, `addon.self.disabled`.
- **`addon.auth`** — current Scratch session/user info.
- **`console`** — prefixed logger; **always use this**, not the global `console`.

Prefer `addon.tab.waitForElement` and `addon.tab.scratchClass` over hardcoded selectors — Scratch's class
names are hashed and change between deploys.

### Localization

User-facing strings go through `msg("key")` / `safeMsg("key")` (HTML-escaped), with English source in
`addons-l10n/en/<addon-id>.json` as `{ "<addon-id>/key": "Text" }`. Translations for other locales are
managed by Transifex — **only edit the `en` files**. A leading `/` in a key (`msg("/sharedKey")`) skips
the addon-id prefix to reference a shared string.

### Userstyles & theming

Userstyles are plain CSS injected when `matches` is satisfied. Addon settings can be interpolated into CSS
via `--<addon>-<setting>` custom properties and a small expression DSL (`settingValue`, `ternary`, `map`,
`textColor`, `multiply`, `alphaBlend`, etc.) resolved in `content-scripts/cs.js` — grep that file's
`switch (obj.type)` block for the available operations.
