/* Swarm reveal — the page rebuilds itself before your eyes.
 *
 * WHAT THIS IS
 * ------------
 * A one-time, first-impression animation. When a visitor arrives, a few
 * cursors fly in, drag out the boxes that make up the page, type the headings
 * and values, and then the real page fades in exactly as it would have looked
 * anyway. Nothing about the site changes afterwards: the swarm is a curtain,
 * not a second implementation of the page.
 *
 * In particular this does NOT snapshot and recreate the DOM the way the
 * "Swarm Rebuild" browser extension does. Recreating your weather cards would
 * mean duplicating the layout engine, and it would show fake values for a
 * moment. Here the boxes are empty frames: the real data appears when the real
 * page is revealed.
 *
 * RULES IT FOLLOWS
 * ----------------
 *   - NEVER shows a fabricated number. Boxes are outlines only.
 *   - Runs ONCE per visitor (localStorage), and only on the forecast page.
 *   - Skipped entirely for prefers-reduced-motion, for crawlers, and when the
 *     visitor has the bot-check gate up — the gate comes first.
 *   - Fades to the live page; it never hides content permanently. If anything
 *     throws, the page is revealed anyway.
 *   - Uses the site's own palette, so light and dark themes both look right.
 */
(function () {
  "use strict";

  var STORE_KEY = "skyline.swarm.seen";
  var FORCE_KEY = "?swarm=1";           /* manual replay for demos */
  var SESSION_MS = 60 * 60 * 1000;      /* remember for an hour */

  /* ---------------------------------------------------------------- guards */

  function seen() {
    try {
      var t = +localStorage.getItem(STORE_KEY) || 0;
      return Date.now() - t < SESSION_MS;
    } catch (e) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(STORE_KEY, String(Date.now())); } catch (e) {}
  }

  function reducedMotion() {
    return window.matchMedia &&
           window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isBot() {
    return /bot|crawl|spider|slurp|bingpreview|headless|pingdom|lighthouse/i
      .test(navigator.userAgent || "");
  }

  function themed() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? { bg: "#eef3fb", line: "#93a7c8", ink: "#22304a", dim: "#8fa1bd" }
      : { bg: "#0b1020", line: "#3b4a6b", ink: "#e8eefc", dim: "#6b7b9c" };
  }

  /* ----------------------------------------------------------------- cursors */

  var CURSORS = [
    { name: "Ada",   color: "#4f8cff", tool: "arrow" },
    { name: "Kai",   color: "#22c55e", tool: "crosshair" },
    { name: "Mira",  color: "#f59e0b", tool: "pen" },
    { name: "Noor",  color: "#a855f7", tool: "ibeam" }
  ];

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* ------------------------------------------------------------------- main */

  function run() {
    var t = themed();
    var stage = el("div", "swarm-stage");
    stage.setAttribute("aria-hidden", "true");
    stage.style.background = t.bg;
    stage.style.setProperty("--swarm-line", t.line);
    stage.style.setProperty("--swarm-ink", t.ink);
    stage.style.setProperty("--swarm-dim", t.dim);

    var layer = el("div", "swarm-items");
    stage.appendChild(layer);

    var hud = el("div", "swarm-hud");
    hud.textContent = "building…";
    stage.appendChild(hud);

    var skip = el("button", "swarm-skip");
    skip.type = "button";
    skip.textContent = "Skip";
    stage.appendChild(skip);

    document.body.appendChild(stage);
    document.documentElement.classList.add("swarm-live");

    /* the four cursors */
    var pointers = CURSORS.map(function (c) {
      var p = el("div", "swarm-cursor");
      p.style.setProperty("--c", c.color);
      p.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
        '<path d="M4 2l7 18 2.4-6.6L20 11z" fill="' + c.color + '" stroke="#fff" stroke-width="1.3"/></svg>' +
        '<span class="swarm-tag">' + c.name + "</span>";
      p.style.transform = "translate(-80px,-80px)";
      stage.appendChild(p);
      return { node: p, spec: c, x: -80, y: -80, tx: -80, ty: -80 };
    });

    var done = false;

    function finish() {
      if (done) return;
      done = true;
      markSeen();
      stage.classList.add("swarm-out");
      document.documentElement.classList.remove("swarm-live");
      window.setTimeout(function () {
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }, 620);
      window.removeEventListener("keydown", onKey);
      skip.removeEventListener("click", finish);
    }

    function onKey(e) { if (e.key === "Escape") finish(); }
    window.addEventListener("keydown", onKey);
    skip.addEventListener("click", finish);

    /* Everything runs off one rAF loop so the cursors glide instead of
       teleporting, and so a slow machine degrades to fewer frames rather than
       a broken sequence. */
    var t0 = performance.now();
    var steps = buildSteps(t, layer, hud, pointers);

    function frame(now) {
      if (done) return;
      var elapsed = now - t0;

      /* move every cursor toward its target with a spring-ish ease */
      pointers.forEach(function (p) {
        p.x += (p.tx - p.x) * 0.14;
        p.y += (p.ty - p.y) * 0.14;
        p.node.style.transform = "translate(" + p.x + "px," + p.y + "px)";
      });

      /* run any step whose time has come */
      while (steps.length && steps[0].at <= elapsed) {
        var s = steps.shift();
        try { s.fn(); } catch (e) { /* one bad step must not stop the show */ }
      }

      if (steps.length) window.requestAnimationFrame(frame);
      else window.setTimeout(finish, 320);
    }
    window.requestAnimationFrame(frame);

    /* hard stop, whatever happens */
    window.setTimeout(finish, 6200);
  }

  /* --------------------------------------------------------- choreography */

  function buildSteps(t, layer, hud, pointers) {
    var steps = [];
    var at = 0;

    /* Where the boxes go: measured from the live page while it is still
       blurred behind the curtain. Using real geometry means the frames land
       where the content actually appears, so the reveal has no jump. */
    var targets = [];
    var hero = document.getElementById("hero");
    if (hero) {
      var r = hero.getBoundingClientRect();
      targets.push({ x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 260), kind: "block" });
    }
    var cards = document.querySelectorAll("section.card");
    for (var i = 0; i < Math.min(cards.length, 6); i++) {
      var cr = cards[i].getBoundingClientRect();
      if (cr.width < 40) continue;
      targets.push({ x: cr.left, y: cr.top, w: cr.width, h: Math.min(cr.height, 190), kind: "card" });
    }

    function cursorTo(idx, x, y) {
      pointers[idx].tx = x;
      pointers[idx].ty = y;
    }

    /* 1. the swarm arrives */
    steps.push({ at: at, fn: function () {
      hud.textContent = "swarm arriving…";
      pointers.forEach(function (p, i) {
        cursorTo(i, 120 + i * 80, 130 + (i % 2) * 60);
      });
    }});
    at += 420;

    /* 2. drag out each frame, in page order */
    var share = Math.max(190, Math.floor(2600 / Math.max(targets.length, 1)));
    targets.forEach(function (tg, i) {
      steps.push({ at: at, fn: function () {
        var p = pointers[i % pointers.length];
        cursorTo(i % pointers.length, tg.x + 24, tg.y + 22);
        hud.textContent = tg.kind === "card" ? "drawing a card" : "framing the header";

        var box = document.createElement("div");
        box.className = "swarm-box";
        box.style.left = tg.x + "px";
        box.style.top = tg.y + "px";
        box.style.width = "0px";
        box.style.height = "0px";
        box.style.borderColor = p.spec.color;
        layer.appendChild(box);

        /* animate the frame outward — the "drag" */
        window.requestAnimationFrame(function () {
          box.style.width = tg.w + "px";
          box.style.height = tg.h + "px";
        });

        /* a size badge, like a design tool */
        var badge = document.createElement("div");
        badge.className = "swarm-badge";
        badge.textContent = Math.round(tg.w) + " × " + Math.round(tg.h);
        badge.style.left = (tg.x + 8) + "px";
        badge.style.top = (tg.y - 22) + "px";
        badge.style.color = p.spec.color;
        layer.appendChild(badge);
      }});
      at += share;

      /* skeleton lines inside the frame — no text, so no invented content */
      steps.push({ at: at - 120, fn: function () {
        var p = pointers[(i + 1) % pointers.length];
        var lines = tg.kind === "card" ? 3 : 2;
        for (var L = 0; L < lines; L++) {
          var ln = el("div", "swarm-line");
          ln.style.left = (tg.x + 16) + "px";
          ln.style.top = (tg.y + 44 + L * 26) + "px";
          ln.style.width = (tg.w * (L === 0 ? 0.42 : 0.66)) + "px";
          layer.appendChild(ln);
        }
        cursorTo((i + 1) % pointers.length, tg.x + tg.w * 0.45, tg.y + 60);
      }});
    });

    /* 3. the real headline, typed in the middle — it is the page's own title,
       so it is not invented content */
    steps.push({ at: at, fn: function () {
      hud.textContent = "typing";
      var title = document.querySelector("h1");
      var text = (title && title.textContent.trim()) || "Skyline";
      var typed = el("div", "swarm-typed");
      typed.style.left = "50%";
      typed.style.top = "44%";
      layer.appendChild(typed);

      var n = 0;
      var timer = window.setInterval(function () {
        typed.textContent = text.slice(0, ++n) + (n < text.length ? "▌" : "");
        if (n >= text.length) window.clearInterval(timer);
      }, 34);
    }});
    at += 900;

    /* 4. cursors gather, then the curtain lifts */
    steps.push({ at: at, fn: function () {
      hud.textContent = "ready";
      pointers.forEach(function (p, i) {
        cursorTo(i, window.innerWidth / 2 - 60 + i * 40, window.innerHeight * 0.56);
      });
    }});

    return steps;
  }

  /* ------------------------------------------------------------------ boot */

  function boot() {
    if (isBot()) return;
    if (reducedMotion()) return;

    var forced = location.search.indexOf(FORCE_KEY) !== -1;
    if (!forced && seen()) return;

    /* The bot-check gate owns the first screen. Wait for it to be dismissed,
       and give up after a while rather than hanging behind a locked page. */
    var waited = 0;
    var poll = window.setInterval(function () {
      waited += 200;
      var locked = document.documentElement.classList.contains("gate-locked");
      var stillParsing = document.readyState === "loading";
      if (!locked && !stillParsing) {
        window.clearInterval(poll);
        if (location.hash === "#guide") return;   /* jumped straight to guide */
        run();
      } else if (waited > 30000) {
        window.clearInterval(poll);
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
