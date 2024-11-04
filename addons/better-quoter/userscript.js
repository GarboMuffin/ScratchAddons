import { setupBetterQuoter } from "./module.js";

/** @param {UserscriptUtilities} param0 */
export default async function ({ addon, console }) {
  setupBetterQuoter(addon);
}
