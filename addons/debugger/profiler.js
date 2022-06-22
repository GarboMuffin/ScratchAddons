export default async function createProfilerTab({ debug, addon, console, msg }) {
  const vm = addon.tab.traps.vm;

  const tab = debug.createHeaderTab({
    text: "Profiler", // TODO
    icon: addon.self.dir + "/icons/performance.svg", // TODO
  });

  const content = Object.assign(document.createElement("div"), {
    className: "sa-profiler-tab-content",
  });

  const canvas = Object.assign(document.createElement('canvas'), {
    className: "sa-profiler-tab-canvas"
  });
  const ctx = canvas.getContext('2d');
  content.appendChild(canvas);

  /**
   * @param {Map<*, number>} map
   * @returns {Array<*, number>}
   */
  const sortMapByValue = (map) => Array.from(map.entries()).sort((a, b) => {
    return b[1] - a[1];
  });

  /**
   * @param {ProcessedResults} processed
   */
  const render = (processed) => {
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;

    const scale = window.devicePixelRatio;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    ctx.scale(scale, scale);

    // Same font families as the rest of the Scratch interface
    ctx.font = '18px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#000000';

    const HEIGHT = 20;

    const sortedOpcodes = sortMapByValue(processed.timeByOpcode);
    const sortedBlockIds = sortMapByValue(processed.timeByBlockId);

    ctx.save();

    ctx.translate(0, 0);
    for (let i = 0; i < sortedOpcodes.length && i < 15; i++) {
      const entry = sortedOpcodes[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }

    ctx.restore();
    ctx.translate(250, 0);
    for (let i = 0; i < sortedBlockIds.length && i < 15; i++) {
      const entry = sortedBlockIds[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.translate(0, HEIGHT);
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, 0);
    }
  };

  const argsToBlockIdCache = new WeakMap();
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
    if (argsToBlockIdCache.has(args)) {
      return argsToBlockIdCache.get(args);
    }
    // TODO: look into ways to optimize this loop if needed
    const executeCache = thread.blockContainer._cache._executeCached;
    for (const blockId of Object.keys(executeCache)) {
      const value = executeCache[blockId];
      if (value._argValues === args) {
        argsToBlockIdCache.set(args, blockId);
        return blockId;
      }
    }
    return thread.peekStack();
  }

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

  const START_RECORD = 0;
  const END_RECORD = 1;
  const records = [];

  // TODO: now() is called a LOT and typically there will be no difference in time between calls
  // we should consider caching this for a few calls, which may improve performacne
  const now = () => performance.now();

  const recordStartBlock = (thread, args) => {
    const blockId = getBlockIdFromThreadAndArgs(thread, args);
    records.push(START_RECORD);
    records.push(now());
    records.push(blockId);
  };

  const recordEndBlock = () => {
    records.push(END_RECORD);
    records.push(now());
  };

  class ReuseableProfilerFrame {
    constructor () {
      this.reset();
    }

    reset() {
      this.blockId = 'unknown';
      this.opcode = 'unknown';
      this.startTime = 0;
    }
  }

  class ProcessedResults {
    constructor() {
      /** @type {Map<string, number>} */
      this.timeByOpcode = new Map();

      /** @type {Map<string, number>} */
      this.timeByBlockId = new Map();
    }

    addOpcodeTime(opcode, time) {
      this.timeByOpcode.set(opcode, (this.timeByOpcode.get(opcode) || 0) + time);
    }

    addBlockIdTime(blockId, time) {
      this.timeByBlockId.set(blockId, (this.timeByBlockId.get(blockId) || 0) + time);
    }

    /**
     * @param {ProcessedResults} otherResults 
     * @returns {void} This class is modified in-place.
     */
    mergeInPlace(otherResults) {
      for (const [opcode, time] of otherResults.timeByOpcode.entries()) {
        this.addOpcodeTime(opcode, time);
      }

      for (const [blockId, time] of otherResults.timeByBlockId.entries()) {
        this.addBlockIdTime(blockId, time);
      }
    }
  }

  const processRecords = (records) => {
    const result = new ProcessedResults();
    const stack = [];

    let i = 0;
    while (i < records.length) {
      const type = records[i];
      if (type === START_RECORD) {
        const startTime = records[i + 1];
        const blockId = records[i + 2];
        i += 3;

        // TODO: actually reuse these
        const newFrame = new ReuseableProfilerFrame();
        newFrame.reset();
        newFrame.blockId = blockId;
        newFrame.startTime = startTime;

        const block = getBlockFromUnknownSprite(blockId);
        if (block) {
          newFrame.opcode = block.opcode;
        }

        stack.push(newFrame);
      } else if (type === END_RECORD) {
        const endTime = records[i + 1];
        i += 2;

        const finishedFrame = stack.pop();
        const totalTime = endTime - finishedFrame.startTime;

        const opcode = finishedFrame.opcode;
        result.addOpcodeTime(opcode, totalTime);

        const blockId = finishedFrame.blockId;
        result.addBlockIdTime(blockId, totalTime);
      }
    }

    return result;
  };

  /** @type {ProcessedResults|null} */
  let previousResults = null;

  debug.addAfterStepCallback(() => {
    if (records.length === 0) {
      return;
    }

    const newResults = processRecords(records);
    if (previousResults) {
      previousResults.mergeInPlace(newResults);
    } else {
      previousResults = newResults;
    }
    render(previousResults);

    records.length = 0;
  });

  const originalGetOpcodeFunction = vm.runtime.getOpcodeFunction;
  const cachedProfilerOpcodeFunctions = new Map();
  const profiledGetOpcodeFunction = function (opcode) {
    if (!cachedProfilerOpcodeFunctions.has(opcode)) {
      const originalFunction = originalGetOpcodeFunction.call(this, opcode);
      let newFunction;
      if (originalFunction) {
        // Wrap the function with profiling logic.
        newFunction = function profiledOpcodeFunction (args, util) {
          recordStartBlock(util.thread, args);
          const result = originalFunction(args, util);
          recordEndBlock();
          return result;
        };
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
  };

  const setProfilerEnabled = (enabled) => {
    startProfilingButton.element.style.display = enabled ? 'none' : '';
    stopProfilingButton.element.style.display = enabled ? '' : 'none';

    // This trap is installed dynamically because getOpcodeFunction is very hot.
    // We don't want to be adding any overhead when we don't need to.
    vm.runtime.getOpcodeFunction = enabled ? profiledGetOpcodeFunction : originalGetOpcodeFunction;

    // Must reset scratch-vm's caches so that our modified getOpcodeFunction is used.
    resetAllBlockCaches();

    if (enabled) {
      previousResults = null;
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
