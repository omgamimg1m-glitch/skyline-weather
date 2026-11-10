/* Translation engine.
 *
 * HOW IT WORKS
 *   - The chosen language is stored in localStorage (guarded: it throws in a
 *     sandboxed iframe) and also reflected in ?lang=xx and <html lang>.
 *   - Every translatable string carries data-i18n="key" in the markup, so the
 *     English page is already correct before any JS runs. Translating means
 *     swapping textContent — no re-render, no flash of empty content.
 *   - Dynamic strings built in JS call t("key") at render time.
 *
 * THE HONEST PART
 *   A missing key falls back to English rather than to blank or to the raw key.
 *   Half-translated is worse than untranslated, but blank is worst of all.
 *   check_coverage.py reports exactly which keys are missing per locale, so the
 *   gap is measurable instead of invisible.
 *
 * WHAT IS NOT TRANSLATED
 *   The 25 feature notes on the guide page are the author's verbatim words from
 *   the original document. Translating them would stop them being verbatim, so
 *   they stay in English, and the guide says so.
 *
 * ADDING A LANGUAGE
 *   Drop locales/xx.json next to this file and add it to LOCALES below.
 *   Any language with a JSON file works; nothing else needs to change.
 */
(function () {
  "use strict";

  /* Available languages. Ordered roughly by number of speakers, English first
     because it is the source text and the fallback. */
  var LOCALES = [
    { code: "en", name: "English",           native: "English",  dir: "ltr" },
    { code: "hi", name: "Hindi",             native: "हिन्दी",     dir: "ltr" },
    { code: "bn", name: "Bengali",           native: "বাংলা",     dir: "ltr" },
    { code: "or", name: "Odia",              native: "ଓଡ଼ିଆ",      dir: "ltr" },
    { code: "es", name: "Spanish",           native: "Español",  dir: "ltr" },
    { code: "fr", name: "French",            native: "Français", dir: "ltr" },
    { code: "de", name: "German",            native: "Deutsch",  dir: "ltr" },
    { code: "pt", name: "Portuguese",        native: "Português",dir: "ltr" },
    { code: "ru", name: "Russian",           native: "Русский",  dir: "ltr" },
    { code: "ar", name: "Arabic",            native: "العربية",   dir: "rtl" },
    { code: "zh", name: "Chinese",           native: "中文",      dir: "ltr" },
    { code: "ja", name: "Japanese",          native: "日本語",     dir: "ltr" },
    { code: "ko", name: "Korean",            native: "한국어",     dir: "ltr" },
    { code: "id", name: "Indonesian",        native: "Bahasa Indonesia", dir: "ltr" }
  ];

  var KEY = "skyline.lang";
  var dict = {};            /* current language strings */
  var current = "en";
  var listeners = [];

  function store() {
    try { return localStorage; } catch (e) { return null; }
  }
  function readLang() {
    var s = store();
    var saved = null;
    if (s) { try { saved = s.getItem(KEY); } catch (e) { saved = null; } }
    var q = new URLSearchParams(location.search).get("lang");
    var pick = q || saved || "";
    /* accept both "hi" and "hi-IN" */
    var base = pick.split("-")[0].toLowerCase();
    for (var i = 0; i < LOCALES.length; i++) {
      if (LOCALES[i].code === base) return base;
    }
    /* fall back to the browser's first preference, then English */
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    var nb = nav.split("-")[0].toLowerCase();
    for (var j = 0; j < LOCALES.length; j++) {
      if (LOCALES[j].code === nb) return nb;
    }
    return "en";
  }

  /* t(key, fallback, [a, b, ...]) — extra args fill {0}, {1}, ...
     English and every locale use the same placeholders, so a translator can
     move a number anywhere in the sentence without breaking the page. */
  function t(key, fallback, args) {
    var v;
    if (dict && dict[key] != null) v = dict[key];
    else if (window.__I18N_EN && window.__I18N_EN[key] != null) v = window.__I18N_EN[key];
    else v = (fallback != null ? fallback : key);
    if (typeof v === "string" && v.indexOf("{") >= 0) {
      var list = (args && args.length !== undefined) ? args : (args == null ? [] : [args]);
      v = v.replace(/\{(\d+)\}/g, function (m, i) {
        var a = list[+i];
        return a == null ? m : String(a);
      });
    }
    return v;
  }

  function apply(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var args = el.getAttribute("data-i18n-args");
      el.textContent = t(key, el.textContent, args ? args.split(",") : null);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      /* data-i18n-attr="title:ui.help|aria-label:ui.language" */
      el.getAttribute("data-i18n-attr").split("|").forEach(function (pair) {
        var i = pair.indexOf(":");
        if (i < 0) return;
        var attr = pair.slice(0, i).trim();
        var key = pair.slice(i + 1).trim();
        el.setAttribute(attr, t(key, el.getAttribute(attr)));
      });
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"), el.placeholder));
    });
  }

  function setLang(code, opts) {
    opts = opts || {};
    var meta = LOCALES.filter(function (l) { return l.code === code; })[0] || LOCALES[0];
    current = meta.code;

    return loadDict(meta.code).then(function (d) {
      dict = d || {};
      document.documentElement.setAttribute("lang", meta.code);
      document.documentElement.setAttribute("dir", meta.dir);
      if (meta.dir === "rtl") document.documentElement.classList.add("is-rtl");
      else document.documentElement.classList.remove("is-rtl");

      var s = store();
      if (s) { try { s.setItem(KEY, meta.code); } catch (e) { /* ignore */ } }

      apply(document);
      listeners.forEach(function (fn) { try { fn(meta.code, dict); } catch (e) {} });
      /* Cards built by JS rendered with the previous dictionary; rebuild them.
         Without this, a direct ?lang=xx load keeps English inside the cards even
         though the static markup is translated. */
      if (typeof window.__renderedByJS === "function") {
        try { window.__renderedByJS(); } catch (e) {}
      }

      if (opts.silent !== true) {
        var btn = document.getElementById("langBtn");
        if (btn) btn.textContent = meta.code.toUpperCase();
      }
    });
  }

  var cache = {};
  function loadDict(code) {
    if (cache[code]) return Promise.resolve(cache[code]);
    return fetch("locales/" + code + ".json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { cache[code] = d; return d; })
      .catch(function () { return null; });   /* offline: English remains */
  }

  /* Code helper used by the picker and by anything that needs to re-render. */
  function localeName(code) {
    var m = LOCALES.filter(function (l) { return l.code === code; })[0];
    return m ? m.native : code;
  }

  window.i18n = {
    LOCALES: LOCALES,
    t: t,
    apply: apply,
    setLang: setLang,
    localeName: localeName,
    get lang() { return current; },
    onApply: function (fn) { listeners.push(fn); }
  };
  window.t = t;   /* short alias for renderers */

  /* Boot: load English (the fallback), then the chosen language. */
  document.addEventListener("DOMContentLoaded", function () {
    var chosen = readLang();
    loadDict("en").then(function (en) {
      window.__I18N_EN = en || {};
      dict = en || {};
      if (chosen === "en") {
        document.documentElement.setAttribute("lang", "en");
        apply(document);
        listeners.forEach(function (fn) { try { fn("en", dict); } catch (e) {} });
        if (typeof window.__renderedByJS === "function") {
          try { window.__renderedByJS(); } catch (e) {}
        }
        var btn = document.getElementById("langBtn");
        if (btn) btn.textContent = "EN";
        return;
      }
      setLang(chosen);
    });
  });
})();
