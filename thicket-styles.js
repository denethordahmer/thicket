/* =========================================================================
   THICKET: thicket-styles.js  (v2, full rewrite)
   Seven bold botanical renderers. Each has its own shape language and a
   dedicated drawing pass. Origin is fixed for all 8 modes. Tree no longer
   crashes; its canvas is back.

   Edge styles (bottom/top/left/right/two/sides/all/corners) anchor against
   the frame. Centre styles (coral, bramble) grow from the middle outward.

   Everything is seeded, so the same seed + settings == the same picture.
   ========================================================================= */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var HALF = Math.PI / 2;

  /* ---------- tiny helpers ---------- */
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

  /* seeded random, tied to an integer index and a salt */
  function cr(seed, i, s) {
    var h = (seed ^ Math.imul((Math.floor(i) | 0) + 1, 374761393) ^ Math.imul((s | 0) + 1, 668265263)) >>> 0;
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
  /* palette gradient: t = 0 at root, 1 at tip */
  function colGrad(cols, t) {
    t = clamp(t, 0, 1);
    var seg = t * (cols.length - 1);
    var i = Math.min(cols.length - 2, Math.floor(seg));
    return mixHex(cols[i], cols[i + 1], seg - i);
  }
  function turnToward(a, target, amt) {
    var d = ((target - a + Math.PI * 3) % TAU) - Math.PI;
    return a + d * amt;
  }

  /* =======================================================================
     ROOTS — fixed. Handles all 8 origin modes with correct anchor/angle.
     The anchor sits just beyond the frame so lines enter from outside.
     ======================================================================= */
  function edgeRoots(S, count) {
    var W = S.W, H = S.H, o = S.origin, out = [];
    var m = 1.5;

    function place(edge, f) {
      var x, y, ang;
      if (edge === "b")      { x = W * f; y = H + m; ang = -HALF; }
      else if (edge === "t") { x = W * f; y = -m;    ang = HALF;  }
      else if (edge === "l") { x = -m;    y = H * f; ang = 0;     }
      else                   { x = W + m; y = H * f; ang = Math.PI; }
      /* flare: outer roots lean outward for a crown/fan */
      ang += S.lean + (f - 0.5) * 2 * (0.08 + S.spread * 0.5);
      out.push({ x: x, y: y, a: ang });
    }

    var i;
    if (o === "two") {
      var h = Math.max(1, Math.ceil(count / 2));
      for (i = 0; i < h; i++) place("b", (i + 0.5) / h);
      for (i = 0; i < h; i++) place("t", (i + 0.5) / h);
    } else if (o === "sides") {
      var s = Math.max(1, Math.ceil(count / 2));
      for (i = 0; i < s; i++) place("l", (i + 0.5) / s);
      for (i = 0; i < s; i++) place("r", (i + 0.5) / s);
    } else if (o === "all") {
      var q = Math.max(1, Math.ceil(count / 4));
      for (i = 0; i < q; i++) place("b", (i + 0.5) / q);
      for (i = 0; i < q; i++) place("t", (i + 0.5) / q);
      for (i = 0; i < q; i++) place("l", (i + 0.5) / q);
      for (i = 0; i < q; i++) place("r", (i + 0.5) / q);
    } else if (o === "corners") {
      var qc = Math.max(1, Math.ceil(count / 4));
      var corners = [
        { x: -m,     y: H + m,  a:  Math.PI * 0.25 },
        { x: W + m,  y: H + m,  a:  Math.PI * 0.75 },
        { x: -m,     y: -m,     a: -Math.PI * 0.25 },
        { x: W + m,  y: -m,     a: -Math.PI * 0.75 }
      ];
      var ci, n;
      for (ci = 0; ci < 4; ci++) {
        for (n = 0; n < qc; n++) {
          var f = 0.8 + cr(S.seed, ci * 10 + n, 90) * 0.4;
          var cc = corners[ci];
          out.push({ x: cc.x, y: cc.y, a: cc.a + S.lean + (n / qc - 0.5) * 0.7 * (S.spread + 0.2) });
        }
      }
    } else {
      for (i = 0; i < count; i++) place(o, (i + 0.5) / count);
    }
    return out;
  }

  /* colour for one piece: fade along t, or per-limb */
  function strokeCol(S, t, limb) {
    if (S.p.colourStyle === "limb")   return S.cols[((Math.floor(limb) | 0) % 4 + 4) % 4];
    if (S.p.colourStyle === "random") return S.cols[Math.floor(cr(S.seed, limb, 77) * 4) % 4];
    return colGrad(S.cols, t);
  }

  /* hardness cap so old phones never freeze */
  function busy(S) { return S.strokes > 9000; }

  /* =======================================================================
     TREE — screenprint silhouette: thick curling trunk, boughs, and
     layered translucent foliage clouds with fine stamped branches.
     ======================================================================= */
  function tree(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var count = 1 + Math.round(S.density * 2);       /* 1-3 trunks */
    var roots = edgeRoots(S, count);

    function cloud(x, y, w, col) {
      if (busy(S)) return;
      var discs = 7 + S.depth * 2;
      for (var i = 0; i < discs; i++) {
        var rr = w * (0.18 + cr(S.seed, i, 200) * 0.5);
        var ox = (cr(S.seed, i, 201) - 0.5) * w * 1.1;
        var oy = (cr(S.seed, i, 202) - 0.5) * w * 0.7;
        var shade = mixHex(col, colGrad(S.cols, cr(S.seed, i, 203)), cr(S.seed, i, 204) * 0.6);
        c.beginPath();
        c.arc(x + ox, y + oy, rr, 0, TAU);
        c.fillStyle = rgba(shade, 0.22 + cr(S.seed, i, 205) * 0.2);
        c.fill();
        S.strokes++;
      }
      /* stamped fine branches over the cloud */
      c.strokeStyle = rgba(col, 0.85);
      c.lineWidth = Math.max(0.7, S.lw * 0.3);
      for (var j = 0; j < 5; j++) {
        var a0 = cr(S.seed, j, 206) * TAU;
        var x0 = x + Math.cos(a0) * w * 0.2, y0 = y + Math.sin(a0) * w * 0.2;
        var x1 = x + Math.cos(a0) * w * 0.9, y1 = y + Math.sin(a0) * w * 0.9;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        S.strokes++;
      }
    }

    function grow(x, y, a, len, w, d, id, t0) {
      if (d <= 0 || len < 3 || busy(S)) {
        cloud(x, y, w * lerp(4, 7, S.depth / 8), strokeCol(S, 1, id));
        return;
      }
      var steps = 8;
      var px = x, py = y, pa = a;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var cur = pa + Math.sin(S.phase + id * 1.3 + i * 0.6) * (0.1 + S.curl * 0.5);
        var nx = x + Math.cos(cur) * len * t;
        var ny = y + Math.sin(cur) * len * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny);
        c.strokeStyle = strokeCol(S, t0 + t * (1 - t0), id);
        c.lineWidth = Math.max(0.8, w * Math.pow(S.taperF, t));
        c.lineCap = "round"; c.stroke(); S.strokes++;
        px = nx; py = ny; pa = cur;
      }
      var kids = d > 3 ? (cr(S.seed, id, 210) < 0.35 ? 3 : 2) : 2;
      var span = 0.4 + S.spread * 0.6;
      for (var k = 0; k < kids; k++) {
        var side = (k - (kids - 1) / 2) * 2;
        var ba = pa + side * span + (cr(S.seed, id * 3 + k, 211) - 0.5) * 0.5;
        grow(px, py, ba, len * 0.68, w * S.taperF, d - 1, id * 3 + k + 1, t0 + 0.08);
      }
    }

    roots.forEach(function (r, ri) {
      var w0 = S.lw * lerp(4, 9, 1 - S.taperF) * (0.8 + S.scale * 0.4);
      grow(r.x, r.y, r.a, S.reachLen * (0.85 + cr(S.seed, ri, 212) * 0.3),
           w0, S.depth, ri + 1, 0);
    });
  }

  /* =======================================================================
     BAMBOO — hollow double-line culms with sumi leaf sprays at the nodes.
     ======================================================================= */
  function bamboo(S) {
    var c = S.c;
    c.lineCap = "butt"; c.lineJoin = "round";
    var count = Math.max(1, Math.round(num(S.p.bambooCount)));
    var roots = edgeRoots(S, count);
    var bend = clamp(num(S.p.bambooBend) / 100, 0, 0.5);
    var joint = lerp(0.05, 0.3, clamp(num(S.p.bambooJoints) / 100, 0, 1));
    var w = S.lw * lerp(1.2, 4.5, clamp(num(S.p.bambooWidth) / 100, 0, 1)) * (0.7 + S.scale * 0.4);
    var leafLen = S.lw * lerp(1.6, 5, clamp(num(S.p.bambooLeafLen) / 100, 0, 1));
    var leafAngH = HALF * lerp(0.2, 1.1, clamp(num(S.p.bambooLeafAngle) / 100, 0, 1));

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.7 + cr(S.seed, ri, 20) * 0.3);
      var perp = root.a - HALF;
      var offAmt = (cr(S.seed, ri, 21) - 0.5) * 2 * bend * (S.spread + 0.4);
      var path = [];
      var i, t, px, py, rx, ry, off;
      /* build centreline */
      for (i = 0; i <= 24; i++) {
        t = i / 24;
        off = Math.sin(t * Math.PI) * L * offAmt * 1.6;
        px = root.x + Math.cos(root.a) * L * t + Math.cos(perp) * off;
        py = root.y + Math.sin(root.a) * L * t + Math.sin(perp) * off;
        path.push([px, py]);
      }
      /* hollow body: dark wall fill, then two lighter edge rails */
      c.beginPath();
      for (i = 0; i < path.length; i++) {
        if (i === 0) c.moveTo(path[i][0], path[i][1]);
        else c.lineTo(path[i][0], path[i][1]);
      }
      c.strokeStyle = rgba(colGrad(S.cols, 0.25), 0.9);
      c.lineWidth = w; c.stroke(); S.strokes++;

      c.strokeStyle = rgba(colGrad(S.cols, 0.6), 1);
      c.lineWidth = Math.max(0.7, w * 0.22);
      [-1, 1].forEach(function (side) {
        c.beginPath();
        for (i = 0; i < path.length; i++) {
          var e = i / (path.length - 1);
          var ex = path[i][0] + Math.cos(perp) * side * w * 0.42;
          var ey = path[i][1] + Math.sin(perp) * side * w * 0.42;
          if (i === 0) c.moveTo(ex, ey); else c.lineTo(ex, ey);
        }
        c.stroke(); S.strokes++;
      });

      /* joints + leaves */
      var jt = joint;
      var idx = 1;
      while (jt < 0.99 && !busy(S)) {
        var jn = Math.round(jt * 24);
        var jx = path[jn][0], jy = path[jn][1];
        c.beginPath();
        c.moveTo(jx - Math.cos(perp) * w * 0.55, jy - Math.sin(perp) * w * 0.55);
        c.lineTo(jx + Math.cos(perp) * w * 0.55, jy + Math.sin(perp) * w * 0.55);
        c.strokeStyle = rgba(S.cols[1], 0.9);
        c.lineWidth = Math.max(1, w * 0.3); c.stroke(); S.strokes++;

        if (jt > 0.3) {
          if (S.p.bambooLeaf === "single") {
            var la = root.a + (idx % 2 === 0 ? leafAngH : -leafAngH);
            c.beginPath(); c.moveTo(jx, jy);
            c.lineTo(jx + Math.cos(la) * leafLen, jy + Math.sin(la) * leafLen);
            c.strokeStyle = strokeCol(S, jt, ri + 40);
            c.lineWidth = Math.max(0.7, w * 0.28); c.stroke(); S.strokes++;
          } else if (S.p.bambooLeaf === "spray") {
            [-1, 0, 1].forEach(function (side) {
              var la2 = root.a + side * leafAngH * 0.85;
              c.beginPath(); c.moveTo(jx, jy);
              c.quadraticCurveTo(
                jx + Math.cos(la2 + side * 0.2) * leafLen * 0.6,
                jy + Math.sin(la2 + side * 0.2) * leafLen * 0.6,
                jx + Math.cos(la2 + side * 0.35) * leafLen,
                jy + Math.sin(la2 + side * 0.35) * leafLen);
              c.strokeStyle = strokeCol(S, jt, ri + 40 + side);
              c.lineWidth = Math.max(0.7, w * 0.26); c.stroke(); S.strokes++;
            });
          }
        }
        jt += joint * 2.0;
        idx++;
      }
    });
  }

  /* =======================================================================
     RIVER REED — sweeping tapered ribbons ending in feathered plumes.
     ======================================================================= */
  function reed(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var count = 4 + Math.round(S.density * 16);
    var roots = edgeRoots(S, count);
    var wBase = S.lw * lerp(1.1, 2.2, S.scale);

    function plume(x, y, a, t, col) {
      if (busy(S)) return;
      var hairs = 9;
      var got = 0;
      c.strokeStyle = rgba(col, 0.9);
      for (var h = 0; h < hairs; h++) {
        var pa = a - 0.6 + (h / (hairs - 1)) * 1.2;
        var pl = S.lw * lerp(2.2, 5, S.tipSize);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(pa) * pl, y + Math.sin(pa) * pl);
        c.lineWidth = Math.max(0.5, S.lw * 0.22); c.stroke(); S.strokes++;
        /* bead seed */
        c.beginPath();
        c.arc(x + Math.cos(pa) * pl, y + Math.sin(pa) * pl, Math.max(0.8, S.lw * 0.3), 0, TAU);
        c.fillStyle = rgba(S.cols[3], 0.95); c.fill(); S.strokes++;
        got++;
        if (got > 24) break;
      }
    }

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.7 + cr(S.seed, ri, 30) * 0.4);
      var phase = cr(S.seed, ri, 31) * TAU;
      var px = root.x, py = root.y;
      var w = wBase;
      var i, t;
      for (i = 1; i <= 20; i++) {
        t = i / 20;
        var a = root.a + Math.sin(phase + t * 3.0) * (0.15 + S.curl * 0.7);
        var x = root.x + Math.cos(a) * L * t;
        var y = root.y + Math.sin(a) * L * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, ri);
        c.lineWidth = Math.max(0.7, w * (1 - t * S.taperF * 0.7));
        c.stroke(); S.strokes++;
        px = x; py = y;
      }
      /* a few shorter companion stalks in the tuft */
      if (ri % 3 === 0 && !busy(S)) {
        var a2 = root.a + (cr(S.seed, ri, 34) - 0.5) * 0.9;
        var L2 = L * 0.5;
        c.beginPath(); c.moveTo(root.x, root.y);
        c.quadraticCurveTo(
          root.x + Math.cos(a2) * L2 * 0.6, root.y + Math.sin(a2) * L2 * 0.6,
          root.x + Math.cos(a2) * L2, root.y + Math.sin(a2) * L2);
        c.strokeStyle = strokeCol(S, 0.6, ri + 20);
        c.lineWidth = Math.max(0.6, wBase * 0.6);
        c.stroke(); S.strokes++;
      }
      plume(px, py, root.a, 1, strokeCol(S, 1, ri));
    });
  }

  /* =======================================================================
     MYCELIUM — luminous branching/rejoining web with spore bead nodes.
     ======================================================================= */
  function mycelium(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var count = 3 + Math.round(S.density * 9);
    var roots = edgeRoots(S, count);
    var w0 = S.lw * lerp(0.9, 1.7, S.scale);

    function web(x, y, a, len, w, d, id, lead) {
      if (d <= 0 || len < 2.5 || busy(S)) return;
      var steps = 8 + d * 2;
      var px = x, py = y, aim = a;
      var i, t, wa, nx, ny;
      for (i = 1; i <= steps; i++) {
        t = i / steps;
        aim = turnToward(aim, a + lead, 0.07);
        wa = aim + (cr(S.seed, id * 31 + i, 40) - 0.5) * (0.3 + S.curl * 1.1);
        nx = x + Math.cos(wa) * len * t;
        ny = y + Math.sin(wa) * len * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny);
        c.strokeStyle = strokeCol(S, t, id);
        c.lineWidth = Math.max(0.6, w * Math.pow(S.taperF, t));
        c.stroke(); S.strokes++;
        /* glowing spore halo at some joints */
        if (i % 3 === 0) {
          c.beginPath(); c.arc(nx, ny, Math.max(1.3, w * 0.6), 0, TAU);
          c.fillStyle = rgba(S.cols[3], 0.85); c.fill(); S.strokes++;
        }
        px = nx; py = ny;
      }
      var children = cr(S.seed, id, 41) < 0.4 ? 1 : 2;
      var k, side, ba;
      for (k = 0; k < children; k++) {
        side = (k - (children - 1) / 2) * 2;
        ba = aim + side * (0.35 + S.spread * 0.6);
        web(px, py, ba, len * 0.55, w * S.taperF, d - 1, id * 7 + k + 1, side * (S.spread + 0.2) * 0.5);
      }
    }

    roots.forEach(function (root, ri) {
      web(root.x, root.y, root.a,
          S.reachLen * (0.65 + cr(S.seed, ri, 50) * 0.4),
          w0, S.depth, ri + 1, 0);
    });
  }

  /* =======================================================================
     FERN — deep curving spines, solid filled leaflets, fiddlehead scroll
     at the base.
     ======================================================================= */
  function fern(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var count = Math.max(1, Math.round(num(S.p.fernCount)));
    var roots = edgeRoots(S, count);
    var spacing = clamp(num(S.p.fernSpacing) / 100, 0, 1);
    var leafGap = lerp(0.035, 0.12, 1 - spacing);
    var droop = clamp(num(S.p.fernDroop) / 100, 0, 1);

    function fiddlehead(x, y, a, scale) {
      /* a tight spiral scroll at the base */
      c.strokeStyle = strokeCol(S, 0.3, 0);
      c.lineWidth = Math.max(0.8, S.lw * 0.5);
      var R0 = S.lw * lerp(3, 6, S.tipSize) * scale;
      c.beginPath();
      var spir = 0.2 + S.curl * 0.6;
      for (var a_ = 0; a_ <= TAU * spir; a_ += 0.12) {
        var rr = R0 * (0.15 + 0.85 * a_ / (TAU * spir));
        if (a_ === 0) c.moveTo(x + Math.cos(a + a_) * rr, y + Math.sin(a + a_) * rr);
        else c.lineTo(x + Math.cos(a + a_) * rr, y + Math.sin(a + a_) * rr);
      }
      c.stroke(); S.strokes++;
    }

    roots.forEach(function (root, ri) {
      var L = S.reachLen * (0.75 + cr(S.seed, ri, 60) * 0.35);
      var pts = [];
      var n = 32, i, t, a;
      a = root.a;
      for (i = 0; i <= n; i++) {
        t = i / n;
        a = root.a + Math.sin(ri * 1.9 + t * 2.4) * (0.2 + S.curl * 0.5);
        a = turnToward(a, HALF, droop * 0.9 * t);
        var x = root.x + Math.cos(a) * L * t;
        var y = root.y + Math.sin(a) * L * t;
        pts.push([x, y, a]);
        if (i > 0) {
          c.beginPath();
          c.moveTo(pts[i - 1][0], pts[i - 1][1]);
          c.lineTo(x, y);
          c.strokeStyle = strokeCol(S, t, ri);
          c.lineWidth = Math.max(0.7, S.lw * (1 - t * S.taperF * 0.5));
          c.stroke(); S.strokes++;
        }
      }
      /* solid filled leaflets */
      t = leafGap;
      while (t < 0.96 && !busy(S)) {
        var idx = Math.round(t * n);
        var pt = pts[idx];
        var len = L * (0.16 - 0.1 * spacing) * (1 - t * 0.7);
        [-1, 1].forEach(function (side) {
          var la = pt[2] + side * (0.7 + lerp(0.15, 0.45, spacing));
          var bx = pt[0] + Math.cos(la) * len, by = pt[1] + Math.sin(la) * len;
          c.beginPath();
          c.moveTo(pt[0] - Math.cos(pt[2]) * len * 0.25, pt[1] - Math.sin(pt[2]) * len * 0.25);
          c.quadraticCurveTo(
            pt[0] + Math.cos(la) * len * 0.55 + Math.cos(la + HALF) * len * 0.28,
            pt[1] + Math.sin(la) * len * 0.55 + Math.sin(la + HALF) * len * 0.28,
            bx, by);
          c.fillStyle = rgba(strokeCol(S, t, ri + side), 0.7);
          c.fill(); S.strokes++;
        });
        t += leafGap;
      }
      fiddlehead(root.x, root.y, root.a, 1);
    });
  }

  /* =======================================================================
     CORAL BLOOM — centre-out scalloped mandalic fan with polyp beads.
     ======================================================================= */
  function coral(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var layers = clamp(3 + S.depth, 4, 9);
    var r0 = S.minR * 0.02;
    var rMax = S.minR * 0.47 * clamp(0.6 + S.scale * 0.4, 0.5, 1.3) *
               clamp(0.6 + (num(S.p.reach) / 100) * 0.5, 0.4, 1.1);
    var li, layer, arms, j, ang, curlA, x0, y0, x1, y1, col;

    for (layer = 0; layer < layers; layer++) {
      var rIn = r0 + (rMax - r0) * (layer / layers);
      var rOut = r0 + (rMax - r0) * ((layer + 1) / layers);
      arms = 6 + layer * (2 + Math.round(S.density * 6));
      var baseTurn = cr(S.seed, layer, 70) * TAU;
      for (j = 0; j < arms; j++) {
        if (busy(S)) return;
        ang = baseTurn + j / arms * TAU;
        curlA = (cr(S.seed, layer * 13 + j, 71) - 0.5) * S.curl * 0.9;
        x0 = S.cx + Math.cos(ang) * rIn;
        y0 = S.cy + Math.sin(ang) * rIn;
        x1 = S.cx + Math.cos(ang + curlA) * rOut;
        y1 = S.cy + Math.sin(ang + curlA) * rOut;
        col = strokeCol(S, layer / layers, layer * 17 + j);
        /* scalloped segment: a filled fan petal from inner to outer */
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(
          S.cx + Math.cos(ang + curlA / 2) * (rOut + (rOut - rIn) * 0.4),
          S.cy + Math.sin(ang + curlA / 2) * (rOut + (rOut - rIn) * 0.4),
          x1, y1);
        c.fillStyle = rgba(col, 0.5);
        c.fill(); S.strokes++;
        c.strokeStyle = rgba(col, 0.95);
        c.lineWidth = Math.max(0.7, S.lw * lerp(1.1, 0.4, layer / layers));
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); S.strokes++;
        /* polyp bead on the outer rim */
        c.beginPath();
        c.arc(x1, y1, Math.max(1.4, S.lw * S.tipSize * 0.9), 0, TAU);
        c.fillStyle = rgba(col, 1); c.fill(); S.strokes++;
      }
    }
    c.beginPath(); c.arc(S.cx, S.cy, Math.max(2, S.lw * S.tipSize * 0.6), 0, TAU);
    c.fillStyle = rgba(S.cols[3], 1); c.fill();
  }

  /* =======================================================================
     BRAMBLE — centre-out crown-of-thorns tangle with berry clusters.
     ======================================================================= */
  function bramble(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var count = 6 + Math.round(S.density * 10);
    var r0 = S.minR * 0.03;
    var rMax = S.minR * 0.5 * clamp(0.7 + S.scale * 0.4, 0.5, 1.2) *
               clamp(0.6 + (num(S.p.reach) / 100) * 0.4, 0.4, 1);
    c.lineCap = "round";

    function berries(x, y) {
      if (busy(S)) return;
      var n = 3 + Math.floor(cr(S.seed, x, 0) * 3);
      for (var b = 0; b < n; b++) {
        var a = cr(S.seed, x, b + 1) * TAU;
        var rr = S.lw * lerp(1.2, 2.6, S.tipSize);
        var bx = x + Math.cos(a) * rr * 1.4, by = y + Math.sin(a) * rr * 1.4;
        c.beginPath(); c.arc(bx, by, rr * 0.6, 0, TAU);
        c.fillStyle = rgba(S.cols[3], 0.95); c.fill(); S.strokes++;
        c.beginPath(); c.arc(bx - rr * 0.2, by - rr * 0.2, rr * 0.18, 0, TAU);
        c.fillStyle = "rgba(255,255,255,0.55)"; c.fill();
      }
    }

    var s, i, a, px, py, x, y, r, steps, t, segLen;
    for (s = 0; s < count; s++) {
      var startA = s / count * TAU + cr(S.seed, s, 80) * 0.5;
      px = S.cx + Math.cos(startA) * r0;
      py = S.cy + Math.sin(startA) * r0;
      a = startA;
      steps = 13 + S.depth * 2;
      segLen = (rMax - r0) / steps;
      for (i = 1; i <= steps; i++) {
        if (busy(S)) return;
        t = i / steps;
        a += (cr(S.seed, s * 29 + i, 81) - 0.5) * (0.5 + S.curl * 1.3);
        r = r0 + segLen * i;
        x = S.cx + Math.cos(a) * r;
        y = S.cy + Math.sin(a) * r;
        /* thick thorny vine */
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, s);
        c.lineWidth = Math.max(1, S.lw * (1.5 - t * 0.6) * 0.9);
        c.stroke(); S.strokes++;
        /* sharp triangular thorns */
        if (i % 2 === 0) {
          var thornLen = S.lw * lerp(1.4, 3.2, S.tipSize);
          [-1, 1].forEach(function (side) {
            var ta = a + side + HALF * 0.6;
            var tx = x + Math.cos(ta) * thornLen, ty = y + Math.sin(ta) * thornLen;
            c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty);
            c.strokeStyle = rgba(strokeCol(S, t, s), 0.95);
            c.lineWidth = Math.max(0.7, S.lw * 0.3); c.stroke(); S.strokes++;
          });
        }
        /* berries on some segments */
        if (i % 5 === 0 && t > 0.3) berries(x, y);
        px = x; py = y;
      }
      /* ragged stem tip */
      var tipCol = strokeCol(S, 1, s);
      c.beginPath();
      c.arc(px, py, Math.max(1.2, S.lw * S.tipSize), 0, TAU);
      c.fillStyle = rgba(tipCol, 0.9); c.fill();
      S.strokes++;
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
      minR: Math.min(W, H),
      k: k,
      lw: Math.max(1, num(p.lineWeight) * k),
      seed: hash(p.seed),
      cols: (p.colors || ["#c9a24a", "#9bcf7a", "#4f7a3a", "#e8d28a"]).slice(0, 4),
      origin: p.origin || "bottom",
      growthStyle: p.growthStyle,
      spread: clamp(num(p.spread) / 100, 0, 1),
      density: clamp(num(p.density) / 100, 0, 1),
      depth: clamp(Math.round(num(p.depth)), 2, 8),
      curl: clamp(num(p.curl) / 100, 0, 1),
      taperF: 0.55 + (1 - clamp(num(p.taper) / 100, 0, 1)) * 0.45,
      tipSize: clamp(num(p.tipSize) / 100, 0.1, 1),
      lean: num(p.lean) / 100 * 0.6,
      strokes: 0,
      phase: hash(p.seed + "phase") % 19,
      reachLen: Math.max(W, H) * 0.52 * clamp(num(p.reach) / 100, 0.15, 1.2) *
                1.1 * clamp(num(p.scale), 0.6, 1.7),
      scale: clamp(num(p.scale), 0.5, 2)
    };

    var style = S.growthStyle;
    if (style === "bamboo") bamboo(S);
    else if (style === "reed") reed(S);
    else if (style === "mycelium") mycelium(S);
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
