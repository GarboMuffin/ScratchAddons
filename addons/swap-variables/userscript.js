import UndoGroup from "../../libraries/common/cs/UndoGroup.js";
import { getVariableUsesById } from "../../libraries/common/cs/devtools-utils.js";

export default async function ({ addon, msg, safeMsg: m }) {
  const getWorkspace = () => addon.tab.traps.getWorkspace();

  /**
   * Re-points every use of the variable/list `varId` in the current sprite at the
   * existing variable/list named `newVarName` (of the same type).
   */
  const doReplaceVariable = (varId, newVarName, type) => {
    const wksp = getWorkspace();
    const v = wksp.getVariableMap().getVariable(newVarName, type);
    if (!v) {
      alert(msg("var-not-exist"));
      return;
    }
    const newVId = v.getId();

    UndoGroup.startUndoGroup(wksp);
    const blocks = getVariableUsesById(varId, wksp);
    for (const block of blocks) {
      try {
        if (type === "") {
          block.getField("VARIABLE").setValue(newVId);
        } else {
          block.getField("LIST").setValue(newVId);
        }
      } catch (e) {
        // ignore
      }
    }
    UndoGroup.endUndoGroup(wksp);
  };

  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled) return items;
      if (block.type.startsWith("data_")) {
        const selVarID = block.getVars()[0];
        const isList = block.type.includes("list");
        items.push(
          { separator: true },
          {
            enabled: true,
            text: m("swap", { var: isList ? m("lists") : m("variables") }),
            callback: () => {
              const wksp = getWorkspace();
              const v = wksp.getVariableMap().getVariableById(selVarID);
              const varName = window.prompt(msg("replace", { name: v.name }));
              if (varName) {
                doReplaceVariable(selVarID, varName, v.type);
              }
            },
          }
        );
      }
      return items;
    },
    { blocks: true, flyout: true }
  );
}
