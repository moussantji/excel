/* =========================================================
   views.js — Vues Calendrier, Analyses, Plan, Paramètres
   ========================================================= */
(function (global) {
  'use strict';

  var Store = global.Store, Metrics = global.Metrics, Charts = global.Charts, Plan = global.Plan, UI = global.UI;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc, attr = UI.attr;

  /* =========================================================
     VUE : CALENDRIER
     ========================================================= */
  function calendrier(host, model, App) {
    var st = App.state;
    var year = st.year;
    var dailyOfYear = {};
    var yearNet = 0, yearR = 0, green = 0, red = 0, trades = 0;
    Object.keys(model.dailyMap).forEach(function (k) {
      if (k.slice(0, 4) === String(year)) {
        dailyOfYear[k] = model.dailyMap[k];
        yearNet += model.dailyMap[k].net;
        yearR += model.dailyMap[k].r;
        if (model.dailyMap[k].net > 0) green++; else if (model.dailyMap[k].net < 0) red++;
        trades += model.dailyMap[k].count;
      }
    });
    var years = {};
    Object.keys(model.dailyMap).forEach(function (k) { years[k.slice(0, 4)] = true; });
    if (!years[year]) years[year] = true;

    var html = '';
    html += card_nav(year, years, yearNet, yearR, green, red, trades);
    html += App.card('Calendrier ' + year,
      '<div class="chart-host" id="calHost"></div>' +
      '<div class="cal-legend"><span class="lg-dot" style="background:#25d09a"></span> jour gagnant ' +
      '<span class="lg-dot" style="background:#ff5f6d;margin-left:12px"></span> jour perdant ' +
      '<span class="cal-hint">Cliquez sur un jour pour voir le détail des trades.</span></div>', { class: 'card-wide' });

    var selected = st.selectedDay;
    var dayTrades = selected ? model.trades.filter(function (t) { return t.date === selected; }) : [];
    html += '<div class="grid-2">';
    html += App.card(selected ? 'Journée du ' + Store.fmtDateFR(selected, { long: true }) : 'Détail d\'une journée',
      selected ? dayDetailHTML(dayTrades) : '<p class="muted">Sélectionnez une journée dans le calendrier pour afficher le détail : trades, résultat, R, respect du plan et notes.</p>');
    html += App.card('Records : 10 meilleures et 10 pires journées',
      recordsDaysHTML(model.daily));
    html += '</div>';

    html += App.card('Résultat par mois', '<div class="chart-host" id="calMonthChart"></div>', { class: 'card-chart' });
    host.innerHTML = html;

    Charts.yearCalendar($('#calHost'), {
      year: year,
      dailyMap: dailyOfYear,
      today: model.today,
      fmt: function (v) { return UI.fmtMoney(v, { decimals: 0 }); },
      onPick: function (date) {
        st.selectedDay = date;
        App.render();
      }
    });
    var monthItems = model.months.map(function (m) {
      return { label: m.label, value: m.net, meta: m, color: Number(m.key.slice(0, 4)) === Number(year) ? (m.net >= 0 ? Charts.colors.green : Charts.colors.red) : 'rgba(255,255,255,.18)' };
    });
    Charts.bars($('#calMonthChart'), {
      items: monthItems, height: 260, maxLabels: 12, barWidth: 58,
      tipFn: function (it) {
        return '<div class="tip-t">' + esc(it.meta.label) + '</div>' +
          '<div class="tip-v ' + UI.signClass(it.value) + '">' + UI.fmtMoneySigned(it.value) + '</div>' +
          '<div class="tip-s">' + UI.pl(it.meta.closed, 'trade') + ' · ' + UI.fmtR(it.meta.sumR, 1) + '</div>';
      }
    });

    $$('[data-year]', host).forEach(function (b) {
      b.addEventListener('click', function () { st.year = Number(b.dataset.year); App.render(); });
    });
    $$('[data-day-jump]', host).forEach(function (b) {
      b.addEventListener('click', function () { st.selectedDay = b.dataset.dayJump; App.render(); });
    });
    $$('tr[data-id]', host).forEach(function (tr) {
      tr.addEventListener('click', function () {
        var t = App.state.trades.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (t) App.openTradeForm(t, model);
      });
    });
  }

  function card_nav(year, years, net, r, green, red, trades) {
    var list = Object.keys(years).sort();
    return '<div class="cal-toolbar">' +
      '<div class="year-nav">' +
      '<button class="icon-btn" data-year="' + (year - 1) + '">‹</button>' +
      '<b>' + year + '</b>' +
      '<button class="icon-btn" data-year="' + (year + 1) + '">›</button>' +
      list.map(function (y) {
        return '<button class="pill' + (Number(y) === Number(year) ? ' active' : '') + '" data-year="' + y + '">' + y + '</button>';
      }).join('') +
      '</div>' +
      '<div class="cal-summary">' +
      UI.miniStat('Année', UI.fmtMoneySigned(net), UI.signClass(net)) +
      UI.miniStat('Total R', UI.fmtR(r, 1), UI.signClass(r)) +
      UI.miniStat('Jours verts', String(green), 'pos') +
      UI.miniStat('Jours rouges', String(red), 'neg') +
      UI.miniStat('Trades', String(trades), '') +
      '</div></div>';
  }

  function dayDetailHTML(trades) {
    if (!trades.length) return '<p class="muted">Aucun trade enregistré ce jour-là.</p>';
    var closed = trades.filter(function (t) { return t.hasResult; });
    var net = closed.reduce(function (a, t) { return a + t.netPnl; }, 0);
    var r = closed.reduce(function (a, t) { return a + (t.rMultiple || 0); }, 0);
    var risk = closed.reduce(function (a, t) { return a + (t.riskAmount || 0); }, 0);
    var html = '<div class="mini-stats wide">' +
      UI.miniStat('Résultat', UI.fmtMoneySigned(net), UI.signClass(net)) +
      UI.miniStat('Total R', UI.fmtR(r, 2), UI.signClass(r)) +
      UI.miniStat('Trades', String(trades.length), '') +
      UI.miniStat('Risque engagé', UI.fmtMoney(risk), '') +
      '</div>';
    html += App.table([
      { label: 'Heure' }, { label: 'Instrument' }, { label: 'Setup' }, { label: 'Risque', cls: 'num' },
      { label: 'P&L net', cls: 'num' }, { label: 'R', cls: 'num' }, { label: 'Plan', cls: 'num' }
    ], trades.map(function (t) {
      return '<tr data-id="' + t.id + '" class="row-click">' +
        '<td>' + esc(t.time || '—') + '</td>' +
        '<td><b>' + esc(t.symbol) + '</b> <span class="cell-sub-inline">' + (t.direction === 'short' ? 'vente' : 'achat') + '</span></td>' +
        '<td>' + esc(t.setup || '—') + '</td>' +
        '<td class="num">' + UI.fmtMoney(t.riskAmount) + '</td>' +
        '<td class="num ' + UI.signClass(t.netPnl) + '"><b>' + (t.hasResult ? UI.fmtMoneySigned(t.netPnl) : 'en cours') + '</b></td>' +
        '<td class="num ' + UI.signClass(t.rMultiple) + '">' + UI.fmtR(t.rMultiple) + '</td>' +
        '<td class="num">' + App.planBadge(t.planFollowed) + '</td></tr>';
    }).join(''));
    if (trades.some(function (t) { return t.notes; })) {
      html += '<div class="day-notes">' + trades.filter(function (t) { return t.notes; }).map(function (t) {
        return '<p><b>' + esc(t.symbol) + '</b> — ' + esc(t.notes) + '</p>';
      }).join('') + '</div>';
    }
    return html;
  }

  function recordsDaysHTML(daily) {
    if (!daily.length) return '<p class="muted">Aucune journée clôturée sur la période.</p>';
    var sorted = daily.slice().sort(function (a, b) { return b.net - a.net; });
    function list(items, cls) {
      return '<ul class="record-list">' + items.map(function (d) {
        return '<li><button class="link" data-day-jump="' + d.date + '">' + esc(Store.fmtDateFR(d.date)) + '</button>' +
          '<span class="muted">' + UI.pl(d.count, 'trade') + '</span>' +
          '<b class="' + cls + '">' + UI.fmtMoneySigned(d.net) + '</b></li>';
      }).join('') + '</ul>';
    }
    return '<div class="records"><div><h4>Top 10 journées</h4>' + list(sorted.slice(0, 10), 'pos') + '</div>' +
      '<div><h4>10 pires journées</h4>' + list(sorted.slice(-10).reverse(), 'neg') + '</div></div>';
  }

  /* =========================================================
     VUE : ANALYSES
     ========================================================= */
  function analyses(host, model, App) {
    var k = model.kpis, st = App.state;
    if (!model.results.length) {
      host.innerHTML = '<div class="empty"><div class="empty-ico">' + UI.icon('analyses') + '</div><h3>Aucun trade clôturé sur cette période</h3><p>Élargissez la période ou ajoutez des trades dans le journal.</p></div>';
      return;
    }
    var html = '';

    // --- KPI avancés ---
    var feesTotal = model.results.reduce(function (a, t) { return a + (t.fees || 0); }, 0);
    var advance = [
      { label: 'SQN', value: k.sqn === null ? '—' : UI.fmtNum(k.sqn),
        sub: k.sqn === null ? 'Au moins 6 trades nécessaires'
          : k.sqn >= 5 ? 'Excellent'
          : k.sqn >= 3 ? 'Bon à excellent'
          : k.sqn >= 2.5 ? 'Bon'
          : k.sqn >= 2 ? 'Moyen'
          : k.sqn >= 1.6 ? 'Sous la moyenne'
          : 'À revoir' },
      { label: 'Ratio de Sharpe (par trade)', value: k.sharpeR === null ? '—' : UI.fmtNum(k.sharpeR), sub: 'Espérance ÷ volatilité des R' },
      { label: 'Écart-type des R', value: k.sdR === null ? '—' : UI.fmtNum(k.sdR), sub: 'Dispersion des résultats' },
      { label: 'R moyen gagnant', value: UI.fmtR(k.avgWinR), sub: 'Ce que rapporte un trade gagnant', valueClass: 'pos' },
      { label: 'R moyen perdant', value: UI.fmtR(k.avgLossR), sub: 'Ce que coûte un trade perdant', valueClass: 'neg' },
      { label: 'Meilleur R', value: UI.fmtR(k.bestR), sub: model.records.bestTrade ? model.records.bestTrade.symbol + ' · ' + Store.fmtDateFR(model.records.bestTrade.date) : '' , valueClass: 'pos' },
      { label: 'Pire R', value: UI.fmtR(k.worstR), sub: model.records.worstTrade ? model.records.worstTrade.symbol + ' · ' + Store.fmtDateFR(model.records.worstTrade.date) : '', valueClass: 'neg' },
      { label: 'Série gagnante max', value: String(model.streaks.maxWin), sub: 'Trades gagnants consécutifs' },
      { label: 'Série perdante max', value: String(model.streaks.maxLoss), sub: 'Trades perdants consécutifs' },
      { label: 'Série en cours', value: (model.streaks.currentType === 'win' ? '+' : model.streaks.currentType === 'loss' ? '−' : '') + model.streaks.current, sub: model.streaks.currentType === 'win' ? 'trades gagnants' : 'trades perdants' },
      { label: 'Jours verts / rouges', value: model.records.greenDays + ' / ' + model.records.redDays, sub: model.records.tradingDays ? UI.fmtNum(model.records.greenDays / model.records.tradingDays * 100, 0) + ' % de journées positives' : '' },
      { label: 'Frais totaux', value: UI.fmtMoney(feesTotal), sub: 'Soit ' + UI.fmtNum(feesTotal / Math.abs(k.net || 1) * 100, 1) + ' % du résultat net' },
      { label: 'Risque cumulé engagé', value: UI.fmtMoney(k.totalRisk), sub: 'Somme des risques des ' + k.closed + ' trades' },
      { label: 'Risque moyen par trade', value: UI.fmtMoney(k.avgRisk), sub: st.settings.startingCapital ? UI.fmtNum(k.avgRisk / st.settings.startingCapital * 100, 2) + ' % du capital' : '' },
      { label: 'Trades hors plan', value: String(model.discipline.offPlanClosed),
        sub: 'Dont partiels : ' + (model.discipline.partial ? model.discipline.partial.closed : 0) +
          ' · résultat ' + UI.fmtMoneySigned(model.discipline.offPlanNet) },
      { label: 'Durée moyenne', value: k.avgDuration === null ? '—' : UI.dur(k.avgDuration), sub: 'Temps en position' }
    ];
    html += '<div class="kpi-grid small">' + advance.map(App.kpiCard).join('') + '</div>';

    // --- Comparaison conformité ---
    html += App.card('Conformité au plan : impact chiffré', conformityHTML(model), { class: 'card-wide' });

    // --- Graphiques ---
    html += '<div class="grid-2">';
    html += App.card('Résultat par setup (en devise)', '<div class="chart-host" id="anSetup"></div>');
    html += App.card('Total R par setup', '<div class="chart-host" id="anSetupR"></div>');
    html += '</div>';

    html += '<div class="grid-2">';
    html += App.card('Résultat par jour de la semaine', '<div class="chart-host" id="anDow"></div>');
    html += App.card('Résultat par session', '<div class="chart-host" id="anSession"></div>');
    html += '</div>';

    html += '<div class="grid-2">';
    html += App.card('Instrument : ce qui paye, ce qui coûte', '<div class="chart-host" id="anSymbol"></div>');
    html += App.card('Erreurs : fréquence', '<div class="chart-host" id="anMistake"></div>');
    html += '</div>';

    // --- Tableaux ---
    html += App.card('Détail par setup', groupTableHTML(model.bySetup, 'Setup'));
    html += '<div class="grid-2">';
    html += App.card('Par session', groupTableHTML(model.bySession, 'Session', 4));
    html += App.card('Par jour de la semaine', groupTableHTML(model.byDow, 'Jour', 4));
    html += '</div>';
    html += '<div class="grid-2">';
    html += App.card('Par heure d\'entrée', groupTableHTML(model.byHour, 'Heure', 4));
    html += App.card('Par instrument', groupTableHTML(model.bySymbol, 'Instrument', 4));
    html += '</div>';
    html += '<div class="grid-2">';
    html += App.card('Par émotion', groupTableHTML(model.byEmotion, 'Émotion', 4));
    html += App.card('Par erreur', groupTableHTML(model.byMistake, 'Erreur', 4));
    html += '</div>';

    host.innerHTML = html;

    function hb(id, data, valueKey, fmt, empty) {
      var hostEl = $(id);
      if (!hostEl) return;
      var items = data.filter(function (g) { return g[valueKey] !== null && !isNaN(g[valueKey]); })
        .map(function (g) {
          return {
            label: g.key, value: g[valueKey],
            display: fmt === 'r' ? UI.fmtR(g[valueKey], 1) : UI.fmtMoneySigned(g[valueKey]),
            sub: UI.pl(g.closed, 'trade') + ' · espérance ' + UI.fmtR(g.expectancyR)
          };
        });
      if (!items.length) { hostEl.innerHTML = '<p class="muted">Aucune donnée.</p>'; return; }
      Charts.hbars(hostEl, { items: items, emptyMessage: empty });
    }
    hb('#anSetup', model.bySetup, 'net');
    hb('#anSetupR', model.bySetup, 'sumR', 'r');
    hb('#anSession', model.bySession, 'net');
    hb('#anSymbol', model.bySymbol, 'net');
    hb('#anMistake', model.byMistake, 'net');

    Charts.bars($('#anDow'), {
      items: model.byDow.map(function (g) { return { label: g.key, value: g.net, meta: g }; }),
      height: 280, barWidth: 46,
      tipFn: function (it) {
        return '<div class="tip-t">' + esc(it.meta.key) + '</div><div class="tip-v ' + UI.signClass(it.value) + '">' + UI.fmtMoneySigned(it.value) + '</div>' +
          '<div class="tip-s">' + UI.pl(it.meta.closed, 'trade') + ' · ' + UI.fmtNum(it.meta.winRate, 0) + ' % de réussite · ' + UI.fmtR(it.meta.sumR, 1) + '</div>';
      }
    });
  }

  function conformityHTML(model) {
    var ok = model.discipline.ok, ko = model.discipline.ko, part = model.byPlan.filter(function (g) { return g.key === 'Partiellement'; })[0];
    var total = model.results.length;
    var segs = [
      { label: 'Plan respecté', value: model.results.filter(function (t) { return t.planFollowed === 'oui'; }).length, color: Charts.colors.green },
      { label: 'Partiellement', value: model.results.filter(function (t) { return t.planFollowed === 'partiel'; }).length, color: Charts.colors.gold },
      { label: 'Hors plan', value: model.results.filter(function (t) { return t.planFollowed === 'non'; }).length, color: Charts.colors.red },
      { label: 'Non renseigné', value: model.results.filter(function (t) { return !t.planFollowed; }).length, color: '#4b5265' }
    ];
    function block(title, g, tone) {
      if (!g) return '<div class="conform-col"><h4>' + title + '</h4><p class="muted">Pas de trades dans cette catégorie.</p></div>';
      return '<div class="conform-col ' + tone + '"><h4>' + title + '</h4>' +
        '<div class="conform-kpi"><b class="' + UI.signClass(g.net) + '">' + UI.fmtMoneySigned(g.net) + '</b><span>' + g.closed + ' trades</span></div>' +
        '<ul class="conform-list">' +
        '<li>Espérance par trade <b class="' + UI.signClass(g.expectancyR) + '">' + UI.fmtR(g.expectancyR) + '</b></li>' +
        '<li>Total R <b class="' + UI.signClass(g.sumR) + '">' + UI.fmtR(g.sumR, 1) + '</b></li>' +
        '<li>Taux de réussite <b>' + UI.fmtNum(g.winRate, 0) + ' %</b></li>' +
        '<li>Profit factor <b>' + (g.profitFactor === Infinity ? '∞' : UI.fmtNum(g.profitFactor)) + '</b></li>' +
        '<li>Gain moyen <b class="pos">' + UI.fmtMoney(g.avgWin) + '</b></li>' +
        '<li>Perte moyenne <b class="neg">' + UI.fmtMoney(g.avgLoss) + '</b></li>' +
        '</ul></div>';
    }
    return '<div class="chart-host" id="conformStack"></div>' +
      '<div class="conform-grid">' +
      block('<span class="dot-ico ok">' + UI.icon('check') + '</span> Plan respecté', ok, 'good') +
      block('<span class="dot-ico warn">' + UI.icon('bolt') + '</span> Partiellement respecté', part, 'mid') +
      block('<span class="dot-ico ko">' + UI.icon('warn') + '</span> Hors plan', ko, 'bad') +
      '</div>' +
      '<p class="muted small">Lecture : si la colonne « hors plan » est la plus coûteuse, le problème n\'est pas la stratégie mais l\'exécution. À l\'inverse, si le plan respecté perd de l\'argent sur beaucoup de trades, il faut revoir le plan lui-même (après 20 trades minimum par setup).</p>' +
      (function () { setTimeout(function () { var h = $('#conformStack'); if (h) Charts.stack(h, { segments: segs }); }, 0); return ''; })();
  }

  function groupTableHTML(groups, label, limit) {
    var list = limit ? groups.slice(0, limit) : groups;
    if (!list.length) return '<p class="muted">Aucune donnée.</p>';
    var rows = list.map(function (g) {
      return '<tr>' +
        '<td><b>' + esc(g.key) + '</b></td>' +
        '<td class="num">' + g.closed + '</td>' +
        '<td class="num ' + UI.signClass(g.net) + '">' + UI.fmtMoneySigned(g.net) + '</td>' +
        '<td class="num ' + UI.signClass(g.sumR) + '">' + UI.fmtR(g.sumR, 1) + '</td>' +
        '<td class="num">' + UI.fmtNum(g.winRate, 0) + ' %</td>' +
        '<td class="num">' + UI.fmtR(g.expectancyR) + '</td>' +
        '<td class="num">' + (g.profitFactor === Infinity ? '∞' : UI.fmtNum(g.profitFactor)) + '</td>' +
        '</tr>';
    }).join('');
    return App.table([
      { label: label }, { label: 'Trades', cls: 'num' }, { label: 'Résultat', cls: 'num' },
      { label: 'Total R', cls: 'num' }, { label: 'Réussite', cls: 'num' },
      { label: 'Espérance', cls: 'num' }, { label: 'PF', cls: 'num' }
    ], rows);
  }

  /* =========================================================
     VUE : PLAN DE TRADING
     ========================================================= */
  function plan(host, model, App) {
    var p = Plan.data;
    var rows = Plan.control(model);
    var score = rows.length ? Plan.disciplineScore(rows) : null;

    var html = '<div class="plan-toolbar">' +
      '<div class="plan-meta"><h2>' + esc(p.title) + '</h2><p>' + esc(p.subtitle) + ' · version ' + esc(p.version) + ' · ' + esc(p.updated) + '</p></div>' +
      '<div class="plan-actions">' +
      (score === null ? '' : '<span class="score-chip ' + (score >= 85 ? 'ok' : score >= 65 ? 'warn' : 'ko') + '">Discipline : ' + score + '/100</span>') +
      '<button class="btn ghost" id="planPrint">Imprimer / PDF</button>' +
      '</div></div>';

    html += '<div class="mission"><span class="mission-label">Mission</span><p>' + esc(p.mission) + '</p></div>';

    html += '<nav class="plan-sommaire">' + p.blocks.map(function (b) {
      return '<a href="#bloc-' + b.id + '"><b>' + b.num + '</b> ' + esc(b.title) + '</a>';
    }).join('') + '</nav>';

    html += '<div class="print-area" id="planPrintArea">';
    p.blocks.forEach(function (b) {
      html += '<section class="plan-block" id="bloc-' + b.id + '">' +
        '<header><span class="num">' + b.num + '</span><h3>' + esc(b.title) + '</h3></header>' +
        (b.lead ? '<p class="lead">' + esc(b.lead) + '</p>' : '') +
        b.items.map(renderBlock).join('') +
        '</section>';
    });

    // Checklists
    html += '<section class="plan-block" id="bloc-checklists"><header><span class="num">09</span><h3>Checklists opérationnelles</h3></header>' +
      '<p class="lead">Cases à cocher conservées dans le navigateur. Chaque case non cochée est une raison de ne pas cliquer.</p>' +
      '<div class="checklists">' + p.checklists.map(checklistHTML).join('') + '</div>' +
      '</section>';
    html += '</div>';

    html += '<p class="muted small">Ce plan est un document vivant : il se modifie une fois par mois maximum, jamais après une perte. Les modifications se font dans <code>trading/assets/js/plan.js</code>.</p>';

    host.innerHTML = html;

    // Checklists : état + actions
    $$('[data-check]', host).forEach(function (box) {
      box.addEventListener('change', function () {
        var id = box.dataset.check, idx = box.dataset.idx;
        var st = App.state.checks[id] = App.state.checks[id] || {};
        if (box.checked) st[idx] = true; else delete st[idx];
        Plan.saveChecks(App.state.checks);
        updateChecklistProgress(host, id);
      });
    });
    $$('[data-check-all]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.checkAll, on = b.dataset.on === 'true';
        var st = App.state.checks[id] = {};
        var cl = p.checklists.filter(function (c) { return c.id === id; })[0];
        if (on) cl.items.forEach(function (_, i) { st[i] = true; });
        Plan.saveChecks(App.state.checks);
        App.render();
      });
    });
    $('#planPrint').addEventListener('click', function () { global.print(); });
  }

  function renderBlock(item) {
    switch (item.type) {
      case 'kv':
        return '<div class="kv-grid">' + item.rows.map(function (r) {
          return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
        }).join('') + '</div>';
      case 'cards':
        return '<div class="plan-cards">' + item.cards.map(function (c) {
          return '<div class="plan-card"><span class="ico">' + UI.icon(c.icon) + '</span><b>' + esc(c.value) + '</b><span class="t">' + esc(c.title) + '</span><span class="s">' + esc(c.sub) + '</span></div>';
        }).join('') + '</div>';
      case 'table':
        return '<div class="table-wrap"><table class="table"><thead><tr>' + item.head.map(function (h) {
          return '<th>' + esc(h) + '</th>';
        }).join('') + '</tr></thead><tbody>' + item.rows.map(function (r) {
          return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' class="strong"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      case 'list':
        return (item.title ? '<h4 class="sub-title">' + esc(item.title) + '</h4>' : '') +
          '<ul class="plan-list">' + item.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      case 'callout':
        return '<div class="callout ' + (item.tone || '') + '"><b>' + esc(item.title) + '</b><p>' + esc(item.text) + '</p></div>';
      case 'note':
        return '<p class="note">' + esc(item.text) + '</p>';
      case 'formula':
        return '<div class="formula"><h4>' + esc(item.title) + '</h4>' + item.lines.map(function (l, i) {
          return '<p class="' + (i === item.lines.length - 1 ? 'ex' : '') + '">' + esc(l) + '</p>';
        }).join('') + '</div>';
      case 'setup':
        return '<article class="setup-card"><header><h4>' + esc(item.name) + '</h4><span class="tag">' + esc(item.tag) + '</span></header>' +
          '<div class="kv-grid">' + item.rows.map(function (r) {
            return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
          }).join('') + '</div></article>';
      case 'routine':
        return '<article class="routine-card"><h4><span>' + UI.icon(item.icon) + '</span>' + esc(item.title) + '</h4>' +
          '<ul class="plan-list check">' + item.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></article>';
      case 'steps':
        return '<ol class="steps">' + item.steps.map(function (s) {
          return '<li><b>' + esc(s.title) + '</b><p>' + esc(s.text) + '</p></li>';
        }).join('') + '</ol>';
      default:
        return '';
    }
  }

  function checklistHTML(cl) {
    var st = (global.App && global.App.state.checks[cl.id]) || {};
    var total = cl.items.length;
    var done = Object.keys(st).length;
    var allOn = done === total;
    return '<article class="checklist" id="cl-' + cl.id + '">' +
      '<header><h4>' + esc(cl.title) + '</h4><div class="cl-progress" data-progress="' + cl.id + '">' +
      progressBar(done, total) + '</div></header>' +
      '<p class="hint">' + esc(cl.hint) + '</p>' +
      '<ul>' + cl.items.map(function (it, i) {
        return '<li><label><input type="checkbox" data-check="' + cl.id + '" data-idx="' + i + '"' + (st[i] ? ' checked' : '') + '><span>' + esc(it) + '</span></label></li>';
      }).join('') + '</ul>' +
      '<footer><button class="btn ghost small" data-check-all="' + cl.id + '" data-on="' + (allOn ? 'false' : 'true') + '">' +
      (allOn ? 'Tout décocher' : 'Tout cocher') + '</button></footer></article>';
  }

  function progressBar(done, total) {
    var pct = total ? done / total * 100 : 0;
    return '<div class="progress ' + (pct === 100 ? 'pos' : '') + '"><div class="progress-fill" style="width:' + pct.toFixed(0) + '%"></div></div>' +
      '<span class="cl-count">' + done + '/' + total + '</span>';
  }

  function updateChecklistProgress(host, id) {
    var box = $('[data-progress="' + id + '"]', host);
    if (!box) return;
    var st = global.App.state.checks[id] || {};
    var cl = Plan.data.checklists.filter(function (c) { return c.id === id; })[0];
    box.innerHTML = progressBar(Object.keys(st).length, cl.items.length);
  }

  /* =========================================================
     VUE : PARAMÈTRES
     ========================================================= */
  function params(host, model, App) {
    var s = App.state.settings;
    var html = '';
    html += App.card('Compte & risque',
      '<form id="settingsForm" class="settings-grid">' +
      field('Nom du compte', '<input class="input" name="accountName" value="' + attr(s.accountName) + '">') +
      field('Courtier / broker', '<input class="input" name="broker" value="' + attr(s.broker) + '">') +
      field('Devise du compte', '<select class="input" name="currency">' + Store.CURRENCIES.map(function (c) {
        return '<option value="' + c.code + '"' + (c.code === s.currency ? ' selected' : '') + '>' + c.code + ' — ' + c.label + '</option>';
      }).join('') + '</select>') +
      field('Capital de départ', '<input class="input" type="number" step="any" name="startingCapital" value="' + attr(s.startingCapital) + '">') +
      field('Risque par trade (%)', '<input class="input" type="number" step="0.1" name="riskPerTradePct" value="' + attr(s.riskPerTradePct) + '">') +
      field('Valeur du pip par lot', '<input class="input" type="number" step="any" name="pipValuePerLot" value="' + attr(s.pipValuePerLot) + '">', 'Utilisée pour calculer automatiquement le P&L. 10 pour un lot standard EURUSD, 1 pour un indice à 1 €/point.') +
      field('Trades max par jour', '<input class="input" type="number" name="maxTradesPerDay" value="' + attr(s.maxTradesPerDay) + '">') +
      field('Perte max journalière (%)', '<input class="input" type="number" step="0.1" name="maxDailyLossPct" value="' + attr(s.maxDailyLossPct) + '">') +
      field('Perte max hebdomadaire (%)', '<input class="input" type="number" step="0.1" name="maxWeeklyLossPct" value="' + attr(s.maxWeeklyLossPct) + '">') +
      field('Drawdown max (%)', '<input class="input" type="number" step="0.1" name="maxDrawdownPct" value="' + attr(s.maxDrawdownPct) + '">') +
      field('Objectif mensuel (%)', '<input class="input" type="number" step="0.1" name="targetMonthlyPct" value="' + attr(s.targetMonthlyPct) + '">') +
      '<div class="form-field wide"><label>Instruments suivis</label><input class="input" name="symbols" value="' + attr(s.symbols.join(', ')) + '"><span class="field-hint">Séparés par des virgules.</span></div>' +
      '<div class="form-field wide"><label>Setups</label><input class="input" name="setups" value="' + attr(s.setups.join(', ')) + '"></div>' +
      '<div class="form-field wide"><label>Sessions</label><input class="input" name="sessions" value="' + attr(s.sessions.join(', ')) + '"></div>' +
      '<div class="form-actions"><button class="btn primary" type="submit">Enregistrer les paramètres</button><span class="muted small">Ces valeurs alimentent les alertes du plan et les calculs automatiques.</span></div>' +
      '</form>');

    html += '<div class="grid-2">';
    html += App.card('Données & sauvegarde',
      '<div class="data-actions">' +
      '<button class="btn ghost" id="stDemo">Charger la démo (80 trades)</button>' +
      '<button class="btn ghost" id="stImport">Importer CSV / JSON</button>' +
      '<button class="btn ghost" id="stExport">Exporter</button>' +
      '<button class="btn ghost danger" id="stClearDemo"' + (App.hasDemo() ? '' : ' disabled') + '>Supprimer les trades de démo' + (App.demoCount() ? ' (' + App.demoCount() + ')' : '') + '</button>' +
      '<button class="btn danger" id="stReset">Tout effacer</button>' +
      '</div>' +
      '<div class="storage-info">' +
      '<p><b>' + App.state.trades.length + '</b> trade' + (App.state.trades.length > 1 ? 's' : '') + ' enregistré' + (App.state.trades.length > 1 ? 's' : '') + '' +
      (App.hasDemo() ? ' — dont <b class="warn-txt">' + App.demoCount() + ' de démonstration</b>' : '') +
      ' · sauvegarde : <b>' + (App.state.storage === 'local' ? 'stockage local du navigateur' : 'mémoire (temporaire)') + '</b></p>' +
      '<p class="muted small">Les données restent dans votre navigateur (aucun envoi vers un serveur). Pour les transférer sur un autre appareil : « Exporter » puis « Importer » la sauvegarde JSON.</p>' +
      '<p class="muted small">Astuce : faites une sauvegarde JSON chaque fin de semaine, comme la revue hebdomadaire du plan.</p>' +
      '</div>');

    html += App.card('Raccourcis clavier',
      '<ul class="kbd-list">' +
      '<li><kbd>Ctrl</kbd> + <kbd>K</kbd> <span>Aller au journal et rechercher</span></li>' +
      '<li><kbd>Échap</kbd> <span>Fermer la fenêtre ouverte</span></li>' +
      '<li><kbd>Ctrl</kbd> + <kbd>P</kbd> <span>Imprimer la page courante (PDF du plan)</span></li>' +
      '</ul>');
    html += '</div>';

    html += App.card('À propos', '<p class="muted">Dashboard, journal et plan de trading — application locale sans dépendance, thème sombre/or, pensée pour un compte forex & indices en euros. Calculs : P&L net = P&L brut − frais, multiple de R = P&L net ÷ risque, drawdown calculé depuis le plus haut de la courbe d\'équité. Les indicateurs suivent les conventions du plan (espérance, profit factor, SQN, ratio gain/perte).</p>');

    host.innerHTML = html;

    $('#settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      function v(n) { var e2 = f.elements[n]; return e2 ? e2.value : ''; }
      var cur = v('currency');
      s.accountName = v('accountName');
      s.broker = v('broker');
      s.currency = cur;
      var c = Store.CURRENCIES.filter(function (x) { return x.code === cur; })[0];
      s.currencySymbol = c ? c.symbol : cur;
      s.startingCapital = Store.num(v('startingCapital')) || 0;
      s.riskPerTradePct = Store.num(v('riskPerTradePct')) || 1;
      s.maxTradesPerDay = Store.num(v('maxTradesPerDay')) || 3;
      s.maxDailyLossPct = Store.num(v('maxDailyLossPct')) || 2;
      s.maxWeeklyLossPct = Store.num(v('maxWeeklyLossPct')) || 6;
      s.maxDrawdownPct = Store.num(v('maxDrawdownPct')) || 10;
      s.targetMonthlyPct = Store.num(v('targetMonthlyPct')) || 5;
      s.pipValuePerLot = Store.num(v('pipValuePerLot')) || 10;
      function list(n) {
        return v(n).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      }
      if (list('symbols').length) s.symbols = list('symbols');
      if (list('setups').length) s.setups = list('setups');
      if (list('sessions').length) s.sessions = list('sessions');
      // Recalcule les trades avec les nouveaux paramètres (R, P&L dérivés)
      App.state.trades = App.state.trades.map(function (t) { return Store.normalizeTrade(Store.toRaw(t), s); });
      UI.setCurrency(s.currency);
      App.persist();
      App.render();
      UI.toast('Paramètres enregistrés.');
    });

    $('#stDemo').addEventListener('click', function () { App.loadDemo(); });
    $('#stImport').addEventListener('click', function () { App.openImportDialog(App.buildModel()); });
    $('#stExport').addEventListener('click', function () { App.openExportDialog(App.buildModel()); });
    $('#stClearDemo').addEventListener('click', function () { App.confirmRemoveDemo(); });
    $('#stReset').addEventListener('click', function () {
      UI.confirmDialog({
        title: 'Tout effacer ?',
        message: 'Les <b>' + App.state.trades.length + ' trades</b> et les paramètres seront définitivement supprimés de ce navigateur. Exportez d\'abord une sauvegarde JSON si nécessaire.',
        confirmLabel: 'Tout effacer', danger: true
      }).then(function (ok) {
        if (!ok) return;
        App.state.trades = [];
        App.state.settings = Store.defaultSettings();
        App.state.demo = false;
        App.persist();
        App.render();
        UI.toast('Application réinitialisée.');
      });
    });
  }

  function field(label, control, hint, cls) {
    return '<div class="form-field ' + (cls || '') + '"><label>' + esc(label) + '</label>' + control +
      (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') + '</div>';
  }

  global.Views = { calendrier: calendrier, analyses: analyses, plan: plan, params: params };
})(typeof window !== 'undefined' ? window : globalThis);
