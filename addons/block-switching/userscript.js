export default async function ({ addon, global, console }) {
  const blockSwitches = {
    event_broadcast: [
      {
        opcode: "event_broadcastandwait",
      },
    ],
    event_broadcastandwait: [
      {
        opcode: "event_broadcast",
      },
    ],
    control_if: [
      {
        opcode: "control_if_else",
      },
    ],
    control_if_else: [
      {
        opcode: "control_if",
        remap: { SUBSTACK2: "split" },
      },
    ],
    data_changevariableby: [
      {
        opcode: "data_setvariableto",
      },
    ],
    data_setvariableto: [
      {
        opcode: "data_changevariableby",
      },
    ],
    data_showvariable: [
      {
        opcode: "data_hidevariable",
      },
    ],
    data_hidevariable: [
      {
        opcode: "data_showvariable",
      },
    ],
    looks_changeeffectby: [
      {
        opcode: "looks_seteffectto",
        remap: { CHANGE: "VALUE" },
      },
    ],
    looks_seteffectto: [
      {
        opcode: "looks_changeeffectby",
        remap: { VALUE: "CHANGE" },
      },
    ],
    looks_changesizeby: [
      {
        opcode: "looks_setsizeto",
        remap: { CHANGE: "SIZE" },
      },
    ],
    looks_setsizeto: [
      {
        opcode: "looks_changesizeby",
        remap: { SIZE: "CHANGE" },
      },
    ],
    looks_costumenumbername: [
      {
        opcode: "looks_backdropnumbername",
      },
    ],
    looks_backdropnumbername: [
      {
        opcode: "looks_costumenumbername",
      },
    ],
    looks_show: [
      {
        opcode: "looks_hide",
      },
    ],
    looks_hide: [
      {
        opcode: "looks_show",
      },
    ],
    looks_nextcostume: [
      {
        opcode: "looks_nextbackdrop",
      },
    ],
    looks_nextbackdrop: [
      {
        opcode: "looks_nextcostume",
      },
    ],
    motion_turnright: [
      {
        opcode: "motion_turnleft",
      },
    ],
    motion_turnleft: [
      {
        opcode: "motion_turnright",
      },
    ],
    motion_setx: [
      {
        opcode: "motion_changexby",
        remap: { X: "DX" },
      },
      {
        opcode: "motion_sety",
        remap: { X: "Y" },
      },
      {
        opcode: "motion_changeyby",
        remap: { X: "DY" },
      },
    ],
    motion_changexby: [
      {
        opcode: "motion_setx",
        remap: { DX: "X" },
      },
      {
        opcode: "motion_sety",
        remap: { DX: "Y" },
      },
      {
        opcode: "motion_changeyby",
        remap: { DX: "DY" },
      },
    ],
    motion_sety: [
      {
        opcode: "motion_setx",
        remap: { Y: "X" },
      },
      {
        opcode: "motion_changexby",
        remap: { Y: "DX" },
      },
      {
        opcode: "motion_changeyby",
        remap: { Y: "DY" },
      },
    ],
    motion_changeyby: [
      {
        opcode: "motion_setx",
        remap: { DY: "X" },
      },
      {
        opcode: "motion_changexby",
        remap: { DY: "DX" },
      },
      {
        opcode: "motion_sety",
        remap: { DY: "Y" },
      },
    ],
    motion_xposition: [
      {
        opcode: "motion_yposition",
      },
    ],
    motion_yposition: [
      {
        opcode: "motion_xposition",
      },
    ],
    operator_equals: [
      {
        opcode: "operator_gt",
      },
      {
        opcode: "operator_lt",
      },
    ],
    operator_gt: [
      {
        opcode: "operator_equals",
      },
      {
        opcode: "operator_lt",
      },
    ],
    operator_lt: [
      {
        opcode: "operator_equals",
      },
      {
        opcode: "operator_gt",
      },
    ],
    operator_add: [
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
    ],
    operator_subtract: [
      {
        opcode: "operator_add",
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
    ],
    operator_multiply: [
      {
        opcode: "operator_add",
      },
      {
        opcode: "operator_subtract",
      },
      {
        opcode: "operator_divide",
      },
      {
        opcode: "operator_mod",
      },
    ],
    operator_divide: [
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
        opcode: "operator_mod",
      },
    ],
    operator_mod: [
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
    ],
    operator_and: [
      {
        opcode: "operator_or",
      },
    ],
    operator_or: [
      {
        opcode: "operator_and",
      },
    ],
    pen_penDown: [
      {
        opcode: "pen_penUp",
      },
    ],
    pen_penUp: [
      {
        opcode: "pen_penDown",
      },
    ],
    pen_setPenColorParamTo: [
      {
        opcode: "pen_changePenColorParamBy",
      },
    ],
    pen_changePenColorParamBy: [
      {
        opcode: "pen_setPenColorParamTo",
      },
    ],
    pen_changePenHueBy: [
      {
        opcode: "pen_setPenHueToNumber",
      },
    ],
    pen_setPenHueToNumber: [
      {
        opcode: "pen_changePenHueBy",
      },
    ],
    pen_changePenShadeBy: [
      {
        opcode: "pen_setPenShadeToNumber",
      },
    ],
    pen_setPenShadeToNumber: [
      {
        opcode: "pen_changePenShadeBy",
      },
    ],
    pen_changePenSizeBy: [
      {
        opcode: "pen_setPenSizeTo",
      },
    ],
    pen_setPenSizeTo: [
      {
        opcode: "pen_changePenSizeBy",
      },
    ],
    sensing_mousex: [
      {
        opcode: "sensing_mousey",
      },
    ],
    sensing_mousey: [
      {
        opcode: "sensing_mousex",
      },
    ],
    sound_play: [
      {
        opcode: "sound_playuntildone",
      },
    ],
    sound_playuntildone: [
      {
        opcode: "sound_play",
      },
    ],
    sound_changeeffectby: [
      {
        opcode: "sound_seteffectto",
      },
    ],
    sound_seteffectto: [
      {
        opcode: "sound_changeeffectby",
      },
    ],
    sound_setvolumeto: [
      {
        opcode: "sound_changevolumeby",
      },
    ],
    sound_changevolumeby: [
      {
        opcode: "sound_setvolumeto",
      },
    ],
  };

  const blockToDom = (block) => {
    // Blockly/Scratch already have logic to convert blocks to XML, but this is not part of the global Blockly object.
    // Instead, we'll convert the entire workspace to XML and search for the block.
    // Certainly not ideal. In the future we should to bring in our own Blockly.Xml.blockToDom
    const workspaceXml = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace());
    // TODO: this won't work if the block ID has some very strange and unusual characters.
    // However, IDs generated by Scratch shouldn't have those so that probably isn't a big deal.
    return workspaceXml.querySelector(`[id="${block.id}"]`);
  };

  const menuCallbackFactory = (block, opcodeData) => () => {
    // Make a copy of the block with the proper type set.
    // It doesn't seem to be possible to change a Block's type after it's created, so we'll just make a new block instead.
    const xml = blockToDom(block);
    xml.setAttribute("type", opcodeData.opcode);

    const id = block.id;
    const parent = block.getParent();

    let parentConnection;
    let blockConnectionType;
    if (parent) {
      // If the block has a parent, find out which connections we will have to reattach later.
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
    // Apply input remappings.
    if (opcodeData.remap) {
      const childNodes = Array.from(xml.children);
      for (const child of childNodes) {
        const oldName = child.getAttribute("name");
        const newName = opcodeData.remap[oldName];
        if (newName) {
          if (newName === "split") {
            // This input will be split off into its own script.
            const inputXml = child.firstChild;
            // Determine block position because it's not set at this point.
            const inputId = inputXml.id;
            const inputBlock = Blockly.getMainWorkspace().getBlockById(inputId);
            const position = inputBlock.getRelativeToSurfaceXY();
            inputXml.setAttribute("x", position.x);
            inputXml.setAttribute("y", position.y);
            pasteSeparately.push(inputXml);
            xml.removeChild(child);
          } else {
            child.setAttribute("name", newName);
          }
        }
      }
    }

    // Remove the old black and insert the new one.
    block.dispose();
    Blockly.getMainWorkspace().paste(xml);
    for (const separateBlock of pasteSeparately) {
      Blockly.getMainWorkspace().paste(separateBlock);
    }

    // The new block will have the same ID as the old one.
    const newBlock = Blockly.getMainWorkspace().getBlockById(id);

    if (parentConnection) {
      const newBlockConnections = newBlock.getConnections_();
      const newBlockConnection = newBlockConnections.find((c) => c.type === blockConnectionType);
      newBlockConnection.connect(parentConnection);
    }

    // TODO: unmangle undo history
  };

  const customContextMenuHandler = function (options) {
    if (this._blockswitchingNativeContextMenu) {
      this._blockswitchingNativeContextMenu(options);
    }

    const switches = blockSwitches[this.type];
    for (const opcodeData of switches) {
      options.push({
        enabled: true,
        text: opcodeData.opcode, // TODO: display human readable name; translate
        callback: menuCallbackFactory(this, opcodeData),
      });
    }
  };

  const injectCustomContextMenu = (block) => {
    const type = block.type;
    if (!blockSwitches.hasOwnProperty(type)) {
      return;
    }

    if (block._blockswitchingNativeContextMenu) {
      // Already replaced custom menu
      return;
    }

    if (block.customContextMenu) {
      block._blockswitchingNativeContextMenu = block.customContextMenu;
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

  const inject = (workspace) => {
    workspace.getAllBlocks().forEach(injectCustomContextMenu);
    workspace.addChangeListener(changeListener);
  };

  if (addon.tab.editorMode === "editor") {
    const interval = setInterval(() => {
      if (Blockly.getMainWorkspace()) {
        inject(Blockly.getMainWorkspace());
        clearInterval(interval);
      }
    }, 100);
  }
  addon.tab.addEventListener(
    "urlChange",
    () => addon.tab.editorMode === "editor" && inject(Blockly.getMainWorkspace())
  );
}
