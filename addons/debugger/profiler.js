export default async function createProfilerTab({ debug, addon, console, msg }) {
  /**
   * scratch-vm Thread
   * https://github.com/LLK/scratch-vm/blob/develop/src/engine/thread.js
   * @typedef {Object} Thread
   */

  /**
   * scratch-vm RenderedTarget
   * https://github.com/LLK/scratch-vm/blob/develop/src/engine/target.js
   * https://github.com/LLK/scratch-vm/blob/develop/src/sprites/rendered-target.js
   * @typedef {Object} Target
   */

  const vm = addon.tab.traps.vm;

  /**
   * @param {{_cache: {_executeCached: Record<string, *>}}} blockContainer
   * @param {*} args
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
   * @param {*} args argument value passed to a block
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

  // TODO: now() is called a LOT and typically there will be no difference in time between calls
  // we should consider caching this for a few calls, which may improve performance
  const now = () => performance.now();

  const SEQUENCER_STEP_THREADS_EVENT = 1;
  const RENDERER_DRAW_EVENT = 2;

  /** @type {Map<number, number>} */
  const timeByEvent = new Map();

  /** @type {Map<string, number>} */
  const timeByOpcode = new Map();

  /** @type {Map<string, number>} */
  const timeByBlockId = new Map();

  /**
   * @param {*} args scratch-vm args value
   * @param {{thread: Thread, target: Target}} util scratch-vm block utility
   * @param {number} time
   */
  const recordBlock = (args, util, time) => {
    // We don't need to check isProfilerEnabled here because the block execution trap doesn't do anything
    // when the profiler is disabled.
    if (time === 0) {
      return;
    }
    const blockId = getBlockIdFromThreadAndArgs(util.thread, args);
    if (!blockId) {
      return;
    }
    const block = debug.getBlock(util.target, blockId);
    if (!block) {
      return;
    }
    const opcode = block.opcode;
    timeByOpcode.set(opcode, (timeByOpcode.get(opcode) || 0) + time);
    timeByBlockId.set(blockId, (timeByBlockId.get(blockId) || 0) + time);
  };

  /**
   * @param {number} type Any event constant above.
   * @param {number} time
   */
  const recordEvent = (type, time) => {
    if (!isProfilerEnabled) {
      return;
    }
    // All values in this map must already exist.
    timeByEvent.set(type, (timeByEvent.get(type) || 0) + time);
  };

  const resetData = () => {
    timeByEvent.clear();
    timeByOpcode.clear();
    timeByBlockId.clear();
  };

  const createProfiledFunction = (targetObject, methodName, eventType) => {
    const originalFunction = targetObject[methodName];
    targetObject[methodName] = function profiledFunction(...args) {
      const start = now();
      const ret = originalFunction.apply(this, args);
      recordEvent(eventType, now() - start);
      return ret;
    };
  };

  const createProfiledBlockFunction = (originalFunction) =>
    function profiledBlockFunction(args, util) {
      const start = now();
      const result = originalFunction(args, util);
      recordBlock(args, util, now() - start);
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

  createProfiledFunction(vm.runtime.sequencer, "stepThreads", SEQUENCER_STEP_THREADS_EVENT);
  createProfiledFunction(vm.runtime.renderer, "draw", RENDERER_DRAW_EVENT);

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

    startProfilingButton.element.style.display = isProfilerEnabled ? "none" : "";
    stopProfilingButton.element.style.display = isProfilerEnabled ? "" : "none";

    // This trap is installed dynamically because getOpcodeFunction is very hot.
    // We don't want to be adding any overhead when we don't need to.
    vm.runtime.getOpcodeFunction = isProfilerEnabled ? profiledGetOpcodeFunction : originalGetOpcodeFunction;

    // Must reset scratch-vm's caches so that our modified getOpcodeFunction is used.
    resetAllBlockCaches();

    if (isProfilerEnabled) {
      resetData();
    }
  };

  const startProfilingButton = debug.createHeaderButton({
    text: "Start", // TODO
    icon: addon.self.dir + "/icons/step.svg", // TODO
    description: "Placeholder", // TODO
  });
  startProfilingButton.element.addEventListener("click", () => {
    setProfilerEnabled(true);
  });

  const stopProfilingButton = debug.createHeaderButton({
    text: "Stop", // TODO
    icon: addon.self.dir + "/icons/step.svg", // TODO
    description: "Placeholder", // TODO
  });
  stopProfilingButton.element.addEventListener("click", () => {
    setProfilerEnabled(false);
  });

  setProfilerEnabled(false);

  /**
   * @param {Map<*, number>} map
   * @returns {Array<*, number>}
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

  // TODO: do this lazily, when the tab is first visible
  const canvas = Object.assign(document.createElement("canvas"), {
    className: "sa-profiler-tab-canvas",
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2d rendering context");
  }
  content.appendChild(canvas);

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

    const sortedOpcodes = sortMapByValue(timeByOpcode);
    const sortedBlockIds = sortMapByValue(timeByBlockId);

    ctx.save();
    ctx.translate(0, 0);
    let totalBlockTime = 0;
    for (let i = 0; i < sortedOpcodes.length && i < 13; i++) {
      const entry = sortedOpcodes[i];
      const opcode = entry[0];
      const time = entry[1];
      totalBlockTime += time;
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(250, 0);
    for (let i = 0; i < sortedBlockIds.length && i < 13; i++) {
      const entry = sortedBlockIds[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }
    ctx.restore();

    const sequencerTime = (timeByEvent.get(SEQUENCER_STEP_THREADS_EVENT) || 0) - totalBlockTime;
    const renderTime = timeByEvent.get(RENDERER_DRAW_EVENT) || 0;
    ctx.translate(0, 300);
    ctx.fillText(`VM overhead: ${sequencerTime}ms`, 0, 0);
    ctx.translate(0, 20);
    ctx.fillText(`Render sprites: ${renderTime}ms`, 0, 0);
  };

  debug.addAfterStepCallback(() => {
    if (isProfilerEnabled) {
      render();
    }
  });

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
    buttons: [startProfilingButton, stopProfilingButton],
    show,
    hide,
  };
}
