/* =========================================================
   relecture.js — Relire ses VRAIS trades et se corriger

   Principe : l'entraîneur (entraineur.js) fabrique des graphiques pour
   travailler chaque concept. Ici, c'est le marché qui a parlé : on reprend
   les trades déjà enregistrés dans le journal et on repose les questions
   du plan sur des décisions réelles.

   Deux familles de questions, volontairement séparées :

   1. VÉRIFIABLES par l'application — le plan donne un chiffre, on compare :
      stop ≤ 15 pips, ratio visé ≥ 1:7, risque ≤ 1 %, trade dans une fenêtre
      de tir, limite de trades par jour. La correction est arithmétique,
      donc incontestable.

   2. DE JUGEMENT, non notées — « la structure allait-elle dans ce sens ? »
      et « était-ce un bon trade selon le plan, indépendamment du résultat ? ».
      L'application ne peut pas lire le graphique de vos trades : elle ne
      fait pas semblant. Ces réponses sont enregistrées pour que vous voyiez
      votre propre constance d'un trade à l'autre.

   Règle de la maison, écrite à l'écran : on juge le processus, pas le
   résultat. Le résultat n'est révélé qu'APRÈS vos réponses, pour que la
   lecture ne soit pas influencée par ce qu'on sait déjà.

   Tout est local : aucune donnée ne sort, aucune ressource distante.
   ========================================================= */
'use strict';

(function (global) {
  var CLE = 'relecture';

  function vide() {
    return {
      essais: 0, questions: 0, bonnes: 0,
      jugements: { juste: 0, faux: 0, indecis: 0, bons: 0, mauvais: 0 }
    };
  }

  /* ---------------------------------------------------------
     Progression (rangée avec celle de la formation, donc chiffrée
     par le verrou et sauvegardée dans le dépôt avec le journal)
     --------------------------------------------------------- */
  function lire() {
    var checks = {};
    try { checks = (global.Plan && global.Plan.loadChecks()) || {}; } catch (e) { checks = {}; }
    var brut = checks[CLE];
    var p = vide();
    if (!brut || typeof brut !== 'object') return p;
    ['essais', 'questions', 'bonnes'].forEach(function (k) { p[k] = Number(brut[k]) || 0; });
    var j = brut.jugements || {};
    ['juste', 'faux', 'indecis', 'bons', 'mauvais'].forEach(function (k) { p.jugements[k] = Number(j[k]) || 0; });
    return p;
  }

  function ecrire(p) {
    var checks = {};
    try { checks = (global.Plan && global.Plan.loadChecks()) || {}; } catch (e) { checks = {}; }
    checks[CLE] = p;
    try { global.Plan.saveChecks(checks); } catch (e) { /* journal indisponible : on n'empêche pas la lecture */ }
    return p;
  }

  function reinitialiser() { return ecrire(vide()); }

  /* ---------------------------------------------------------
     Les trades que l'on peut relire
     --------------------------------------------------------- */
  function revisables(trades) {
    return (trades || []).filter(function (t) {
      return t && (t.hasResult || t.pnl !== null) && Number.isFinite(Number(t.entry));
    }).sort(function (a, b) {
      return String(b.date + b.time).localeCompare(String(a.date + a.time));
    });
  }

  function distancePips(t) {
    var pip = (global.Store && global.Store.pipSize) ? global.Store.pipSize(t.symbol) : 0.0001;
    var e = Number(t.entry), s = Number(t.stop);
    if (!Number.isFinite(e) || !Number.isFinite(s)) return null;
    return Math.abs(e - s) / pip;
  }

  /** La règle « 15 pips » est écrite pour les paires forex : l'or et les
      indices se mesurent en points, on ne mélange pas les deux. */
  function estForex(t) {
    var pip = (global.Store && global.Store.pipSize) ? global.Store.pipSize(t.symbol) : 0.0001;
    return pip <= 0.01;
  }

  /** Écart entrée → stop, en unités de prix (points pour l'or et les indices). */
  function distancePrix(t) {
    var e = Number(t.entry), s = Number(t.stop);
    if (!Number.isFinite(e) || !Number.isFinite(s)) return null;
    return Math.abs(e - s);
  }

  function dansFenetre(time) {
    var f = (global.Plan && global.Plan.fenetres) || [];
    if (!time) return null;
    var h = String(time).slice(0, 5);
    for (var i = 0; i < f.length; i++) {
      if (h >= f[i].debut && h <= f[i].fin) return f[i];
    }
    return false;
  }

  function tradesDuJour(trades, date) {
    return (trades || []).filter(function (x) { return x && x.date === date; }).length;
  }

  function fmtNum(v, d) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
    return Number(v).toFixed(d === undefined ? 1 : d).replace('.', ',');
  }

  /* ---------------------------------------------------------
     Les questions

     Chaque question vérifiable porte : son énoncé, deux réponses
     possibles, la vérité calculée et son explication chiffrée.
     Les questions de jugement n'ont pas de « bonne » réponse.
     --------------------------------------------------------- */
  function questionsVerifiables(t, trades, settings) {
    var qs = [];
    var reglages = settings || {};

    var dp = distancePips(t);
    if (dp !== null && estForex(t)) {
      qs.push({
        id: 'stop',
        texte: 'Ce trade respectait-il la règle du stop à 15 pips maximum ?',
        bonne: dp <= 15.05 ? 1 : 0,
        explication: 'Écart entrée → stop mesuré : ' + fmtNum(dp, 1) + ' pips. Le plan autorise 15 pips maximum, jamais élargis.'
      });
    }

    if (Number.isFinite(Number(t.plannedRR))) {
      var rr = Number(t.plannedRR);
      qs.push({
        id: 'ratio',
        texte: 'Le ratio visé atteignait-il le minimum de 1:7 ?',
        bonne: rr >= 6.95 ? 1 : 0,
        explication: 'Ratio prévu : 1:' + fmtNum(rr, 2) + '. En dessous de 1:7, le plan dit de ne pas prendre le trade — c\'est ce refus qui paie sur cent trades.'
      });
    }

    var fen = dansFenetre(t.time);
    if (fen !== null) {
      qs.push({
        id: 'fenetre',
        texte: 'Ce trade a-t-il été pris dans une fenêtre de tir du plan ?',
        bonne: fen ? 1 : 0,
        explication: fen
          ? 'Entrée à ' + String(t.time).slice(0, 5) + ' : fenêtre ' + fen.nom + ' (' + fen.debut + '–' + fen.fin + ', heure de Bamako).'
          : 'Entrée à ' + String(t.time).slice(0, 5) + ' : aucune fenêtre de tir. Le plan travaille Asie 01h–02h, Europe 08h–09h, USA 13h–14h.'
      });
    }

    var capital = Number(reglages.startingCapital) || 0;
    if (capital > 0 && Number.isFinite(Number(t.riskAmount)) && Number(t.riskAmount) > 0) {
      var pct = Number(t.riskAmount) / capital * 100;
      qs.push({
        id: 'risque',
        texte: 'Le risque engagé sur ce trade respectait-il la limite de 1 % du capital ?',
        bonne: pct <= 1.05 ? 1 : 0,
        explication: 'Risque engagé : ' + fmtNum(pct, 2) + ' % du capital. Le plan plafonne à 1 % par trade (fourchette de travail 0,25 % à 1 %)' +
          (pct > 1.05 ? ' — au-delà, un seul trade peut entamer une série.' : (pct < 0.2 ? ' — en dessous de 0,25 %, le risque ne fait pas vivre le compte.' : '.'))
      });
    }

    if (t.date) {
      var max = Number(reglages.maxTradesPerDay) || 3;
      var n = tradesDuJour(trades, t.date);
      qs.push({
        id: 'jour',
        texte: 'Ce jour-là, la limite de ' + max + ' trades maximum a-t-elle été respectée ?',
        bonne: n <= max ? 1 : 0,
        explication: n + ' trade(s) enregistré(s) le ' + t.date + ' pour une limite de ' + max + '. Au-delà de deux stop loss, la journée est terminée.'
      });
    }

    // cinq règles au maximum — ce sont celles du plan, aucune ne doit être écartée
    return qs.slice(0, 5);
  }

  /** Question de jugement posée AVANT de connaître le résultat. */
  function questionStructure() {
    return {
      id: 'structure',
      texte: 'Avant de connaître le résultat : la structure allait-elle dans le sens de votre entrée ?',
      choix: ['Oui', 'Non', 'Je ne sais pas']
    };
  }

  /** Question de jugement posée APRÈS la révélation du résultat. */
  function questionProcess() {
    return {
      id: 'process',
      texte: 'Avec le recul, était-ce un bon trade selon le plan — indépendamment du résultat ?',
      choix: ['Oui', 'Non']
    };
  }

  function questionsDuTrade(t, trades, settings) {
    return {
      verifiables: questionsVerifiables(t, trades, settings),
      structure: questionStructure(),
      process: questionProcess()
    };
  }

  /* ---------------------------------------------------------
     Rendu
     --------------------------------------------------------- */
  var etat = { trade: null, reponses: {}, jugements: {}, revele: false, index: 0 };

  function nomSens(t) { return t.direction === 'short' ? 'Vente' : 'Achat'; }

  function contexteHTML(t) {
    function ligne(label, valeur) {
      return '<div class="rel-item"><span>' + label + '</span><b>' + valeur + '</b></div>';
    }
    var dp = distancePips(t);
    var dpx = distancePrix(t);
    var ecart = dpx === null ? ''
      : (estForex(t) ? ' (' + esc(fmtNum(dp, 1)) + ' pips)' : ' (' + esc(fmtNum(dpx, 2)) + ' points)');
    return '<div class="rel-contexte">' +
      ligne('Date', esc(t.date || '—') + (t.time ? ' · ' + esc(String(t.time).slice(0, 5)) : '')) +
      ligne('Instrument', esc(t.symbol || '—') + ' · ' + esc(nomSens(t))) +
      ligne('Session', esc(t.session || '—') + (t.setup ? ' · ' + esc(t.setup) : '')) +
      ligne('Entrée', esc(fmtNum(t.entry, 5))) +
      ligne('Stop', esc(fmtNum(t.stop, 5)) + ecart) +
      ligne('Objectif', esc(fmtNum(t.target, 5))) +
      ligne('Taille', esc(fmtNum(t.size, 2)) + ' lot(s)') +
      ligne('Ratio visé', Number.isFinite(Number(t.plannedRR)) ? '1:' + esc(fmtNum(t.plannedRR, 2)) : '—') +
      '</div>';
  }

  function resultatHTML(t) {
    var r = Number(t.rMultiple);
    var classe = Number.isFinite(r) ? (r >= 0 ? 'pos' : 'neg') : '';
    return '<div class="rel-resultat ' + classe + '">' +
      '<span class="rel-r">' + (Number.isFinite(r) ? (r >= 0 ? '+' : '') + fmtNum(r, 2) + ' R' : 'résultat non calculé') + '</span>' +
      '<span class="muted small">' + (t.pnl === null ? '' : esc(global.UI ? global.UI.fmtMoneySigned(t.netPnl) : '')) +
      (t.mistake ? ' · erreur notée : ' + esc(t.mistake) : '') + '</span></div>';
  }

  function questionsHTML(t, trades, reglages, p) {
    var qs = questionsDuTrade(t, trades, reglages);
    var html = '<div class="rel-questions">';

    qs.verifiables.forEach(function (q) {
      var rep = etat.reponses[q.id];
      html += '<div class="rel-q">' +
        '<p class="rel-intitule">' + esc(q.texte) + '</p>' +
        '<div class="rel-choix">' +
        ['Non', 'Oui'].map(function (label, i) {
          var classe = 'btn ghost small';
          if (rep === undefined) classe = 'btn ghost small';
          else if (etat.revele && i === q.bonne) classe = 'btn small bon';
          else if (etat.revele && rep === i) classe = 'btn small faux';
          return '<button class="' + classe + '" data-rel="' + esc(q.id) + '" data-val="' + i + '"' +
            (rep !== undefined ? ' disabled' : '') + '>' + label + '</button>';
        }).join('') + '</div>' +
        (etat.revele ? '<p class="rel-expl ' + (rep === q.bonne ? 'ok' : 'ko') + '">' +
          (rep === q.bonne ? 'Juste. ' : 'Non : ') + esc(q.explication) + '</p>' : '') +
        '</div>';
    });

    // jugement n° 1, avant toute révélation
    var j1 = etat.jugements[qs.structure.id];
    html += '<div class="rel-q">' +
      '<p class="rel-intitule">' + esc(qs.structure.texte) + '</p>' +
      '<div class="rel-choix">' + qs.structure.choix.map(function (label, i) {
        return '<button class="btn ghost small" data-jud="' + esc(qs.structure.id) + '" data-val="' + i + '"' +
          (j1 !== undefined ? ' disabled' : '') + (j1 === i ? ' data-actif="1"' : '') + '>' + label + '</button>';
      }).join('') + '</div>' +
      '<p class="muted small">Cette réponse n\'est pas notée : elle sert à vous montrer, trade après trade, si votre lecture est constante. ' +
      'Elle n\'est pas jugée par le résultat du trade.</p>' +
      '</div>';

    // jugement n° 2, après la révélation
    if (etat.revele) {
      var j2 = etat.jugements[qs.process.id];
      html += '<div class="rel-q">' +
        '<p class="rel-intitule">' + esc(qs.process.texte) + '</p>' +
        '<div class="rel-choix">' + qs.process.choix.map(function (label, i) {
          return '<button class="btn ghost small" data-jud="' + esc(qs.process.id) + '" data-val="' + i + '"' +
            (j2 !== undefined ? ' disabled' : '') + (j2 === i ? ' data-actif="1"' : '') + '>' + label + '</button>';
        }).join('') + '</div>' +
        '<p class="muted small">Un trade conforme peut perdre, un trade hors plan peut gagner. C\'est la répétition du plan qui produit le résultat — ' +
        'c\'est pour cela que cette réponse est enregistrée séparément du score.</p>' +
        '</div>';
    }

    html += '</div>';
    return { html: html, verifiables: qs.verifiables, structure: qs.structure, process: qs.process };
  }

  function zoneHTML(App) {
    var reglages = (App && App.state && App.state.settings) || {};
    var trades = (App && App.state && App.state.trades) || [];
    var p = lire();

    if (!etat.trade) {
      var dispo = revisables(trades).length;
      if (!dispo) {
        return '<div class="rel-vide"><p><b>La relecture a besoin de vos trades.</b> Le journal ne contient encore aucun trade clôturé : ' +
          'enregistrez vos trades au fil des séances (même mal notés, même perdants), et revenez ici pour les reprendre un par un.</p>' +
          '<p class="muted small">C\'est l\'exercice le plus formateur de la méthode : relire ses propres décisions avec les règles sous les yeux.</p></div>';
      }
      return '<div class="rel-vide"><p>' + dispo + ' trade(s) clôturé(s) dans le journal, prêt(s) à être relus.</p>' +
        '<p class="muted small">Le résultat n\'est révélé qu\'après vos réponses.</p>' +
        '<button class="btn primary" id="fRelTirer">Relire un trade</button></div>';
    }

    var t = etat.trade;
    var q = questionsHTML(t, trades, reglages, p);
    var toutRepondu = q.verifiables.every(function (x) { return etat.reponses[x.id] !== undefined; });

    var html = '<div class="rel-fiche">' +
      '<div class="rel-tete"><span class="rel-nom">' + esc(t.symbol || '—') + ' · ' + esc(nomSens(t)) + '</span>' +
      '<span class="muted small">trade du ' + esc(t.date || '—') + '</span></div>' +
      contexteHTML(t) +
      (etat.revele ? resultatHTML(t) : '<p class="rel-avant">Le résultat de ce trade est masqué jusqu\'à la révélation.</p>') +
      q.html +
      '<div class="rel-actions">' +
      (etat.revele
        ? '<button class="btn primary" id="fRelTirer">Trade suivant</button>'
        : '<button class="btn primary" id="fRelReveler"' + (toutRepondu ? '' : ' disabled') +
          '>Voir le résultat et la correction</button>') +
      '<button class="btn ghost" id="fRelEspace">Expliquer l\'exercice</button>' +
      '</div>' +
      (etat.revele ? '' : '<p class="muted small">Répondez aux questions ci-dessus : le résultat reste caché tant que vous n\'avez pas conclu.</p>') +
      '</div>';

    html += '<p class="muted small">Bilan de relecture : ' + p.essais + ' trade(s) relu(s), ' + p.bonnes + ' / ' + p.questions +
      ' réponse(s) juste(s) sur les règles du plan. Jugements enregistrés : structure juste ' + p.jugements.juste +
      ', erronée ' + p.jugements.faux + ', indécise ' + p.jugements.indecis + ' · trades jugés conformes ' + p.jugements.bons +
      ', hors plan ' + p.jugements.mauvais + '.</p>';
    return html;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------------------------------------------------
     Actions
     --------------------------------------------------------- */
  function tirer(App) {
    var trades = revisables((App && App.state && App.state.trades) || []);
    if (!trades.length) { etat.trade = null; return null; }
    // on avance dans la liste : les trades les plus récents d'abord, puis on tourne
    var t = trades[etat.index % trades.length];
    etat.index++;
    etat.trade = t;
    etat.reponses = {};
    etat.jugements = {};
    etat.revele = false;
    return t;
  }

  function repondre(id, val) {
    if (etat.reponses[id] !== undefined) return false;
    etat.reponses[id] = Number(val);
    return true;
  }

  function juger(id, val) {
    if (etat.jugements[id] !== undefined) return false;
    etat.jugements[id] = Number(val);
    return true;
  }

  /** Révélation : on enregistre le bilan avant d'afficher la correction. */
  function reveler(App) {
    if (!etat.trade || etat.revele) return null;
    var reglages = (App && App.state && App.state.settings) || {};
    var trades = (App && App.state && App.state.trades) || [];
    var qs = questionsVerifiables(etat.trade, trades, reglages);
    var p = lire();
    var bonnes = 0;
    qs.forEach(function (q) {
      if (etat.reponses[q.id] === q.bonne) bonnes++;
    });
    p.essais += 1;
    p.questions += qs.length;
    p.bonnes += bonnes;
    // les jugements déjà donnés comptent (la structure est répondue avant la révélation)
    var j1 = etat.jugements.structure;
    if (j1 === 0) p.jugements.juste += 1;
    else if (j1 === 1) p.jugements.faux += 1;
    else if (j1 === 2) p.jugements.indecis += 1;
    ecrire(p);
    etat.revele = true;
    return { bonnes: bonnes, total: qs.length };
  }

  /** Jugement d'après-révélation : enregistré séparément du score. */
  function jugerProcess(val) {
    var t = etat.jugements.process;
    if (t !== undefined) return false;
    etat.jugements.process = Number(val);
    var p = lire();
    if (Number(val) === 0) p.jugements.bons += 1;
    else p.jugements.mauvais += 1;
    ecrire(p);
    return true;
  }

  /* ---------------------------------------------------------
     Câblage
     --------------------------------------------------------- */
  function cabler(host, App, redessiner) {
    host.querySelectorAll('#fRelTirer, [data-rel-tirer]').forEach(function (b) {
      b.addEventListener('click', function () {
        tirer(App);
        redessiner();
      });
    });
    host.querySelectorAll('[data-rel]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (repondre(b.dataset.rel, b.dataset.val)) redessiner();
      });
    });
    host.querySelectorAll('[data-jud]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fait = b.dataset.jud === 'process' ? jugerProcess(b.dataset.val) : juger(b.dataset.jud, b.dataset.val);
        if (fait) redessiner();
      });
    });
    var rev = host.querySelector('#fRelReveler');
    if (rev) rev.addEventListener('click', function () {
      var r = reveler(App);
      redessiner();
      if (r && global.UI) {
        global.UI.toast('Correction : ' + r.bonnes + ' / ' + r.total + ' réponse(s) juste(s) sur les règles du plan.', r.bonnes === r.total ? 'success' : '', 6000);
      }
    });
  }

  global.Relecture = {
    CLE: CLE,
    lire: lire, ecrire: ecrire, reinitialiser: reinitialiser,
    revisables: revisables, distancePips: distancePips, dansFenetre: dansFenetre,
    questionsDuTrade: questionsDuTrade,
    zoneHTML: zoneHTML, cabler: cabler, tirer: tirer, repondre: repondre,
    reveler: reveler, juger: juger, jugerProcess: jugerProcess,
    etat: etat,
    __test: {
      questionsVerifiables: questionsVerifiables,
      questionStructure: questionStructure,
      questionProcess: questionProcess,
      etat: etat
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
