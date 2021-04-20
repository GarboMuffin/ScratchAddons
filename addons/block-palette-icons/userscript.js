//When the page loads add the icons.
export default async function ({ addon, global, console }) {
  while (true) {
    await addon.tab.waitForElement(".scratchCategoryMenu", {
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
      const category = Array.from(item.parentNode.classList)
        .find((i) => i.startsWith("scratchCategoryId"))
        .split("-")[1];
      const imgSrc = icons[category];
      if (!imgSrc) return;
      let k = document.createElement("img");
      k.src = addon.self.dir + `/icons/${imgSrc}.svg`;
      k.id = "sa-category-icon";
      addon.tab.displayNoneWhileDisabled(k);
      item.appendChild(k);
    });
  }
}
