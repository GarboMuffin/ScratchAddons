import blockToDom from "./blockToDom.js";

export default async function ({ addon, global, console, msg }) {
  const blockSwitches = {};

  const noopSwitch = {
    opcode: "noop",
  };

  // Special value
  const argumentSwitcher = [];

  if (addon.settings.get("motion")) {
    blockSwitches["motion_turnright"] = [
      noopSwitch,
      {
        opcode: "motion_turnleft",
      },
    ];
    blockSwitches["motion_turnleft"] = [
      {
        opcode: "motion_turnright",
      },
      noopSwitch,
    ];
    blockSwitches["motion_setx"] = [
      noopSwitch,
      {
        opcode: "motion_changexby",
        remapInputs: { X: "DX" },
      },
      {
        opcode: "motion_sety",
        remapInputs: { X: "Y" },
      },
      {
        opcode: "motion_changeyby",
        remapInputs: { X: "DY" },
      },
    ];
    blockSwitches["motion_changexby"] = [
      {
        opcode: "motion_setx",
        remapInputs: { DX: "X" },
      },
      noopSwitch,
      {
        opcode: "motion_sety",
        remapInputs: { DX: "Y" },
      },
      {
        opcode: "motion_changeyby",
        remapInputs: { DX: "DY" },
      },
    ];
    blockSwitches["motion_sety"] = [
      {
        opcode: "motion_setx",
        remapInputs: { Y: "X" },
      },
      {
        opcode: "motion_changexby",
        remapInputs: { Y: "DX" },
      },
      noopSwitch,
      {
        opcode: "motion_changeyby",
        remapInputs: { Y: "DY" },
      },
    ];
    blockSwitches["motion_changeyby"] = [
      {
        opcode: "motion_setx",
        remapInputs: { DY: "X" },
      },
      {
        opcode: "motion_changexby",
        remapInputs: { DY: "DX" },
      },
      {
        opcode: "motion_sety",
        remapInputs: { DY: "Y" },
      },
      noopSwitch,
    ];
    blockSwitches["motion_xposition"] = [
      noopSwitch,
      {
        opcode: "motion_yposition",
      },
    ];
    blockSwitches["motion_yposition"] = [
      {
        opcode: "motion_xposition",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("looks")) {
    blockSwitches["looks_seteffectto"] = [
      noopSwitch,
      {
        opcode: "looks_changeeffectby",
        remapInputs: { VALUE: "CHANGE" },
      },
    ];
    blockSwitches["looks_changeeffectby"] = [
      {
        opcode: "looks_seteffectto",
        remapInputs: { CHANGE: "VALUE" },
      },
      noopSwitch,
    ];
    blockSwitches["looks_setsizeto"] = [
      noopSwitch,
      {
        opcode: "looks_changesizeby",
        remapInputs: { SIZE: "CHANGE" },
      },
    ];
    blockSwitches["looks_changesizeby"] = [
      {
        opcode: "looks_setsizeto",
        remapInputs: { CHANGE: "SIZE" },
      },
      noopSwitch,
    ];
    blockSwitches["looks_costumenumbername"] = [
      noopSwitch,
      {
        opcode: "looks_backdropnumbername",
      },
    ];
    blockSwitches["looks_backdropnumbername"] = [
      {
        opcode: "looks_costumenumbername",
      },
      noopSwitch,
    ];
    blockSwitches["looks_show"] = [
      noopSwitch,
      {
        opcode: "looks_hide",
      },
    ];
    blockSwitches["looks_hide"] = [
      {
        opcode: "looks_show",
      },
      noopSwitch,
    ];
    blockSwitches["looks_nextcostume"] = [
      noopSwitch,
      {
        opcode: "looks_nextbackdrop",
      },
    ];
    blockSwitches["looks_nextbackdrop"] = [
      {
        opcode: "looks_nextcostume",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("sound")) {
    blockSwitches["sound_play"] = [
      noopSwitch,
      {
        opcode: "sound_playuntildone",
      },
    ];
    blockSwitches["sound_playuntildone"] = [
      {
        opcode: "sound_play",
      },
      noopSwitch,
    ];
    blockSwitches["sound_seteffectto"] = [
      noopSwitch,
      {
        opcode: "sound_changeeffectby",
      },
    ];
    blockSwitches["sound_changeeffectby"] = [
      {
        opcode: "sound_seteffectto",
      },
      noopSwitch,
    ];
    blockSwitches["sound_setvolumeto"] = [
      noopSwitch,
      {
        opcode: "sound_changevolumeby",
      },
    ];
    blockSwitches["sound_changevolumeby"] = [
      {
        opcode: "sound_setvolumeto",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("event")) {
    blockSwitches["event_broadcast"] = [
      noopSwitch,
      {
        opcode: "event_broadcastandwait",
      },
    ];
    blockSwitches["event_broadcastandwait"] = [
      {
        opcode: "event_broadcast",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("control")) {
    blockSwitches["control_if"] = [
      noopSwitch,
      {
        opcode: "control_if_else",
      },
    ];
    blockSwitches["control_if_else"] = [
      {
        opcode: "control_if",
        split: ["SUBSTACK2"],
      },
      noopSwitch,
    ];
    blockSwitches["control_repeat_until"] = [
      noopSwitch,
      {
        opcode: "control_wait_until",
        split: ["SUBSTACK"],
      },
      {
        opcode: "control_forever",
        split: ["SUBSTACK"],
      },
    ];
    blockSwitches["control_forever"] = [
      {
        opcode: "control_repeat_until",
      },
      noopSwitch,
    ];
    blockSwitches["control_wait_until"] = [
      {
        opcode: "control_repeat_until",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("operator")) {
    blockSwitches["operator_equals"] = [
      {
        opcode: "operator_gt",
      },
      noopSwitch,
      {
        opcode: "operator_lt",
      },
    ];
    blockSwitches["operator_gt"] = [
      noopSwitch,
      {
        opcode: "operator_equals",
      },
      {
        opcode: "operator_lt",
      },
    ];
    blockSwitches["operator_lt"] = [
      {
        opcode: "operator_gt",
      },
      {
        opcode: "operator_equals",
      },
      noopSwitch,
    ];
    blockSwitches["operator_add"] = [
      noopSwitch,
      {
        opcode: "operator_subtract",
      },
      {
        opcode: "operator_multiply",
      },
      {
        opcode: "operator_divide",
      },
      {
        opcode: "operator_mod",
      },
    ];
    blockSwitches["operator_subtract"] = [
      {
        opcode: "operator_add",
      },
      noopSwitch,
      {
        opcode: "operator_multiply",
      },
      {
        opcode: "operator_divide",
      },
      {
        opcode: "operator_mod",
      },
    ];
    blockSwitches["operator_multiply"] = [
      {
        opcode: "operator_add",
      },
      {
        opcode: "operator_subtract",
      },
      noopSwitch,
      {
        opcode: "operator_divide",
      },
      {
        opcode: "operator_mod",
      },
    ];
    blockSwitches["operator_divide"] = [
      {
        opcode: "operator_add",
      },
      {
        opcode: "operator_subtract",
      },
      {
        opcode: "operator_multiply",
      },
      noopSwitch,
      {
        opcode: "operator_mod",
      },
    ];
    blockSwitches["operator_mod"] = [
      {
        opcode: "operator_add",
      },
      {
        opcode: "operator_subtract",
      },
      {
        opcode: "operator_multiply",
      },
      {
        opcode: "operator_divide",
      },
      noopSwitch,
    ];
    blockSwitches["operator_and"] = [
      noopSwitch,
      {
        opcode: "operator_or",
      },
    ];
    blockSwitches["operator_or"] = [
      {
        opcode: "operator_and",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("sensing")) {
    blockSwitches["sensing_mousex"] = [
      noopSwitch,
      {
        opcode: "sensing_mousey",
      },
    ];
    blockSwitches["sensing_mousey"] = [
      {
        opcode: "sensing_mousex",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("data")) {
    blockSwitches["data_setvariableto"] = [
      noopSwitch,
      {
        opcode: "data_changevariableby",
      },
    ];
    blockSwitches["data_changevariableby"] = [
      {
        opcode: "data_setvariableto",
      },
      noopSwitch,
    ];
    blockSwitches["data_showvariable"] = [
      noopSwitch,
      {
        opcode: "data_hidevariable",
      },
    ];
    blockSwitches["data_hidevariable"] = [
      {
        opcode: "data_showvariable",
      },
      noopSwitch,
    ];
    blockSwitches["data_showlist"] = [
      noopSwitch,
      {
        opcode: "data_hidelist",
      },
    ];
    blockSwitches["data_hidelist"] = [
      {
        opcode: "data_showlist",
      },
      noopSwitch,
    ];
    blockSwitches["data_replaceitemoflist"] = [
      noopSwitch,
      {
        opcode: "data_insertatlist",
      },
    ];
    blockSwitches["data_insertatlist"] = [
      {
        opcode: "data_replaceitemoflist",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("extension")) {
    blockSwitches["pen_penDown"] = [
      noopSwitch,
      {
        opcode: "pen_penUp",
      },
    ];
    blockSwitches["pen_penUp"] = [
      {
        opcode: "pen_penDown",
      },
      noopSwitch,
    ];
    blockSwitches["pen_setPenColorParamTo"] = [
      noopSwitch,
      {
        opcode: "pen_changePenColorParamBy",
      },
    ];
    blockSwitches["pen_changePenColorParamBy"] = [
      {
        opcode: "pen_setPenColorParamTo",
      },
      noopSwitch,
    ];
    blockSwitches["pen_setPenHueToNumber"] = [
      noopSwitch,
      {
        opcode: "pen_changePenHueBy",
      },
    ];
    blockSwitches["pen_changePenHueBy"] = [
      {
        opcode: "pen_setPenHueToNumber",
      },
      noopSwitch,
    ];
    blockSwitches["pen_setPenShadeToNumber"] = [
      noopSwitch,
      {
        opcode: "pen_changePenShadeBy",
      },
    ];
    blockSwitches["pen_changePenShadeBy"] = [
      {
        opcode: "pen_setPenShadeToNumber",
      },
      noopSwitch,
    ];
    blockSwitches["pen_setPenSizeTo"] = [
      noopSwitch,
      {
        opcode: "pen_changePenSizeBy",
      },
    ];
    blockSwitches["pen_changePenSizeBy"] = [
      {
        opcode: "pen_setPenSizeTo",
      },
      noopSwitch,
    ];
  }

  if (addon.settings.get("argument")) {
    // Special handling is done in click handler
    blockSwitches["argument_reporter_string_number"] = argumentSwitcher;
    blockSwitches["argument_reporter_boolean"] = argumentSwitcher;
  }

  // Switching for these is implemented by Scratch. We only define them here to optionally add a border.
  // Because we don't implement the switching ourselves, this is not controlled by the data category option.
  blockSwitches["data_variable"] = [];
  blockSwitches["data_listcontents"] = [];

  let addBorderToContextMenuItem = -1;

  const genuid = () => {
    const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%()*+,-./:;=?@[]^_`{|}~";
    let result = "";
    for (let i = 0; i < 20; i++) {
      result += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    }
    return result;
  };

  const menuCallbackFactory = (block, opcodeData) => () => {
    if (opcodeData.opcode === "noop") {
      return;
    }

    const workspace = block.workspace;

    // Make a copy of the block with the proper type set.
    // It doesn't seem to be possible to change a Block's type after it's created, so we'll just make a new block instead.
    const xml = blockToDom(block);
    xml.setAttribute("type", opcodeData.opcode);

    const id = block.id;
    const parent = block.getParent();

    let parentConnection;
    let blockConnectionType;
    if (parent) {
      // If the block has a parent, find the parent -> child connection that will be reattached later.
      const parentConnections = parent.getConnections_();
      parentConnection = parentConnections.find((c) => c.targetConnection && c.targetConnection.sourceBlock_ === block);
      // There's two types of connections from child -> parent. We need to figure out which one is used.
      const blockConnections = block.getConnections_();
      const blockToParentConnection = blockConnections.find(
        (c) => c.targetConnection && c.targetConnection.sourceBlock_ === parent
      );
      blockConnectionType = blockToParentConnection.type;
    }

    const pasteSeparately = [];
    const remapInputs = opcodeData.remapInputs || {};
    const split = opcodeData.split || [];
    const mutateFields = opcodeData.mutateFields || {};
    const childNodes = Array.from(xml.children);
    for (const child of childNodes) {
      const inputName = child.getAttribute("name");

      if (remapInputs[inputName]) {
        child.setAttribute("name", remapInputs[inputName]);
      }

      if (mutateFields[inputName]) {
        child.textContent = mutateFields[inputName];
      }

      if (split.includes(split)) {
        const inputXml = child.firstChild;
        const inputId = inputXml.id;
        const inputBlock = workspace.getBlockById(inputId);
        const position = inputBlock.getRelativeToSurfaceXY();
        inputXml.setAttribute("x", Math.round(workspace.RTL ? -position.x : position.x));
        inputXml.setAttribute("y", Math.round(position.y));
        pasteSeparately.push(inputXml);
        xml.removeChild(child);
      }
    }

    // Mark the latest event in the undo stack.
    // This will be used later to group all of our events.
    const undoStack = workspace.undoStack_;
    if (undoStack.length) {
      undoStack[undoStack.length - 1]._blockswitchingLastUndo = true;
    }

    // Remove the old block and insert the new one.
    block.dispose();
    workspace.paste(xml);
    for (const separateBlock of pasteSeparately) {
      workspace.paste(separateBlock);
    }

    // The new block will have the same ID as the old one.
    const newBlock = workspace.getBlockById(id);

    if (parentConnection) {
      // Search for the same type of connection on the new block as on the old block.
      const newBlockConnections = newBlock.getConnections_();
      const newBlockConnection = newBlockConnections.find((c) => c.type === blockConnectionType);
      newBlockConnection.connect(parentConnection);
    }

    // Events (responsible for undoStack updates) are delayed with a setTimeout(f, 0)
    // https://github.com/LLK/scratch-blocks/blob/f159a1779e5391b502d374fb2fdd0cb5ca43d6a2/core/events.js#L182
    setTimeout(() => {
      const group = genuid();
      for (let i = undoStack.length - 1; i >= 0 && !undoStack[i]._blockswitchingLastUndo; i--) {
        undoStack[i].group = group;
      }
    }, 0);
  };

  const getArgumentName = (block) => {
    const input = block.inputList[0];
    const field = input.fieldRow[0];
    const argumentName = field.text_;
    return argumentName || "";
  };

  const getArgumentType = (block) => {
    const connection = block.getConnections_()[0];
    if (!connection || !connection.check_) return -1;
    return connection.check_.includes("Boolean") ? 1 : 0;
  };

  const getAllArguments = (block, includeSelf) => {
    const root = block.getRootBlock();
    if (root.type !== "procedures_definition") {
      return [];
    }

    const definition = root.getChildren()[0];
    if (!definition || definition.type !== "procedures_prototype") {
      return [];
    }

    const result = [];
    const selfName = getArgumentName(block);
    const selfType = getArgumentType(block);

    for (const child of definition.getChildren()) {
      const childType = getArgumentType(child);
      if (selfType !== childType) {
        continue;
      }

      const childName = getArgumentName(child);
      if (!includeSelf && childName === selfName) {
        continue;
      }
      if (result.includes(childName)) {
        continue;
      }
      result.push(childName);
    }

    return result;
  };

  const customContextMenuHandler = function (options) {
    if (addon.settings.get("border")) {
      addBorderToContextMenuItem = options.length;
    }

    if (this._originalCustomContextMenu) {
      this._originalCustomContextMenu.call(this, options);
    }

    const switches = blockSwitches[this.type];
    const isArgument = switches === argumentSwitcher;
    let includeSelf = addon.settings.get("noop");

    if (isArgument) {
      switches.length = 0;
      const names = getAllArguments(this, includeSelf);
      for (const name of names) {
        switches.push({
          opcode: this.type,
          message: name,
          mutateFields: {
            VALUE: name,
          },
        });
      }
      // All the switches will have the same opcode as the original block, so force showing self to be enabled.
      includeSelf = true;
    }

    for (const opcodeData of switches) {
      const isSelf = opcodeData.opcode === "noop";
      if (isSelf && !includeSelf) {
        continue;
      }
      const translation = opcodeData.message || msg(isSelf ? this.type : opcodeData.opcode);
      options.push({
        enabled: true,
        text: translation,
        callback: menuCallbackFactory(this, opcodeData),
      });
    }
  };

  const injectCustomContextMenu = (block) => {
    const type = block.type;
    if (!blockSwitches.hasOwnProperty(type)) {
      return;
    }

    if (block._customContextMenuInjected) {
      return;
    }
    block._customContextMenuInjected = true;

    if (block.customContextMenu) {
      block._originalCustomContextMenu = block.customContextMenu;
    }

    block.customContextMenu = customContextMenuHandler;
  };

  const changeListener = (change) => {
    if (change.type !== "create") {
      return;
    }

    for (const id of change.ids) {
      const block = Blockly.getMainWorkspace().getBlockById(id);
      if (!block) continue;
      injectCustomContextMenu(block);
    }
  };

  const mutationObserverCallback = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.classList.contains("blocklyContextMenu")) {
          if (addBorderToContextMenuItem === -1) {
            continue;
          }
          const children = node.children;
          const item = children[addBorderToContextMenuItem];
          if (item) {
            item.style.paddingTop = "2px";
            item.style.borderTop = "1px solid hsla(0, 0%, 0%, 0.15)";
          }
          addBorderToContextMenuItem = -1;
        }
      }
    }
  };

  const inject = () => {
    const workspace = Blockly.getMainWorkspace();
    if (workspace._blockswitchingInjected) {
      return;
    }
    mutationObserver.observe(document.querySelector(".blocklyWidgetDiv"), {
      childList: true,
    });
    workspace._blockswitchingInjected = true;
    workspace.getAllBlocks().forEach(injectCustomContextMenu);
    workspace.addChangeListener(changeListener);
  };

  const mutationObserver = new MutationObserver(mutationObserverCallback);

  if (addon.tab.editorMode === "editor") {
    const interval = setInterval(() => {
      if (Blockly.getMainWorkspace()) {
        inject();
        clearInterval(interval);
      }
    }, 100);
  }
  addon.tab.addEventListener("urlChange", () => addon.tab.editorMode === "editor" && inject());
}
