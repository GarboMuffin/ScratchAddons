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
- **#3225** — Backpacking scratchblocks in forums (7 👍) — **INFEASIBLE (no parser + account-gated)**.
  Needs a scratchblocks-3.x → sb3 parser that doesn't exist (maintainers confirmed in-thread it's
  missing/ambiguous, esp. non-English); only `editor-copy-scratchblocks` does the forward direction.
  The backpack (backpack.scratch.mit.edu) only exists logged-in and all writes need the user's token, so
  it can be neither implemented end-to-end nor verified without an account — out of scope per loop rules.
- **#4638** — Font size for costume editor (7 👍) — **IMPLEMENTED**.
  New addon `costume-editor-font-size`: numeric "Font size" box in the vector paint editor mode-tools row;
  reads/sets effective size (fontSize×scale) of selected text item(s), preserves center, commits via
  onUpdateImage. Multi-select sets many labels to one size. Verified set/multi/undo/disable in Chromium.
- **#5003** — Clone variables from set and change (7 👍) — **IMPLEMENTED (in block-duplicate)**.
  Added a setting to `block-duplicate`: alt-dragging the variable dropdown of a set/change block pulls out
  a `data_variable` reporter (via the existing Gesture patch + Gesture.startField) instead of duplicating
  the whole block. Verified set+change reporter pull, block-body still dupes, and setting-off revert.
- **#5248** — Disable addons remotely for all users (7 👍) — **INFEASIBLE (infra + unresolved policy)**.
  Needs a team-controlled server file (data.scratchaddons.com/disabledaddons.json → currently HTTP 404)
  that I can't create/verify, plus core-background + privacy-policy + consent-UI changes. 61 comments,
  no maintainer consensus (privacy/opt-out debated). Sensitive remote kill-switch — out of scope per loop.
- **#4983** — Use colors in our UIs more meaningfully (7 👍) — **IMPLEMENTED (badge cleanup slice)**.
  Settings badges: 4 loud category colors (forums/editor/player/website) → one neutral gray; beta red→yellow;
  new/updated purple→orange (purple removed, incl. update-notice border). Left the contested orange↔blue
  brand recolor (#4810) alone. Verified all badge colors render correctly in Chromium (main + Themes).
- **#6388** — Name the project being shared/unshared/deleted (7 👍) — **IMPLEMENTED (in confirm-actions)**.
  Confirmation dialogs now name the project: share reads the redux title (project page + editor), unshare/
  delete read the My Stuff row title (.media-info-item.title>a); falls back to the generic message if no
  name. Verified share (real redux title), unshare+delete (mock row), and fallback in Chromium.
- **#1930** — Read /messages without auto-marking as read (6 👍) — **INFEASIBLE (account-gated)**.
  Mechanism known: block the `POST /site-api/messages/messages-clear/` request scratch-www fires after
  messages load (needs DNR/webRequest, per maintainer) + add a manual "Mark all as read" button. But the
  unread counter, the request (403 without auth), and the button all live on the login-only /messages page,
  so nothing is observable/verifiable without an account — out of scope per loop rules.
- **#1092** — Change the green color of the forums (6 👍) — **INVALID/OBSOLETE (no longer green)**.
  The forums were redesigned since 2020: the "Discuss Scratch" header (`#brdheader`/`.box`) is now neutral
  light gray `#f7f7f7` (confirmed in Scratch's own main.css, dark-www off) with no green anywhere. The
  green header the issue asks to recolor no longer exists, so there's nothing to change.
- **#3642** — Use drop-downs on the Settings Page (6 👍) — **IMPLEMENTED**.
  `select`-type settings with 3+ options now render as a compact themed `<select>` dropdown instead of a
  wide button row; 2-option ones keep the pill toggle (per maintainer TheColaber). Edited addon-setting
  component. Verified 4-opt/3-opt → dropdown, 2-opt → pills, value change, and enabled/disabled in Chromium.
- **#2622** — Better test our new addons (6 👍) — **IMPLEMENTED (PR-template checklist)**.
  Process/meta issue; its one concrete deliverable was a testing checklist in the PR template's Tests
  section. Added optional reminders (browser, console, settings, dynamic enable/disable, other-addon
  interplay) — framed as encouragement, not requirements, per maintainer pushback against mandating it.
- **#5719** — Groups of settings (6 👍) — **IMPLEMENTED (extension-side; awaits schema)**.
  Added the maintainer-agreed Option-2 rendering: settings sharing a `group` render inside a labelled
  `<fieldset>` (top-level `settingGroups` give localized names). Works on the settings page + popup iframe.
  NOTE: addon.json can't declare it until the external manifest-schema adds the fields (CI-validated,
  additionalProperties:false). Verified end-to-end with a temp scratch-notifier manifest (reverted).
- **#5044** — An addon to resize the block palette (6 👍) — **IMPLEMENTED**.
  New addon `resize-palette`: draggable divider on the flyout's right edge resizes the block palette
  (overrides Scratch's fixed flyout getWidth() + reflow); persists via localStorage, double-click resets.
  Verified widen/narrow, persistence, reset, disable, and hide-flyout compatibility in Chromium.
- **#5490** — Separate branch for beta/translation period (6 👍) — **INFEASIBLE (process/governance)**.
  Pure release-workflow proposal (master/beta branching, release cadence) — needs maintainer policy
  adoption + Transifex reconfig + branch/CI automation, no consensus (apple502j skeptical, cadence
  debated). No concrete in-repo code deliverable; can't implement/verify in a loop. Out of scope.
- **#5181** — Show "Cmd"/"Ctrl" per platform in descriptions (6 👍) — **IMPLEMENTED (l10n placeholder)**.
  Added OS-aware `{cmdKey}`/`{optKey}` placeholders to the l10n lib (localizable key names in `_general`,
  substituted for all locales incl. the English fast-path); applied to ctrl-enter-post + block-duplicate,
  dropping their redundant macOS notes. Verified Ctrl/Alt (Linux) and Cmd/Option (Mac UA) in Chromium.
- **#5707** — Smarter TurboWarp button (6 👍) — **IMPLEMENTED (in turbowarp-player)**.
  The open-new-tab action now opens the first turbowarp.org link found in the project's instructions/notes
  (preserving the creator's URL params), else the default turbowarp.org/<id>. New setting (default on),
  public projects only. Verified default/notes-link/edge-cases/setting-off via window.open intercept.
- **#6721** — Coding experience checklist (6 👍) — **TRACKING ISSUE; addressed its docs item**.
  Umbrella checklist of sub-issues (most are separate #s, several already done). Implemented its one
  un-delegated, concrete item: CONTRIBUTING.md now explains opening the whole repo folder in VS Code so
  the `.vscode/` workspace settings (manifest-schema validation, formatter, recommended extensions) apply.
- **#1271** — Comment out blocks (5 👍) — **DEFERRED (proven approach, but large/risky for one loop)**.
  Confirmed: VM ignores Blockly disabled (no `disabled` in scratch-vm/sb3), but wrapping a block in
  `if<1=0>` stops execution (tested: control 100→150, wrapped stays 100). Sync path is Xml.domToBlock +
  Blockly connections (like block-switching); refreshWorkspace duplicates blocks. A safe, fully-tested
  comment/uncomment with all stack-position edge cases is more than one loop can responsibly verify.
