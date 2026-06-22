import { updateAllBlocks } from "../../libraries/common/cs/update-all-blocks.js";
import { clearTextWidthCache } from "../middle-click-popup/module.js";

export default async function ({ addon, console }) {
  const blockly = await addon.tab.traps.getBlockly();

  const MULTIPLY = { asterisk: "*", cross: "×", dot: "·", asteriskOperator: "∗" };
  const DIVIDE = { slash: "/", obelus: "÷" };
  const SYMBOL_CLASS = "sa-operatorSymbols-symbol";

  const fullwidth = () => addon.settings.get("fullwidth");

  // The operator symbol is a single FieldLabel embedded in each block's message
  // (e.g. OPERATORS_MULTIPLY === "%1 * %2"). Scratch reads Blockly.Msg live every
  // time a block's init() runs, so mutating these messages and rebuilding the
  // blocks swaps the symbol everywhere (flyout, workspace, and future drag-outs)
  // while keeping Blockly's own width measurement correct.
  const OPERATORS = [
    { type: "operator_add", msg: "OPERATORS_ADD", symbol: () => (fullwidth() ? "＋" : "+") },
    { type: "operator_subtract", msg: "OPERATORS_SUBTRACT", symbol: () => (fullwidth() ? "－" : "-") },
    { type: "operator_multiply", msg: "OPERATORS_MULTIPLY", symbol: () => MULTIPLY[addon.settings.get("multiply")] },
    { type: "operator_divide", msg: "OPERATORS_DIVIDE", symbol: () => DIVIDE[addon.settings.get("divide")] },
    { type: "operator_lt", msg: "OPERATORS_LT", symbol: () => (fullwidth() ? "＜" : "<") },
    { type: "operator_gt", msg: "OPERATORS_GT", symbol: () => (fullwidth() ? "＞" : ">") },
    { type: "operator_equals", msg: "OPERATORS_EQUALS", symbol: () => (fullwidth() ? "＝" : "=") },
  ];

  // Remember the stock messages so we can fully restore them when disabled.
  const originalMsg = {};
  for (const { msg } of OPERATORS) originalMsg[msg] = blockly.Msg[msg];

  // Tag the operator's symbol field so the bold rule can target only these
  // symbols (and nothing else on the block). The class is applied during init,
  // before the SVG text element is built, so initView() picks it up.
  for (const { type } of OPERATORS) {
    const def = blockly.Blocks[type];
    if (!def || def.saOperatorSymbolsPatched) continue;
    const oldInit = def.init;
    def.init = function () {
      oldInit.call(this);
      if (addon.self.disabled) return;
      for (const input of this.inputList) {
        for (const field of input.fieldRow) {
          if (field instanceof blockly.FieldLabel) field.setClass(SYMBOL_CLASS);
        }
      }
    };
    def.saOperatorSymbolsPatched = true;
  }

  // Handle the bold styling from here (rather than a userstyle) so we control the
  // exact moment it toggles relative to rebuilding the blocks.
  const boldStyle = document.createElement("style");
  // Scope to the theme so this out-specifies Scratch's own
  // ".scratch-renderer.default-theme .blocklyText { font-weight: 500 }" rule.
  boldStyle.textContent = `
    .scratch-renderer.default-theme .blocklyText.${SYMBOL_CLASS},
    .scratch-renderer.high-contrast-theme .blocklyText.${SYMBOL_CLASS} { font-weight: bold; }`;
  boldStyle.disabled = true;
  document.head.appendChild(boldStyle);

  const applySymbols = () => {
    const active = !addon.self.disabled;
    for (const { msg, symbol } of OPERATORS) {
      blockly.Msg[msg] = active ? `%1 ${symbol()} %2` : originalMsg[msg];
    }
  };

  const applyBold = () => {
    boldStyle.disabled = addon.self.disabled || !addon.settings.get("bold");
  };

  const updateBlockly = () => {
    // Symbol width changed, so caches that assume the old text must be cleared.
    clearTextWidthCache();
    updateAllBlocks(addon.tab, { updateRenderer: true });
  };

  const refresh = () => {
    applySymbols();
    applyBold();
    updateBlockly();
  };

  addon.settings.addEventListener("change", refresh);
  addon.self.addEventListener("disabled", refresh);
  addon.self.addEventListener("reenabled", refresh);

  refresh();
}
