export default async function ({ addon, console, msg }) {
  const action = addon.settings.get("action");
  let playerToggled = false;
  let scratchStage;
  let twIframeContainer = document.createElement("div");
  twIframeContainer.className = "sa-tw-iframe-container";
  let twIframe = document.createElement("iframe");
  twIframe.setAttribute("allowtransparency", "true");
  twIframe.setAttribute("allowfullscreen", "true");
  twIframe.setAttribute(
    "allow",
    "autoplay *; camera https://turbowarp.org; document-domain 'none'; fullscreen *; gamepad https://turbowarp.org; microphone https://turbowarp.org;"
  );
  twIframe.className = "sa-tw-iframe";
  twIframeContainer.appendChild(twIframe);

  const button = document.createElement("button");
  button.className = "button sa-tw-button";
  button.title = "TurboWarp";

  function removeIframe() {
    twIframeContainer.remove();
    scratchStage.style.display = "";
    button.classList.remove("scratch");
    playerToggled = false;
    button.title = "TurboWarp";
  }

  // If the creator put a TurboWarp link (with their own settings/parameters) in the project's
  // instructions or notes, prefer that over a bare turbowarp.org/<id> link. Returns the first
  // such link, or null.
  function getNotesTurboWarpLink() {
    if (!addon.settings.get("notesLink")) return null;
    const info = addon.tab.redux.state?.preview?.projectInfo;
    if (!info) return null;
    const text = `${info.instructions || ""}\n${info.description || ""}`;
    // Match a turbowarp.org link with a path/query (so a bare "turbowarp.org" mention is ignored).
    const match = text.match(/(?:https?:\/\/)?turbowarp\.org\/[^\s"'<>)]+/i);
    if (!match) return null;
    let url = match[0].replace(/[.,]+$/, ""); // trailing punctuation isn't part of the link
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return url;
  }

  button.onclick = async (e) => {
    const projectId = window.location.pathname.split("/")[2];
    let search = "";
    if (addon.tab.redux.state?.preview?.projectInfo?.public === false) {
      let projectToken = (
        await (
          await fetch(
            `https://api.scratch.mit.edu/projects/${projectId}?current_time_to_get_updated_project_token=${Date.now()}`,
            {
              headers: {
                "x-token": await addon.auth.fetchXToken(),
              },
            }
          )
        ).json()
      ).project_token;
      search = `#?token=${projectToken}`;
    }
    if (action === "link" || e.ctrlKey || e.metaKey) {
      // Use the creator's link from the notes when present (public projects only, since a
      // notes link can't carry the private-project token we computed above).
      const notesLink = search ? null : getNotesTurboWarpLink();
      window.open(notesLink || `https://turbowarp.org/${projectId}${search}`, "_blank", "noopener,noreferrer");
    } else {
      playerToggled = !playerToggled;
      if (playerToggled) {
        const username = await addon.auth.fetchUsername();
        const usp = new URLSearchParams();
        usp.set("settings-button", "1");
        if (username) usp.set("username", username);
        if (addon.settings.get("addons")) {
          const enabledAddons = await addon.self.getEnabledAddons("player");
          usp.set("addons", enabledAddons.join(","));
        }
        // Apply the same fullscreen background color, consistently with the vanilla Scratch fullscreen behavior.
        // It's not expected here to support dynamicDisable/dynamicEnable of editor-dark-mode to work exactly
        // like it does with vanilla.
        const fullscreenBackground =
          document.documentElement.style.getPropertyValue("--editorDarkMode-fullscreen") || "white";
        usp.set("fullscreen-background", fullscreenBackground);
        const iframeUrl = `https://turbowarp.org/${projectId}/embed?${usp}${search}`;
        twIframe.src = "";
        scratchStage.parentElement.prepend(twIframeContainer);
        // Use location.replace to avoid creating a history entry
        twIframe.contentWindow.location.replace(iframeUrl);

        scratchStage.style.display = "none";
        button.classList.add("scratch");
        button.title = "Scratch";
        addon.tab.traps.vm.stopAll();
      } else removeIframe();
    }
  };

  let showAlert = true;
  while (true) {
    const seeInside = await addon.tab.waitForElement(".see-inside-button", {
      markAsSeen: true,
      reduxCondition: (state) => state.scratchGui.mode.isPlayerOnly,
    });

    seeInside.addEventListener("click", function seeInsideClick(event) {
      if (!playerToggled || !showAlert) return;

      if (confirm(msg("confirmation"))) {
        showAlert = false;
      } else {
        event.stopPropagation();
      }
    });

    addon.tab.appendToSharedSpace({ space: "beforeRemixButton", element: button, order: 1 });

    scratchStage = document.querySelector(".guiPlayer");
  }
}
