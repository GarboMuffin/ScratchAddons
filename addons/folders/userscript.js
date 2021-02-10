export default async function ({ addon, global, console, msg }) {
  const REACT_INTERNAL_PREFIX = "__reactInternalInstance$";
  const ID_PREFIX = "sa_";
  const ID_FOLDER_PREFIX = `${ID_PREFIX}folder_folder_`;
  const ID_BACK = `${ID_PREFIX}folder_back`;

  const SVG_NS = "http://www.w3.org/2000/svg";

  const TYPE_SPRITES = 1;
  const TYPE_ASSETS = 2;

  // We run too early, will be set later
  let vm;

  let reactInternalKey;

  let currentSpriteFolder;
  let currentSpriteItems;
  let currentAssetItems;

  /**
   * getFolderFromName("B") === null
   * getFolderFromName("A/b") === "A"
   */
  const getFolderFromName = (name) => {
    const idx = name.indexOf("/");
    if (idx === -1) {
      return null;
    }
    return name.substr(0, idx);
  };

  /**
   * getNameWithoutFolder("B") === "B"
   * getNameWithoutFolder("A/b") === "b"
   */
  const getNameWithoutFolder = (name) => {
    const idx = name.indexOf("/");
    if (idx === -1) {
      return name;
    }
    return name.substr(idx + 1);
  };

  /**
   * setFolderOfName("B", "y") === "y/B"
   * setFolderOfName("c/B", "y") === "y/B"
   * setFolderOfName("B", null) === "B"
   * setFolderOfName("c/B", null) === "B"
   */
  const setFolderOfName = (name, folder) => {
    const basename = getNameWithoutFolder(name);
    if (folder) {
      return `${folder}/${basename}`;
    }
    return basename;
  };

  const getSortableHOCFromElement = (el) => {
    const nearestSpriteSelector = el.closest("[class*='sprite-selector_sprite-selector']");
    if (nearestSpriteSelector) {
      return nearestSpriteSelector[reactInternalKey].child.sibling.child.stateNode;
    }
    const nearestAssetPanelWrapper = el.closest('[class*="asset-panel_wrapper"]');
    if (nearestAssetPanelWrapper) {
      return nearestAssetPanelWrapper[reactInternalKey].child.child.stateNode;
    }
    throw new Error("cannot find SortableHOC");
  };

  const clamp = (n, min, max) => {
    return Math.min(Math.max(n, min), max);
  };

  const getItemData = (item) => {
    if (item && item.name && typeof item.name === "object") {
      return item.name;
    }
    return null;
  };

  const openFolderAsset = {
    assetId: "sa_folders_folder",
    encodeDataURI() {
      // Doesn't actually need to be a data: URI
      return addon.self.dir + "/folder.svg";
    },
  };

  let folderColorStylesheet = null;
  const folderColors = Object.create(null);
  const getFolderColorClass = (folderName) => {
    // Based on java's String.hashCode
    // https://hg.openjdk.java.net/jdk8/jdk8/jdk/file/687fd7c7986d/src/share/classes/java/lang/String.java#l1452
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = 31 * hash + str.charCodeAt(i);
        hash = hash | 0;
      }
      return hash;
    };

    if (!folderColors[folderName]) {
      if (!folderColorStylesheet) {
        folderColorStylesheet = document.createElement("style");
        document.head.appendChild(folderColorStylesheet);
      }
      // Every folder needs a random-ish color, but it should also stay consistent between visits.
      const hash = hashCode(folderName);
      const color = `hsla(${((hash & 0xff) / 0xff) * 360}deg, 100%, 85%, 0.5)`;
      const id = Object.keys(folderColors).length;
      const className = `sa-folders-color-${id}`;
      folderColors[folderName] = className;
      folderColorStylesheet.textContent += `.${className} { background-color: ${color} !important; }\n`;
    }
    return folderColors[folderName];
  };

  const patchSortableHOC = (SortableHOC, type) => {
    // SortableHOC should be: https://github.com/LLK/scratch-gui/blob/29d9851778febe4e69fa5111bf7559160611e366/src/lib/sortable-hoc.jsx#L8

    const PREVIEW_SIZE = 80;
    const PREVIEW_POSITIONS = [
      // x, y
      [0, 0],
      [PREVIEW_SIZE / 2, 0],
      [0, PREVIEW_SIZE / 2],
      [PREVIEW_SIZE / 2, PREVIEW_SIZE / 2],
    ];

    const createFolderPreview = (items) => {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", PREVIEW_SIZE);
      svg.setAttribute("height", PREVIEW_SIZE);
      for (let i = 0; i < Math.min(PREVIEW_POSITIONS.length, items.length); i++) {
        const item = items[i];
        const image = document.createElementNS(SVG_NS, "image");
        image.setAttribute("width", PREVIEW_SIZE / 2);
        image.setAttribute("height", PREVIEW_SIZE / 2);
        image.setAttribute("x", PREVIEW_POSITIONS[i][0]);
        image.setAttribute("y", PREVIEW_POSITIONS[i][1]);
        if (item.asset) {
          image.setAttribute("href", item.asset.encodeDataURI());
        } else if (item.costume && item.costume.asset) {
          image.setAttribute("href", item.costume.asset.encodeDataURI());
        }
        svg.appendChild(image);
      }
      return "data:image/svg+xml;," + new XMLSerializer().serializeToString(svg);
    };

    const getFolderPreviewAssetId = (items) => {
      let id = "sa_folder_preview||";
      for (let i = 0; i < Math.min(PREVIEW_POSITIONS.length, items.length); i++) {
        const item = items[i];
        if (item.asset) {
          id += item.asset.assetId;
        } else if (item.costume && item.costume.asset) {
          id += item.costume.asset.assetId;
        }
        id += "||";
      }
      return id;
    };

    const processItems = (openFolders, props) => {
      const processItem = (item) => {
        const itemFolderName = getFolderFromName(item.name);
        const itemData = {
          realName: item.name,
          realIndex: i,
          inFolder: itemFolderName,
        };
        const newItem = {
          name: itemData,
        };

        if (type === TYPE_SPRITES) {
          newItem.costume = item.costume;
          newItem.id = item.id;
        } else if (type === TYPE_ASSETS) {
          newItem.asset = item.asset;
          if (item.url) {
            newItem.url = item.url;
          }
        }

        return {
          newItem,
          itemData,
        };
      };

      const items = [];
      const result = {
        items,
      };

      let i = 0;
      while (i < props.items.length) {
        const item = props.items[i];
        const folderName = getFolderFromName(item.name);

        if (folderName === null) {
          items.push(processItem(item).newItem);
          if (type === TYPE_ASSETS) {
            const isSelected = props.selectedItemIndex === i;
            if (isSelected) {
              result.selectedItemIndex = items.length - 1;
            }
          }
        } else {
          const isOpen = openFolders.indexOf(folderName) !== -1;
          const folderData = {
            folder: folderName,
            folderOpen: isOpen,
          };
          const folderItems = [];
          const folderItem = {
            items: folderItems,
            name: folderData,
          };
          const folderAsset = isOpen
            ? openFolderAsset
            : {
                // We don't know these when the folder item is created
                get assetId() {
                  return getFolderPreviewAssetId(folderItem.items);
                },
                encodeDataURI() {
                  return createFolderPreview(folderItem.items);
                },
              };
          if (type === TYPE_SPRITES) {
            folderItem.costume = {
              asset: folderAsset,
            };
          } else {
            folderItem.asset = folderAsset;
          }
          items.push(folderItem);

          while (i < props.items.length) {
            const newItem = props.items[i];
            const processedItem = processItem(newItem);
            if (getFolderFromName(newItem.name) !== folderName) {
              break;
            }
            folderItems.push(processedItem.newItem);
            processedItem.itemData.realName = getNameWithoutFolder(processedItem.itemData.realName);
            if (isOpen) {
              items.push(processedItem.newItem);
            }
            if (type === TYPE_ASSETS) {
              const isSelected = props.selectedItemIndex === i;
              if (isSelected) {
                if (isOpen) {
                  result.selectedItemIndex = items.length - 1;
                } else {
                  result.selectedItemIndex = -1;
                }
              }
            }
            i++;
          }
          i--;
        }

        i++;
      }

      return result;
    };

    SortableHOC.prototype.saInitialSetup = function () {
      let folders = [];
      // TODO: do this for assets as well
      if (type === TYPE_SPRITES) {
        const target = vm.runtime.getTargetById(this.props.selectedId);
        if (target && target.sprite && target.isSprite()) {
          folders = [getFolderFromName(target.sprite.name)];
        }
      }
      this.setState({
        folders,
      });
    };

    SortableHOC.prototype.componentDidMount = function () {
      currentSpriteFolder = null;
    };

    SortableHOC.prototype.componentDidUpdate = function (prevProps, prevState) {
      // When the selected sprite has changed, open its folder.
      if (type === TYPE_SPRITES) {
        if (prevProps.selectedId !== this.props.selectedId) {
          const oldTarget = vm.runtime.getTargetById(prevProps.selectedId);
          const newTarget = vm.runtime.getTargetById(this.props.selectedId);
          if (
            oldTarget &&
            newTarget &&
            oldTarget.sprite &&
            newTarget.sprite &&
            newTarget.isSprite() // ignore switching to stage
          ) {
            const oldFolder = getFolderFromName(oldTarget.sprite.name);
            const newFolder = getFolderFromName(newTarget.sprite.name);
            if (oldFolder !== newFolder && !this.state.folders.includes(newFolder)) {
              this.setState((prevState) => ({
                folders: [...prevState.folders, newFolder],
              }));
            }
          }
        }
      }
    };

    const originalSortableHOCRender = SortableHOC.prototype.render;
    SortableHOC.prototype.render = function () {
      const originalItems = this.props.items;
      Object.assign(this.props, processItems((this.state && this.state.folders) || [], this.props));
      if (type === TYPE_SPRITES) {
        currentSpriteItems = this.props.items;
      } else if (type === TYPE_ASSETS) {
        currentAssetItems = this.props.items;
      }
      const result = originalSortableHOCRender.call(this);
      this.props.items = originalItems;
      return result;
    };
  };

  const patchSpriteSelectorItem = (SpriteSelectorItem) => {
    // SpriteSelectorItem should be: https://github.com/LLK/scratch-gui/blob/29d9851778febe4e69fa5111bf7559160611e366/src/containers/sprite-selector-item.jsx#L16

    const closeContextMenu = () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { relatedTarget: document.body, bubbles: true }));
    };

    const createMenuItem = (text, callback, border) => {
      const el = document.createElement("div");
      el.className = addon.tab.scratchClass(
        "context-menu_menu-item",
        border ? "context-menu_menu-item-bordered" : null,
        {
          others: ["react-contextmenu-item", "sa-folders-contextmenu-item"],
        }
      );
      el.setAttribute("role", "menuitem");
      el.setAttribute("tabindex", "-1");
      el.setAttribute("aria-disabled", "false");
      el.textContent = text;
      el.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeContextMenu();
          callback();
        },
        true
      );
      return el;
    };

    const getAllFolders = (component) => {
      const result = new Set();
      let items;
      if (component.props.id) {
        items = currentSpriteItems;
      } else {
        items = currentAssetItems;
      }
      for (const item of items) {
        const data = getItemData(item);
        if (typeof data.folder === "string") {
          result.add(data.folder);
        }
      }
      return Array.from(result);
    };

    const addContextMenuItems = (component) => {
      const data = getItemData(component.props);
      if (!data) {
        return;
      }

      const menu = component.ref.querySelector("nav[role=menu]");
      if (!menu) {
        return;
      }

      let container = menu.querySelector(".sa-folders-contextmenu-container");
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      } else {
        container = document.createElement("div");
        container.className = "sa-folders-contextmenu-container";
        menu.appendChild(container);
      }

      const setFolder = (folder) => {
        if (component.props.id) {
          const target = vm.runtime.getTargetById(component.props.id);
          const targets = vm.runtime.targets.filter((i) => i !== target);

          let insertAt = targets.length;
          let found = false;
          for (let i = 0; i < targets.length; i++) {
            if (getFolderFromName(targets[i].getName()) === folder) {
              found = true;
              insertAt = i;
              break;
            }
          }

          targets.splice(insertAt, 0, target);
          vm.runtime.targets = targets;
          vm.renameSprite(component.props.id, setFolderOfName(target.getName(), folder));
        }
      };

      container.appendChild(
        createMenuItem(
          msg("create-folder"),
          () => {
            setFolder(data.realName);
          },
          true
        )
      );

      const currentFolder = data.inFolder;
      for (const folder of getAllFolders(component)) {
        if (folder !== currentFolder) {
          container.appendChild(
            createMenuItem(
              msg("add-to-folder", {
                folder,
              }),
              () => {
                setFolder(folder);
              }
            )
          );
        }
      }
    };

    const toggleFolder = (component, folder) => {
      const sortableHOCInstance = getSortableHOCFromElement(component.ref);
      sortableHOCInstance.setState((prevState) => {
        const existingFolders = (prevState && prevState.folders) || [];
        if (existingFolders.includes(folder)) {
          return {
            folders: existingFolders.filter((i) => i !== folder),
          };
        } else {
          return {
            folders: [...existingFolders, folder],
          };
        }
      });
    };

    const originalSpriteSelectorItemHandleClick = SpriteSelectorItem.prototype.handleClick;
    SpriteSelectorItem.prototype.handleClick = function (e) {
      if (!this.noClick) {
        const itemData = getItemData(this.props);
        if (itemData) {
          if (typeof itemData.folder === "string") {
            e.preventDefault();
            toggleFolder(this, itemData.folder);
            return;
          }
          if (typeof this.props.number === "number" && typeof itemData.realIndex === "number") {
            e.preventDefault();
            if (this.props.onClick) {
              this.props.onClick(itemData.realIndex);
            }
            return;
          }
        }
      }
      return originalSpriteSelectorItemHandleClick.call(this, e);
    };

    const originalSetRef = SpriteSelectorItem.prototype.setRef;
    SpriteSelectorItem.prototype.setRef = function (ref) {
      originalSetRef.call(this, ref);
      if (ref) {
        ref.elem.addEventListener("contextmenu", (e) => {
          addContextMenuItems(this);
        });
      }
    };

    const originalRender = SpriteSelectorItem.prototype.render;
    SpriteSelectorItem.prototype.render = function () {
      const itemData = getItemData(this.props);
      if (itemData) {
        const originalProps = this.props;
        this.props = {
          ...this.props,
        };

        if (typeof itemData.realName === "string") {
          this.props.name = itemData.realName;
        }
        if (typeof this.props.number === "number" && typeof itemData.realIndex === "number") {
          // Convert 0-indexed to 1-indexed
          this.props.number = itemData.realIndex + 1;
        }
        if (typeof itemData.folder === "string") {
          this.props.name = itemData.folder;
          if (itemData.folderOpen) {
            this.props.details = msg("open-folder");
          } else {
            this.props.details = msg("closed-folder");
          }
          this.props.onDeleteButtonClick = null;
          this.props.onDuplicateButtonClick = null;
          this.props.onExportButtonClick = null;
          this.props.onDeleteButtonClick = null;
          this.props.selected = false;
          this.props.number = null;
          this.props.className += ` ${getFolderColorClass(itemData.folder)}`;
        }
        if (typeof itemData.inFolder === "string") {
          this.props.className += ` ${getFolderColorClass(itemData.inFolder)}`;
        }

        const result = originalRender.call(this);

        this.props = originalProps;
        return result;
      }
      return originalRender.call(this);
    };
  };

  // Sprite list
  {
    const spriteSelectorItemElement = await addon.tab.waitForElement("[class*='sprite-selector_sprite-wrapper']");
    vm = addon.tab.traps.vm;
    reactInternalKey = Object.keys(spriteSelectorItemElement).find((i) => i.startsWith(REACT_INTERNAL_PREFIX));
    const sortableHOCInstance = getSortableHOCFromElement(spriteSelectorItemElement);
    const spriteSelectorItemInstance = spriteSelectorItemElement[reactInternalKey].child.child.child.stateNode;
    patchSortableHOC(sortableHOCInstance.constructor, TYPE_SPRITES);
    patchSpriteSelectorItem(spriteSelectorItemInstance.constructor);
    sortableHOCInstance.saInitialSetup();

    const originalInstallTargets = vm.installTargets;
    vm.installTargets = function (targets, extensions, wholeProject) {
      // TODO: this is broken
      if (currentSpriteFolder) {
        for (const target of targets) {
          if (target.sprite) {
            target.sprite.name = setFolderOfName(target.sprite.name, currentSpriteFolder);
          }
        }
      }
      return originalInstallTargets.call(this, targets, extensions, wholeProject);
    };

    vm.reorderTarget = function (targetIndex, newIndex) {
      targetIndex = clamp(targetIndex, 0, currentSpriteItems.length);
      newIndex = clamp(newIndex, 0, currentSpriteItems.length);
      if (targetIndex === newIndex) {
        return false;
      }

      let targets = this.runtime.targets;
      const originalTargets = this.runtime.targets;

      const targetItem = currentSpriteItems[targetIndex - 1];
      const itemAtNewIndex = currentSpriteItems[newIndex - 1];
      const targetItemData = getItemData(targetItem);
      const itemAtNewIndexData = getItemData(itemAtNewIndex);

      if (!targetItemData || !itemAtNewIndexData) {
        console.warn("should never happen");
        return false;
      }

      const reorderingItems = typeof targetItemData.folder === "string" ? targetItem.items : [targetItem];
      const reorderingTargets = reorderingItems.map((i) => vm.runtime.getTargetById(i.id)).filter((i) => i);
      if (itemAtNewIndex.id) {
        const newTarget = vm.runtime.getTargetById(itemAtNewIndex.id);
        if (!newTarget || reorderingTargets.includes(newTarget)) {
          // Dragging folder into itself or target doesn't exist. Ignore.
          return false;
        }
      }

      let newFolder = null;

      targets = targets.filter((i) => !reorderingTargets.includes(i));
      // Set targets immediately to fix getTargetById. This will be set again later.
      this.runtime.targets = targets;

      let realNewIndex;
      if (newIndex === 1) {
        realNewIndex = 1;
      } else if (newIndex === currentSpriteItems.length) {
        realNewIndex = targets.length;
      } else if (itemAtNewIndex.id) {
        newFolder = typeof itemAtNewIndexData.inFolder === "string" ? itemAtNewIndexData.inFolder : null;
        let newTarget = vm.runtime.getTargetById(itemAtNewIndex.id);
        if (!newTarget) {
          console.warn("should never happen");
          return false;
        }
        realNewIndex = targets.indexOf(newTarget);
        if (newIndex > targetIndex) {
          realNewIndex++;
        }
      } else if (typeof itemAtNewIndexData.folder === "string") {
        newFolder = itemAtNewIndexData.folder;
        let item;
        let offset = 0;
        if (typeof targetItemData.inFolder === "string" && targetItemData.inFolder === itemAtNewIndexData.folder) {
          // If an item in a folder is dropped onto its folder icon, move it out of the folder.
          item = itemAtNewIndex.items[0];
          newFolder = null;
        } else if (!itemAtNewIndexData.folderOpen && newIndex > targetIndex) {
          item = itemAtNewIndex.items[itemAtNewIndex.items.length - 1];
          offset = 1;
        } else {
          item = itemAtNewIndex.items[0];
        }
        let newTarget = vm.runtime.getTargetById(item.id);
        if (newTarget) {
          realNewIndex = targets.indexOf(newTarget) + offset;
        } else {
          // Edge case: Dragging the first item of a list on top of the folder item
          vm.runtime.targets = originalTargets;
          newTarget = vm.runtime.getTargetById(item.id);
          if (!newTarget) {
            console.warn("should never happen");
            return false;
          }
          realNewIndex = originalTargets.indexOf(newTarget) + offset;
        }
      } else {
        console.warn("should never happen");
        return false;
      }

      if (realNewIndex < 0 || realNewIndex > targets.length) {
        console.warn("should never happen");
        return false;
      }

      // Insert the sprites back and trigger update.
      targets.splice(realNewIndex, 0, ...reorderingTargets);
      this.runtime.targets = targets;
      this.emitTargetsUpdate();

      // If the folder has changed, update sprite names to match.
      if (typeof targetItemData.folder !== "string" && targetItemData.inFolder !== newFolder) {
        for (const target of reorderingTargets) {
          vm.renameSprite(target.id, setFolderOfName(target.getName(), newFolder));
        }
      }

      return true;
    };
  }

  // Costume and sound list
  {
    const selectorListItem = await addon.tab.waitForElement("[class*='selector_list-item']");
    const sortableHOCInstance = getSortableHOCFromElement(selectorListItem);
    patchSortableHOC(sortableHOCInstance.constructor, TYPE_ASSETS);
    sortableHOCInstance.saInitialSetup();
  }
}
