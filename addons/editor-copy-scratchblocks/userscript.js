export default async function ({ addon, console, msg }) {
  const Blockly = await addon.tab.traps.getBlockly();

  // Shape constants (fall back to scratch-blocks defaults if the build doesn't expose them).
  const OUTPUT_SHAPE_HEXAGONAL = Blockly.OUTPUT_SHAPE_HEXAGONAL ?? 1;
  const INPUT_VALUE = Blockly.INPUT_VALUE ?? 1;
  const NEXT_STATEMENT = Blockly.NEXT_STATEMENT ?? 3;

  // FieldImage src filename (without extension) -> scratchblocks icon name. The loop arrow on
  // repeat/forever is intentionally absent: scratchblocks doesn't render it.
  const ICONS = {
    "green-flag": "@greenFlag",
    "rotate-right": "@turnRight",
    "rotate-left": "@turnLeft",
  };

  // Shadow blocks whose value should render as a round number input "(...)" rather than text "[...]".
  // In the current Blockly their field is a FieldTextInput, so we key off the block type instead.
  const NUMERIC_SHADOWS = new Set([
    "math_number",
    "math_positive_number",
    "math_whole_number",
    "math_integer",
    "math_angle",
    "note",
  ]);

  const isField = (field, name) => Boolean(Blockly[name]) && field instanceof Blockly[name];

  // Escape characters that scratchblocks treats as syntax so literal text survives a round-trip.
  function escape(text) {
    return String(text ?? "").replace(/([\\()[\]{}<>])/g, "\\$1");
  }

  function getOutputShape(block) {
    if (typeof block.getOutputShape === "function") {
      try {
        return block.getOutputShape();
      } catch (e) {
        /* fall through */
      }
    }
    return undefined;
  }

  function wrapByShape(block, inner) {
    return getOutputShape(block) === OUTPUT_SHAPE_HEXAGONAL ? `<${inner}>` : `(${inner})`;
  }

  // Variable/list names that look like numbers (or are empty) would be parsed as literals, so they
  // need an explicit category tag to stay variables.
  function tagReporterName(name, category) {
    const trimmed = name.trim();
    const ambiguous = trimmed === "" || /^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed);
    return ambiguous ? `${escape(name)} :: ${category}` : escape(name);
  }

  function firstFieldText(block) {
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        return field.getText();
      }
    }
    return "";
  }

  function singleShadowField(block) {
    let found = null;
    for (const input of block.inputList) {
      if (input.connection) return null; // not a simple value shadow
      for (const field of input.fieldRow) {
        if (found) return null;
        found = field;
      }
    }
    return found;
  }

  // Render a block that is plugged into a value/boolean input slot.
  function renderInput(block, connection) {
    if (!block) {
      const shape = connection && typeof connection.getOutputShape === "function" && connection.getOutputShape();
      return shape === OUTPUT_SHAPE_HEXAGONAL ? "<>" : "()";
    }

    // Custom-block parameter placeholders carry their shape (reporter or boolean).
    if (block.type.startsWith("argument_reporter_")) {
      let inner = escape(firstFieldText(block));
      // Inside a definition body the parameter is a real (non-shadow) block; tag it so scratchblocks
      // colours it like a custom-block argument even without the matching "define".
      if (!block.isShadow()) inner += " :: custom-arg";
      return wrapByShape(block, inner);
    }

    if (block.type === "data_variable") return `(${tagReporterName(firstFieldText(block), "variables")})`;
    if (block.type === "data_listcontents") return `(${tagReporterName(firstFieldText(block), "list")})`;

    // A simple shadow with a single field: number, text, colour or a dropdown menu.
    if (block.isShadow()) {
      const field = singleShadowField(block);
      if (field) {
        if (block.type === "colour_picker") return `[${field.getValue ? field.getValue() : field.getText()}]`;
        if (NUMERIC_SHADOWS.has(block.type)) return `(${escape(field.getText())})`;
        if (isField(field, "FieldDropdown")) return `[${escape(field.getText())} v]`;
        return `[${escape(field.getText())}]`;
      }
    }

    // A real reporter or boolean block.
    return wrapByShape(block, renderInline(block));
  }

  // Append a label token, swallowing the leading space before standalone punctuation like "?".
  function appendLabel(acc, text) {
    if (/^[?!.,;:]+$/.test(text)) return acc.replace(/ $/, "") + text + " ";
    return acc + escape(text) + " ";
  }

  function renderFieldRow(acc, block, input) {
    for (const field of input.fieldRow) {
      if (isField(field, "FieldImage")) {
        const src = (field.getValue && field.getValue()) || field.src_ || "";
        const id = src
          .split("/")
          .pop()
          .replace(/\.[a-z]+$/i, "");
        if (ICONS[id]) acc += ICONS[id] + " ";
        continue;
      }
      // A dropdown/variable field directly on the block, e.g. "set [my var v] to" or "stop [all v]".
      if (isField(field, "FieldDropdown")) {
        acc += `[${escape(field.getText())} v] `;
        continue;
      }
      acc = appendLabel(acc, field.getText());
    }
    return acc;
  }

  // Render the inline content of a reporter/boolean (labels + value inputs, no substacks).
  function renderInline(block) {
    let text = "";
    for (const input of block.inputList) {
      text = renderFieldRow(text, block, input);
      if (input.connection && input.connection.type === INPUT_VALUE) {
        text += renderInput(input.connection.targetBlock(), input.connection) + " ";
      }
    }
    return text.trim();
  }

  function indent(text) {
    return text
      .split("\n")
      .map((line) => (line.length ? "  " + line : line))
      .join("\n");
  }

  // Render one stack block (no following blocks); may span multiple lines for C-blocks.
  function renderStatement(block, definedProcs) {
    if (block.type === "procedures_definition") {
      const proto = block.inputList?.[0]?.connection?.targetBlock();
      return proto ? "define " + renderInline(proto) : "define";
    }

    let text = "";
    let hasSubstack = false;
    for (const input of block.inputList) {
      text = renderFieldRow(text, block, input);
      const connection = input.connection;
      if (!connection) continue;
      if (connection.type === NEXT_STATEMENT) {
        hasSubstack = true;
        const child = connection.targetBlock();
        text = text.replace(/ +$/, "") + "\n";
        if (child) text += indent(renderStack(child, definedProcs)) + "\n";
      } else {
        text += renderInput(connection.targetBlock(), connection) + " ";
      }
    }

    text = text
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .join("\n");

    if (block.type === "procedures_call" && !definedProcs.has(getProcCode(block))) {
      text = text.trimEnd() + " :: custom";
    }
    if (hasSubstack) text += "end";
    return text;
  }

  // Render a stack starting at `block`, following the chain of next blocks.
  function renderStack(block, definedProcs) {
    const lines = [];
    let current = block;
    while (current) {
      lines.push(renderStatement(current, definedProcs));
      current = current.getNextBlock();
    }
    return lines.join("\n");
  }

  function getProcCode(block) {
    try {
      if (typeof block.getProcCode === "function") return block.getProcCode();
      if (block.procCode_) return block.procCode_;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  // Collect the proccodes of every custom block defined within the given roots, so that calls to
  // them don't get a redundant ":: custom" tag.
  function collectDefinedProcs(roots) {
    const procs = new Set();
    const visit = (block) => {
      if (!block) return;
      if (block.type === "procedures_prototype") {
        const code = getProcCode(block);
        if (code) procs.add(code);
      }
      for (const input of block.inputList || []) {
        if (input.connection) visit(input.connection.targetBlock());
      }
      visit(block.getNextBlock?.());
    };
    roots.forEach(visit);
    return procs;
  }

  function copy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch((e) => console.warn("Copy to clipboard failed", e));
  }

  function copyStack(block) {
    try {
      const definedProcs = collectDefinedProcs([block]);
      copy(renderStack(block, definedProcs).trim());
    } catch (e) {
      console.error("Failed to serialize block", e);
    }
  }

  function copyWorkspace() {
    try {
      const workspace = addon.tab.traps.getWorkspace();
      const topBlocks = workspace ? workspace.getTopBlocks(true) : [];
      const definedProcs = collectDefinedProcs(topBlocks);
      const parts = [];
      for (const block of topBlocks) {
        try {
          const serialized = renderStack(block, definedProcs).trim();
          if (serialized) parts.push(serialized);
        } catch (e) {
          console.error("Failed to serialize stack", block?.type, e);
        }
      }
      copy(parts.join("\n\n"));
    } catch (e) {
      console.error("Failed to serialize workspace", e);
    }
  }

  function hasBlocks() {
    try {
      const workspace = addon.tab.traps.getWorkspace();
      return Boolean(workspace && workspace.getTopBlocks(false).length);
    } catch (e) {
      return false;
    }
  }

  // "Copy as scratchblocks" on a single stack. createBlockContextMenu supports both the legacy and the
  // current (registry-based) Blockly, so this one entry covers every editor build.
  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled || !block) return items;
      const idx = items.findIndex((item) => item._isDevtoolsFirstItem);
      const at = idx === -1 ? items.length : idx;
      items.splice(at, 0, { separator: true });
      items.splice(at + 1, 0, {
        enabled: true,
        text: msg("copy"),
        callback: () => copyStack(block),
      });
      return items;
    },
    { blocks: true }
  );

  // "Copy all as scratchblocks" on the workspace background. The Scratch Addons API only injects
  // workspace items on legacy Blockly, so on the current build we register through Blockly's own
  // ContextMenuRegistry instead.
  if (Blockly.registry) {
    const id = "sa-editor-copy-scratchblocks-all";
    try {
      const registry = Blockly.ContextMenuRegistry.registry;
      if (!registry.getItem || !registry.getItem(id)) {
        registry.register({
          id,
          weight: 100,
          scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
          displayText: () => msg("copyAll"),
          preconditionFn: () => (addon.self.disabled ? "hidden" : hasBlocks() ? "enabled" : "disabled"),
          callback: () => copyWorkspace(),
        });
      }
    } catch (e) {
      console.error("Failed to register workspace context menu item", e);
    }
  } else {
    addon.tab.createBlockContextMenu(
      (items) => {
        if (addon.self.disabled) return items;
        const idx = items.findIndex((item) => item._isDevtoolsFirstItem);
        const at = idx === -1 ? items.length : idx;
        items.splice(at, 0, { separator: true });
        items.splice(at + 1, 0, {
          enabled: hasBlocks(),
          text: msg("copyAll"),
          callback: () => copyWorkspace(),
        });
        return items;
      },
      { workspace: true }
    );
  }
}
