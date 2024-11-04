/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from '../core/block.js';
import type { BlockSvg } from '../core/block_svg.js';
import { FieldImage } from '../core/field_image.js';
import '../core/field_variable.js';
import type { Workspace } from '../core/workspace.js';
/**
 * A dictionary of the block definitions provided by this module.
 */
export declare const blocks: {
    [key: string]: any;
};
/** Type of a block that has QUOTE_IMAGE_MIXIN */
type QuoteImageBlock = Block & QuoteImageMixin;
interface QuoteImageMixin extends QuoteImageMixinType {
}
type QuoteImageMixinType = typeof QUOTE_IMAGE_MIXIN;
declare const QUOTE_IMAGE_MIXIN: {
    /**
     * Image data URI of an LTR opening double quote (same as RTL closing double
     * quote).
     */
    QUOTE_IMAGE_LEFT_DATAURI: string;
    /**
     * Image data URI of an LTR closing double quote (same as RTL opening double
     * quote).
     */
    QUOTE_IMAGE_RIGHT_DATAURI: string;
    /**
     * Pixel width of QUOTE_IMAGE_LEFT_DATAURI and QUOTE_IMAGE_RIGHT_DATAURI.
     */
    QUOTE_IMAGE_WIDTH: number;
    /**
     * Pixel height of QUOTE_IMAGE_LEFT_DATAURI and QUOTE_IMAGE_RIGHT_DATAURI.
     */
    QUOTE_IMAGE_HEIGHT: number;
    /**
     * Inserts appropriate quote images before and after the named field.
     *
     * @param fieldName The name of the field to wrap with quotes.
     */
    quoteField_: (this: QuoteImageBlock, fieldName: string) => void;
    /**
     * A helper function that generates a FieldImage of an opening or
     * closing double quote. The selected quote will be adapted for RTL blocks.
     *
     * @param open If the image should be open quote (“ in LTR).
     *     Otherwise, a closing quote is used (” in LTR).
     * @returns The new field.
     */
    newQuote_: (this: QuoteImageBlock, open: boolean) => FieldImage;
};
/**
 * Type of a block that has TEXT_JOIN_MUTATOR_MIXIN
 *
 * @internal
 */
export type JoinMutatorBlock = BlockSvg & JoinMutatorMixin & QuoteImageMixin;
interface JoinMutatorMixin extends JoinMutatorMixinType {
}
type JoinMutatorMixinType = typeof JOIN_MUTATOR_MIXIN;
/**
 * Mixin for mutator functions in the 'text_join_mutator' extension.
 */
declare const JOIN_MUTATOR_MIXIN: {
    itemCount_: number;
    /**
     * Create XML to represent number of text inputs.
     * Backwards compatible serialization implementation.
     *
     * @returns XML storage element.
     */
    mutationToDom: (this: JoinMutatorBlock) => Element;
    /**
     * Parse XML to restore the text inputs.
     * Backwards compatible serialization implementation.
     *
     * @param xmlElement XML storage element.
     */
    domToMutation: (this: JoinMutatorBlock, xmlElement: Element) => void;
    /**
     * Returns the state of this block as a JSON serializable object.
     *
     * @returns The state of this block, ie the item count.
     */
    saveExtraState: (this: JoinMutatorBlock) => {
        itemCount: number;
    };
    /**
     * Applies the given state to this block.
     *
     * @param state The state to apply to this block, ie the item count.
     */
    loadExtraState: (this: JoinMutatorBlock, state: {
        [x: string]: any;
    }) => void;
    /**
     * Populate the mutator's dialog with this block's components.
     *
     * @param workspace Mutator's workspace.
     * @returns Root block in mutator.
     */
    decompose: (this: JoinMutatorBlock, workspace: Workspace) => Block;
    /**
     * Reconfigure this block based on the mutator dialog's components.
     *
     * @param containerBlock Root block in mutator.
     */
    compose: (this: JoinMutatorBlock, containerBlock: Block) => void;
    /**
     * Store pointers to any connected child blocks.
     *
     * @param containerBlock Root block in mutator.
     */
    saveConnections: (this: JoinMutatorBlock, containerBlock: Block) => void;
    /**
     * Modify this block to have the correct number of inputs.
     *
     */
    updateShape_: (this: JoinMutatorBlock) => void;
};
export {};
//# sourceMappingURL=text.d.ts.map