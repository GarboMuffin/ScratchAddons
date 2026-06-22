import { escapeHTML } from "./autoescaper.js";
import { MessageFormatter, pluralTypeHandler } from "../../thirdparty/cs/icu-message-formatter.es.min.js";

// Whether the user is on macOS, where the primary shortcut modifier is Command (not Control)
// and Option is used instead of Alt. Lets addon strings write the platform-neutral {cmdKey} /
// {optKey} placeholders and have them render the right key name.
const IS_MAC =
  typeof navigator !== "undefined" &&
  (navigator.userAgentData?.platform === "macOS" ||
    /Mac/i.test(navigator.platform || "") ||
    /Mac OS X|Macintosh/i.test(navigator.userAgent || ""));

// This library is shared between background and userscript.
// Subclasses are responsible for implementing methods to load translations.

export default class LocalizationProvider extends EventTarget {
  constructor() {
    super();
    this.messages = {};
    this._reconfigure();
  }

  _reconfigure() {
    const locale = this.locale;
    this._date = new Intl.DateTimeFormat(locale);
    this._datetime = new Intl.DateTimeFormat(locale, {
      timeStyle: "short",
      dateStyle: "short",
    });
    this.formatter = new MessageFormatter(locale, {
      plural: pluralTypeHandler,
    });
  }

  // Substitute only the modifier-key placeholders ({cmdKey}/{optKey}) in an already-final string.
  // Used for manifest name/description/info, which on the English path are shown without going
  // through get(). No-op for strings that contain no placeholder.
  substituteKeys(string) {
    return typeof string === "string" && string.includes("{")
      ? this.formatter.format(string, this._keyPlaceholders())
      : string;
  }

  // The {cmdKey} / {optKey} modifier-key placeholders, resolved for the current platform and
  // locale (the key names themselves come from _general so they can be translated, e.g. "Strg").
  _keyPlaceholders() {
    const m = this.messages;
    return {
      cmdKey: IS_MAC ? m["_general/keys/cmd"] || "Cmd" : m["_general/keys/ctrl"] || "Ctrl",
      optKey: IS_MAC ? m["_general/keys/option"] || "Option" : m["_general/keys/alt"] || "Alt",
    };
  }

  _get(key, placeholders, messageHandler, fallback) {
    messageHandler = messageHandler || ((m) => m);
    const allPlaceholders = { ...this._keyPlaceholders(), ...placeholders };
    if (Object.prototype.hasOwnProperty.call(this.messages, key)) {
      const rawMessage = this.messages[key];
      // English source file may use Structured JSON, non-English files use keyvalue JSON
      const message = messageHandler(rawMessage.string || rawMessage);
      return this.formatter.format(message, allPlaceholders);
    }
    if (!fallback) {
      (globalThis.scratchAddons?.console || console).warn("Key missing:", key);
      return key;
    }
    // Run the fallback through the formatter only when it contains a placeholder, so plain
    // source strings (which were never written for ICU) are returned untouched.
    return fallback.includes("{") ? this.formatter.format(messageHandler(fallback), allPlaceholders) : fallback;
  }

  get(key, placeholders = {}, fallback = "") {
    return this._get(key, placeholders, null, fallback);
  }

  escaped(key, placeholders = {}, fallback = "") {
    return this._get(key, placeholders, (message) => escapeHTML(message), fallback);
  }

  get locale() {
    return this.messages._locale || "en";
  }

  get localeName() {
    return this.messages._locale_name || "English";
  }

  date(dateObj) {
    return this._date.format(dateObj);
  }

  datetime(dateObj) {
    return this._datetime.format(dateObj);
  }
}
