//When the page loads add the icons.
export default async function ({ addon, global, console }) {
  while (true) {
    const tabs = await addon.tab.waitForElement(".scratchCategoryMenu", {
      markAsSeen: true,
    });

    /*
     * An array of iconify icons for the categories.
     */
    let icons = {
      motion: "motion_icon",
      looks: "looks_icon",
      sound: "sound_icon",
      events: "events_icon",
      control: "control_icon",
      sensing: "sensing_icon",
      operators: "operators_icon",
      variables: "variables_icon",
      lists: "list_icon",
      myBlocks: "block_icon",
      tw: "tw_icon",
    };
    //For each .scratchCategoryItemBubble add an icon
    document.querySelectorAll(".scratchCategoryItemBubble").forEach((item) => {
      //Make the padding a little bigger to fit the icons.
      item.style.padding = "11px";
      //Position it relative so that absolute positioning will be relative to the bubble.
      item.style.position = "relative";
      const category = Array.from(item.parentNode.classList)
        .find((i) => i.startsWith("scratchCategoryId"))
        .split("-")[1];
      const imgSrc = icons[category];
      if (!imgSrc) return;
      let k = document.createElement("img");
      k.src = addon.self.dir + `/icons/${imgSrc}.svg`;
      Object.assign(k.style, {
        filter: "brightness(50000%)",
        top: "50%",
        color: "white",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "absolute",
        width: "17px",
        height: "17px",
      });
      item.appendChild(k);
    });
  }
}
