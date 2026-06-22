import updateToolboxXML from "../../libraries/common/cs/update-toolbox-xml.js";

export default async function ({ addon, console, msg, safeMsg }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();

  // These opcodes are real Scratch VM primitives that survive from Scratch 2.0 but were
  // dropped from the palette. They have Blockly definitions and run for everyone, so they
  // do not "corrupt" shared projects — see https://github.com/ScratchAddons/ScratchAddons/issues/817
  const FALLBACK_PRIMARY = "#FFAB19";
  const FALLBACK_TERTIARY = "#CF8B17";

  const controlColours = () => {
    try {
      if (ScratchBlocks.registry) {
        // New Blockly: read the control block style off the active theme.
        const theme = ScratchBlocks.common.getMainWorkspace().getTheme();
        const style = theme.blockStyles.control;
        return [style.colourPrimary, style.colourTertiary];
      }
      return [ScratchBlocks.Colours.control.primary, ScratchBlocks.Colours.control.tertiary];
    } catch {
      return [FALLBACK_PRIMARY, FALLBACK_TERTIARY];
    }
  };

  const categoryXML = () => {
    const [primary, tertiary] = controlColours();
    // toolboxitemid for new Blockly, id for the old one — mirror Scratch's own categories.
    const idAttr = ScratchBlocks.registry ? "toolboxitemid" : "id";
    return `
      <category
        name="${safeMsg("category-name")}"
        ${idAttr}="sa-more-blocks"
        colour="${primary}"
        secondaryColour="${tertiary}">
        <block type="control_while"/>
        <block type="control_for_each">
          <value name="VALUE">
            <shadow type="math_whole_number">
              <field name="NUM">10</field>
            </shadow>
          </value>
        </block>
        <sep gap="36"/>
        <block type="control_all_at_once"/>
        <sep gap="36"/>
        <block type="control_incr_counter"/>
        <block type="control_clear_counter"/>
        <block type="control_get_counter"/>
      </category>`;
  };

  // The blocks component builds the whole toolbox in getToolboxXML(). Wrapping it means our
  // category survives sprite switches and theme changes (Scratch regenerates the toolbox then).
  const patchBlocksComponent = () => {
    const blocksWrapper = document.querySelector("[class*='gui_blocks-wrapper_']");
    if (!blocksWrapper) return;
    let instance = blocksWrapper[addon.tab.traps.getInternalKey()];
    while (instance && !instance.stateNode?.ScratchBlocks) instance = instance.child;
    const component = instance && instance.stateNode;
    if (!component || component.saMoreBlocksPatched) return;
    component.saMoreBlocksPatched = true;

    const original = component.getToolboxXML.bind(component);
    component.getToolboxXML = function () {
      const xml = original();
      if (addon.self.disabled || typeof xml !== "string" || !xml.includes("</xml>")) return xml;
      return xml.replace("</xml>", `${categoryXML()}\n</xml>`);
    };
  };

  const refresh = () => {
    patchBlocksComponent();
    updateToolboxXML(addon.tab);
  };

  addon.self.addEventListener("disabled", () => updateToolboxXML(addon.tab));
  addon.self.addEventListener("reenabled", refresh);

  while (true) {
    await addon.tab.waitForElement("[class*='gui_blocks-wrapper_']", {
      markAsSeen: true,
      reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
    });
    refresh();
  }
}
