export default async function createProfilerTab({ debug, addon, console, msg }) {
  /**
   * @typedef {Object} Thread
   */

  const vm = addon.tab.traps.vm;

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
    throw new Error('Cannot get 2d rendering context');
  }
  content.appendChild(canvas);

  /**
   * @param {Map<*, number>} map
   * @returns {Array<*, number>}
   */
  const sortMapByValue = (map) =>
    Array.from(map.entries()).sort((a, b) => {
      return b[1] - a[1];
    });

  /** @param {ProcessedResults} results */
  const render = (results) => {
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

    const sortedOpcodes = sortMapByValue(results.timeByOpcode);
    const sortedBlockIds = sortMapByValue(results.timeByBlockId);

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

    const sequencerTime = results.timeByType.get(SEQUENCER_STEP_THREADS_EVENT) - totalBlockTime;
    const renderTime = results.timeByType.get(RENDERER_DRAW_EVENT);
    ctx.translate(0, 200);
    ctx.fillText(`VM overhead: ${sequencerTime}ms`, 0, 0);
    ctx.translate(0, 20);
    ctx.fillText(`Render sprites: ${renderTime}ms`, 0, 0);
  };

  const blockIdCacheSymbol = Symbol('profiler arg to block ID cache')
  /**
   * @param {Thread} thread
   * @param {*} args argument value passed to a block
   * @returns {string|null} ID of block
   */
  const getBlockIdFromThreadAndArgs = (thread, args) => {
    // Scratch will tell us which "move ( ) steps" block we're running, for example, but it won't
    // tell us which input inside the block is being run.
    // To figure that out, we can look around in the cache. The argument object passed to the
    // block is also stored by reference in the cache, so we can just search for it.
    // I hate this so much.

    // We've found that storing the cached block ID on args using a symbol is faster than a WeakMap.
    const cached = args[blockIdCacheSymbol];
    if (cached) {
      return cached;
    }

    // TODO: look into ways to optimize this loop if needed
    // TODO: probably also have to check flyout blocks
    const executeCache = thread.blockContainer._cache._executeCached;
    for (const blockId of Object.keys(executeCache)) {
      const value = executeCache[blockId];
      if (value._argValues === args) {
        args[blockIdCacheSymbol] = blockId;
        return blockId;
      }
    }
    return null;
  };

  const getBlockFromUnknownSprite = (id) => {
    // TODO this is horrible
    for (const target of vm.runtime.targets) {
      const block = target.blocks.getBlock(id);
      if (block) {
        return block;
      }
    }
    // TODO check flyout
    return null;
  };

  // TODO: now() is called a LOT and typically there will be no difference in time between calls
  // we should consider caching this for a few calls, which may improve performacne
  const now = () => performance.now();

  const START_BLOCK = 0;
  const SEQUENCER_STEP_THREADS_EVENT = 1;
  const RENDERER_DRAW_EVENT = 2;
  const END_RECORD = 3;

  // TODO: convert to something like an Int32Array.
  // TODO: use bitwise operators to more efficiently pack.
  const records = [];

  /** @param {number} type See constants above */
  const recordEvent = (type) => {
    records.push(type);
    records.push(now());
  };

  /**
   * @param {Thread} thread
   * @param {*} args
   */
  const recordStartBlock = (thread, args) => {
    const blockId = getBlockIdFromThreadAndArgs(thread, args);
    records.push(START_BLOCK);
    records.push(now());
    records.push(blockId);
  };

  const recordEnd = () => {
    records.push(END_RECORD);
    records.push(now());
  };

  class ReuseableProfilerFrame {
    constructor() {
      this.reset();
    }

    reset() {
      /** @type {string} */
      this.blockId = "";

      /** @type {string} */
      this.opcode = "";

      /** @type {number} See type constants */
      this.type = 0;

      /** @type {number} */
      this.startTime = 0;
    }
  }

  // We use a LOT of frames while processing profiler data, so create a pool and reuse these to create less garbage.

  /** @type {ReuseableProfilerFrame[]} */
  const reuseableFrames = [];

  /** @returns {ReuseableProfilerFrame} */
  const getReuseableFrame = () => {
    if (reuseableFrames.length) {
      const frame = reuseableFrames.pop();
      frame.reset();
      return frame;
    }
    return new ReuseableProfilerFrame();
  };

  /** @param {ReuseableProfilerFrame} frame */
  const releaseReuseableFrame = (frame) => {
    reuseableFrames.push(frame);
  };

  class ProcessedResults {
    constructor() {
      /** @type {Map<number, number>} */
      this.timeByType = new Map();
      // For timeByType, all the fields must already exist
      this.timeByType.set(START_BLOCK, 0);
      this.timeByType.set(SEQUENCER_STEP_THREADS_EVENT, 0);
      this.timeByType.set(RENDERER_DRAW_EVENT, 0);

      /** @type {Map<string, number>} */
      this.timeByOpcode = new Map();

      /** @type {Map<string, number>} */
      this.timeByBlockId = new Map();
    }

    addTypeTime(type, time) {
      this.timeByType.set(type, this.timeByType.get(type) + time);
    }

    addOpcodeTime(opcode, time) {
      this.timeByOpcode.set(opcode, (this.timeByOpcode.get(opcode) || 0) + time);
    }

    addBlockIdTime(blockId, time) {
      this.timeByBlockId.set(blockId, (this.timeByBlockId.get(blockId) || 0) + time);
    }
  }

  /**
   * @param {ProcessedResults} result
   * @returns {void} The result is stored in the result parameter.
   */
  const processRecords = (result) => {
    const stack = [];

    let i = 0;
    while (i < records.length) {
      const type = records[i];
      if (type === START_BLOCK) {
        const startTime = records[i + 1];
        const blockId = records[i + 2];
        i += 3;

        const newFrame = getReuseableFrame();
        newFrame.blockId = blockId;
        newFrame.startTime = startTime;
        newFrame.type = type;

        const block = getBlockFromUnknownSprite(blockId);
        if (block) {
          newFrame.opcode = block.opcode;
        }

        stack.push(newFrame);
      } else if (type === SEQUENCER_STEP_THREADS_EVENT || type === RENDERER_DRAW_EVENT) {
        const startTime = records[i + 1];
        i += 2;

        const newFrame = getReuseableFrame();
        newFrame.type = type;
        newFrame.startTime = startTime;

        stack.push(newFrame);
      } else if (type === END_RECORD) {
        const endTime = records[i + 1];
        i += 2;

        const finishedFrame = /** @type {ReuseableProfilerFrame} */ (stack.pop());
        const totalTime = endTime - finishedFrame.startTime;

        // Optimization: If no time passed (very common), don't bother with map lookups.
        if (totalTime !== 0) {
          const type = finishedFrame.type;
          result.addTypeTime(type, totalTime);

          const opcode = finishedFrame.opcode;
          if (opcode) {
            result.addOpcodeTime(opcode, totalTime);
          }

          const blockId = finishedFrame.blockId;
          if (blockId) {
            result.addBlockIdTime(blockId, totalTime);
          }
        }

        releaseReuseableFrame(finishedFrame);
      } else {
        // Should never happen.
        throw new Error(`Profiler processing found unexpected type: ${type}`);
      }
    }
  };

  /** @type {ProcessedResults} */
  let previousResults = new ProcessedResults();

  debug.addAfterStepCallback(() => {
    if (isProfilerEnabled) {
      // TODO: would it be better to not track events in the first place when profiler is disabled?
      if (!previousResults) {
        previousResults = new ProcessedResults();
      }
      processRecords(previousResults);
      render(previousResults);
    }

    records.length = 0;
  });

  const createProfiledFunction = (targetObject, methodName, eventType) => {
    const originalFunction = targetObject[methodName];
    targetObject[methodName] = function profiledFunction(...args) {
      recordEvent(eventType);
      const ret = originalFunction.apply(this, args);
      recordEnd();
      return ret;
    };
  };

  const createProfiledBlockFunction = (originalFunction) =>
    function profiledBlockFunction(args, util) {
      recordStartBlock(util.thread, args);
      const result = originalFunction(args, util);
      recordEnd();
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
      // Reset results
      previousResults = new ProcessedResults();
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

  let isVisible = false;
  const show = () => {
    isVisible = true;
  };
  const hide = () => {
    isVisible = false;
    setProfilerEnabled(false);
  };

  setProfilerEnabled(false);

  return {
    tab,
    content,
    buttons: [startProfilingButton, stopProfilingButton],
    show,
    hide,
  };
}
