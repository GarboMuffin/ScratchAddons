export default async function ({ addon, console, msg }) {
  // Cache of fetched user data, keyed by lowercase username.
  // Value is a Promise resolving to the API object, or null when the user doesn't exist.
  const cache = new Map();

  let card = null;
  let anchorEl = null; // the link we're currently showing (or about to show) a card for
  let shownUsername = null; // lowercase username currently rendered in the card
  let showTimer = null;
  let hideTimer = null;
  let fetchToken = 0; // guards against out-of-order fetches

  const PIN_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 4.7 6.2 12.2 6.5 12.5a.7.7 0 0 0 1 0C12.8 21.2 19 13.7 19 9a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  const CAL_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zM5 9h14v10H5V9z"/></svg>';

  /** Extract a Scratch username from a link's href if it points to a profile (and only a profile). */
  function profileUsername(link) {
    const href = link.getAttribute("href");
    if (!href) return null;
    let url;
    try {
      url = new URL(href, location.origin);
    } catch {
      return null;
    }
    if (url.hostname !== "scratch.mit.edu" && url.hostname !== location.hostname) return null;
    const m = url.pathname.match(/^\/users\/([\w-]{1,30})\/?$/);
    return m ? m[1] : null;
  }

  function fetchUser(username) {
    const key = username.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const promise = fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && data.username && !data.code ? data : null))
      .catch(() => null);
    cache.set(key, promise);
    return promise;
  }

  function buildCard() {
    const el = document.createElement("div");
    el.className = "sa-hovercard";
    el.setAttribute("role", "tooltip");
    el.dir = "ltr";
    document.body.appendChild(el);
    return el;
  }

  function applyTheme() {
    // Detect a dark page background (e.g. the "Website dark mode" addon) and adapt.
    let bg = getComputedStyle(document.body).backgroundColor || "";
    const m = bg.match(/rgba?\(([^)]+)\)/);
    let dark = false;
    if (m) {
      const [r, g, b, a = "1"] = m[1].split(",").map((s) => parseFloat(s));
      if (parseFloat(a) > 0) {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        dark = lum < 128;
      }
    }
    card.classList.toggle("sa-hovercard-dark", dark);
  }

  function position(link) {
    const rect = link.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + margin;
    if (top + cardRect.height > window.innerHeight - 4 && rect.top - margin - cardRect.height > 4) {
      top = rect.top - margin - cardRect.height;
    }
    let left = rect.left;
    if (left + cardRect.width > window.innerWidth - 4) left = window.innerWidth - 4 - cardRect.width;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  function renderLoading() {
    card.innerHTML = `<div class="sa-hovercard-header"><div class="sa-hovercard-avatar sa-hovercard-skeleton"></div><div class="sa-hovercard-headtext"><div class="sa-hovercard-skeleton sa-hovercard-skline" style="width:120px"></div><div class="sa-hovercard-skeleton sa-hovercard-skline" style="width:80px"></div></div></div>`;
  }

  function joinedText(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return "";
    const formatted = date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    return msg("joined", { date: formatted });
  }

  function section(label, text) {
    if (!text || !text.trim()) return "";
    const div = document.createElement("div");
    div.className = "sa-hovercard-section";
    const l = document.createElement("div");
    l.className = "sa-hovercard-label";
    l.textContent = label;
    const t = document.createElement("div");
    t.className = "sa-hovercard-text";
    t.textContent = text.trim();
    div.append(l, t);
    return div;
  }

  function renderUser(data) {
    card.textContent = "";

    const header = document.createElement("div");
    header.className = "sa-hovercard-header";

    const avatarLink = document.createElement("a");
    avatarLink.className = "sa-hovercard-avatar";
    avatarLink.href = `/users/${data.username}/`;
    const img = document.createElement("img");
    img.src = data.profile.images["90x90"];
    img.alt = "";
    img.loading = "lazy";
    avatarLink.appendChild(img);

    const headtext = document.createElement("div");
    headtext.className = "sa-hovercard-headtext";

    const nameLink = document.createElement("a");
    nameLink.className = "sa-hovercard-username";
    nameLink.href = `/users/${data.username}/`;
    nameLink.textContent = data.username;
    headtext.appendChild(nameLink);

    if (data.scratchteam) {
      const badge = document.createElement("span");
      badge.className = "sa-hovercard-badge";
      badge.textContent = msg("scratch-team");
      nameLink.appendChild(document.createTextNode(" "));
      nameLink.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "sa-hovercard-meta";
    if (data.profile.country) {
      const span = document.createElement("span");
      span.className = "sa-hovercard-metaitem";
      span.innerHTML = PIN_ICON;
      span.appendChild(document.createTextNode(data.profile.country));
      meta.appendChild(span);
    }
    const joined = joinedText(data.history && data.history.joined);
    if (joined) {
      const span = document.createElement("span");
      span.className = "sa-hovercard-metaitem";
      span.innerHTML = CAL_ICON;
      span.appendChild(document.createTextNode(joined));
      meta.appendChild(span);
    }
    if (meta.childElementCount) headtext.appendChild(meta);

    header.append(avatarLink, headtext);
    card.appendChild(header);

    if (addon.settings.get("bio")) {
      const about = section(msg("about"), data.profile.status);
      const wiwo = section(msg("wiwo"), data.profile.bio);
      if (about) card.appendChild(about);
      if (wiwo) card.appendChild(wiwo);
    }
  }

  async function openCard(link, username) {
    if (addon.self.disabled) return;
    if (!card) card = buildCard();
    anchorEl = link;
    shownUsername = username.toLowerCase();
    applyTheme();
    const token = ++fetchToken;

    renderLoading();
    card.classList.add("sa-hovercard-visible");
    position(link);

    const data = await fetchUser(username);
    if (token !== fetchToken || addon.self.disabled) return; // superseded or disabled
    if (!data) {
      hideCard();
      return;
    }
    renderUser(data);
    position(link);
  }

  function hideCard() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    fetchToken++;
    anchorEl = null;
    shownUsername = null;
    if (card) card.classList.remove("sa-hovercard-visible");
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideCard, 220);
  }

  document.body.addEventListener("mouseover", (e) => {
    if (addon.self.disabled) return;
    const overCard = card && card.contains(e.target);
    if (overCard) {
      clearTimeout(hideTimer);
      return;
    }
    const link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    const username = profileUsername(link);
    if (!username) return;
    clearTimeout(hideTimer);
    // Already showing (or queued) for this exact link: nothing to do.
    if (link === anchorEl) return;
    // Card already shows this user via a different link: just keep it, re-anchor.
    if (shownUsername === username.toLowerCase() && card && card.classList.contains("sa-hovercard-visible")) {
      anchorEl = link;
      return;
    }
    clearTimeout(showTimer);
    anchorEl = link;
    const delay = Math.max(0, addon.settings.get("delay"));
    showTimer = setTimeout(() => openCard(link, username), delay);
  });

  document.body.addEventListener("mouseout", (e) => {
    const to = e.relatedTarget;
    if (card && (card === to || card.contains(to))) {
      clearTimeout(hideTimer);
      return;
    }
    const link = e.target.closest && e.target.closest("a[href]");
    if (link && link === anchorEl) {
      if (to && anchorEl.contains(to)) return; // still within the same link
      clearTimeout(showTimer);
      scheduleHide();
    }
  });

  // Hide on scroll/resize so the card never floats detached from its anchor.
  window.addEventListener("scroll", () => card && card.classList.contains("sa-hovercard-visible") && hideCard(), true);
  window.addEventListener("resize", () => card && card.classList.contains("sa-hovercard-visible") && hideCard());

  addon.self.addEventListener("disabled", hideCard);
}
