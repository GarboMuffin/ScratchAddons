// Shared registry for the "Scratch Addons editor menu" addon.
//
// Other addons can place their own buttons inside the single Scratch Addons
// menu (instead of scattering more buttons across the editor header) by
// importing this module:
//
//   import { addItem } from "../editor-addon-menu/api.js";
//   const handle = addItem({
//     id: "my-addon/do-thing",
//     text: msg("do-thing"),
//     order: 50,
//     onClick: () => doThing(),
//   });
//   // later: handle.remove();
//
// The registry lives in module scope, so it is shared between every addon that
// imports it (same pattern as debugger/pause's module.js). Items can be added
// before or after the menu itself has rendered; the menu re-renders whenever
// the registry changes.

const items = [];
let onChange = null;

// Internal: the menu userscript registers its re-render function here.
export function _setRenderer(fn) {
  onChange = fn;
}

// Internal: returns the items sorted by `order` (then insertion order).
export function _getItems() {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.order ?? 100) - (b.item.order ?? 100) || a.index - b.index)
    .map(({ item }) => item);
}

function notify() {
  if (onChange) onChange();
}

/**
 * Add (or replace) an item in the Scratch Addons editor menu.
 * @param {object} opts
 * @param {string} opts.id - unique id; adding the same id again replaces it.
 * @param {string|function} opts.text - label, or a function returning the label.
 * @param {function} opts.onClick - click handler.
 * @param {number} [opts.order=100] - sort order; lower comes first.
 * @returns {{remove: function, setText: function}} handle
 */
export function addItem({ id, text, onClick, order = 100 } = {}) {
  if (!id) throw new Error("editor-addon-menu addItem: an `id` is required");
  removeItem(id);
  const item = { id, text, onClick, order };
  items.push(item);
  notify();
  return {
    remove: () => removeItem(id),
    setText: (newText) => {
      item.text = newText;
      notify();
    },
  };
}

export function removeItem(id) {
  const index = items.findIndex((item) => item.id === id);
  if (index !== -1) {
    items.splice(index, 1);
    notify();
  }
}
