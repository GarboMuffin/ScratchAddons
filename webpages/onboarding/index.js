// First-run onboarding ("Setup") wizard. A standalone extension page that opens
// on install (see background/transition.js). It presents a hand-picked selection
// of addons across a few themed steps and lets the user enable them with one
// click, then points them at the full settings page.
//
// Enabling/disabling goes through the same background messages the settings page
// uses (`changeEnabledState`), so dynamicEnable addons apply immediately and the
// stored state stays consistent.

const msg = (key, ...subs) => chrome.i18n.getMessage(key, subs.length ? subs : undefined) || key;

const STEPS = [
  {
    titleKey: "onboardingEditorTitle",
    subtitleKey: "onboardingEditorSubtitle",
    addons: ["editor-dark-mode", "find-bar", "color-picker", "editor-searchable-dropdowns", "custom-block-shape"],
  },
  {
    titleKey: "onboardingPlayerTitle",
    subtitleKey: "onboardingPlayerSubtitle",
    addons: ["pause", "progress-bar", "60fps", "mute-project", "gamepad"],
  },
  {
    titleKey: "onboardingWebsiteTitle",
    subtitleKey: "onboardingWebsiteSubtitle",
    addons: ["scratchr2", "studio-tools", "full-signature", "dark-www", "exact-count"],
  },
  {
    titleKey: "onboardingPopupTitle",
    subtitleKey: "onboardingPopupSubtitle",
    addons: ["scratch-messaging", "msg-count-badge", "scratch-notifier", "cloud-games"],
  },
];

const app = document.getElementById("app");
const header = document.getElementById("setup-header");
const headerText = document.getElementById("setup-header-text");

const manifestById = new Map();
const enabled = new Map();
// -1 = welcome, 0..STEPS.length-1 = addon steps, STEPS.length = done.
let current = -1;

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child !== null && child !== undefined) node.append(child);
  return node;
};

const setAddonEnabled = (addonId, state) => {
  enabled.set(addonId, state);
  chrome.runtime.sendMessage({ changeEnabledState: { addonId, newState: state } });
};

const showHeader = (show) => {
  header.hidden = !show;
  if (show) headerText.textContent = msg("onboardingSetup");
};

const makeButton = (label, className, onClick) => {
  const button = el("button", { className, textContent: label });
  button.addEventListener("click", onClick);
  return button;
};

const render = () => {
  app.textContent = "";
  if (current === -1) renderWelcome();
  else if (current < STEPS.length) renderStep(STEPS[current]);
  else renderDone();
};

const renderWelcome = () => {
  showHeader(false);
  app.append(
    el(
      "section",
      { className: "splash" },
      el(
        "div",
        { className: "splash-logo" },
        el("img", { src: "../../images/icon-transparent.svg", alt: "", draggable: false })
      ),
      el("h1", { className: "splash-title", textContent: msg("onboardingWelcomeTitle") }),
      el("p", { className: "splash-subtitle", textContent: msg("onboardingWelcomeSubtitle") }),
      el(
        "div",
        { className: "actions" },
        makeButton(msg("onboardingGetStarted"), "btn btn-primary btn-large", () => {
          current = 0;
          render();
        })
      )
    )
  );
};

const renderStep = (step) => {
  showHeader(true);

  const grid = el("div", { className: "card-grid" });
  for (const addonId of step.addons) {
    const manifest = manifestById.get(addonId);
    if (!manifest) continue; // addon removed/renamed; skip gracefully
    grid.append(makeCard(addonId, manifest));
  }

  const dots = el("div", { className: "step-dots" });
  STEPS.forEach((_, i) =>
    dots.append(el("span", { className: "dot" + (i === current ? " active" : i < current ? " done" : "") }))
  );

  const isLast = current === STEPS.length - 1;
  const actions = el(
    "div",
    { className: "actions" },
    makeButton(msg("onboardingBack"), "btn btn-secondary", () => {
      current -= 1;
      render();
    }),
    makeButton(isLast ? msg("onboardingFinish") : msg("onboardingNext"), "btn btn-primary", () => {
      current += 1;
      render();
    })
  );

  app.append(
    el(
      "section",
      { className: "step" },
      dots,
      el("h1", { className: "step-title", textContent: msg(step.titleKey) }),
      el("p", { className: "step-subtitle", textContent: msg(step.subtitleKey) }),
      grid,
      actions,
      el("p", { className: "change-later", textContent: msg("onboardingChangeLater") })
    )
  );
};

const makeCard = (addonId, manifest) => {
  const isOn = enabled.get(addonId) === true;
  const card = el("button", {
    className: "addon-card" + (isOn ? " selected" : ""),
    type: "button",
  });
  card.setAttribute("aria-pressed", String(isOn));

  const check = el("span", { className: "addon-check", textContent: "✓" });
  const name = el("span", { className: "addon-name", textContent: manifest.name });
  const description = el("span", { className: "addon-description", textContent: manifest.description || "" });

  card.append(check, name, description);
  card.addEventListener("click", () => {
    const next = !(enabled.get(addonId) === true);
    setAddonEnabled(addonId, next);
    card.classList.toggle("selected", next);
    card.setAttribute("aria-pressed", String(next));
  });
  return card;
};

const renderDone = () => {
  showHeader(false);
  app.append(
    el(
      "section",
      { className: "splash" },
      el("div", { className: "splash-emoji", textContent: "🎉" }),
      el("h1", { className: "splash-title", textContent: msg("onboardingDoneTitle") }),
      el("p", { className: "splash-subtitle", textContent: msg("onboardingDoneSubtitle") }),
      el(
        "div",
        { className: "actions" },
        makeButton(msg("onboardingOpenScratch"), "btn btn-primary btn-large", () =>
          chrome.tabs.create({ url: "https://scratch.mit.edu/" })
        ),
        makeButton(msg("onboardingOpenSettings"), "btn btn-secondary btn-large", () => chrome.runtime.openOptionsPage())
      ),
      el("p", { className: "done-hint", textContent: msg("onboardingDoneHint") })
    )
  );
};

chrome.runtime.sendMessage("getSettingsInfo", (response) => {
  if (response && response.manifests) {
    for (const { addonId, manifest } of response.manifests) manifestById.set(addonId, manifest);
    const addonsEnabled = response.addonsEnabled || {};
    for (const addonId of Object.keys(addonsEnabled)) enabled.set(addonId, addonsEnabled[addonId] === true);
  }
  render();
});
