/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from '../core/block.js';
import type { Abstract as AbstractEvent } from '../core/events/events_abstract.js';
import '../core/field_dropdown.js';
import '../core/field_label.js';
import '../core/field_number.js';
import '../core/field_variable.js';
import '../core/icons/warning_icon.js';
/**
 * A dictionary of the block definitions provided by this module.
 */
export declare const blocks: {
    [key: string]: any;
};
/**
 * List of block types that are loops and thus do not need warnings.
 * To add a new loop type add this to your code:
 *
 * // If using the Blockly npm package and es6 import syntax:
 * import {loops} from 'blockly/blocks';
 * loops.loopTypes.add('custom_loop');
 *
 * // Else if using Closure Compiler and goog.modules:
 * const {loopTypes} = goog.require('Blockly.libraryBlocks.loops');
 * loopTypes.add('custom_loop');
 *
 * // Else if using blockly_compressed + blockss_compressed.js in browser:
 * Blockly.libraryBlocks.loopTypes.add('custom_loop');
 */
export declare const loopTypes: Set<string>;
/**
 * Type of a block that has CONTROL_FLOW_IN_LOOP_CHECK_MIXIN
 *
 * @internal
 */
export type ControlFlowInLoopBlock = Block & ControlFlowInLoopMixin;
interface ControlFlowInLoopMixin extends ControlFlowInLoopMixinType {
}
type ControlFlowInLoopMixinType = typeof CONTROL_FLOW_IN_LOOP_CHECK_MIXIN;
/**
 * This mixin adds a check to make sure the 'controls_flow_statements' block
 * is contained in a loop. Otherwise a warning is added to the block.
 */
declare const CONTROL_FLOW_IN_LOOP_CHECK_MIXIN: {
    /**
     * Is this block enclosed (at any level) by a loop?
     *
     * @returns The nearest surrounding loop, or null if none.
     */
    getSurroundLoop: (this: ControlFlowInLoopBlock) => Block | null;
    /**
     * Called whenever anything on the workspace changes.
     * Add warning if this flow block is not nested inside a loop.
     */
    onchange: (this: ControlFlowInLoopBlock, e: AbstractEvent) => void;
};
export {};
//# sourceMappingURL=loops.d.ts.map