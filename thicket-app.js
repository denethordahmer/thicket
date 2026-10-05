/* =========================================================================
   THICKET: thicket-app.js
   Controls, colours, colour picker, saved looks and saving images.
   Uses ThicketStyles.draw() from thicket-styles.js for the drawing.
   Removed origin/lean/spread. Added fold for coral and bramble.
   ========================================================================= */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var canvas = $("mainCanvas");
  var sheet = $("sheet");
  var handle = $("sheetHandle");

  var CONTROLS = [
    "growthStyle", "seed", "scale", "reach", "depth", "curl", "density",
    "lineWeight", "taper", "tips", "tipSize", "colourStyle", "fold",
    "bambooCount", "bambooLeafLen", "fernCount", "fernSpacing",
    "colorScheme", "color1", "color2", "color3", "color4",
    "bgStyle", "bgColor", "bgColor2", "bgTransparent",
    "size", "format", "filename"
  ];
  var COLOR_IDS = ["color1", "color2", "color3", "color4", "bgColor", "bgColor2"];

  var SIZES = {
    square: [1500, 1500],
    portrait: [1080, 1620],
    a17: [1080, 2340],
    landscape: [1920, 1080]
  };

  /* ---------- colour maths ---------- */
  function hexToRgb(hex) {
    var h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      return ("0" + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2);
    }).join("");
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
    if (s === 0) { var v = l * 255; return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function f(t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function hslHex(h, s, l) {
    var c = hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100));
    return rgbToHex(c[0], c[1], c[2]);
  }
  function hsvToRgb(h, s, v) {
    h = (((h % 360) + 360) % 360) / 60;
    var i = Math.floor(h), f = h - i;
    var p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f)), r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q;
    }
    return [r * 255, g * 255, b * 255];
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d !== 0) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx === 0 ? 0 : d / mx, mx];
  }

  /* ---------- colour schemes ---------- */
  var BUILD_SCHEMES = ["complementary", "splitcomp", "analogous", "triadic", "tetradic", "monochrome"];

  var FIXED = {
    moss:   ["#c9a24a", "#9bcf7a", "#4f7a3a", "#e8d28a", "#0e130e", "#1c2a1b"],
    autumn: ["#d97706", "#b45309", "#f5deb3", "#7c2d12", "#160f0a", "#2a1a10"],
    forest: ["#84cc16", "#22c55e", "#0d9488", "#bef264", "#06130a", "#0d2414"],
    noir:   ["#ff3b3b", "#e5e7eb", "#9ca3af", "#4b5563", "#0a0a0a", "#1a1a1a"],
    neon:   ["#00e5ff", "#ff00e5", "#aaff00", "#b026ff", "#000000", "#0a0a0a"],
    pastel: ["#a5b4fc", "#f0abfc", "#99f6e4", "#fde68a", "#0b1020", "#1e1b3a"]
  };

  function buildScheme(name, c1hex) {
    var rgb = hexToRgb(c1hex);
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0];
    var s = hsl[1] < 6 ? 65 : hsl[1];
    var l = clamp(hsl[2], 12, 88);
    var lit = clamp(l + 15, 8, 94);
    switch (name) {
      case "complementary":
        return [c1hex, hslHex(h + 180, s, l), hslHex(h, s, lit), hslHex(h + 180, s, lit)];
      case "splitcomp":
        return [c1hex, hslHex(h + 150, s, l), hslHex(h + 210, s, l), hslHex(h, s, lit)];
      case "analogous":
        return [c1hex, hslHex(h + 25, s, l), hslHex(h - 25, s, l), hslHex(h + 50, s, l)];
      case "triadic":
        return [c1hex, hslHex(h + 120, s, l), hslHex(h + 240, s, l), hslHex(h, s, lit)];
      case "tetradic":
        return [c1hex, hslHex(h + 90, s, l), hslHex(h + 180, s, l), hslHex(h + 270, s, l)];
      case "monochrome":
        return [c1hex, hslHex(h, s, clamp(l + 18, 8, 94)), hslHex(h, s, clamp(l - 18, 8, 94)), hslHex(h, s, clamp(l + 32, 8, 94))];
    }
    return null;
  }

  function setColor(id, hex) {
    $(id).value = hex;
    var dot = $(id + "Dot");
    if (dot) dot.style.background = hex;
  }

  function applyScheme(name) {
    if (name === "custom") return;
    if (FIXED[name]) {
      var f = FIXED[name];
      setColor("color1", f[0]); setColor("color2", f[1]);
      setColor("color3", f[2]); setColor("color4", f[3]);
      setColor("bgColor", f[4]); setColor("bgColor2", f[5]);
    } else {
      var out = buildScheme(name, $("color1").value);
      if (out) {
        setColor("color2", out[1]); setColor("color3", out[2]); setColor("color4", out[3]);
      }
    }
  }

  /* ---------- labels ---------- */
  var LABELS = {
    tips: { none: "None", dots: "Dots", buds: "Buds", leaves: "Leaves" },
    colourStyle: { fade: "Fade root to tip", limb: "Colour per strand", random: "Random per strand" }
  };

  function syncBadge(id) {
    var el = $(id), badge = $(id + "Val");
    if (!el || !badge) return;
    if (LABELS[id] && LABELS[id][el.value]) {
      badge.textContent = LABELS[id][el.value];
    } else if (el.tagName === "SELECT") {
      var o = el.options[el.selectedIndex];
      badge.textContent = o ? o.text.replace(/\s*\(.*\)$/, "") : el.value;
    } else {
      badge.textContent = el.value;
    }
  }
  function syncAllBadges() {
    CONTROLS.forEach(syncBadge);
    $("bgTransparentVal").textContent = $("bgTransparent").value === "true" ? "On" : "Off";
  }

  function updateVisibility() {
    var style = $("growthStyle").value;
    document.querySelectorAll("[data-styles]").forEach(function (el) {
      var ok = el.getAttribute("data-styles").split(" ").indexOf(style) !== -1;
      el.classList.toggle("hidden", !ok);
    });
    var names = { tree: "Tree of life", bamboo: "Grove", reed: "Fountain",
      mycelium: "Mirror lace", fern: "Corner frames", coral: "Mandala", bramble: "Wreath" };
    $("sheetLabel").textContent = names[style] || "Settings";
  }

  function updateBgRows() {
    var trans = $("bgTransparent").value === "true";
    var style = $("bgStyle").value;
    $("bgColor2Row").classList.toggle("hidden", style === "solid");
    ["bgStyle", "bgColor", "bgColor2"].forEach(function (key) {
      var row = document.querySelector('.settingRow[data-key="' + key + '"]');
      if (!row) return;
      row.classList.toggle("dimmed", trans);
      if (trans) row.setAttribute("data-note", "Transparent is on");
      else row.removeAttribute("data-note");
    });
  }

  function setTransparent(on) {
    $("bgTransparent").value = on ? "true" : "false";
    var tg = $("bgTransparentToggle");
    tg.setAttribute("data-on", on ? "true" : "false");
    tg.textContent = on ? "On" : "Off";
    $("bgTransparentVal").textContent = on ? "On" : "Off";
    updateBgRows();
  }

  /* ---------- drawing ---------- */
  function getParams() {
    var p = {};
    CONTROLS.forEach(function (id) { p[id] = $(id).value; });
    p.colors = [p.color1, p.color2, p.color3, p.color4];
    return p;
  }

  function paintBackground(c, W, H, p) {
    var style = p.bgStyle, g;
    if (style === "solid") {
      c.fillStyle = p.bgColor;
    } else {
      if (style === "radial") {
        g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.62);
      } else if (style === "diagonal") {
        g = c.createLinearGradient(0, 0, W, H);
      } else {
        g = c.createLinearGradient(0, 0, 0, H);
      }
      g.addColorStop(0, p.bgColor);
      g.addColorStop(1, p.bgColor2);
      c.fillStyle = g;
    }
    c.fillRect(0, 0, W, H);
  }

  function renderTo(target, factor, withBg) {
    var sz = SIZES[$("size").value] || SIZES.square;
    var W = Math.round(sz[0] * factor), H = Math.round(sz[1] * factor);
    target.width = W; target.height = H;
    var c = target.getContext("2d");
    c.clearRect(0, 0, W, H);
    var p = getParams();
    if (withBg) paintBackground(c, W, H, p);
    ThicketStyles.draw(c, W, H, p);
  }

  function renderPreview() {
    var sz = SIZES[$("size").value] || SIZES.square;
    var f = Math.min(1, 1200 / Math.max(sz[0], sz[1]));
    renderTo(canvas, f, $("bgTransparent").value !== "true");
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; renderPreview(); }, 40);
  }

  function layoutCanvas() {
    canvas.style.top = "56px";
    canvas.style.height = Math.max(100, window.innerHeight - 56 - 76) + "px";
  }
  window.addEventListener("resize", layoutCanvas);

  /* ---------- saving ---------- */
  function cleanName(s) {
    s = String(s || "").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "-");
    return s || "thicket";
  }

  function exportImage() {
    var jpg = $("format").value === "jpg";
    var withBg = jpg || $("bgTransparent").value !== "true";
    var out = document.createElement("canvas");
    renderTo(out, 1, withBg);
    out.toBlob(function (blob) {
      if (!blob) { alert("Could not make the image. Try a smaller size."); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = cleanName($("filename").value) + (jpg ? ".jpg" : ".png");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, jpg ? "image/jpeg" : "image/png", 0.92);
  }

  /* ---------- randomize ---------- */
  var STYLE_RANDOM = {
    tree:     ["depth", "curl", "density", "taper", "tips"],
    bamboo:   ["bambooCount", "bambooLeafLen", "density", "curl"],
    reed:     ["density", "curl", "tips"],
    mycelium: ["density", "curl", "depth", "taper"],
    fern:     ["fernCount", "fernSpacing", "curl"],
    coral:    ["fold", "density", "reach", "depth", "curl"],
    bramble:  ["fold", "density", "reach", "curl", "depth", "tips"]
  };

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function randomizeControl(id) {
    var el = $(id);
    if (!el) return;
    if (el.tagName === "SELECT") {
      el.selectedIndex = Math.floor(Math.random() * el.options.length);
    } else {
      var mn = parseFloat(el.min), mx = parseFloat(el.max), st = parseFloat(el.step) || 1;
      var steps = Math.floor((mx - mn) / st);
      var v = mn + Math.floor(Math.random() * (steps + 1)) * st;
      el.value = String(Math.round(v * 1000) / 1000);
    }
  }

  function randomSeed() {
    var words = ["thicket", "oak", "reed", "fern", "spore", "bough", "root", "vine", "moss", "willow", "frond", "grove"];
    return pick(words) + "-" + Math.floor(Math.random() * 8999);
  }

  /* Keeps your style, size, background and transparency. */
  function randomizeAll() {
    $("seed").value = randomSeed();
    (STYLE_RANDOM[$("growthStyle").value] || []).forEach(randomizeControl);
    $("reach").value = String(40 + Math.floor(Math.random() * 61));
    $("scale").value = (0.7 + Math.floor(Math.random() * 11) * 0.1).toFixed(2).replace(/0$/, "");
    $("lineWeight").value = String(2 + Math.floor(Math.random() * 8));
    $("colourStyle").value = pick(["fade", "limb", "random"]);
    var c1 = hslHex(Math.random() * 360, 45 + Math.random() * 35, 40 + Math.random() * 20);
    setColor("color1", c1);
    $("colorScheme").value = pick(BUILD_SCHEMES);
    applyScheme($("colorScheme").value);
    syncAllBadges();
    schedule();
  }

  /* ---------- sheet and rows ---------- */
  handle.addEventListener("click", function (e) {
    if (e.target.closest(".generateBtn")) return;
    sheet.classList.toggle("open");
  });
  canvas.addEventListener("click", function () { sheet.classList.remove("open"); });

  document.querySelectorAll(".settingRow").forEach(function (row) {
    row.addEventListener("click", function (e) {
      var wasActive = row.classList.contains("active");
      if (e.target.closest(".settingControl") && wasActive) return;
      var key = row.getAttribute("data-key");
      document.querySelectorAll(".settingRow.active").forEach(function (r) { r.classList.remove("active"); });
      if (COLOR_IDS.indexOf(key) !== -1) {
        var nm = row.querySelector(".settingName");
        openPicker(key, nm ? nm.textContent : key);
        return;
      }
      if (!wasActive) row.classList.add("active");
    });
  });

  /* ---------- wire controls ---------- */
  function onControlChange(id) {
    syncBadge(id);
    if (id === "growthStyle") updateVisibility();
    if (id === "colorScheme") applyScheme($(id).value);
    if (id === "bgStyle") updateBgRows();
    schedule();
  }

  CONTROLS.forEach(function (id) {
    var el = $(id);
    if (!el || el.type === "hidden") return;
    el.addEventListener("input", function () { onControlChange(id); });
    el.addEventListener("change", function () { onControlChange(id); });
  });

  $("bgTransparentToggle").addEventListener("click", function (e) {
    e.stopPropagation();
    setTransparent($("bgTransparent").value !== "true");
    schedule();
  });

  $("btnNewSeed").addEventListener("click", function (e) {
    e.stopPropagation();
    $("seed").value = randomSeed();
    syncBadge("seed");
    schedule();
  });

  $("btnRandomize").addEventListener("click", randomizeAll);
  $("btnExport").addEventListener("click", exportImage);
  $("btnGenerate").addEventListener("click", function () {
    renderPreview();
    sheet.classList.remove("open");
  });

  /* ---------- saved looks ---------- */
  var PRESET_KEY = "thicket_presets_v1";

  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function storePresets(obj) {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(obj)); }
    catch (e) { alert("Could not save on this phone."); }
  }
  function refreshPresetList() {
    var presets = loadPresets();
    var list = $("presetList");
    list.innerHTML = '<option value="">— none saved —</option>';
    var names = Object.keys(presets);
    names.forEach(function (n) {
      var o = document.createElement("option");
      o.value = n; o.textContent = n;
      list.appendChild(o);
    });
    $("presetCountVal").textContent = names.length;
  }

  $("btnSavePreset").addEventListener("click", function (e) {
    e.stopPropagation();
    var name = prompt("Name this look:");
    if (!name) return;
    var data = {};
    CONTROLS.forEach(function (id) { data[id] = $(id).value; });
    var presets = loadPresets();
    presets[name] = data;
    storePresets(presets);
    refreshPresetList();
    $("presetList").value = name;
  });

  $("btnLoadPreset").addEventListener("click", function (e) {
    e.stopPropagation();
    var name = $("presetList").value;
    if (!name) return;
    var data = loadPresets()[name];
    if (!data) return;
    CONTROLS.forEach(function (id) {
      var el = $(id);
      if (el && data[id] !== undefined) el.value = data[id];
    });
    COLOR_IDS.forEach(function (id) { setColor(id, $(id).value); });
    setTransparent($("bgTransparent").value === "true");
    syncAllBadges();
    updateVisibility();
    updateBgRows();
    schedule();
  });

  $("btnDeletePreset").addEventListener("click", function (e) {
    e.stopPropagation();
    var name = $("presetList").value;
    if (!name) return;
    if (!confirm('Delete "' + name + '"?')) return;
    var presets = loadPresets();
    delete presets[name];
    storePresets(presets);
    refreshPresetList();
  });

  /* ---------- colour picker ---------- */
  var CP = {
    overlay: $("colorPickerOverlay"),
    sl: $("cpSLCanvas"), hue: $("cpHueCanvas"),
    slCur: $("cpSLCursor"), hueCur: $("cpHueCursor"),
    hex: $("cpHexInput"), prev: $("cpHexPreview"),
    presets: $("cpPresets"), title: $("cpTitle"),
    h: 40, s: 0.55, v: 0.8, target: null,
    PRESETS: [
      "#c9a24a", "#9bcf7a", "#4f7a3a", "#e8d28a", "#0e130e",
      "#1c2a1b", "#ffffff", "#000000", "#94a3b8", "#475569",
      "#38bdf8", "#a855f7", "#ec4899", "#f97316", "#ef4444",
      "#22c55e", "#fde68a", "#bbf7d0", "#fce7f3", "#0b1020"
    ]
  };

  function cpSetHex(hex) {
    var rgb = hexToRgb(hex);
    var hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    if (hsv[1] > 0.001 && hsv[2] > 0.001) CP.h = hsv[0];
    CP.s = hsv[1]; CP.v = hsv[2];
  }
  function cpHex() {
    var c = hsvToRgb(CP.h, CP.s, CP.v);
    return rgbToHex(c[0], c[1], c[2]);
  }
  function cpDrawHue() {
    var c = CP.hue;
    c.width = c.offsetWidth || 300; c.height = c.offsetHeight || 32;
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, c.width, 0);
    for (var i = 0; i <= 12; i++) g.addColorStop(i / 12, "hsl(" + (i / 12 * 360) + ",100%,50%)");
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  }
  function cpDrawSL() {
    var c = CP.sl;
    c.width = c.offsetWidth || 300; c.height = c.offsetHeight || 180;
    var x = c.getContext("2d");
    var gH = x.createLinearGradient(0, 0, c.width, 0);
    gH.addColorStop(0, "#ffffff");
    gH.addColorStop(1, "hsl(" + CP.h + ",100%,50%)");
    x.fillStyle = gH; x.fillRect(0, 0, c.width, c.height);
    var gV = x.createLinearGradient(0, 0, 0, c.height);
    gV.addColorStop(0, "rgba(0,0,0,0)"); gV.addColorStop(1, "rgba(0,0,0,1)");
    x.fillStyle = gV; x.fillRect(0, 0, c.width, c.height);
  }
  function cpMoveCursors() {
    CP.hueCur.style.left = (CP.h / 360 * CP.hue.offsetWidth) + "px";
    CP.slCur.style.left = (CP.s * CP.sl.offsetWidth) + "px";
    CP.slCur.style.top = ((1 - CP.v) * CP.sl.offsetHeight) + "px";
    CP.prev.style.background = cpHex();
  }
  function cpUpdate() {
    cpMoveCursors();
    CP.hex.value = cpHex().slice(1).toUpperCase();
  }
  function cpBuildPresets() {
    CP.presets.innerHTML = "";
    CP.PRESETS.forEach(function (hex) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cpPresetSwatch";
      b.style.background = hex;
      b.addEventListener("click", function () {
        cpSetHex(hex); cpDrawSL(); cpUpdate();
      });
      CP.presets.appendChild(b);
    });
  }

  function openPicker(id, label) {
    CP.target = id;
    CP.title.textContent = "Pick: " + label;
    cpSetHex($(id).value);
    CP.overlay.classList.remove("hidden");
    requestAnimationFrame(function () {
      cpDrawHue(); cpDrawSL(); cpUpdate(); cpBuildPresets();
    });
  }

  function dragOn(el, handler) {
    var down = false;
    el.addEventListener("pointerdown", function (e) {
      down = true;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      handler(e); e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (down) { handler(e); e.preventDefault(); }
    });
    function stop() { down = false; }
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("lostpointercapture", stop);
  }

  dragOn(CP.hue, function (e) {
    var r = CP.hue.getBoundingClientRect();
    CP.h = clamp((e.clientX - r.left) / r.width, 0, 1) * 360;
    cpDrawSL(); cpUpdate();
  });
  dragOn(CP.sl, function (e) {
    var r = CP.sl.getBoundingClientRect();
    CP.s = clamp((e.clientX - r.left) / r.width, 0, 1);
    CP.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
    cpUpdate();
  });

  CP.hex.addEventListener("input", function () {
    var v = CP.hex.value.replace(/[^0-9a-fA-F]/g, "");
    if (v.length === 6) {
      cpSetHex("#" + v);
      cpDrawSL();
      cpMoveCursors();
    }
  });

  function cpClose() { CP.overlay.classList.add("hidden"); }

  $("cpApply").addEventListener("click", function () {
    var hex = cpHex();
    var id = CP.target;
    if (id) {
      setColor(id, hex);
      if (id === "color1" && BUILD_SCHEMES.indexOf($("colorScheme").value) !== -1) {
        applyScheme($("colorScheme").value);
      } else {
        $("colorScheme").value = "custom";
      }
      syncBadge("colorScheme");
      schedule();
    }
    cpClose();
  });
  $("cpCancel").addEventListener("click", cpClose);
  CP.overlay.addEventListener("click", function (e) {
    if (e.target === CP.overlay) cpClose();
  });

  /* ---------- start ---------- */
  COLOR_IDS.forEach(function (id) { setColor(id, $(id).value); });
  setTransparent(false);
  refreshPresetList();
  syncAllBadges();
  updateVisibility();
  updateBgRows();
  layoutCanvas();
  renderPreview();
})();
