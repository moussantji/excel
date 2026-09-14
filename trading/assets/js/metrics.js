/* =========================================================
   metrics.js — Moteur de statistiques et de performance
   Entrées : liste de trades + paramètres. Sortie : modèle
   prêt à afficher (KPI, courbes, agrégats, garde-fous).
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- petits helpers numériques ---------- */
  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function round3(v) { return Math.round((v + Number.EPSILON) * 1000) / 1000; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : 0; }
  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  function safeDiv(a, b) { return b ? a / b : 0; }
  function byDateAsc(a, b) {
    var d = String(a.date).localeCompare(String(b.date));
    if (d !== 0) return d;
    return String(a.time || '').localeCompare(String(b.time || '')) || String(a.id).localeCompare(String(b.id));
  }

  /* ---------- statistiques d'un ensemble de trades ---------- */
  function statsOf(trades) {
    var withResult = trades.filter(function (t) { return t.hasResult; });
    var wins = withResult.filter(function (t) { return t.netPnl > 0; });
    var losses = withResult.filter(function (t) { return t.netPnl < 0; });
    var flat = withResult.filter(function (t) { return t.netPnl === 0; });
    var rs = withResult.filter(function (t) { return t.rMultiple !== null && t.rMultiple !== undefined; })
      .map(function (t) { return t.rMultiple; });
    var winR = wins.map(function (t) { return t.rMultiple; }).filter(function (r) { return r !== null; });
    var lossR = losses.map(function (t) { return t.rMultiple; }).filter(function (r) { return r !== null; });
    var grossProfit = sum(wins.map(function (t) { return t.netPnl; }));
    var grossLoss = Math.abs(sum(losses.map(function (t) { return t.netPnl; })));
    var net = round2(sum(withResult.map(function (t) { return t.netPnl; })));
    var risks = withResult.map(function (t) { return t.riskAmount || 0; }).filter(function (r) { return r > 0; });

    return {
      count: trades.length,
      closed: withResult.length,
      open: trades.length - withResult.length,
      wins: wins.length,
      losses: losses.length,
      flat: flat.length,
      winRate: withResult.length ? round2(wins.length / withResult.length * 100) : 0,
      net: net,
      grossProfit: round2(grossProfit),
      grossLoss: round2(grossLoss),
      profitFactor: grossLoss > 0 ? round2(grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 0),
      avgWin: wins.length ? round2(grossProfit / wins.length) : 0,
      avgLoss: losses.length ? round2(-grossLoss / losses.length) : 0,
      payoff: losses.length && wins.length ? round2((grossProfit / wins.length) / (grossLoss / losses.length)) : null,
      bestTrade: withResult.length ? round2(Math.max.apply(null, withResult.map(function (t) { return t.netPnl; }))) : 0,
      worstTrade: withResult.length ? round2(Math.min.apply(null, withResult.map(function (t) { return t.netPnl; }))) : 0,
      rCount: rs.length,
      sumR: round2(sum(rs)),
      avgR: rs.length ? round2(mean(rs)) : null,
      expectancyR: rs.length ? round3(mean(rs)) : null,
      sdR: rs.length > 1 ? round3(sd(rs)) : null,
      sharpeR: rs.length > 1 && sd(rs) > 0 ? round2(mean(rs) / sd(rs)) : null,
      sqn: rs.length > 5 && sd(rs) > 0 ? round2(Math.sqrt(rs.length) * mean(rs) / sd(rs)) : null,
      avgWinR: winR.length ? round2(mean(winR)) : null,
      avgLossR: lossR.length ? round2(mean(lossR)) : null,
      bestR: rs.length ? round2(Math.max.apply(null, rs)) : null,
      worstR: rs.length ? round2(Math.min.apply(null, rs)) : null,
      avgRisk: risks.length ? round2(mean(risks)) : 0,
      totalRisk: round2(sum(risks)),
      expectancyMoney: withResult.length ? round2(net / withResult.length) : 0,
      avgDuration: (function () {
        var d = withResult.map(function (t) { return t.durationMin; }).filter(function (v) { return v > 0; });
        return d.length ? Math.round(mean(d)) : null;
      })()
    };
  }

  /* ---------- regroupements ---------- */
  function groupStats(trades, keyFn, unknownLabel) {
    var map = {};
    trades.forEach(function (t) {
      var k = keyFn(t);
      if (k === null || k === undefined || k === '') k = unknownLabel || 'Non renseigné';
      (map[k] = map[k] || []).push(t);
    });
    return Object.keys(map).map(function (k) {
      var s = statsOf(map[k]);
      s.key = k;
      s.trades = map[k];
      return s;
    });
  }

  /* ---------- filtres ---------- */
  function applyFilters(trades, f) {
    f = f || {};
    return trades.filter(function (t) {
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.symbols && f.symbols.length && f.symbols.indexOf(t.symbol) === -1) return false;
      if (f.setups && f.setups.length && f.setups.indexOf(t.setup) === -1) return false;
      if (f.sessions && f.sessions.length && f.sessions.indexOf(t.session) === -1) return false;
      if (f.directions && f.directions.length && f.directions.indexOf(t.direction) === -1) return false;
      if (f.planStatus && f.planStatus.length && f.planStatus.indexOf(t.planFollowed) === -1) return false;
      if (f.mistakes && f.mistakes.length && f.mistakes.indexOf(t.mistake) === -1) return false;
      if (f.search) {
        var q = String(f.search).toLowerCase();
        var hay = [t.symbol, t.setup, t.session, t.notes, t.emotion, t.mistake, t.date].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function activeFilterCount(f) {
    if (!f) return 0;
    var n = 0;
    if (f.from || f.to) n++;
    ['symbols', 'setups', 'sessions', 'directions', 'planStatus', 'mistakes'].forEach(function (k) {
      if (f[k] && f[k].length) n++;
    });
    if (f.search) n++;
    return n;
  }

  /* ---------- distribution des multiples de R ---------- */
  var R_EDGES = [-Infinity, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5, Infinity];
  function rBucketLabel(lo, hi) {
    var f = function (v) { return String(v).replace('.', ','); };
    if (lo === -Infinity) return '≤ ' + f(hi) + 'R';
    if (hi === Infinity) return '> ' + f(lo) + 'R';
    if (hi === 0) return f(lo) + ' à 0R';
    if (lo === 0) return '0 à ' + f(hi) + 'R';
    return (lo >= 0 ? '+' : '') + f(lo) + ' à ' + (hi > 0 ? '+' : '') + f(hi) + 'R';
  }
  function rDistribution(trades) {
    var rs = trades.map(function (t) { return t.rMultiple; }).filter(function (r) { return r !== null && r !== undefined; });
    var out = [];
    for (var i = 0; i < R_EDGES.length - 1; i++) {
      var lo = R_EDGES[i], hi = R_EDGES[i + 1];
      var n = rs.filter(function (r) { return r > lo && r <= hi; }).length;
      out.push({ lo: lo, hi: hi, label: rBucketLabel(lo, hi), count: n, mid: (lo === -Infinity ? hi - 1 : hi === Infinity ? lo + 1 : (lo + hi) / 2) });
    }
    return out;
  }

  /* ---------- séries de séries ---------- */
  function dailySeries(results) {
    var map = {};
    results.forEach(function (t) {
      var k = t.date;
      var d = map[k] || (map[k] = { date: k, net: 0, r: 0, count: 0, wins: 0, losses: 0, hasR: 0 });
      d.net += t.netPnl;
      if (t.rMultiple !== null && t.rMultiple !== undefined) { d.r += t.rMultiple; d.hasR++; }
      d.count++;
      if (t.netPnl > 0) d.wins++; else if (t.netPnl < 0) d.losses++;
    });
    return Object.keys(map).sort().map(function (k) {
      var d = map[k];
      d.net = round2(d.net);
      d.r = round2(d.r);
      return d;
    });
  }

  function periodSeries(results, keyFn, labelFn) {
    var map = {};
    results.forEach(function (t) {
      var k = keyFn(t);
      (map[k] = map[k] || []).push(t);
    });
    return Object.keys(map).sort().map(function (k) {
      var s = statsOf(map[k]);
      s.key = k;
      s.label = labelFn ? labelFn(k) : k;
      return s;
    });
  }

  /* ---------- séries consécutives ---------- */
  function streaks(results) {
    var maxWin = 0, maxLoss = 0, cw = 0, cl = 0, cur = 0, curType = null;
    results.forEach(function (t) {
      if (t.netPnl > 0) {
        cw++; cl = 0;
        if (cw > maxWin) maxWin = cw;
        if (curType !== 'win') { curType = 'win'; cur = 1; } else cur++;
      } else if (t.netPnl < 0) {
        cl++; cw = 0;
        if (cl > maxLoss) maxLoss = cl;
        if (curType !== 'loss') { curType = 'loss'; cur = 1; } else cur++;
      }
    });
    return { maxWin: maxWin, maxLoss: maxLoss, current: cur, currentType: curType };
  }

  /* ---------- objectifs & garde-fous ---------- */
  function goals(trades, settings, today) {
    var monthK = String(today).slice(0, 7);
    var monthTrades = trades.filter(function (t) { return t.hasResult && String(t.date).slice(0, 7) === monthK; });
    var monthNet = round2(sum(monthTrades.map(function (t) { return t.netPnl; })));
    var todayTrades = trades.filter(function (t) { return t.hasResult && t.date === today; });
    var todayNet = round2(sum(todayTrades.map(function (t) { return t.netPnl; })));
    var todayLossPct = settings.startingCapital > 0 ? round2(-todayNet / settings.startingCapital * 100) : 0;
    var cap = settings.startingCapital || 1;
    var weekStart = (function () {
      var d = new Date(today + 'T12:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })();
    var weekNet = round2(sum(trades.filter(function (t) { return t.hasResult && t.date >= weekStart; }).map(function (t) { return t.netPnl; })));
    return {
      today: today,
      todayNet: todayNet,
      todayCount: todayTrades.length,
      todayLimits: {
        tradesReached: todayTrades.length >= settings.maxTradesPerDay,
        tradesLeft: Math.max(0, settings.maxTradesPerDay - todayTrades.length),
        lossReached: todayNet < 0 && -todayNet >= cap * settings.maxDailyLossPct / 100,
        lossUsedPct: todayLossPct,
        lossLimitPct: settings.maxDailyLossPct,
        lossLeft: round2(Math.max(0, cap * settings.maxDailyLossPct / 100 + Math.min(0, todayNet))),
        blocked: (todayTrades.length >= settings.maxTradesPerDay) || (todayNet < 0 && -todayNet >= cap * settings.maxDailyLossPct / 100)
      },
      week: { net: weekNet, lossLimit: round2(cap * settings.maxWeeklyLossPct / 100), lossReached: weekNet < 0 && -weekNet >= cap * settings.maxWeeklyLossPct / 100 },
      month: {
        key: monthK,
        net: monthNet,
        pct: round2(monthNet / cap * 100),
        targetPct: settings.targetMonthlyPct,
        targetMoney: round2(cap * settings.targetMonthlyPct / 100),
        progressPct: settings.targetMonthlyPct ? round2(Math.max(0, monthNet / (cap * settings.targetMonthlyPct / 100)) * 100) : 0,
        trades: monthTrades.length
      }
    };
  }

  /* ---------- MODÈLE PRINCIPAL ---------- */
  /**
   * @param {Array}  allTrades  trades normalisés (tout l'historique)
   * @param {Object} settings   paramètres du compte
   * @param {Object} filters    filtres d'affichage (période, instrument…)
   * @param {String} today      date du jour (AAAA-MM-JJ)
   */
  function build(allTrades, settings, filters, today) {
    settings = settings || {};
    today = today || new Date().toISOString().slice(0, 10);
    var cap = settings.startingCapital || 0;

    // 1. Courbe d'équité sur TOUT l'historique (pour situer la période filtrée)
    var all = allTrades.slice().sort(byDateAsc);
    var equity = cap, peak = cap, maxDD = 0, maxDDPct = 0;
    var full = [];
    all.forEach(function (t, i) {
      if (t.hasResult) equity = round2(equity + t.netPnl);
      peak = Math.max(peak, equity);
      var dd = round2(equity - peak);
      var ddPct = peak > 0 ? round2(dd / peak * 100) : 0;
      maxDD = Math.min(maxDD, dd);
      maxDDPct = Math.min(maxDDPct, ddPct);
      full.push({ i: i, trade: t, equity: equity, peak: round2(peak), dd: dd, ddPct: ddPct });
    });

    // 2. Filtrage
    var trades = applyFilters(all, filters);
    var results = trades.filter(function (t) { return t.hasResult; });

    // 3. Points de la courbe sur la période filtrée (on démarre à l'équité d'avant période)
    var from = filters && filters.from, to = filters && filters.to;
    var startEquity = cap, startPoint = { label: 'Départ', equity: round2(cap), date: null };
    if (from) {
      for (var i = 0; i < full.length; i++) {
        if (full[i].trade.date < from) { startEquity = full[i].equity; startPoint.date = full[i].trade.date; }
        else break;
      }
      startPoint.equity = round2(startEquity);
      startPoint.label = 'Avant période';
    }
    var curve = [startPoint];
    var runEq = startEquity, runPeak = startEquity, winDD = 0, winDDPct = 0;
    results.forEach(function (t) {
      runEq = round2(runEq + t.netPnl);
      runPeak = Math.max(runPeak, runEq);
      var dd = round2(runEq - runPeak);
      var ddPct = runPeak > 0 ? round2(dd / runPeak * 100) : 0;
      winDD = Math.min(winDD, dd);
      winDDPct = Math.min(winDDPct, ddPct);
      curve.push({
        trade: t, date: t.date, time: t.time, equity: runEq, peak: round2(runPeak),
        dd: dd, ddPct: ddPct, net: t.netPnl, r: t.rMultiple, symbol: t.symbol
      });
    });

    var kpis = statsOf(trades);
    kpis.startEquity = round2(startEquity);
    kpis.endEquity = round2(runEq);
    kpis.periodReturnPct = startEquity > 0 ? round2((runEq - startEquity) / startEquity * 100) : 0;
    kpis.maxDD = round2(winDD);
    kpis.maxDDPct = round2(winDDPct);
    kpis.currentDD = round2(runEq - runPeak);
    kpis.currentDDPct = runPeak > 0 ? round2((runEq - runPeak) / runPeak * 100) : 0;
    kpis.maxDDOverall = round2(maxDD);
    kpis.maxDDOverallPct = round2(maxDDPct);
    kpis.totalReturnPct = cap > 0 ? round2((equity - cap) / cap * 100) : 0;
    kpis.equityTotal = round2(equity);
    kpis.planRespectPct = results.length
      ? round2(results.filter(function (t) { return t.planFollowed === 'oui'; }).length / results.length * 100) : null;

    // 4. Agrégats
    var daily = dailySeries(results);
    var dailyMap = {};
    daily.forEach(function (d) { dailyMap[d.date] = d; });

    var model = {
      today: today,
      settings: settings,
      filters: filters || {},
      filterCount: activeFilterCount(filters),
      trades: trades,
      results: results,
      kpis: kpis,
      curve: curve,
      daily: daily,
      dailyMap: dailyMap,
      months: periodSeries(results, function (t) { return String(t.date).slice(0, 7); }, function (k) {
        var p = k.split('-'); return global.Store ? global.Store.monthLabel(k) : k;
      }),
      weeks: periodSeries(results, function (t) { return global.Store ? global.Store.isoWeekKey(t.date) : t.date; }),
      bySetup: groupStats(results, function (t) { return t.setup; }, 'Sans setup'),
      bySymbol: groupStats(results, function (t) { return t.symbol; }, 'Sans instrument'),
      bySession: groupStats(results, function (t) { return t.session; }, 'Hors session'),
      byDirection: groupStats(results, function (t) { return t.direction === 'short' ? 'Short' : 'Long'; }),
      byDow: groupStats(results, function (t) { return (global.Store ? global.Store.DOW_FR_SHORT[global.Store.dowIndex(t.date)] : String(new Date(t.date + 'T12:00:00').getDay())); }),
      byHour: groupStats(results, function (t) { return t.time ? t.time.slice(0, 2) + 'h' : 'Heure ?'; }),
      byPlan: groupStats(results, function (t) {
        return t.planFollowed === 'oui' ? 'Plan respecté' : t.planFollowed === 'partiel' ? 'Partiellement' : t.planFollowed === 'non' ? 'Plan non respecté' : 'Non renseigné';
      }),
      byEmotion: groupStats(results, function (t) { return t.emotion; }, 'Non renseignée'),
      byMistake: groupStats(results, function (t) { return t.mistake || 'Non renseignée'; }, 'Non renseignée'),
      rDistribution: rDistribution(results),
      streaks: streaks(results),
      goals: goals(all, settings, today)
    };

    // 5. Classements triés pour l'affichage
    model.byDow.sort(function (a, b) {
      var o = global.Store ? global.Store.DOW_FR_SHORT : [];
      return o.indexOf(a.key) - o.indexOf(b.key);
    });
    model.byHour.sort(function (a, b) { return String(a.key).localeCompare(String(b.key)); });
    model.bySetup.sort(function (a, b) { return b.net - a.net; });
    model.bySymbol.sort(function (a, b) { return b.net - a.net; });
    model.bySession.sort(function (a, b) { return b.net - a.net; });
    model.byMistake.sort(function (a, b) { return b.count - a.count; });

    // 6. Records
    model.records = {
      bestDay: daily.slice().sort(function (a, b) { return b.net - a.net; })[0] || null,
      worstDay: daily.slice().sort(function (a, b) { return a.net - b.net; })[0] || null,
      bestMonth: model.months.slice().sort(function (a, b) { return b.net - a.net; })[0] || null,
      worstMonth: model.months.slice().sort(function (a, b) { return a.net - b.net; })[0] || null,
      bestTrade: results.slice().sort(function (a, b) { return b.netPnl - a.netPnl; })[0] || null,
      worstTrade: results.slice().sort(function (a, b) { return a.netPnl - b.netPnl; })[0] || null,
      greenDays: daily.filter(function (d) { return d.net > 0; }).length,
      redDays: daily.filter(function (d) { return d.net < 0; }).length,
      tradingDays: daily.length
    };

    // 7. Discipline : ce que coûtent les écarts au plan
    var ok = model.byPlan.filter(function (g) { return g.key === 'Plan respecté'; })[0];
    var ko = model.byPlan.filter(function (g) { return g.key === 'Plan non respecté'; })[0];
    model.discipline = {
      ok: ok || null,
      ko: ko || null,
      costPerTrade: (ok && ko && ok.expectancyMoney && ko.expectancyMoney) ? round2(ok.expectancyMoney - ko.expectancyMoney) : null,
      missedMoney: (function () {
        if (!ok || !ko) return null;
        return round2((ok.expectancyMoney - ko.expectancyMoney) * ko.closed);
      })()
    };

    return model;
  }

  var Metrics = {
    build: build,
    activeFilterCount: activeFilterCount,
    statsOf: statsOf,
    groupStats: groupStats,
    applyFilters: applyFilters,
    dailySeries: dailySeries,
    rDistribution: rDistribution,
    streaks: streaks,
    goals: goals,
    round2: round2, round3: round3, mean: mean, sd: sd, sum: sum
  };

  global.Metrics = Metrics;
  if (typeof module !== 'undefined' && module.exports) module.exports = Metrics;
})(typeof window !== 'undefined' ? window : globalThis);
