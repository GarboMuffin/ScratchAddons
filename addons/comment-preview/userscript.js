// Scratch comment emoji (the underscore-delimited codes the website turns into images).
// Maps the code typed in a comment to the emoji's image file name.
const EMOJI = {
  _meow_: "meow",
  _gobo_: "gobo",
  "_:)_": "cat",
  "_:D_": "aww-cat",
  "_B)_": "cool-cat",
  "_:P_": "tongue-out-cat",
  "_;P_": "wink-cat",
  "_:'P_": "lol-cat",
  "_P:_": "upside-down-cat",
  "_:3_": "huh-cat",
  "_<3_": "love-it-cat",
  "_**_": "fav-it-cat",
  "_:))_": "rainbow-cat",
  "_:D<_": "pizza-cat",
  _10mil_: "10mil",
  _waffle_: "waffle",
  _taco_: "taco",
  _sushi_: "sushi",
  _apple_: "apple",
  _broccoli_: "broccoli",
  _pizza_: "pizza",
  _candycorn_: "candycorn",
  _map_: "map",
  _camera_: "camera",
  _suitcase_: "suitcase",
  _compass_: "compass",
  _binoculars_: "binoculars",
  _cupcake_: "cupcake",
  _pride_: "pride",
  _blm_: "blm",
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHTML = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default async function ({ addon, console, msg }) {
  // scratch-www serves the small "/images/emoji" files; scratchr2 (profiles) serves the easter_eggs files.
  const isWww = addon.tab.clientVersion === "scratch-www";
  const emojiBase = isWww
    ? "https://scratch.mit.edu/images/emoji/"
    : "https://cdn.scratch.mit.edu/scratchr2/static/images/easter_eggs/";
  const emojiClass = isWww ? "emoji" : "easter-egg";

  // Build one regex that matches an emoji code, a URL, or an @mention. Emoji codes are matched
  // longest-first so e.g. "_:))_" wins over "_:)_".
  const emojiAlternation = Object.keys(EMOJI)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const tokenRegex = new RegExp(`(${emojiAlternation})|(https?:\\/\\/[^\\s]+)|(@[\\w-]+)`, "g");

  function renderPreview(text) {
    let out = "";
    let lastIndex = 0;
    let match;
    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(text))) {
      out += escapeHTML(text.slice(lastIndex, match.index));
      const [, emojiCode, url, mention] = match;
      if (emojiCode) {
        const name = EMOJI[emojiCode];
        out +=
          `<img class="${emojiClass} sa-comment-preview-emoji" src="${emojiBase}${name}.png" ` +
          `data-sa-emoji="${name}" alt="${escapeHTML(emojiCode)}" title="${escapeHTML(emojiCode)}">`;
      } else if (url) {
        // Trailing punctuation usually isn't part of the link.
        const trimmed = url.replace(/[.,!?)\]]+$/, "");
        const tail = url.slice(trimmed.length);
        out += `<a href="${escapeHTML(trimmed)}" target="_blank" rel="noreferrer">${escapeHTML(trimmed)}</a>${escapeHTML(tail)}`;
      } else if (mention) {
        const username = mention.slice(1);
        out += `<a href="/users/${encodeURIComponent(username)}/">${escapeHTML(mention)}</a>`;
      }
      lastIndex = tokenRegex.lastIndex;
    }
    out += escapeHTML(text.slice(lastIndex));
    return out.replace(/\n/g, "<br>");
  }

  // Attach a Write/Preview toggle + preview panel to a single comment-composer textarea.
  function attachTo(textarea) {
    if (textarea.dataset.saCommentPreview) return;
    textarea.dataset.saCommentPreview = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "sa-comment-preview-tabs";
    const writeTab = document.createElement("button");
    writeTab.type = "button";
    writeTab.className = "sa-comment-preview-tab sa-comment-preview-active";
    writeTab.textContent = msg("write");
    const previewTab = document.createElement("button");
    previewTab.type = "button";
    previewTab.className = "sa-comment-preview-tab";
    previewTab.textContent = msg("preview");
    wrapper.append(writeTab, previewTab);

    const panel = document.createElement("div");
    panel.className = "sa-comment-preview-panel";
    panel.hidden = true;

    textarea.insertAdjacentElement("beforebegin", wrapper);
    textarea.insertAdjacentElement("afterend", panel);

    const showPreview = (show) => {
      panel.hidden = !show;
      textarea.style.display = show ? "none" : "";
      writeTab.classList.toggle("sa-comment-preview-active", !show);
      previewTab.classList.toggle("sa-comment-preview-active", show);
      if (show) {
        const value = textarea.value.trim();
        panel.innerHTML = value ? renderPreview(textarea.value) : "";
        panel.classList.toggle("sa-comment-preview-empty", !value);
        if (!value) panel.textContent = msg("nothing");
      }
    };
    writeTab.addEventListener("click", () => showPreview(false));
    previewTab.addEventListener("click", () => showPreview(true));
    // Keep the preview live while it's open.
    textarea.addEventListener("input", () => {
      if (!panel.hidden) showPreview(true);
    });
  }

  while (true) {
    const textarea = await addon.tab.waitForElement(
      isWww
        ? "textarea[id*='compose-comment'], textarea[name='compose-comment']"
        : "form#main-post-form textarea[name='content']",
      { markAsSeen: true }
    );
    attachTo(textarea);
  }
}
