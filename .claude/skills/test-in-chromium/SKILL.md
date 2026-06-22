---
name: test-in-chromium
description: Test the Scratch Addons browser extension against real scratch.mit.edu in Chromium. Use when you need to manually verify an addon works in a real browser — launching Chromium with the unpacked extension (working around the developer-mode block), enabling an addon, and driving the browser over the Chrome DevTools Protocol to navigate, evaluate JS, reach the Scratch VM/renderer/Redux, and take screenshots. This repo has no automated tests, so this is how you verify behaviour.
---

# Testing addons in Chromium

This repo is an unpacked browser extension and has **no automated tests** — you verify changes by
loading the extension into a real Chromium and watching it run against https://scratch.mit.edu/.

The hard parts (a fresh profile disables the extension; MV3 service workers idle out; the VM attaches
asynchronously) are handled or explained below. Two helpers sit next to this file:

- `launch.sh` — launches Chromium with the extension loaded, working around the developer-mode block.
- `cdp.mjs` — a zero-dependency Chrome DevTools Protocol driver (Node 18+, uses global `fetch`/`WebSocket`).

## 1. Launch

**Always use headful (visible) Chrome.** It runs on the real GPU — which matters for WebGL/rendering
addons that look or behave differently under software rendering — and it lets the person you're working
with watch what you're doing. `launch.sh` is headful by default; don't run it headless.

```sh
# Visible window, opens a fresh editor project:
.claude/skills/test-in-chromium/launch.sh

# Or point it at a specific repo / starting URL:
.claude/skills/test-in-chromium/launch.sh "$(pwd)" "https://scratch.mit.edu/projects/editor/"
```

`launch.sh` prints the open targets and the DevTools endpoint (`http://localhost:9222`). It uses a
throwaway profile at `/tmp/sa-test-profile` and **does not touch the user's real Chromium profile**
(that profile is usually already running and its lock would conflict — always use a separate
`--user-data-dir`). It needs a display; on this machine that's `DISPLAY=:0`.

**Each launch starts from a fresh profile by default** — `launch.sh` kills any Chromium using the
profile and deletes it before launching, so stale state from a previous test run can't leak in (this
is what caused "weird" reused-profile behaviour). That means the dev-mode fix is re-applied and addons
must be re-enabled every launch. Set `SA_TEST_KEEP_PROFILE=1` to reuse the existing profile instead.

### Why the launcher exists: the developer-mode gotcha

A brand-new Chromium profile has **Developer mode OFF**. Recent Chrome then disables any unpacked
(`--load-extension`) MV3 extension with disable reason `16777216`
(`DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION`) — so **no content scripts inject and nothing works**, with
no obvious error. `launch.sh` fixes this once per profile by editing
`<profile>/Default/Preferences`: setting `extensions.ui.developer_mode = true` and clearing that disable
reason (`state = 1`). In a fresh profile these prefs are not MAC-protected, so editing them is safe.

If you ever see SA "not injecting" (no `__scratchAddonsTraps`, no SA logs), check
`chrome://extensions` — if it says "Turn on developer mode to use this extension," that's this issue.

## 2. Enable the addon you're testing — through the settings UI

Addons are **off by default**. Enable the one you're testing the same way a user would: open the
Scratch Addons **settings page**, find the addon, and flip its on/off toggle.

- Settings page URL: `chrome-extension://<EXTENSION_ID>/webpages/settings/index.html`
  (get `<EXTENSION_ID>` from the `service_worker` target that `launch.sh` printed).
- If the window is visible, just toggle it by hand. To automate over CDP, open the settings page,
  use its search box to filter to the addon, and click its enable toggle. **Don't hardcode the toggle's
  selector** — the settings markup changes; discover the element at runtime (read the DOM) instead.

Toggling in the UI is the supported path: it persists the choice to `chrome.storage` **and** dynamically
applies to already-open project tabs (for `dynamicEnable`/`dynamicDisable` addons), so newly opened tabs
pick it up too. Toggling it off again is the right way to test that disabling cleanly restores normal
behaviour.

## 3. Drive the browser over CDP

`cdp.mjs` gives you targets, JS evaluation, navigation, and screenshots with no npm install. Write small
`.mjs` scripts (or one-liners) that import it:

```js
import { openScratchPage, sleep } from "./.claude/skills/test-in-chromium/cdp.mjs";

const page = await openScratchPage();          // Conn to the scratch.mit.edu tab
await page.navigate("https://scratch.mit.edu/projects/editor/");
await sleep(9000);                              // let the editor + project load

const info = await page.eval(`JSON.stringify({
  url: location.href,
  addonRan: typeof __scratchAddonsTraps,        // "object" once SA has injected
})`);
console.log(info);

await page.screenshot("/tmp/shot.png");         // full page; pass a clip to crop/zoom
page.close();
```

Helpers in `cdp.mjs`: `listTargets()`, `scratchPage()`, `serviceWorker()`, `browserWs()`,
`openScratchPage()`, `openFreshScratchTab()`, and `Conn` with `.eval()`, `.navigate()`,
`.screenshot()`, `.autoAcceptDialogs()`, `.send()` (raw CDP), `.onEvent()`. `page.eval()` runs in the
page **main world**, where the Scratch globals below live.

### Reloading after you edit addon files — use a fresh tab, not navigate

The Scratch **editor installs a `beforeunload` "unsaved changes" prompt**. Once the project has been
touched (and many tests touch it — dragging, dispatching VM actions), `page.navigate()` or a reload
**hangs forever** on that native dialog, and your script times out with no output. Two fixes, both in
`cdp.mjs`:

- **Preferred:** `const page = await openFreshScratchTab()` — opens a brand-new editor tab (which loads
  your latest edited files from disk) and force-closes the old Scratch tab(s) without triggering their
  beforeunload. This is the clean way to pick up file edits between test runs.
- If you must reuse a tab, `page.navigate()` now calls `autoAcceptDialogs()` first so the prompt is
  auto-accepted instead of hanging. You can also call `await page.autoAcceptDialogs()` yourself once
  after connecting.

Don't poll a backgrounded test with `sleep N && cat …` at increasing delays — it's slow. Keep waits
inside the script (`await sleep(...)`), run it once, and read its output when it returns.

### Reaching Scratch internals from `page.eval()`

These run the project and inspect/poke it (verify against the current source if something has moved):

```js
// The scratch-vm instance (how SA addons get it too):
const vm = __scratchAddonsTraps._onceMap.vm;

vm.greenFlag();                                  // run the project
const sprite = vm.runtime.targets.find(t => !t.isStage);
sprite.setXY(60, -20); sprite.setDirection(135); // move/rotate a sprite
vm.renderer.dirty = true; vm.renderer.draw();    // force a redraw

// Redux store (stage size / fullscreen / player mode), e.g.:
__scratchAddonsRedux.dispatch({ type: "scratch-gui/mode/SET_FULL_SCREEN", isFullScreen: true });
__scratchAddonsRedux.dispatch({ type: "scratch-gui/StageSize/SET_STAGE_SIZE", stageSize: "small" });
```

`https://scratch.mit.edu/projects/editor/` opens a fresh unsaved project (no login needed) — the
simplest reliable test page. `/projects/<id>/` is the player and `/projects/<id>/embed` the embed; all
three load the VM. Real project ids for richer scenes: query
`https://api.scratch.mit.edu/explore/projects?limit=8&mode=trending&q=*`.

### Screenshots

`page.screenshot(path)` saves a full-page PNG. To zoom into a region (e.g. just the stage), pass a clip
from a `getBoundingClientRect()` you read via `eval`:

```js
const r = JSON.parse(await page.eval(`(()=>{const e=document.querySelector("CANVAS_OR_OVERLAY");const b=e.getBoundingClientRect();return JSON.stringify({x:b.x,y:b.y,width:b.width,height:b.height})})()`));
await page.screenshot("/tmp/clip.png", r);       // defaults to scale: 2
```

Then `Read` the PNG to look at it.

## Gotchas

- **MV3 service worker idles out.** The `service_worker` target disappears when idle. Re-list targets a
  moment later, or just open/refresh a page to wake the extension. Don't assume it's always present.
- **New navigations pick up file edits automatically.** Because the extension is unpacked, Chrome reads
  files fresh from disk, so a brand-new tab gets your latest `userscript.js`/CSS. A tab that **already**
  loaded the old code needs a plain reload to pick up edits (or disable cache:
  `Network.setCacheDisabled` before navigating). You rarely need a full extension reload.
- **The VM/renderer attach asynchronously.** On the player especially, `vm.runtime.renderer` may not
  exist yet when a userscript first runs. If you're testing something renderer-related and it "does
  nothing on the player but works in the editor," that timing is the likely cause — wait for the
  renderer rather than reading it once.
- **Some globals are SA/Scratch internals** (`__scratchAddonsTraps`, `__scratchAddonsRedux`, redux
  action types). They're stable enough to test with but can change across versions — if one is missing,
  check the current source rather than trusting this doc.

## Cleanup

```sh
pkill -f "user-data-dir=/tmp/sa-test-profile"   # stop the test Chromium
```

By default the profile is wiped and recreated on every `launch.sh` run, so there's usually nothing to
clean up manually. If you launched with `SA_TEST_KEEP_PROFILE=1`, `rm -rf /tmp/sa-test-profile` to
reset it.
