/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from '../core/block.js';
import type { BlockDefinition } from '../core/blocks.js';
import type { Abstract as AbstractEvent } from '../core/events/events_abstract.js';
import '../core/icons/comment_icon.js';
import '../core/icons/warning_icon.js';
/** A dictionary of the block definitions provided by this module. */
export declare const blocks: {
    [key: string]: BlockDefinition;
};
/**
 * Type of a procedures_ifreturn block.
 *
 * @internal
 */
export type IfReturnBlock = Block & IfReturnMixin;
interface IfReturnMixin extends IfReturnMixinType {
    hasReturnValue_: boolean;
}
type IfReturnMixinType = typeof PROCEDURES_IFRETURN;
declare const PROCEDURES_IFRETURN: {
    /**
     * Block for conditionally returning a value from a procedure.
     */
    init: (this: IfReturnBlock) => void;
    /**
     * Create XML to represent whether this block has a return value.
     *
     * @returns XML storage element.
     */
    mutationToDom: (this: IfReturnBlock) => Element;
    /**
     * Parse XML to restore whether this block has a return value.
     *
     * @param xmlElement XML storage element.
     */
    domToMutation: (this: IfReturnBlock, xmlElement: Element) => void;
    /**
     * Called whenever anything on the workspace changes.
     * Add warning if this flow block is not nested inside a loop.
     *
     * @param e Move event.
     */
    onchange: (this: IfReturnBlock, e: AbstractEvent) => void;
    /**
     * List of block types that are functions and thus do not need warnings.
     * To add a new function type add this to your code:
     * Blocks['procedures_ifreturn'].FUNCTION_TYPES.push('custom_func');
     */
    FUNCTION_TYPES: string[];
};
export {};
//# sourceMappingURL=procedures.d.ts.map