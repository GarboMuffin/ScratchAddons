export default async function ({ addon, global, console, msg }) {
  const REACT_INTERNAL_PREFIX = "__reactInternalInstance$";
  const ID_PREFIX = "sa_";
  const ID_FOLDER_PREFIX = `${ID_PREFIX}folder_folder_`;
  const ID_BACK = `${ID_PREFIX}folder_back`;

  const TYPE_SPRITES = 1;
  const TYPE_ASSETS = 2;

  const leaveFolderAsset = {
    encodeDataURI() {
      return addon.self.dir + "/leave-folder.svg";
    },
  };

  let reactInternalKey;

  const getFolderFromName = (name) => {
    const idx = name.indexOf("/");
    if (idx === -1) {
      return null;
    }
    return name.substr(0, idx);
  };

  const getNameWithoutFolder = (name) => {
    const idx = name.indexOf("/");
    if (idx === -1) {
      return name;
    }
    return name.substr(idx + 1);
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

  const patchSortableHOC = (SortableHOC, type) => {
    const processItems = (folderName, propItems) => {
      console.log(propItems);
      const items = [];

      if (folderName) {
        const leaveFolderItem = {
          asset: leaveFolderAsset,
        };
        if (type === TYPE_SPRITES) {
          leaveFolderItem.name = msg("leave-folder");
          leaveFolderItem.id = ID_BACK;
        } else {
          leaveFolderItem.name = ID_BACK;
          leaveFolderItem.details = ID_BACK;
        }
        items.push(leaveFolderItem);

        for (const item of propItems) {
          const itemFolder = getFolderFromName(item.name);
          if (itemFolder === folderName) {
            items.push({
              ...item,
              name: getNameWithoutFolder(item.name),
            });
          }
        }
      } else {
        const folderItems = {};
        for (const item of propItems) {
          const itemFolder = getFolderFromName(item.name);
          if (itemFolder) {
            if (!folderItems[itemFolder]) {
              const folderItem = {};
              if (type === TYPE_SPRITES) {
                folderItem.name = `[F] ${itemFolder}`;
                folderItem.id = `${ID_FOLDER_PREFIX}${itemFolder}`;

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '32');
                svg.setAttribute('height', '32');
                debugger;
                const sameItems = propItems
                  .filter(i => getFolderFromName(i.name) === itemFolder);
                const POSITIONS = [
                  // x, y
                  [0, 0],
                  [16, 0],
                  [0, 16],
                  [16, 16]
                ];

                for (let i = 0; i < Math.min(POSITIONS.length, sameItems.length); i++) {
                  const thisItem = sameItems[i];
                  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                  image.setAttribute('width', '16');
                  image.setAttribute('height', '16');
                  image.setAttribute('x', POSITIONS[i][0]);
                  image.setAttribute('y', POSITIONS[i][1]);
                  image.setAttribute('href', thisItem.costume.asset.encodeDataURI());
                  svg.appendChild(image);
                }

                folderItem.costume = {
                  asset: {
                    assetId: Math.random(), // TODO
                    encodeDataURI() {
                      return 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
                    }
                  }
                };
              } else {
                folderItem.name = `${ID_FOLDER_PREFIX}${itemFolder}`;
                folderItem.details = `${ID_FOLDER_PREFIX}${itemFolder}`;
                folderItem.asset = item.asset;
              }
              folderItems[itemFolder] = folderItem;
              items.push(folderItem);
            }
          } else {
            items.push(item);
          }
        }
      }

      for (const item of items) {
        if (item.asset) {
          item.costume = {
            asset: item.asset,
          };
        }
      }

      return items;
    };

    // const originalGetOrdering = SortableHOC.prototype.getOrdering;
    // SortableHOC.prototype.getOrdering = function (items, draggingIndex, newIndex) {
    //   const result = originalGetOrdering.call(this, items, draggingIndex, newIndex);
    //   return result;
    // };

    SortableHOC.prototype.componentDidMount = function () {
      this.setState({
        items: processItems(null, this.props.items),
      });
    };

    SortableHOC.prototype.componentDidUpdate = function (prevProps, prevState) {
      const folder = this.state ? this.state.folder : null;
      if (!prevState || prevState.folder !== folder || prevProps.items !== this.props.items) {
        this.setState({
          items: processItems(folder, this.props.items),
        });
      }
    };

    const originalSortableHOCRender = SortableHOC.prototype.render;
    SortableHOC.prototype.render = function () {
      if (!this.state) {
        // TODO: remove?
        return originalSortableHOCRender.call(this);
      }

      const originalItems = this.props.items;
      this.props.items = this.state.items;
      const result = originalSortableHOCRender.call(this);
      this.props.items = originalItems;
      return result;
    };
  };

  const patchSpriteSelectorItem = (SpriteSelectorItem) => {
    const setFolder = (component, folder) => {
      const sortableHOCInstance = getSortableHOCFromElement(component.ref);
      sortableHOCInstance.setState({
        folder,
      });
    };

    const originalSpriteSelectorItemHandleClick = SpriteSelectorItem.prototype.handleClick;
    SpriteSelectorItem.prototype.handleClick = function (e) {
      if (!this.noClick) {
        const id = this.props.id || this.props.details;
        if (typeof id === "string") {
          if (id === ID_BACK) {
            e.preventDefault();
            setFolder(this, null);
            return;
          }
          if (id.startsWith(ID_FOLDER_PREFIX)) {
            e.preventDefault();
            setFolder(this, id.substr(ID_FOLDER_PREFIX.length));
            return;
          }
        }
      }
      originalSpriteSelectorItemHandleClick.call(this, e);
    };

    const originalRender = SpriteSelectorItem.prototype.render;
    SpriteSelectorItem.prototype.render = function () {
      if (typeof this.props.details === "string" && this.props.details.startsWith(ID_PREFIX)) {
        const details = this.props.details;
        const name = this.props.name;
        this.props.details = "";
        if (this.props.name === ID_BACK) {
          this.props.name = msg("leave-folder");
        } else {
          this.props.name = `[F] ${name.substr(ID_FOLDER_PREFIX.length)}`;
        }
        const result = originalRender.call(this);
        this.props.details = details;
        this.props.name = name;
        return result;
      }
      return originalRender.call(this);
    };
  };

  // Sprite list
  {
    const spriteSelectorItemElement = await addon.tab.waitForElement("[class*='sprite-selector_sprite-wrapper']");
    reactInternalKey = Object.keys(spriteSelectorItemElement).find((i) => i.startsWith(REACT_INTERNAL_PREFIX));
    const sortableHOCInstance = getSortableHOCFromElement(spriteSelectorItemElement);
    const spriteSelectorItemInstance = spriteSelectorItemElement[reactInternalKey].child.child.child.stateNode;
    patchSortableHOC(sortableHOCInstance.constructor, TYPE_SPRITES);
    patchSpriteSelectorItem(spriteSelectorItemInstance.constructor);
    sortableHOCInstance.forceUpdate();
  }

  // Costume and sound list
  {
    const selectorListItem = await addon.tab.waitForElement("[class*='selector_list-item']");
    const sortableHOCInstance = getSortableHOCFromElement(selectorListItem);
    patchSortableHOC(sortableHOCInstance.constructor, TYPE_ASSETS);
    sortableHOCInstance.forceUpdate();
  }
}
