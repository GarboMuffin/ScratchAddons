# Issues processed

One issue per loop. "Processed" = implemented, or judged already-done / invalid / infeasible.
Do not re-pick an issue listed here.

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
