export default async function ({ addon, console, msg }) {
  const paper = await addon.tab.traps.getPaper();

  // Scratch's text tool creates text at fontSize 40 with leading 46.15.
  const DEFAULT_LEADING_RATIO = 46.15 / 40;
  const MODE_TOOLS_SELECTOR = "[class*='mode-tools_mode-tools']";

  let control = null;
  let input = null;

  const getInternalKey = (el) => addon.tab.traps.getInternalKey(el);

  /** All currently selected text items (in either the Text tool or the Select tool). */
  function getSelectedTexts() {
    if (!paper.project) return [];
    return paper.project.getItems({ recursive: true, class: paper.PointText }).filter((item) => item.selected);
  }

  /** Effective on-screen font size = base fontSize times the item's vertical scale. */
  function effectiveSize(item) {
    const scaleY = (item.matrix && Math.abs(item.matrix.scaling.y)) || 1;
    return item.fontSize * scaleY;
  }

  /** Walk up the React tree from a paint-editor element to find the onUpdateImage commit callback. */
  function getOnUpdateImage(fromEl) {
    let fiber = fromEl[getInternalKey(fromEl)];
    while (fiber) {
      const props = fiber.memoizedProps;
      if (props && typeof props.onUpdateImage === "function") return props.onUpdateImage;
      fiber = fiber.return;
    }
    return null;
  }

  function buildControl() {
    const wrap = document.createElement("div");
    wrap.className = "sa-cefs-control";

    const label = document.createElement("span");
    label.className = "sa-cefs-label";
    label.textContent = msg("font-size");

    input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "500";
    input.step = "1";
    input.className = "sa-cefs-input";
    input.title = msg("font-size");
    // Keep keystrokes from reaching the paint editor's shortcut handlers.
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("change", apply);
    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") apply();
    });

    wrap.append(label, input);
    return wrap;
  }

  function apply() {
    if (addon.self.disabled) return;
    const texts = getSelectedTexts();
    if (!texts.length) return;

    let value = parseFloat(input.value);
    if (isNaN(value) || value <= 0) {
      update();
      return;
    }
    value = Math.min(500, Math.max(1, value));

    for (const item of texts) {
      const scaleY = (item.matrix && Math.abs(item.matrix.scaling.y)) || 1;
      const ratio = item.fontSize ? item.leading / item.fontSize : DEFAULT_LEADING_RATIO;
      const center = item.position.clone();
      item.fontSize = value / scaleY;
      item.leading = item.fontSize * (ratio || DEFAULT_LEADING_RATIO);
      // Keep the label centred where it was rather than growing from the baseline.
      item.position = center;
    }

    // Redraw the selection rectangle around the resized text.
    try {
      if (paper.tool && paper.tool.boundingBoxTool) paper.tool.boundingBoxTool.setSelectionBounds();
    } catch (e) {
      // ignore
    }

    // Commit to the costume + undo stack via scratch-paint's onUpdateImage.
    const modeTools = document.querySelector(MODE_TOOLS_SELECTOR);
    const commit = modeTools && getOnUpdateImage(modeTools);
    if (commit) commit();

    update();
  }

  function update() {
    const modeTools = document.querySelector(MODE_TOOLS_SELECTOR);
    const texts = addon.self.disabled ? [] : getSelectedTexts();

    if (!modeTools || texts.length === 0) {
      if (control && control.parentElement) control.remove();
      return;
    }

    if (!control) control = buildControl();
    if (control.parentElement !== modeTools) modeTools.appendChild(control);

    // Don't stomp on what the user is typing.
    if (document.activeElement !== input) {
      const sizes = texts.map((t) => Math.round(effectiveSize(t)));
      const allSame = sizes.every((s) => s === sizes[0]);
      input.value = allSame ? String(sizes[0]) : "";
      input.placeholder = allSame ? "" : "–";
    }
  }

  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", ({ detail }) => {
    switch (detail.action.type) {
      case "scratch-paint/modes/CHANGE_MODE":
      case "scratch-paint/select/CHANGE_SELECTED_ITEMS":
      case "scratch-paint/select/REDRAW_SELECTION_BOX":
        update();
        break;
    }
  });

  addon.self.addEventListener("disabled", update);
  update();
}
