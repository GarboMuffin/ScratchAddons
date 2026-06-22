const WIKI_BASE = "https://en.scratch-wiki.info/wiki/";

// Specific Scratch Wiki page titles, keyed by block opcode. Every title here was
// verified to resolve to a real wiki article. Blocks not listed fall back to the
// relevant category page (see CATEGORY_PAGES), so "Help" always opens something.
const BLOCK_PAGES = {
  // Motion
  motion_movesteps: "Move () Steps (block)",
  motion_turnright: "Turn Right () Degrees (block)",
  motion_turnleft: "Turn Left () Degrees (block)",
  motion_gotoxy: "Go to X () Y () (block)",
  motion_glideto: "Glide () Secs to () (block)",
  motion_glidesecstoxy: "Glide () Secs to X () Y () (block)",
  motion_pointindirection: "Point in Direction () (block)",
  motion_pointtowards: "Point Towards () (block)",
  motion_changexby: "Change X by () (block)",
  motion_setx: "Set X to () (block)",
  motion_changeyby: "Change Y by () (block)",
  motion_sety: "Set Y to () (block)",
  motion_ifonedgebounce: "If on Edge, Bounce (block)",
  motion_setrotationstyle: "Set Rotation Style () (block)",
  motion_xposition: "X Position (block)",
  motion_yposition: "Y Position (block)",
  motion_direction: "Direction (block)",
  // Looks
  looks_sayforsecs: "Say () for () Seconds (block)",
  looks_say: "Say () (block)",
  looks_thinkforsecs: "Think () for () Seconds (block)",
  looks_think: "Think () (block)",
  looks_switchcostumeto: "Switch Costume to () (block)",
  looks_nextcostume: "Next Costume (block)",
  looks_switchbackdropto: "Switch Backdrop to () (block)",
  looks_nextbackdrop: "Next Backdrop (block)",
  looks_changesizeby: "Change Size by () (block)",
  looks_setsizeto: "Set Size to ()% (block)",
  looks_changeeffectby: "Change () Effect by () (block)",
  looks_seteffectto: "Set () Effect to () (block)",
  looks_cleargraphiceffects: "Clear Graphic Effects (block)",
  looks_show: "Show (block)",
  looks_hide: "Hide (block)",
  looks_gotofrontback: "Go to () Layer (block)",
  looks_goforwardbackwardlayers: "Go () () Layers (block)",
  looks_costumenumbername: "Costume () (block)",
  looks_backdropnumbername: "Backdrop () (block)",
  looks_size: "Size (block)",
  // Sound
  sound_playuntildone: "Play Sound () Until Done (block)",
  sound_play: "Start Sound () (block)",
  sound_stopallsounds: "Stop All Sounds (block)",
  sound_changevolumeby: "Change Volume by () (block)",
  sound_setvolumeto: "Set Volume to ()% (block)",
  sound_volume: "Volume (block)",
  // Events
  event_whenflagclicked: "When Green Flag Clicked (block)",
  event_whenkeypressed: "When () Key Pressed (block)",
  event_whenthisspriteclicked: "When This Sprite Clicked (block)",
  event_whenbackdropswitchesto: "When Backdrop Switches to () (block)",
  event_whenbroadcastreceived: "When I Receive () (block)",
  event_broadcast: "Broadcast () (block)",
  event_broadcastandwait: "Broadcast () and Wait (block)",
  // Control
  control_wait: "Wait () Seconds (block)",
  control_repeat: "Repeat () (block)",
  control_forever: "Forever (block)",
  control_if: "If () Then (block)",
  control_if_else: "If () Then, Else (block)",
  control_wait_until: "Wait Until () (block)",
  control_repeat_until: "Repeat Until () (block)",
  control_stop: "Stop () (block)",
  control_start_as_clone: "When I Start as a Clone (block)",
  control_create_clone_of: "Create Clone of () (block)",
  control_delete_this_clone: "Delete This Clone (block)",
  // Sensing
  sensing_touchingobject: "Touching ()? (block)",
  sensing_touchingcolor: "Touching Color ()? (block)",
  sensing_coloristouchingcolor: "Color () is Touching ()? (block)",
  sensing_distanceto: "Distance to () (block)",
  sensing_askandwait: "Ask () and Wait (block)",
  sensing_answer: "Answer (block)",
  sensing_keypressed: "Key () Pressed? (block)",
  sensing_mousedown: "Mouse Down? (block)",
  sensing_mousex: "Mouse X (block)",
  sensing_mousey: "Mouse Y (block)",
  sensing_timer: "Timer (block)",
  sensing_resettimer: "Reset Timer (block)",
  sensing_of: "() of () (block)",
  sensing_current: "Current () (block)",
  sensing_username: "Username (block)",
  // Operators
  operator_add: "() + () (block)",
  operator_subtract: "() - () (block)",
  operator_multiply: "() * () (block)",
  operator_divide: "() / () (block)",
  operator_random: "Pick Random () to () (block)",
  operator_equals: "() = () (block)",
  operator_and: "() and () (block)",
  operator_or: "() or () (block)",
  operator_not: "Not () (block)",
  operator_join: "Join () () (block)",
  operator_letter_of: "Letter () of () (block)",
  operator_length: "Length of () (block)",
  operator_contains: "() Contains ()? (block)",
  operator_mod: "() Mod () (block)",
  operator_round: "Round () (block)",
  // Variables & lists
  data_setvariableto: "Set () to () (block)",
  data_changevariableby: "Change () by () (block)",
  data_showvariable: "Show Variable () (block)",
  data_hidevariable: "Hide Variable () (block)",
  data_addtolist: "Add () to () (block)",
  data_deleteoflist: "Delete () of () (block)",
  data_deletealloflist: "Delete All of () (block)",
  data_insertatlist: "Insert () at () of () (block)",
  data_replaceitemoflist: "Replace Item () of () with () (block)",
  data_itemoflist: "Item () of () (block)",
  data_itemnumoflist: "Item # of () in () (block)",
  data_listcontainsitem: "() Contains ()? (list block)",
};

// Fallback category pages by opcode prefix (all verified to exist).
const CATEGORY_PAGES = {
  motion: "Motion_Blocks",
  looks: "Looks_Blocks",
  sound: "Sound_Blocks",
  event: "Events_Blocks",
  control: "Control_Blocks",
  sensing: "Sensing_Blocks",
  operator: "Operators_Blocks",
  procedures: "Custom_Blocks",
  argument: "Custom_Blocks",
  pen: "Pen_Blocks",
  music: "Music_Blocks",
};

// Builds a wiki URL from a page title, keeping the parenthesised parts the wiki
// uses literally while escaping characters that would break the URL.
const wikiUrl = (title) =>
  WIKI_BASE +
  title
    .replace(/ /g, "_")
    .replace(/%/g, "%25")
    .replace(/\?/g, "%3F")
    .replace(/#/g, "%23")
    .replace(/\+/g, "%2B")
    .replace(/&/g, "%26");

const pageForBlock = (opcode) => {
  if (!opcode) return null;
  if (BLOCK_PAGES[opcode]) return wikiUrl(BLOCK_PAGES[opcode]);
  const prefix = opcode.split("_")[0];
  // Lists live on their own page even though they share the "data" prefix.
  if (prefix === "data") return WIKI_BASE + (opcode.includes("list") ? "List_Blocks" : "Variables_Blocks");
  if (CATEGORY_PAGES[prefix]) return WIKI_BASE + CATEGORY_PAGES[prefix];
  return WIKI_BASE + "Blocks";
};

export default async function ({ addon, console, msg }) {
  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled) return items;
      const url = pageForBlock(block.type);
      if (!url) return items;
      items.push({
        enabled: true,
        text: msg("help"),
        separator: false,
        callback: () => {
          if (addon.settings.get("newTab")) window.open(url, "_blank", "noopener");
          else window.open(url, "_self");
        },
      });
      return items;
    },
    { blocks: true, flyout: true }
  );
}
