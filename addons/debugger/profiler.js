export default async function createProfilerTab({ debug, addon, console, msg }) {
  /**
   * scratch-vm Thread
   * https://github.com/LLK/scratch-vm/blob/develop/src/engine/thread.js
   * @typedef {Object} Thread
   * @property {Array<string | null>} stack
   */

  /**
   * scratch-vm RenderedTarget
   * https://github.com/LLK/scratch-vm/blob/develop/src/engine/target.js
   * https://github.com/LLK/scratch-vm/blob/develop/src/sprites/rendered-target.js
   * @typedef {Object} Target
   */

  /**
   * scratch-vm utility object passed to block functions.
   * https://github.com/LLK/scratch-vm/blob/develop/src/engine/block-utility.js
   * @typedef {Object} BlockUtility
   * @property {Target} target
   * @property {Thread} thread
   */

  const vm = addon.tab.traps.vm;

  /**
   * @param {{_cache: {_executeCached: Record<string, unknown>}}} blockContainer
   * @param {unknown} args
   * @returns {string|null}
   */
  const searchForArgsInBlocks = (blockContainer, args) => {
    // TODO: this loop could probably be optimized by recursively searching from the known "statement" block ID
    // to find the input.
    const executeCache = blockContainer._cache._executeCached;
    for (const blockId of Object.keys(executeCache)) {
      const value = executeCache[blockId];
      if (value._argValues === args) {
        return blockId;
      }
    }
    return null;
  };

  const blockIdCacheSymbol = Symbol("used for profiler block ID cache");

  /**
   * @param {Thread} thread
   * @param {unknown} args argument value passed to a block
   * @returns {string|null} block ID if it can be found
   */
  const getBlockIdFromThreadAndArgs = (thread, args) => {
    // Scratch will tell us which "move ( ) steps" block we're running, for example, but it won't
    // tell us which input inside the block is being run.
    // To figure that out, we can look around in the cache. The argument object passed to the
    // block is also stored by reference in the cache, so we can just search for it.
    // I hate this so much.

    // We've found that storing the cached block ID on args using a symbol is faster than a WeakMap.
    const cached = args[blockIdCacheSymbol];
    if (typeof cached !== "undefined") {
      return cached;
    }

    const selfBlockId = searchForArgsInBlocks(thread.blockContainer, args);
    if (selfBlockId) {
      args[blockIdCacheSymbol] = selfBlockId;
      return selfBlockId;
    }

    const flyoutBlockId = searchForArgsInBlocks(vm.runtime.flyoutBlocks, args);
    if (flyoutBlockId) {
      args[blockIdCacheSymbol] = flyoutBlockId;
      return flyoutBlockId;
    }

    args[blockIdCacheSymbol] = null;
    return null;
  };

  /** Millisecond precise time. */
  const lowPrecisionNow = () => Date.now();

  /** Might return sub-millisecond precision depending on the browser. */
  const highPrecisionNow = () => performance.now();

  /** @returns {number} time in milliseconds from an arbitrary time in the past */
  let now = lowPrecisionNow;

  class ProfilerSection {
    /**
     * @param {string} id Internal name for this section. Meaning will vary depending on where in the tree this is.
     */
    constructor(id) {
      this.id = id;
      this.target = null;
      this.selfTime = 0;
      /** @type {ProfilerSection[]} */
      this.children = [];
    }

    reset() {
      this.selfTime = 0;
      this.children = [];
    }

    /**
     * @param {string} id
     * @returns {ProfilerSection}
     */
    getOrCreateChild(id, target) {
      for (const child of this.children) {
        if (child.id === id) {
          return child;
        }
      }
      const section = new ProfilerSection(id);
      section.target = target || null;
      this.children.push(section);
      return section;
    }

    /**
     * @param {ProfilerSection} child
     */
    addChild(child) {
      this.children.push(child);
    }

    /** @param {(section: ProfilerSection) => void} callback */
    forEachChild(callback) {
      // Do not use recursion to avoid stack overflow.
      const toVisit = this.children.slice();
      while (toVisit.length) {
        const section = toVisit.pop();
        for (const child of section.children) {
          toVisit.push(child);
        }
        callback(section);
      }
    }

    getTotalTime() {
      let total = this.selfTime;
      this.forEachChild((section) => {
        total += section.selfTime;
      });
      return total;
    }
  }

  const rootSection = new ProfilerSection("(root)");
  const stepThreadSection = rootSection.getOrCreateChild("Sequencer#stepThreads");
  const renderSection = rootSection.getOrCreateChild("RenderWebGL#render");

  const resetData = () => {
    stepThreadSection.reset();
    renderSection.reset();
  };

  /**
   * @param {unknown} targetObject
   * @param {string} methodName
   * @param {ProfilerSection} section
   */
  const convertToProfiledFunction = (targetObject, methodName, section) => {
    const originalFunction = targetObject[methodName];
    if (typeof originalFunction !== "function") {
      throw new Error(`Not a function: ${methodName}`);
    }
    targetObject[methodName] = function profiledFunction(...args) {
      if (isProfilerEnabled) {
        const startTrueTime = now();
        const startRecordedTime = section.getTotalTime();
        const ret = originalFunction.apply(this, args);
        const deltaRecordedTime = section.getTotalTime() - startRecordedTime;
        const trueDeltaTime = now() - startTrueTime;
        section.selfTime += trueDeltaTime - deltaRecordedTime;
        return ret;
      }
      return originalFunction.apply(this, args);
    };
  };

  convertToProfiledFunction(vm.runtime.sequencer, "stepThreads", stepThreadSection);
  convertToProfiledFunction(vm.runtime.renderer, "draw", renderSection);

  /**
   * @param {unknown} args scratch-vm args value
   * @param {BlockUtility} util scratch-vm block utility
   * @param {number} stackLength The length of the scratch-vm thread stack before the block was executed
   * @param {number} time
   */
  const recordBlock = (args, util, stackLength, time) => {
    // We don't need to check isProfilerEnabled here because our trapped block function trap should never be used
    // when the profiler isn't enabled.

    if (time === 0) {
      // Optimization: Ignore this block entirely.
      return;
    }

    const realBlockId = getBlockIdFromThreadAndArgs(util.thread, args);
    if (!realBlockId) {
      return;
    }

    let section = stepThreadSection;
    const target = util.target;
    const threadStack = util.thread.stack;
    // We need to use the length of the stack before the block was executed. Stepping into a branch or procedure
    // will add extra entries to the stack that we don't want to count -- we aren't executing them yet.
    for (let i = 0; i < stackLength; i++) {
      const stackBlockId = threadStack[i];
      // Stack may contain null.
      if (stackBlockId) {
        section = section.getOrCreateChild(stackBlockId, target);
      }
    }

    // Scratch's VM thread stack doesn't include most input blocks.
    if (section.id !== realBlockId) {
      section = section.getOrCreateChild(realBlockId, target);
    }

    section.selfTime += time;
  };

  const createProfiledBlockFunction = (originalFunction) =>
    /**
     * @param {unknown} args
     * @param {BlockUtility} util
     */
    function profiledBlockFunction(args, util) {
      const start = now();
      const stackLength = util.thread.stack.length;
      const result = originalFunction(args, util);
      recordBlock(args, util, stackLength, now() - start);
      return result;
    };

  const originalGetOpcodeFunction = vm.runtime.getOpcodeFunction;
  const cachedProfilerOpcodeFunctions = new Map();
  const profiledGetOpcodeFunction = function (opcode) {
    if (!cachedProfilerOpcodeFunctions.has(opcode)) {
      const originalFunction = originalGetOpcodeFunction.call(this, opcode);
      let newFunction;
      if (originalFunction) {
        // Wrap the function with profiling logic.
        newFunction = createProfiledBlockFunction(originalFunction);
      } else {
        // Opcode doesn't exist. Keep returning null.
        newFunction = originalFunction;
      }
      cachedProfilerOpcodeFunctions.set(opcode, newFunction);
    }
    return cachedProfilerOpcodeFunctions.get(opcode);
  };

  const resetAllBlockCaches = () => {
    for (const target of vm.runtime.targets) {
      if (target.isOriginal) {
        target.blocks.resetCache();
      }
    }
    vm.runtime.flyoutBlocks.resetCache();
  };

  let isProfilerEnabled = false;
  /** @param {boolean} _enabled */
  const setProfilerEnabled = (_enabled) => {
    isProfilerEnabled = _enabled;

    // This trap is installed dynamically because getOpcodeFunction is very hot.
    // We don't want to be adding any overhead when we don't need to.
    vm.runtime.getOpcodeFunction = isProfilerEnabled ? profiledGetOpcodeFunction : originalGetOpcodeFunction;

    // Must reset scratch-vm's caches so that the new getOpcodeFunction is used.
    resetAllBlockCaches();
  };

  /**
   * @template T
   * @param {Map<T, number>} map
   * @returns {[T, number][]}
   */
  const sortMapByValue = (map) =>
    Array.from(map.entries()).sort((a, b) => {
      return b[1] - a[1];
    });

  const tab = debug.createHeaderTab({
    text: "Profiler", // TODO
    icon: addon.self.dir + "/icons/performance.svg", // TODO
  });

  const content = Object.assign(document.createElement("div"), {
    className: "sa-profiler-tab-content",
  });

  const profilingSettingsContainer = document.createElement("div");
  profilingSettingsContainer.className = "sa-profiler-tab-content-inner";
  content.appendChild(profilingSettingsContainer);

  const startProfilingButton = document.createElement("button");
  startProfilingButton.textContent = "Start Profiling";
  startProfilingButton.addEventListener("click", () => {
    startProfiling();
  });
  profilingSettingsContainer.appendChild(startProfilingButton);

  const createPrecisionOption = (value, label) => {
    const inputEl = document.createElement("input");
    inputEl.type = "radio";
    inputEl.value = value;
    inputEl.name = "sa-debugger-profiler-precision";

    const labelEl = document.createElement("label");
    labelEl.appendChild(inputEl);
    labelEl.appendChild(document.createTextNode(label));

    return {
      container: labelEl,
      input: inputEl,
    };
  };

  const lowPrecisionOption = createPrecisionOption("low-precision", "Millisecond precision (~2x slower)");
  lowPrecisionOption.input.checked = true;
  profilingSettingsContainer.appendChild(lowPrecisionOption.container);

  const highPrecisionOption = createPrecisionOption(
    "high-precision",
    "Sub-millisecond precision (MUCH slower; depends on browser; will probably be removed)"
  );
  profilingSettingsContainer.appendChild(highPrecisionOption.container);

  const profilingResultsContainer = document.createElement("div");
  profilingResultsContainer.className = "sa-profiler-tab-content-inner";
  content.appendChild(profilingResultsContainer);

  const stopProfilingButton = document.createElement("button");
  stopProfilingButton.textContent = "Toggle Profiling";
  stopProfilingButton.addEventListener("click", () => {
    toggleProfiling();
  });
  profilingResultsContainer.appendChild(stopProfilingButton);

  const goBackButton = document.createElement("button");
  goBackButton.textContent = "Go Back";
  goBackButton.addEventListener("click", () => {
    goToProfilerSettingsScreen();
  });
  profilingResultsContainer.appendChild(goBackButton);

  // TODO: do this lazily, when the tab is first visible
  const canvas = Object.assign(document.createElement("canvas"), {
    className: "sa-profiler-tab-canvas",
  });
  profilingResultsContainer.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2d rendering context");
  }

  const render = () => {
    if (!isVisible) {
      return;
    }

    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;

    const scale = window.devicePixelRatio;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    ctx.scale(scale, scale);

    // Same font families as the rest of the Scratch interface
    ctx.font = '18px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = "#000000";

    const HEIGHT = 20;

    const timeByBlockId = new Map();
    const timeByOpcode = new Map();

    stepThreadSection.forEachChild((node) => {
      const blockId = node.id;
      timeByBlockId.set(blockId, (timeByBlockId.get(blockId) || 0) + node.selfTime);

      const block = debug.getBlock(node.target, blockId);
      if (block) {
        const opcode = block.opcode;
        timeByOpcode.set(opcode, (timeByOpcode.get(opcode) || 0) + node.selfTime);
      }
    });

    const sortedOpcodes = sortMapByValue(timeByOpcode);
    const sortedBlockIds = sortMapByValue(timeByBlockId);

    ctx.save();
    ctx.translate(0, 0);
    for (let i = 0; i < sortedOpcodes.length && i < 11; i++) {
      const entry = sortedOpcodes[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(250, 0);
    for (let i = 0; i < sortedBlockIds.length && i < 11; i++) {
      const entry = sortedBlockIds[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }
    ctx.restore();

    const sequencerTime = stepThreadSection.selfTime;
    const renderTime = renderSection.selfTime;
    ctx.translate(0, 260);
    ctx.fillText(`VM+Profiler overhead: ${Math.round(sequencerTime)}ms`, 0, 0);
    ctx.translate(0, 20);
    ctx.fillText(`Rendering sprites: ${Math.round(renderTime)}ms`, 0, 0);
  };

  debug.addAfterStepCallback(() => {
    if (isProfilerEnabled) {
      render();
    }
  });

  const startProfiling = () => {
    profilingSettingsContainer.style.display = "none";
    profilingResultsContainer.style.display = "";

    if (lowPrecisionOption.input.checked) {
      now = lowPrecisionNow;
    } else {
      now = highPrecisionNow;
    }

    resetData();
    setProfilerEnabled(true);
  };

  const toggleProfiling = () => {
    setProfilerEnabled(!isProfilerEnabled);
  };

  const goToProfilerSettingsScreen = () => {
    profilingSettingsContainer.style.display = "";
    profilingResultsContainer.style.display = "none";

    setProfilerEnabled(false);
  };

  goToProfilerSettingsScreen();

  let isVisible = false;
  const show = () => {
    isVisible = true;
  };
  const hide = () => {
    isVisible = false;
    setProfilerEnabled(false);
  };

  return {
    tab,
    content,
    buttons: [],
    show,
    hide,
  };
}
