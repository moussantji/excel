/* =========================================================
   app.js — Application : navigation, dashboard, journal,
   formulaire de trade, import / export, paramètres.
   ========================================================= */
(function (global) {
  'use strict';

  var Store = global.Store, Metrics = global.Metrics, Charts = global.Charts, Plan = global.Plan, UI = global.UI;
  var $ = UI.$, $$ = UI.$$, el = UI.el, esc = UI.esc, attr = UI.attr;

  var PRESETS = [
    { id: 'today', label: "Aujourd'hui" },
    { id: '7d', label: '7 jours' },
    { id: '30d', label: '30 jours' },
    { id: 'month', label: 'Ce mois' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Cette année' },
    { id: 'all', label: 'Tout' },
    { id: 'custom', label: 'Personnalisé' }
  ];

  var VIEW_KEY = 'journal-trading:vue-journal';
  function savedJournalView() {
    try { return localStorage.getItem(VIEW_KEY) || 'auto'; } catch (e) { return 'auto'; }
  }
  // auto : cartes sur téléphone, tableau (colonnes allégées) dès la tablette
  function isNarrow() { return (global.innerWidth || 1200) < 700; }

  var state = {
    view: 'dashboard',
    journalView: savedJournalView(),
    trades: [],
    settings: Store.defaultSettings(),
    demo: false,
    storage: 'local',
    filters: { preset: '30d', from: null, to: null, symbols: [], setups: [], sessions: [], directions: [], planStatus: [], search: '' },
    sort: { key: 'date', dir: 'desc' },
    curveMode: 'equity',
    groupMode: 'setup',
    year: new Date().getFullYear(),
    selectedDay: null,
    checks: {}
  };

  /* =========================================================
     Chargement / sauvegarde
     ========================================================= */
  function load() {
    var saved = Store.loadState();
    state.trades = saved.trades;
    state.settings = saved.settings;
    state.demo = saved.demo;
    state.checks = Plan.loadChecks();
    UI.setCurrency(state.settings.currency);
    if (!state.trades.length) applyPreset('30d');
    else applyPreset('30d', true);
  }
  function persist(silent) {
    state.storage = Store.saveState({ version: 1, settings: state.settings, trades: state.trades, demo: state.demo });
    if (!silent && state.storage === 'memory') {
      UI.toast('Sauvegarde locale indisponible : exportez votre journal en JSON pour ne rien perdre.', 'warn', 6000);
    }
  }
  function buildModel() {
    return Metrics.build(state.trades, state.settings, state.filters, Store.todayISO());
  }

  /* ---- données de démonstration : repérées, donc supprimables seules ---- */
  function demoTrades() { return state.trades.filter(function (t) { return t.demo; }); }
  function realTrades() { return state.trades.filter(function (t) { return !t.demo; }); }
  function demoCount() { return demoTrades().length; }
  function hasDemo() { return demoCount() > 0; }

  function removeDemoTrades(silent) {
    var n = demoCount();
    if (!n) return 0;
    state.trades = realTrades();
    if (!state.trades.length) state.demo = false;
    // la démo peut avoir posé un filtre de période « tout » : on revient sur 30 jours
    if (!state.trades.length) applyPreset('30d', true);
    persist();
    render();
    if (!silent) UI.toast(UI.pl(n, 'trade de démonstration supprimé', 'trades de démonstration supprimés') + '. Votre journal est prêt.');
    return n;
  }

  /* =========================================================
     Périodes
     ========================================================= */
  function applyPreset(id, silent) {
    var today = Store.todayISO();
    var f = state.filters;
    f.preset = id;
    function monthStart(d) { return d.slice(0, 7) + '-01'; }
    switch (id) {
      case 'today': f.from = today; f.to = today; break;
      case '7d': f.from = Store.addDays(today, -6); f.to = today; break;
      case '30d': f.from = Store.addDays(today, -29); f.to = today; break;
      case 'month': f.from = monthStart(today); f.to = today; break;
      case 'quarter':
        var q = Math.floor((+today.slice(5, 7) - 1) / 3) * 3 + 1;
        f.from = today.slice(0, 4) + '-' + String(q).padStart(2, '0') + '-01'; f.to = today; break;
      case 'year': f.from = today.slice(0, 4) + '-01-01'; f.to = today; break;
      case 'all': f.from = null; f.to = null; break;
      case 'custom': break;
    }
    if (!silent) render();
  }

  function periodLabel() {
    var f = state.filters;
    if (!f.from && !f.to) return 'Historique complet';
    if (f.from === f.to) return Store.fmtDateFR(f.from, { long: true });
    return Store.fmtDateFR(f.from) + ' → ' + Store.fmtDateFR(f.to || Store.todayISO());
  }

  /* =========================================================
     ROUTEUR
     ========================================================= */
  var NAV = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { id: 'journal', label: 'Journal', icon: 'journal' },
    { id: 'calendrier', label: 'Calendrier', icon: 'calendrier' },
    { id: 'analyses', label: 'Analyses', icon: 'analyses' },
    { id: 'plan', label: 'Plan de trading', icon: 'plan' },
    { id: 'params', label: 'Paramètres', icon: 'params' }
  ];

  function renderNav() {
    var nav = $('#nav');
    nav.innerHTML = NAV.map(function (n) {
      return '<button class="nav-item' + (state.view === n.id ? ' active' : '') + '" data-view="' + n.id + '">' +
        '<span class="nav-ico">' + UI.icon(n.icon) + '</span><span>' + n.label + '</span></button>';
    }).join('');
    $$('.nav-item', nav).forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; render(); $$('.sidebar').forEach(function (s) { s.classList.remove('open'); }); });
    });
    // barre mobile
    var m = $('#mobileNav');
    m.innerHTML = NAV.map(function (n) {
      return '<button class="nav-item' + (state.view === n.id ? ' active' : '') + '" data-view="' + n.id + '">' +
        '<span class="nav-ico">' + UI.icon(n.icon) + '</span><span>' + n.label.split(' ')[0] + '</span></button>';
    }).join('');
    $$('.nav-item', m).forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; render(); });
    });
    $('#viewTitle').textContent = (NAV.filter(function (n) { return n.id === state.view; })[0] || {}).label || '';
  }

  var lastRenderedView = null;

  function render() {
    UI.setCurrency(state.settings.currency);
    var model = buildModel();
    renderNav();
    renderTopbar(model);
    var host = $('#view');
    host.innerHTML = '';
    switch (state.view) {
      case 'dashboard': renderDashboard(host, model); break;
      case 'journal': renderJournal(host, model); break;
      default:
        if (global.Views && global.Views[state.view]) global.Views[state.view](host, model, publicAPI);
        else host.innerHTML = '<div class="card"><p>Vue inconnue.</p></div>';
    }
    if (lastRenderedView !== state.view) {
      lastRenderedView = state.view;
      try { window.scrollTo(0, 0); } catch (e) { /* environnement sans scroll */ }
    }
  }

  /* =========================================================
     BARRE SUPÉRIEURE
     ========================================================= */
  function renderTopbar(model) {
    var k = model.kpis;
    $('#topEquity').innerHTML =
      '<span class="lbl">Capital</span><b class="' + UI.signClass(k.equityTotal - state.settings.startingCapital) + '">' + UI.fmtMoney(k.equityTotal) + '</b>' +
      '<span class="sub ' + UI.signClass(k.totalReturnPct) + '">' + UI.fmtPct(k.totalReturnPct) + '</span>';
    var g = model.goals;
    $('#topToday').innerHTML =
      "<span class=\"lbl\">Aujourd'hui</span><b class=\"" + UI.signClass(g.todayNet) + "\">" +
      (g.todayCount ? UI.fmtMoneySigned(g.todayNet) : '—') + '</b>' +
      '<span class="sub">' + UI.pl(g.todayCount, 'trade') + '</span>';
    var blocked = g.todayLimits.blocked;
    var badge = $('#topStatus');
    var demo = hasDemo();
    badge.className = 'status-badge ' + (blocked ? 'ko' : demo ? 'demo' : 'ok');
    badge.innerHTML = blocked
      ? '<span class="dot"></span>Limite atteinte : stop'
      : demo
        ? '<span class="dot"></span>Mode démonstration — ' + UI.pl(demoCount(), 'trade fictif', 'trades fictifs')
        : !state.trades.length
          ? '<span class="dot"></span>Journal vide — rien n\'est encore enregistré'
          : (state.filters.preset ? '<span class="dot"></span>' + periodLabel() : '<span class="dot"></span>Prêt à trader');
  }

  /* =========================================================
     CARTES RÉUTILISABLES
     ========================================================= */
  function card(title, bodyHTML, opts) {
    opts = opts || {};
    return '<section class="card ' + (opts.class || '') + '">' +
      (title ? '<header class="card-head"><h3>' + title + '</h3>' + (opts.tools || '') + '</header>' : '') +
      '<div class="card-body">' + bodyHTML + '</div></section>';
  }
  function kpiCard(k) {
    return '<div class="kpi ' + (k.tone || '') + (k.spark ? ' has-spark' : '') + '">' +
      '<div class="kpi-label">' + esc(k.label) + '</div>' +
      '<div class="kpi-value ' + (k.valueClass || '') + '">' + k.value + '</div>' +
      (k.sub ? '<div class="kpi-sub">' + k.sub + '</div>' : '') +
      (k.spark ? '<div class="kpi-spark" data-spark="' + k.spark + '"></div>' : '') +
      '</div>';
  }
  function progress(pct, tone) {
    return '<div class="progress ' + (tone || '') + '"><div class="progress-fill" style="width:' +
      UI.fmtNum(Math.max(0, Math.min(100, pct)), 1) + '%"></div></div>';
  }
  function table(headers, rows, opts) {
    opts = opts || {};
    return '<div class="table-wrap"><table class="table ' + (opts.class || '') + '">' +
      '<thead><tr>' + headers.map(function (h) {
        return '<th' + (h.cls ? ' class="' + h.cls + '"' : '') + (h.title ? ' title="' + attr(h.title) + '"' : '') + '>' + h.label + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function planBadge(v) {
    var map = {
      oui: ['Plan respecté', 'Respecté', 'ok'],
      partiel: ['Partiel', 'Partiel', 'warn'],
      non: ['Hors plan', 'Hors plan', 'ko'],
      '': ['—', '—', 'flat']
    };
    var it = map[v] || map[''];
    return '<span class="badge ' + it[2] + '"><span class="lbl-long">' + it[0] + '</span>' +
      '<span class="lbl-short">' + it[1] + '</span></span>';
  }

  /* =========================================================
     VUE : TABLEAU DE BORD
     ========================================================= */
  /** Écran d'accueil : aucun trade enregistré (première utilisation, tablette…). */
  function renderWelcome(host) {
    var demo = hasDemo();
    host.innerHTML =
      '<section class="welcome">' +
      '<div class="welcome-hero">' +
      '<span class="welcome-logo">' + UI.icon('logo') + '</span>' +
      '<h2>Bienvenue sur votre journal de trading</h2>' +
      '<p>Plan écrit, journal des trades et performances en R et en devise — sur ordinateur comme sur tablette. ' +
      (demo ? 'Les données de démonstration sont encore chargées : supprimez-les pour démarrer sur une base propre.' : 'Commencez par enregistrer votre premier trade ou importez votre historique.') +
      '</p>' +
      '</div>' +
      '<div class="welcome-steps">' +
      '<button class="welcome-card" data-empty="add">' +
      '<span class="wc-ico">' + UI.icon('plus') + '</span><b>Ajouter un trade</b>' +
      '<span>Du jour ou passé : instrument, entrée, stop, sortie, émotion, erreur. Les pips, le risque et le multiple de R sont calculés automatiquement.</span>' +
      '<span class="wc-go">Ouvrir le formulaire →</span>' +
      '</button>' +
      '<button class="welcome-card" data-empty="import">' +
      '<span class="wc-ico">' + UI.icon('importFile') + '</span><b>Importer un historique</b>' +
      '<span>CSV ou Excel : les colonnes en français et en anglais sont reconnues, les virgules décimales aussi. Modèles fournis dans <code>exemples/</code>.</span>' +
      '<span class="wc-go">Importer un fichier →</span>' +
      '</button>' +
      '<button class="welcome-card" data-empty="demo">' +
      '<span class="wc-ico">' + UI.icon('flask') + '</span><b>Voir avec des données de démo</b>' +
      '<span>80 trades fictifs cohérents pour découvrir le tableau de bord, les graphiques et le calendrier. Supprimables en un clic à tout moment.</span>' +
      '<span class="wc-go">Charger la démo →</span>' +
      '</button>' +
      (demo ? '<button class="welcome-card danger" data-empty="cleardemo">' +
        '<span class="wc-ico">' + UI.icon('broom') + '</span><b>Supprimer la démonstration</b>' +
        '<span>' + UI.pl(demoCount(), 'trade fictif est encore enregistré', 'trades fictifs sont encore enregistrés') + (realTrades().length ? ' à côté de vos ' + UI.pl(realTrades().length, 'trade') : '') + '. Les trades de démo sont repérés et supprimés seuls.</span>' +
        '<span class="wc-go">Nettoyer la démo →</span></button>' : '') +
      '</div>' +
      '<div class="welcome-foot">' +
      '<p><b>Vos données restent sur cet appareil</b> (aucun envoi sur un serveur). Pensez à <i>Exporter → Sauvegarde JSON</i> chaque semaine.</p>' +
      '<p>Le plan de trading complet (règles de risque, 3 setups, routine, checklists) est dans l\'onglet <b>Plan de trading</b>.</p>' +
      '</div>' +
      '</section>';
  }

  function renderDashboard(host, model) {
    var k = model.kpis, s = state.settings, g = model.goals;

    // Première utilisation : écran d'accueil tant qu'aucun trade n'existe
    if (!state.trades.length) { renderWelcome(host); return; }

    var html = '';

    // ---- bandeau d'alertes / garde-fous ----
    var alerts = [];
    if (hasDemo()) {
      alerts.push({
        tone: 'demo', ic: 'flask',
        html: 'Mode démonstration : <b>' + UI.pl(demoCount(), 'trade fictif', 'trades fictifs') + '</b>' +
          (realTrades().length ? ' mélangés à vos ' + UI.pl(realTrades().length, 'trade réel', 'trades réels') : '') +
          '. Les statistiques ci-dessous les incluent. <button class="alert-btn" data-action="purge-demo">Supprimer la démo</button>'
      });
    }
    if (g.todayLimits.blocked) {
      alerts.push({ tone: 'ko', ic: 'stop', text: "Limite du jour atteinte (" + (g.todayLimits.tradesReached ? 'nombre de trades' : 'perte journalière') + "). Le plan impose l'arrêt : <b>aucun trade de plus aujourd'hui</b>." });
    } else {
      alerts.push({ tone: 'ok', ic: 'check', text: g.todayCount === 0
        ? "Aucun trade aujourd'hui. Reste " + UI.pl(g.todayLimits.tradesLeft, 'trade') + " autorisé" + (g.todayLimits.tradesLeft > 1 ? 's' : '') + " et " + UI.fmtMoney(g.todayLimits.lossLeft) + " de perte disponible ce jour."
        : "Journée en cours : " + UI.pl(g.todayCount, 'trade') + ", " + UI.fmtMoneySigned(g.todayNet) + ". Encore " + UI.pl(g.todayLimits.tradesLeft, 'trade') + " possible." });
    }
    if (Math.abs(k.maxDDPct) >= s.maxDrawdownPct) {
      alerts.push({ tone: 'warn', ic: 'trendDown', text: 'Drawdown de ' + UI.fmtNum(Math.abs(k.maxDDPct), 2) + ' % sur la période (seuil ' + s.maxDrawdownPct + ' %) : taille à réduire de moitié selon le plan.' });
    }
    if (k.planRespectPct !== null && k.planRespectPct < 90) {
      alerts.push({ tone: 'warn', ic: 'bolt', text: 'Respect du plan à ' + UI.fmtNum(k.planRespectPct, 0) + ' % sur la période. Chaque écart doit avoir sa note dans le journal.' });
    }
    if (g.week.lossReached) alerts.push({ tone: 'ko', ic: 'calendarWarn', text: 'Perte hebdomadaire maximale atteinte (' + UI.fmtMoney(g.week.net) + '). Arrêt jusqu\'à lundi.' });
    html += '<div class="alerts">' + alerts.map(function (a) {
      return '<div class="alert ' + a.tone + '"><span class="alert-ico">' + UI.icon(a.ic) + '</span><span>' + (a.html || a.text) + '</span></div>';
    }).join('') + '</div>';

    // ---- bandeau période ----
    html += '<div class="period-bar">' +
      '<div class="period-presets">' + PRESETS.map(function (p) {
        return '<button class="pill' + (state.filters.preset === p.id ? ' active' : '') + '" data-preset="' + p.id + '">' + p.label + '</button>';
      }).join('') + '</div>' +
      '<div class="period-range" id="rangeBox">' + rangeInputsHTML() + '</div>' +
      '<div class="period-info">' + filterChipsHTML(model) + '</div>' +
      '</div>';

    // ---- KPI ----
    var kpis = [
      { label: 'Résultat de la période', value: UI.fmtMoneySigned(k.net), sub: UI.pl(k.closed, 'trade clôturé', 'trades clôturés') + ' · ' + UI.fmtPct(k.periodReturnPct), valueClass: UI.signClass(k.net), tone: UI.signClass(k.net) },
      { label: 'Capital du compte', value: UI.fmtMoney(k.equityTotal), sub: 'Départ ' + UI.fmtMoney(s.startingCapital) + ' · ' + UI.fmtPct(k.totalReturnPct), valueClass: UI.signClass(k.totalReturnPct), spark: 'equity' },
      { label: 'Résultat en R', value: UI.fmtR(k.sumR, 1), sub: 'Espérance ' + (k.expectancyR === null ? '—' : UI.fmtR(k.expectancyR)) + ' / trade', valueClass: UI.signClass(k.sumR), tone: UI.signClass(k.sumR) },
      { label: 'Taux de réussite', value: UI.fmtNum(k.winRate, 1) + ' %', sub: k.wins + ' gagnants / ' + k.losses + ' perdants', valueClass: k.winRate >= 45 ? 'pos' : 'warn-txt' },
      { label: 'Profit factor', value: k.profitFactor === Infinity ? '∞' : UI.fmtNum(k.profitFactor), sub: 'Gains ' + UI.fmtMoney(k.grossProfit) + ' / pertes ' + UI.fmtMoney(-k.grossLoss), valueClass: k.profitFactor >= 1.3 ? 'pos' : k.profitFactor >= 1 ? 'warn-txt' : 'neg' },
      { label: 'Ratio gain / perte', value: k.payoff === null ? '—' : UI.fmtNum(k.payoff), sub: 'Gain moyen ' + UI.fmtMoney(k.avgWin) + ' · perte ' + UI.fmtMoney(k.avgLoss), valueClass: (k.payoff || 0) >= 1.5 ? 'pos' : 'warn-txt' },
      { label: 'Drawdown max', value: UI.fmtNum(Math.abs(k.maxDDPct), 2) + ' %', sub: UI.fmtMoney(k.maxDD) + ' depuis le plus haut', valueClass: Math.abs(k.maxDDPct) <= s.maxDrawdownPct ? 'pos' : 'neg', tone: 'neg-soft' },
      { label: 'Espérance par trade', value: k.expectancyMoney === 0 ? '—' : UI.fmtMoneySigned(k.expectancyMoney), sub: 'Sur ' + UI.pl(k.closed, 'trade clôturé', 'trades clôturés'), valueClass: UI.signClass(k.expectancyMoney) },
      { label: 'Respect du plan', value: k.planRespectPct === null ? '—' : UI.fmtNum(k.planRespectPct, 0) + ' %', sub: model.discipline && model.discipline.costPerTrade !== null ? 'Chaque écart au plan coûte ' + UI.fmtMoney(Math.abs(model.discipline.costPerTrade)) + ' par trade' : 'À renseigner dans le journal', valueClass: (k.planRespectPct || 0) >= 90 ? 'pos' : 'warn-txt' },
      { label: 'Meilleur trade', value: UI.fmtMoneySigned(k.bestTrade), sub: k.bestR === null ? '' : UI.fmtR(k.bestR) + ' · ' + model.records.bestTrade.symbol, valueClass: 'pos' },
      { label: 'Pire trade', value: UI.fmtMoneySigned(k.worstTrade), sub: k.worstR === null ? '' : UI.fmtR(k.worstR) + ' · ' + model.records.worstTrade.symbol, valueClass: 'neg' },
      { label: 'Durée moyenne', value: k.avgDuration === null ? '—' : UI.dur(k.avgDuration), sub: 'Temps passé en position', valueClass: '' }
    ];
    html += '<div class="kpi-grid">' + kpis.map(kpiCard).join('') + '</div>';

    // ---- courbe d'équité ----
    html += card('Courbe de performance',
      '<div class="chart-toolbar">' +
      '<div class="seg" data-name="curveMode">' +
      [['equity', 'Équité'], ['r', 'Cumul R'], ['dd', 'Drawdown'], ['daily', 'P&L par jour']].map(function (m) {
        return '<button class="seg-btn' + (state.curveMode === m[0] ? ' active' : '') + '" data-val="' + m[0] + '">' + m[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="chart-legend"><span class="lg-dot" style="background:#f2c14e"></span><span id="curveLegend">' + curveLegendText(model) + '</span></div>' +
      '</div><div class="chart-host" id="equityChart"></div>',
      { class: 'card-chart' });

    // ---- objectifs + répartition ----
    html += '<div class="grid-2">';
    html += card('Objectifs du mois', objectivesHTML(model));
    html += card('Répartition des résultats', '<div class="split"><div class="chart-host" id="donutWL"></div><div class="chart-host" id="stackR"></div></div>');
    html += '</div>';

    // ---- mensuel ----
    html += card('Performance mensuelle',
      '<div class="chart-host" id="monthChart"></div>' + monthlyTableHTML(model),
      { class: 'card-chart' });

    // ---- par catégorie ----
    var groupModes = [['setup', 'Setup'], ['symbol', 'Instrument'], ['session', 'Session'], ['dow', 'Jour'], ['hour', 'Heure'], ['direction', 'Sens']];
    html += card('Performance par catégorie',
      '<div class="chart-toolbar"><div class="seg" data-name="groupMode">' +
      groupModes.map(function (m) {
        return '<button class="seg-btn' + (state.groupMode === m[0] ? ' active' : '') + '" data-val="' + m[0] + '">' + m[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="group-mount" id="groupMount"></div>' +
      '<div class="group-mount2" id="groupTable"></div>');

    // ---- discipline ----
    html += card('Discipline : le plan face à l\'exécution', disciplineHTML(model), { class: 'card-wide' });

    host.innerHTML = html;

    // --- wiring période ---
    $$('[data-preset]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.preset === 'custom') {
          state.filters.preset = 'custom';
          var fi = $('#fFrom'); if (fi) fi.focus();
        } else applyPreset(b.dataset.preset);
      });
    });
    $$('.seg', host).forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-btn'); if (!btn) return;
        if (seg.dataset.name === 'curveMode') { state.curveMode = btn.dataset.val; render(); }
        if (seg.dataset.name === 'groupMode') { state.groupMode = btn.dataset.val; mountGroups(model); $$('.seg-btn', seg).forEach(function (x) { x.classList.toggle('active', x === btn); }); }
      });
    });
    var rb = $('#rangeBox');
    if (rb) {
      var fromIn = $('#fFrom', rb), toIn = $('#fTo', rb);
      function upd() {
        state.filters.preset = 'custom';
        state.filters.from = fromIn.value || null;
        state.filters.to = toIn.value || null;
        render();
      }
      fromIn.addEventListener('change', upd);
      toIn.addEventListener('change', upd);
    }
    $$('[data-action="purge-demo"]', host).forEach(function (b) {
      b.addEventListener('click', function () { confirmRemoveDemo(); });
    });
    $$('[data-chip-remove]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.dataset.chipRemove;
        if (f === 'period') { state.filters.from = null; state.filters.to = null; state.filters.preset = 'all'; }
        else if (f === 'search') state.filters.search = '';
        else state.filters[f] = [];
        render();
      });
    });

    // --- graphiques ---
    mountEquity(model);
    mountDistribution(model);
    mountMonthly(model);
    mountGroups(model);
    mountDiscipline(model);
    mountSparks(model);
  }

  function rangeInputsHTML() {
    var f = state.filters;
    return '<label class="range-label">Du <input type="date" id="fFrom" class="input input-sm" value="' + attr(f.from || '') + '"></label>' +
      '<label class="range-label">au <input type="date" id="fTo" class="input input-sm" value="' + attr(f.to || '') + '"></label>';
  }

  function filterChipsHTML(model) {
    var f = state.filters, chips = [];
    chips.push('<span class="chip period">Période : ' + esc(periodLabel()) + '<button class="chip-x" data-chip-remove="period" aria-label="Retirer le filtre de période"><svg class="ico-svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>');
    if (f.search) chips.push('<span class="chip">Recherche : « ' + esc(f.search) + ' »<button class="chip-x" data-chip-remove="search" aria-label="Effacer la recherche"><svg class="ico-svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>');
    ['symbols', 'setups', 'sessions', 'directions', 'planStatus'].forEach(function (key) {
      if (f[key] && f[key].length) {
        chips.push('<span class="chip">' + esc(f[key].join(', ')) + '<button class="chip-x" data-chip-remove="' + key + '" aria-label="Retirer ce filtre"><svg class="ico-svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span>');
      }
    });
    chips.push('<span class="chip ghost">' + UI.pl(model.trades.length, 'trade affiché', 'trades affichés') + ' sur ' + state.trades.length + '</span>');
    return chips.join('');
  }

  function curveLegendText(model) {
    var k = model.kpis;
    if (state.curveMode === 'equity') return 'Capital ' + UI.fmtMoney(k.startEquity) + ' → ' + UI.fmtMoney(k.endEquity) + ' (' + UI.fmtPct(k.periodReturnPct) + ')';
    if (state.curveMode === 'r') return 'Cumul ' + UI.fmtR(k.sumR, 1) + ' sur ' + k.rCount + ' trades';
    if (state.curveMode === 'dd') return 'Drawdown max ' + UI.fmtNum(Math.abs(k.maxDDPct), 2) + ' % (' + UI.fmtMoney(k.maxDD) + ')';
    return UI.pl(model.daily.length, 'journée de trading');
  }

  /* ---------- graphique principal ---------- */
  function mountEquity(model) {
    var hostEl = $('#equityChart');
    if (!hostEl) return;
    var pts = [];
    if (state.curveMode === 'daily') {
      Charts.bars(hostEl, {
        items: model.daily.map(function (d) { return { label: Store.fmtDateFR(d.date), value: d.net, meta: d }; }),
        height: 340,
        tipFn: function (it) {
          return '<div class="tip-t">' + esc(Store.fmtDateFR(it.meta.date, { long: true })) + '</div>' +
            '<div class="tip-v ' + UI.signClass(it.value) + '">' + UI.fmtMoneySigned(it.value) + '</div>' +
            '<div class="tip-s">' + UI.pl(it.meta.count, 'trade') + ' · ' + UI.fmtR(it.meta.r, 1) + ' cumulés</div>';
        }
      });
      return;
    }
    var run = 0;
    var curve = model.curve;
    curve.forEach(function (p, i) {
      var x = p.date || (curve[1] && curve[1].date) || Store.todayISO();
      var y;
      if (state.curveMode === 'equity') { run = p.equity; y = p.equity; }
      if (state.curveMode === 'r') { if (i && p.r !== null && p.r !== undefined) run += p.r; y = i ? run : 0; }
      if (state.curveMode === 'dd') { y = i ? p.dd : 0; }
      pts.push({ x: x, y: y, meta: { p: p, y: y } });
    });
    var colors = { equity: Charts.colors.gold, r: Charts.colors.blue, dd: Charts.colors.red };
    Charts.line(hostEl, {
      points: pts,
      timeX: true,
      height: 340,
      color: colors[state.curveMode],
      baseline: state.curveMode === 'equity' ? model.kpis.startEquity : 0,
      baselineLabel: state.curveMode === 'equity' ? 'Capital de départ' : 'Zéro',
      areaBase: state.curveMode === 'dd' ? 0 : undefined,
      yFmt: function (v) { return state.curveMode === 'dd' ? UI.fmtNum(v, 0) : Charts.fmtCompact(v) + (state.curveMode === 'r' ? 'R' : ' ' + state.settings.currencySymbol); },
      xFmt: function (v) { return Store.fmtDateFR(v); },
      tipFn: function (p) {
        var t = p.meta.p.trade;
        if (!t) return '<div class="tip-t">Départ</div><div class="tip-v">' + UI.fmtMoney(p.y) + '</div>';
        return '<div class="tip-t">' + esc(Store.fmtDateFR(t.date, { long: true })) + (t.time ? ' · ' + t.time : '') + '</div>' +
          '<div class="tip-v ' + UI.signClass(t.netPnl) + '">' + UI.fmtMoneySigned(t.netPnl) + (t.rMultiple !== null ? ' · ' + UI.fmtR(t.rMultiple) : '') + '</div>' +
          '<div class="tip-s">' + esc(t.symbol) + ' ' + (t.direction === 'short' ? 'vente' : 'achat') + ' · ' + esc(t.setup || 'setup ?') + '</div>' +
          '<div class="tip-s">Équité : ' + UI.fmtMoney(p.meta.p.equity) + ' · DD ' + UI.fmtNum(p.meta.p.ddPct, 2) + ' %</div>';
      }
    });
  }

  /* ---------- répartition des résultats ---------- */
  function mountDistribution(model) {
    var k = model.kpis;
    var donutHost = $('#donutWL');
    if (donutHost) {
      Charts.donut(donutHost, {
        size: 190, stroke: 22,
        centerValue: UI.fmtNum(k.winRate, 0) + ' %',
        centerLabel: 'de réussite',
        segments: [
          { label: 'Gagnants', value: k.wins, color: Charts.colors.green },
          { label: 'Perdants', value: k.losses, color: Charts.colors.red },
          { label: 'Neutres', value: k.flat, color: Charts.colors.text }
        ]
      });
    }
    var stackHost = $('#stackR');
    if (stackHost) {
      function colorForR(mid) {
        if (mid >= 3) return '#0e9b74';
        if (mid >= 2) return '#14b487';
        if (mid >= 1) return '#25d09a';
        if (mid >= 0.5) return '#5cd7a8';
        if (mid > 0) return '#9fe6c8';
        if (mid === 0) return '#8b93a7';
        if (mid >= -0.5) return '#f0a1ab';
        if (mid >= -1) return '#e05a6b';
        if (mid >= -1.5) return '#c8435b';
        return '#a52a3f';
      }
      var segs = model.rDistribution.filter(function (b) { return b.count > 0; }).map(function (b) {
        return { label: b.label, value: b.count, color: colorForR(b.mid) };
      });
      var wrap = el('div', 'r-stack');
      wrap.innerHTML = '<h4>Distribution des multiples de R</h4><div class="chart-host" id="stackRMount"></div>';
      stackHost.appendChild(wrap);
      Charts.stack($('#stackRMount'), { segments: segs, fmtPct: false });
    }
  }

  /* ---------- performance mensuelle ---------- */
  function mountMonthly(model) {
    var hostEl = $('#monthChart');
    if (!hostEl) return;
    Charts.bars(hostEl, {
      items: model.months.map(function (m) { return { label: m.label, value: m.net, meta: m }; }),
      height: 280, maxLabels: 12, barWidth: 60,
      tipFn: function (it) {
        var m = it.meta;
        return '<div class="tip-t">' + esc(m.label) + '</div>' +
          '<div class="tip-v ' + UI.signClass(m.net) + '">' + UI.fmtMoneySigned(m.net) + '</div>' +
          '<div class="tip-s">' + UI.pl(m.closed, 'trade') + ' · ' + UI.fmtR(m.sumR, 1) + ' · ' + UI.fmtNum(m.winRate, 0) + ' % de réussite</div>' +
          '<div class="tip-s">Espérance ' + UI.fmtR(m.expectancyR) + ' · PF ' + (m.profitFactor === Infinity ? '∞' : UI.fmtNum(m.profitFactor)) + '</div>';
      }
    });
  }

  function monthlyTableHTML(model) {
    if (!model.months.length) return '';
    var rows = model.months.slice().reverse().map(function (m) {
      var pct = state.settings.startingCapital ? m.net / state.settings.startingCapital * 100 : 0;
      return '<tr>' +
        '<td><b>' + esc(m.label) + '</b></td>' +
        '<td class="num">' + m.closed + '</td>' +
        '<td class="num ' + UI.signClass(m.net) + '">' + UI.fmtMoneySigned(m.net) + '</td>' +
        '<td class="num ' + UI.signClass(pct) + '">' + UI.fmtPct(pct) + '</td>' +
        '<td class="num ' + UI.signClass(m.sumR) + '">' + UI.fmtR(m.sumR, 1) + '</td>' +
        '<td class="num">' + UI.fmtNum(m.winRate, 0) + ' %</td>' +
        '<td class="num">' + (m.profitFactor === Infinity ? '∞' : UI.fmtNum(m.profitFactor)) + '</td>' +
        '<td class="num">' + UI.fmtR(m.expectancyR) + '</td>' +
        '</tr>';
    }).join('');
    return table([
      { label: 'Mois' }, { label: 'Trades', cls: 'num' }, { label: 'Résultat', cls: 'num' },
      { label: 'En % du capital', cls: 'num' }, { label: 'Total R', cls: 'num' },
      { label: 'Réussite', cls: 'num' }, { label: 'PF', cls: 'num' }, { label: 'Espérance', cls: 'num' }
    ], rows);
  }

  /* ---------- groupes ---------- */
  function groupData(model, mode) {
    switch (mode) {
      case 'symbol': return model.bySymbol;
      case 'session': return model.bySession;
      case 'dow': return model.byDow;
      case 'hour': return model.byHour;
      case 'direction': return model.byDirection;
      default: return model.bySetup;
    }
  }
  function mountGroups(model) {
    var hostEl = $('#groupMount'), hostTable = $('#groupTable');
    if (!hostEl) return;
    var data = groupData(model, state.groupMode);
    Charts.hbars(hostEl, {
      items: data.map(function (g) {
        return { label: g.key, value: g.net, display: UI.fmtMoneySigned(g.net), sub: g.label || g.key };
      }),
      emptyMessage: 'Aucun trade sur cette sélection.'
    });
    var rows = data.map(function (g) {
      return '<tr>' +
        '<td><b>' + esc(g.key) + '</b></td>' +
        '<td class="num">' + g.closed + '</td>' +
        '<td class="num ' + UI.signClass(g.net) + '">' + UI.fmtMoneySigned(g.net) + '</td>' +
        '<td class="num ' + UI.signClass(g.sumR) + '">' + UI.fmtR(g.sumR, 1) + '</td>' +
        '<td class="num">' + UI.fmtNum(g.winRate, 0) + ' %</td>' +
        '<td class="num">' + UI.fmtR(g.expectancyR) + '</td>' +
        '<td class="num">' + (g.profitFactor === Infinity ? '∞' : UI.fmtNum(g.profitFactor)) + '</td>' +
        '<td class="num ' + UI.signClass(g.avgR) + '">' + UI.fmtR(g.avgR) + '</td>' +
        '</tr>';
    }).join('');
    if (hostTable) hostTable.innerHTML = table([
      { label: 'Catégorie' }, { label: 'Trades', cls: 'num' }, { label: 'Résultat', cls: 'num' },
      { label: 'Total R', cls: 'num' }, { label: 'Réussite', cls: 'num' }, { label: 'Espérance', cls: 'num' },
      { label: 'PF', cls: 'num' }, { label: 'R moyen', cls: 'num' }
    ], rows);
  }

  /* ---------- objectifs ---------- */
  /**
   * Jauge d'objectif : value à droite, barre colorée selon le niveau réel.
   * `tone` : ok (marge confortable) · warn (à surveiller) · danger (proche ou au-delà du seuil)
   */
  function gauge(label, valueHTML, ratioPct, tone, subHTML) {
    return '<div class="obj">' +
      '<div class="obj-head"><span>' + label + '</span><b>' + valueHTML + '</b></div>' +
      progress(ratioPct, tone) +
      (subHTML ? '<div class="obj-sub">' + subHTML + '</div>' : '') +
      '</div>';
  }

  function objectivesHTML(model) {
    var g = model.goals, s = state.settings, k = model.kpis;
    var html = '<div class="obj-list">';

    // 1. Objectif du mois
    var monthTone = g.month.pct >= g.month.targetPct ? 'ok' : g.month.pct >= 0 ? 'warn' : 'danger';
    html += gauge(
      'Objectif du mois (' + esc(Store.monthLabel(g.month.key, true)) + ')',
      UI.fmtPct(g.month.pct) + ' / +' + g.month.targetPct + ' %',
      g.month.progressPct, monthTone,
      UI.fmtMoneySigned(g.month.net) + ' · ' + UI.pl(g.month.trades, 'trade') + ' · ' +
      (g.month.net >= g.month.targetMoney
        ? 'objectif atteint (+' + UI.fmtMoney(g.month.targetMoney) + ')'
        : 'reste ' + UI.fmtMoney(Math.max(0, g.month.targetMoney - g.month.net)) + ' pour l\'atteindre')
    );

    // 2. Perte du jour réellement consommée
    var dayGauge = g.todayLimits.gauge;
    html += gauge(
      'Perte du jour utilisée',
      UI.fmtNum(g.todayLimits.lossUsed, 2) + ' € / ' + UI.fmtMoney(g.todayLimits.lossLimit) +
      ' <span class="muted">(' + UI.fmtNum(dayGauge.ratio, 0) + ' % du seuil)</span>',
      dayGauge.ratio, dayGauge.tone,
      g.todayLimits.lossReached
        ? 'Seuil journalier atteint : arrêt imposé par le plan pour aujourd\'hui.'
        : (g.todayLimits.lossUsed <= 0
          ? 'Aucune perte aujourd\'hui — marge complète de ' + UI.fmtMoney(g.todayLimits.lossLimit) + '.'
          : 'Il reste ' + UI.fmtMoney(g.todayLimits.lossLeft) + ' avant l\'arrêt de la journée (' + s.maxDailyLossPct + ' %).')
    );

    // 3. Semaine en cours
    var weekGauge = g.week.gauge;
    html += gauge(
      'Semaine en cours',
      '<span class="' + UI.signClass(g.week.net) + '">' + UI.fmtMoneySigned(g.week.net) + '</span>',
      weekGauge.ratio, weekGauge.tone,
      g.week.lossReached
        ? 'Seuil d\'arrêt hebdomadaire atteint (' + UI.fmtMoney(g.week.lossLimit) + ') : arrêt jusqu\'à lundi.'
        : (g.week.lossUsed <= 0
          ? 'Aucune perte cette semaine — seuil d\'arrêt à ' + UI.fmtMoney(g.week.lossLimit) + ' (' + s.maxWeeklyLossPct + ' %).'
          : 'Perte consommée : ' + UI.fmtMoney(g.week.lossUsed) + ' · reste ' + UI.fmtMoney(g.week.lossLeft) + '.')
    );

    // 4. Drawdown vs seuil du plan
    var ddRatio = s.maxDrawdownPct ? Math.min(100, Math.abs(k.maxDDPct) / s.maxDrawdownPct * 100) : 0;
    var ddTone = Math.abs(k.maxDDPct) >= s.maxDrawdownPct ? 'danger' : ddRatio >= 85 ? 'danger' : ddRatio >= 50 ? 'warn' : 'ok';
    html += gauge(
      'Drawdown vs seuil du plan',
      UI.fmtNum(Math.abs(k.maxDDPct), 2) + ' % / ' + s.maxDrawdownPct + ' %',
      ddRatio, ddTone,
      UI.fmtMoney(k.maxDD) + ' depuis le plus haut · ' + UI.pl(k.open, 'trade en cours', 'trades en cours') +
      ' · risque ' + s.riskPerTradePct + ' % / trade (' + s.maxTradesPerDay + ' max par jour)'
    );

    html += '</div>';
    return html;
  }

  /* ---------- discipline ---------- */
  function disciplineHTML(model) {
    var rows = Plan.control(model);
    if (!rows.length) return '<p class="muted">Ajoutez des trades clôturés pour comparer votre exécution aux règles du plan.</p>';
    var score = Plan.disciplineScore(rows);
    var body = rows.map(function (r) {
      return '<tr><td>' + esc(r.label) + '<div class="cell-sub">' + esc(r.hint) + '</div></td>' +
        '<td class="num">' + esc(r.target) + '</td>' +
        '<td class="num"><b>' + esc(r.actual) + '</b></td>' +
        '<td class="num">' + (r.status === 'ok' ? '<span class="badge ok">Conforme</span>' : r.status === 'warn' ? '<span class="badge warn">À surveiller</span>' : '<span class="badge ko">Écart</span>') + '</td></tr>';
    }).join('');
    return '<div class="discipline-head">' +
      '<div class="score-ring ' + (score >= 85 ? 'ok' : score >= 65 ? 'warn' : 'ko') + '"><b>' + score + '</b><span>score discipline</span></div>' +
      '<div class="discipline-summary">' + disciplineNarrative(model, score) + '</div>' +
      '</div>' +
      table([
        { label: 'Règle du plan' }, { label: 'Cible', cls: 'num' }, { label: 'Réalisé', cls: 'num' }, { label: '', cls: 'num' }
      ], body);
  }

  function disciplineNarrative(model, score) {
    var k = model.kpis, d = model.discipline, s = state.settings;
    var out = [];
    out.push('<p>Score de discipline de <b>' + score + '/100</b> sur la période affichée (' + UI.pl(k.closed, 'trade clôturé', 'trades clôturés') + ').</p>');
    if (d.ok && d.ko) {
      out.push('<p>Espérance quand le plan est respecté : <b class="pos">' + UI.fmtR(d.ok.expectancyR) + '</b> (' + UI.fmtMoneySigned(d.ok.expectancyMoney) + ' / trade). ' +
        'Quand il ne l\'est pas : <b class="neg">' + UI.fmtR(d.ko.expectancyR) + '</b> (' + UI.fmtMoneySigned(d.ko.expectancyMoney) + ' / trade).</p>');
      if (d.missedMoney && d.missedMoney > 0) {
        out.push('<p>Si les ' + d.ko.closed + ' trades hors plan avaient été de simples copies des trades conformes, la période aurait été meilleure d\'environ <b class="pos">' + UI.fmtMoney(d.missedMoney) + '</b>.</p>');
      }
    } else {
      out.push('<p>Renseignez le champ « respect du plan » dans le journal : c\'est la donnée qui distingue une mauvaise stratégie d\'une mauvaise exécution.</p>');
    }
    if (Math.abs(k.maxDDPct) > 0) out.push('<p>Drawdown max observé : <b>' + UI.fmtNum(Math.abs(k.maxDDPct), 2) + ' %</b> (' + UI.fmtMoney(k.maxDD) + '), seuil du plan ' + s.maxDrawdownPct + ' %.</p>');
    return out.join('');
  }
  function mountDiscipline() { /* rendu statique, rien à monter */ }

  /* ---------- sparklines ---------- */
  function mountSparks(model) {
    $$('[data-spark]').forEach(function (n) {
      var eq = [state.settings.startingCapital].concat(model.curve.map(function (p) { return p.equity; }));
      Charts.sparkline(n, { values: eq, color: Charts.colors.gold });
    });
  }

  /* =========================================================
     VUE : JOURNAL
     ========================================================= */
  var JOURNAL_COLUMNS = [
    { key: 'date', label: 'Date', sub: 'time' },
    { key: 'symbol', label: 'Instrument', sub: 'direction' },
    { key: 'session', label: 'Session', sub: 'setup' },
    { key: 'riskAmount', label: 'Risque', cls: 'num', hide: 'col-opt', fmt: function (t) { return t.riskAmount ? UI.fmtMoney(t.riskAmount) : '—'; } },
    { key: 'pips', label: 'Pips', cls: 'num', fmt: function (t) { return t.pips === null ? '—' : UI.fmtNum(t.pips, 1); } },
    { key: 'pnl', label: 'P&L brut', cls: 'num', hide: 'col-opt', fmt: function (t) { return t.pnl === null ? '—' : UI.fmtMoney(t.pnl); } },
    { key: 'fees', label: 'Frais', cls: 'num', hide: 'col-opt', fmt: function (t) { return t.fees ? UI.fmtMoney(t.fees) : '—'; } },
    { key: 'netPnl', label: 'P&L net', cls: 'num' },
    { key: 'rMultiple', label: 'R', cls: 'num' },
    { key: 'planFollowed', label: 'Plan', cls: 'num' },
    { key: 'emotion', label: 'Émotion', sub: 'mistake', hide: 'col-opt' },
    { key: 'durationMin', label: 'Durée', cls: 'num', hide: 'col-opt' },
    { key: 'actions', label: '' }
  ];

  function renderJournal(host, model) {
    var k = model.kpis;
    var html = '';

    html += '<div class="journal-toolbar">' +
      '<div class="search-wrap"><input type="search" id="jSearch" class="input" placeholder="Rechercher un instrument, setup, note…" value="' + attr(state.filters.search || '') + '"></div>' +
      '<button class="btn ghost" id="btnFilters">Filtres' + (filterCount() ? ' (' + filterCount() + ')' : '') + '</button>' +
      '<div class="seg view-toggle" data-name="journalView">' +
      [['table', 'Tableau'], ['cards', 'Cartes'], ['auto', 'Auto']].map(function (m) {
        return '<button class="seg-btn' + (state.journalView === m[0] ? ' active' : '') + '" data-val="' + m[0] + '">' + m[1] + '</button>';
      }).join('') + '</div>' +
      '<button class="btn ghost" id="btnImport">Importer CSV</button>' +
      '<button class="btn ghost" id="btnExport">Exporter</button>' +
      '<button class="btn primary" id="btnAdd">+ Nouveau trade</button>' +
      '</div>';

    html += '<div class="filters-panel" id="filtersPanel">' + filtersPanelHTML() + '</div>';

    html += '<div class="period-bar compact">' +
      '<div class="period-presets">' + PRESETS.map(function (p) {
        return '<button class="pill' + (state.filters.preset === p.id ? ' active' : '') + '" data-preset="' + p.id + '">' + p.label + '</button>';
      }).join('') + '</div>' +
      '<div class="period-range" id="rangeBox">' + rangeInputsHTML() + '</div></div>';

    html += '<div class="mini-stats">' +
      miniStat('Trades clôturés', String(k.closed), '') +
      miniStat('Résultat', UI.fmtMoneySigned(k.net), UI.signClass(k.net)) +
      miniStat('Total R', UI.fmtR(k.sumR, 1), UI.signClass(k.sumR)) +
      miniStat('Réussite', UI.fmtNum(k.winRate, 0) + ' %', k.winRate >= 45 ? 'pos' : '') +
      miniStat('Profit factor', k.profitFactor === Infinity ? '∞' : UI.fmtNum(k.profitFactor), k.profitFactor >= 1.3 ? 'pos' : k.profitFactor >= 1 ? '' : 'neg') +
      miniStat('Espérance', UI.fmtR(k.expectancyR), UI.signClass(k.expectancyR)) +
      miniStat('Frais payés', UI.fmtMoney(model.results.reduce(function (a, t) { return a + (t.fees || 0); }, 0)), '') +
      '</div>';

    var trades = sortedTrades(model.trades);
    var asCards = state.journalView === 'cards' || (state.journalView === 'auto' && isNarrow());
    html += asCards
      ? card('', trades.length ? tradesCardsHTML(trades) : emptyJournalHTML(), { class: 'card-cards' })
      : card('', trades.length ? tradesTableHTML(trades) : emptyJournalHTML(), { class: 'card-table' });
    html += '<p class="muted small">' + (asCards
      ? 'Touchez une carte pour modifier le trade. Basculez en « Tableau » pour trier par colonne.'
      : 'Cliquez sur une ligne pour modifier le trade, sur l\'entête d\'une colonne pour trier. Les trades sans résultat (P&L vide) sont considérés comme « en cours ».') + '</p>';

    host.innerHTML = html;

    // wiring
    var searchIn = $('#jSearch');
    var tmr;
    searchIn.addEventListener('input', function () {
      clearTimeout(tmr);
      tmr = setTimeout(function () { state.filters.search = searchIn.value.trim(); render(); }, 280);
    });
    searchIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(tmr); state.filters.search = searchIn.value.trim(); render(); } });

    $$('.view-toggle .seg-btn', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.journalView = b.dataset.val;
        try { localStorage.setItem(VIEW_KEY, state.journalView); } catch (e) { /* ignore */ }
        render();
      });
    });
    $('#btnFilters').addEventListener('click', function () { $('#filtersPanel').classList.toggle('open'); });
    $('#btnAdd').addEventListener('click', function () { openTradeForm(null, model); });
    $('#btnImport').addEventListener('click', function () { openImportDialog(model); });
    $('#btnExport').addEventListener('click', function () { openExportDialog(model); });
    $$('[data-preset]', host).forEach(function (b) {
      b.addEventListener('click', function () { applyPreset(b.dataset.preset); });
    });
    var rb = $('#rangeBox');
    if (rb) {
      var fromIn = $('#fFrom', rb), toIn = $('#fTo', rb);
      function upd() {
        state.filters.preset = 'custom';
        state.filters.from = fromIn.value || null;
        state.filters.to = toIn.value || null;
        render();
      }
      fromIn.addEventListener('change', upd);
      toIn.addEventListener('change', upd);
    }
    $$('.filters-panel [data-multi]').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var key = box.dataset.multi, val = b.dataset.val;
        var arr = state.filters[key] = state.filters[key] || [];
        var i = arr.indexOf(val);
        if (i > -1) arr.splice(i, 1); else arr.push(val);
        render();
      });
    });
    var reset = $('#filtersReset');
    if (reset) reset.addEventListener('click', function () {
      state.filters.symbols = []; state.filters.setups = []; state.filters.sessions = [];
      state.filters.directions = []; state.filters.planStatus = []; state.filters.search = '';
      render();
    });
    $$('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.sort = { key: key, dir: key === 'date' ? 'desc' : 'desc' };
        render();
      });
    });
    $$('tr[data-id], .trade-card[data-id]').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('[data-action]')) return;
        var t = state.trades.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (t) openTradeForm(t, model);
      });
    });
    $$('[data-action]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var t = state.trades.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!t) return;
        if (b.dataset.action === 'delete') {
          UI.confirmDialog({
            title: 'Supprimer ce trade ?',
            message: esc(t.symbol + ' ' + Store.fmtDateFR(t.date) + ' — ' + UI.fmtMoneySigned(t.netPnl)),
            confirmLabel: 'Supprimer', danger: true
          }).then(function (ok) {
            if (!ok) return;
            state.trades = state.trades.filter(function (x) { return x.id !== t.id; });
            persist(); render();
            UI.toast('Trade supprimé.');
          });
        } else if (b.dataset.action === 'duplicate') {
          var copy = Store.normalizeTrade(Object.assign(Store.toRaw(t), { id: Store.uid(), date: Store.todayISO(), time: Store.nowTime() }), state.settings);
          state.trades.push(copy);
          persist(); render();
          UI.toast('Copie du trade ajoutée à aujourd\'hui.');
        }
      });
    });
  }

  function filterCount() { return Metrics.activeFilterCount(state.filters); }

  function miniStat(label, value, cls) { return UI.miniStat(label, value, cls); }

  function filtersPanelHTML() {
    var f = state.filters;
    function multi(key, options, label, unknown) {
      var opts = options.slice();
      if (unknown) opts = Array.prototype.concat.call(options.slice(), [], [unknown]);
      return '<div class="filter-group"><h4>' + esc(label) + '</h4><div class="filter-chips" data-multi="' + key + '">' +
        opts.map(function (o) {
          var val = typeof o === 'string' ? o : o.value, lab = typeof o === 'string' ? o : o.label;
          var active = (f[key] || []).indexOf(val) > -1;
          return '<button class="pill' + (active ? ' active' : '') + '" data-val="' + attr(val) + '">' + esc(lab) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="filter-grid">' +
      multi('symbols', state.settings.symbols, 'Instrument') +
      multi('setups', state.settings.setups, 'Setup') +
      multi('sessions', state.settings.sessions, 'Session') +
      multi('directions', [{ value: 'long', label: 'Achats' }, { value: 'short', label: 'Ventes' }], 'Sens') +
      multi('planStatus', [{ value: 'oui', label: 'Plan respecté' }, { value: 'partiel', label: 'Partiel' }, { value: 'non', label: 'Hors plan' }, { value: '', label: 'Non renseigné' }], 'Respect du plan') +
      '<div class="filter-actions"><button class="btn ghost" id="filtersReset">Réinitialiser les filtres</button></div>' +
      '</div>';
  }

  function sortedTrades(trades) {
    var key = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
    var arr = trades.slice();
    arr.sort(function (a, b) {
      var va = a[key], vb = b[key];
      if (va === null || va === undefined) va = -Infinity;
      if (vb === null || vb === undefined) vb = -Infinity;
      if (typeof va === 'string' || typeof vb === 'string') {
        var r = String(va).localeCompare(String(vb));
        return r * dir || String(b.date).localeCompare(String(a.date));
      }
      return (va - vb) * dir;
    });
    return arr;
  }

  function tradesTableHTML(trades) {
    var head = JOURNAL_COLUMNS.map(function (c) {
      var sorted = state.sort.key === c.key;
      return '<th class="' + (c.cls || '') + (sorted ? ' sorted' : '') + '" data-sort="' + c.key + '">' + esc(c.label) +
        (sorted ? '<span class="sort-ico">' + (state.sort.dir === 'asc' ? '↑' : '↓') + '</span>' : '') + '</th>';
    }).join(' ');
    var rows = trades.map(function (t) {
      var cells = JOURNAL_COLUMNS.map(function (c) {
        // classes de la cellule : alignement + masquage éventuel sur écran étroit
        var cls = ((c.cls || '') + ' ' + (c.hide || '')).trim();
        var td = function (extra, inner) {
          return '<td class="' + (cls + ' ' + (extra || '')).trim() + '">' + inner + '</td>';
        };
        if (c.fmt) return td('', c.fmt(t));
        switch (c.key) {
          case 'date':
            // deux écritures : complète sur grand écran, numérique sur tablette (voir CSS)
            return td('', '<b class="date-long">' + esc(Store.fmtDateFR(t.date)) + '</b>' +
              '<b class="date-short">' + esc(Store.fmtDateNumeric ? Store.fmtDateNumeric(t.date) : Store.fmtDateFR(t.date)) + '</b>' +
              '<div class="cell-sub">' + esc(t.time || '') + '</div>');
          case 'symbol':
            return td('', '<b>' + esc(t.symbol || '—') + '</b><div class="cell-sub">' + (t.direction === 'short' ? 'Vente' : 'Achat') + (t.plannedRR ? ' · RR ' + UI.fmtNum(t.plannedRR, 1) : '') + '</div>');
          case 'session':
            return td('', '<span class="nowrap">' + esc(t.session || '—') + '</span>' +
              (t.setup ? '<div class="cell-sub ellipsis-sub" title="' + attr(t.setup) + '">' + esc(t.setup) + '</div>' : ''));
          case 'netPnl':
            return td('num ' + UI.signClass(t.netPnl), '<b>' + (t.hasResult ? UI.fmtMoneySigned(t.netPnl) : '<span class="badge flat">en cours</span>') + '</b>');
          case 'rMultiple':
            return td('num ' + UI.signClass(t.rMultiple), '<b>' + UI.fmtR(t.rMultiple) + '</b>');
          case 'planFollowed':
            return td('num', planBadge(t.planFollowed));
          case 'emotion':
            return td('', esc(t.emotion || '—') + (t.mistake && t.mistake !== 'Aucune'
              ? '<div class="cell-sub warn-txt">' + UI.icon('warn') + esc(t.mistake) + '</div>' : ''));
          case 'durationMin':
            return td('num', UI.dur(t.durationMin));
          case 'actions':
            return td('num nowrap',
              '<button class="icon-btn" data-action="duplicate" data-id="' + t.id + '" title="Dupliquer le trade">' + UI.icon('copy') + '</button>' +
              '<button class="icon-btn danger" data-action="delete" data-id="' + t.id + '" title="Supprimer le trade">' + UI.icon('trash') + '</button>');
          default:
            var v = t[c.key];
            return td('', v === null || v === undefined || v === '' ? '—' : esc(v));
        }
      }).join('');
      return '<tr data-id="' + t.id + '" class="row-click' + (t.notes ? '' : '') + '">' + cells + '</tr>';
    }).join('');
    var cols = JOURNAL_COLUMNS.map(function (c) { return { label: c.label, cls: c.cls, key: c.key, raw: c.key }; });
    var html = table(cols.map(function (c) {
      var sorted = state.sort.key === c.key;
      return { label: esc(c.label) + (sorted ? '<span class="sort-ico">' + (state.sort.dir === 'asc' ? '↑' : '↓') + '</span>' : ''), cls: ((c.cls || '') + ' ' + (c.hide || '') + ' sortable' + (sorted ? ' sorted' : '')).trim(), title: 'Trier' };
    }), rows, { class: 'table-journal' });
    // remplace l'entête par des cellules cliquables portant la clé de tri
    var headCells = JOURNAL_COLUMNS.map(function (c) {
      var sorted = state.sort.key === c.key;
      return '<th class="' + ((c.cls || '') + ' ' + (c.hide || '') + ' sortable' + (sorted ? ' sorted' : '')).trim() + '" data-sort="' + c.key + '">' + esc(c.label) +
        (sorted ? '<span class="sort-ico">' + (state.sort.dir === 'asc' ? '↑' : '↓') + '</span>' : '') + '</th>';
    }).join('');
    return html.replace(/<thead><tr>[\s\S]*?<\/tr><\/thead>/, '<thead><tr>' + headCells + '</tr></thead>');
  }

  /* --- vue cartes (tablette / mobile / tactile) --- */
  function tradesCardsHTML(trades) {
    return '<div class="trade-cards">' + trades.map(function (t) {
      var rows = [
        ['Setup', t.setup || '—'],
        ['Session', t.session || '—'],
        ['Risque', t.riskAmount ? UI.fmtMoney(t.riskAmount) : '—'],
        ['Pips', t.pips === null ? '—' : UI.fmtNum(t.pips, 1) + (t.plannedRR ? ' · RR ' + UI.fmtNum(t.plannedRR, 1) : '')],
        ['Frais', t.fees ? UI.fmtMoney(t.fees) : '—'],
        ['Durée', UI.dur(t.durationMin)]
      ];
      return '<article class="trade-card" data-id="' + t.id + '" tabindex="0">' +
        '<header>' +
        '<div class="tc-id">' +
        '<b>' + esc(t.symbol || '—') + '</b>' +
        '<span class="tag">' + (t.direction === 'short' ? 'Vente' : 'Achat') + '</span>' +
        '<span class="tc-date">' + esc(Store.fmtDateFR(t.date)) + (t.time ? ' · ' + esc(t.time) : '') + '</span>' +
        '</div>' +
        '<div class="tc-pnl ' + UI.signClass(t.netPnl) + '">' +
        '<b>' + (t.hasResult ? UI.fmtMoneySigned(t.netPnl) : '<span class="badge flat">en cours</span>') + '</b>' +
        (t.rMultiple !== null ? '<span>' + UI.fmtR(t.rMultiple) + '</span>' : '') +
        '</div>' +
        '</header>' +
        '<div class="tc-grid">' + rows.map(function (r) {
          return '<div class="tc-cell"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>' +
        '<footer>' +
        '<div class="tc-meta">' + planBadge(t.planFollowed) +
        (t.emotion ? '<span class="tc-tag">' + esc(t.emotion) + '</span>' : '') +
        (t.mistake && t.mistake !== 'Aucune' ? '<span class="tc-tag warn">' + UI.icon('warn') + esc(t.mistake) + '</span>' : '') +
        '</div>' +
        '<div class="tc-actions">' +
        '<button class="icon-btn" data-action="duplicate" data-id="' + t.id + '" title="Dupliquer le trade">' + UI.icon('copy') + '</button>' +
        '<button class="icon-btn danger" data-action="delete" data-id="' + t.id + '" title="Supprimer le trade">' + UI.icon('trash') + '</button>' +
        '</div></footer>' +
        (t.notes ? '<p class="tc-notes">' + esc(UI.truncate(t.notes, 160)) + '</p>' : '') +
        '</article>';
    }).join('') + '</div>';
  }

  function emptyJournalHTML() {
    if (!state.trades.length) {
      return '<div class="empty"><div class="empty-ico">' + UI.icon('journal') + '</div><h3>Votre journal est vide</h3>' +
        '<p>Ajoutez un trade, importez un CSV (modèles dans <code>trading/exemples/</code>), ou chargez la démonstration pour explorer le tableau de bord.</p>' +
        '<div class="empty-actions"><button class="btn primary" data-empty="add">+ Ajouter un trade</button>' +
        '<button class="btn ghost" data-empty="import">Importer un CSV</button>' +
        '<button class="btn ghost" data-empty="demo">Voir avec des données de démo</button></div>' +
        '<p class="muted small">La démonstration est marquée « démo » : elle se supprime d\'un clic, seule, sans toucher à vos trades.</p></div>';
    }
    return '<div class="empty"><div class="empty-ico">' + UI.icon('analyses') + '</div><h3>Aucun trade sur cette sélection</h3><p>Élargissez la période ou réinitialisez les filtres.</p>' +
      '<div class="empty-actions"><button class="btn ghost" data-empty="reset">Réinitialiser les filtres</button></div></div>';
  }

  /* =========================================================
     FORMULAIRE DE TRADE
     ========================================================= */
  function openTradeForm(trade, model) {
    var s = state.settings;
    var isNew = !trade;
    var t = trade || Store.emptyTrade();
    var raw = Store.toRaw(t);
    var content = el('div', 'trade-form');
    content.innerHTML = formHTML(raw, s);
    var m = UI.openModal({
      title: isNew ? 'Nouveau trade' : 'Modifier le trade',
      size: 'lg',
      content: content,
      footerButtons: [
        {
          label: 'Annuler', class: 'ghost', onClick: function (o, close) { close(); }
        },
        {
          label: isNew ? 'Ajouter au journal' : 'Enregistrer', class: 'primary', onClick: function (overlay, close) {
            var data = readForm($('form', overlay));
            if (!data.symbol) { UI.toast('Indiquez un instrument.', 'error'); return; }
            data.rMode = (data.rMultipleIn === '' || data.rMultipleIn === null || data.rMultipleIn === undefined) ? 'auto' : 'manual';
            var norm = Store.normalizeTrade(Object.assign({}, raw, data), s);
            if (isNew) state.trades.push(norm);
            else {
              var i = state.trades.findIndex(function (x) { return x.id === norm.id; });
              if (i > -1) state.trades[i] = norm; else state.trades.push(norm);
            }
            persist();
            close();
            render();
            UI.toast(isNew ? 'Trade ajouté au journal.' : 'Trade mis à jour.');
          }
        }
      ]
    });
    wireForm($('form', m.overlay), s);
    setTimeout(function () { var f = $('input[name="symbol"]', m.overlay); if (f) f.focus(); }, 80);
  }

  function formHTML(r, s) {
    var cur = s.currencySymbol;
    function f(label, inner, hint, cls, rawLabel) {
      return '<div class="form-field ' + (cls || '') + '"><label>' + (rawLabel ? label : esc(label)) + '</label>' + inner + (hint ? '<span class="field-hint">' + hint + '</span>' : '') + '</div>';
    }
    function input(name, value, attrs, cls) {
      return '<input name="' + name + '" class="input ' + (cls || '') + '" value="' + attr(value === null || value === undefined ? '' : value) + '" ' + (attrs || '') + '>';
    }
    return '<form class="trade-form-grid" autocomplete="off" onsubmit="return false">' +
      '<input type="hidden" name="id" value="' + attr(r.id) + '">' +
      '<input type="hidden" name="rMode" value="' + attr(r.rMode) + '">' +

      f('Date', input('date', r.date, 'type="date"')) +
      f('Heure', input('time', r.time, 'type="time"')) +
      f('Instrument', input('symbol', r.symbol, 'list="symbolList" placeholder="EURUSD"') +
        '<datalist id="symbolList">' + s.symbols.map(function (x) { return '<option value="' + attr(x) + '">'; }).join('') + '</datalist>') +
      f('Sens', UI.segHTML('direction', [{ value: 'long', label: '▲ Achat' }, { value: 'short', label: '▼ Vente' }], r.direction)) +

      f('Session', UI.selectHTML('session', s.sessions, r.session, '—')) +
      f('Setup', UI.selectHTML('setup', s.setups, r.setup, '—')) +

      f('Prix d\'entrée', input('entry', r.entry, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +
      f('Stop loss', input('stop', r.stop, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +
      f('Objectif (TP)', input('target', r.target, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +
      f('Prix de sortie', input('exit', r.exit, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +
      f('Taille (lots)', input('size', r.size, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +
      f('Frais / commissions (' + cur + ')', input('fees', r.fees, 'type="number" step="any" inputmode="decimal"', 'calc'), '', 'g3') +

      f('Risque en ' + cur + ' <span class="auto-tag">auto</span>', input('riskAmount', r.riskAmount, 'type="number" step="any" inputmode="decimal"', 'calc'), 'Calculé si vous laissez vide (taille × distance au stop)', '', true) +
      f('P&L brut en ' + cur + ' <span class="auto-tag">auto</span>', input('pnl', r.pnl, 'type="number" step="any" inputmode="decimal"', 'calc'), 'Laissez vide tant que le trade est en cours', '', true) +
      f('Multiple R (si saisi à la main)', input('rMultipleIn', r.rMultipleIn, 'type="number" step="any" inputmode="decimal"', 'calc'), 'Rempli automatiquement : P&L net ÷ risque') +

      f('Respect du plan', UI.segHTML('planFollowed', [{ value: 'oui', label: 'Oui' }, { value: 'partiel', label: 'Partiel' }, { value: 'non', label: 'Non' }, { value: '', label: '—' }], r.planFollowed)) +
      f('Émotion', UI.selectHTML('emotion', Store.EMOTION_LIST, r.emotion, '—')) +
      f('Erreur principale', UI.selectHTML('mistake', Store.MISTAKE_LIST, r.mistake, '—')) +
      f('Durée (minutes)', input('durationMin', r.durationMin, 'type="number" step="1" min="0"')) +

      f('Capture d\'écran (URL ou chemin)', input('screenshot', r.screenshot, 'placeholder="https://…"'), '', 'g2') +
      f('Notes', '<textarea name="notes" class="input" rows="3" placeholder="Contexte, émotion, ce que je referais…">' + esc(r.notes) + '</textarea>', '', 'g2') +

      '<div class="preview" id="preview"></div>' +
      '</form>';
  }

  function readForm(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (e) {
      if (!e.name) return;
      if (e.type === 'hidden' || e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && e.type !== 'button')) data[e.name] = e.value;
    });
    // segmented controls
    $$('.seg', form).forEach(function (seg) {
      var active = $('.seg-btn.active', seg);
      data[seg.dataset.name] = active ? active.dataset.val : '';
    });
    return data;
  }

  function wireForm(form, s) {
    $$('.seg', form).forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('.seg-btn'); if (!b) return;
        $$('.seg-btn', seg).forEach(function (x) { x.classList.toggle('active', x === b); });
        updatePreview(form, s);
      });
    });
    $$('.calc', form).forEach(function (i) { i.addEventListener('input', function () { updatePreview(form, s); }); });
    $$('input,select,textarea', form).forEach(function (i) { i.addEventListener('change', function () { updatePreview(form, s); }); });
    updatePreview(form, s);
  }

  function updatePreview(form, s) {
    var d = readForm(form);
    var raw = Store.normalizeTrade(Object.assign({}, d, { pnl: d.pnl, riskAmount: d.riskAmount }), s);
    var box = $('#preview', form);
    if (!box) return;
    var ps = Store.pipSize(d.symbol);
    var dist = (raw.entry !== null && raw.stop !== null) ? Math.abs(raw.entry - raw.stop) / ps : null;
    var items = [
      ['Distance du stop', dist === null ? '—' : UI.fmtNum(dist, 1) + ' ' + (ps >= 1 ? 'points' : 'pips')],
      ['R:R prévu', raw.plannedRR === null ? '—' : '1 : ' + UI.fmtNum(raw.plannedRR, 2)],
      ['Pips réalisés', raw.pips === null ? '—' : UI.fmtNum(raw.pips, 1)],
      ['Risque estimé', raw.riskAmount ? UI.fmtMoney(raw.riskAmount) + ' (' + UI.fmtNum(raw.riskAmount / (s.startingCapital || 1) * 100, 2) + ' % du capital)' : '—'],
      ['P&L net', raw.pnl === null ? 'trade en cours' : UI.fmtMoneySigned(raw.netPnl)],
      ['Multiple R', raw.rMultiple === null ? '—' : UI.fmtR(raw.rMultiple)]
    ];
    box.innerHTML = '<h4>Aperçu calculé</h4><div class="preview-grid">' + items.map(function (i) {
      return '<div class="preview-item"><span>' + i[0] + '</span><b>' + i[1] + '</b></div>';
    }).join('') + '</div>' +
      '<div class="preview-actions"><button type="button" class="btn ghost small" id="btnAutofill">Reporter ces valeurs dans le formulaire</button></div>';
    $('#btnAutofill', box).addEventListener('click', function () {
      if (raw.riskAmount) $('input[name="riskAmount"]', form).value = raw.riskAmount;
      if (raw.pnl !== null) $('input[name="pnl"]', form).value = raw.pnl;
      $('input[name="rMultipleIn"]', form).value = raw.rMultiple === null ? '' : raw.rMultiple;
      updatePreview(form, s);
    });
  }

  /* =========================================================
     IMPORT / EXPORT
     ========================================================= */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  function openImportDialog(model) {
    var content = el('div', 'import-dialog');
    content.innerHTML =
      '<p>Importez un fichier CSV / TSV (Excel : « Enregistrer sous → CSV ») ou collez la colonne de vos trades. Les accents et les intitulés de colonnes en français ou en anglais sont reconnus automatiquement.</p>' +
      '<div class="import-actions">' +
      '<label class="btn ghost file-btn">Choisir un fichier<input type="file" id="impFile" accept=".csv,.tsv,.txt,.json" hidden></label>' +
      '<button class="btn ghost" id="impPasteBtn">Coller du texte</button>' +
      '</div>' +
      '<div class="import-paste" id="impPaste"><textarea class="input" rows="6" placeholder="Date;Instrument;Sens;Entrée;Stop;Sortie;Taille;P&L;R&#10;2026-09-01;EURUSD;Long;1,0850;1,0830;1,0900;0,5;125,00;2,5"></textarea>' +
      '<button class="btn primary small" id="impPasteGo">Importer le texte collé</button></div>' +
      '<div class="import-result" id="impResult"></div>' +
      '<p class="muted small">Colonnes reconnues : Date, Heure, Instrument, Sens, Session, Setup, Entrée, Stop, Objectif, Sortie, Taille, Risque, P&L, Frais, R, Respect du plan, Émotion, Erreur, Durée, Notes, Capture.</p>';
    UI.openModal({
      title: 'Importer des trades', size: 'md', content: content,
      footerButtons: [{ label: 'Fermer', class: 'ghost', onClick: function (o, close) { close(); } }]
    });
    var paste = $('#impPaste', content);
    $('#impPasteBtn', content).addEventListener('click', function () { paste.classList.toggle('open'); });

    function handleText(text, source) {
      var res = Store.csvToTrades(text);
      var box = $('#impResult', content);
      if (!res.trades.length) {
        box.innerHTML = '<div class="alert ko"><span class="alert-ico">' + UI.icon('warn') + '</span><span>Aucun trade lisible dans ' + esc(source) + '. Vérifiez que la première ligne contient bien les intitulés de colonnes.</span></div>';
        return;
      }
      var normalized = res.trades.map(function (t) { return Store.normalizeTrade(Store.toRaw(t), state.settings); });
      Array.prototype.push.apply(state.trades, normalized);
      persist();
      render();
      box.innerHTML = '<div class="alert ok"><span class="alert-ico">' + UI.icon('check') + '</span><span>' + UI.pl(normalized.length, 'trade importé', 'trades importés') + ' depuis ' + esc(source) + '.' +
        (res.skipped ? ' ' + UI.pl(res.skipped, 'ligne ignorée', 'lignes ignorées') + ' (vides).' : '') +
        (res.unknown.length ? ' Colonnes non reconnues : ' + esc(res.unknown.join(', ')) + '.' : '') + '</span></div>';
      UI.toast(UI.pl(normalized.length, 'trade importé', 'trades importés') + '.');
    }

    $('#impFile', content).addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result);
        if (/\.json$/i.test(file.name)) {
          try {
            var parsed = JSON.parse(text);
            var st = Store.hydrate(parsed);
            state.trades = st.trades;
            state.settings = st.settings;
            state.demo = st.demo;
            UI.setCurrency(state.settings.currency);
            persist();
            render();
            UI.toast('Sauvegarde restaurée : ' + UI.pl(st.trades.length, 'trade') + '.');
            $('#impResult', content).innerHTML = '<div class="alert ok"><span class="alert-ico">' + UI.icon('check') + '</span><span>Sauvegarde JSON restaurée (' + st.trades.length + ' trades).</span></div>';
          } catch (err) {
            UI.toast('Fichier JSON illisible.', 'error');
          }
          return;
        }
        handleText(text, file.name);
      };
      reader.readAsText(file, 'utf-8');
    });

    $('#impPasteGo', content).addEventListener('click', function () {
      var text = $('textarea', paste).value.trim();
      if (!text) { UI.toast('Collez d\'abord des données.', 'warn'); return; }
      handleText(text, 'texte collé');
    });
  }

  function openExportDialog(model) {
    var content = el('div', 'export-dialog');
    content.innerHTML =
      '<p>Exportez vos données pour les sauvegarder ou les analyser ailleurs. Les filtres actuels s\'appliquent à l\'export CSV.</p>' +
      '<ul class="export-list">' +
      '<li><b>CSV du journal</b> — ' + UI.pl(model.trades.length, 'ligne') + ', séparateur « ; » et virgules décimales (Excel français).</li>' +
      '<li><b>Sauvegarde JSON complète</b> — trades + paramètres, à réimporter plus tard (bouton Importer).</li>' +
      '</ul>';
    UI.openModal({
      title: 'Exporter', size: 'sm', content: content,
      footerButtons: [
        { label: 'CSV (journal filtré)', class: 'ghost', onClick: function () { download('journal-trading-' + Store.todayISO() + '.csv', Store.tradesToCSV(model.trades), 'text/csv;charset=utf-8'); UI.toast('Export CSV prêt.'); } },
        { label: 'Tout exporter (CSV)', class: 'ghost', onClick: function () { download('journal-trading-complet-' + Store.todayISO() + '.csv', Store.tradesToCSV(state.trades), 'text/csv;charset=utf-8'); } },
        { label: 'Sauvegarde JSON', class: 'primary', onClick: function () { download('journal-trading-backup-' + Store.todayISO() + '.json', JSON.stringify({ version: 1, settings: state.settings, trades: state.trades.map(Store.toRaw), demo: state.demo }, null, 2), 'application/json'); UI.toast('Sauvegarde JSON prête.'); } }
      ]
    });
  }

  /* =========================================================
     INITIALISATION
     ========================================================= */
  function bindGlobal() {
    $('#btnAddGlobal').addEventListener('click', function () { openTradeForm(null, buildModel()); });
    $('#btnMenu').addEventListener('click', function () { $('.sidebar').classList.toggle('open'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { var o = $('.modal-overlay.on'); if (o) $('[data-close]', o).click(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); state.view = 'journal'; render(); setTimeout(function () { var s = $('#jSearch'); if (s) s.focus(); }, 60); }
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-empty]'); if (!b) return;
      if (b.dataset.empty === 'add') openTradeForm(null, buildModel());
      if (b.dataset.empty === 'import') openImportDialog(buildModel());
      if (b.dataset.empty === 'demo') { loadDemo(); }
      if (b.dataset.empty === 'cleardemo') { confirmRemoveDemo(); }
      if (b.dataset.empty === 'reset') { state.filters.symbols = []; state.filters.setups = []; state.filters.sessions = []; state.filters.directions = []; state.filters.planStatus = []; state.filters.from = null; state.filters.to = null; state.filters.preset = 'all'; render(); }
    });
  }

  function confirmRemoveDemo() {
    var n = demoCount();
    if (!n) { UI.toast('Aucune donnée de démonstration à supprimer.', 'info'); return; }
    var real = realTrades().length;
    UI.confirmDialog({
      title: 'Supprimer la démonstration ?',
      message: (real
        ? 'Les <b>' + UI.pl(n, 'trade de démonstration') + '</b> seront retirés ; vos <b>' + UI.pl(real, 'trade personnel', 'trades personnels') + '</b> sont conservés.'
        : 'Les <b>' + UI.pl(n, 'trade de démonstration') + '</b> seront retirés de ce journal.'),
      confirmLabel: 'Supprimer la démo', danger: true
    }).then(function (ok) { if (ok) removeDemoTrades(); });
  }

  function loadDemo() {
    var demo = Store.demoState(80, 20260914, state.settings);
    state.trades = demo.trades.map(function (t) { return Store.normalizeTrade(Store.toRaw(t), state.settings); });
    state.demo = true;
    state.filters.preset = 'all'; state.filters.from = null; state.filters.to = null;
    persist();
    render();
    UI.toast('Données de démonstration chargées (80 trades). Supprimez-les dans Paramètres.');
  }

  function init() {
    load();
    bindGlobal();
    render();
    // Notifications de démarrage (une seule à la fois, et pas au premier lancement :
    // l'état vide du journal explique déjà quoi faire).
    if (!Store.storageAvailable()) {
      setTimeout(function () {
        UI.toast('Stockage local indisponible : exportez votre journal en JSON pour ne rien perdre.', 'warn', 7000);
      }, 400);
    }
  }

  // API partagée avec views.js
  var publicAPI = {
    state: state,
    render: render,
    buildModel: buildModel,
    persist: persist,
    loadDemo: loadDemo,
    demoCount: demoCount, hasDemo: hasDemo, removeDemoTrades: removeDemoTrades, confirmRemoveDemo: confirmRemoveDemo,
    applyPreset: applyPreset,
    PRESETS: PRESETS,
    card: card,
    table: table,
    kpiCard: kpiCard,
    progress: progress,
    planBadge: planBadge,
    miniStat: miniStat,
    periodLabel: periodLabel,
    rangeInputsHTML: rangeInputsHTML,
    filterChipsHTML: filterChipsHTML,
    mountEquity: mountEquity,
    objectivesHTML: objectivesHTML,
    disciplineHTML: disciplineHTML,
    openTradeForm: openTradeForm,
    openImportDialog: openImportDialog,
    openExportDialog: openExportDialog,
    download: download,
    sortedTrades: sortedTrades,
    filterCount: filterCount
  };
  global.App = publicAPI;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
