// import ShowBroadcast from "./show-broadcast.js";
import DomHelpers from "./DomHelpers.js";
import UndoGroup from "./UndoGroup.js";
import generateId from './id.js';

export default class DevTools {
  constructor(addon, msg, m) {
    this.addon = addon;
    this.msg = msg;
    this.m = m;
    /**
     * @type {VirtualMachine}
     */
    this.domHelpers = new DomHelpers(addon);

    this.codeTab = null;
    this.costTab = null;
    this.costTabBody = null;
    this.selVarID = null;
    this.canShare = false;

    this.mouseXY = { x: 0, y: 0 };

    /** @type {Element|null} */
    this.clipboard = null;
  }

  async init() {
    this.addContextMenus();
    while (true) {
      const root = await this.addon.tab.waitForElement("ul[class*=gui_tab-list_]", {
        markAsSeen: true,
        reduxEvents: [
          "scratch-gui/mode/SET_PLAYER",
          "fontsLoaded/SET_FONTS_LOADED",
          "scratch-gui/locales/SELECT_LOCALE",
        ],
        reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
      });
      this.initInner(root);
    }
  }

  async addContextMenus() {
    const ScratchBlocks = await this.addon.tab.traps.getBlockly();
    this.ScratchBlocks = ScratchBlocks;

    const oldCleanUpFunc = ScratchBlocks.WorkspaceSvg.prototype.cleanUp;
    const self = this;
    ScratchBlocks.WorkspaceSvg.prototype.cleanUp = function () {
      if (self.addon.settings.get("enableCleanUpPlus")) {
        self.doCleanUp();
      } else {
        oldCleanUpFunc.call(this);
      }
    };

    let originalMsg = ScratchBlocks.Msg.CLEAN_UP;
    if (this.addon.settings.get("enableCleanUpPlus")) ScratchBlocks.Msg.CLEAN_UP = this.m("clean-plus");
    this.addon.settings.addEventListener("change", () => {
      if (this.addon.settings.get("enableCleanUpPlus")) ScratchBlocks.Msg.CLEAN_UP = this.m("clean-plus");
      else ScratchBlocks.Msg.CLEAN_UP = originalMsg;
    });

    this.addon.tab.createBlockContextMenu(
      (items, block) => {
        items.push({
          enabled: this.clipboard !== null,
          text: this.m("paste"),
          separator: true,
          _isDevtoolsFirstItem: true,
          callback: () => {
            this.paste();
          },
        });
        return items;
      },
      { workspace: true }
    );

    this.addon.tab.createBlockContextMenu(
      (items, block) => {
        items.push(
          {
            enabled: true,
            text: this.m("make-space"),
            _isDevtoolsFirstItem: true,
            callback: () => {
              this.doCleanUp(block);
            },
            separator: true,
          },
          {
            enabled: true,
            text: this.m("copy-all"),
            callback: () => {
              this.copyAll(block);
            },
            separator: true,
          },
          {
            enabled: true,
            text: this.m("copy-block"),
            callback: () => {
              this.copySingle(block);
            },
          },
          {
            enabled: true,
            text: this.m("cut-block"),
            callback: () => {
              this.cut(block);
            },
          }
        );
        // const BROADCAST_BLOCKS = ["event_whenbroadcastreceived", "event_broadcast", "event_broadcastandwait"];
        // if (BROADCAST_BLOCKS.includes(block.type)) {
        //   // Show Broadcast
        //   const broadcastId = this.showBroadcastSingleton.getAssociatedBroadcastId(block.id);
        //   if (broadcastId) {
        //     ["Senders", "Receivers"].forEach((showKey, i) => {
        //       items.push({
        //         enabled: true,
        //         text: this.msg(`show-${showKey}`.toLowerCase()),
        //         callback: () => {
        //           this.showBroadcastSingleton[`show${showKey}`](broadcastId);
        //         },
        //         separator: i == 0,
        //       });
        //     });
        //   }
        // }
        return items;
      },
      { blocks: true }
    );

    this.addon.tab.createBlockContextMenu(
      (items, block) => {
        if (block.getCategory() === "data" || block.getCategory() === "data-lists") {
          this.selVarID = block.getVars()[0];
          items.push({
            enabled: true,
            text: this.m("swap", { var: block.getCategory() === "data" ? this.m("variables") : this.m("lists") }),
            callback: () => {
              let wksp = this.getWorkspace();
              let v = wksp.getVariableById(this.selVarID);
              let varName = window.prompt(this.msg("replace", { name: v.name }));
              if (varName) {
                this.doReplaceVariable(this.selVarID, varName, v.type);
              }
            },
            separator: true,
          });
        }
        return items;
      },
      { blocks: true, flyout: true }
    );
  }

  getWorkspace() {
    return Blockly.getMainWorkspace();
  }

  isCostumeEditor() {
    return this.costTab.className.indexOf("gui_is-selected") >= 0;
  }

  /**
   * A nicely ordered version of the top blocks
   * @returns {[Blockly.Block]}
   */
  getTopBlocks() {
    let result = this.getOrderedTopBlockColumns();
    let columns = result.cols;
    /**
     * @type {[[Blockly.Block]]}
     */
    let topBlocks = [];
    for (const col of columns) {
      topBlocks = topBlocks.concat(col.blocks);
    }
    return topBlocks;
  }

  /**
   * A much nicer way of laying out the blocks into columns
   */
  doCleanUp(block) {
    let workspace = this.getWorkspace();
    let makeSpaceForBlock = block && block.getRootBlock();

    UndoGroup.startUndoGroup(workspace);

    let result = this.getOrderedTopBlockColumns(true);
    let columns = result.cols;
    let orphanCount = result.orphans.blocks.length;
    if (orphanCount > 0 && !block) {
      let message = this.msg("orphaned", {
        count: orphanCount,
      });
      if (confirm(message)) {
        for (const block of result.orphans.blocks) {
          block.dispose();
        }
      } else {
        columns.unshift(result.orphans);
      }
    }

    let cursorX = 48;

    let maxWidths = result.maxWidths;

    for (const column of columns) {
      let cursorY = 64;
      let maxWidth = 0;

      for (const block of column.blocks) {
        let extraWidth = block === makeSpaceForBlock ? 380 : 0;
        let extraHeight = block === makeSpaceForBlock ? 480 : 72;
        let xy = block.getRelativeToSurfaceXY();
        if (cursorX - xy.x !== 0 || cursorY - xy.y !== 0) {
          block.moveBy(cursorX - xy.x, cursorY - xy.y);
        }
        let heightWidth = block.getHeightWidth();
        cursorY += heightWidth.height + extraHeight;

        let maxWidthWithComments = maxWidths[block.id] || 0;
        maxWidth = Math.max(maxWidth, Math.max(heightWidth.width + extraWidth, maxWidthWithComments));
      }

      cursorX += maxWidth + 96;
    }

    let topComments = workspace.getTopComments();
    for (const comment of topComments) {
      if (comment.setVisible) {
        comment.setVisible(false);
        comment.needsAutoPositioning_ = true;
        comment.setVisible(true);
      }
    }

    setTimeout(() => {
      // Locate unused local variables...
      let workspace = this.getWorkspace();
      let map = workspace.getVariableMap();
      let vars = map.getVariablesOfType("");
      let unusedLocals = [];

      for (const row of vars) {
        if (row.isLocal) {
          let usages = map.getVariableUsesById(row.getId());
          if (!usages || usages.length === 0) {
            unusedLocals.push(row);
          }
        }
      }

      if (unusedLocals.length > 0) {
        const unusedCount = unusedLocals.length;
        let message = this.msg("unused-var", {
          count: unusedCount,
        });
        for (let i = 0; i < unusedLocals.length; i++) {
          let orphan = unusedLocals[i];
          if (i > 0) {
            message += ", ";
          }
          message += orphan.name;
        }
        if (confirm(message)) {
          for (const orphan of unusedLocals) {
            workspace.deleteVariableById(orphan.getId());
          }
        }
      }

      // Locate unused local lists...
      let lists = map.getVariablesOfType("list");
      let unusedLists = [];

      for (const row of lists) {
        if (row.isLocal) {
          let usages = map.getVariableUsesById(row.getId());
          if (!usages || usages.length === 0) {
            unusedLists.push(row);
          }
        }
      }
      if (unusedLists.length > 0) {
        const unusedCount = unusedLists.length;
        let message = this.msg("unused-list", {
          count: unusedCount,
        });
        for (let i = 0; i < unusedLists.length; i++) {
          let orphan = unusedLists[i];
          if (i > 0) {
            message += ", ";
          }
          message += orphan.name;
        }
        if (confirm(message)) {
          for (const orphan of unusedLists) {
            workspace.deleteVariableById(orphan.getId());
          }
        }
      }

      UndoGroup.endUndoGroup(workspace);
    }, 100);
  }

  copyAll(block) {
    if (!block) {
      this.clipboard = null;
      return;
    }
    const xml = this.ScratchBlocks.Xml.blockToDom(block);
    const xy = block.getRelativeToSurfaceXY();
    xml.setAttribute('x', xy.x);
    xml.setAttribute('y', xy.y);
    this.clipboard = xml;
  }

  copySingle(block) {
    const next = block.getNextBlock();
    if (next) {
      next.unplug(false);
    }
    this.copyAll(block);
    setTimeout(() => {
      if (next) {
        next.workspace.undo();
      }
    }, 0);
  }

  cut(block) {
    const next = block.getNextBlock();
    if (next) {
      next.unplug(true);
    }
    this.copyAll(block);
    block.dispose();
  }

  /**
   * @param {string} originalName
   * @param {string} type
   * @returns {string}
   */
  getGloballyUnusedVariableName(originalName, type) {
    const vm = this.addon.tab.traps.vm;
    const allNames = vm.runtime.getAllVarNamesOfType(type);
    if (allNames.includes(originalName)) {
      let n = 2;
      while (true) {
        const newName = `${originalName} ${n}`;
        if (!allNames.includes(newName)) {
          return newName;
        }
        n += 1;
      }
    }
    return originalName;
  }

  /**
   * Create a copy of a Blockly XML with various fixes.
   * @param {Element} originalBlockXml
   */
  fixupBlockXML(originalBlockXml) {
    const copyXml = originalBlockXml.cloneNode(true);
    // TODO: broadcasts ???

    const workspace = this.getWorkspace();
    const vm = this.addon.tab.traps.vm;
    const isStage = vm.editingTarget.isStage;

    // We may need to rewrite variable references.
    const fields = copyXml.querySelectorAll('field[name="VARIABLE"], field[name="LIST"]');
    for (const field of fields) {
      const variableId = field.getAttribute('id');
      if (workspace.getVariableById(variableId)) {
        // Variable ID is in scope, don't need to touch anything
        continue;
      }

      const variableName = field.textContent;
      const variableType = field.getAttribute('variabletype');
      if (workspace.getVariable(variableName, variableType)) {
        // A variable with the name and type already exists, don't need to touch anything
        continue;
      }

      // If we get here, this variable was existed in the sprite when the XML was copied, but
      // no longer exists. It may have been deleted, or it was a local variable that does not
      // have an equivalent in the current sprite. In the latter case, it is important that we
      // give the variable a new ID.
      field.setAttribute('id', generateId());

      if (isStage) {
        // For non-stages, this variable will be created locally, but in the stage it will be
        // created globally. We need to make sure that the name won't conflict with any local
        // variables in any other sprites.
        field.textContent = this.getGloballyUnusedVariableName(variableName, variableType);
      } else {
        // Variable will be made locally. We don't need to touch anything.
        // We already checked previously that there is no variable with the same name and type
        // in scope, so we know that this won't conflict with any other variables.
      }
    }

    // scratch-blocks' pasteBlock_ handles RTL in a very strange way.
    // https://github.com/LLK/scratch-blocks/blob/8233c1fb1136b3c7f520c9b2ec0027c6eefc98f8/core/workspace_svg.js#L1030-L1032
    // We adjust for this at paste-time instead of copy-time so that if someone copies then switches language, the block
    // will still paste in the right spot.
    const x = +copyXml.getAttribute('x');
    copyXml.setAttribute('x', -x);

    return copyXml;
  }

  paste() {
    if (!this.clipboard) {
      return;
    }

    const workspace = this.getWorkspace();
    const xml = this.fixupBlockXML(this.clipboard);
    workspace.paste(xml);
    const newBlock = this.ScratchBlocks.selected;

    // Fix flyout checkbox for newly created variables
    workspace.refreshToolboxSelection_();

    if (this.addon.settings.get("enablePasteBlocksAtMouse")) {
      this.startDraggingBlock(newBlock);
    }
  }

  /**
   * Badly Orphaned - might want to delete these!
   * @param topBlock
   * @returns {boolean}
   */
  isBlockAnOrphan(topBlock) {
    return !!topBlock.outputConnection;
  }

  /**
   * Split the top blocks into ordered columns
   * @param separateOrphans true to keep all orphans separate
   * @returns {{orphans: {blocks: [Block], x: number, count: number}, cols: [Col]}}
   */
  getOrderedTopBlockColumns(separateOrphans) {
    let w = this.getWorkspace();
    let topBlocks = w.getTopBlocks();
    let maxWidths = {};

    if (separateOrphans) {
      let topComments = w.getTopComments();

      // todo: tie comments to blocks... find widths and width of block stack row...
      for (const comment of topComments) {
        // comment.autoPosition_();
        // Hiding and showing repositions the comment right next to it's block - nice!
        if (comment.setVisible) {
          comment.setVisible(false);
          comment.needsAutoPositioning_ = true;
          comment.setVisible(true);

          // let bb = comment.block_.svgPath_.getBBox();
          let right = comment.getBoundingRectangle().bottomRight.x;

          // Get top block for stack...
          let root = comment.block_.getRootBlock();
          let left = root.getBoundingRectangle().topLeft.x;
          maxWidths[root.id] = Math.max(right - left, maxWidths[root.id] || 0);
        }
      }
    }

    // Default scratch ordering is horrid... Lets try something more clever.

    /**
     * @type {Col[]}
     */
    let cols = [];
    const TOLERANCE = 256;
    let orphans = { x: -999999, count: 0, blocks: [] };

    for (const topBlock of topBlocks) {
      // let r = b.getBoundingRectangle();
      let position = topBlock.getRelativeToSurfaceXY();
      /**
       * @type {Col}
       */
      let bestCol = null;
      let bestError = TOLERANCE;

      if (separateOrphans && this.isBlockAnOrphan(topBlock)) {
        orphans.blocks.push(topBlock);
        continue;
      }

      // Find best columns
      for (const col of cols) {
        let err = Math.abs(position.x - col.x);
        if (err < bestError) {
          bestError = err;
          bestCol = col;
        }
      }

      if (bestCol) {
        // We found a column that we fitted into
        bestCol.x = (bestCol.x * bestCol.count + position.x) / ++bestCol.count; // re-average the columns as more items get added...
        bestCol.blocks.push(topBlock);
      } else {
        // Create a new column
        cols.push(new Col(position.x, 1, [topBlock]));
      }
    }

    // if (orphans.blocks.length > 0) {
    //     cols.push(orphans);
    // }

    // Sort columns, then blocks inside the columns
    cols.sort((a, b) => a.x - b.x);
    for (const col of cols) {
      col.blocks.sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);
    }

    return { cols: cols, orphans: orphans, maxWidths: maxWidths };
  }

  /**
   * Find all the uses of a named variable.
   * @param {string} id ID of the variable to find.
   * @return {!Array.<!Blockly.Block>} Array of block usages.
   */
  getVariableUsesById(id) {
    let uses = [];

    let topBlocks = this.getTopBlocks(true); // todo: Confirm this was the right getTopBlocks?
    for (const topBlock of topBlocks) {
      /** @type {!Array<!Blockly.Block>} */
      let kids = topBlock.getDescendants();
      for (const block of kids) {
        /** @type {!Array<!Blockly.VariableModel>} */
        let blockVariables = block.getVarModels();
        if (blockVariables) {
          for (const blockVar of blockVariables) {
            if (blockVar.getId() === id) {
              uses.push(block);
            }
          }
        }
      }
    }

    return uses;
  }

  /**
   * Quick and dirty replace all instances of one variable / list with another variable / list
   * @param varId original variable name
   * @param newVarName new variable name
   * @param type type of variable ("" = variable, anything else is a list?
   */
  doReplaceVariable(varId, newVarName, type) {
    let wksp = this.getWorkspace();
    let v = wksp.getVariable(newVarName, type);
    if (!v) {
      alert(this.msg("var-not-exist"));
      return;
    }
    let newVId = v.getId();

    UndoGroup.startUndoGroup(wksp);
    let blocks = this.getVariableUsesById(varId);
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
  }

  startDraggingBlock(block) {
    setTimeout(() => {
      const position = {
        x: this.mouseXY.x,
        y: this.mouseXY.y
      };
      this.domHelpers.triggerDragAndDrop(block.svgPath_, null, position);
    });
  }

  updateMousePosition(e) {
    this.mouseXY.x = e.clientX;
    this.mouseXY.y = e.clientY;
  }

  eventMouseMove(e) {
    this.updateMousePosition(e);
  }

  eventKeyDown(e) {
    const switchCostume = (up) => {
      // todo: select previous costume
      let selected = this.costTabBody.querySelector("div[class*='sprite-selector-item_is-selected']");
      let node = up ? selected.parentNode.previousSibling : selected.parentNode.nextSibling;
      if (node) {
        let wrapper = node.closest("div[class*=gui_flex-wrapper]");
        node.querySelector("div[class^='sprite-selector-item_sprite-name']").click();
        node.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "start",
        });
        wrapper.scrollTop = 0;
      }
    };

    if (this.addon.tab.editorMode !== 'editor') {
      return;
    }

    let ctrlKey = e.ctrlKey || e.metaKey;

    if (e.keyCode === 37 && ctrlKey) {
      // Ctrl + Left Arrow Key
      if (document.activeElement.tagName === "INPUT") {
        return;
      }

      if (this.isCostumeEditor()) {
        switchCostume(true);
        e.cancelBubble = true;
        e.preventDefault();
        return true;
      }
    }

    if (e.keyCode === 39 && ctrlKey) {
      // Ctrl + Right Arrow Key
      if (document.activeElement.tagName === "INPUT") {
        return;
      }

      if (this.isCostumeEditor()) {
        switchCostume(false);
        e.cancelBubble = true;
        e.preventDefault();
        return true;
      }
    }

    if (e.keyCode === 67 && ctrlKey) {
      // Ctrl+C
      e.preventDefault();
      e.stopPropagation();
      this.copyAll(this.ScratchBlocks.selected);
    }

    if (e.keyCode === 86 && ctrlKey) {
      // Ctrl + V
      e.preventDefault();
      e.stopPropagation();
      this.paste();
    }
  }

  eventMouseDown(e) {
    this.updateMousePosition(e);
  }

  eventMouseUp(e) {
    this.updateMousePosition(e);
  }

  initInner(root) {
    let guiTabs = root.childNodes;

    if (this.codeTab && guiTabs[0] !== this.codeTab) {
      // We have been CHANGED!!! - Happens when going to project page, and then back inside again!!!
      this.domHelpers.unbindAllEvents();
    }

    this.codeTab = guiTabs[0];
    this.costTab = guiTabs[1];
    this.costTabBody = document.querySelector("div[aria-labelledby=" + this.costTab.id + "]");

    this.domHelpers.bindOnce(document, "keydown", (...e) => this.eventKeyDown(...e), true);
    this.domHelpers.bindOnce(document, "mousemove", (...e) => this.eventMouseMove(...e), true);
    this.domHelpers.bindOnce(document, "mousedown", (...e) => this.eventMouseDown(...e), true); // true to capture all mouse downs 'before' the dom events handle them
    this.domHelpers.bindOnce(document, "mouseup", (...e) => this.eventMouseUp(...e), true);
  }
}

class Col {
  /**
   * @param x {Number} x position (for ordering)
   * @param count {Number}
   * @param blocks {[Block]}
   */
  constructor(x, count, blocks) {
    /**
     * x position (for ordering)
     * @type {Number}
     */
    this.x = x;
    /**
     * @type {Number}
     */
    this.count = count;
    /**
     * @type {[Blockly.Block]}
     */
    this.blocks = blocks;
  }
}
