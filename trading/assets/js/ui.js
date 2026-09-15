/* =========================================================
   ui.js — Helpers d'interface (formatage, DOM, modales, toasts)
   ========================================================= */
(function (global) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function attr(v) { return esc(v).replace(/\n/g, ' '); }

  /* ---------- formatage ---------- */
  var state = { currency: 'EUR', symbol: '€' };

  function setCurrency(code) {
    state.currency = code || 'EUR';
    var found = (global.Store ? global.Store.CURRENCIES : []).filter(function (c) { return c.code === state.currency; })[0];
    state.symbol = found ? found.symbol : state.currency;
  }
  function fmtMoney(v, opts) {
    opts = opts || {};
    if (v === null || v === undefined || isNaN(v)) return '—';
    var decimals = opts.decimals !== undefined ? opts.decimals : Math.abs(v) >= 1000 ? 0 : 2;
    var s;
    try {
      s = new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: state.currency,
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      }).format(v);
    } catch (e) {
      s = Number(v).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' ' + state.symbol;
    }
    return s.replace(/\u202f|\u00a0/g, ' ');
  }
  function fmtMoneySigned(v, opts) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + fmtMoney(v, opts);
  }
  function fmtNum(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d });
  }
  function fmtR(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + fmtNum(v, d === undefined ? 2 : d) + 'R';
  }
  function fmtPct(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + fmtNum(v, d === undefined ? 2 : d) + ' %';
  }
  function signClass(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat'; }
  function toneClass(v, invert) {
    if (v === null || v === undefined || isNaN(v)) return 'flat';
    var s = v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat';
    return invert ? (s === 'pos' ? 'neg' : s === 'neg' ? 'pos' : 'flat') : s;
  }
  function dur(v) {
    if (!v && v !== 0) return '—';
    if (v < 60) return v + ' min';
    var h = Math.floor(v / 60), m = v % 60;
    return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ---------- modales ---------- */
  var modalStack = [];
  function openModal(opts) {
    opts = opts || {};
    var overlay = el('div', 'modal-overlay ' + (opts.size || ''));
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '<header class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
      '<button class="icon-btn" data-close aria-label="Fermer"><svg class="ico-svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>' +
      '<div class="modal-body"></div>' +
      (opts.footer === false ? '' : '<footer class="modal-foot"></footer>') +
      '</div>';
    var body = $('.modal-body', overlay);
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content) body.appendChild(opts.content);
    var foot = $('.modal-foot', overlay);
    if (foot && opts.footerButtons) {
      opts.footerButtons.forEach(function (b) {
        var btn = el('button', 'btn ' + (b.class || ''), b.label);
        btn.addEventListener('click', function () { b.onClick && b.onClick(overlay, close); });
        foot.appendChild(btn);
      });
    } else if (foot && !opts.footerButtons) {
      foot.remove();
    }
    function close() {
      overlay.classList.remove('on');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 160);
      modalStack = modalStack.filter(function (m) { return m !== overlay; });
      if (!modalStack.length) document.body.classList.remove('modal-open');
      opts.onClose && opts.onClose();
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('[data-close]')) close();
    });
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    modalStack.push(overlay);
    requestAnimationFrame(function () { overlay.classList.add('on'); });
    return { overlay: overlay, body: body, close: close };
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      // Important : fermer la fenêtre déclenche aussi onClose. Sans ce verrou,
      // la réponse « Annuler » écrasait la réponse « Confirmer » et toutes les
      // confirmations étaient refusées silencieusement.
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      openModal({
        title: opts.title || 'Confirmation',
        size: 'sm',
        content: '<p class="confirm-text">' + opts.message + '</p>' +
          (opts.hint ? '<p class="confirm-hint">' + opts.hint + '</p>' : ''),
        footerButtons: [
          // done() est appelé AVANT close() : fermer la fenêtre déclenche onClose
          // (réponse « Annuler »), qui doit arriver en second et ne plus compter.
          { label: opts.cancelLabel || 'Annuler', class: 'ghost', onClick: function (o, close) { done(false); close(); } },
          { label: opts.confirmLabel || 'Confirmer', class: opts.danger ? 'danger' : 'primary', onClick: function (o, close) { done(true); close(); } }
        ],
        onClose: function () { done(false); }
      });
    });
  }

  /* ---------- toasts ---------- */
  function toast(message, type, ms) {
    var host = $('#toasts') || (function () {
      var h = el('div', ''); h.id = 'toasts'; document.body.appendChild(h); return h;
    })();
    var ic = type === 'error' ? 'warn' : type === 'warn' ? 'bolt' : type === 'info' ? 'info' : 'check';
    var t = el('div', 'toast ' + (type || ''), '<span class="toast-ico">' + icon(ic) + '</span><span>' + esc(message) + '</span>');
    host.appendChild(t);
    // Pas plus de 3 notifications à l'écran : on retire la plus ancienne
    var all = Array.prototype.slice.call(host.children);
    if (all.length > 3) all.slice(0, all.length - 3).forEach(function (old) {
      old.classList.remove('on');
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 200);
    });
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () {
      t.classList.remove('on');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, ms || 3600);
  }

  /* ---------- contrôles de formulaire ---------- */
  function field(label, controlHTML, hint, cls) {
    return '<label class="field ' + (cls || '') + '"><span class="field-label">' + esc(label) + '</span>' +
      controlHTML + (hint ? '<span class="field-hint">' + hint + '</span>' : '') + '</label>';
  }
  function selectHTML(name, options, value, placeholder) {
    var html = '<select name="' + name + '" class="input">';
    if (placeholder !== undefined && placeholder !== null) html += '<option value="">' + esc(placeholder) + '</option>';
    options.forEach(function (o) {
      var val = typeof o === 'string' ? o : o.value, lab = typeof o === 'string' ? o : o.label;
      html += '<option value="' + attr(val) + '"' + (String(val) === String(value === null || value === undefined ? '' : value) ? ' selected' : '') + '>' + esc(lab) + '</option>';
    });
    return html + '</select>';
  }
  function segHTML(name, options, value, extraClass) {
    var html = '<div class="seg ' + (extraClass || '') + '" data-name="' + name + '">';
    options.forEach(function (o) {
      var val = typeof o === 'string' ? o : o.value, lab = typeof o === 'string' ? o : o.label;
      html += '<button type="button" class="seg-btn' + (String(val) === String(value) ? ' active' : '') + '" data-val="' + attr(val) + '">' + esc(lab) + '</button>';
    });
    return html + '</div>';
  }
  function chipHTML(label, value, cls) {
    return '<span class="chip ' + (cls || '') + '">' + esc(label) + '</span>';
  }


  /* ---------- icônes SVG (indépendantes des polices emoji) ---------- */
  var ICONS = {
    dashboard: '<path d="M3 20h18"/><path d="M6.5 20v-8"/><path d="M12 20V5"/><path d="M17.5 20v-5"/>',
    journal: '<path d="M6.5 3h11.5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5"/><path d="M6.5 3A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21"/><path d="M10 8h6.5M10 12h6.5M10 16h4"/>',
    calendrier: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    analyses: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/><path d="M8.2 12.2l2.1-2.4 1.9 1.6 2.2-2.6"/>',
    plan: '<circle cx="12" cy="12" r="8.2"/><path d="M15.6 8.4 13.3 13.3 8.4 15.6l2.3-4.9z"/>',
    params: '<path d="M4 7.5h8.4M18.4 7.5H20M4 16.5h2.6M12.6 16.5H20"/><circle cx="15.4" cy="7.5" r="2.3"/><circle cx="9.6" cy="16.5" r="2.3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"/>',
    trash: '<path d="M4 7h16"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 12.2A1.8 1.8 0 0 0 9.3 21h5.4a1.8 1.8 0 0 0 1.8-1.8L17.5 7"/><path d="M10.5 11v6M13.5 11v6"/>',
    logo: '<path d="M3.5 18.5 9.2 11l4.1 3.2L20.5 5.5"/><circle cx="20.5" cy="5.5" r="1.9" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    importFile: '<path d="M12 3.5v11"/><path d="M7.6 10.5 12 14.9l4.4-4.4"/><path d="M4 20.5h16"/>',
    flask: '<path d="M9.5 3.5h5"/><path d="M10.5 3.5v6.2l-4.2 8.1A2.6 2.6 0 0 0 8.6 21.5h6.8a2.6 2.6 0 0 0 2.3-3.7l-4.2-8.1V3.5"/>',
    broom: '<path d="M20.5 3.5 13 11"/><path d="M10.4 8.8 6.2 13l4.8 4.8 4.2-4.2z"/><path d="M6.2 17.8 3.5 20.5"/>',
    stop: '<circle cx="12" cy="12" r="8.6"/><path d="M6.1 6.1 17.9 17.9"/>',
    check: '<path d="M4.8 12.6 9.4 17 19.2 6.8"/>',
    trendDown: '<path d="M3 7.5l6.5 6.5 3.4-3.4L20.5 18"/><path d="M20.5 18h-5M20.5 18v-5"/>',
    bolt: '<path d="M13.4 3 5 13.6h5.6L9.8 21l8.4-10.6h-5.6z"/>',
    calendarWarn: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v3.4M12 19.2v.3"/>',
    warn: '<path d="M12 3.8 3 20.2h18z"/><path d="M12 10v4.6M12 17.4v.3"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.6M12 7.6v.3"/>',
    install: '<path d="M12 3.5v11"/><path d="M7.6 10.5 12 14.9l4.4-4.4"/><path d="M4.5 18.5h15"/><rect x="4.5" y="18.5" width="15" height="2.2" rx="1.1" fill="currentColor" stroke="none"/>',
    // sauvegarde cloud
    cloud: '<path d="M7.2 18.5h9.6a3.7 3.7 0 0 0 .5-7.4 5.2 5.2 0 0 0-10-1.5 3.9 3.9 0 0 0-.1 7.9z"/>',
    cloudUp: '<path d="M7.2 18.5h9.6a3.7 3.7 0 0 0 .5-7.4 5.2 5.2 0 0 0-10-1.5 3.9 3.9 0 0 0-.1 7.9z"/><path d="M12 14.6V9.4"/><path d="M9.8 11.4 12 9.2l2.2 2.2"/>',
    cloudDown: '<path d="M7.2 18.5h9.6a3.7 3.7 0 0 0 .5-7.4 5.2 5.2 0 0 0-10-1.5 3.9 3.9 0 0 0-.1 7.9z"/><path d="M12 9.6v5.2"/><path d="M9.8 12.6 12 14.8l2.2-2.2"/>',
    cloudOff: '<path d="M7.2 18.5h9.6a3.7 3.7 0 0 0 .5-7.4 5.2 5.2 0 0 0-10-1.5 3.9 3.9 0 0 0-.1 7.9z"/><path d="M4 4l16 16"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V9h-4.5"/>',
    lock: '<rect x="5" y="10.6" width="14" height="9.4" rx="2.4"/><path d="M8.4 10.6V7.8a3.6 3.6 0 0 1 7.2 0v2.8"/>',
    hourglass: '<path d="M7 3.5h10"/><path d="M7 20.5h10"/><path d="M8 3.5v3.2c0 2 4 3.6 4 5.3s-4 3.3-4 5.3v3.2"/><path d="M16 3.5v3.2c0 2-4 3.6-4 5.3s4 3.3 4 5.3v3.2"/>',
    link: '<path d="M10.2 13.8a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M13.8 10.2a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.1-1.1"/>',
    cloche: '<path d="M6.4 9.4a5.6 5.6 0 0 1 11.2 0c0 3.1.8 4.6 1.7 5.6.4.4.1 1.1-.4 1.1H5.1c-.5 0-.8-.7-.4-1.1.9-1 1.7-2.5 1.7-5.6z"/><path d="M10 19.2a2.1 2.1 0 0 0 4 0"/>',
    clocheOff: '<path d="M6.4 9.4a5.6 5.6 0 0 1 7.4-5.3M17.6 12.2c.1 1.2.5 2 1.1 2.8.4.4.1 1.1-.4 1.1H9.6"/><path d="M10 19.2a2.1 2.1 0 0 0 4 0"/><path d="M3.4 3.4l17.2 17.2"/>'
  };
  function icon(name, cls) {
    var body = ICONS[name] || '';
    return '<svg class="ico-svg ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  function hasIcon(name) { return !!ICONS[name]; }

  /** « 1 trade » / « 3 trades » / « 0 trade » */
  function pl(n, one, other) {
    return n + ' ' + (Number(n) > 1 ? (other || (one + 's')) : one);
  }

  function miniStat(label, value, cls) {
    return '<div class="mini-stat"><span>' + esc(label) + '</span><b class="' + (cls || '') + '">' + value + '</b></div>';
  }

  global.UI = {
    miniStat: miniStat, pl: pl, icon: icon, hasIcon: hasIcon, ICONS: ICONS,
    $: $, $$: $$, el: el, esc: esc, attr: attr,
    setCurrency: setCurrency, currency: function () { return state.currency; },
    fmtMoney: fmtMoney, fmtMoneySigned: fmtMoneySigned, fmtNum: fmtNum, fmtR: fmtR, fmtPct: fmtPct,
    signClass: signClass, toneClass: toneClass, dur: dur, truncate: truncate,
    openModal: openModal, confirmDialog: confirmDialog, toast: toast,
    field: field, selectHTML: selectHTML, segHTML: segHTML, chipHTML: chipHTML
  };
})(typeof window !== 'undefined' ? window : globalThis);
