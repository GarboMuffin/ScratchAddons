/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { BlockDefinition } from '../core/blocks.js';
import * as lists from './lists.js';
import * as logic from './logic.js';
import * as loops from './loops.js';
import * as math from './math.js';
import * as procedures from './procedures.js';
import * as texts from './text.js';
import * as variables from './variables.js';
import * as variablesDynamic from './variables_dynamic.js';
export { lists, logic, loops, math, procedures, texts, variables, variablesDynamic, };
/**
 * A dictionary of the block definitions provided by all the
 * Blockly.libraryBlocks.* modules.
 */
export declare const blocks: {
    [key: string]: BlockDefinition;
};
//# sourceMappingURL=blocks.d.ts.map