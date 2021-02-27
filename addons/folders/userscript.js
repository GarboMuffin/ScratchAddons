export default async function ({ addon, global, console, msg }) {
  // The basic premise of how this addon works is relative simple.
  // scratch-gui renders the sprite selectors and asset selectors in a hierarchy like this:
  // <SelectorHOC>
  //   <SpriteSelectorItem />
  //   <SpriteSelectorItem />
  //   <SpriteSelectorItem />
  //   <SpriteSelectorItem />
  //   ...
  // </SelectorHOC>
  // It's obviously more complicated than that, but there are two important parts:
  // SelectorHOC - We override this to change which items are displayed
  // SpriteSelectorItem - We override this to change how items are displayed.
  //    Folders are just items rendered differently
  // These two components communicate through the `name` property of the items.
  // We touch some things on the VM to make dragging items work properly.

  const REACT_INTERNAL_PREFIX = "__reactInternalInstance$";

  const SVG_NS = "http://www.w3.org/2000/svg";

  const TYPE_SPRITES = 1;
  const TYPE_ASSETS = 2;

  // We run too early, will be set later
  let vm;

  let reactInternalKey;

  let currentSpriteFolder;
  let currentAssetFolder;

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

  const untilInEditor = () => {
    if (addon.tab.editorMode === "editor") return;
    return new Promise((resolve, reject) => {
      const handler = () => {
        if (addon.tab.editorMode === "editor") {
          resolve();
          addon.tab.removeEventListener("urlChange", handler);
        }
      };
      addon.tab.addEventListener("urlChange", handler);
    });
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

  /**
   * @typedef {Object} ItemData
   * @property {string} realName
   * @property {number} realIndex
   * @property {string} inFolder
   * @property {string} folder
   * @property {boolean} folderOpen
   */

  /**
   * @returns {ItemData|null}
   */
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

  // https://github.com/LLK/scratch-gui/blob/develop/src/components/asset-panel/icon--sound.svg
  const imageIconSource = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100px" height="100px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g id="Sound" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <path d="M12.4785058,12.6666667 C12.3144947,12.6666667 12.1458852,12.6272044 11.9926038,12.5440517 C11.537358,12.2960031 11.3856094,11.7562156 11.6553847,11.3376335 C12.1688774,10.5371131 12.1688774,9.54491867 11.6553847,8.74580756 C11.3856094,8.32581618 11.537358,7.78602861 11.9926038,7.53798001 C12.452448,7.29275014 13.0379829,7.43086811 13.3046926,7.84804076 C14.1737981,9.20103311 14.1737981,10.8809986 13.3046926,12.233991 C13.1268862,12.5130457 12.806528,12.6666667 12.4785058,12.6666667 Z M15.3806784,13.8333333 C15.2408902,13.8333333 15.0958763,13.796281 14.9665396,13.7182064 C14.5785295,13.485306 14.4491928,12.9784829 14.6791247,12.5854634 C15.5949331,11.0160321 15.5949331,9.065491 14.6791247,7.49738299 C14.4491928,7.10436352 14.5785295,6.59621712 14.9665396,6.36331669 C15.3558562,6.13438616 15.8549129,6.26274605 16.0848448,6.65444223 C17.3050517,8.74260632 17.3050517,11.3389168 16.0848448,13.4270809 C15.9319924,13.6890939 15.6602547,13.8333333 15.3806784,13.8333333 Z M10.3043478,5.62501557 L10.3043478,13.873675 C10.3043478,14.850934 9.10969849,15.3625101 8.36478311,14.7038052 L6.7566013,13.2797607 C6.18712394,12.7762834 5.44499329,12.4968737 4.67362297,12.4968737 L4.3923652,12.4968737 C3.62377961,12.4968737 3,11.8935108 3,11.1470686 L3,8.36646989 C3,7.62137743 3.62377961,7.01666471 4.3923652,7.01666471 L4.65830695,7.01666471 C5.42967727,7.01666471 6.17180792,6.73725504 6.74128529,6.23377771 L8.36478311,4.79623519 C9.10969849,4.13753026 10.3043478,4.64910643 10.3043478,5.62501557 Z" id="Combined-Shape" fill="#575E75"></path>
    </g>
</svg>`;
  const soundIconHref = `data:image/svg+xml;base64,${btoa(imageIconSource)}`;

  let folderColorStylesheet = null;
  const folderColors = Object.create(null);
  const getFolderColorClass = (folderName) => {
    const mulberry32 = (a) => {
      // https://stackoverflow.com/a/47593316
      return function () {
        var t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const hashCode = (str) => {
      // Based on Java's String.hashCode
      // https://hg.openjdk.java.net/jdk8/jdk8/jdk/file/687fd7c7986d/src/share/classes/java/lang/String.java#l1452
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = 31 * hash + str.charCodeAt(i);
        hash = hash | 0;
      }
      return hash;
    };

    const random = (str) => {
      const seed = hashCode(str);
      return mulberry32(seed)();
    };

    if (!folderColors[folderName]) {
      if (!folderColorStylesheet) {
        folderColorStylesheet = document.createElement("style");
        document.head.appendChild(folderColorStylesheet);
      }
      const color = `hsla(${random(folderName) * 360}deg, 100%, 85%, 0.5)`;
      const id = Object.keys(folderColors).length;
      const className = `sa-folders-color-${id}`;
      folderColors[folderName] = className;
      folderColorStylesheet.textContent += `.${className} { background-color: ${color} !important; }\n`;
    }
    return folderColors[folderName];
  };

  const fixOrderOfItemsInFolders = (items) => {
    const folders = Object.create(null);
    const result = [];
    for (const item of items) {
      const name = item.getName ? item.getName() : item.name;
      const folder = getFolderFromName(name);
      if (typeof folder === "string") {
        if (!folders[folder]) {
          folders[folder] = [];
          result.push(folders[folder]);
        }
        folders[folder].push(item);
      } else {
        result.push(item);
      }
    }
    return result.flat();
  };

  const fixTargetOrder = () => {
    vm.runtime.targets = fixOrderOfItemsInFolders(vm.runtime.targets);
    vm.emitTargetsUpdate();
  };

  const fixCostumeOrder = () => {
    vm.editingTarget.sprite.costumes = fixOrderOfItemsInFolders(vm.editingTarget.sprite.costumes);
  };

  const fixSoundOrder = () => {
    vm.editingTarget.sprite.sounds = fixOrderOfItemsInFolders(vm.editingTarget.sprite.sounds);
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
        } else if (item.url) {
          image.setAttribute("href", soundIconHref);
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
          details: item.details,
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

    const getSelectedItem = (sortable) => {
      if (type === TYPE_SPRITES) {
        const selectedItem = sortable.props.items.find(i => i.id === sortable.props.selectedId);
        return selectedItem;
      } else if (type === TYPE_ASSETS) {
        const selectedItem = sortable.props.items[sortable.props.selectedItemIndex];
        return selectedItem;
      }
      return null;
    };

    SortableHOC.prototype.saInitialSetup = function () {
      const folders = [];
      const selectedItem = getSelectedItem(this);
      if (selectedItem && !selectedItem.isStage) {
        const folder = getFolderFromName(selectedItem.name);
        folders.push(folder);
        if (type === TYPE_SPRITES) {
          currentSpriteFolder = folder;
        } else if (type === TYPE_ASSETS) {
          currentAssetFolder = folder;
        }
      }
      this.setState({
        folders,
      });
    };

    SortableHOC.prototype.componentDidMount = function () {
      // Do part of componentDidUpdate on mount as well
      const selectedItem = getSelectedItem(this);
      if (selectedItem) {        
        const folder = getFolderFromName(selectedItem.name);
        if (type === TYPE_SPRITES) {
          currentSpriteFolder = folder;
        } else if (type === TYPE_ASSETS) {
          currentAssetFolder = folder;
        }
      }
      this.saInitialSetup();
    };

    SortableHOC.prototype.componentDidUpdate = function (prevProps, prevState) {
      // When the selected item has changed, open its folder.
      if (this.props.selectedId !== prevProps.selectedId || this.props.selectedItemIndex !== prevProps.selectedItemIndex) {
        const selectedItem = getSelectedItem(this);
        if (selectedItem) {
          const folder = getFolderFromName(selectedItem.name);
          if (type === TYPE_SPRITES) {
            currentSpriteFolder = folder;
          } else if (type === TYPE_ASSETS) {
            currentAssetFolder = folder;
          }
          if (!selectedItem.isStage) {
            if (typeof newFolder === "string" && !this.state.folders.includes(newFolder)) {
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
      const originalProps = this.props;
      this.props = {
        ...this.props,
        ...processItems((this.state && this.state.folders) || [], this.props)
      };
      if (type === TYPE_SPRITES) {
        currentSpriteItems = this.props.items;
      } else if (type === TYPE_ASSETS) {
        currentAssetItems = this.props.items;
      }
      const result = originalSortableHOCRender.call(this);
      this.props = originalProps;
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
      if (component.props.dragType === "SPRITE") {
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

      if (typeof data.folder === "string") {
        for (const child of menu.children) {
          if (child !== container) {
            child.style.display = "none";
          }
        }

        const renameItems = (newName) => {
          if (component.props.dragType === "SPRITE") {
            for (const target of vm.runtime.targets) {
              if (target.isOriginal) {
                if (getFolderFromName(target.getName()) === data.folder) {
                  vm.renameSprite(target.id, setFolderOfName(target.getName(), newName));
                }
              }
            }
            fixTargetOrder();
          } else if (component.props.dragType === "COSTUME") {
            for (let i = 0; i < vm.editingTarget.sprite.costumes.length; i++) {
              const costume = vm.editingTarget.sprite.costumes[i];
              if (getFolderFromName(costume.name) === data.folder) {
                vm.renameCostume(i, setFolderOfName(costume.name, newName));
              }
            }
            fixCostumeOrder();
          } else if (component.props.dragType === "SOUND") {
            for (let i = 0; i < vm.editingTarget.sprite.sounds.length; i++) {
              const sound = vm.editingTarget.sprite.sounds[i];
              if (getFolderFromName(sound.name) === data.folder) {
                vm.renameSound(i, setFolderOfName(sound.name, newName));
              }
            }
            fixSoundOrder();
          }
        };

        const renameFolder = () => {
          let newName = prompt(msg("rename-folder-prompt"));
          // Prompt cancelled, do not rename
          if (newName === null) {
            return;
          }
          // Empty name will remove the folder
          if (!newName) {
            newName = null;
          }
          renameItems(newName);
        };

        const removeFolder = () => {
          renameItems(null);
        };

        container.appendChild(createMenuItem(msg("rename-folder"), renameFolder));
        container.appendChild(createMenuItem(msg("remove-folder"), removeFolder));
      } else {
        const setFolder = (folder) => {
          if (component.props.dragType === "SPRITE") {
            const target = vm.runtime.getTargetById(component.props.id);
            const targets = vm.runtime.targets.filter((i) => i !== target);

            let insertAt = vm.runtime.targets.indexOf(target);
            for (let i = 0; i < targets.length; i++) {
              if (getFolderFromName(targets[i].getName()) === folder) {
                insertAt = i;
                break;
              }
            }

            targets.splice(insertAt, 0, target);
            vm.runtime.targets = targets;
            vm.renameSprite(component.props.id, setFolderOfName(target.getName(), folder));
          } else if (component.props.dragType === "COSTUME") {
            const data = getItemData(component.props);
            const index = data.realIndex;
            const asset = vm.editingTarget.sprite.costumes[index];
            const assets = vm.editingTarget.sprite.costumes.filter((i) => i !== asset);

            let insertAt = index;
            for (let i = 0; i < assets.length; i++) {
              if (getFolderFromName(assets[i].name) === folder) {
                insertAt = i;
                break;
              }
            }

            assets.splice(insertAt, 0, asset);
            vm.editingTarget.sprite.costumes = assets;
            vm.renameCostume(vm.editingTarget.sprite.costumes.indexOf(asset), setFolderOfName(asset.name, folder));
          } else if (component.props.dragType === "SOUND") {
            const data = getItemData(component.props);
            const index = data.realIndex;
            const asset = vm.editingTarget.sprite.sounds[index];
            const assets = vm.editingTarget.sprite.sounds.filter((i) => i !== asset);

            let insertAt = index;
            for (let i = 0; i < assets.length; i++) {
              if (getFolderFromName(assets[i].name) === folder) {
                insertAt = i;
                break;
              }
            }

            assets.splice(insertAt, 0, asset);
            vm.editingTarget.sprite.sounds = assets;
            vm.renameSound(vm.editingTarget.sprite.sounds.indexOf(asset), setFolderOfName(asset.name, folder));
          }
        };

        const createFolder = () => {
          const name = prompt(msg("name-prompt"), data.realName);
          if (name === null) {
            return;
          }
          setFolder(name);
        };

        container.appendChild(createMenuItem(msg("create-folder"), createFolder, true));

        const currentFolder = data.inFolder;
        if (typeof currentFolder === "string") {
          container.appendChild(createMenuItem("remove from folder", () => setFolder(null)));
        }
        for (const folder of getAllFolders(component)) {
          if (folder !== currentFolder) {
            container.appendChild(
              createMenuItem(
                msg("add-to-folder", {
                  folder,
                }),
                () => setFolder(folder)
              )
            );
          }
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
          this.props.name = getNameWithoutFolder(itemData.realName);
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

  await untilInEditor();

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
    vm.installTargets = function (...args) {
      if (currentSpriteFolder !== null) {
        const targets = args[0];
        if (Array.isArray(targets)) {
          for (const target of targets) {
            if (target.sprite) {
              target.sprite.name = setFolderOfName(target.sprite.name, currentSpriteFolder);
            }
          }
        }
      }
      return originalInstallTargets.call(this, ...args).then((r) => {
        fixTargetOrder();
        return r;
      });
    };

    const originalAddCostume = vm.addCostume;
    vm.addCostume = function (...args) {
      if (currentAssetFolder !== null) {
        const costume = args[1];
        if (costume) {
          costume.name = setFolderOfName(costume.name, currentAssetFolder);
        }
      }
      return originalAddCostume.call(this, ...args).then((r) => {
        fixCostumeOrder();
        return r;
      });
    };

    const originalAddSound = vm.addSound;
    vm.addSound = function (...args) {
      if (currentAssetFolder !== null) {
        const sound = args[0];
        if (sound) {
          sound.name = setFolderOfName(sound.name, currentAssetFolder);
        }
      }
      return originalAddSound.call(this, ...args).then((r) => {
        fixSoundOrder();
        return r;
      });
    };

    const abstractReorder = (
      { guiItems, getAll, set, rename, getVMItemFromGUIItem, zeroIndexed },
      costumeIndex,
      newIndex
    ) => {
      costumeIndex = clamp(costumeIndex, 0, guiItems.length);
      newIndex = clamp(newIndex, 0, guiItems.length);
      if (costumeIndex === newIndex) {
        return false;
      }

      let costumes = getAll();
      const originalCostumes = getAll();

      const targetItem = guiItems[costumeIndex - (zeroIndexed ? 0 : 1)];
      const itemAtNewIndex = guiItems[newIndex - (zeroIndexed ? 0 : 1)];
      const targetItemData = getItemData(targetItem);
      const itemAtNewIndexData = getItemData(itemAtNewIndex);

      if (!targetItemData || !itemAtNewIndexData) {
        console.warn("should never happen");
        return false;
      }

      const reorderingItems = typeof targetItemData.folder === "string" ? targetItem.items : [targetItem];
      const reorderingAssets = reorderingItems.map((i) => getVMItemFromGUIItem(i, costumes)).filter((i) => i);
      if (typeof itemAtNewIndexData.realIndex === "number") {
        const newTarget = getVMItemFromGUIItem(itemAtNewIndex, costumes);
        if (!newTarget || reorderingAssets.includes(newTarget)) {
          // Dragging folder into itself or target doesn't exist. Ignore.
          return false;
        }
      }

      let newFolder = null;

      costumes = costumes.filter((i) => !reorderingAssets.includes(i));

      let realNewIndex;
      if (newIndex === (zeroIndexed ? 0 : 1)) {
        realNewIndex = zeroIndexed ? 0 : 1;
      } else if (newIndex === guiItems.length - (zeroIndexed ? 1 : 0)) {
        realNewIndex = costumes.length;
      } else if (typeof itemAtNewIndexData.realIndex === "number") {
        newFolder = typeof itemAtNewIndexData.inFolder === "string" ? itemAtNewIndexData.inFolder : null;
        let newAsset = getVMItemFromGUIItem(itemAtNewIndex, costumes);
        if (!newAsset) {
          console.warn("should never happen");
          return false;
        }
        realNewIndex = costumes.indexOf(newAsset);
        if (newIndex > costumeIndex) {
          realNewIndex++;
        }
      } else if (typeof itemAtNewIndexData.folder === "string") {
        let item;
        let offset = 0;
        if (newIndex < costumeIndex) {
          // A B [C D E] F G
          //    ^----------*
          // A B C [D] E F G
          //      ^--------*
          item = itemAtNewIndex.items[0];
        } else if (itemAtNewIndexData.folderOpen) {
          // A B [C D E] F G
          //   *---^
          item = itemAtNewIndex.items[0];
          newFolder = itemAtNewIndexData.folder;
        } else {
          // A B [C] D E F G
          //   *----^
          item = itemAtNewIndex.items[itemAtNewIndex.items.length - 1];
          offset = 1;
        }
        let newAsset = getVMItemFromGUIItem(item, costumes);
        if (newAsset) {
          realNewIndex = costumes.indexOf(newAsset) + offset;
        } else {
          // Edge case: Dragging the first item of a list on top of the folder item
          // A B [C D E] F G
          //    ^---*
          newAsset = getVMItemFromGUIItem(item, originalCostumes);
          if (!newAsset) {
            console.warn("should never happen");
            return false;
          }
          realNewIndex = originalCostumes.indexOf(newAsset) + offset;
        }
      } else {
        console.warn("should never happen");
        return false;
      }

      if (typeof targetItemData.folder === "string" && newFolder !== null) {
        // Cannot drag a folder into another folder
        return;
      }

      if (realNewIndex < 0 || realNewIndex > costumes.length) {
        console.warn("should never happen");
        return false;
      }

      costumes.splice(realNewIndex, 0, ...reorderingAssets);
      set(costumes);

      // If the folder has changed, update sprite names to match.
      if (typeof targetItemData.folder !== "string" && targetItemData.inFolder !== newFolder) {
        for (const asset of reorderingAssets) {
          const name = asset.getName ? asset.getName() : asset.name;
          rename(asset, setFolderOfName(name, newFolder));
        }
      }

      return true;
    };

    vm.constructor.prototype.reorderTarget = function (targetIndex, newIndex) {
      return abstractReorder(
        {
          getAll: () => {
            return this.runtime.targets;
          },
          set: (targets) => {
            this.runtime.targets = targets;
            this.emitTargetsUpdate();
          },
          rename: (item, name) => {
            this.renameSprite(item.id, name);
          },
          getVMItemFromGUIItem: (item, targets) => {
            return targets.find((i) => i.id === item.id);
          },
          guiItems: currentSpriteItems,
          zeroIndexed: false,
        },
        targetIndex,
        newIndex
      );
    };

    vm.runtime.targets[0].constructor.prototype.reorderCostume = function (costumeIndex, newIndex) {
      return abstractReorder(
        {
          getAll: () => {
            return this.sprite.costumes;
          },
          set: (assets) => {
            this.sprite.costumes = assets;
          },
          rename: (item, name) => {
            this.renameCostume(this.sprite.costumes.indexOf(item), name);
          },
          getVMItemFromGUIItem: (item, costumes) => {
            const itemData = getItemData(item);
            return costumes.find((c) => c.name === itemData.realName);
          },
          guiItems: currentAssetItems,
          zeroIndexed: true,
        },
        costumeIndex,
        newIndex
      );
    };

    vm.runtime.targets[0].constructor.prototype.reorderSound = function (soundIndex, newIndex) {
      return abstractReorder(
        {
          getAll: () => {
            return this.sprite.sounds;
          },
          set: (assets) => {
            this.sprite.sounds = assets;
          },
          rename: (item, name) => {
            this.renameSound(this.sprite.sounds.indexOf(item), name);
          },
          getVMItemFromGUIItem: (item, sounds) => {
            const itemData = getItemData(item);
            return sounds.find((c) => c.name === itemData.realName);
          },
          guiItems: currentAssetItems,
          zeroIndexed: true,
        },
        soundIndex,
        newIndex
      );
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
