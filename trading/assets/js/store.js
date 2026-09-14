/* =========================================================
   store.js — État, persistance, import / export, données démo
   Journal de trading (forex / indices) — 2026
   ========================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'journal-trading:v1';

  /* ---------------------------------------------------------
     Utilitaires
     --------------------------------------------------------- */
  function uid() {
    return 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function pad2(v) { return String(v).padStart(2, '0'); }

  /** Convertit à peu près tout en nombre (gère « 1 234,56 », « 1,234.56 $ », « -3,5R »). */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    var s = String(v).trim().replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,+\-eE]/g, '');
    if (!s || s === '-' || s === '+' || s === '.') return null;
    var lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
    if (lastC > -1 && lastD > -1) {
      if (lastC > lastD) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastC > -1) {
      var dec = s.length - lastC - 1;
      s = (dec === 3 && /^[+-]?\d{1,3}(,\d{3})+$/.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function round(v, d) {
    var f = Math.pow(10, d || 0);
    return Math.round((v + Number.EPSILON) * f) / f;
  }
  function round2(v) { return round(v, 2); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function isoLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayISO() { return isoLocal(new Date()); }
  function nowTime() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function excelSerialToISO(n) {
    var d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  /** Normalise une date vers AAAA-MM-JJ (accepte 14/09/2026, 2026-09-14, n° série Excel…). */
  function normDate(v) {
    if (v === null || v === undefined || v === '') return todayISO();
    if (v instanceof Date) return isoLocal(v);
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) return excelSerialToISO(v);
      var dd = new Date(v);
      return isNaN(dd.getTime()) ? todayISO() : isoLocal(dd);
    }
    var s = String(v).trim().replace(/[T].*$/, '').trim();
    var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    }
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    var d2 = new Date(s);
    return isNaN(d2.getTime()) ? todayISO() : isoLocal(d2);
  }
  function normTime(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return pad2(v.getHours()) + ':' + pad2(v.getMinutes());
    if (typeof v === 'number') { // fraction de jour Excel
      if (v >= 0 && v < 1) {
        var mins = Math.round(v * 1440);
        return pad2(Math.floor(mins / 60) % 24) + ':' + pad2(mins % 60);
      }
      return '';
    }
    var m = String(v).trim().match(/^(\d{1,2})\s*[:hH.]\s*(\d{0,2})/);
    if (m) return pad2(clamp(parseInt(m[1], 10), 0, 23)) + ':' + pad2(clamp(parseInt(m[2] || '0', 10), 0, 59));
    return '';
  }

  /** Index du jour de la semaine, lundi = 0 … dimanche = 6. */
  function dowIndex(isoDate) {
    var d = new Date(isoDate + 'T12:00:00');
    return (d.getDay() + 6) % 7;
  }
  function addDays(isoDate, n) {
    var d = new Date(isoDate + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }
  function monthKey(isoDate) { return String(isoDate).slice(0, 7); }
  function isoWeekKey(isoDate) {
    var d = new Date(isoDate + 'T12:00:00');
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - day + 3);
    var first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var fd = (first.getUTCDay() + 6) % 7;
    first.setUTCDate(first.getUTCDate() - fd + 3);
    var week = 1 + Math.round((t - first) / (7 * 86400000));
    return t.getUTCFullYear() + '-S' + pad2(week);
  }

  var MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MONTHS_FR_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var DOW_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var DOW_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  /** Date courte numérique (jj/mm/aa) — utilisée dans le journal sur écran étroit. */
  function fmtDateNumeric(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    return p[2] + '/' + p[1] + '/' + String(p[0]).slice(2);
  }

  function fmtDateFR(iso, opts) {
    opts = opts || {};
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    var d = new Date(+p[0], +p[1] - 1, +p[2], 12);
    var s = opts.long
      ? DOW_FR_SHORT[(d.getDay() + 6) % 7] + ' ' + (+p[2]) + ' ' + MONTHS_FR[+p[1] - 1] + ' ' + p[0]
      : (+p[2]) + ' ' + MONTHS_FR_SHORT[+p[1] - 1] + ' ' + String(p[0]).slice(2);
    return s;
  }
  function monthLabel(key, long) {
    var p = String(key).split('-');
    return (long ? MONTHS_FR[+p[1] - 1] : MONTHS_FR_SHORT[+p[1] - 1]) + ' ' + p[0];
  }

  /* ---------------------------------------------------------
     Référentiels
     --------------------------------------------------------- */
  var CURRENCIES = [
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'USD', symbol: '$', label: 'Dollar US' },
    { code: 'XOF', symbol: 'FCFA', label: 'Franc CFA' },
    { code: 'GBP', symbol: '£', label: 'Livre' },
    { code: 'CHF', symbol: 'CHF', label: 'Franc suisse' },
    { code: 'CAD', symbol: 'C$', label: 'Dollar canadien' },
    { code: 'AUD', symbol: 'A$', label: 'Dollar australien' },
    { code: 'JPY', symbol: '¥', label: 'Yen' }
  ];
  var SESSION_LIST = ['Asie', 'Londres', 'Overlap LDN/NY', 'New York'];
  var SETUP_LIST = ['Break & Retest H1', 'Pullback EMA (tendance)', 'Rejet de liquidité', 'Range asiatique', 'Retournement fin de tendance'];
  var EMOTION_LIST = ['Calme', 'Confiant', 'Neutre', 'Impatient', 'FOMO', 'Peur', 'Revanche', 'Fatigué'];
  var MISTAKE_LIST = ['Aucune', 'Entrée anticipée', 'Stop élargi', 'Lot trop gros', 'Trade hors setup', 'Revenge trading', 'Sortie trop tôt', 'Trade pendant news', 'Oubli du stop', 'Trop de trades'];
  var PLAN_STATUS = ['oui', 'partiel', 'non'];
  var SYMBOL_PRESETS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'XAUUSD', 'US30', 'NAS100', 'SPX500', 'GER40', 'BTCUSD'];

  /** Taille du « pip » selon l'instrument (forex 0.0001, JPY 0.01, indices/or 1 / 0.1). */
  function pipSize(symbol) {
    var s = String(symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s) return 0.0001;
    if (s.indexOf('XAU') === 0 || s.indexOf('GOLD') > -1) return 0.1;
    if (s.indexOf('XAG') === 0 || s.indexOf('SILVER') > -1) return 0.01;
    if (/JPY/.test(s)) return 0.01;
    if (/^(US30|DJ30|US100|NAS|NDX|SPX|SP500|GER40|DAX|UK100|FRA40|JP225|HK50|US2000)/.test(s)) return 1;
    if (/^(WTI|BRENT|OIL|NGAS|USOIL)/.test(s)) return 0.01;
    if (/^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|BNB)/.test(s)) return 1;
    return 0.0001;
  }

  /* ---------------------------------------------------------
     Paramètres par défaut
     --------------------------------------------------------- */
  function defaultSettings() {
    return {
      accountName: 'Compte principal',
      broker: 'IC Markets',
      currency: 'EUR',
      startingCapital: 10000,
      riskPerTradePct: 1,
      maxTradesPerDay: 3,
      maxDailyLossPct: 3,
      maxWeeklyLossPct: 6,
      maxDrawdownPct: 10,
      targetMonthlyPct: 5,
      pipValuePerLot: 10,
      sessions: SESSION_LIST.slice(),
      setups: SETUP_LIST.slice(),
      symbols: ['EURUSD', 'GBPUSD', 'XAUUSD', 'US30', 'NAS100'],
      currencySymbol: '€'
    };
  }

  /* ---------------------------------------------------------
     Trades : normalisation + champs calculés
     --------------------------------------------------------- */
  function emptyTrade() {
    return {
      id: uid(), date: todayISO(), time: nowTime(), symbol: '', direction: 'long', demo: false,
      session: '', setup: '', entry: null, stop: null, target: null, exit: null,
      size: null, riskAmount: null, pnl: null, fees: 0, rMode: 'auto', rMultipleIn: null,
      planFollowed: 'oui', emotion: 'Calme', mistake: 'Aucune', durationMin: null,
      notes: '', screenshot: ''
    };
  }

  function normalizeTrade(raw, settings) {
    settings = settings || defaultSettings();
    raw = raw || {};
    var t = {
      id: raw.id || uid(),
      date: normDate(raw.date),
      time: normTime(raw.time),
      symbol: String(raw.symbol || '').trim().toUpperCase(),
      direction: String(raw.direction || 'long').toLowerCase().indexOf('s') === 0 ? 'short' : 'long',
      session: raw.session || '',
      setup: raw.setup || '',
      entry: num(raw.entry),
      stop: num(raw.stop),
      target: num(raw.target),
      exit: num(raw.exit),
      size: num(raw.size),
      riskIn: num(raw.riskAmount !== undefined ? raw.riskAmount : raw.riskIn),
      pnlIn: num(raw.pnl !== undefined ? raw.pnl : raw.pnlIn),
      fees: num(raw.fees) || 0,
      rMode: raw.rMode === 'manual' ? 'manual' : 'auto',
      rMultipleIn: num(raw.rMultipleIn !== undefined ? raw.rMultipleIn : raw.rMultiple),
      planFollowed: PLAN_STATUS.indexOf(raw.planFollowed) > -1 ? raw.planFollowed : '',
      demo: raw.demo === true || raw.demo === 'true' || raw.demo === 1 || raw.demo === 'oui',
      emotion: raw.emotion || '',
      mistake: raw.mistake || '',
      durationMin: num(raw.durationMin),
      notes: raw.notes == null ? '' : String(raw.notes),
      screenshot: raw.screenshot == null ? '' : String(raw.screenshot).trim()
    };

    var ps = pipSize(t.symbol);
    var sign = t.direction === 'short' ? -1 : 1;

    // Pips réalisés (si entrée + sortie connues)
    t.pips = (t.entry !== null && t.exit !== null) ? round(((t.exit - t.entry) * sign) / ps, 1) : null;
    // R:R prévu
    t.plannedRR = (t.entry !== null && t.stop !== null && t.target !== null && t.entry !== t.stop)
      ? round(Math.abs(t.target - t.entry) / Math.abs(t.entry - t.stop), 2) : null;
    // Risque : saisi, sinon calculé depuis la taille et la distance au stop
    t.riskAmount = t.riskIn;
    if (!t.riskAmount && t.entry !== null && t.stop !== null && t.size) {
      t.riskAmount = round2(t.size * Math.abs(t.entry - t.stop) / ps * (settings.pipValuePerLot || 0));
    }
    // P&L brut : saisi, sinon calculé depuis les pips et la taille
    t.pnl = t.pnlIn;
    if (t.pnl === null && t.pips !== null && t.size) {
      t.pnl = round2(t.pips * t.size * (settings.pipValuePerLot || 0));
    }
    t.netPnl = round2((t.pnl || 0) - (t.fees || 0));
    // Multiple de R
    if (t.rMode === 'auto') {
      t.rMultiple = (t.riskAmount > 0 && t.pnl !== null) ? round2(t.netPnl / t.riskAmount) : null;
    } else {
      t.rMultiple = t.rMultipleIn;
    }
    // Rendement en % du capital de départ (utile pour comparer les périodes)
    t.pnlPct = settings.startingCapital > 0 ? round(t.netPnl / settings.startingCapital * 100, 2) : null;
    t.hasResult = t.pnl !== null;
    return t;
  }

  function toRaw(t) {
    return {
      id: t.id, date: t.date, time: t.time, symbol: t.symbol, direction: t.direction, demo: !!t.demo,
      session: t.session, setup: t.setup, entry: t.entry, stop: t.stop, target: t.target,
      exit: t.exit, size: t.size, riskAmount: t.riskIn, pnl: t.pnlIn, fees: t.fees,
      rMode: t.rMode, rMultipleIn: t.rMultipleIn, planFollowed: t.planFollowed,
      emotion: t.emotion, mistake: t.mistake, durationMin: t.durationMin,
      notes: t.notes, screenshot: t.screenshot
    };
  }

  /* ---------------------------------------------------------
     État + persistance
     --------------------------------------------------------- */
  function emptyState() {
    return { version: 1, settings: defaultSettings(), trades: [], demo: false, updatedAt: new Date().toISOString() };
  }

  function storageAvailable() {
    try {
      var s = global.localStorage;
      if (!s) return false;
      s.setItem('__jt_test__', '1');
      s.removeItem('__jt_test__');
      return true;
    } catch (e) { return false; }
  }

  var memoryFallback = null;

  function loadState() {
    var raw = null;
    if (storageAvailable()) {
      try { raw = global.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    } else if (memoryFallback) {
      raw = memoryFallback;
    }
    if (!raw) return emptyState();
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return hydrate(parsed);
    } catch (e) {
      console.warn('État illisible, réinitialisation.', e);
      return emptyState();
    }
  }

  function hydrate(parsed) {
    var st = emptyState();
    if (parsed && typeof parsed === 'object') {
      var s = Object.assign({}, st.settings, parsed.settings || {});
      st.settings = s;
      st.demo = !!parsed.demo;
      st.trades = (parsed.trades || []).map(function (t) { return normalizeTrade(t, s); });
      st.updatedAt = parsed.updatedAt || st.updatedAt;
    }
    return st;
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    var json = JSON.stringify({ version: 1, settings: state.settings, trades: state.trades.map(toRaw), demo: state.demo, updatedAt: state.updatedAt }, null, 0);
    if (storageAvailable()) {
      try { global.localStorage.setItem(STORAGE_KEY, json); return 'local'; } catch (e) { /* quota */ }
    }
    memoryFallback = json;
    return 'memory';
  }

  /* ---------------------------------------------------------
     CSV
     --------------------------------------------------------- */
  var CSV_COLUMNS = [
    { key: 'id', label: 'ID' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Heure' },
    { key: 'symbol', label: 'Instrument' },
    { key: 'direction', label: 'Sens' },
    { key: 'session', label: 'Session' },
    { key: 'setup', label: 'Setup' },
    { key: 'entry', label: 'Entrée' },
    { key: 'stop', label: 'Stop' },
    { key: 'target', label: 'Objectif' },
    { key: 'exit', label: 'Sortie' },
    { key: 'size', label: 'Taille (lots)' },
    { key: 'riskAmount', label: 'Risque' },
    { key: 'pnl', label: 'P&L brut' },
    { key: 'fees', label: 'Frais' },
    { key: 'netPnl', label: 'P&L net' },
    { key: 'rMultiple', label: 'R' },
    { key: 'planFollowed', label: 'Respect du plan' },
    { key: 'emotion', label: 'Émotion' },
    { key: 'mistake', label: 'Erreur' },
    { key: 'durationMin', label: 'Durée (min)' },
    { key: 'notes', label: 'Notes' },
    { key: 'screenshot', label: 'Capture' }
  ];

  function stripAccents(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function normHeader(h) {
    var t = stripAccents(String(h || '').toLowerCase());
    t = t.replace(/p\s*&\s*l/g, 'pnl');   // « P&L » → « pnl »
    t = t.replace(/^r\s*[:=]/, 'r ');      // « R: » → « r »
    return t.replace(/[^a-z0-9]/g, '');
  }
  var HEADER_ALIASES = {
    id: 'id', date: 'date', jour: 'date', heure: 'time', time: 'time', instrument: 'symbol',
    symbole: 'symbol', paire: 'symbol', symbol: 'symbol', actif: 'symbol', sens: 'direction',
    direction: 'direction', side: 'direction', session: 'session', setup: 'setup', strategie: 'setup',
    strategy: 'setup', entree: 'entry', entry: 'entry', prixentree: 'entry', stop: 'stop', sl: 'stop',
    stoploss: 'stop', objectif: 'target', tp: 'target', takeprofit: 'target', cible: 'target',
    target: 'target', sortie: 'exit', exit: 'exit', prixsortie: 'exit', taille: 'size',
    taillelots: 'size', lots: 'size', lot: 'size', size: 'size', volume: 'size',
    position: 'size', risque: 'riskAmount', risk: 'riskAmount', risquemontant: 'riskAmount',
    risqueen: 'riskAmount', moneyrisk: 'riskAmount', pnl: 'pnl', pnlbrut: 'pnl', resultat: 'pnl',
    netprofit: 'pnl', profit: 'pnl', frais: 'fees', commission: 'fees', commissions: 'fees',
    frais: 'fees', couts: 'fees', fees: 'fees', pnlne: 'netPnl', pnlne: 'netPnl', pnlne: 'netPnl',
    pnlne: 'netPnl', netpnl: 'netPnl', pnlbrutnet: 'netPnl', plbrut: 'pnl', plnet: 'netPnl',
    pl: 'pnl', resultatbrut: 'pnl', resultatnet: 'netPnl', r: 'rMultiple', rmultiple: 'rMultiple',
    rmulti: 'rMultiple', multiple: 'rMultiple', rr: 'rMultiple', resultatr: 'rMultiple',
    respectduplan: 'planFollowed', plan: 'planFollowed', discipline: 'planFollowed',
    respecteduplan: 'planFollowed', emotion: 'emotion', etat: 'emotion', erreur: 'mistake',
    erreurs: 'mistake', faute: 'mistake', dureemin: 'durationMin', duree: 'durationMin',
    dureeminutes: 'durationMin', notes: 'notes', note: 'notes', commentaire: 'notes',
    remarques: 'notes', capture: 'screenshot', screenshot: 'screenshot', image: 'screenshot',
    photo: 'screenshot', lien: 'screenshot'
  };

  function headerToKey(h) {
    var n = normHeader(h);
    if (!n) return null;
    if (HEADER_ALIASES[n]) return HEADER_ALIASES[n];
    if (/^(pnl)?net/.test(n)) return 'netPnl';
    if (/^r/.test(n) && n.length <= 3) return 'rMultiple';
    return null;
  }

  function csvEscape(v, delim) {
    var s = v === null || v === undefined ? '' : String(v);
    if (s.indexOf('"') > -1) s = s.replace(/"/g, '""');
    if (s.indexOf(delim) > -1 || s.indexOf('"') > -1 || /[\n\r]/.test(s)) s = '"' + s + '"';
    return s;
  }
  /** En français : séparateur « ; » et virgule décimale (ouvrable directement dans Excel FR). */
  function fmtNumberFR(v, decimals) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '';
    var s = Number(v).toFixed(decimals === undefined ? 2 : decimals);
    return s.replace('.', ',');
  }

  function tradesToCSV(trades) {
    var delim = ';';
    var lines = [CSV_COLUMNS.map(function (c) { return csvEscape(c.label, delim); }).join(delim)];
    trades.forEach(function (t) {
      lines.push(CSV_COLUMNS.map(function (c) {
        var v = t[c.key];
        if (v === null || v === undefined) v = '';
        switch (c.key) {
          case 'direction': return v === 'short' ? 'Short' : 'Long';
          case 'entry': case 'stop': case 'target': case 'exit':
            return fmtNumberFR(v === '' ? null : v, 5);
          case 'size': case 'riskAmount': case 'pnl': case 'netPnl':
            return fmtNumberFR(v === '' ? null : v, 2);
          case 'fees': return fmtNumberFR(v, 2);
          case 'rMultiple': return fmtNumberFR(v === null ? null : v, 2);
          case 'durationMin': return v === null || v === '' ? '' : String(v);
          default: return csvEscape(v, delim);
        }
      }).join(delim));
    });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  function detectDelimiter(firstLine) {
    var cands = [';', '\t', ',', '|'];
    var best = ',', bestCount = -1;
    cands.forEach(function (d) {
      var n = firstLine.split(d).length;
      if (n > bestCount) { bestCount = n; best = d; }
    });
    return best;
  }

  /** Parseur CSV (gère guillemets, retours ligne, délimiteur auto). */
  function parseCSV(text) {
    text = String(text).replace(/^\ufeff/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var delim = detectDelimiter(firstLine);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* ignore */ }
      else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function csvToTrades(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { trades: [], skipped: 0, unknown: [] };
    var headers = rows[0];
    var keys = headers.map(headerToKey);
    var unknown = headers.filter(function (h, i) { return !keys[i] && String(h).trim(); });
    var trades = [], skipped = 0;
    for (var r = 1; r < rows.length; r++) {
      var obj = {}, hasData = false;
      for (var c = 0; c < keys.length; c++) {
        if (!keys[c]) continue;
        var val = rows[r][c];
        if (val === undefined) continue;
        obj[keys[c]] = val;
        if (String(val).trim() !== '') hasData = true;
      }
      if (!hasData) continue;
      // Sens : « Long », « Achat », « Buy », « S »…
      if (obj.direction) {
        var d = normHeader(obj.direction);
        obj.direction = (d.charAt(0) === 's' || d === 'vente' || d === 'sell' || d === 'short') ? 'short' : 'long';
      }
      if (obj.planFollowed) {
        var pf = normHeader(obj.planFollowed);
        obj.planFollowed = /^(o|oui|yes|y|1|true|vrai)/.test(pf) ? 'oui'
          : /^(n|non|no|0|false|faux)/.test(pf) ? 'non'
            : /^(p|partiel|partiellement|partial)/.test(pf) ? 'partiel' : '';
      }
      // Un « P&L net » fourni sans P&L brut : on l'utilise comme résultat et frais = 0
      if (obj.netPnl !== undefined && (obj.pnl === undefined || String(obj.pnl).trim() === '')) {
        obj.pnl = obj.netPnl; obj.fees = 0;
      }
      // Un « R » fourni sans P&L : on le conserve en mode manuel
      if ((obj.pnl === undefined || String(obj.pnl).trim() === '') && obj.rMultiple !== undefined && String(obj.rMultiple).trim() !== '') {
        obj.rMode = 'manual'; obj.rMultipleIn = obj.rMultiple;
      }
      obj.demo = false;
      var t = normalizeTrade(obj, { pipValuePerLot: 10, startingCapital: 10000 });
      if (!t.symbol && !t.hasResult && !t.entry) { skipped++; continue; }
      trades.push(t);
    }
    return { trades: trades, skipped: skipped, unknown: unknown.filter(function (h, i, a) { return a.indexOf(h) === i; }) };
  }

  /* ---------------------------------------------------------
     Données de démonstration (générées, déterministes)
     --------------------------------------------------------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function demoState(nTrades, seed, settings) {
    nTrades = nTrades || 72;
    settings = Object.assign(defaultSettings(), settings || {});
    var rnd = mulberry32(seed === undefined ? 20260914 : seed);
    var today = todayISO();
    var span = Math.round(nTrades * 1.3);
    var risk = settings.startingCapital * settings.riskPerTradePct / 100;
    var pairs = [
      { s: 'EURUSD', ps: 0.0001, price: 1.0850, vol: 0.0035 },
      { s: 'GBPUSD', ps: 0.0001, price: 1.2650, vol: 0.0045 },
      { s: 'USDJPY', ps: 0.01, price: 147.20, vol: 0.45 },
      { s: 'XAUUSD', ps: 0.1, price: 2330, vol: 18 },
      { s: 'US30', ps: 1, price: 39200, vol: 220 },
      { s: 'NAS100', ps: 1, price: 18300, vol: 160 }
    ];
    var setups = SETUP_LIST.slice(0, 4);
    var emotions = ['Calme', 'Calme', 'Calme', 'Neutre', 'Confiant', 'Impatient', 'FOMO', 'Peur', 'Fatigué'];
    var mistakes = ['Aucune', 'Aucune', 'Aucune', 'Aucune', 'Aucune', 'Entrée anticipée', 'Stop élargi', 'Sortie trop tôt', 'Revenge trading', 'Lot trop gros'];

    // 1. On tire les dates (jours ouvrés) pour que le dernier trade soit très récent
    var dates = [];
    for (var d0 = 0; d0 < nTrades; d0++) {
      var off = Math.round(rnd() * span);
      var day = addDays(today, -off);
      var dw = dowIndex(day);
      if (dw === 5) day = addDays(day, -1);
      if (dw === 6) day = addDays(day, -2);
      dates.push(day);
    }
    dates.sort();
    // Pas plus de 3 trades par jour (comme dans le plan)
    var countByDay = {};
    for (var d1 = 0; d1 < dates.length; d1++) {
      var day1 = dates[d1];
      countByDay[day1] = (countByDay[day1] || 0) + 1;
      if (countByDay[day1] > 3) {
        var nd = day1;
        do { nd = addDays(nd, 1); } while (dowIndex(nd) === 5 || dowIndex(nd) === 6 || (countByDay[nd] || 0) >= 3);
        dates[d1] = nd;
        countByDay[day1]--;
        countByDay[nd] = (countByDay[nd] || 0) + 1;
      }
    }
    dates.sort();

    var trades = [];
    dates.forEach(function (day) {
      var pair = pairs[Math.floor(rnd() * pairs.length)];
      var setup = setups[Math.floor(rnd() * setups.length)];
      var session = sessionFor(rnd);
      var hour = sessionHour(session) + Math.floor(rnd() * 3);
      var direction = rnd() < 0.52 ? 'long' : 'short';
      var followed = rnd() < 0.6 ? 'oui' : (rnd() < 0.55 ? 'partiel' : 'non');
      var winProb = followed === 'oui' ? 0.56 : followed === 'partiel' ? 0.44 : 0.30;
      var win = rnd() < winProb;
      var rMult;
      if (win) {
        rMult = round2((0.9 + rnd() * 2.6) * (followed === 'oui' ? 1 : 0.82));
      } else {
        rMult = round2(-(0.55 + rnd() * 0.75));
      }
      // Sortie trop tôt : on coupe les gains
      if (followed !== 'oui' && win && rnd() < 0.35) rMult = round2(rMult * 0.4);

      var pnl = round2(rMult * risk);
      var fees = round2(2 + rnd() * 6);
      var stopDist = pair.vol * (0.7 + rnd() * 0.8);
      var dec = pair.ps === 1 ? 1 : 5;
      var stop = round(direction === 'long' ? pair.price - stopDist : pair.price + stopDist, dec);
      var target = round(direction === 'long' ? pair.price + stopDist * 2 : pair.price - stopDist * 2, dec);
      var exit = round(direction === 'long' ? pair.price + (pnl / risk) * stopDist : pair.price - (pnl / risk) * stopDist, dec);
      var size = round(risk / (Math.abs(pair.price - stop) / pair.ps * settings.pipValuePerLot), 2);

      trades.push(normalizeTrade({
        demo: true,
        date: day, time: pad2(clamp(hour, 0, 23)) + ':' + pad2(Math.floor(rnd() * 12) * 5),
        symbol: pair.s, direction: direction, session: session, setup: setup,
        entry: pair.price, stop: stop, target: target, exit: exit,
        size: size, riskAmount: round2(risk), pnl: pnl, fees: fees,
        planFollowed: followed,
        emotion: followed === 'oui' ? (rnd() < 0.7 ? 'Calme' : 'Confiant') : emotions[Math.floor(rnd() * emotions.length)],
        mistake: followed === 'oui' ? (rnd() < 0.85 ? 'Aucune' : 'Sortie trop tôt') : mistakes[Math.floor(rnd() * mistakes.length)],
        durationMin: Math.round(25 + rnd() * 210),
        notes: followed === 'oui'
          ? 'Setup validé, exécution conforme au plan.'
          : 'Exécution approximative — à revoir en revue de semaine.',
        screenshot: ''
      }, settings));
      // Le prix « marche » un peu d'un trade à l'autre
      pair.price = round(pair.price * (1 + (rnd() - 0.5) * 0.01), dec);
    });

    return { version: 1, settings: settings, trades: trades, demo: true, updatedAt: new Date().toISOString() };
  }

  function sessionFor(rnd) {
    var r = rnd();
    if (r < 0.38) return 'Londres';
    if (r < 0.62) return 'Overlap LDN/NY';
    if (r < 0.9) return 'New York';
    return 'Asie';
  }
  function sessionHour(session) {
    switch (session) {
      case 'Asie': return 2;
      case 'Londres': return 8;
      case 'Overlap LDN/NY': return 14;
      default: return 15;
    }
  }

  /* ---------------------------------------------------------
     Export
     --------------------------------------------------------- */
  var Store = {
    STORAGE_KEY: STORAGE_KEY,
    CURRENCIES: CURRENCIES,
    SESSION_LIST: SESSION_LIST,
    SETUP_LIST: SETUP_LIST,
    EMOTION_LIST: EMOTION_LIST,
    MISTAKE_LIST: MISTAKE_LIST,
    PLAN_STATUS: PLAN_STATUS,
    SYMBOL_PRESETS: SYMBOL_PRESETS,
    MONTHS_FR: MONTHS_FR, MONTHS_FR_SHORT: MONTHS_FR_SHORT,
    DOW_FR: DOW_FR, DOW_FR_SHORT: DOW_FR_SHORT,
    CSV_COLUMNS: CSV_COLUMNS,

    uid: uid, num: num, round: round, round2: round2, clamp: clamp,
    todayISO: todayISO, nowTime: nowTime, normDate: normDate, normTime: normTime,
    addDays: addDays, dowIndex: dowIndex, monthKey: monthKey, isoWeekKey: isoWeekKey,
    fmtDateFR: fmtDateFR, fmtDateNumeric: fmtDateNumeric, monthLabel: monthLabel, pad2: pad2,
    pipSize: pipSize, defaultSettings: defaultSettings, emptyTrade: emptyTrade,
    normalizeTrade: normalizeTrade, toRaw: toRaw,
    emptyState: emptyState, loadState: loadState, saveState: saveState, hydrate: hydrate,
    storageAvailable: storageAvailable,
    tradesToCSV: tradesToCSV, csvToTrades: csvToTrades, parseCSV: parseCSV,
    demoState: demoState, mulberry32: mulberry32
  };

  global.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);
