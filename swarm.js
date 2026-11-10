/* Swarm Rebuild — the page is erased and reconstructed as a design session.
 *
 * The look we are going for is a design tool, not "rectangles appearing":
 * every element is outlined with a 1.5px accent stroke, dimension badges sit
 * above each frame, text is typed with a blinking caret in the page's real
 * type, and the pacing is slow enough to read. Five cursors with different
 * tool glyphs do the work, flocking around whichever element is next.
 *
 * Sequence
 *   1. the page fades to blank          (450ms)
 *   2. cursors fly in and orbit the mark (1100ms)
 *   3. rebuild, element by element, the page auto-scrolling as it goes
 *   4. cursors converge, then it fades back to the live page (700ms)
 *
 * HONESTY
 *   Every string drawn is copied from the real DOM; numbers are the ones that
 *   were actually on screen. Long paragraphs are not typed out in full — the
 *   first line is typed and the rest is left as skeleton bars, so nothing is
 *   ever paraphrased or invented.
 *
 * SAFETY
 *   Skipped for reduced-motion and crawlers, waits for the bot gate, aborts on
 *   Esc or the Skip button, hard-capped in duration, and every step is wrapped
 *   so one failure cannot leave the curtain up.
 */
(function () {
  "use strict";

  var SEEN_KEY = "skyline.swarm.seen";
  var TTL = 60 * 60 * 1000;

  /* ------------------------------------------------------------- guards */

  function seen() {
    try { return Date.now() - (+localStorage.getItem(SEEN_KEY) || 0) < TTL; }
    catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {}
  }
  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function isBot() {
    return /bot|crawl|spider|slurp|bingpreview|headless|pingdom|lighthouse|googlebot/i
      .test(navigator.userAgent || "");
  }

  /* ----------------------------------------------------------- blueprint */

  /* One flat pass over the document, in paint order. Boxes first (so frames
     sit under text), then text runs. Capped so a huge page cannot produce a
     30-second animation. */
  function blueprint() {
    var boxes = [], texts = [];
    var root = document.querySelector(".wrap") || document.body;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    var limit = 190;

    function paintOf(cs) {
      var bg = cs.backgroundColor;
      var hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      /* A gradient background leaves backgroundColor transparent, so the hero
         would rebuild as an empty outline. Keep the first colour it mentions
         and paint a soft vertical wash instead. */
      var gradStops = null;
      if (!hasBg && cs.backgroundImage && cs.backgroundImage !== "none" &&
          cs.backgroundImage.indexOf("gradient") !== -1) {
        var re = /rgba?\([^)]+\)\s*([\d.]+%)?/g, m2, stops = [];
        while ((m2 = re.exec(cs.backgroundImage)) && stops.length < 8) {
          stops.push({ color: m2[1], pos: m2[2] ? parseFloat(m2[2]) / 100 : null });
        }
        if (stops.length) {
          if (stops[0].pos === null) stops[0].pos = 0;
          if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
          for (var si = 0; si < stops.length; si++) {
            if (stops[si].pos === null) stops[si].pos = si / (stops.length - 1);
          }
          gradStops = stops;
          hasBg = true;
          bg = stops[Math.floor(stops.length / 2)].color;
        }
      }

      var bw = parseFloat(cs.borderTopWidth) || 0;
      var hasBorder = bw > 0 && cs.borderTopStyle !== "none";
      return { hasBg: hasBg, bg: bg, grad: gradStops, hasBorder: hasBorder,
               border: cs.borderTopColor, bw: bw,
               radius: parseFloat(cs.borderTopLeftRadius) || 0 };
    }

    function walk(node, depth) {
      if (depth > 14) return;
      var kids = node && node.children;
      if (!kids || typeof kids.length !== "number") return;

      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        var tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" ||
            (el.classList && el.classList.contains("swarm-stage"))) continue;

        var cs = window.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (parseFloat(cs.opacity) === 0) continue;

        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;

        /* document coordinates, not viewport */
        var x = r.left, y = r.top + scrollY, w = r.width, h = r.height;

        /* Very tall elements are page wrappers, not content: draw no frame for
           them. Crucially this must NOT skip the recursion — doing that once
           dropped an entire card grid because its container was 3000px tall. */
        var tooTall = h > vh * 2.4;

        /* Real pixels, not a placeholder. The rain/temperature charts and the
           weather glyphs are canvas/SVG, so without this they rebuild as empty
           cards and the reconstruction looks hollow. */
        var mediaSrc = null;
        if (tag === "CANVAS") {
          try { if (el.width > 4 && el.height > 4) mediaSrc = el.toDataURL("image/png"); }
          catch (e) { mediaSrc = null; }          /* tainted canvas — just skip */
        } else if (tag === "IMG") {
          mediaSrc = el.currentSrc || el.src || null;
        } else if (tag === "svg" && el.parentNode && el.parentNode.tagName !== "svg") {
          try {
            /* A serialised SVG loses the page stylesheet, so every path that
               was filled by a CSS class falls back to the SVG default — black.
               Copy the computed paint onto each node first. */
            var nodes = el.querySelectorAll("*");
            for (var ni = 0; ni < nodes.length; ni++) {
              var nd = nodes[ni];
              if (nd.tagName === "stop" || nd.tagName === "linearGradient" ||
                  nd.tagName === "radialGradient" || nd.tagName === "defs") continue;
              var nc = window.getComputedStyle(nd);
              if (nc.fill && nc.fill !== "none") nd.setAttribute("fill", nc.fill);
              else if (nc.fill === "none") nd.setAttribute("fill", "none");
              if (nc.stroke && nc.stroke !== "none") {
                nd.setAttribute("stroke", nc.stroke);
                nd.setAttribute("stroke-width", nc.strokeWidth || "1");
              }
              if (nc.opacity && nc.opacity !== "1") nd.setAttribute("opacity", nc.opacity);
              if (nc.fillOpacity && nc.fillOpacity !== "1") nd.setAttribute("fill-opacity", nc.fillOpacity);
              if (nd.tagName === "text") {
                nd.setAttribute("font-size", nc.fontSize);
                nd.setAttribute("font-family", nc.fontFamily);
                nd.setAttribute("font-weight", nc.fontWeight);
              }
            }

            var svgTxt = new XMLSerializer().serializeToString(el);
            svgTxt = svgTxt.replace(/url\(#([\w:-]+)\)/g, function (full, gid) {
              var def = el.querySelector("#" + gid) ||
                        (el.ownerDocument && el.ownerDocument.getElementById(gid));
              if (!def) return full;
              var stops = def.querySelectorAll("stop");
              if (!stops.length) return full;
              var r = 0, g2 = 0, b2 = 0, cnt = 0;
              for (var k2 = 0; k2 < stops.length; k2++) {
                var sc = stops[k2].getAttribute("stop-color") || "#888";
                var d = document.createElement("div");
                d.style.color = sc;
                document.body.appendChild(d);
                var rgb = window.getComputedStyle(d).color.match(/[\d.]+/g);
                document.body.removeChild(d);
                if (rgb && rgb.length >= 3) {
                  r += +rgb[0]; g2 += +rgb[1]; b2 += +rgb[2]; cnt++;
                }
              }
              return cnt ? "rgb(" + Math.round(r / cnt) + "," + Math.round(g2 / cnt) +
                           "," + Math.round(b2 / cnt) + ")" : full;
            });
            mediaSrc = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
          } catch (e) { mediaSrc = null; }
        }

        var p = paintOf(cs);
        if (!tooTall && (p.hasBg || p.hasBorder || mediaSrc ||
            tag === "IMG" || tag === "svg" || tag === "CANVAS")) {
          if (boxes.length < limit) {
            boxes.push({
              kind: "box", x: x, y: y, w: w, h: h,
              bg: p.hasBg ? p.bg : null, grad: p.grad,
              border: p.hasBorder ? p.border : null,
              bw: p.bw, radius: p.radius,
              media: mediaSrc,
              mediaReady: null
            });
          }
        }

        /* text per TEXT NODE, measured with a Range so wrapped lines and
           mixed-content parents each get their true box */
        for (var n = 0; n < el.childNodes.length; n++) {
          var tn = el.childNodes[n];
          if (tn.nodeType !== 3) continue;
          var val = tn.nodeValue;
          if (!val || !val.trim()) continue;

          var range = document.createRange();
          range.selectNodeContents(tn);
          var rects = range.getClientRects();
          if (range.detach) range.detach();
          if (!rects.length) continue;

          var q = rects[0];
          if (q.width < 2 || q.height < 2) continue;

          var dup = false;
          for (var d = 0; d < texts.length; d++) {
            var o = texts[d];
            var ox = Math.max(0, Math.min(o.x + o.w, q.left + q.width) - Math.max(o.x, q.left));
            var oy = Math.max(0, Math.min(o.y - scrollY + o.h, q.top + q.height) - Math.max(o.y - scrollY, q.top));
            if (ox * oy > 0.55 * Math.min(o.w * o.h, q.width * q.height)) { dup = true; break; }
          }

          if (!dup && texts.length < limit) {
            texts.push({
              kind: "text",
              x: q.left, y: q.top + scrollY, w: q.width, h: q.height,
              text: val.replace(/\s+/g, " ").trim(),
              size: parseFloat(cs.fontSize) || 14,
              weight: cs.fontWeight,
              color: cs.color,
              family: cs.fontFamily,
              lines: rects.length
            });
          }
        }

        walk(el, depth + 1);
      }
    }

    walk(root, 0);
    return { boxes: boxes, texts: texts };
  }

  /* ------------------------------------------------------------ the crew */

  var CREW = [
    { name: "Ada",  color: "#4f8cff", tool: "arrow" },
    { name: "Kai",  color: "#22c55e", tool: "crosshair" },
    { name: "Mira", color: "#f59e0b", tool: "pen" },
    { name: "Noor", color: "#a855f7", tool: "ibeam" },
    { name: "Ivo",  color: "#06b6d4", tool: "arrow" },
    { name: "Rui",  color: "#f472b6", tool: "crosshair" },
    { name: "Sol",  color: "#a3e635", tool: "pen" }
  ];

  function toolPath(tool, color) {
    if (tool === "crosshair") {
      return '<path d="M12 3v18M3 12h18" stroke="' + color + '" stroke-width="1.6"/>' +
             '<circle cx="12" cy="12" r="4.2" fill="' + color + '"/>';
    }
    if (tool === "pen") {
      return '<path d="M4 20l4-1 9-9-3-3-9 9z" fill="' + color + '" stroke="#fff" stroke-width="1.1"/>';
    }
    if (tool === "ibeam") {
      return '<path d="M9 4h6M9 20h6M12 4v16" stroke="' + color + '" stroke-width="2.1"/>';
    }
    return '<path d="M4 2l7 18 2.4-6.6L20 11z" fill="' + color + '" stroke="#fff" stroke-width="1.2"/>';
  }

  /* --------------------------------------------------------------- main */

  function run() {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    var pageBg = isLight ? "#eef3fb" : "#070b18";
    var bp = blueprint();
    var boxes = bp.boxes, texts = bp.texts;
    if (!boxes.length && !texts.length) return;

    var vw = window.innerWidth, vh = window.innerHeight;
    var docH = Math.max(document.documentElement.scrollHeight, vh);
    var startScroll = window.scrollY || 0;

    /* ---- stage ---- */
    var stage = document.createElement("div");
    stage.className = "swarm-stage";
    stage.setAttribute("aria-hidden", "true");

    var canvas = document.createElement("canvas");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    var bgColor = window.getComputedStyle(document.body).backgroundColor;
    if (!bgColor || bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent") bgColor = pageBg;
    stage.appendChild(canvas);

    var hud = document.createElement("div");
    hud.className = "swarm-hud";
    hud.innerHTML = '<b>0</b> / ' + (boxes.length + texts.length);
    stage.appendChild(hud);

    var skip = document.createElement("button");
    skip.type = "button"; skip.className = "swarm-skip"; skip.textContent = "Skip";
    stage.appendChild(skip);

    document.body.appendChild(stage);
    document.documentElement.classList.add("swarm-live");

    var crew = CREW.map(function (c, i) {
      var n = document.createElement("div");
      n.className = "swarm-cursor";
      n.style.setProperty("--c", c.color);
      n.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24">' + toolPath(c.tool, c.color) + "</svg>" +
        '<span class="swarm-tag">' + c.name + "</span>";
      var sx = i % 2 ? vw + 70 : -70;
      var sy = vh * (0.25 + 0.12 * i);
      n.style.transform = "translate(" + sx + "px," + sy + "px)";
      stage.appendChild(n);
      return { node: n, spec: c, x: sx, y: sy, tx: sx, ty: sy };
    });

    /* ---- scroll controller: the canvas follows the build down the page ---- */
    var scrollY = startScroll;
    function applyScroll() {
      window.scrollTo(0, scrollY);
    }

    /* ---- state for the redraw ---- */
    var drawnBoxes = [];   /* {item, progress} */
    var drawnTexts = [];   /* {item, chars} */
    var activeText = null;

    function drawFrame() {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, vw, vh);
      var off = scrollY;

      /* frames */
      for (var i = 0; i < drawnBoxes.length; i++) {
        var d = drawnBoxes[i], b = d.item;
        var yy = b.y - off;
        if (yy > vh + 60 || yy + b.h < -60) continue;

        var e = d.progress;
        var cw = b.w * e, ch = b.h * e;

        ctx.save();
        ctx.beginPath();
        var rr = Math.min(b.radius || 0, cw / 2, ch / 2);
        if (rr > 0.5 && ctx.roundRect) ctx.roundRect(b.x, yy, cw, ch, rr);
        else ctx.rect(b.x, yy, cw, ch);

        if (b.bg) {
          ctx.globalAlpha = 0.95 * e;
          if (b.grad && b.grad.length) {
            /* real stops, real alpha — they composite onto the page background
               exactly as CSS does, so a translucent hero stays translucent */
            var g = ctx.createLinearGradient(b.x, yy, b.x + cw * 0.5, yy + ch);
            for (var gi = 0; gi < b.grad.length; gi++) {
              var st = b.grad[gi];
              try { g.addColorStop(Math.max(0, Math.min(1, st.pos)), st.color); }
              catch (e3) { /* bad stop: skip it rather than lose the fill */ }
            }
            ctx.fillStyle = g;
          } else {
            ctx.fillStyle = b.bg;
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        /* real pixels, uncovered as the frame grows */
        if (b.media) {
          if (!b._img) {
            b._img = new Image();
            b._img.onload = function () { b.mediaReady = true; };
            b._img.onerror = function () { b.mediaReady = false; };
            b._img.src = b.media;
          }
          if (b.mediaReady) {
            ctx.save();
            ctx.beginPath();
            if (rr > 0.5 && ctx.roundRect) ctx.roundRect(b.x, yy, cw, ch, rr);
            else ctx.rect(b.x, yy, cw, ch);
            ctx.clip();
            ctx.globalAlpha = Math.min(1, e * 1.4);
            try { ctx.drawImage(b._img, b.x, yy, b.w, b.h); } catch (e2) {}
            ctx.restore();
          }
        }

        /* the design-tool outline every frame carries */
        ctx.globalAlpha = 0.55 + 0.45 * e;
        ctx.strokeStyle = d.accent || "rgba(120,160,255,.85)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();

        /* dimension badge */
        if (e > 0.35) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (e - 0.35) / 0.5);
          ctx.font = "600 10.5px ui-sans-serif,system-ui,sans-serif";
          var label = Math.round(b.w) + " × " + Math.round(b.h);
          var tw = ctx.measureText(label).width;
          var bx = b.x, by = yy - 16;
          ctx.fillStyle = isLight ? "rgba(255,255,255,.92)" : "rgba(10,16,32,.86)";
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx - 4, by - 11, tw + 10, 15, 4); ctx.fill(); }
          else ctx.fillRect(bx - 4, by - 11, tw + 10, 15);
          ctx.fillStyle = d.accent || "#7aa2ff";
          ctx.fillText(label, bx + 1, by);
          ctx.restore();
        }
      }

      /* text */
      for (var j = 0; j < drawnTexts.length; j++) {
        var t = drawnTexts[j], it = t.item;
        var ty = it.y - off;
        if (ty > vh + 40 || ty + it.h < -40) continue;
        paintText(it, t.chars, ty, t.caret);
      }

      /* the cursor working on the current text also shows a caret */
      if (activeText) {
        var at = activeText;
        var ay = at.item.y - off + at.item.h / 2;
        if (ay > -20 && ay < vh + 20) {
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = at.item.color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(at.x, ay - at.item.size * 0.6);
          ctx.lineTo(at.x, ay + at.item.size * 0.6);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function wrapLines(text, maxW, font) {
      ctx.font = font;
      var words = text.split(" "), lines = [], cur = "";
      for (var i = 0; i < words.length; i++) {
        var test = cur ? cur + " " + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [text];
    }

    /* Long paragraphs are not typed in full: the first line is real, the rest
       becomes skeleton bars. Nothing is invented, nothing is paraphrased. */
    function paintText(it, chars, y, caret) {
      var font = it.weight + " " + it.size + "px " + it.family;
      ctx.save();
      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.fillStyle = it.color;

      var MAXTYPE = 64;
      var typing = it.text.length > MAXTYPE;
      var head = typing ? it.text.slice(0, MAXTYPE) : it.text;
      var shown = head.slice(0, chars);

      var lines = wrapLines(shown, it.w + 2, font);
      var lh = it.size * 1.34;
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], it.x, y + it.h / 2 + i * lh);
      }

      /* skeleton bars for the untold remainder */
      if (typing && chars >= head.length) {
        var restY = y + it.h / 2 + lines.length * lh;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = it.color;
        for (var k = 0; k < 2; k++) {
          var bw2 = it.w * (k === 1 ? 0.52 : 0.78);
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(it.x, restY + k * (it.size * 0.9) - 3, bw2, Math.max(4, it.size * 0.42), 3);
          else ctx.rect(it.x, restY + k * (it.size * 0.9) - 3, bw2, Math.max(4, it.size * 0.42));
          ctx.fill();
        }
      }
      ctx.restore();
    }

    /* ------------------------------------------------------- timeline */

    /* Build an ordered script. Boxes are laid down as their ancestors were —
       top to bottom — then text is typed into them. */
    var order = [];
    boxes.forEach(function (b) { order.push({ type: "box", item: b }); });
    texts.forEach(function (t) { order.push({ type: "text", item: t }); });
    order.sort(function (a, b) {
      if (Math.abs(a.item.y - b.item.y) > 6) return a.item.y - b.item.y;
      return a.type === "box" ? -1 : 1;
    });

    /* pace: slow and deliberate. Text typing dominates the time. */
    /* Five lanes, one per cursor: each agent takes the next element as soon
       as it is free. That is what makes the crew look like a team rather than
       a queue, and it divides the total time by roughly five. */
    var steps = [];
    var laneFree = crew.map(function () { return 1550; });
    order.forEach(function (o) {
      var lane = 0;
      for (var i = 1; i < laneFree.length; i++) {
        if (laneFree[i] < laneFree[lane]) lane = i;
      }
      var dur, gap;
      if (o.type === "box") { dur = 130; gap = 18; }
      else {
        var chars = Math.min(o.item.text.length, 64);
        dur = Math.min(620, 110 + chars * 9);
        gap = 14;
      }
      steps.push({ at: laneFree[lane], dur: dur, item: o.item, agent: lane, kind: o.type });
      laneFree[lane] += dur + gap;
    });
    var endAt = Math.max.apply(null, laneFree) + 260;

    /* -------------------------------------------------------- playback */

    var done = false;
    function finish() {
      if (done) return;
      done = true;
      markSeen();
      stage.classList.add("swarm-out");
      document.documentElement.classList.remove("swarm-live");
      window.scrollTo(0, startScroll);
      setTimeout(function () {
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }, 760);
      window.removeEventListener("keydown", onKey);
      skip.removeEventListener("click", finish);
    }
    function onKey(e) { if (e.key === "Escape") finish(); }
    window.addEventListener("keydown", onKey);
    skip.addEventListener("click", finish);

    var cursorIdx = 0;
    var t0 = performance.now();

    /* intro: flock around the brand mark */
    var brand = document.querySelector(".brand .mark") || document.querySelector(".brand");
    var anchor = { x: vw / 2, y: vh / 2 };
    if (brand) {
      var br = brand.getBoundingClientRect();
      anchor = { x: br.left + br.width / 2, y: br.top + br.height / 2 };
    }
    crew.forEach(function (c, i) {
      var ang = (i / crew.length) * Math.PI * 2;
      c.tx = anchor.x + Math.cos(ang) * 90;
      c.ty = anchor.y + Math.sin(ang) * 62;
    });

    function frame(now) {
      if (done) return;
      var el = now - t0;

      /* consume steps */
      while (steps.length && steps[0].at <= el) {
        var s = steps.shift();
        try {
          var a = crew[s.agent];
          var it = s.item;

          /* keep the work in view */
          var want = it.y - vh * 0.42;
          if (want > startScroll && want < docH - vh) {
            scrollY = Math.max(startScroll, Math.min(want, docH - vh));
            applyScroll();
          }

          a.tx = it.x + Math.min(it.w * 0.6, 70);
          a.ty = it.y - scrollY + it.h * 0.5;

          if (s.kind === "box") {
            var rec = { item: it, progress: 0, accent: a.spec.color, at: el, dur: s.dur };
            drawnBoxes.push(rec);
          } else {
            var rec2 = { item: it, chars: 0, at: el, dur: s.dur, agent: a };
            drawnTexts.push(rec2);
            activeText = { item: it, x: it.x, agent: a };
          }
          hud.innerHTML = "<b>" + (drawnBoxes.length + drawnTexts.length) + "</b> / " + order.length;
        } catch (e) { /* a single bad step must not stop the show */ }
      }

      /* advance progress */
      for (var i = 0; i < drawnBoxes.length; i++) {
        var d = drawnBoxes[i];
        var k = Math.min(1, (el - d.at) / d.dur);
        d.progress = 1 - Math.pow(1 - k, 3);
      }
      for (var j = 0; j < drawnTexts.length; j++) {
        var dt = drawnTexts[j];
        var kk = Math.min(1, (el - dt.at) / dt.dur);
        var maxChars = Math.min(dt.item.text.length, 64);
        dt.chars = Math.round(maxChars * kk);
      }
      if (activeText) {
        var lastDone = drawnTexts.length && drawnTexts[drawnTexts.length - 1];
        if (!lastDone || (el - lastDone.at) > lastDone.dur) activeText = null;
        else activeText.x = lastDone.item.x + Math.min(lastDone.item.w, lastDone.chars * lastDone.item.size * 0.52);
      }

      /* ease cursors toward their targets */
      crew.forEach(function (c) {
        c.x += (c.tx - c.x) * 0.13;
        c.y += (c.ty - c.y) * 0.13;
        c.node.style.transform = "translate(" + c.x + "px," + c.y + "px)";
      });

      drawFrame();

      if (el < endAt) requestAnimationFrame(frame);
      else {
        /* finale: converge, then reveal */
        crew.forEach(function (c, i) {
          c.tx = vw / 2 - 70 + i * 34;
          c.ty = vh * 0.55;
        });
        hud.innerHTML = "rebuilt";
        setTimeout(finish, 520);
      }
    }
    requestAnimationFrame(frame);

    /* absolute ceiling */
    setTimeout(finish, 60000);
  }

  /* --------------------------------------------------------------- boot */

  function boot() {
    if (isBot() || reduced()) return;
    if (location.search.indexOf("swarm=1") === -1 && seen()) return;

    var waited = 0;
    var poll = setInterval(function () {
      waited += 200;
      if (document.documentElement.classList.contains("gate-locked") ||
          document.readyState === "loading") {
        if (waited > 30000) clearInterval(poll);
        return;
      }
      /* wait for the first real reading so the snapshot holds true numbers */
      var temp = document.getElementById("temp");
      var ready = temp && /\d/.test(temp.textContent || "");
      if (!ready && waited < 12000) return;

      clearInterval(poll);
      setTimeout(function () {
        try { run(); }
        catch (e) {
          if (window.console) console.warn("[swarm] rebuild failed:", e);
        }
      }, 300);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
