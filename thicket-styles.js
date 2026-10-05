/* =========================================================================
   THICKET: thicket-styles.js  (v3, symmetrical overhaul)
   Seven fixed, symmetrical compositions. Each has one locked layout and a
   bold renderer. No free direction: every style repeats or mirrors around
   a clear axis or centre.

   Sliders: scale, reach, depth, curl, density, line weight, taper, tips,
   tip size. Fold drives coral/bramble. Everything is seeded, so the same
   seed + settings == the same picture.
   ========================================================================= */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var HALF = Math.PI / 2;

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
    return "rgb(" + Math.round(lerp(ca[0], cb[0], t)) + "," +
      Math.round(lerp(ca[1], cb[1], t)) + "," + Math.round(lerp(ca[2], cb[2], t)) + ")";
  }
  function colGrad(cols, t) {
    t = clamp(t, 0, 1);
    var seg = t * (cols.length - 1);
    var i = Math.min(cols.length - 2, Math.floor(seg));
    return mixHex(cols[i], cols[i + 1], seg - i);
  }

  function strokeCol(S, t, limb) {
    if (S.p.colourStyle === "limb")   return S.cols[((Math.floor(limb) | 0) % 4 + 4) % 4];
    if (S.p.colourStyle === "random") return S.cols[Math.floor(cr(S.seed, limb, 77) * 4) % 4];
    return colGrad(S.cols, t);
  }
  function busy(S) { return S.strokes > 9000; }

  /* ---------- tips ---------- */
  function tip(S, x, y, a, col) {
    var size = S.lw * lerp(1.1, 2.6, S.tipSize);
    var t = S.p.tips;
    if (t === "none" || !col) return;
    if (t === "dots") {
      S.c.beginPath(); S.c.arc(x, y, size * 0.55, 0, TAU);
      S.c.fillStyle = rgba(col, 1); S.c.fill();
    } else if (t === "buds") {
      S.c.beginPath(); S.c.arc(x, y, size * 0.75, 0, TAU);
      S.c.fillStyle = rgba(col, 0.9); S.c.fill();
      S.c.beginPath(); S.c.arc(x, y, size * 0.4, 0, TAU);
      S.c.fillStyle = rgba(S.cols[3], 1); S.c.fill();
    } else {
      var len = size * 1.6;
      S.c.strokeStyle = rgba(col, 1);
      S.c.lineWidth = Math.max(1, S.lw * 0.5);
      [-0.55, 0.55].forEach(function (side) {
        var ca = a + side;
        S.c.beginPath(); S.c.moveTo(x, y);
        S.c.lineTo(x + Math.cos(ca) * len, y + Math.sin(ca) * len);
        S.c.stroke();
      });
    }
    S.strokes++;
  }

  /* ---------- segmented arc helper (for ferns and fronds) ---------- */
  function arcLine(S, x0, y0, a0, len, bend, wob, col0, col1, w0, w1, steps) {
    var px = x0, py = y0, i, t, a, x, y;
    for (i = 1; i <= steps; i++) {
      t = i / steps;
      a = a0 + bend * t + Math.sin(S.phase + i * 0.9) * wob;
      x = x0 + Math.cos(a) * len * t;
      y = y0 + Math.sin(a) * len * t;
      S.c.beginPath(); S.c.moveTo(px, py); S.c.lineTo(x, y);
      S.c.strokeStyle = mixHex(col0, col1, t);
      S.c.lineWidth = Math.max(0.6, lerp(w0, w1, t));
      S.c.lineCap = "round"; S.c.stroke();
      S.strokes++;
      px = x; py = y; a0 = a;
    }
    return [px, py, a];
  }

  /* =======================================================================
     TREE OF LIFE — central trunk from the bottom, mirrored boughs and a
     mirrored double-foliage crown.
     ======================================================================= */
  function tree(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var cx = S.cx, baseY = S.H;
    var Ht = S.H * 0.72 * clamp(0.5 + num(S.p.reach) / 100, 0.4, 1.1);

    function cloud(x, y, w, col, side) {
      if (busy(S)) return;
      var discs = 6 + S.depth * 3;
      var i, rr, ox, oy;
      for (i = 0; i < discs; i++) {
        rr = w * (0.16 + cr(S.seed, i, 200) * 0.4);
        ox = (cr(S.seed, i, 201) - 0.5) * w * 1.0;
        oy = (cr(S.seed, i, 202) - 0.5) * w * 0.7;
        var shade = mixHex(col, colGrad(S.cols, cr(S.seed, i, 203)), cr(S.seed, i, 204) * 0.6);
        c.beginPath(); c.arc(x + ox, y + oy, rr, 0, TAU);
        c.fillStyle = rgba(shade, 0.2 + cr(S.seed, i, 205) * 0.18); c.fill();
        S.strokes++;
      }
    }

    /* one side of the tree; mirrored with sign */
    function side(sign, ri) {
      var cw = S.lw * lerp(2.2, 5, 1 - S.taperF) * (0.7 + S.scale * 0.4);
      var bend = (0.6 + S.curl * 0.5) * sign;
      var wob = S.curl * 0.18;
      var len = Ht * 1.05;
      var pt = arcLine(S, cx, baseY, -HALF, len, bend, wob,
        strokeCol(S, 0, ri), strokeCol(S, 0.55, ri), cw, cw * S.taperF, 16);
      /* crown clouds near the tip */
      var w = S.lw * lerp(7, 13, S.depth / 8);
      cloud(pt[0] + sign * w * 0.4, pt[1] - w * 0.1, w, strokeCol(S, 0.8, ri), sign);
      cloud(pt[0] + sign * w * 0.9, pt[1] + w * 0.1, w * 0.7, strokeCol(S, 0.95, ri), sign);
      /* fine twigs stamped into the crown */
      var j, a0, x0, y0, x1, y1;
      c.strokeStyle = rgba(strokeCol(S, 1, ri), 0.85);
      c.lineWidth = Math.max(0.7, S.lw * 0.3);
      for (j = 0; j < 4; j++) {
        a0 = (cr(S.seed, sign + j, 206) - 0.5) * 1.4 + (sign > 0 ? 0.5 : -0.5);
        x0 = pt[0] + Math.cos(a0) * w * 0.3; y0 = pt[1] + Math.sin(a0) * w * 0.3;
        x1 = pt[0] + Math.cos(a0) * w * 1.1; y1 = pt[1] + Math.sin(a0) * w * 1.1;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        S.strokes++;
      }
    }

    side(-1, 1);
    side(1, 2);
  }

  /* =======================================================================
     GROVE (bamboo) — symmetrical vertical stalks, heights stepping up to
     the centre. Hollow double-rail bodies, node collars, leaf sprays.
     ======================================================================= */
  function bamboo(S) {
    var c = S.c;
    c.lineCap = "butt"; c.lineJoin = "round";
    var perSide = Math.max(2, Math.round(num(S.p.bambooCount)));
    var total = perSide * 2 - 1;
    var W = S.W;
    var gap = W / (total + 1);
    var w = S.lw * lerp(1.2, 4, clamp(0.4 + S.scale * 0.3, 0.2, 1));
    var leafLen = S.lw * lerp(1.6, 5, clamp(num(S.p.bambooLeafLen) / 100, 0, 1));

    var i, colIdx;
    for (i = 0; i < total; i++) {
      colIdx = i - (perSide - 1); /* 0 at centre, +/- outward */
      var dist = Math.abs(colIdx) / perSide;
      var hFrac = 1 - dist * (0.5 - S.density * 0.25);
      var Ht = S.H * 0.85 * clamp(0.5 + num(S.p.reach) / 100 * 0.6, 0.3, 1) * hFrac * clamp(0.6 + S.scale * 0.4, 0.4, 1.15);
      var x = gap * (i + 1);
      var y0 = S.H;
      var y1 = S.H - Ht;
      var jitter = (cr(S.seed, i, 20) - 0.5) * S.curl * S.lw * 0.6;
      x += jitter;

      /* body: dark wall then two rails */
      c.strokeStyle = rgba(colGrad(S.cols, 0.25), 0.9);
      c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1);
      c.stroke(); S.strokes++;

      c.strokeStyle = rgba(colGrad(S.cols, 0.6), 1);
      c.lineWidth = Math.max(0.7, w * 0.24);
      [-1, 1].forEach(function (side) {
        c.beginPath();
        c.moveTo(x + side * w * 0.42, y0);
        c.lineTo(x + side * w * 0.42, y1);
        c.stroke(); S.strokes++;
      });

      /* node collars */
      var joint = clamp(0.14 + S.density * 0.08, 0.1, 0.28);
      var t = joint, idx = 1;
      while (t < 0.99 && !busy(S)) {
        var y = y0 - Ht * t;
        c.beginPath();
        c.moveTo(x - w * 0.55, y); c.lineTo(x + w * 0.55, y);
        c.strokeStyle = rgba(S.cols[1], 0.9);
        c.lineWidth = Math.max(1, w * 0.28); c.stroke(); S.strokes++;
        /* leaf spray near upper joints */
        if (t > 0.35 && idx % 2 === 0) {
          var leafAng = HALF * lerp(0.4, 1.0, S.spread);
          [-1, 1].forEach(function (side) {
            var la = (side > 0 ? -HALF : HALF) + (idx % 4 === 0 ? -0.3 : 0.3);
            c.beginPath(); c.moveTo(x, y);
            c.quadraticCurveTo(x + Math.cos(la) * leafLen * 0.7, y + Math.sin(la) * leafLen * 0.7,
              x + Math.cos(la) * leafLen, y + Math.sin(la) * leafLen * 0.6);
            c.strokeStyle = strokeCol(S, t, i + side);
            c.lineWidth = Math.max(0.7, w * 0.26); c.stroke(); S.strokes++;
          });
        }
        t += joint; idx++;
      }
    }
  }

  /* =======================================================================
     FOUNTAIN (reeds) — arches rising from the bottom centre and curving
     outward in mirrored pairs, plumes at the tips.
     ======================================================================= */
  function reed(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var arms = 4 + Math.round(S.density * 8);
    var cx = S.cx, baseY = S.H;
    var maxH = S.H * 0.8 * clamp(0.4 + num(S.p.reach) / 100, 0.4, 1.1);

    function plume(x, y, a, col) {
      if (busy(S)) return;
      var hairs = 8;
      var h, pa, pl;
      c.strokeStyle = rgba(col, 0.9);
      c.lineWidth = Math.max(0.5, S.lw * 0.2);
      for (h = 0; h < hairs; h++) {
        pa = a + (h / (hairs - 1) - 0.5) * 1.4;
        pl = S.lw * lerp(2.2, 5, S.tipSize);
        c.beginPath(); c.moveTo(x, y);
        c.lineTo(x + Math.cos(pa) * pl, y + Math.sin(pa) * pl); c.stroke(); S.strokes++;
        c.beginPath(); c.arc(x + Math.cos(pa) * pl, y + Math.sin(pa) * pl, Math.max(0.8, S.lw * 0.28), 0, TAU);
        c.fillStyle = rgba(S.cols[3], 0.95); c.fill(); S.strokes++;
      }
    }

    var i, sign, arc;
    for (i = 1; i <= arms; i++) {
      var f = i / arms;
      var Ht = maxH * lerp(0.5, 1, f);
      var bendSign = (i % 2 === 0 ? -1 : 1);
      var bendAmt = lerp(0.3, 1.1, f) * (0.5 + S.curl * 0.7) * bendSign;
      sign = bendSign;
      var col = strokeCol(S, f, i);
      var wIn = S.lw * lerp(1.6, 0.9, f);
      var pt = arcLine(S, cx, baseY, -HALF, Ht, bendAmt, S.curl * 0.1, col, col, wIn, wIn * S.taperF, 14);
      /* mirror */
      var pt2 = arcLine(S, cx, baseY, -HALF, Ht, -bendAmt, S.curl * 0.1, col, col, wIn, wIn * S.taperF, 14);
      plume(pt[0], pt[1], pt[2], col);
      plume(pt2[0], pt2[1], pt2[2], col);
    }
  }

  /* =======================================================================
     MIRROR LACE (mycelium) — webs from four edges, mirrored both axes.
     ======================================================================= */
  function mycelium(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var roots = 2 + Math.round(S.density * 5);
    var w0 = S.lw * lerp(0.8, 1.4, S.scale);
    var halfW = S.W / 2, halfH = S.H / 2;

    function web(x, y, a, len, w, d, id, lead) {
      if (d <= 0 || len < 2.5 || busy(S)) return;
      var steps = 8 + d * 2;
      var px = x, py = y, aim = a, i, t, wa, nx, ny;
      for (i = 1; i <= steps; i++) {
        t = i / steps;
        aim += lead * 0.06;
        wa = aim + (cr(S.seed, id * 31 + i, 40) - 0.5) * (0.3 + S.curl * 1.0);
        nx = x + Math.cos(wa) * len * t;
        ny = y + Math.sin(wa) * len * t;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny);
        c.strokeStyle = strokeCol(S, t, id);
        c.lineWidth = Math.max(0.6, w * Math.pow(S.taperF, t));
        c.stroke(); S.strokes++;
        if (i % 3 === 0) {
          c.beginPath(); c.arc(nx, ny, Math.max(1.2, w * 0.55), 0, TAU);
          c.fillStyle = rgba(S.cols[3], 0.85); c.fill(); S.strokes++;
        }
        px = nx; py = ny;
      }
      var children = cr(S.seed, id, 41) < 0.45 ? 1 : 2;
      var k, side, ba;
      for (k = 0; k < children; k++) {
        side = (k - (children - 1) / 2) * 2;
        ba = aim + side * (0.4 + S.density * 0.4);
        web(px, py, ba, len * 0.55, w * S.taperF, d - 1, id * 7 + k + 1, side * 0.4);
      }
    }

    /* build in one quadrant, mirror the strokes is hard, so place roots on
       all edges symmetrically instead. */
    var i;
    for (i = 0; i < roots; i++) {
      var f = (i + 0.5) / roots;
      /* compute one quadrant root and draw all four mirrors */
      web(halfW + (f - 0.5) * S.W * 0.2, S.H + 1, -HALF, S.reachLen * 0.6, w0, S.depth, i + 1, 0);
      web(halfW + (f - 0.5) * S.W * 0.2, -1, HALF, S.reachLen * 0.6, w0, S.depth, i + 40, 0);
      web(-1, halfH + (f - 0.5) * S.H * 0.2, 0, S.reachLen * 0.6, w0, S.depth, i + 80, 0);
      web(S.W + 1, halfH + (f - 0.5) * S.H * 0.2, Math.PI, S.reachLen * 0.6, w0, S.depth, i + 120, 0);
    }
    /* central seam so the four webs read as one */
    c.beginPath();
    c.arc(cx, 0, 0, 0, 0);
    c.fillStyle = rgba(S.cols[3], 0.9);
    c.beginPath(); c.arc(halfW, halfH, Math.max(2, S.lw * 0.8), 0, TAU); c.fill();
    S.strokes++;
  }

  /* =======================================================================
     CORNER FRAMES (fern) — matching fronds sweep in from the four corners,
     leaving the centre open.
     ======================================================================= */
  function fern(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var per = Math.max(1, Math.round(num(S.p.fernCount)));
    var spacing = clamp(num(S.p.fernSpacing) / 100, 0, 1);
    var leafGap = lerp(0.04, 0.12, 1 - spacing);

    function frond(cx0, cy0, a0, bendAmt, ri) {
      var L = S.reachLen * 0.8;
      var pts = [];
      var n = 28, i, t, a, x, y;
      a = a0;
      for (i = 0; i <= n; i++) {
        t = i / n;
        a = a0 + bendAmt * t;
        a += Math.sin(S.phase + ri + t * 2.5) * S.curl * 0.2;
        x = cx0 + Math.cos(a) * L * t;
        y = cy0 + Math.sin(a) * L * t;
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
      t = leafGap;
      while (t < 0.95 && !busy(S)) {
        var idx = Math.round(t * n);
        var pt = pts[idx];
        var len = L * (0.13 - 0.07 * spacing) * (1 - t * 0.7);
        [-1, 1].forEach(function (side) {
          var la = pt[2] + side * (0.7 + lerp(0.15, 0.45, spacing));
          var bx = pt[0] + Math.cos(la) * len, by = pt[1] + Math.sin(la) * len;
          c.beginPath();
          c.moveTo(pt[0], pt[1]);
          c.quadraticCurveTo(pt[0] + Math.cos(la) * len * 0.6, pt[1] + Math.sin(la) * len * 0.6, bx, by);
          c.fillStyle = rgba(strokeCol(S, t, ri + side), 0.65);
          c.fill(); S.strokes++;
        });
        t += leafGap;
      }
      tip(S, pts[n][0], pts[n][1], pts[n][2], strokeCol(S, 1, ri));
    }

    var corners = [
      { x: 0, y: 0, a: Math.PI * 0.25 },
      { x: S.W, y: 0, a: Math.PI * 0.75 },
      { x: 0, y: S.H, a: -Math.PI * 0.25 },
      { x: S.W, y: S.H, a: -Math.PI * 0.75 }
    ];
    var i, k;
    for (i = 0; i < corners.length; i++) {
      for (k = 0; k < per; k++) {
        var spread = (k - (per - 1) / 2) * 0.22 * (1 + S.spread);
        frond(corners[i].x, corners[i].y, corners[i].a + spread, S.curl * 0.35, i * 9 + k);
      }
    }
  }

  /* =======================================================================
     MANDALA (coral) — centre-out scalloped petals with polyp beads,
     repeated fold times.
     ======================================================================= */
  function coral(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var fold = clamp(Math.round(num(S.p.fold)), 4, 16);
    var layers = clamp(3 + S.depth, 4, 8);
    var rMax = halfR(S) * clamp(0.5 + num(S.p.reach) / 100, 0.4, 1.1) * clamp(0.6 + S.scale * 0.4, 0.5, 1.2);

    var layer, seg, j, base, rIn, rOut, ang, endA, col, x0, y0, x1, y1, midx, midy;
    for (layer = 0; layer < layers; layer++) {
      rIn = rMax * (layer / layers);
      rOut = rMax * ((layer + 1) / layers);
      seg = fold;
      base = cr(S.seed, layer, 70) * TAU / fold;
      for (j = 0; j < seg; j++) {
        if (busy(S)) return;
        ang = base + j / seg * TAU;
        endA = ang + (cr(S.seed, layer * 13 + j, 71) - 0.5) * S.curl * 0.5;
        x0 = S.cx + Math.cos(ang) * rIn; y0 = S.cy + Math.sin(ang) * rIn;
        x1 = S.cx + Math.cos(endA) * rOut; y1 = S.cy + Math.sin(endA) * rOut;
        col = strokeCol(S, layer / layers, j);
        midx = S.cx + Math.cos((ang + endA) / 2) * rOut * 1.15;
        midy = S.cy + Math.sin((ang + endA) / 2) * rOut * 1.15;
        /* petal fill */
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(midx, midy, x1, y1);
        c.fillStyle = rgba(col, 0.5);
        c.fill(); S.strokes++;
        c.strokeStyle = rgba(col, 0.95);
        c.lineWidth = Math.max(0.6, S.lw * lerp(1.0, 0.4, layer / layers));
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); S.strokes++;
        /* polyp */
        c.beginPath(); c.arc(x1, y1, Math.max(1.3, S.lw * S.tipSize * 0.85), 0, TAU);
        c.fillStyle = rgba(col, 1); c.fill(); S.strokes++;
      }
    }
    c.beginPath(); c.arc(S.cx, S.cy, Math.max(2, S.lw * S.tipSize * 0.6), 0, TAU);
    c.fillStyle = rgba(S.cols[3], 1); c.fill();
  }

  function halfR(S) { return Math.min(S.W, S.H) * 0.5; }

  /* =======================================================================
     WREATH (bramble) — thorny ring around the centre, repeated by fold,
     berry clusters, open middle.
     ======================================================================= */
  function bramble(S) {
    var c = S.c;
    c.lineCap = "round"; c.lineJoin = "round";
    var fold = clamp(Math.round(num(S.p.fold)), 5, 16);
    var r0 = halfR(S) * 0.06;
    var rMax = halfR(S) * clamp(0.5 + num(S.p.reach) / 100 * 0.5, 0.35, 1) * clamp(0.6 + S.scale * 0.4, 0.5, 1.15);

    function berries(x, y) {
      if (busy(S)) return;
      var n = 3 + Math.floor(cr(S.seed, Math.round(x), 0) * 3);
      var b, a, rr, bx, by;
      for (b = 0; b < n; b++) {
        a = cr(S.seed, Math.round(x), b + 1) * TAU;
        rr = S.lw * lerp(1.1, 2.4, S.tipSize);
        bx = x + Math.cos(a) * rr * 1.4; by = y + Math.sin(a) * rr * 1.4;
        c.beginPath(); c.arc(bx, by, rr * 0.6, 0, TAU);
        c.fillStyle = rgba(S.cols[3], 0.95); c.fill(); S.strokes++;
        c.beginPath(); c.arc(bx - rr * 0.2, by - rr * 0.2, rr * 0.18, 0, TAU);
        c.fillStyle = "rgba(255,255,255,0.55)"; c.fill();
      }
    }

    var s, i, a, px, py, x, y, r, steps, t, seg, baseTurn;
    baseTurn = cr(S.seed, 1, 90) * TAU / fold;
    for (seg = 0; seg < fold; seg++) {
      var a0 = baseTurn + seg / fold * TAU;
      px = S.cx + Math.cos(a0) * r0;
      py = S.cy + Math.sin(a0) * r0;
      a = a0;
      steps = 12 + S.depth * 2;
      var segLen = (rMax - r0) / steps;
      for (i = 1; i <= steps; i++) {
        if (busy(S)) return;
        t = i / steps;
        a = a0 + Math.sin(seg * 1.7 + i * 0.8) * S.curl * 0.5;
        r = r0 + segLen * i;
        x = S.cx + Math.cos(a) * r;
        y = S.cy + Math.sin(a) * r;
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y);
        c.strokeStyle = strokeCol(S, t, seg);
        c.lineWidth = Math.max(1, S.lw * (1.4 - t * 0.5));
        c.stroke(); S.strokes++;
        if (i % 2 === 0) {
          var thornLen = S.lw * lerp(1.2, 2.8, S.tipSize);
          [-1, 1].forEach(function (side) {
            var ta = a + side + HALF * 0.6;
            c.beginPath(); c.moveTo(x, y);
            c.lineTo(x + Math.cos(ta) * thornLen, y + Math.sin(ta) * thornLen);
            c.strokeStyle = rgba(strokeCol(S, t, seg), 0.95);
            c.lineWidth = Math.max(0.7, S.lw * 0.3); c.stroke(); S.strokes++;
          });
        }
        if (i % 5 === 0 && t > 0.3) berries(x, y);
        px = x; py = y;
      }
    }
    /* hint of a rim around the open centre */
    c.beginPath(); c.arc(S.cx, S.cy, r0 * 0.6, 0, TAU);
    c.strokeStyle = rgba(S.cols[0], 0.7);
    c.lineWidth = Math.max(0.8, S.lw * 0.4); c.stroke(); S.strokes++;
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
      growthStyle: p.growthStyle,
      spread: 0.5,
      density: clamp(num(p.density) / 100, 0, 1),
      depth: clamp(Math.round(num(p.depth)), 2, 8),
      curl: clamp(num(p.curl) / 100, 0, 1),
      taperF: 0.55 + (1 - clamp(num(p.taper) / 100, 0, 1)) * 0.45,
      tipSize: clamp(num(p.tipSize) / 100, 0.1, 1),
      strokes: 0,
      phase: hash(p.seed + "p") % 19,
      reachLen: Math.max(W, H) * 0.5 * clamp(num(p.reach) / 100, 0.15, 1.2) *
                clamp(num(p.scale), 0.6, 1.7),
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
