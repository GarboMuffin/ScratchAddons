export default async function ({ addon, console, msg }) {
  // Map each homepage row to the setting that hides it. Rows are matched by their
  // *structure*, not their (localized) title, so this keeps working in every language.
  // See scratch-www src/views/splash/presentation.jsx for the source of these rows.

  const PROCESSED = "sa-homepage-row";

  // Returns the row id for a built-in homepage ".box", or null if we don't recognise it.
  // "projectRow" is a plain project carousel (Featured Projects or a "…Following" row);
  // those are disambiguated afterwards by their order on the page.
  const classify = (box) => {
    if (box.classList.contains("sa-homepage-customrow")) return null;
    if (box.classList.contains("activity")) return "whatsHappening";
    if (box.classList.contains("news")) return "scratchNews";
    if (box.querySelector(".thumbnail-loves")) return "communityLoving";
    if (box.querySelector(".thumbnail-remixes")) return "communityRemixing";
    const firstThumbHref = box.querySelector(".thumbnail a")?.getAttribute("href") || "";
    if (/^\/studios\//.test(firstThumbHref)) return "featuredStudios";
    const more = box.querySelector(".box-header p a")?.getAttribute("href") || "";
    if (more === "/studios/386359/") return "curatorTopProjects";
    if (/^\/studios\/\d+/.test(more)) return "scratchDesignStudio";
    if (box.querySelector(".thumbnail")) return "projectRow";
    return null;
  };

  // settingId for a resolved row id
  const SETTING_OF = {
    featuredProjects: "hideFeaturedProjects",
    featuredStudios: "hideFeaturedStudios",
    scratchDesignStudio: "hideScratchDesignStudio",
    curatorTopProjects: "hideCuratorTopProjects",
    communityLoving: "hideCommunityLoving",
    communityRemixing: "hideCommunityRemixing",
    scratchNews: "hideScratchNews",
    whatsHappening: "hideWhatsHappening",
    following: "hideFollowing",
  };

  // Tag every built-in row with data-sa-row=<id>. Idempotent.
  const tagRows = () => {
    const splash = document.querySelector(".splash");
    if (!splash) return;
    let seenFirstProjectRow = false;
    for (const box of splash.querySelectorAll(".box")) {
      if (box.dataset.saRow) {
        if (box.dataset.saRow === "featuredProjects") seenFirstProjectRow = true;
        continue;
      }
      const kind = classify(box);
      if (!kind) continue;
      let id = kind;
      if (kind === "projectRow") {
        // First plain project carousel is "Featured Projects"; later ones are
        // "…by/loved by/in studios Scratchers I'm Following".
        id = seenFirstProjectRow ? "following" : "featuredProjects";
        seenFirstProjectRow = true;
      }
      box.dataset.saRow = id;
      box.classList.add(PROCESSED);
    }
  };

  const applyHides = () => {
    const disabled = addon.self.disabled;
    for (const box of document.querySelectorAll(`.${PROCESSED}`)) {
      const setting = SETTING_OF[box.dataset.saRow];
      const hide = !disabled && setting && addon.settings.get(setting);
      box.style.display = hide ? "none" : "";
    }
  };

  // ---- Custom rows -------------------------------------------------------

  const studioIdFrom = (value) => {
    const str = String(value || "").trim();
    const m = str.match(/studios\/(\d+)/) || str.match(/^(\d+)$/);
    return m ? m[1] : null;
  };

  const fetchProjects = async (row) => {
    const limit = 20;
    try {
      if (row.source === "studio") {
        const id = studioIdFrom(row.studio);
        if (!id) return [];
        const res = await fetch(`https://api.scratch.mit.edu/studios/${id}/projects/?limit=${limit}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((p) => ({ id: p.id, title: p.title, creator: p.username }));
      }
      const mode = row.source === "popular" ? "popular" : "trending";
      const res = await fetch(
        `https://api.scratch.mit.edu/explore/projects?limit=${limit}&offset=0&language=en&mode=${mode}&q=*`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((p) => ({ id: p.id, title: p.title, creator: p.author && p.author.username }));
    } catch (e) {
      console.warn("Could not load custom row", row, e);
      return [];
    }
  };

  const makeThumbnail = (project) => {
    const { id, title, creator } = project;
    const thumb = document.createElement("div");
    thumb.className = "thumbnail project sa-homepage-thumb";
    const href = `/projects/${id}/`;
    const safeTitle = title || `Project ${id}`;
    thumb.innerHTML = `
      <a class="thumbnail-image" href="${href}"><img alt="" loading="lazy"
        src="//uploads.scratch.mit.edu/projects/thumbnails/${id}.png"></a>
      <div class="thumbnail-info">
        <div class="thumbnail-title"><a href="${href}"></a></div>
        ${creator ? `<div class="thumbnail-creator"><a href="/users/${encodeURIComponent(creator)}/"></a></div>` : ""}
      </div>`;
    const titleLink = thumb.querySelector(".thumbnail-title a");
    titleLink.textContent = safeTitle;
    titleLink.title = safeTitle;
    if (creator) thumb.querySelector(".thumbnail-creator a").textContent = creator;
    return thumb;
  };

  const buildCustomRow = async (row) => {
    const projects = await fetchProjects(row);
    const box = document.createElement("div");
    box.className = "box sa-homepage-customrow";
    const header = document.createElement("div");
    header.className = "box-header";
    const h4 = document.createElement("h4");
    h4.textContent = row.name || msg("untitled");
    header.appendChild(h4);
    box.appendChild(header);

    const content = document.createElement("div");
    content.className = "box-content sa-homepage-customrow-content";
    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "sa-homepage-customrow-empty";
      empty.textContent = msg("empty");
      content.appendChild(empty);
    } else {
      for (const project of projects) content.appendChild(makeThumbnail(project));
    }
    box.appendChild(content);
    return box;
  };

  let renderedCustomSig = null;

  const renderCustomRows = async () => {
    const rows = addon.self.disabled ? [] : addon.settings.get("customRows") || [];
    const sig = JSON.stringify(rows);
    if (sig === renderedCustomSig && document.querySelector(".sa-homepage-customrow")) return;
    renderedCustomSig = sig;
    document.querySelectorAll(".sa-homepage-customrow").forEach((el) => el.remove());
    if (rows.length === 0) return;

    const inners = document.querySelectorAll(".splash .inner.mod-splash");
    const container = inners[inners.length - 1] || document.querySelector(".splash");
    if (!container) return;

    for (const row of rows) {
      const box = await buildCustomRow(row);
      // Re-check: the user may have toggled the addon off while we were fetching.
      if (addon.self.disabled) {
        box.remove();
        return;
      }
      container.appendChild(box);
    }
  };

  const refresh = () => {
    tagRows();
    applyHides();
    renderCustomRows();
  };

  // Wait until the homepage rows exist, then start.
  await addon.tab.waitForElement(".splash .box .thumbnail, .splash .box.activity, .splash .box.news", {
    markAsSeen: true,
  });
  refresh();

  addon.settings.addEventListener("change", refresh);
  addon.self.addEventListener("disabled", refresh);
  addon.self.addEventListener("reenabled", refresh);
}
