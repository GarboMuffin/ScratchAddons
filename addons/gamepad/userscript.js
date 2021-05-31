import GamepadLib from "./gamepadlib.js";

export default async function ({ addon, global, console, msg }) {
  const vm = addon.tab.traps.vm;

  // Wait for the project to finish loading. Renderer might not be fully available until this happens.
  await new Promise((resolve) => {
    if (vm.editingTarget) return resolve();
    vm.runtime.once("PROJECT_LOADED", resolve);
  });

  const scratchToKeyToKey = (key) => {
    switch (key) {
      case "right arrow":
        return "ArrowRight";
      case "up arrow":
        return "ArrowUp";
      case "left arrow":
        return "ArrowLeft";
      case "down arrow":
        return "ArrowDown";
      case "enter":
        return "Enter";
      case "space":
        return " ";
    }
    return key.toLowerCase().charAt(0);
  };
  const getKeysUsedByProject = () => {
    const allBlocks = [vm.runtime.getTargetForStage(), ...vm.runtime.targets]
      .filter((i) => i.isOriginal)
      .map((i) => i.blocks);
    const result = new Set();
    for (const blocks of allBlocks) {
      for (const block of Object.values(blocks._blocks)) {
        if (block.opcode === "event_whenkeypressed" || block.opcode === "sensing_keyoptions") {
          const key = block.fields.KEY_OPTION.value;
          result.add(scratchToKeyToKey(key));
        }
      }
    }
    return result;
  };

  const GAMEPAD_CONFIG_MAGIC = " // _gamepad_";
  const findOptionsComment = () => {
    const target = vm.runtime.getTargetForStage();
    const comments = target.comments;
    for (const comment of Object.values(comments)) {
      if (comment.text.includes(GAMEPAD_CONFIG_MAGIC)) {
        return comment;
      }
    }
    return null;
  };
  const parseOptionsComment = () => {
    const comment = findOptionsComment();
    if (!comment) {
      return;
    }
    const lineWithMagic = comment.text.split("\n").find((i) => i.endsWith(GAMEPAD_CONFIG_MAGIC));
    if (!lineWithMagic) {
      console.warn("Gamepad comment does not contain valid line");
      return;
    }
    const jsonText = lineWithMagic.substr(0, lineWithMagic.length - GAMEPAD_CONFIG_MAGIC.length);
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid object");
      }
      if (!Array.isArray(parsed.buttons) || !Array.isArray(parsed.axes)) {
        throw new Error("Missing data");
      }
    } catch (e) {
      console.warn("Gamepad comment has invalid JSON", e);
      return null;
    }
    return parsed;
  };

  GamepadLib.setConsole(console);
  const gamepad = new GamepadLib();

  const parsedOptions = parseOptionsComment();
  if (parsedOptions) {
    gamepad.hints.importedSettings = parsedOptions;
  } else {
    gamepad.hints.usedKeys = getKeysUsedByProject();
  }

  if (addon.settings.get("hide")) {
    await new Promise((resolve) => {
      const end = () => {
        addon.settings.removeEventListener("change", listener);
        resolve();
      };
      const listener = () => {
        if (!addon.settings.get("hide")) {
          end();
        }
      };
      gamepad.gamepadConnected().then(end);
      addon.settings.addEventListener("change", listener);
    });
  }

  const renderer = vm.runtime.renderer;
  const width = renderer._xRight - renderer._xLeft;
  const height = renderer._yTop - renderer._yBottom;
  const canvas = renderer.canvas;

  const spacer = document.createElement("div");
  spacer.className = "sa-gamepad-spacer";
  addon.tab.displayNoneWhileDisabled(spacer, { display: "flex" });
  const buttonGroup = document.createElement("div");
  buttonGroup.className = addon.tab.scratchClass("stage-header_stage-size-toggle-group");
  const buttonContainer = document.createElement("div");
  buttonContainer.className = addon.tab.scratchClass("button_outlined-button", "stage-header_stage-button");
  const buttonContent = document.createElement("div");
  buttonContent.className = addon.tab.scratchClass("button_content");
  const buttonImage = document.createElement("img");
  buttonImage.className = addon.tab.scratchClass("stage-header_stage-button-icon");
  buttonImage.draggable = false;
  buttonImage.src = addon.self.dir + "/gamepad.svg";
  buttonContent.appendChild(buttonImage);
  buttonContainer.appendChild(buttonContent);
  buttonGroup.appendChild(buttonContainer);
  spacer.appendChild(buttonGroup);
  let editor;
  const storeMappings = () => {
    const exported = editor.export();
    if (!exported) {
      console.warn("Could not export gamepad settings");
      return;
    }
    // TODO: translate
    const text = `Placeholder text 123 todo figure out what to put here\n${JSON.stringify(
      exported
    )}${GAMEPAD_CONFIG_MAGIC}`;
    const existingComment = findOptionsComment();
    if (existingComment) {
      existingComment.text = text;
    } else {
      const target = vm.runtime.getTargetForStage();
      // TODO uid()?
      target.createComment(Math.random() + "", null, text, 50, 50, 350, 150, false);
    }
    vm.runtime.emitProjectChanged();
    if (vm.editingTarget === vm.runtime.getTargetForStage) {
      vm.emitWorkspaceUpdate();
    }
  };
  buttonContainer.addEventListener("click", () => {
    if (!editor) {
      editor = gamepad.editor();
      editor.msg = msg;
      editor.addEventListener("change", storeMappings);
    }
    const editorEl = editor.generateEditor();

    const close = () => {
      modalOverlay.remove();
      document.body.removeEventListener("click", handleClickOutside, true);
      addon.self.removeEventListener("disabled", close);
      editor.hide();
    };
    const handleClickOutside = (e) => {
      if (!modalContentContainer.contains(e.target)) {
        close();
      }
    };
    document.body.addEventListener("click", handleClickOutside, true);
    addon.self.addEventListener("disabled", close);

    const modalOverlay = document.createElement("div");
    modalOverlay.className = addon.tab.scratchClass("modal_modal-overlay", { others: "sa-gamepad-popup-outer" });
    const modalContentContainer = document.createElement("div");
    modalContentContainer.className = addon.tab.scratchClass("modal_modal-content", { others: "sa-gamepad-popup" });

    const modalHeaderContainer = document.createElement("div");
    modalHeaderContainer.className = addon.tab.scratchClass("modal_header");
    const modalHeaderText = document.createElement("div");
    modalHeaderText.className = addon.tab.scratchClass("modal_header-item", "modal_header-item-title");
    modalHeaderText.textContent = msg("settings");
    modalHeaderContainer.appendChild(modalHeaderText);

    const closeContainer = document.createElement("div");
    closeContainer.className = addon.tab.scratchClass("modal_header-item", "modal_header-item-close");
    const closeButton = document.createElement("div");
    closeButton.className = addon.tab.scratchClass("close-button_close-button", "close-button_large");
    closeButton.tabIndex = "0";
    closeButton.setAttribute("role", "button");
    const closeImage = document.createElement("img");
    closeImage.className = addon.tab.scratchClass("close-button_close-icon");
    closeImage.src = addon.self.dir + "/close.svg";
    closeButton.appendChild(closeImage);
    closeContainer.appendChild(closeButton);
    modalHeaderContainer.appendChild(closeContainer);
    closeButton.addEventListener("click", close);

    const modalContent = document.createElement("div");
    modalContent.className = "sa-gamepad-popup-content";
    if (GamepadLib.browserHasBrokenGamepadAPI()) {
      const warning = document.createElement("div");
      warning.textContent = msg("browser-support")
      warning.className = "sa-gamepad-browser-support-warning";
      modalContent.appendChild(warning);
    }
    modalContent.appendChild(editorEl);

    modalContentContainer.appendChild(modalHeaderContainer);
    modalContentContainer.appendChild(modalContent);
    modalOverlay.appendChild(modalContentContainer);
    document.body.appendChild(modalOverlay);

    editor.focus();
  });
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("[class*='stage-header_stage-button-first']")) {
        document.body.classList.add("sa-gamepad-small");
      } else if (e.target.closest("[class*='stage-header_stage-button-last']")) {
        document.body.classList.remove("sa-gamepad-small");
      }
    },
    { capture: true }
  );

  const virtualCursorContainer = document.createElement("div");
  virtualCursorContainer.hidden = true;
  virtualCursorContainer.className = "sa-gamepad-cursor";
  const virtualCursorImage = document.createElement("img");
  virtualCursorImage.className = "sa-gamepad-cursor-image";
  virtualCursorImage.src = addon.self.dir + "/cursor.png";
  virtualCursorContainer.appendChild(virtualCursorImage);
  addon.self.addEventListener("disabled", () => {
    virtualCursorContainer.hidden = true;
  });

  let hideCursorTimeout;

  const virtualCursorSetVisible = (visible) => {
    virtualCursorContainer.hidden = !visible;
    document.body.classList.toggle('sa-gamepad-cursor-visible', visible);
    clearTimeout(hideCursorTimeout);
    if (visible) {
      hideCursorTimeout = setTimeout(virtualCursorHide, 8000);
    }
  };
  const virtualCursorHide = () => {
    virtualCursorSetVisible(false);
  };
  const virtualCursorSetDown = (down) => {
    virtualCursorSetVisible(true);
    virtualCursorImage.classList.toggle("sa-gamepad-cursor-down", down);
  };
  const virtualCursorSetPosition = (x, y) => {
    virtualCursorSetVisible(true);
    const stageX = width / 2 + x;
    const stageY = height / 2 - y;
    virtualCursorContainer.style.transform = `translate(${(stageX / width) * 100}%, ${(stageY / height) * 100}%)`;
  };

  document.addEventListener("mousemove", () => {
    virtualCursorSetVisible(false);
  });

  let getCanvasSize;
  // Support modern ResizeObserver and slow getBoundingClientRect version for improved browser support (matters for TurboWarp)
  if (window.ResizeObserver) {
    let canvasWidth = width;
    let canvasHeight = height;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvasWidth = entry.contentRect.width;
        canvasHeight = entry.contentRect.height;
      }
    });
    resizeObserver.observe(canvas);
    getCanvasSize = () => [canvasWidth, canvasHeight];
  } else {
    getCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      return [rect.width, rect.height];
    };
  }

  // Both in Scratch space
  let virtualX = 0;
  let virtualY = 0;
  const postMouseData = (data) => {
    const [rectWidth, rectHeight] = getCanvasSize();
    vm.postIOData("mouse", {
      ...data,
      canvasWidth: rectWidth,
      canvasHeight: rectHeight,
      x: (virtualX + width / 2) * (rectWidth / width),
      y: (height / 2 - virtualY) * (rectHeight / height),
    });
  };
  const handleGamepadButtonDown = (e) => {
    if (addon.self.disabled) return;
    const key = e.detail;
    vm.postIOData("keyboard", {
      key: key,
      isDown: true,
    });
  };
  const handleGamepadButtonUp = (e) => {
    if (addon.self.disabled) return;
    const key = e.detail;
    vm.postIOData("keyboard", {
      key: key,
      isDown: false,
    });
  };
  const handleGamepadMouseDown = () => {
    if (addon.self.disabled) return;
    virtualCursorSetDown(true);
    postMouseData({
      isDown: true,
    });
  };
  const handleGamepadMouseUp = () => {
    if (addon.self.disabled) return;
    virtualCursorSetDown(false);
    postMouseData({
      isDown: false,
    });
  };
  const handleGamepadMouseMove = (e) => {
    if (addon.self.disabled) return;
    virtualX = e.detail.x;
    virtualY = e.detail.y;
    virtualCursorSetPosition(virtualX, virtualY);
    postMouseData({});
  };

  gamepad.virtualCursor.maxX = renderer._xRight;
  gamepad.virtualCursor.minX = renderer._xLeft;
  gamepad.virtualCursor.maxY = renderer._yTop;
  gamepad.virtualCursor.minY = renderer._yBottom;
  gamepad.addEventListener("keydown", handleGamepadButtonDown);
  gamepad.addEventListener("keyup", handleGamepadButtonUp);
  gamepad.addEventListener("mousedown", handleGamepadMouseDown);
  gamepad.addEventListener("mouseup", handleGamepadMouseUp);
  gamepad.addEventListener("mousemove", handleGamepadMouseMove);

  while (true) {
    const stageHeaderWrapper = await addon.tab.waitForElement('[class*="stage-header_stage-menu-wrapper"]', {
      markAsSeen: true,
      reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
    });
    stageHeaderWrapper.insertBefore(spacer, stageHeaderWrapper.lastChild);

    const stage = document.querySelector("[class^='stage_stage_']");
    stage.appendChild(virtualCursorContainer);
  }
}
