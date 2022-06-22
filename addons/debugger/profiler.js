export default async function createProfilerTab({ debug, addon, console, msg }) {
  const vm = addon.tab.traps.vm;

  const tab = debug.createHeaderTab({
    text: "Profiler", // TODO
    icon: addon.self.dir + "/icons/performance.svg", // TODO
  });

  const content = Object.assign(document.createElement("div"), {
    className: "sa-profiler-tab-content",
  });

  let _nextFrameId = 0;

  /** @type {Object<string, number>} */
  const frameNameToId = new Map();

  /** @type {Object<number, string>} */
  const frameIdToName = new Map();

  /**
   * Contains color information for some types of frames. Not all frames will be in here.
   * @type {Object<number, string>}
   */
  const frameIdToColor = new Map();

  /**
   * @param {string} name
   * @param {number} id
   */
  const setFrameNameAndId = (name, id) => {
    frameNameToId.set(name, id);
    frameIdToName.set(id, name);
  };

  /**
   * @param {string} name
   * @returns {number}
   */
  const getFrameIdByName = (name) => {
    if (!frameNameToId.has(name)) {
      setFrameNameAndId(name, _nextFrameId++);
    }
    return frameNameToId.get(name);
  };

  /**
   * @param {number} id
   * @returns {string}
   */
  const getFrameNameById = (id) => {
    return frameIdToName.get(id) || ('' + id);
  };

  /**
   * The order of profiler events in a Scratch step:
   *
   * There are several types of profiler events in Scratch.
   * Some events use start() and stop(). I'm using indents to show starts and stops.
   * Some events use increment()
   * Some events manually increment a counter on an object returned by the profiler.
   *
   * 1. Start "Runtime._step"
   * https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/runtime.js#L2029
   *
   *   2. Start "Sequencer.stepThreads"
   *   https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/runtime.js#L2049
   *
   *     3. Start "Sequencer.stepThreads#inner"
   *     https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/sequencer.js#L93
   *
   *       4. Increment "Sequencer.stepThread"
   *       https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/sequencer.js#L121
   *
   *       5. Increment "execute"
   *       https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/sequencer.js#L201
   *
   *       6. (blocks are actually executed here)
   *
   *       7. Per-opcode frames from profiler.frame() manually incremented
   *       https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/execute.js#L565
   *
   *   8. Start "RenderWebGL.draw"
   *   https://github.com/LLK/scratch-vm/blob/67d9b9793c00d4f25994eb0d9dd27679e839e482/src/engine/runtime.js#L2070
   */

  /**
   * Helper method to make setting up native Scratch frames less verbose.
   * @param {string} name Hardcoded name in scratch-vm source code.
   * @param {string} [color] Color to display as.
   * @returns {number} ID
   */
  const setupNativeFrame = (name, color) => {
    const id = getFrameIdByName(name);
    if (color) {
      frameIdToColor.set(id, color);
    }
    return id;
  };
  
  const INTERNAL_ROOT_ID = setupNativeFrame("(root)", "#888888");
  const RUNTIME_STEP_ID = setupNativeFrame("Runtime._step", "#abcdef");
  const SEQUENCER_STEP_THREADS_ID = setupNativeFrame("Sequencer.stepThreads", "#ff3456");
  const SEQUENCER_STEP_THREADS_INNER_ID = setupNativeFrame("Sequencer.stepThreads#inner", "#00ff00");
  const SEQUENCER_STEP_SINGLE_THREAD_ID = setupNativeFrame("Sequencer.stepThread", "#00ffff");
  const EXECUTE_ID = setupNativeFrame("execute", "#ff00ff");
  const BLOCK_FUNCTION_ID = setupNativeFrame("blockFunction", "#ffff00");
  const RENDER_WEBGL_ID = setupNativeFrame("RenderWebGL.draw", "#888800");

  /**
   * The START event identifier in Profiler records.
   * @const {number}
   */
  const START = "START"; // TODO: convert back to number

  /**
   * The STOP event identifier in Profiler records.
   * @const {number}
   */
  const STOP = "STOP"; // TODO: convert back to number

  const now = () => performance.now();

  class Frame {
    /**
     * @param {number} id ID from idByName
     * @param {*} arg Arbitrary value
     * @param {number} startTime
     * @param {number} depth
     */
    constructor(id, arg, startTime, depth) {
      /**
       * @readonly
       * @type {number}
       */
       this.id = id;

      /**
       * @readonly
       * @type {*}
       */
      this.arg = arg;

      /**
       * The time this frame started.
       * @type {number}
       * @readonly
       */
      this.startTime = startTime;

      /**
       * How many frames are above this one.
       * @type {number}
       * @readonly
       */
      this.depth = depth;

      /**
       * Frames that happen inside this frame.
       * @type {Frame[]}
       */
      this.childFrames = [];

      /**
       * Total amount of time spent in this frame.
       * @type {amount}
       */
      this.totalTime = 0;
    }

    /**
     * The time this frame ended at.
     * @type {number}
     */
    get endTime() {
      return this.startTime + this.totalTime;
    }

    set endTime(newEndTime) {
      this.totalTime = newEndTime - this.startTime;
    }

    /**
     * The total amount of time spent specifically in this frame, not its children.
     * @type {number}
     */
    get selfTime() {
      let childTime = 0;
      for (const frame of this.childFrames) {
        childTime += frame.totalTime;
      }
      return this.totalTime - childTime;
    }
  }

  class ScratchAddonsProfiler {
    constructor(onUpdate) {
      /**
       * Callback called when the profiler has finished processing new data.
       * @type {(frame: Frame) => void}
       */
      this.onUpdate = onUpdate;

      /**
       * Raw profiler data. See start() and stop().
       * @type {Array<*>}
       */
      this.records = [];

      /**
       * The time the current frame started.
       * @type {number}
       */
      this.frameStartTime = 0;

      /**
       * # of start() calls minus # of stop() calls
       * @type {number}
       */
      this.depth = 0;

      /**
       * Whether a block is currently being executed or not.
       * @type {boolean}
       */
      this.isBlockBeingExecuted = false;

      /**
       * The object returned by frame().
       * We use this to know when Scratch finishes executing a block as it will increment the count parameter.
       */
      this.fakeFrame = {};
      Object.defineProperty(this.fakeFrame, "count", {
        get: () => {
          // Doesn't matter what we return here.
          return 0;
        },
        set: (newCount) => {
          // Scratch will increment count when it finishes executing a block.
          if (this.isBlockBeingExecuted) {
            this.isBlockBeingExecuted = false;
            this.stop();
          }
        },
      });
    }

    /**
     * Called by Scratch when a profiler frame begins.
     * @param {number} id ID from idByName
     * @param {?*} arg Arbitrary argument
     */
    start(id, arg) {
      if (this.records.length === 0) {
        // TODO this can be determined later, doesn't need to happen here yet
        this.frameStartTime = now();
      }
      this.depth++;
      this.records.push(START, id, arg, now());
    }

    /**
     * Called by Scratch when a profiler frame ends.
     */
    stop() {
      this.depth--;
      if (this.depth < 0) {
        // should never happen
      }
      this.records.push(STOP, now());
    }

    /**
     * Called by Scratch to increment a profiler name.
     * @param {number} id ID from idByName.
     */
    increment(id) {
      if (id === EXECUTE_ID) {
        this.isBlockBeingExecuted = true;
        const currentThread = vm.runtime.sequencer.activeThread;
        this.start(id, currentThread.peekStack());
      }
    }

    /**
     * Called by Scratch to create a frame with a manually increment-able counter.
     * @param {number} id ID from idByName
     * @param {*} arg Arbitrary argument
     * @return {{count: number}}
     */
    frame(id, arg) {
      return this.fakeFrame;
    }

    /**
     * Called by Scratch at the end of the frame so the profiler can process data.
     */
    reportFrames() {
      const records = this.records;

      const rootFrame = new Frame(INTERNAL_ROOT_ID, null, this.frameStartTime, 0);
      const stack = [rootFrame];

      let i = 0;
      while (i < records.length) {
        const type = records[i];

        if (type === START) {
          // see profiler.start()
          const frameId = records[i + 1];
          const arg = records[i + 2];
          const startTime = records[i + 3];
          i += 4;

          const frame = new Frame(frameId, arg, startTime, stack.length);
          stack.push(frame);
        } else if (type === STOP) {
          // see profiler.stop()
          const endTime = records[i + 1];
          i += 2;

          const endedFrame = stack.pop();
          const totalTime = endTime - endedFrame.startTime;
          endedFrame.totalTime = totalTime;

          const parentFrame = stack[stack.length - 1];
          parentFrame.childFrames.push(endedFrame);
        } else {
          // Should never happen.
          console.error("Error decoding profiler records: unknown type", type);
          records.length = 0;
          return;
        }
      }

      records.length = 0;

      rootFrame.endTime = now();
      this.onUpdate(rootFrame);
    }

    /**
     * Called by Scratch to look up a numerical ID for a name.
     * @param {string} name
     * @return {number}
     */
    idByName(name) {
      return getFrameIdByName(name);
    }

    /**
     * Returns the name for an ID from idByName.
     * Not called by Scratch but let's not remove it.
     * @param {number} id
     * @return {string}
     */
    nameById(id) {
      return getFrameNameById(id);
    }
  }

  /**
   * @param {Frame} rootFrame
   * @param {(frame: Frame) => void} callback
   */
  const recurseFrame = (rootFrame, callback) => {
    // Do not actually use recursion to implement this.
    // Scratch blocks can recurse further than normal JS functions can handle without a stack overflow.
    const toVisit = [rootFrame];
    while (toVisit.length !== 0) {
      const frame = toVisit.pop();
      callback(frame);
      for (const child of frame.childFrames) {
        toVisit.push(child);
      }
    }
  };

  /**
   * @param {Frame} rootFrame
   * @returns {void} This function operates in-place. The result is stored in rootFrame.
   */
  const convertCallsToFlameGraph = (rootFrame) => {
    // TODO this is horrible O(n^2), rewrite the profiler collection logic itself
    recurseFrame(rootFrame, (frame) => {
      const children = frame.childFrames;
      let totalExtraTime = 0;
      for (let i = 0; i < children.length; i++) {
        const frameA = children[i];

        frameA.startTime += totalExtraTime;
        totalExtraTime = 0;

        // Iterate backwards because we delete items mid-iteration
        let j = children.length - 1;
        while (j > i) {
          const frameB = children[j];
          if (frameA.id === frameB.id) {
            children.splice(j, 1);
            totalExtraTime += frameB.totalTime;
          }
          j--;
        }
        frameA.totalTime += totalExtraTime;
      }
    });
  };

  /**
   * @param {Frame} rootFrameA 
   * @param {Frame} rootFrameB 
   * @returns {void} This function operates in place. The result is stored in rootFrameA.
   */
  const mergeFlameGraphs = (rootFrameA, rootFrameB) => {
    // TODO this is horrible O(n^2), rewrite the profiler collection logic itself
    // TODO this is also just broken
    const toVisit = [[rootFrameA, rootFrameB]];
    while (toVisit.length !== 0) {
      const frames = toVisit.pop();
      const frameA = frames[0];
      const frameB = frames[1];

      frameA.totalTime += frameB.totalTime;

      const childrenA = frameA.childFrames;
      const childrenB = frameB.childFrames;

      for (let i = 0; i < childrenA.length; i++) {
        const childA = childrenA[i];

        // Iterate backwards because we delete items mid-iteration
        let j = childrenB.length - 1;
        while (j >= 0) {
          const childB = childrenB[j];
          if (childA.id === childB.id) {
            childA.totalTime += childB.totalTime;
            childrenB.splice(j, 1);
          }
          j--;
        }
      }

      for (const childB of childrenB) {
        childrenA.push(childB);
      }
    }
  };

  const canvas = Object.assign(document.createElement('canvas'), {
    className: "sa-profiler-tab-canvas"
  });
  const ctx = canvas.getContext('2d');
  content.appendChild(canvas);

  /**
   * @param {Frame} frame
   * @returns {string}
   */
  const getFrameColor = (frame) => {
    return frameIdToColor.get(frame.id) || 'red';
  };

  /**
   * @param {Frame} frame
   * @returns {string}
   */
  const getFrameText = (frame) => {
    const arg = frame.arg;
    if (arg) {
      return arg;
    }
    const text = getFrameNameById(frame.id);
    return text;
  };

  /** @type {Frame|null} */
  let finalFrame = null;

  /**
   * @param {Frame} newFrame
   */
  const onProfilerUpdate = (newFrame) => {
    // convertCallsToFlameGraph(newFrame);
    finalFrame = newFrame;
    // if (finalFrame) {
    //   mergeFlameGraphs(finalFrame, newFrame)
    // } else {
    // }
    render();
  };

  const getBlock = (id) => {
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

  const render = () => {
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;

    const scale = window.devicePixelRatio;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    ctx.scale(scale, scale);

    const startTime = finalFrame.startTime;
    const endTime = finalFrame.endTime;
    const totalTime = finalFrame.totalTime;

    // Same font families as the rest of the Scratch interface
    ctx.font = '18px "Helvetica Neue", Helvetica, Arial, sans-serif';

    const FRAME_HEIGHT = 20;
    const TEXT_BASELINE = 0.8 * 20;

    const scaleHorizontalCoordinate = (time) => time / 16 * canvasWidth;

    // Do not use recursion.
    // Scratch blocks can recurse far deeper than normal JS functions can handle without a stack overflow.
    recurseFrame(finalFrame, (frame) => {
      const relativeStartTime = frame.startTime - startTime;
      const totalTime = frame.totalTime;
      const depth = frame.depth;

      const x = scaleHorizontalCoordinate(relativeStartTime);
      const y = depth * FRAME_HEIGHT;
      const width = scaleHorizontalCoordinate(totalTime);
      const height = FRAME_HEIGHT;
      // TODO: cull

      ctx.fillStyle = getFrameColor(frame);
      ctx.fillRect(x, y, width, height);

      if (width > 10) {
        ctx.fillStyle = 'black';
        ctx.fillText(getFrameText(frame), x, y + TEXT_BASELINE);
      }
    });

    /** @type {Map<string, number>} */
    const timeByOpcode = new Map();
    recurseFrame(finalFrame, (frame) => {
      const blockId = frame.arg;
      if (!blockId) {
        return;
      }

      const block = getBlock(blockId);
      if (!block) {
        return;
      }

      const opcode = block.opcode;
      const selfTime = frame.selfTime;
      timeByOpcode.set(opcode, (timeByOpcode.get(opcode) || 0) + selfTime);
    });
    const sortedOpcodes = Array.from(timeByOpcode.entries()).sort((a, b) => {
      return b[1] - a[1];
    });

    ctx.translate(0, 150);
    ctx.fillStyle = '#000000';
    for (let i = 0; i < sortedOpcodes.length && i < 10; i++) {
      const entry = sortedOpcodes[i];
      const opcode = entry[0];
      const time = entry[1];
      ctx.fillText(`${opcode} - ${Math.round(time)}ms`, 0, i * FRAME_HEIGHT);
    }
  };

  const setProfilerEnabled = (enabled) => {
    if (enabled) {
      finalFrame = null;
    }

    startProfilingButton.element.style.display = enabled ? 'none' : '';
    stopProfilingButton.element.style.display = enabled ? '' : 'none';
    vm.runtime.profiler = enabled ? new ScratchAddonsProfiler(onProfilerUpdate) : null;
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
