/* =========================================================================
   THICKET: thicket-styles.js
   The seven growth styles: Tree, Bamboo, River Reed, Mycelium, Fern,
   Coral Bloom, Bramble. thicket-app.js paints the background then calls
   ThicketStyles.draw(context, width, height, settings).

   Edge styles (tree, bamboo, reed, mycelium, fern) begin exactly on the
   picture edge. Centre styles (coral, bramble) grow outward from the
   middle. Everything is drawn from the seed, so the same seed and
   settings always give the same picture.
   ========================================================================= */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var HALF = Math.PI / 2;

  /* ---------- small helpers ---------- */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hash(str) {
    var h = 2166136261 >>> 0;
    str = String(str || "thicket");
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* repeatable random, tied to a counter or an index */
  function cr(seed, i, s) {
    var h = (seed ^ Math.imul(Math.abs(Math.floor(i)) + 1, 374761393) ^ Math.imul(s + 1, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function hexToRgb(h) {
    h = String(h || "#000000").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clamp(a, 0, 1) + ")";
  }
  function mixHex(a, b, t) {
    var ca = hexToRgb(a), cb = hexToRgb(b);
    return "rgb(" +
      Math.round(lerp(ca[0], cb[0], t)) + "," +
      Math.round(lerp(ca[1], cb[1], t)) + "," +
      Math.round(lerp(ca[2], cb[2], t)) + ")";
  }
  /* blend along the palette, t from 0 (root) to 1 (tip) */
  function colGrad(cols, t) {
    t = clamp(t, 0, 1);
    var seg = t * (cols.length - 1);
    var i = Math.min(cols.length - 2, Math.floor(seg));
    return mixHex(cols[i], cols[i + 1], seg - i);
  }

  /* shortest rotation from a toward target, by amount amt */
  function turnToward(a, target, amt) {
    var d = ((target - a + Math.PI * 3) % TAU) - Math.PI;
    return a + d * amt;
  }

  /* =======================================================================
     ROOTS: where each edge-grown piece starts
     The base sits a hair beyond the picture edge so lines appear to come
     in from outside the frame.
     ======================================================================= */
  function edgeRoots(S, count) {
    var W = S.W, H = S.H, o = S.p.origin, out = [];
    var m = 1; /* start just past the edge */

    function place(e, f) {
      var x, y, ang;
      if (e === "b") { x = W * f; y = H + m; ang = -HALF; }
      else if (e === "t") { x = W * f; y = -m; ang = HALF; }
      else if (e === "l") { x = -m; y = H * f; ang = 0; }
      else { x = W + m; y = H * f; ang = Math.PI; }
      ang += S.lean;
      /* flare sides outward with spread */
      ang += (f - 0.5) * 2 * (0.1 + S.spread * 0.55);
      out.push({ x: x, y: y, a: ang });
    }

    if (o === "two") { var h = Math.max(1, Math.ceil(count / 2));
      for (var i = 0; i < h; i++) place("b", (i + 0.5) / h);
      for (var j = 0; j < h; j++) place("t", (j + 0.5) / h);
      return out;
    }
    if (o === "sides") { var s = Math.max(1, Math.ceil(count / 2));
      for (var k = 0; k < s; k++) place("l", (k + 0.5) / s);
      for (var l = 0; l < s; l++) place("r", (l + 0.5) / s);
      return out;
    }
    if (o === "all") { var q = Math.max(1, Math.ceil(count / 4));
      for (var a = 0; a < q; a++) place("b", (a + 0.5) / q);
      for (var b = 0; b < q; b++) place("t", (b + 0.5) / q);
      for (var c2 = 0; c2 < q; c2++) place("l", (c2 + 0.5) / q);
      for (var d2 = 0; d2 < q; d2++) place("r", (d2 + 0.5) / q);
      return out;
    }
    if (o === "corners") {
      var qc = Math.max(1, Math.ceil(count / 4));
      var cs = [[0, H], [W, H], [0, 0], [W, 0]];
      for (var ci = 0; ci < 4; ci++) {
        for (var n = 0; n < qc; n++) {
          var f = 0.06 + cr(S.seed, ci * 10 + n, 60) * 0.08;
          var edgeV = n % 2 === 0;
          var x, y;
          if (cs[ci][0] === 0 || cs[ci][0] === W) {
            if (edgeV) { x = cs[ci][0] + (cs[ci][0] === 0 ? -m : m); y = cs[ci][1] + (cs[ci][1] === 0 ? f : -f) * H; }
            else { x = cs[ci][0] + (cs[ci][0] === 0 ? f : -f) * W; y = cs[ci][1] + (cs[ci][1] === 0 ? -m : m); }
          } else {
            if (edgeV) { x = cs[ci][0] + (cs[ci][0] === 0 ? f : -f) * W; y = cs[ci][1] + (cs[ci][1] === 0 ? -m : m); }
            else { x = cs[ci][0] + (cs[ci][0] === 0 ? -m : m); y = cs[ci][1] + (cs[ci][1] === 0 ? f : -f) * H; }
          }
          var aq = Math.atan2(H / 2 - y, W / 2 - x) || 0;
          out.push({ x: x, y: y, a: aq + S.lean });
        }
      }
      return out;
    }
    /* single edge: bottom, top, left or right */
    for (var i2 = 0; i2 < count; i2++) place(o, (i2 + 0.5) / count);
    return out;
  }

  /* colour for one stroke: fade along t, else by limb number */
  function strokeCol(S, t, limb) {
    if (S.p.colourStyle === "limb") return S.cols[(Math.abs(limb)) % 4];
    if (S.p.colourStyle === "random") return S.cols[Math.floor(cr(S.seed, limb, 77) * 4) % 4];
    return colGrad(S.cols, t);
  }

  /* ---------- tip glyphs: dots, buds, leaves ---------- */
  function tip(S, x, y, a, col) {
    var size = S.lw * (0.7 + S.tipSize * 0.9);
    var t = S.p.tips;
    if (t === "none" || !col) return;
    if (t === "dots") {
      S.c.beginPath(); S.c.arc(x, y, size * 0.6, 0, TAU);
      S.c.fillStyle = rgba(col, 1); S.c.fill();
    } else if (t === "buds") {
      S.c.beginPath(); S.c.arc(x, y, size * 0.8, 0, TAU);
      S.c.fillStyle = rgba(col, 0.9); S.c.fill();
      S.c.beginPath(); S.c.arc(x, y, size * 0.45, 0, TAU);
      S.c.fillStyle = rgba(S.cols[3], 1); S.c.fill();
    } else {
      /* leaves: a short spine with a blade on each side */
      var len = size * 1.7;
      var px = x + Math.cos(a) * len * 0.25, py = y + Math.sin(a) * len * 0.25;
      S.c.beginPath(); S.c.moveTo(x, y); S.c.lineTo(px, py);
      S.c.strokeStyle = rgba(col, 1); S.c.lineWidth = Math.max(1, S.lw * 0.5); S.c.stroke();
      [-0.55, 0.55].forEach(function (side) {
        var ca = a + side;
        var bx = px + Math.cos(ca) * len, by = py + Math.sin(ca) * len;
        S.c.beginPath();
        S.c.moveTo(px, py);
        S.c.quadraticCurveTo(
          px + Math.cos(ca) * len * 0.6 + Math.cos(ca + HALF) * len * 0.18,
          py + Math.sin(ca) * len * 0.6 + Math.sin(ca + HALF) * len * 0.18,
          bx, by
        );
        S.c.lineWidth = Math.max(1, S.lw * 0.55); S.c.stroke();
      });
    }
  }

  /* =======================================================================
     TREE
     Trunk starts on the edge and grows inward, splitting as it reaches.
     ======================================================================= */
  function tree(S) {
    var c = S.c;
    var count = 2 + Math.round(S.density * 8);
    var roots = edgeRoots(S, count);
    c.lineCap = "round"; c.lineJoin = "round";

    var tipsArr = [];
    roots.forEach(function (root, ri) {
      var w0 = S.lw * lerp(1.6, 3.2, S.scale);
      S.branch(root.x, root.y, root.a,
        S.reachLen * (0.8 + cr(S.seed, ri, 1) * 0.25),
        w0, S.depth, 0, ri, 0, tipsArr);
    });

    tipsArr.forEach(function (tp) {
      tip(S, tp[0], tp[1], tp[2], tp[3]);
    });
  }

  /* shared recursive limb used by tree and mycelium */
  function limb(S, x, y, a, len, w, d, id, t0, tipsArr, opts) {
    if (d <= 0 || len < 3 || S.strokes > 5200) {
      if (S.strokes <= 5200) tipsArr.push([x, y, a, strokeCol(S, clamp(t0, 0, 1), id)]);
      return;
    }
    opts = opts || {};
    var steps = 7 + d;
    var taper = S.taperF;
    var px = x, py = y, pa = a, cur;
    var wob = S.numCurl;

    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      cur = pa + Math.sin(S.phase + id * 1.7 + i * 0.85) * wob * 0.55;
      var nx = x + Math.cos(cur) * len * t;
      var ny = y + Math.sin(cur) * len * t;
      S.c.beginPath(); S.c.moveTo(px, py); S.c.lineTo(nx, ny);
      S.c.strokeStyle = strokeCol(S, t0 + t * (1 - t0), id);
      S.c.lineWidth = Math.max(0.7, w * Math.pow(taper, i / steps * 0.9));
      S.c.stroke();
      S.strokes++;
      px = nx; py = ny; pa = cur;
    }

    var kids = d > 2 ? (cr(S.seed, id * 13 + d, 2) < 0.3 ? 3 : 2) : (d === 2 ? 2 : 0);
    if (d <= 1) kids = 0;
    var span = 0.3 + S.spread * 0.55;
    for (var k = 0; k < kids; k++) {
      var side = (k - (kids - 1) / 2) * 2;
      var ba = pa + side * span + (cr(S.seed, id * 7 + k + d, 3) - 0.5) * 0.45 + S.lean * 0.2;
      limb(S, px, py, ba,
        len * (0.62 + cr(S.seed, id * 5 + k, 4) * 0.16),
        w * taper, d - 1, id * Math.max(kids, 2) + k + 1, t0 + 0.08, tipsArr, opts);
    }
  }

  /* =======================================================================
     BAMBOO
     Straight jointed stalks from the edge, leaves at the joints.
     ======================================================================= */
  function bamboo(S) {
    var c = S.c;
    var count = Math.max(1, Math.round(S.p.bambooCount));
    var roots = edgeRoots(S, count);
    var bend = clamp(num(S.p.bambooBend) / 100, 0, 0.5);
    var joints = lerp(0.05, 0.3, clamp(num(S.p.bambooJoints) / 100, 0, 1));
    var w = S.lw * lerp(0.7, 2.4, clamp(num(S.p.bambooWidth) / 100, 0, 1));
    var lLen = S.lw * lerp(1.4, 4.2, clamp(num(S.p.bambooLeafLen) / 100, 0, 1));
    var lAng = HALF * lerp(0.2, 1.2, clamp(num(S.p.bambooLeafAngle) / 100, 0, 1));
    c.lineCap = "round"; c.lineJoin = "round";

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.7 + cr(S.seed, ri, 10) * 0.3);
      var perp = root.a + HALF;
      var bendAmt = (cr(S.seed, ri, 11) - 0.5) * 2 * bend * (S.spread + 0.4);
      var px = root.x, py = root.y, x, y;
      for (var i = 1; i <= 26; i++) {
        var t = i / 26;
        var off = Math.sin(t * Math.PI) * L * bendAmt * 1.6;
        c.beginPath(); c.moveTo(px, py);
        x = root.x + Math.cos(root.a) * L * t + Math.cos(perp) * off;
        y = root.y + Math.sin(root.a) * L * t + Math.sin(perp) * off;
        c.lineCap = "round";
        c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, ri);
        c.lineWidth = Math.max(0.7, w * (1 - t * S.taperF * 0.5));
        c.stroke();
        S.strokes++;
        px = x; py = y;
      }

      /* joints and leaves */
      var jt = joints, index = 1;
      while (jt < 1) {
        var jx = root.x + Math.cos(root.a) * L * jt + Math.cos(perp) * Math.sin(jt * Math.PI) * L * bendAmt * 1.6;
        var jy = root.y + Math.sin(root.a) * L * jt + Math.sin(perp) * Math.sin(jt * Math.PI) * L * bendAmt * 1.6;
        /* joint line */
        c.beginPath();
        c.moveTo(jx - Math.cos(perp) * w * 0.9, jy - Math.sin(perp) * w * 0.9);
        c.lineTo(jx + Math.cos(perp) * w * 0.9, jy + Math.sin(perp) * w * 0.9);
        c.strokeStyle = mixHex(strokeCol(S, jt, ri), "#0e130e", 0.25);
        c.lineWidth = Math.max(0.7, w * 0.35); c.stroke();

        if (S.p.bambooLeaf === "single" && jt > 0.25) {
          var la = root.a + (index % 2 === 0 ? lAng : -lAng);
          c.beginPath(); c.moveTo(jx, jy);
          c.lineTo(jx + Math.cos(la) * lLen, jy + Math.sin(la) * lLen);
          c.strokeStyle = strokeCol(S, jt, ri + 40); c.lineWidth = Math.max(0.7, w * 0.3); c.stroke();
        } else if (S.p.bambooLeaf === "spray" && jt > 0.3) {
          [-1, 0, 1].forEach(function (side) {
            var la2 = root.a + side * lAng * 0.8;
            c.beginPath(); c.moveTo(jx, jy);
            c.lineTo(jx + Math.cos(la2) * lLen * (side === 0 ? 1.3 : 1), jy + Math.sin(la2) * lLen * (side === 0 ? 1.3 : 1));
            c.strokeStyle = strokeCol(S, jt, ri + 40 + side);
            c.lineWidth = Math.max(0.7, w * 0.28); c.stroke();
          });
        }
        jt += joints + joints * 0.25;
        index++;
      }
    });
  }

  /* =======================================================================
     RIVER REED
     Slender bending stalks from the edge; no trunk, blades at the top.
     ======================================================================= */
  function reed(S) {
    var c = S.c;
    var count = 3 + Math.round(S.density * 14);
    var roots = edgeRoots(S, count);
    c.lineCap = "round"; c.lineJoin = "round";

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.7 + cr(S.seed, ri, 20) * 0.45);
      var phase = cr(S.seed, ri, 21) * TAU;
      var w = S.lw * lerp(0.35, 0.8, S.scale);
      var px = root.x, py = root.y;
      for (var i = 1; i <= 18; i++) {
        var t = i / 18;
        var bendA = root.a + Math.sin(phase + t * 2.6) * S.curl * 0.012 * 12;
        var x = root.x + Math.cos(bendA) * L * t;
        var y = root.y + Math.sin(bendA) * L * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, ri);
        c.lineWidth = Math.max(0.6, w * (1 - t * 0.5));
        c.stroke(); S.strokes++;
        /* blade near the top */
        if (i === Math.round(14 + cr(S.seed, ri, 22) * 3)) {
          [-1, 1].forEach(function (side) {
            var la = bendA + side * 0.8;
            c.beginPath(); c.moveTo(x, y);
            c.quadraticCurveTo(x + Math.cos(la) * L * 0.12, y + Math.sin(la) * L * 0.12,
              x + Math.cos(la + side * 0.3) * L * 0.2, y + Math.sin(la + side * 0.3) * L * 0.2);
            c.strokeStyle = strokeCol(S, t + 0.1, ri + 30);
            c.lineWidth = Math.max(0.5, w * 0.5); c.stroke();
          });
        }
        px = x; py = y;
      }
      tip(S, px, py, root.a, strokeCol(S, 1, ri));
    });
  }

  /* =======================================================================
     MYCELIUM
     Root threads from the edge, branching, looping, with joint nodes.
     ======================================================================= */
  function mycelium(S) {
    var c = S.c;
    var count = 3 + Math.round(S.density * 8);
    var roots = edgeRoots(S, count);
    c.lineCap = "round"; c.lineJoin = "round";

    function walk(x, y, a, len, w, d, id, lead) {
      if (d <= 0 || len < 2.5 || S.strokes > 5000) return;
      var steps = 7 + d * 2;
      var px = x, py = y, pa = a;
      var aim = a;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        aim = turnToward(aim, a + lead, 0.08);
        var wa = aim + (cr(S.seed, id * 31 + i, 30) - 0.5) * S.curl * 0.022 * 12;
        var nx = x + Math.cos(wa) * len * t;
        var ny = y + Math.sin(wa) * len * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny);
        c.strokeStyle = strokeCol(S, t, id);
        c.lineWidth = Math.max(0.6, w * Math.pow(S.taperF, t));
        c.stroke(); S.strokes++;
        px = nx; py = ny; pa = wa;

        /* loop gesture: a short arc back toward the line occasionally */
        if (i === Math.round(steps * 0.6) && cr(S.seed, id, 32) < 0.5) {
          c.beginPath();
          c.arc(px, py, len * 0.06, pa, pa + TAU * 0.4);
          c.strokeStyle = strokeCol(S, t, id + 99); c.lineWidth = Math.max(0.5, w * 0.5); c.stroke();
        }
      }
      /* nodes */
      c.beginPath(); c.arc(px, py, Math.max(1.2, w * 0.45), 0, TAU);
      c.fillStyle = rgba(S.cols[3], 0.95); c.fill();

      var children = cr(S.seed, id, 33) < 0.4 ? 1 : 2;
      for (var k = 0; k < children; k++) {
        var side = (k - (children - 1) / 2) * 2;
        var ba = pa + side * (0.3 + S.spread * 0.5);
        walk(px, py, ba, len * 0.55, w * S.taperF, d - 1, id * 7 + k + 1, side * (S.spread + 0.2) * 0.4);
      }
    }

    roots.forEach(function (root, ri) {
      walk(root.x, root.y, root.a,
        S.reachLen * (0.6 + Math.random() * 0.4) /* deterministic below */,
        S.lw * lerp(0.8, 1.6, S.scale), S.depth, ri + 1, 0);
    });
    /* keep it deterministic: redo with seed-random lengths */
  }

  /* mycelium needs deterministic lengths, so it runs twice; second pass
     keeps the same result while the first pass is discarded. To keep the
     code simple we run one deterministic pass directly. */
  function myceliumDeterministic(S) {
    var c = S.c;
    var count = 3 + Math.round(S.density * 8);
    var roots = edgeRoots(S, count);
    c.lineCap = "round"; c.lineJoin = "round";

    function walk(x, y, a, len, w, d, id, lead) {
      if (d <= 0 || len < 2.5 || S.strokes > 5000) return;
      var steps = 7 + d * 2;
      var px = x, py = y, aim = a;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        aim = turnToward(aim, a + lead, 0.08);
        var wa = aim + (cr(S.seed, id * 31 + i, 30) - 0.5) * S.curl * 0.022 * 12;
        var nx = x + Math.cos(wa) * len * t;
        var ny = y + Math.sin(wa) * len * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny);
        c.strokeStyle = strokeCol(S, t, id);
        c.lineWidth = Math.max(0.6, w * Math.pow(S.taperF, t));
        c.stroke(); S.strokes++;
        px = nx; py = ny;
        if (i === Math.round(steps * 0.6) && cr(S.seed, id, 32) < 0.5) {
          c.beginPath(); c.arc(px, py, len * 0.06, pa2(i), pa2(i) + TAU * 0.4);
          c.strokeStyle = strokeCol(S, t, id + 99); c.lineWidth = Math.max(0.5, w * 0.5); c.stroke();
        }
        if (i === steps) {
          c.beginPath(); c.arc(px, py, Math.max(1.2, w * 0.45), 0, TAU);
          c.fillStyle = rgba(S.cols[3], 0.95); c.fill();
        }
      }
      var children = cr(S.seed, id, 33) < 0.4 ? 1 : 2;
      for (var k = 0; k < children; k++) {
        var side = (k - (children - 1) / 2) * 2;
        var ba = aim + side * (0.3 + S.spread * 0.5);
        walk(px, py, ba, len * 0.55, w * S.taperF, d - 1, id * 7 + k + 1, side * (S.spread + 0.2) * 0.4);
      }
      /* keep a valid reference for the loop gesture */
      function pa2(i) {
        var t = i / steps;
        return aim + (cr(S.seed, id * 31 + i, 30) - 0.5) * S.curl * 0.022 * 12;
      }
    }

    roots.forEach(function (root, ri) {
      walk(root.x, root.y, root.a,
        S.reachLen * (0.6 + cr(S.seed, ri, 40) * 0.4),
        S.lw * lerp(0.8, 1.6, S.scale), S.depth, ri + 1, 0);
    });
  }

  /* =======================================================================
     FERN
     A spine from the edge with paired leaflets; droop curls the tip down.
     ======================================================================= */
  function fern(S) {
    var c = S.c;
    var count = Math.max(1, Math.round(S.p.fernCount));
    var roots = edgeRoots(S, count);
    var spacing = clamp(num(S.p.fernSpacing) / 100, 0, 1);
    var leafGap = lerp(0.03, 0.11, 1 - spacing);
    var droop = clamp(num(S.p.fernDroop) / 100, 0, 1) * 0.9;
    c.lineCap = "round"; c.lineJoin = "round";

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.75 + cr(S.seed, ri, 50) * 0.35);
      var pts = [];
      var n = 34;
      var a = root.a;
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        a = root.a + Math.sin(ri * 1.9 + t * 2.2) * S.curl * 0.012 * 8;
        a = turnToward(a, HALF, droop * 0.014 * t * t * 60);
        var x = root.x + Math.cos(a) * L * t;
        var y = root.y + Math.sin(a) * L * t;
        pts.push([x, y, a]);
        if (i > 0) {
          c.beginPath();
          c.moveTo(pts[i - 1][0], pts[i - 1][1]);
          c.lineTo(x, y);
          c.strokeStyle = strokeCol(S, t, ri);
          c.lineWidth = Math.max(0.7, S.lw * (1 - t * S.taperF * 0.6));
          c.stroke(); S.strokes++;
        }
      }
      /* leaflets */
      var t = leafGap;
      while (t < 0.97) {
        var idx = Math.round(t * n);
        var pt = pts[idx];
        var leafLen = L * (0.2 - 0.12 * spacing) * (1 - t * 0.8);
        [-1, 1].forEach(function (side) {
          var la = pt[2] + side * (0.75 + lerp(0.1, 0.4, spacing));
          c.beginPath(); c.moveTo(pt[0], pt[1]);
          c.lineTo(pt[0] + Math.cos(la) * leafLen, pt[1] + Math.sin(la) * leafLen);
          c.strokeStyle = strokeCol(S, t, ri + side);
          c.lineWidth = Math.max(0.5, S.lw * 0.5 * (1 - t * 0.7));
          c.stroke();
        });
        t += leafGap;
      }
      var end = pts[n];
      tip(S, end[0], end[1], end[2], strokeCol(S, 1, ri));
    });
  }

  /* =======================================================================
     CORAL BLOOM
     Starts at the centre and builds outward in layered fans with clubbed
     tips. Origin does not apply.
     ======================================================================= */
  function coral(S) {
    var c = S.c;
    var layers = clamp(Math.round(3 + S.depth * 0.7), 3, 8);
    var r0 = S.minR * 0.02;
    var rMax = S.minR * 0.47 * clamp(S.scale + (num(S.p.reach) / 100 - 0.7) * 0.25, 0.6, 1.3);
    c.lineCap = "round"; c.lineJoin = "round";

    var layerRadius = [];
    for (var li = 0; li <= layers; li++) {
      layerRadius.push(r0 + (rMax - r0) * (li / layers));
    }
    for (var layer = 0; layer < layers; layer++) {
      var rIn = layerRadius[layer], rOut = layerRadius[layer + 1];
      var arms = 5 + Math.round(S.density * 12) + layer * 2;
      var baseTurn = cr(S.seed, layer, 70) * TAU;
      for (var j = 0; j < arms; j++) {
        var ang = baseTurn + j / arms * TAU;
        var curlA = (cr(S.seed, layer * 13 + j, 71) - 0.5) * S.curl * 0.016 * 12;
        var x0 = S.cx + Math.cos(ang) * rIn, y0 = S.cy + Math.sin(ang) * rIn;
        var x1 = S.cx + Math.cos(ang + curlA) * rOut, y1 = S.cy + Math.sin(ang + curlA) * rOut;
        var col = strokeCol(S, layer / layers, layer * 17 + j);
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo((x0 + x1) / 2 + Math.cos(ang + curlA / 2 + HALF) * (rOut - rIn) * 0.25,
          (y0 + y1) / 2 + Math.sin(ang + curlA / 2 + HALF) * (rOut - rIn) * 0.25,
          x1, y1);
        c.strokeStyle = rgba(col, 0.95);
        c.lineWidth = Math.max(0.7, S.lw * lerp(1.1, 0.45, layer / layers));
        c.stroke(); S.strokes++;
        /* clubbed tip */
        c.beginPath(); c.arc(x1, y1, Math.max(1.4, S.lw * S.tipSize * 0.8), 0, TAU);
        c.fillStyle = rgba(col, 1); c.fill();
      }
    }
    /* dense spark centre */
    c.beginPath(); c.arc(S.cx, S.cy, Math.max(2, S.lw * S.tipSize * 0.5), 0, TAU);
    c.fillStyle = rgba(S.cols[3], 1); c.fill();
  }

  /* =======================================================================
     BRAMBLE
     Starts near the centre and crawls outward in wavy thorny stalks. The
     middle stays open. Origin does not apply.
     ======================================================================= */
  function bramble(S) {
    var c = S.c;
    var count = 5 + Math.round(S.density * 9);
    var r0 = S.minR * 0.03;
    var rMax = S.minR * 0.5 * clamp(S.scale + (num(S.p.reach) / 100 - 0.5) * 0.2, 0.7, 1.2);
    c.lineCap = "round"; c.lineJoin = "round";

    for (var s = 0; s < count; s++) {
      var startA = s / count * TAU + cr(S.seed, s, 80) * 0.4;
      var px = S.cx + Math.cos(startA) * r0, py = S.cy + Math.sin(startA) * r0;
      var a = startA;
      var steps = 12 + S.depth * 2;
      var segLen = (rMax - r0) / steps;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        a += (cr(S.seed, s * 29 + i, 81) - 0.5) * (0.4 + S.curl * 0.014);
        var r = r0 + segLen * i;
        var x = S.cx + Math.cos(a) * r, y = S.cy + Math.sin(a) * r;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, s);
        c.lineWidth = Math.max(0.8, S.lw * (1.4 - t * 0.6)) * 0.9;
        c.stroke(); S.strokes++;

        /* thorns every other step */
        if (i % 2 === 0 && t > 0.18) {
          var thornLen = S.lw * lerp(0.9, 2.1, S.tipSize);
          [-0.9, 0.9].forEach(function (side) {
            var ta = a + side + HALF * 0.5;
            c.beginPath(); c.moveTo(x, y);
            c.lineTo(x + Math.cos(ta) * thornLen, y + Math.sin(ta) * thornLen);
            c.strokeStyle = rgba(strokeCol(S, t, s), 0.9);
            c.lineWidth = Math.max(0.6, S.lw * 0.28); c.stroke();
          });
        }
        /* side shoots */
        if (i === Math.round(steps * 0.45) && cr(S.seed, s, 82) < 0.6) {
          var sa = a + (cr(S.seed, s, 83) - 0.5) * 1.6;
          c.beginPath(); c.moveTo(x, y);
          c.quadraticCurveTo(x + Math.cos(sa) * segLen * 3, y + Math.sin(sa) * segLen * 3,
            x + Math.cos(sa + 0.5) * segLen * 4, y + Math.sin(sa + 0.5) * segLen * 4);
          c.strokeStyle = strokeCol(S, t, s + 50);
          c.lineWidth = Math.max(0.6, S.lw * 0.5); c.stroke();
        }
        px = x; py = y;
      }
      tip(S, px, py, a, strokeCol(S, 1, s));
    }
  }

  /* =======================================================================
     MAIN ENTRY
     ======================================================================= */
  function draw(target, W, H, p) {
    var off = document.createElement("canvas");
    off.width = W; off.height = H;
    var c = off.getContext("2d");
    var k = Math.min(W, H) / 900;

    var S = {
      c: c, p: p, W: W, H: H,
      cx: W / 2, cy: H / 2,
      k: k,
      minR: Math.min(W, H),
      lw: Math.max(1, num(p.lineWeight) * k),
      seed: hash(p.seed),
      cols: (p.colors || ["#c9a24a", "#9bcf7a", "#4f7a3a", "#e8d28a"]).slice(0, 4),
      spread: clamp(num(p.spread) / 100, 0, 1),
      density: clamp(num(p.density) / 100, 0, 1),
      depth: clamp(Math.round(num(p.depth)), 2, 8),
      curl: clamp(num(p.curl) / 100, 0, 1),
      numCurl: clamp(num(p.curl) / 100, 0, 1) * 0.5 + 0.02,
      taperF: 0.55 + (1 - clamp(num(p.taper) / 100, 0, 1)) * 0.45,
      tipSize: clamp(num(p.tipSize) / 100, 0.1, 1),
      lean: num(p.lean) / 100 * 0.55,
      strokes: 0,
      phase: hash(p.seed + "phase") % 17,
      reachLen: Math.max(W, H) * 0.52 * clamp(num(p.reach) / 100, 0.15, 1) * 1.1 *
        clamp(num(p.scale), 0.55, 1.7),
      scale: clamp(num(p.scale), 0.5, 2)
    };

    /* the tree recursion engine lives on S so mycelium and others reuse it */
    S.branch = limb;

    var style = p.growthStyle;
    if (style === "bamboo") bamboo(S);
    else if (style === "reed") reed(S);
    else if (style === "mycelium") myceliumDeterministic(S);
    else if (style === "fern") fern(S);
    else if (style === "coral") coral(S);
    else if (style === "bramble") bramble(S);
    else tree(S);

    target.save();
    target.globalAlpha = clamp(num(p.opacity) || 1, 0, 1);
    target.drawImage(off, 0, 0);
    target.restore();
  }

  window.ThicketStyles = { draw: draw };
})();
