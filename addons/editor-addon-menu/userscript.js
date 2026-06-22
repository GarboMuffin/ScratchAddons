import { addItem, _setRenderer, _getItems } from "./api.js";

export default async function ({ addon, console, msg }) {
  await addon.tab.scratchClassReady();

  // Built-in items. These are registered once and live in the shared registry,
  // so they survive re-renders and re-enables.
  addItem({
    id: "editor-addon-menu/settings",
    order: 0,
    text: () => msg("settings"),
    onClick: () => window.open("https://scratch.mit.edu/scratch-addons-extension/settings", "_blank"),
  });
  addItem({
    id: "editor-addon-menu/feedback",
    order: 10,
    text: () => msg("feedback"),
    onClick: () => window.open("https://scratchaddons.com/feedback/", "_blank"),
  });

  // --- Build the menu button (matches Scratch's File/Edit menus) ---
  const button = document.createElement("button");
  button.className = addon.tab.scratchClass("menu-bar_menu-bar-item", "menu-bar_hoverable", {
    others: "sa-addon-menu",
  });
  button.setAttribute("aria-label", msg("menu-name"));
  button.setAttribute("aria-expanded", "false");

  const logo = document.createElement("img");
  logo.className = "sa-addon-menu-logo";
  logo.draggable = false;
  logo.src = addon.self.dir + "/sa-logo.svg";
  button.appendChild(logo);

  const label = document.createElement("span");
  label.className = addon.tab.scratchClass("menu-bar_collapsible-label");
  const labelText = document.createElement("span");
  labelText.textContent = msg("menu-name");
  label.appendChild(labelText);
  button.appendChild(label);

  const caret = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  caret.setAttribute("viewBox", "0 0 12 8");
  caret.setAttribute("class", "sa-addon-menu-caret");
  const caretPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  caretPath.setAttribute("d", "M1 1.5 6 6.5 11 1.5");
  caret.appendChild(caretPath);
  button.appendChild(caret);

  // Dropdown (only attached to the DOM while open).
  const dropdown = document.createElement("div");
  dropdown.className = addon.tab.scratchClass("menu-bar_menu-bar-menu");
  const list = document.createElement("ul");
  list.className = addon.tab.scratchClass("menu_menu", "menu_right", { others: "sa-addon-menu-list" });
  dropdown.appendChild(list);

  const activeClass = addon.tab.scratchClass("menu-bar_active");

  const renderItems = () => {
    list.textContent = "";
    const menuItems = _getItems();
    if (!menuItems.length) {
      const empty = document.createElement("li");
      empty.className = addon.tab.scratchClass("menu_menu-item", { others: "sa-addon-menu-empty" });
      empty.textContent = msg("empty");
      list.appendChild(empty);
      return;
    }
    for (const item of menuItems) {
      const li = document.createElement("li");
      li.className = addon.tab.scratchClass("menu_menu-item", "menu_hoverable", { others: "sa-addon-menu-item" });
      li.dataset.menuItem = "true";
      li.tabIndex = -1;
      const span = document.createElement("span");
      span.textContent = typeof item.text === "function" ? item.text() : item.text;
      li.appendChild(span);
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(false);
        try {
          item.onClick?.();
        } catch (err) {
          console.error("editor-addon-menu item handler failed", err);
        }
      });
      list.appendChild(li);
    }
  };

  let open = false;
  const setOpen = (value) => {
    if (open === value) return;
    open = value;
    button.setAttribute("aria-expanded", String(value));
    if (activeClass) button.classList.toggle(activeClass, value);
    if (value) {
      renderItems();
      button.appendChild(dropdown);
    } else {
      dropdown.remove();
    }
  };

  // Re-render live if the registry changes while the menu is open.
  _setRenderer(() => {
    if (open) renderItems();
  });

  button.addEventListener("click", (e) => {
    // Clicks on items are handled by the items themselves.
    if (e.target.closest("li")) return;
    setOpen(!open);
  });

  document.addEventListener("click", (e) => {
    if (open && !button.contains(e.composedPath()[0])) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (open && e.key === "Escape") {
      setOpen(false);
      button.blur();
    }
  });

  addon.self.addEventListener("disabled", () => setOpen(false));
  addon.tab.displayNoneWhileDisabled(button);

  // Keep the button in place across editor re-renders (mode/locale/font changes
  // rebuild the menu bar). The first file-group holds Settings/File/Edit.
  while (true) {
    const menuGroup = await addon.tab.waitForElement("[class*='menu-bar_file-group_']", {
      markAsSeen: true,
      // The editor has two file-groups (Settings/File/Edit, then Tutorials/Debug).
      // Only ever attach to the first one, next to the File and Edit menus.
      elementCondition: (el) =>
        el.parentElement && el === el.parentElement.querySelector("[class*='menu-bar_file-group_']"),
      reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    menuGroup.appendChild(button);
  }
}
