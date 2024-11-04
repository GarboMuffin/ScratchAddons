/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Block } from '../core/block.js';
import '../core/field_dropdown.js';
import type { Workspace } from '../core/workspace.js';
/**
 * A dictionary of the block definitions provided by this module.
 */
export declare const blocks: {
    [key: string]: any;
};
/**
 * Type of a 'lists_create_with' block.
 *
 * @internal
 */
export type CreateWithBlock = Block & ListCreateWithMixin;
interface ListCreateWithMixin extends ListCreateWithMixinType {
    itemCount_: number;
}
type ListCreateWithMixinType = typeof LISTS_CREATE_WITH;
declare const LISTS_CREATE_WITH: {
    /**
     * Block for creating a list with any number of elements of any type.
     */
    init: (this: CreateWithBlock) => void;
    /**
     * Create XML to represent list inputs.
     * Backwards compatible serialization implementation.
     */
    mutationToDom: (this: CreateWithBlock) => Element;
    /**
     * Parse XML to restore the list inputs.
     * Backwards compatible serialization implementation.
     *
     * @param xmlElement XML storage element.
     */
    domToMutation: (this: CreateWithBlock, xmlElement: Element) => void;
    /**
     * Returns the state of this block as a JSON serializable object.
     *
     * @returns The state of this block, ie the item count.
     */
    saveExtraState: (this: CreateWithBlock) => {
        itemCount: number;
    };
    /**
     * Applies the given state to this block.
     *
     * @param state The state to apply to this block, ie the item count.
     */
    loadExtraState: (this: CreateWithBlock, state: AnyDuringMigration) => void;
    /**
     * Populate the mutator's dialog with this block's components.
     *
     * @param workspace Mutator's workspace.
     * @returns Root block in mutator.
     */
    decompose: (this: CreateWithBlock, workspace: Workspace) => ContainerBlock;
    /**
     * Reconfigure this block based on the mutator dialog's components.
     *
     * @param containerBlock Root block in mutator.
     */
    compose: (this: CreateWithBlock, containerBlock: Block) => void;
    /**
     * Store pointers to any connected child blocks.
     *
     * @param containerBlock Root block in mutator.
     */
    saveConnections: (this: CreateWithBlock, containerBlock: Block) => void;
    /**
     * Modify this block to have the correct number of inputs.
     */
    updateShape_: (this: CreateWithBlock) => void;
};
/** Type for a 'lists_create_with_container' block. */
type ContainerBlock = Block & ContainerMutator;
interface ContainerMutator extends ContainerMutatorType {
}
type ContainerMutatorType = typeof LISTS_CREATE_WITH_CONTAINER;
declare const LISTS_CREATE_WITH_CONTAINER: {
    /**
     * Mutator block for list container.
     */
    init: (this: ContainerBlock) => void;
};
export {};
//# sourceMappingURL=lists.d.ts.map