export default async function ({ addon, console }) {
  const ITEM_SELECTOR = "[class*='backpack_backpack-item_']";
  const IMAGE_SELECTOR = "[class*='sprite-selector-item_sprite-image_']";
  const TYPE_SELECTOR = "[class*='sprite-selector-item_sprite-name_']";
  const NAME_SELECTOR = "[class*='sprite-selector-item_sprite-details_']";
  const GAP = 8; // px between the backpack item and the preview

  let preview = null;
  let previewImage = null;
  let previewLabel = null;
  let activeItem = null;
  let showTimer = null;

  const buildPreview = () => {
    if (preview) return;
    preview = document.createElement("div");
    preview.className = "sa-backpack-preview";
    preview.dataset.saHidden = "true";

    previewImage = document.createElement("img");
    previewImage.className = "sa-backpack-preview-image";
    previewImage.draggable = false;
    // Keep the preview pinned to the hovered item once the (usually cached) image decodes.
    previewImage.addEventListener("load", () => {
      if (activeItem && preview.dataset.saHidden !== "true") position(activeItem);
    });

    previewLabel = document.createElement("div");
    previewLabel.className = "sa-backpack-preview-label";

    preview.appendChild(previewImage);
    preview.appendChild(previewLabel);
    document.body.appendChild(preview);
  };

  const position = (item) => {
    const rect = item.getBoundingClientRect();
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;

    // Prefer showing above the item (the backpack sits at the bottom of the editor);
    // fall back to below if there isn't enough room.
    let top = rect.top - height - GAP;
    if (top < GAP) {
      const below = rect.bottom + GAP;
      top = below + height + GAP > window.innerHeight ? Math.max(GAP, rect.top - height - GAP) : below;
    }

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(GAP, Math.min(left, window.innerWidth - width - GAP));

    preview.style.top = `${Math.round(top)}px`;
    preview.style.left = `${Math.round(left)}px`;
  };

  const showPreview = (item) => {
    if (addon.self.disabled) return;
    const image = item.querySelector(IMAGE_SELECTOR) || item.querySelector("img");
    const src = image && image.src;
    if (!src) return;

    buildPreview();

    const max = `${addon.settings.get("size")}px`;
    previewImage.style.maxWidth = max;
    previewImage.style.maxHeight = max;
    previewImage.src = src;

    const type = item.querySelector(TYPE_SELECTOR);
    const name = item.querySelector(NAME_SELECTOR);
    const parts = [];
    if (name && name.textContent.trim()) parts.push(name.textContent.trim());
    if (type && type.textContent.trim()) parts.push(type.textContent.trim());
    previewLabel.textContent = parts.join(" · ");
    previewLabel.style.display = parts.length ? "" : "none";

    preview.dataset.saHidden = "false";
    // Position after layout so offsetWidth/Height reflect the new content.
    requestAnimationFrame(() => {
      if (activeItem === item && preview.dataset.saHidden === "false") position(item);
    });
  };

  const hidePreview = () => {
    clearTimeout(showTimer);
    showTimer = null;
    if (preview) preview.dataset.saHidden = "true";
  };

  const setActive = (item) => {
    if (item === activeItem) return;
    activeItem = item;
    clearTimeout(showTimer);
    showTimer = null;
    if (item) {
      const delay = addon.settings.get("delay");
      showTimer = setTimeout(() => {
        if (activeItem === item) showPreview(item);
      }, delay);
    } else {
      hidePreview();
    }
  };

  document.addEventListener("pointerover", (e) => {
    if (addon.self.disabled) return;
    const target = e.target;
    const item = target && target.closest ? target.closest(ITEM_SELECTOR) : null;
    setActive(item);
  });

  // The pointer leaving the window doesn't fire pointerover, so catch it explicitly.
  document.addEventListener("pointerout", (e) => {
    if (!e.relatedTarget) setActive(null);
  });

  // Hide as soon as the user starts dragging an item out, or scrolls the backpack.
  document.addEventListener("pointerdown", () => setActive(null), true);
  document.addEventListener(
    "scroll",
    () => {
      if (activeItem) setActive(null);
    },
    true
  );

  addon.self.addEventListener("disabled", () => setActive(null));
}
