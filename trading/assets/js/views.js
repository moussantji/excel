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
      '<div class="cal-legend"><span class="lg-dot" style="background:var(--green)"></span> jour gagnant ' +
      '<span class="lg-dot" style="background:var(--red);margin-left:12px"></span> jour perdant ' +
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
      { label: 'Non renseigné', value: model.results.filter(function (t) { return !t.planFollowed; }).length, color: '#6b7385' }
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
    html += '<section class="plan-block" id="bloc-checklists"><header><span class="num">13</span><h3>Checklists opérationnelles</h3></header>' +
      '<p class="lead">Cases à cocher conservées dans le navigateur. Chaque case non cochée est une raison de ne pas cliquer.</p>' +
      '<div class="checklists">' + p.checklists.map(checklistHTML).join('') + '</div>' +
      '</section>';
    // Routine quotidienne cochée jour par jour
    if (global.Routine) html += global.Routine.carte(App);
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

    // routine : cases datées, navigation, mois
    if (global.Routine) global.Routine.cabler(host, App);
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
  /* ---------- verrouillage et chiffrement ---------- */
  function forceCode(code) {
    var c = code || '';
    var points = 0;
    if (c.length >= 6) points++;
    if (c.length >= 10) points++;
    if (/[a-zA-Z]/.test(c) && /[0-9]/.test(c)) points++;
    if (/[^a-zA-Z0-9]/.test(c) || c.length >= 16) points++;
    if (!c) return { niveau: '', pct: 0 };
    if (points <= 1) return { niveau: 'faible', pct: 33 };
    if (points === 2) return { niveau: 'moyen', pct: 66 };
    return { niveau: 'solide', pct: 100 };
  }

  function carteSecurite(App) {
    var L = global.Lock;
    if (!L) return '';
    var i = L.infos();
    var corps = '';

    if (!L.cryptoDisponible() || !L.contexteSecurise()) {
      corps = '<p class="sec-note">Le chiffrement n\'est pas disponible ici : il demande une adresse <b>https</b> (celle de l\'application publiée) et un navigateur à jour. Ouvert depuis un fichier local ou une adresse <code>http://</code>, le navigateur refuse de chiffrer — utilisez alors la sauvegarde cloud ou l\'export JSON.</p>';
      return App.card('Sécurité — verrouiller le journal', corps, { class: 'sec-card' });
    }

    if (!i.actif) {
      corps = '<div class="sec-bloc">' +
        '<p class="sec-note"><b>Vos données sont actuellement en clair</b> sur cet appareil (et dans le fichier du dépôt). Le verrouillage chiffre tout avec un code que vous seul connaissez : ni les autres applications, ni quelqu\'un qui fouille le navigateur, ni un dépôt compromis ne peuvent lire le journal.</p>' +
        '<ol class="sec-etapes">' +
        '<li>Choisissez un code : <b>6 chiffres minimum</b>, ou mieux quelques mots faciles à retenir (une phrase de 4 mots est bien plus solide qu\'un code court).</li>' +
        '<li>Un <b>code de secours</b> vous est affiché une seule fois : imprimez-le et rangez-le avec votre matériel. Il est le seul moyen de récupérer le journal si vous oubliez le code.</li>' +
        '<li>La sauvegarde cloud continue de fonctionner : le fichier du dépôt devient lui aussi illisible sans le code.</li>' +
        '</ol>' +
        '<div class="cloud-grid">' +
        champSecurite('Code de déverrouillage', 'secCode', 'password') +
        champSecurite('Répéter le code', 'secCode2', 'password') +
        '</div>' +
        '<div class="sec-jauge faible" id="secJauge"><i style="width:0%"></i></div>' +
        '<span class="muted small" id="secJaugeTxt">Force du code : —</span>' +
        '<div class="cloud-actions">' +
        '<button class="btn primary" id="secActiver">Activer le verrouillage</button>' +
        '<button class="btn ghost" id="secVoirBio">Biométrie disponible sur cet appareil ?</button>' +
        '</div>' +
        '<div id="secResult" class="cloud-result" hidden></div>' +
        '</div>';
      return App.card('Sécurité — verrouiller le journal', corps, { class: 'sec-card' });
    }

    var reste = i.essais && i.essais.jusqua > Date.now()
      ? '<span class="muted small">Tentatives ralenties : ' + Math.ceil((i.essais.jusqua - Date.now()) / 1000) + ' s d\'attente.</span>' : '';
    corps = '<div class="sec-bloc">' +
      '<div class="sec-etat">' +
      '<span class="sec-pill ' + (i.deverrouille ? 'on' : 'ou') + '"><span class="sec-dot"></span>' + (i.deverrouille ? 'Journal déverrouillé' : 'Journal verrouillé') + '</span>' +
      '<span class="muted small">Chiffrement AES-GCM 256 · ' + (i.iterations || 0).toLocaleString('fr-FR') + ' tours de dérivation' + (i.cree ? ' · activé le ' + esc(Store.fmtDateFR(String(i.cree).slice(0, 10))) : '') + '</span>' +
      reste +
      '</div>' +
      '<p class="sec-note">Le contenu du navigateur et le fichier de votre dépôt GitHub ne contiennent plus que du texte chiffré. ' +
      (i.bio ? 'Face ID / empreinte est actif sur cet appareil.' : 'La biométrie n\'est pas active sur cet appareil (Windows Hello ne sait pas fournir de clé : utilisez le code).') + '</p>' +
      '<div class="cloud-actions">' +
      '<button class="btn ghost" id="secVerrou">Verrouiller maintenant</button>' +
      '<button class="btn ghost" id="secBio">' + (i.bio ? 'Désactiver la biométrie' : 'Activer la biométrie') + '</button>' +
      '<button class="btn ghost" id="secChanger">Changer le code</button>' +
      '<button class="btn ghost" id="secSecours">Nouveau code de secours</button>' +
      '<button class="btn ghost danger" id="secDesactiver">Désactiver le verrouillage</button>' +
      '</div>' +
      '<label class="cloud-toggle"><input type="checkbox" id="secRester"' + (i.resterOnglet ? ' checked' : '') + '><span>Rester ouvert tant que l\'onglet est ouvert (sinon : code demandé à chaque rechargement)</span></label>' +
      '<label class="cloud-toggle"><span>Verrouillage automatique après inactivité :</span>' +
      '<select class="input" id="secDelai" style="width:auto">' +
      [['0', 'jamais'], ['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 heure']].map(function (o) {
        return '<option value="' + o[0] + '"' + (String(i.delaiMin) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      '<div id="secResult" class="cloud-result" hidden></div>' +
      '<details class="cloud-help"><summary>À savoir avant d\'activer (ou de changer quoi que ce soit)</summary>' +
      '<ul class="cloud-etats">' +
      '<li class="warn"><b>Code oublié et code de secours perdu = journal illisible pour toujours</b><span>Personne ne peut le reconstituer, ni moi, ni GitHub : c\'est ce qui rend le chiffrement réel. Le journal n\'est pas effacé pour autant, mais il faut le code pour l\'ouvrir.</span></li>' +
      '<li class="info"><b>La sauvegarde cloud continue de marcher</b><span>Le fichier du dépôt contient les données chiffrées : elles se synchronisent entre vos appareils, mais chaque appareil a besoin du code pour les lire. Sur un nouvel appareil, la sauvegarde sera téléchargée puis déchiffrée avec le même code.</span></li>' +
      '<li class="warn"><b>Un code court, même chiffré, se casse</b><span>Le chiffrement est solide, mais un code de 4 chiffres (10 000 combinaisons) se teste en quelques minutes hors ligne. Prenez 6 chiffres minimum, ou une phrase de 4 mots.</span></li>' +
      '<li class="info"><b>Sur une adresse http://, le verrouillage est refusé</b><span>Le navigateur ne fournit le chiffrement que sur https (ou localhost). Ouvrez l\'application depuis son adresse GitHub Pages.</span></li>' +
      '</ul></details>' +
      '</div>';
    return App.card('Sécurité — journal chiffré', corps, { class: 'sec-card' });
  }

  function champSecurite(label, id, type) {
    return '<div class="form-field"><label>' + esc(label) + '</label>' +
      '<input class="input" type="' + (type || 'text') + '" id="' + id + '" autocomplete="new-password" spellcheck="false"></div>';
  }

  function cableSecurite(App) {
    var L = global.Lock;
    if (!L) return;
    var doc = document;
    function zone(html, ton) {
      var el = doc.getElementById('secResult');
      if (!el) return;
      el.hidden = false;
      el.className = 'cloud-result ' + (ton || '');
      el.innerHTML = html;
    }
    function liste(e) {
      if (e && e.message) return e.message;
      return 'L\'appareil a refusé : ' + ((e && e.name) || 'erreur');
    }

    // --- activation ---
    var activer = doc.getElementById('secActiver');
    if (activer) activer.addEventListener('click', function () {
      var c1 = doc.getElementById('secCode'), c2 = doc.getElementById('secCode2');
      var p = L.infos();
      zone('Chiffrement en cours — l\'opération prend une à deux secondes sur cet appareil…', '');
      L.activer({ code: c1 ? c1.value : '', confirmation: c2 ? c2.value : '', delaiMin: 15 })
        .then(function (r) {
          if (!r.ok) { zone(esc(r.message), 'ko'); return; }
          var texte = '<b>Verrouillage activé.</b> Vos données sont maintenant chiffrées sur cet appareil et dans le dépôt.' +
            (r.bio && r.bio.etat === 'ok' ? ' Face ID / empreinte est actif sur cet appareil.' :
             r.bio && r.bio.etat === 'sans-prf' ? ' Cet appareil ne fournit pas de clé biométrique : le code sera demandé.' :
             r.bio && r.bio.etat === 'indisponible' ? ' La biométrie n\'est pas disponible sur cet appareil.' : '');
          texte += '<div class="code-secours" id="secCodeAffiche">' + esc(r.codeSecours) + '</div>' +
            '<p class="sec-note"><b>Notez ce code de secours maintenant</b> : il ne sera plus jamais affiché. Sans lui et sans votre code, le journal devient illisible (les données ne sont pas effacées, mais plus personne ne peut les ouvrir).</p>' +
            '<div class="cloud-actions"><button class="btn primary" id="secImprimer">Imprimer / enregistrer le code de secours</button>' +
            '<button class="btn ghost" id="secCopier">Copier le code</button>' +
            '<button class="btn ghost" id="secNote">J\'ai noté mon code</button></div>';
          // Important : on ne redessine pas la page ici, sinon le code de secours
          // disparaîtrait de l'écran avant que l'utilisateur ne puisse le noter.
          zone(texte, 'ok');
          var imp = doc.getElementById('secImprimer');
          if (imp) imp.addEventListener('click', function () { imprimerCodeSecours(r.codeSecours); });
          var cop = doc.getElementById('secCopier');
          if (cop) cop.addEventListener('click', function () {
            try { navigator.clipboard.writeText(r.codeSecours); UI.toast('Code de secours copié.', 'success'); }
            catch (e) { UI.toast('Copie impossible : notez le code à la main.', 'warn'); }
          });
          var note = doc.getElementById('secNote');
          if (note) note.addEventListener('click', function () { App.render(); });
          App.persist(true);
        });
    });

    var jauge = doc.getElementById('secCode');
    if (jauge) jauge.addEventListener('input', function () {
      var f = forceCode(jauge.value);
      var barre = doc.getElementById('secJauge'), txt = doc.getElementById('secJaugeTxt');
      if (barre) {
        barre.className = 'sec-jauge ' + f.niveau;
        var i = barre.querySelector('i');
        if (i) i.style.width = f.pct + '%';
      }
      if (txt) txt.textContent = 'Force du code : ' + (f.niveau || '—') +
        (f.niveau === 'faible' ? ' — 6 chiffres minimum, une phrase de 4 mots est bien meilleure' : '');
    });

    var voirBio = doc.getElementById('secVoirBio');
    if (voirBio) voirBio.addEventListener('click', function () {
      zone('Vérification…', '');
      L.biometriePossible().then(function (ok) {
        zone(ok ? 'Cet appareil sait utiliser Face ID / empreinte pour ouvrir le journal, en plus du code.'
                : 'Cet appareil ne fournit pas de clé biométrique utilisable par un site web (fréquent sur Windows : Windows Hello ne l\'autorise pas encore). Le code reste la solution.', ok ? 'ok' : 'warn');
      });
    });

    // --- gestion quand le verrou est actif ---
    var verrou = doc.getElementById('secVerrou');
    if (verrou) verrou.addEventListener('click', function () {
      L.verrouillerApplication('manuel').then(function () { App.effacerMemoire(); });
    });

    var bio = doc.getElementById('secBio');
    if (bio) bio.addEventListener('click', function () {
      if (L.infos().bio) {
        L.oublierBiometrie();
        UI.toast('Biométrie désactivée : le code sera demandé.', 'warn', 6000);
        App.render();
        return;
      }
      // la clé maîtresse n'est pas exportable : on redemande le code et on inscrit la biométrie à ce moment-là
      zone('Le journal va se verrouiller : saisissez votre code avec « Activer Face ID / empreinte » coché.', '');
      L.regler({ demanderBio: true });
      L.verrouillerApplication('biometrie').then(function () { App.effacerMemoire(); });
    });

    var changer = doc.getElementById('secChanger');
    if (changer) changer.addEventListener('click', function () {
      UI.openModal({
        title: 'Changer le code de déverrouillage',
        content: '<div class="form-field"><label>Code actuel</label><input class="input" type="password" id="secActuel"></div>' +
          '<div class="form-field"><label>Nouveau code</label><input class="input" type="password" id="secNew"></div>' +
          '<div class="form-field"><label>Répéter le nouveau code</label><input class="input" type="password" id="secNew2"></div>' +
          '<p class="muted small" id="secErrModal"></p>',
        footerButtons: [{
          label: 'Changer', class: 'primary', onClick: function (overlay, close) {
            var a = overlay.querySelector('#secActuel'), n = overlay.querySelector('#secNew'), n2 = overlay.querySelector('#secNew2');
            L.changerCode(a.value, n.value, n2.value).then(function (r) {
              if (!r.ok) { overlay.querySelector('#secErrModal').innerHTML = '<b>' + esc(r.message) + '</b>'; return; }
              close();
              UI.toast('Code changé : le code de secours reste valable.', 'success', 6000);
              App.render();
            });
          }
        }, { label: 'Annuler', class: 'ghost', onClick: function (o, close) { close(); } }]
      });
    });

    var secours = doc.getElementById('secSecours');
    if (secours) secours.addEventListener('click', function () {
      var champ = doc.getElementById('secResult');
      zone('<div class="form-field"><label>Code actuel</label><input class="input" type="password" id="secActuel2"></div>' +
        '<button class="btn primary" id="secSecoursGo">Générer un nouveau code de secours</button>', '');
      var go = doc.getElementById('secSecoursGo');
      if (go) go.addEventListener('click', function () {
        L.nouveauCodeSecours(doc.getElementById('secActuel2').value).then(function (r) {
          if (!r.ok) { zone(esc(r.message), 'ko'); return; }
          zone('<b>Nouveau code de secours.</b><div class="code-secours">' + esc(r.codeSecours) + '</div>' +
            '<div class="cloud-actions"><button class="btn primary" id="secImprimer">Imprimer / enregistrer</button></div>' +
            '<p class="sec-note">L\'ancien code de secours ne fonctionne plus.</p>', 'ok');
          var imp = doc.getElementById('secImprimer');
          if (imp) imp.addEventListener('click', function () { imprimerCodeSecours(r.codeSecours); });
        });
      });
    });

    var desactiver = doc.getElementById('secDesactiver');
    if (desactiver) desactiver.addEventListener('click', function () {
      UI.confirmDialog({
        title: 'Désactiver le verrouillage ?',
        message: 'Le journal sera de nouveau stocké <b>en clair</b> sur cet appareil et dans le fichier du dépôt GitHub (à la prochaine sauvegarde).',
        confirmLabel: 'Désactiver', danger: true
      }).then(function (ok) {
        if (!ok) return;
        zone('<div class="form-field"><label>Code actuel</label><input class="input" type="password" id="secActuel3"></div>' +
          '<button class="btn danger" id="secDesactiverGo">Confirmer la désactivation</button>', 'warn');
        var go = doc.getElementById('secDesactiverGo');
        if (go) go.addEventListener('click', function () {
          L.desactiver(doc.getElementById('secActuel3').value).then(function (r) {
            if (!r.ok) { zone(esc(r.message), 'ko'); return; }
            UI.toast('Verrouillage désactivé : données de nouveau en clair.', 'warn', 7000);
            App.persist(true);
            App.render();
          });
        });
      });
    });

    var rester = doc.getElementById('secRester');
    if (rester) rester.addEventListener('change', function () { L.regler({ resterOnglet: rester.checked }); });

    var delai = doc.getElementById('secDelai');
    if (delai) delai.addEventListener('change', function () {
      L.regler({ delaiMin: parseInt(delai.value, 10) || 0 });
      UI.toast(delai.value === '0' ? 'Verrouillage automatique désactivé.' : 'Verrouillage automatique réglé.', 'success');
    });
  }

  /** Imprime (ou enregistre en PDF) le code de secours avec la marche à suivre. */
  function imprimerCodeSecours(code) {
    var w = global.open('', '_blank', 'width=640,height=520');
    if (!w) { UI.toast('Autorisez les fenêtres surgissantes pour imprimer.', 'warn'); return; }
    var date = Store.fmtDateFR(Store.todayISO());
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Code de secours — Journal de trading</title>' +
      '<style>body{font-family:Georgia,serif;color:#111;padding:40px;line-height:1.6}' +
      'h1{font-size:20px;margin:0 0 6px}.code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;letter-spacing:.12em;' +
      'border:1px dashed #888;padding:16px;border-radius:8px;text-align:center;margin:18px 0;word-break:break-all}' +
      'ol{padding-left:20px}small{color:#555}</style></head><body>' +
      '<h1>Code de secours — Journal de trading</h1>' +
      '<p><small>Imprimé le ' + date + '. À conserver hors ligne, avec votre matériel.</small></p>' +
      '<div class="code">' + code + '</div>' +
      '<ol><li>Ce code ouvre le journal si vous oubliez votre code principal.</li>' +
      '<li>Il permet de choisir un nouveau code une fois ouvert.</li>' +
      '<li>Sans ce code ni votre code principal, les données chiffrées restent illisibles pour toujours.</li>' +
      '<li>Ne le laissez pas dans le même endroit que l\'appareil.</li></ol>' +
      '<p><small>Journal de trading — sauvegarde locale chiffrée (AES-GCM 256).</small></p>' +
      '<script>window.onload=function(){window.print();};<\/script></body></html>');
    w.document.close();
  }

  /* ---------- sauvegarde cloud (dépôt GitHub) ---------- */
  function carteNuage(App) {
    var S = global.Sync;
    if (!S) return '';
    var c = S.loadConfig();
    var st = S.status();
    var corps = '';

    if (!S.isConfigured()) {
      corps = '<div class="cloud-form">' +
        '<p class="muted small">Vos trades sont écrits dans un fichier de <b>votre propre dépôt GitHub</b>. Aucun serveur tiers, aucun abonnement. Le journal continue de fonctionner hors ligne : les modifications partent dès que le réseau revient.</p>' +
        '<div class="cloud-grid">' +
          champNuage('Propriétaire (compte GitHub)', 'cfOwner', c.owner || 'moussantji', 'moussantji') +
          champNuage('Dépôt', 'cfRepo', c.repo, 'journal-trading') +
          champNuage('Branche', 'cfBranch', c.branch, 'main') +
          champNuage('Fichier de sauvegarde', 'cfPath', c.path, 'sauvegarde.json') +
        '</div>' +
        '<div class="form-field wide"><label>Jeton d\'accès (fine-grained, Contents : Read and write)</label>' +
        '<input class="input" type="password" id="cfToken" autocomplete="off" spellcheck="false" placeholder="github_pat_…" value="' + attr(c.token) + '"></div>' +
        '<div class="cloud-actions">' +
        '<button class="btn ghost" id="cfTest">Tester la connexion</button>' +
        '<button class="btn primary" id="cfSave">Activer la sauvegarde automatique</button>' +
        '<a class="btn ghost" href="https://github.com/new" target="_blank" rel="noopener">Créer le dépôt</a>' +
        '<a class="btn ghost" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Créer un jeton</a>' +
        '</div>' +
        '<div id="cfResult" class="cloud-result" hidden></div>' +
        '<details class="cloud-help"><summary>Comment créer le jeton (2 minutes)</summary><ol>' +
        '<li>GitHub → <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li>' +
        '<li><b>Repository access</b> : cochez <i>Only select repositories</i> puis votre dépôt de sauvegarde.</li>' +
        '<li><b>Permissions → Repository permissions → Contents</b> : choisissez <b>Read and write</b>.</li>' +
        '<li><b>Expiration</b> : 90 jours (vous en recréerez un ensuite). Générez, copiez, collez ci-dessus.</li>' +
        '<li>Sauvegardez : la première synchro crée le fichier <code>' + esc(S.loadConfig().path) + '</code> dans le dépôt.</li>' +
        '</ol><p class="muted small">Conseil : utilisez un <b>dépôt privé dédié</b> (ex. <code>journal-trading</code>) plutôt que le dépôt public de l\'application — sinon votre journal serait lisible par tout le monde. Le jeton reste stocké uniquement dans le navigateur de cet appareil.</p></details>' +
        '</div>';
    } else {
      corps = '<div class="cloud-active">' +
        '<div class="cloud-line"><span class="sync-chip ' + st.tone + '"><span class="sync-dot"></span>' + esc(st.label) + '</span>' +
        '<span class="muted small">' + esc(S.cheminLisible()) + '</span></div>' +
        '<div class="cloud-actions">' +
        '<button class="btn ghost" id="cfSync">Synchroniser maintenant</button>' +
        '<button class="btn ghost" id="cfPull">Récupérer du cloud</button>' +
        '<button class="btn ghost" id="cfTest">Tester la connexion</button>' +
        '<button class="btn ghost danger" id="cfOff">Désactiver</button>' +
        '</div>' +
        '<label class="cloud-toggle"><input type="checkbox" id="cfAuto"' + (c.autoSync ? ' checked' : '') + '><span>Sauvegarde automatique (recommandé) — sinon, « Synchroniser maintenant »</span></label>' +
        '<div id="cfResult" class="cloud-result" hidden></div>' +
        (st.code === 'conflict'
          ? '<div class="cloud-conflict"><b>Conflit à résoudre</b><p>Le journal a été modifié sur un autre appareil le ' + esc(st.dateDistante || '?') + '.</p>' +
            '<div class="cloud-actions"><button class="btn primary" id="cfMerge">Fusionner les deux</button>' +
            '<button class="btn ghost" id="cfMine">Garder mes données</button>' +
            '<button class="btn ghost" id="cfTheirs">Prendre le cloud</button></div></div>'
          : '') +
        '<div class="cloud-log"><b>Dernières opérations</b><ul>' +
        ((st.log || []).slice(-6).reverse().map(function (l) {
          return '<li class="' + (l.tone === 'ko' ? 'ko' : l.tone === 'warn' ? 'warn' : 'ok') + '">' +
            '<span>' + esc(S.dateCourte(l.at) || '') + '</span>' + esc(l.text) + '</li>';
        }).join('') || '<li class="muted">Aucune opération pour l\'instant.</li>') +
        '</ul></div>' +
        '<p class="muted small">Le jeton est conservé dans ce navigateur uniquement. Sur un nouvel appareil, saisissez à nouveau le dépôt, le chemin et un jeton : la sauvegarde sera proposée automatiquement.</p>' +
        detailsEtats(S, st) +
        '</div>';
    }
    return App.card('Sauvegarde cloud (GitHub)', corps, { class: 'cloud-card' });
  }

  /** Tous les états possibles de la sauvegarde, le courant mis en avant. */
  function detailsEtats(S, courant) {
    var liste = S.etats ? S.etats() : [];
    if (!liste.length) return '';
    return '<details class="cloud-help"><summary>Tous les états possibles de la sauvegarde (le vôtre est encadré)</summary><ul class="cloud-etats">' +
      liste.map(function (e) {
        return '<li class="' + esc(e.tone) + (e.code === courant.code ? ' ici' : '') + '">' +
          '<b>' + esc(e.label) + '</b><span>' + esc(e.sens) + '</span></li>';
      }).join('') + '</ul></details>';
  }

  function champNuage(label, id, value, placeholder) {
    return '<div class="form-field"><label>' + esc(label) + '</label>' +
      '<input class="input" id="' + id + '" value="' + attr(value || '') + '" placeholder="' + attr(placeholder) + '" spellcheck="false"></div>';
  }

  /* ---------------------------------------------------------
     Graphique externe (TradingView) — un lien, jamais un chargement
     --------------------------------------------------------- */
  function carteGraphique(App) {
    var G = global.Graphe;
    if (!G) return '';
    var s = App.state.settings || {};
    var g = s.graphique || {};
    var actif = g.actif !== false;
    var iv = G.intervalleDe(s);
    var symboles = s.symbols || [];

    var pastille = '<span class="badge ' + (actif ? 'ok' : 'flat') + '">' + (actif ? 'Actif' : 'Éteint') + '</span>';
    var horsLigne = !G.enLigne();

    var etatHTML = '<div class="notif-etat ' + (horsLigne ? 'warn' : 'ok') + '">' +
      '<span class="notif-ico">' + UI.icon('link') + '</span>' +
      '<div><p><b>' + (horsLigne ? 'Hors ligne : le bouton attendra le réseau' : 'Le bouton « Graphique » ouvre TradingView dans une nouvelle fenêtre') + '</b></p>' +
      '<p class="muted small">L\'adresse ne contient que le symbole et l\'unité de temps (' + esc(G.libelleIntervalle(iv)) + '). ' +
      'Aucune donnée du journal — date, prix, montant, note — ne part avec le lien.</p></div></div>';

    var lignes = symboles.map(function (sym) {
      var perso = (g.symboles || {})[sym];
      var defaut = G.symboleTV(sym, { graphique: { symboles: {} } });
      return '<label class="tv-ligne"><span class="tv-inst">' + esc(sym) + '</span>' +
        '<input class="input" name="tv:' + attr(sym) + '" value="' + attr(perso || '') + '" placeholder="' + attr(defaut) + '" spellcheck="false">' +
        (perso ? '<em class="tv-perso" title="Correction enregistrée">corrigé</em>' : '') + '</label>';
    }).join('');

    var formHTML = '<form id="tvForm" class="notif-form">' +
      '<label class="case"><input type="checkbox" name="tvActif"' + (actif ? ' checked' : '') + '>' +
      '<span><b>Afficher le bouton « Graphique »</b><em>Dans le journal (chaque trade) et dans l\'en-tête de la liste</em></span></label>' +
      '<div class="form-field wide"><label>Unité de temps à l\'ouverture</label>' +
      UI.selectHTML('tvIntervalle', G.INTERVALLES.map(function (x) { return { value: x.id, label: x.label }; }), iv) +
      '<span class="field-hint">Celle que vous utilisez pour décider. Vous pouvez la changer à tout moment.</span></div>' +
      (symboles.length
        ? '<div class="form-field wide"><label>Symbole TradingView de chaque instrument</label>' +
          '<div class="tv-liste">' + lignes + '</div>' +
          '<span class="field-hint">Les valeurs grisées sont les symboles par défaut. Votre courtier n\'a peut-être pas les mêmes références : ' +
          'écrivez les vôtres (exemple <code>CAPITALCOM:US30</code>, <code>OANDA:XAUUSD</code>, <code>FX:EURUSD</code>). Videz un champ pour revenir au défaut.</span></div>'
        : '<p class="muted small">Ajoutez d\'abord des instruments suivis, un peu plus haut : chaque instrument aura sa ligne de correspondance.</p>') +
      '<div class="form-actions"><button class="btn primary" type="submit">Enregistrer le graphique</button>' +
      '<button class="btn ghost" type="button" id="tvEssai">' + UI.icon('link') + ' Tester l\'ouverture</button>' +
      '<span class="muted small">Rien n\'est chargé par l\'application : le lien ne s\'ouvre qu\'à votre appui.</span></div>' +
      '</form>';

    var limites = '<p class="muted small">Le graphique s\'ouvre <b>à côté</b> de l\'application : sur Android, applications récentes → icône de ' +
      'l\'application → <i>Ouvrir en affichage fractionné</i>. Si l\'application TradingView refuse l\'écran partagé, passez par le navigateur ' +
      '(tradingview.com), qui l\'accepte. <b>Vos tracés restent dans votre compte</b> : l\'application ne peut pas les lire ni les afficher, et ne ' +
      'les remplace pas — elle vous emmène simplement au bon endroit.</p>';

    return App.card('Graphique TradingView (lien externe)',
      etatHTML + formHTML + limites, { tools: pastille, class: 'tv-card' });
  }

  function brancherGraphique(App) {
    var G = global.Graphe;
    var form = $('#tvForm');
    if (!G || !form) return;

    function enregistrer() {
      var s = App.state.settings;
      var prec = Object.assign({ actif: true, intervalle: G.INTERVALLE_DEFAUT, symboles: {} }, s.graphique || {});
      var symboles = {};
      (s.symbols || []).forEach(function (sym) {
        var champ = form.elements['tv:' + sym];
        var val = champ ? String(champ.value || '').trim() : '';
        if (val) symboles[sym] = val;
      });
      s.graphique = {
        actif: !!(form.elements.tvActif && form.elements.tvActif.checked),
        intervalle: (form.elements.tvIntervalle && form.elements.tvIntervalle.value) || prec.intervalle,
        symboles: symboles
      };
      App.persist();
      App.render();
      UI.toast(s.graphique.actif ? 'Graphique enregistré.' : 'Bouton graphique masqué.', s.graphique.actif ? 'success' : '');
    }

    form.addEventListener('submit', function (ev) { ev.preventDefault(); enregistrer(); });

    var essai = $('#tvEssai');
    if (essai) essai.addEventListener('click', function () {
      var s = App.state.settings;
      // on teste sur l'instrument le plus utilisé du journal, sinon le premier suivi
      var principal = G.instrumentPrincipal(App.state.trades, s);
      // une correction en cours de saisie doit compter tout de suite, sans enregistrer
      var provisoire = Object.assign({}, s, { graphique: Object.assign({}, s.graphique, { symboles: symbolesSaisis(form, s) }) });
      var u = G.ouvrir(principal, provisoire);
      if (u) UI.toast('Ouverture de ' + principal + ' sur TradingView (' + G.libelleIntervalle(G.intervalleDe(provisoire)) + ').', 'info', 6000);
    });
  }

  /** Les symboles actuellement écrits dans le formulaire (sans enregistrer). */
  function symbolesSaisis(form, settings) {
    var out = {};
    (settings.symbols || []).forEach(function (sym) {
      var champ = form && form.elements['tv:' + sym];
      var val = champ ? String(champ.value || '').trim() : '';
      if (val) out[sym] = val;
    });
    return out;
  }

  /* ---------------------------------------------------------
     Rappels du plan — notifications de la tablette
     --------------------------------------------------------- */
  var JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  function carteRappels(App) {
    if (!global.Notify) return '';
    var N = global.Notify;
    var brut = (App.state.settings && App.state.settings.notifications) || {};
    var r = N.reglages(brut);
    var e = N.etat();

    var pastille = '<span class="badge ' + (e.prets && r.actif ? 'ok' : e.prets ? 'flat' : (e.support ? 'warn' : 'ko')) + '">' +
      (e.prets && r.actif ? 'Actifs' : e.prets ? 'Autorisés, éteints' : e.support ? 'À autoriser' : 'Indisponibles') + '</span>';

    /* --- état de l'appareil --- */
    var etatHTML = '<div class="notif-etat ' + (e.prets ? 'ok' : 'warn') + '">' +
      '<span class="notif-ico">' + UI.icon(e.prets && r.actif ? 'cloche' : 'clocheOff') + '</span>' +
      '<div><p><b>' + esc(nomEtat(e, r)) + '</b></p><p class="muted small">' + esc(e.raison) + '</p></div></div>';

    /* --- prochains rappels --- */
    var suite = prochainsRappels(N, r);
    var listeHTML = suite.length
      ? '<ul class="rappels-liste">' + suite.map(function (ev) {
          var jourEv = N.jourMali(ev.at), jourAuj = N.jourMali();
        var jourTxt = jourEv.cle === jourAuj.cle ? ''
          : (jourEv.cle === N.jourSuivant(jourAuj).cle ? 'demain' : JOURS_COURTS[jourEv.jourSemaine] + ' ' + jourEv.jour + '/' + (jourEv.mois + 1));
        return '<li><time>' + esc(N.heureAppareil(ev.at)) + '</time><span>' + esc(ev.titre) + '</span>' +
          (jourTxt ? '<i class="jour">' + esc(jourTxt) + '</i>' : '') +
          (N.decalageAppareil(ev.at) === 0 ? '' : '<em>' + esc(N.heureMali(ev.at)) + ' Mali</em>') + '</li>';
        }).join('') + '</ul>'
      : '<p class="muted small">Aucun rappel programmé pour aujourd\'hui : choisissez vos fenêtres ci-dessous.</p>';

    /* --- formulaire --- */
    var casesFenetres = N.fenetres().map(function (f) {
      var coche = r.fenetres.indexOf(f.id) > -1;
      return '<label class="case"><input type="checkbox" name="fenetres" value="' + attr(f.id) + '"' + (coche ? ' checked' : '') + '>' +
        '<span><b>' + esc(f.nom) + '</b><em>' + esc(f.debut + ' – ' + f.fin + ' (Mali)') + '</em></span></label>';
    }).join('');

    var formHTML = '<form id="notifForm" class="notif-form">' +
      '<div class="form-field wide"><label>Fenêtres de tir du plan suivies</label>' +
      '<div class="case-liste">' + casesFenetres + '</div>' +
      '<span class="field-hint">Heures du plan SMV, en heure de Bamako.</span></div>' +

      '<div class="form-field"><label>Prévenir avant l\'ouverture</label>' +
      '<select class="input" name="avance">' + N.AVANCES.map(function (m) {
        return '<option value="' + m + '"' + (m === r.avance ? ' selected' : '') + '>' + (m === 0 ? 'Ne pas prévenir' : 'Oui, ' + m + ' min avant') + '</option>';
      }).join('') + '</select></div>' +

      '<div class="form-field"><label>Revue hebdomadaire (dimanche)</label>' +
      '<div class="notif-ligne">' +
      '<label class="case compact"><input type="checkbox" name="revue"' + (r.revue ? ' checked' : '') + '><span><b>Activer</b></span></label>' +
      '<input class="input input-sm" type="time" name="revueHeure" value="' + attr(r.revueHeure) + '">' +
      '</div></div>' +

      '<div class="form-field wide"><label>Alertes</label><div class="case-liste">' +
      '<label class="case"><input type="checkbox" name="ouverture"' + (r.ouverture ? ' checked' : '') + '>' +
      '<span><b>À l\'ouverture</b><em>La fenêtre s\'ouvre : cherchez la prise de liquidité</em></span></label>' +
      '<label class="case"><input type="checkbox" name="cloture"' + (r.cloture ? ' checked' : '') + '>' +
      '<span><b>À la fermeture</b><em>Rappel de noter les trades dans le journal</em></span></label>' +
      '</div></div>' +

      '<div class="form-actions">' +
      '<label class="case compact actif"><input type="checkbox" name="actif"' + (r.actif ? ' checked' : '') + '><span><b>Rappels activés</b></span></label>' +
      '<button class="btn primary" type="submit">Enregistrer</button>' +
      '<button class="btn ghost" type="button" id="notifEssai">Envoyer un essai</button>' +
      (e.permission === 'default' && e.support
        ? '<button class="btn" type="button" id="notifAutoriser">Autoriser les notifications</button>'
        : '') +
      '</div></form>';

    var limites = '<p class="muted small notif-note">Les rappels partent de la tablette elle-même : rien ne sort de l\'appareil. ' +
      'Ils fonctionnent quand l\'application est ouverte, y compris en arrière-plan ; application fermée, la tablette ne peut pas les déclencher seule — ' +
      'les rappels manqués vous sont alors signalés à la réouverture. ' +
      (e.apple && !e.installe ? 'Sur iPhone et iPad : installez d\'abord l\'application (Safari → Partager → Sur l\'écran d\'accueil).' : '') + '</p>';

    var rearm = '<p class="small"><button class="btn ghost" type="button" id="notifRearmer">Réarmer les rappels du jour</button></p>';

    return App.card('Rappels du plan (notifications de la tablette)',
      etatHTML + listeHTML + formHTML + rearm + limites, { tools: pastille, class: 'notif-card' });
  }

  function nomEtat(e, r) {
    if (!e.support) return e.apple && !e.installe ? 'Notifications indisponibles : application non installée' : 'Notifications indisponibles sur ce navigateur';
    if (!e.securise) return 'Notifications indisponibles en http://';
    if (e.permission === 'denied') return 'Notifications refusées';
    if (e.permission === 'default') return 'Autorisation à donner';
    return r.actif ? 'Rappels actifs' : 'Autorisation accordée, rappels éteints';
  }

  /** Les prochains rappels (huit jours d'avance au maximum), pour l'aperçu. */
  function prochainsRappels(N, r) {
    var actifs = Object.assign({}, r, { actif: true });
    var t = Date.now(), jour = N.jourMali();
    var liste = [];
    for (var i = 0; i < 8 && liste.length < 4; i++) {
      liste = liste.concat(N.evenementsDuJour(jour, actifs).filter(function (ev) { return ev.at > t; }));
      if (liste.length >= 4) break;
      jour = N.jourSuivant(jour);
    }
    return liste.slice(0, 4);
  }

  /* --- câblage des boutons de la carte --- */
  function brancherRappels(App) {
    var N = global.Notify;
    if (!N) return;
    var form = $('#notifForm');
    var autoriser = $('#notifAutoriser');
    var essai = $('#notifEssai');
    var rearm = $('#notifRearmer');

    function enregistrer(extra) {
      var s = App.state.settings;
      var f = form;
      function cochee(n) { return !!(f && f.elements[n] && f.elements[n].checked); }
      function fenetresCochees() {
        if (!f) return N.DEFAUT.fenetres.slice();
        return Array.prototype.slice.call(f.querySelectorAll('input[name="fenetres"]'))
          .filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      }
      var choix = Object.assign({
        actif: cochee('actif'),
        fenetres: fenetresCochees(),
        avance: Store.num(f && f.elements.avance ? f.elements.avance.value : '') || 0,
        preparation: true,
        ouverture: cochee('ouverture'),
        cloture: cochee('cloture'),
        revue: cochee('revue'),
        revueHeure: (f && f.elements.revueHeure && f.elements.revueHeure.value) || N.DEFAUT.revueHeure
      }, extra || {});
      s.notifications = choix;
      UI.toast(choix.actif ? 'Rappels enregistrés.' : 'Rappels éteints.', choix.actif ? 'success' : '', 5000);
      App.persist();
      N.rafraichir();
      App.render();
    }

    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!N.etat().prets) {
          // Sans autorisation, activer ne servirait à rien : on explique au lieu de faire semblant
          enregistrer({ actif: false });
          UI.toast(N.etat().raison, 'warn', 8000);
          return;
        }
        enregistrer();
      });
    }
    if (autoriser) {
      autoriser.addEventListener('click', function () {
        N.demander().then(function (rep) {
          if (rep === 'granted') {
            enregistrer({ actif: true });
            UI.toast('Notifications autorisées : les rappels du plan sont actifs.', 'success', 6000);
          } else if (rep === 'denied') {
            UI.toast('Notifications refusées. Vous pouvez les réautoriser dans les réglages de la tablette.', 'warn', 8000);
            App.render();
          } else {
            UI.toast(N.etat().raison, 'warn', 8000);
            App.render();
          }
        });
      });
    }
    if (essai) {
      essai.addEventListener('click', function () {
        if (!N.etat().prets) { UI.toast(N.etat().raison, 'warn', 8000); return; }
        N.tester();
        UI.toast('Essai envoyé : cherchez la notification de la tablette.', 'success', 6000);
      });
    }
    if (rearm) {
      rearm.addEventListener('click', function () {
        N.oublier();
        N.rafraichir();
        UI.toast('Rappels du jour réarmés.', 'success', 5000);
      });
    }
  }

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

    html += carteNuage(App);
    html += carteSecurite(App);
    html += carteGraphique(App);
    html += carteRappels(App);

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
      if (global.Notify) global.Notify.rafraichir();
      App.render();
      UI.toast('Paramètres enregistrés.');
    });

    brancherRappels(App);
    brancherGraphique(App);

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

    cableNuage(App);
    cableSecurite(App);
  }

  /* ---------- actions de la carte « Sauvegarde cloud » ---------- */
  function cableNuage(App) {
    var S = global.Sync;
    if (!S) return;

    function resultat(html, ton) {
      var el = document.getElementById('cfResult');
      if (!el) return;
      el.hidden = false;
      el.className = 'cloud-result ' + (ton || '');
      el.innerHTML = html;
    }
    function message(r, contexte) {
      if (r && r.ok) return contexte + ' : OK';
      if (r && r.conflict) return 'Le cloud a été modifié sur un autre appareil : utilisez « Récupérer du cloud » ou « Fusionner les deux »';
      var e = (r && r.error) || {};
      return contexte + ' impossible — ' + (e.message || 'erreur inconnue');
    }

    var test = document.getElementById('cfTest');
    if (test) test.addEventListener('click', function () {
      var owner = document.getElementById('cfOwner'), repo = document.getElementById('cfRepo');
      if (owner && repo) {
        S.saveConfig({
          owner: owner.value, repo: repo.value,
          branch: (document.getElementById('cfBranch') || {}).value,
          path: (document.getElementById('cfPath') || {}).value,
          token: (document.getElementById('cfToken') || {}).value
        });
      }
      resultat('Test en cours…', '');
      S.tester().then(function (r) {
        if (!r.ok) { resultat(esc(message(r, 'Connexion')), 'ko'); App.render(); return; }
        var avert = r.prive ? '' : '<br><b class="warn-txt">Attention : ce dépôt est public.</b> Votre journal sera lisible par tout le monde — préférez un dépôt privé dédié.';
        resultat('<b>Connexion réussie</b> — ' + esc(r.depose) + (r.pousse === false ? ' <b class="warn-txt">(le jeton n\'a pas le droit d\'écriture : Contents → Read and write)</b>' : '') +
          (r.existe ? '<br>Sauvegarde trouvée : ' + r.trades + ' trade' + (r.trades > 1 ? 's' : '') + ' du ' + esc(S.dateCourte(r.updatedAt) || '?') + '.'
                    : '<br>Aucune sauvegarde encore : le premier envoi la créera.') + avert,
          r.prive && r.pousse !== false ? 'ok' : 'warn');
        App.render();
      });
    });

    var enregistrer = document.getElementById('cfSave');
    if (enregistrer) enregistrer.addEventListener('click', function () {
      var cfg = S.saveConfig({
        owner: document.getElementById('cfOwner').value,
        repo: document.getElementById('cfRepo').value,
        branch: document.getElementById('cfBranch').value,
        path: document.getElementById('cfPath').value,
        token: document.getElementById('cfToken').value,
        enabled: true
      });
      if (!cfg.enabled) { resultat('Renseignez le propriétaire, le dépôt et le jeton.', 'ko'); return; }
      resultat('Connexion en cours…', '');
      S.tester().then(function (r) {
        if (!r.ok) {
          resultat(esc(message(r, 'Connexion')), 'ko');
          S.saveConfig({ enabled: false });
          App.render();
          return;
        }
        if (r.existe) {
          UI.toast('Sauvegarde cloud activée.', 'success');
          App.render();
        } else {
          S.pousser({ force: true }).then(function (p) {
            resultat(p.ok ? '<b>Première sauvegarde envoyée.</b>' : esc(message(p, 'Envoi')), p.ok ? 'ok' : 'ko');
            App.render();
          });
        }
      });
    });

    var sync = document.getElementById('cfSync');
    if (sync) sync.addEventListener('click', function () {
      resultat('Synchronisation…', '');
      S.syncNow().then(function (r) {
        var ton = r.ok ? 'ok' : (r.conflict ? 'warn' : 'ko');
        resultat(r.ok ? '<b>À jour.</b> ' + App.state.trades.filter(function (t) { return !t.demo; }).length + ' trades sauvegardés.' : esc(message(r, 'Synchronisation')), ton);
        App.render();
      });
    });

    var pull = document.getElementById('cfPull');
    if (pull) pull.addEventListener('click', function () {
      UI.confirmDialog({
        title: 'Récupérer la sauvegarde du cloud ?',
        message: 'Les données de cet appareil seront remplacées par la sauvegarde distante.',
        confirmLabel: 'Récupérer', danger: true
      }).then(function (ok) {
        if (!ok) return;
        S.tirer().then(function (r) {
          if (r.ok) UI.toast('Sauvegarde récupérée.', 'success');
          else UI.toast(r.vide ? 'Aucune sauvegarde dans le cloud.' : message(r, 'Récupération'), r.vide ? 'warn' : 'error', 6000);
          App.render();
        });
      });
    });

    var auto = document.getElementById('cfAuto');
    if (auto) auto.addEventListener('change', function () {
      S.saveConfig({ autoSync: auto.checked });
      if (auto.checked) S.markDirty();
      UI.toast(auto.checked ? 'Sauvegarde automatique activée.' : 'Sauvegarde automatique désactivée : utilisez le bouton de synchronisation.');
    });

    var off = document.getElementById('cfOff');
    if (off) off.addEventListener('click', function () {
      UI.confirmDialog({
        title: 'Désactiver la sauvegarde cloud ?',
        message: 'Le dépôt et le jeton seront oubliés sur cet appareil. Les données locales ne sont pas touchées.',
        confirmLabel: 'Désactiver', danger: true
      }).then(function (ok) { if (ok) { S.clearConfig(); UI.toast('Sauvegarde cloud désactivée.'); App.render(); } });
    });

    [['cfMerge', 'fusion'], ['cfMine', 'local'], ['cfTheirs', 'distant']].forEach(function (paire) {
      var b = document.getElementById(paire[0]);
      if (!b) return;
      b.addEventListener('click', function () {
        resultat('Résolution du conflit…', '');
        S.resoudre(paire[1]).then(function (r) {
          resultat(r.ok ? '<b>Conflit résolu.</b> ' + App.state.trades.length + ' trades.' : esc(message(r, 'Résolution')), r.ok ? 'ok' : 'ko');
          App.render();
        });
      });
    });
  }

  function field(label, control, hint, cls) {
    return '<div class="form-field ' + (cls || '') + '"><label>' + esc(label) + '</label>' + control +
      (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') + '</div>';
  }

  global.Views = { calendrier: calendrier, analyses: analyses, plan: plan, params: params };
})(typeof window !== 'undefined' ? window : globalThis);
