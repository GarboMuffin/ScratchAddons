export default async function ({ addon, console }) {
  const DRAG_OVER_CLASS = "sa-dragged-over";

  const reactAwareSetValue = (el, value) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  let currentDropTarget = null;

  const findDropTarget = (target) => {
    let el;
    let callback;
    if (
      (el = target.closest('div[class*="sprite-selector_sprite-selector"]')) ||
      (el = target.closest('div[class*="stage-selector_stage-selector"]')) ||
      (el = target.closest('div[class*="selector_wrapper"]'))
    ) {
      callback = (files) => {
        const hdFilter = addon.settings.get("use-hd-upload") ? "" : ":not(.sa-better-img-uploads-input)";
        const fileInput = el.querySelector('input[class*="action-menu_file-input"]' + hdFilter);
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      };
    } else if (
      !addon.tab.redux.state.scratchGui.mode.isPlayerOnly &&
      (el = target.closest('div[class*="monitor_list-monitor"]'))
    ) {
      callback = (files) => {
        const contextMenuBefore = document.querySelector("body > .react-contextmenu.react-contextmenu--visible");
        // Simulate a right click on the list monitor
        el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
        // Get the right click menu that opened (monitor context menus are
        // children of <body>)
        const contextMenuAfter = document.querySelector("body > .react-contextmenu.react-contextmenu--visible");
        // `contextMenuAfter` is only null if the context menu was already open
        // for the list monitor, in which case we can use the context menu from
        // before the simulated right click
        const contextMenu = contextMenuAfter === null ? contextMenuBefore : contextMenuAfter;
        // Sometimes the menu flashes open, so force hide it.
        contextMenu.style.display = "none";
        // Override DOM methods to import the text file directly
        // See: https://github.com/LLK/scratch-gui/blob/develop/src/lib/import-csv.js#L21-L22
        const appendChild = document.body.appendChild;
        document.body.appendChild = (fileInput) => {
          // Restore appendChild to <body>
          document.body.appendChild = appendChild;
          if (fileInput instanceof HTMLInputElement) {
            document.body.appendChild(fileInput);
            // Prevent Scratch from opening the file input dialog
            fileInput.click = () => {};
            // Insert files from the drop event into the file input
            fileInput.files = files;
            fileInput.dispatchEvent(new Event("change"));
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                contextMenu.style.display = null;
                contextMenu.style.opacity = 0;
                contextMenu.style.pointerEvents = "none";
              });
            });
          } else {
            // The next call for `appendChild` SHOULD be the file input, but if
            // it's not, then make `appendChild` behave as normal.
            console.error('File input was not immediately given to appendChild upon clicking "Import"!');
            return appendChild(fileInput);
          }
        };
        // Simulate clicking on the "Import" option
        contextMenu.children[0].click();
      };
    } else if (
      (el = target.closest('div[class*="question_question-input"] > input[class*="input_input-form_l9eYg"]'))
    ) {
      callback = async (files) => {
        const text = (await Promise.all(Array.from(files, (file) => file.text())))
          .join("")
          // Match pasting behavior: remove all newline characters at the end
          .replace(/[\r\n]+$/, "")
          .replace(/\r?\n|\r/g, " ");
        const selectionStart = el.selectionStart;
        reactAwareSetValue(el, el.value.slice(0, selectionStart) + text + el.value.slice(el.selectionEnd));
        el.setSelectionRange(selectionStart, selectionStart + text.length);
      };
    }
    if (el) {
      return {
        el,
        callback,
      };
    }
    return null;
  };

  const resetDropTarget = () => {
    if (currentDropTarget) {
      currentDropTarget.el.classList.remove(DRAG_OVER_CLASS);
      currentDropTarget = null;
    }
  };

  const handleDragOver = (e) => {
    if (currentDropTarget) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      return;
    }

    if (addon.self.disabled) {
      return;
    }

    if (!e.dataTransfer.types.includes("Files")) {
      return;
    }

    const newDropTarget = findDropTarget(e.target);
    if (!newDropTarget) {
      return;
    }

    resetDropTarget();
    currentDropTarget = newDropTarget;
    currentDropTarget.el.classList.add(DRAG_OVER_CLASS);
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e) => {
    // The dragleave event has some quirks.
    // If you have a DOM structure like this:
    // <div>abc <span>def</span> xyz</div>
    // If the cursor moves from the div element to the span element, it fires a dragleave
    // event with the div as the target.
    if (currentDropTarget && !currentDropTarget.el.contains(e.target)) {
      resetDropTarget();
    }
  };

  const handleDrop = (e) => {
    if (currentDropTarget) {
      e.preventDefault();
      if (e.dataTransfer.types.includes("Files") && e.dataTransfer.files.length > 0) {
        currentDropTarget.callback(e.dataTransfer.files);
      }
      resetDropTarget();
    }
  };

  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
}
