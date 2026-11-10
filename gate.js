/* Bot check — a "first page" gate with no login, no account, no tracking.
 *
 * WHAT THIS IS
 *   A speed bump. It stops casual scrapers and bulk-copy scripts from
 *   hammering the weather API, and it costs the visitor about five seconds.
 *
 * WHAT THIS IS NOT
 *   Real security. Everything here runs in the browser, so anyone who reads
 *   this file can step around it. Genuine protection means checking a signed
 *   token on the server (Cloudflare Turnstile, hCaptcha, or your own
 *   endpoint). This is the free, dependency-free version.
 *
 * It combines four cheap signals rather than one expensive one:
 *   1. a honeypot field that only naive bots fill in
 *   2. a minimum time on page (instant submits are bots)
 *   3. a proof-of-work loop — ~0.1s of CPU per attempt, so guessing in
 *      bulk gets expensive fast
 *   4. a simple question, randomised every load
 *
 * Fails OPEN, always: if storage is unavailable, or crypto is missing, a real
 * person still gets through. Blocking your own visitors to stop bots is a bad
 * trade.
 */
(function () {
  "use strict";

  /* Translation, with a safe fallback for the moment before i18n.js has its
     dictionary: the English string passed in is used verbatim. */
  function t(key, fallback) {
    return (window.t && window.t(key, fallback)) || fallback;
  }

  var KEY = "skyline.verified";
  var MIN_MS = 1200;              /* be human for at least this long */
  var POW_ZEROS = 3;              /* 3 hex zeros ≈ 4,096 hashes */
  var T0 = Date.now();
  var memVerified = false;

  /* ---------------------------------------------------------------- storage
     sessionStorage throws in a sandboxed iframe (opaque origin). Never let
     that break the page — fall back to a variable that lives for the visit. */
  function isVerified() {
    try { return sessionStorage.getItem(KEY) === "1"; }
    catch (e) { return memVerified; }
  }
  function setVerified() {
    memVerified = true;
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* in-memory only */ }
  }

  if (isVerified()) return;                    /* already through this visit */

  /* Lock the page immediately, while <body> is still parsing, so there is no
     flash of the real content before the curtain appears. */
  document.documentElement.classList.add("gate-locked");

  /* ------------------------------------------------------------------ hash */
  function hasLeadingZeros(hex, n) {
    for (var i = 0; i < n; i++) if (hex[i] !== "0") return false;
    return true;
  }
  function toHex(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  /* WebCrypto only exists in a secure context; fnv1a covers file:// and old
     browsers. Weaker, but this is a speed bump, not a wall. */
  function powAsync(seed, zeros) {
    var subtle = (window.crypto && window.crypto.subtle) || null;
    if (!subtle) {
      var n = 0;
      while (fnv1a(seed + ":" + n) >>> (32 - zeros * 4) !== 0) n++;
      return Promise.resolve(n);
    }
    var enc = new TextEncoder();
    var nonce = 0;
    return new Promise(function (resolve, reject) {
      (function step() {
        var batch = 512;                       /* yield so the tab stays alive */
        (function loop() {
          if (batch-- === 0) return step();
          if (nonce > 4e6) return reject(new Error("pow"));
          subtle.digest("SHA-256", enc.encode(seed + ":" + nonce)).then(function (d) {
            if (hasLeadingZeros(toHex(d), zeros)) return resolve(nonce);
            nonce++;
            loop();
          }, reject);
        })();
      })();
    });
  }
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  /* -------------------------------------------------------------- challenge
     Pick a target and three decoys. Only one option is above the target, so
     the answer is unambiguous and needs no language nuance. */
  function makeChallenge() {
    var target = 13 + Math.floor(Math.random() * 28);      /* 13–40 */
    var above = target + 1 + Math.floor(Math.random() * 40);
    var opts = [above], used = { };
    used[above] = true;
    while (opts.length < 4) {
      var v = 2 + Math.floor(Math.random() * (target - 2));
      if (used[v] || v === above) continue;
      used[v] = true;
      opts.push(v);
    }
    for (var i = opts.length - 1; i > 0; i--) {             /* shuffle */
      var j = Math.floor(Math.random() * (i + 1));
      var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return { target: target, answer: above, options: opts };
  }

  /* ------------------------------------------------------------------- DOM */
  var ch = makeChallenge();
  var seed = "skyline-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  var wrap = document.createElement("div");
  wrap.className = "gate";
  wrap.innerHTML =
    '<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gateTitle" aria-describedby="gateDesc">' +
      '<div class="gate-mark" aria-hidden="true">🛡️</div>' +
      '<h1 id="gateTitle" data-i18n="gate.title">Quick check before you come in</h1>' +
      '<p id="gateDesc">' +
        '<span data-i18n="gate.desc">This keeps scrapers off the free weather data.</span> ' +
        '<b data-i18n="gate.noAccount">No account, no login, no tracking</b> — ' +
        '<span data-i18n="gate.answerOnce">answer once and the whole site opens.</span>' +
      '</p>' +
      '<div class="gate-form">' +
        '<div class="gate-hp" aria-hidden="true">' +
          '<label for="gateCompany">Company</label>' +
          '<input id="gateCompany" name="company" type="text" tabindex="-1" autocomplete="off" />' +
        '</div>' +
        '<fieldset class="gate-q">' +
          '<legend id="gateLegend"><span data-i18n="gate.greater">Which number is greater than</span> <b>' + ch.target + '</b>?</legend>' +
          '<div class="gate-opts" role="radiogroup" aria-labelledby="gateLegend">' +
            ch.options.map(function (v) {
              return '<label class="gate-opt"><input type="radio" name="pick" value="' + v + '" />' +
                     '<span>' + v + '</span></label>';
            }).join("") +
          '</div>' +
        '</fieldset>' +
        '<p class="gate-err" id="gateErr" role="alert" aria-live="assertive"></p>' +
        '<button class="gate-go" type="button" id="gateGo" data-i18n="gate.submit">Let me in</button>' +
        '<p class="gate-fine" data-i18n="gate.fine">Takes about a second. If the check cannot reach the server, you still get in.</p>' +
      '</div>' +
      '<noscript><p class="gate-err">This site needs JavaScript enabled to load weather data.</p></noscript>' +
    '</div>';

  /* This file loads in <head>, so <body> may not exist yet. Mount as soon as
     it does — the page is already locked, so nothing shows through. */
  function translateGate() {
    if (!window.i18n) return;
    window.i18n.apply(wrap);
    goBtn.textContent = t("gate.submit", "Let me in");
  }
  if (window.i18n) window.i18n.onApply(translateGate);

  function mount() {
    document.body.appendChild(wrap);
    translateGate();      /* covers the case where the dictionary is ready */
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });

  var form = wrap.querySelector(".gate-form");
  var errEl = wrap.querySelector("#gateErr");
  var goBtn = wrap.querySelector("#gateGo");
  var hp = wrap.querySelector("#gateCompany");
  var card = wrap.querySelector(".gate-card");

  /* Focus the dialog, not the first radio: a focused radio draws a ring and
     looks already-chosen, which invites a click on "Let me in" with no answer
     picked. Tab still reaches the options immediately. */
  document.addEventListener("DOMContentLoaded", function () {
    if (!wrap.isConnected) return;
    card.setAttribute("tabindex", "-1");
    card.focus();
  }, { once: true });

  document.addEventListener("keydown", function (e) {
    if (!document.documentElement.classList.contains("gate-locked")) return;
    if (e.key !== "Tab") return;
    var f = card.querySelectorAll('input:not([type="hidden"]):not([tabindex="-1"]), button');
    var list = [].filter.call(f, function (el) { return el.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function fail(msg) {
    errEl.textContent = msg;
    goBtn.disabled = false;
    goBtn.textContent = t("gate.submit", "Let me in");
  }

  function openSite() {
    document.documentElement.classList.remove("gate-locked");
    wrap.classList.add("gate-out");
    setTimeout(function () { wrap.remove(); }, 260);
    /* hand focus to the page so screen readers start at the top */
    var main = document.querySelector("main, .wrap, h1");
    if (main) { main.setAttribute("tabindex", "-1"); main.focus(); }
  }

  goBtn.addEventListener("click", function () {
    errEl.textContent = "";

    /* 1. honeypot — a human never sees this field */
    if (hp.value.trim() !== "") { fail(t("gate.honeypot", "That did not look right. Try again.")); return; }

    /* 2. timing — nobody reads a page in under a second */
    if (Date.now() - T0 < MIN_MS) {
      fail(t("gate.tooFast", "That was very fast — give it a second and try again."));
      return;
    }

    /* 3. answer */
    var picked = form.querySelector('input[name="pick"]:checked');
    if (!picked) { fail(t("gate.pickFirst", "Pick one of the numbers first.")); return; }
    if (Number(picked.value) !== ch.answer) {
      fail("Not quite — pick the number that is larger than " + ch.target + ".");
      return;
    }

    /* 4. proof-of-work, then in we go */
    goBtn.disabled = true;
    goBtn.textContent = t("gate.checking", "Checking…");
    powAsync(seed, POW_ZEROS).then(function () {
      setVerified();
      openSite();
    }, function () {
      setVerified();          /* fail open: never trap a real person */
      openSite();
    });
  });
})();
