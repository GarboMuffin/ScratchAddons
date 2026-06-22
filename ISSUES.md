# Issues processed

One issue per loop. "Processed" = implemented, or judged already-done / invalid / infeasible.
Do not re-pick an issue listed here.

- **#1758** — Customize front page (7 👍) — **IMPLEMENTED**.
  New addon `customize-homepage`: hide built-in homepage rows (Featured Projects/Studios, SDS,
  curator, community loving/remixing, news, what's-happening, following) via structure-based
  detection (language-independent), plus add custom rows from a studio or explore (trending/popular).
  Verified hide + custom rows render + dynamic disable in Chromium.
- **#2217** — Resizable editor areas (8 👍) — **IMPLEMENTED (scoped to stage)**.
  New addon `resizable-stage`: drag a divider between code area and stage to resize the stage
  (real CSS resize + renderer.resize, controls stay crisp; sprite pane uses native compact
  layout when narrow). Double-click resets. Verified in Chromium.
- **#2336** — Copy block/stack to clipboard as scratchblocks (12 👍) — **IMPLEMENTED**.
  New addon `editor-copy-scratchblocks`: right-click "Copy as scratchblocks" / "Copy all"
  (Blockly tree → scratchblocks text). Verified in Chromium.
- **#4471** — Autoscroll when dragging scripts (12 👍) — **IMPLEMENTED**.
  New addon `editor-autoscroll`: drag toward the code-area edges to auto-scroll; the block stays
  pinned under the pointer. Configurable speed/edge size. Verified in Chromium.
- **#1095** — Better backpack (11 👍) — **IMPLEMENTED (scoped)**.
  New addon `backpack-preview`: hover a backpack item for a large floating preview (tiny ~32px
  tiles make scripts unreadable). Configurable size/delay. Verified in Chromium.
- **#817** — More blocks addon (10 👍) — **IMPLEMENTED (scoped to maintainer-blessed subset)**.
  New addon `editor-more-blocks`: adds a "More Blocks" palette category with the hidden-but-functional
  vanilla 2.0 carryover blocks (while, for each, all at once, counter trio). They save as real opcodes
  so projects run for everyone. Verified in Chromium (renders + counter executes).
- **#5211** — Rethink the Scratch Addons mission statement (10 👍) — **ALREADY DONE**.
  `README.md` already uses the agreed mission statement verbatim; the old "collect, archive" wording
  is absent from this repo. Extension-store description was deferred to a separate issue.
- **#2645** — Bolder / larger operator symbols (7 👍) — **IMPLEMENTED**.
  New addon `operator-symbols`: bolds the tiny + - * / < > = symbols and offers swaps (× ÷,
  full-width ＋－＝＜＞). Mutates Blockly.Msg + tags the symbol FieldLabel; verified bold/subst/restore.
- **#2110** — Make editor header/menu less crowded (8 👍) — **IMPLEMENTED (maintainer-blessed slice)**.
  New addon `editor-addon-menu`: native-styled "Addons" menu beside File/Edit with a Settings link +
  Feedback, plus a shared `api.js` (addItem/removeItem) so addon buttons get one home instead of
  cluttering the bar. Verified light/dark, open/close, settings link, shared API, dynamic toggle.
- **#2215** — Live Comment Refreshing (8 👍) — **IMPLEMENTED (projects only, per maintainer)**.
  New addon `live-comments`: polls the project comments API every 15s–2min and merges new top-level
  comments + new replies (opened threads) into scratch-www's Redux (ADD_NEW_COMMENT/SET_REPLIES) so
  React renders them fully; op-badge/infinite-scroll stay compatible. Verified end-to-end + disable.
- **#1643** — Pin comments in projects and studios (8 👍) — **INFEASIBLE (account-gated, can't verify)**.
  Maintainer-endorsed design stores the pin in the owner's project/studio description ("Pinned
  comment: <link>"); pinning therefore requires logging in as the owner, and no real pinned data can
  exist to test the display side. Both halves need a Scratch account — out of scope per loop rules.
- **#5209** — Improve onboarding process (8 👍) — **IMPLEMENTED (onboarding wizard, per mockups)**.
  New in-extension `webpages/onboarding/` "Setup" wizard (welcome → editor/player/website/popup addon
  cards → done), enables curated addons via changeEnabledState; opened on install (transition.js).
  Follow-up site popups/inactivity reminders are separate future work. Verified full flow in Chromium.
- **#5127** — Unread message count on popup "Messaging" tab (8 👍) — **IMPLEMENTED**.
  Popup shows a blue count badge on the Messaging tab; new background `getMsgCount` reads the cached
  IDB count, popup polls it (3s) + on tab switch. Hidden when logged out / 0; formats 1k / 9k+.
  Verified handler, render, formatting, and logged-out hiding in Chromium (mockup-faithful).
- **#1748** — Add help feature to editor (7 👍) — **IMPLEMENTED**.
  New addon `block-help`: right-click a block → "Help" opens its Scratch Wiki page (verified opcode→page
  map for the standard palette, category-page fallback otherwise). Verified in Chromium via real Blockly
  context menus that the item appears and opens the correct URL (incl. +, #, % encoding).
- **#1442** — WYSIWYG forum editor (7 👍) — **ALREADY DONE (accepted compromise) + remainder infeasible**.
  Thread converged off "true WYSIWYG" (maintainers: "too complicated") onto a live-preview compromise,
  which ships as `forum-live-preview` (auto server-preview on typing pause); BBCode-insertion toolbar
  ships as `forum-toolbar`. True client-side WYSIWYG needs an inaccurate BBCode/scratchblocks parser and
  the post editor is login-gated, so untestable per loop rules.
- **#2271** — Hovercards (or tooltips) (7 👍) — **IMPLEMENTED (user hovercards)**.
  New addon `user-hovercards`: hover any username/avatar (profile links sitewide) → floating card with
  avatar, ST badge, country, join date, About me / What I'm working on (api.scratch.mit.edu, cached).
  Auto-adapts to dark backgrounds (dark-www). Verified light/dark, ST badge, project comments + disable.
- **#3700** — Split editor-devtools into more specific addons (7 👍) — **IMPLEMENTED (final split step)**.
  Extracted the variable/list "swap" feature into new addon `swap-variables`; `editor-devtools` is now just
  the advanced context menu (copy/cut/paste + make space), matching maintainer Joeclinton1's 2-addon plan.
  (find-bar, jump-to-def, swap-local-global, move-to-top-bottom, cleanup-blocks-plus already split prior.)
  Verified menu item presence, functional swap, devtools intact, no duplicate, clean dynamic disable.
