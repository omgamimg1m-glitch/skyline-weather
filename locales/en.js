/* English strings, loaded synchronously so the first paint is never blank.
   Generated from locales/en.json by build_locales.py — edit the JSON, not this. */
(function () {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "locales/en.json", false);   /* sync on purpose: fallback dict */
  try { xhr.send(null); window.__I18N_EN = JSON.parse(xhr.responseText); }
  catch (e) { window.__I18N_EN = {}; }
})();
