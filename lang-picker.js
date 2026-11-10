/* Language picker — shared by index.html and guide.html.
 *
 * Why a separate file: the picker used to live inline in index.html. The guide
 * page needs the same control, and two copies of a menu with focus handling is
 * exactly how the two pages end up behaving differently. One file, one
 * behaviour, and a test can load either page and get the same result.
 *
 * It expects markup:
 *   <div class="lang-wrap">
 *     <button class="lang-btn" id="langBtn" aria-haspopup="listbox" aria-expanded="false">EN</button>
 *     <ul class="lang-menu" id="langMenu" role="listbox" hidden></ul>
 *   </div>
 *
 * Each language is listed in its OWN script, so a reader who cannot read
 * English can still recognise their language. The English name sits underneath
 * as a secondary line for anyone scanning for a familiar word.
 */
(function () {
  "use strict";

  function boot() {
    var btn = document.getElementById("langBtn");
    var menu = document.getElementById("langMenu");
    if (!btn || !menu || !window.i18n) return;

    function paint() {
      menu.innerHTML = window.i18n.LOCALES.map(function (l) {
        return '<li role="option" aria-selected="' + (l.code === window.i18n.lang) + '">' +
               '<button type="button" data-lang="' + l.code + '" lang="' + l.code + '">' +
                 '<span class="lang-native">' + l.native + '</span>' +
                 '<span class="lang-en">' + (l.code === "en" ? "" : l.name) + '</span>' +
               '</button></li>';
      }).join("");
    }
    paint();

    function close() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function open() {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var sel = menu.querySelector('[aria-selected="true"] button');
      if (sel) sel.focus();
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });

    menu.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lang]");
      if (!b) return;
      var code = b.getAttribute("data-lang");
      close();
      window.i18n.setLang(code).then(function () {
        paint();
        /* Anything built by JS has to be rebuilt in the new language. Pages
           without JS-rendered content simply never define this. */
        if (typeof window.__renderedByJS === "function") {
          try { window.__renderedByJS(); } catch (err) { /* one bad renderer must not stop the rest */ }
        }
        var url = new URL(location.href);
        url.searchParams.set("lang", code);
        try { history.replaceState(null, "", url); } catch (err) { /* fine */ }
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".lang-wrap")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); }
    });
    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll("button[data-lang]"));
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });

    /* i18n sets the label after every dictionary load; keep it in sync if the
       language changed some other way (?lang=, back button). */
    window.i18n.onApply(function (code) {
      btn.textContent = code.toUpperCase();
      paint();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
