/* =========================================================
   charts.js — Graphiques SVG faits main (aucune dépendance)
   Courbe d'équité, barres, donut, barres empilées, calendrier
   ========================================================= */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* Les couleurs viennent des jetons de la feuille de style : un seul endroit
     à changer pour retoucher le thème, et les graphiques suivent toujours. */
  var JETONS = {
    gold: '--gold', gold2: '--gold-2', green: '--green', red: '--red',
    blue: '--blue', violet: '--violet',
    text: '--muted', textBright: '--text', fond: '--bg'
  };
  var JETONS_REPLI = {
    gold: '#edbb52', gold2: '#f7d27c', green: '#2ed3a0', red: '#ff6470',
    blue: '#63b0ff', violet: '#ad92fb',
    text: '#959dae', textBright: '#eaedf5', fond: '#070910'
  };
  function jeton(nom) {
    try {
      var v = global.getComputedStyle && global.document && global.document.documentElement
        ? global.getComputedStyle(global.document.documentElement).getPropertyValue(nom)
        : '';
      v = (v || '').trim();
      return v || JETONS_REPLI[nom.replace('--', '')] || '';
    } catch (e) { return JETONS_REPLI[nom.replace('--', '')] || ''; }
  }
  function palette() {
    var c = { grid: 'rgba(255,255,255,.065)', axis: 'rgba(255,255,255,.22)' };
    Object.keys(JETONS).forEach(function (cle) { c[cle] = jeton(JETONS[cle]) || JETONS_REPLI[cle]; });
    return c;
  }
  var C = palette();
  /** Recharge les couleurs (appelé après un changement de thème ou un rendu). */
  function rafraichirPalette() { C = palette(); return C; }

  /* ---------- helpers DOM / SVG ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(x, y, value, attrs) {
    var t = s('text', Object.assign({ x: x, y: y }, attrs || {}));
    t.textContent = value;
    return t;
  }
  function fmtNum(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d });
  }
  function fmtCompact(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + 'M';
    if (a >= 1e4) return (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + 'k';
    if (a >= 1e3) return (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + 'k';
    return String(Math.round(v));
  }
  function niceTicks(min, max, target) {
    target = target || 5;
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log10(span / target)));
    var err = span / target / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
    var out = [];
    for (var v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function tooltip(host) {
    var t = host.querySelector('.chart-tip');
    if (!t) { t = el('div', 'chart-tip'); host.appendChild(t); }
    return t;
  }
  function hideTip(host) {
    var t = host.querySelector('.chart-tip');
    if (t) t.classList.remove('on');
  }
  function emptyState(host, message) {
    var ic = (global.UI && UI.icon) ? UI.icon('dashboard') : '';
    host.innerHTML = '<div class="chart-empty"><span class="ico">' + ic + '</span><p>' + message + '</p></div>';
  }

  /* =========================================================
     1. COURBE (équité, R cumulé, drawdown)
     ========================================================= */
  /**
   * @param {HTMLElement} host
   * @param {Object} o
   *   points  : [{x:Number|Date-ISO, y:Number, meta:{...}}]
   *   height  : hauteur du SVG (défaut 320)
   *   color   : couleur de la ligne
   *   baseline: valeur de référence (ligne pointillée, ex. capital de départ)
   *   yFmt    : formatteur de valeur
   *   xFmt    : formatteur d'étiquette X
   *   timeX   : true => échelle temporelle (dates), false => index
   *   tipFn   : renvoie le HTML de l'infobulle
   *   gradient: id unique
   */
  function line(host, o) {
    rafraichirPalette();
    o = o || {};
    var pts = (o.points || []).slice();
    host.classList.add('chart-host');
    clear(host);
    if (!pts.length) { emptyState(host, o.emptyMessage || 'Pas encore de données à tracer.'); return; }
    var W = 1000, H = o.height || 320;
    var m = { t: 18, r: 22, b: 30, l: 62 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var ys = pts.map(function (p) { return p.y; });
    if (o.baseline !== undefined && o.baseline !== null) ys.push(o.baseline);
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var pad = (yMax - yMin) * 0.12 || Math.abs(yMax) * 0.1 || 1;
    yMin -= pad; yMax += pad;
    var ticks = niceTicks(yMin, yMax, 5);
    yMin = Math.min(yMin, ticks[0]); yMax = Math.max(yMax, ticks[ticks.length - 1]);

    var X, Y;
    if (o.timeX) {
      var ts = pts.map(function (p) { return new Date(String(p.x).length <= 10 ? p.x + 'T12:00:00' : p.x).getTime(); });
      var t0 = Math.min.apply(null, ts), t1 = Math.max.apply(null, ts);
      if (t1 === t0) t1 = t0 + 86400000;
      X = function (t) { return m.l + (t - t0) / (t1 - t0) * iw; };
      pts = pts.map(function (p, i) { return Object.assign({}, p, { _t: ts[i], _x: X(ts[i]) }); });
    } else {
      X = function (i) { return m.l + (pts.length === 1 ? iw / 2 : i / (pts.length - 1) * iw); };
      pts = pts.map(function (p, i) { return Object.assign({}, p, { _x: X(i) }); });
    }
    Y = function (v) { return m.t + ih - (v - yMin) / (yMax - yMin) * ih; };

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', role: 'img' });
    var defs = s('defs');
    var gid = 'grad-' + Math.random().toString(36).slice(2, 8);
    var lg = s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(s('stop', { offset: '0%', 'stop-color': o.color || C.gold, 'stop-opacity': '.35' }));
    lg.appendChild(s('stop', { offset: '100%', 'stop-color': o.color || C.gold, 'stop-opacity': '0' }));
    defs.appendChild(lg);
    svg.appendChild(defs);

    // grille + axe Y
    ticks.forEach(function (v) {
      var y = Y(v);
      if (y < m.t - 2 || y > m.t + ih + 2) return;
      svg.appendChild(s('line', { x1: m.l, y1: y, x2: m.l + iw, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      svg.appendChild(txt(m.l - 10, y + 4, (o.yFmt || fmtNum)(v), {
        'text-anchor': 'end', fill: C.text, 'font-size': 12, 'font-family': 'inherit'
      }));
    });

    // ligne de référence (capital de départ / zéro)
    if (o.baseline !== undefined && o.baseline !== null && o.baseline >= yMin && o.baseline <= yMax) {
      var yb = Y(o.baseline);
      svg.appendChild(s('line', {
        x1: m.l, y1: yb, x2: m.l + iw, y2: yb, stroke: 'rgba(255,255,255,.35)',
        'stroke-width': 1.5, 'stroke-dasharray': '6 6'
      }));
      if (o.baselineLabel) {
        svg.appendChild(txt(m.l + 8, yb - 7, o.baselineLabel, { fill: 'rgba(255,255,255,.55)', 'font-size': 11, 'font-family': 'inherit' }));
      }
    }

    // aire + ligne
    var dLine = pts.map(function (p, i) { return (i ? 'L' : 'M') + p._x.toFixed(2) + ' ' + Y(p.y).toFixed(2); }).join(' ');
    var baseY = Y(Math.max(yMin, Math.min(yMax, o.areaBase !== undefined ? o.areaBase : yMin)));
    var dArea = 'M' + pts[0]._x.toFixed(2) + ' ' + baseY.toFixed(2) + ' ' +
      pts.map(function (p) { return 'L' + p._x.toFixed(2) + ' ' + Y(p.y).toFixed(2); }).join(' ') +
      ' L' + pts[pts.length - 1]._x.toFixed(2) + ' ' + baseY.toFixed(2) + ' Z';
    if (o.area !== false) svg.appendChild(s('path', { d: dArea, fill: 'url(#' + gid + ')' }));
    svg.appendChild(s('path', {
      d: dLine, fill: 'none', stroke: o.color || C.gold, 'stroke-width': o.width || 2.4,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    // point final
    var last = pts[pts.length - 1];
    svg.appendChild(s('circle', { cx: last._x, cy: Y(last.y), r: 5, fill: o.color || C.gold, stroke: C.fond, 'stroke-width': 2 }));

    // axe X
    var nLbl = Math.min(pts.length, W > 700 ? 7 : 4);
    for (var i = 0; i < nLbl; i++) {
      var idx = Math.round(i / (nLbl - 1 || 1) * (pts.length - 1));
      var p = pts[idx];
      svg.appendChild(txt(p._x, H - 8, (o.xFmt || function (v) { return String(v); })(p.x), {
        'text-anchor': i === 0 ? 'start' : i === nLbl - 1 ? 'end' : 'middle',
        fill: C.text, 'font-size': 12, 'font-family': 'inherit'
      }));
    }

    // survol
    var guide = s('line', { x1: 0, y1: m.t, x2: 0, y2: m.t + ih, stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1, opacity: 0 });
    var dot = s('circle', { r: 5.5, fill: o.color || C.gold, stroke: C.fond, 'stroke-width': 2, opacity: 0 });
    svg.appendChild(guide); svg.appendChild(dot);
    var hit = s('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', style: 'cursor:crosshair' });
    svg.appendChild(hit);
    host.appendChild(svg);

    var tip = tooltip(host);
    function nearest(clientX) {
      var box = svg.getBoundingClientRect();
      var ratio = (clientX - box.left) / box.width * W;
      var best = 0, bestD = Infinity;
      pts.forEach(function (p, i) { var dd = Math.abs(p._x - ratio); if (dd < bestD) { bestD = dd; best = i; } });
      return pts[best];
    }
    function show(clientX) {
      var p = nearest(clientX);
      guide.setAttribute('x1', p._x); guide.setAttribute('x2', p._x); guide.setAttribute('opacity', 1);
      dot.setAttribute('cx', p._x); dot.setAttribute('cy', Y(p.y)); dot.setAttribute('opacity', 1);
      tip.innerHTML = o.tipFn ? o.tipFn(p) : '<div class="tip-v">' + (o.yFmt || fmtNum)(p.y) + '</div>';
      tip.classList.add('on');
      var box = svg.getBoundingClientRect();
      var px = p._x / W * box.width;
      var tw = tip.offsetWidth || 200, th = tip.offsetHeight || 70;
      tip.style.left = Math.max(4, Math.min(box.width - tw - 4, px + 14)) + 'px';
      tip.style.top = Math.max(4, Math.min(box.height - th - 4, Y(p.y) / H * box.height - 20)) + 'px';
    }
    hit.addEventListener('mousemove', function (e) { show(e.clientX); });
    hit.addEventListener('touchmove', function (e) { if (e.touches[0]) show(e.touches[0].clientX); }, { passive: true });
    host.addEventListener('mouseleave', function () { hideTip(host); guide.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
  }

  /* =========================================================
     2. BARRES verticales (jour, semaine, mois, jour de semaine)
     ========================================================= */
  function bars(host, o) {
    rafraichirPalette();
    o = o || {};
    var items = o.items || [];
    host.classList.add('chart-host');
    clear(host);
    if (!items.length) { emptyState(host, o.emptyMessage || 'Aucune donnée sur cette période.'); return; }
    var W = 1000, H = o.height || 300;
    var m = { t: 24, r: 16, b: 34, l: 62 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var vals = items.map(function (i) { return i.value; });
    var yMax = Math.max(0, Math.max.apply(null, vals));
    var yMin = Math.min(0, Math.min.apply(null, vals));
    var ticks = niceTicks(yMin, yMax, 5);
    yMin = Math.min(yMin, ticks[0]); yMax = Math.max(yMax, ticks[ticks.length - 1]);
    var Y = function (v) { return m.t + ih - (v - yMin) / (yMax - yMin) * ih; };
    var zy = Y(0);
    var bw = iw / items.length;

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg' });
    svg.appendChild(s('line', { x1: m.l, y1: zy, x2: m.l + iw, y2: zy, stroke: C.axis, 'stroke-width': 1 }));
    ticks.forEach(function (v) {
      var y = Y(v);
      svg.appendChild(s('line', { x1: m.l, y1: y, x2: m.l + iw, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      svg.appendChild(txt(m.l - 10, y + 4, fmtCompact(v), { 'text-anchor': 'end', fill: C.text, 'font-size': 12, 'font-family': 'inherit' }));
    });

    var labelEvery = Math.max(1, Math.ceil(items.length / (o.maxLabels || 14)));
    items.forEach(function (it, i) {
      var cx = m.l + bw * i + bw / 2;
      var y = Y(it.value);
      var h = Math.abs(y - zy);
      var w = Math.max(3, Math.min(o.barWidth || 34, bw * 0.66));
      var g = s('g', { class: 'bar-group' });
      var fill = it.color || (it.value >= 0 ? C.green : C.red);
      g.appendChild(s('rect', {
        x: cx - w / 2, y: Math.min(y, zy), width: w, height: Math.max(1.5, h),
        rx: 3, fill: fill, opacity: o.opacity || 0.92
      }));
      // zone de survol large
      var hr = s('rect', { x: cx - bw / 2, y: m.t, width: bw, height: ih, fill: 'transparent' });
      g.appendChild(hr);
      if (i % labelEvery === 0 || items.length <= 12) {
        g.appendChild(txt(cx, H - 10, it.label, { 'text-anchor': 'middle', fill: C.text, 'font-size': 12, 'font-family': 'inherit' }));
      }
      var tip = tooltip(host);
      hr.addEventListener('mouseenter', function () {
        tip.innerHTML = o.tipFn ? o.tipFn(it) : '<div class="tip-t">' + it.label + '</div><div class="tip-v">' + fmtNum(it.value) + '</div>';
        tip.classList.add('on');
        var box = svg.getBoundingClientRect();
        var tw2 = tip.offsetWidth || 200, th2 = tip.offsetHeight || 74;
        tip.style.left = Math.max(4, Math.min(box.width - tw2 - 4, cx / W * box.width - tw2 / 2)) + 'px';
        tip.style.top = Math.max(4, Math.min(box.height - th2 - 4, Math.min(y, zy) / H * box.height - th2 - 8)) + 'px';
      });
      hr.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
      svg.appendChild(g);
    });
    host.appendChild(svg);
    host.addEventListener('mouseleave', function () { hideTip(host); });
  }

  /* =========================================================
     3. BARRES horizontales (setups, instruments, sessions…)
     ========================================================= */
  function hbars(host, o) {
    rafraichirPalette();
    o = o || {};
    var items = (o.items || []).slice();
    clear(host);
    if (!items.length) { emptyState(host, o.emptyMessage || 'Aucune donnée.'); return; }
    if (o.sort !== false) items.sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    if (o.limit) items = items.slice(0, o.limit);
    var max = Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); })) || 1;
    var wrap = el('div', 'hbars');
    items.forEach(function (it) {
      var row = el('div', 'hbar-row');
      var pct = Math.abs(it.value) / max * 100;
      var pos = it.value >= 0;
      row.innerHTML =
        '<div class="hbar-label" title="' + (it.label || '') + '">' + (it.label || '—') + '</div>' +
        '<div class="hbar-track"><div class="hbar-fill ' + (pos ? 'pos' : 'neg') + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="hbar-val ' + (pos ? 'pos' : 'neg') + '">' + (it.display !== undefined ? it.display : fmtNum(it.value)) + '</div>';
      if (it.sub) row.title = it.sub;
      wrap.appendChild(row);
    });
    host.appendChild(wrap);
  }

  /* =========================================================
     4. DONUT (répartition gains / pertes / neutres)
     ========================================================= */
  function donut(host, o) {
    rafraichirPalette();
    o = o || {};
    clear(host);
    var segs = (o.segments || []).filter(function (x) { return x.value > 0; });
    if (!segs.length) { emptyState(host, o.emptyMessage || 'Aucune donnée.'); return; }
    var total = segs.reduce(function (a, b) { return a + b.value; }, 0);
    var size = o.size || 210, r = size / 2 - 14, cx = size / 2, cy = size / 2;
    var stroke = o.stroke || 20;
    var svg = s('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, class: 'donut-svg' });
    // Anneau de fond
    svg.appendChild(s('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': stroke }));
    var circ = 2 * Math.PI * r;
    var offset = 0;
    segs.forEach(function (seg) {
      var frac = seg.value / total;
      var c = s('circle', {
        cx: cx, cy: cy, r: r, fill: 'none', stroke: seg.color || C.gold,
        'stroke-width': stroke, 'stroke-dasharray': (circ * frac).toFixed(2) + ' ' + circ.toFixed(2),
        'stroke-dashoffset': (-offset).toFixed(2), 'stroke-linecap': 'butt',
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
      });
      offset += circ * frac;
      var title = s('title'); title.textContent = seg.label + ' : ' + seg.value + ' (' + Math.round(frac * 100) + ' %)';
      c.appendChild(title);
      svg.appendChild(c);
    });
    if (o.centerValue !== undefined) {
      svg.appendChild(txt(cx, cy + 2, o.centerValue, { 'text-anchor': 'middle', fill: C.textBright, 'font-size': 26, 'font-weight': 700, 'font-family': 'inherit' }));
      if (o.centerLabel) svg.appendChild(txt(cx, cy + 24, o.centerLabel, { 'text-anchor': 'middle', fill: C.text, 'font-size': 12, 'font-family': 'inherit' }));
    }
    host.appendChild(svg);
    var legend = el('div', 'donut-legend');
    legend.innerHTML = segs.map(function (seg) {
      return '<div class="lg-row"><span class="lg-dot" style="background:' + (seg.color || C.gold) + '"></span>' +
        '<span class="lg-label">' + seg.label + '</span><b class="lg-val">' + seg.value + '</b>' +
        '<span class="lg-pct">' + Math.round(seg.value / total * 100) + ' %</span></div>';
    }).join('');
    host.appendChild(legend);
  }

  /* =========================================================
     5. BARRE EMPILÉE horizontale (répartition R, discipline…)
     ========================================================= */
  function stack(host, o) {
    rafraichirPalette();
    o = o || {};
    clear(host);
    var segs = o.segments || [];
    var total = segs.reduce(function (a, b) { return a + b.value; }, 0);
    if (!total) { emptyState(host, o.emptyMessage || 'Aucune donnée.'); return; }
    var wrap = el('div', 'stack-wrap');
    var bar = el('div', 'stack-bar');
    segs.forEach(function (seg, i) {
      if (!seg.value) return;
      var d = el('div', 'stack-seg',
        (seg.value / total >= 0.07 ? '<span>' + (o.fmtPct ? Math.round(seg.value / total * 100) + '%' : seg.value) + '</span>' : ''));
      d.style.width = (seg.value / total * 100) + '%';
      d.style.background = seg.color || C.gold;
      d.title = seg.label + ' : ' + seg.value + ' (' + (seg.value / total * 100).toFixed(1) + ' %)';
      if (seg.meta) d.title += ' — ' + seg.meta;
      bar.appendChild(d);
    });
    wrap.appendChild(bar);
    if (o.legend !== false) {
      var legend = el('div', 'stack-legend');
      legend.innerHTML = segs.filter(function (x) { return x.value; }).map(function (seg) {
        return '<div class="lg-row"><span class="lg-dot" style="background:' + (seg.color || C.gold) + '"></span>' +
          '<span class="lg-label">' + seg.label + '</span><b class="lg-val">' + seg.value + '</b>' +
          '<span class="lg-pct">' + (seg.value / total * 100).toFixed(1) + ' %</span></div>';
      }).join('');
      wrap.appendChild(legend);
    }
    host.appendChild(wrap);
  }

  /* =========================================================
     6. SPARKLINE
     ========================================================= */
  function sparkline(host, o) {
    rafraichirPalette();
    o = o || {};
    var vals = (o.values || []).filter(function (v) { return v !== null && v !== undefined; });
    clear(host);
    if (vals.length < 2) return;
    var W = 220, H = o.height || 46, p = 5;
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var X = function (i) { return p + i / (vals.length - 1) * (W - p * 2); };
    var Y = function (v) { return H - p - (v - min) / (max - min) * (H - p * 2); };
    var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark' });
    var gid = 'sg' + Math.random().toString(36).slice(2, 7);
    var defs = s('defs'), lg = s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(s('stop', { offset: '0%', 'stop-color': o.color || C.gold, 'stop-opacity': '.3' }));
    lg.appendChild(s('stop', { offset: '100%', 'stop-color': o.color || C.gold, 'stop-opacity': '0' }));
    defs.appendChild(lg); svg.appendChild(defs);
    svg.appendChild(s('path', { d: d + ' L' + X(vals.length - 1) + ' ' + H + ' L' + X(0) + ' ' + H + ' Z', fill: 'url(#' + gid + ')' }));
    svg.appendChild(s('path', { d: d, fill: 'none', stroke: o.color || C.gold, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    host.appendChild(svg);
  }

  /* =========================================================
     7. CALENDRIER MENSUEL (performance jour par jour)
     ========================================================= */
  var MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  var DOWS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  function dayCell(dateISO, day, data, fmt, onPick, today, maxAbs, cellFmt) {
    var cell = el('div', 'cal-cell');
    if (!day) { cell.classList.add('cal-empty'); return cell; }
    if (today && dateISO === today) cell.classList.add('cal-today');
    var d = data && data[dateISO];
    var headRow = el('span', 'cal-top');
    headRow.appendChild(el('span', 'cal-day', String(day)));
    cell.appendChild(headRow);
    if (d) {
      cell.classList.add(d.net > 0 ? 'pos' : d.net < 0 ? 'neg' : 'flat');
      // intensité proportionnelle à la meilleure/pire journée de l'année (1 à 3)
      var ref = maxAbs > 0 ? Math.abs(d.net) / maxAbs : 0;
      var lvl = d.net === 0 ? 0 : Math.max(1, Math.min(3, Math.ceil(ref * 3)));
      cell.classList.add('lvl' + lvl);
      // nombre de trades dans le coin, puis le montant et le multiple de R : tout tient sur une ligne
      headRow.appendChild(el('span', 'cal-count', d.count > 1 ? String(d.count) : ''));
      cell.appendChild(el('span', 'cal-val', cellFmt(d.net)));
      cell.appendChild(el('span', 'cal-sub',
        d.hasR ? (d.r > 0 ? '+' : '') + d.r.toFixed(1).replace('.', ',') + 'R' : '—'));
      cell.title = dateISO + ' — ' + d.count + ' trade' + (d.count > 1 ? 's' : '') + ', ' + (d.net > 0 ? '+' : '') +
        fmt(d.net) + (d.hasR ? ', ' + d.r.toFixed(2).replace('.', ',') + ' R' : '');
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', function () { if (onPick) onPick(dateISO); });
    }
    return cell;
  }

  function monthGrid(year, month, data, fmt, onPick, today, maxAbs) {
    var wrap = el('div', 'cal-mini');
    wrap.appendChild(el('div', 'cal-title', MONTHS[month] + ' ' + year));
    var head = el('div', 'cal-head');
    DOWS.forEach(function (d) { head.appendChild(el('span', '', d)); });
    wrap.appendChild(head);
    var grid = el('div', 'cal-grid');
    var first = new Date(year, month, 1);
    var offset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    // dans une case : pas de symbole monétaire (il tient sur une ligne dans l'infobulle et les totaux)
    var cellFmt = function (v) {
      var txt = fmt(v).replace(/\s*€/, '').replace(/\u00a0/g, ' ');
      return (v > 0 ? '+' : '') + txt;
    };
    for (var i = 0; i < offset; i++) grid.appendChild(dayCell(null, null, data, fmt, onPick, today, maxAbs, cellFmt));
    for (var d = 1; d <= daysInMonth; d++) {
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      grid.appendChild(dayCell(iso, d, data, fmt, onPick, today, maxAbs, cellFmt));
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /** Année complète : 12 mini-calendriers + total par mois. */
  function yearCalendar(host, o) {
    o = o || {};
    clear(host);
    var data = o.dailyMap || {};
    if (!Object.keys(data).length) { emptyState(host, 'Aucune journée clôturée sur cette période.'); return; }
    var fmt = o.fmt || function (v) { return fmtNum(v, 0); };
    var monthsNet = {};
    Object.keys(data).forEach(function (k) {
      var mk = k.slice(0, 7);
      monthsNet[mk] = (monthsNet[mk] || 0) + data[k].net;
    });
    var year = o.year || String(o.today).slice(0, 4);
    // référence d'intensité : la plus forte journée de l'année
    var maxAbs = Object.keys(data).reduce(function (m, k) { return Math.max(m, Math.abs(data[k].net)); }, 0);
    var grid = el('div', 'cal-year');
    for (var m = 0; m < 12; m++) {
      var mk = year + '-' + String(m + 1).padStart(2, '0');
      var mini = monthGrid(+year, m, data, fmt, o.onPick, o.today, maxAbs);
      var tot = monthsNet[mk] || 0;
      var badge = el('div', 'cal-total ' + (tot > 0 ? 'pos' : tot < 0 ? 'neg' : 'flat'),
        (tot > 0 ? '+' : '') + fmt(tot));
      if (monthsNet[mk] === undefined) badge.innerHTML = '<span class="muted">—</span>';
      mini.appendChild(badge);
      grid.appendChild(mini);
    }
    host.appendChild(grid);
  }

  var Charts = {
    colors: C, palette: palette, rafraichirPalette: rafraichirPalette,
    line: line, bars: bars, hbars: hbars, donut: donut, stack: stack,
    sparkline: sparkline, yearCalendar: yearCalendar, fmtNum: fmtNum, fmtCompact: fmtCompact,
    el: el, clear: clear, MONTHS: MONTHS
  };
  global.Charts = Charts;
  if (typeof module !== 'undefined' && module.exports) module.exports = Charts;
})(typeof window !== 'undefined' ? window : globalThis);
