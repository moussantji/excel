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
      '<button class="icon-btn" data-close aria-label="Fermer">✕</button></header>' +
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
      var m = openModal({
        title: opts.title || 'Confirmation',
        size: 'sm',
        content: '<p class="confirm-text">' + opts.message + '</p>',
        footerButtons: [
          { label: opts.cancelLabel || 'Annuler', class: 'ghost', onClick: function (o, close) { close(); resolve(false); } },
          { label: opts.confirmLabel || 'Confirmer', class: opts.danger ? 'danger' : 'primary', onClick: function (o, close) { close(); resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
      return m;
    });
  }

  /* ---------- toasts ---------- */
  function toast(message, type, ms) {
    var host = $('#toasts') || (function () {
      var h = el('div', ''); h.id = 'toasts'; document.body.appendChild(h); return h;
    })();
    var t = el('div', 'toast ' + (type || ''), '<span class="toast-ico">' +
      (type === 'error' ? '⚠️' : type === 'warn' ? '⚡' : type === 'info' ? 'ℹ️' : '✅') + '</span><span>' + esc(message) + '</span>');
    host.appendChild(t);
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
    trash: '<path d="M4 7h16"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 12.2A1.8 1.8 0 0 0 9.3 21h5.4a1.8 1.8 0 0 0 1.8-1.8L17.5 7"/><path d="M10.5 11v6M13.5 11v6"/>'
  };
  function icon(name, cls) {
    var body = ICONS[name] || '';
    return '<svg class="ico-svg ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  function hasIcon(name) { return !!ICONS[name]; }

  function miniStat(label, value, cls) {
    return '<div class="mini-stat"><span>' + esc(label) + '</span><b class="' + (cls || '') + '">' + value + '</b></div>';
  }

  global.UI = {
    miniStat: miniStat, icon: icon, hasIcon: hasIcon, ICONS: ICONS,
    $: $, $$: $$, el: el, esc: esc, attr: attr,
    setCurrency: setCurrency, currency: function () { return state.currency; },
    fmtMoney: fmtMoney, fmtMoneySigned: fmtMoneySigned, fmtNum: fmtNum, fmtR: fmtR, fmtPct: fmtPct,
    signClass: signClass, toneClass: toneClass, dur: dur, truncate: truncate,
    openModal: openModal, confirmDialog: confirmDialog, toast: toast,
    field: field, selectHTML: selectHTML, segHTML: segHTML, chipHTML: chipHTML
  };
})(typeof window !== 'undefined' ? window : globalThis);
