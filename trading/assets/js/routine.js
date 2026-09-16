/* =========================================================
   routine.js — La routine quotidienne, cochée jour par jour

   Le plan décrit quatre moments (avant, pendant, après la séance,
   revue du dimanche). Ici, chaque case cochée est datée : on peut
   montrer ce qui a été fait — et ce qui ne l'a pas été.

   - une journée est « complète » quand tous les moments du jour
     sont cochés (la revue hebdomadaire ne compte que le dimanche) ;
   - la progression s'enregistre dans le journal, donc elle est
     chiffrée quand le verrou est actif, sauvegardée dans votre
     dépôt et fusionnée entre appareils, jour par jour ;
   - l'historique se lit sur un mois, en un coup d'œil, et
     s'imprime.

   Aucune ressource externe, aucun emoji, utilisable hors ligne.
   ========================================================= */
'use strict';

(function (global) {
  var CLE = 'routine';

  /* ---------------------------------------------------------
     Les moments : repris du plan, jamais recopiés à la main
     --------------------------------------------------------- */
  var IDS = ['av', 'pe', 'ap', 'rh'];

  function moments() {
    var bloc = null;
    try {
      var blocs = (global.Plan && global.Plan.data && global.Plan.data.blocks) || [];
      bloc = blocs.filter(function (b) { return b.id === 'routine'; })[0] || null;
    } catch (e) { bloc = null; }
    if (!bloc) return [];
    return bloc.items.filter(function (it) { return it.type === 'routine'; }).map(function (it, i) {
      return {
        id: IDS[i] || ('m' + i),
        titre: it.title,
        court: String(it.title).replace(/\s*\(.*$/, ''),
        items: it.items.map(function (texte, k) { return { cle: (IDS[i] || ('m' + i)) + ':' + k, texte: texte }; })
      };
    });
  }

  function itemParCle(cle) {
    var trouve = null;
    moments().forEach(function (m) {
      m.items.forEach(function (it) { if (it.cle === cle) trouve = it; });
    });
    return trouve;
  }

  /* ---------------------------------------------------------
     Les dates (heure de Bamako = UTC+0 toute l'année)
     --------------------------------------------------------- */
  function aujourdhui() {
    if (global.Store && global.Store.todayISO) return global.Store.todayISO();
    return new Date().toISOString().slice(0, 10);
  }
  function estDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function enDate(iso) { return new Date(String(iso) + 'T12:00:00Z'); }     // midi UTC : aucun risque de bascule
  function jourSemaine(iso) { return enDate(iso).getUTCDay(); }              // 0 = dimanche
  function decaler(iso, n) { return new Date(enDate(iso).getTime() + n * 86400000).toISOString().slice(0, 10); }
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function jourLong(iso) {
    var d = enDate(iso);
    return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function jourCourt(iso) {
    var d = enDate(iso);
    return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
  }

  /* ---------------------------------------------------------
     Ce qui est demandé un jour donné
     --------------------------------------------------------- */
  /** Les moments à cocher : les trois de la séance, plus la revue le dimanche. */
  function momentsRequis(date) {
    return moments().filter(function (m) { return m.id !== 'rh' || jourSemaine(date) === 0; });
  }

  /* ---------------------------------------------------------
     L'état enregistré : { 'AAAA-MM-JJ': { 'av:0': true, … } }
     --------------------------------------------------------- */
  function lireTout() {
    var checks = {};
    try { checks = (global.Plan && global.Plan.loadChecks()) || {}; } catch (e) { checks = {}; }
    var r = checks[CLE];
    return (r && typeof r === 'object') ? r : {};
  }
  function lireJour(date) {
    var j = lireTout()[date];
    return (j && typeof j === 'object') ? j : {};
  }
  function ecrireTout(tout) {
    try {
      var checks = (global.Plan && global.Plan.loadChecks()) || {};
      // on ne garde que les journées qui portent au moins une case cochée
      var propre = {};
      Object.keys(tout).forEach(function (d) {
        if (tout[d] && Object.keys(tout[d]).length) propre[d] = tout[d];
      });
      checks[CLE] = propre;
      if (global.Plan) global.Plan.saveChecks(checks);
      if (global.App && global.App.persist) global.App.persist();
      journal[tout] = propre;
      return propre;
    } catch (e) { return tout; }
  }
  var journal = {};   // cache local du dernier état écrit (utile aux recettes et à l'affichage)

  function basculer(date, cle, on) {
    if (!estDate(date) || !itemParCle(cle)) return false;
    var tout = lireTout();
    var jour = Object.assign({}, tout[date] || {});
    if (on === undefined) on = !jour[cle];
    if (on) jour[cle] = true; else delete jour[cle];
    if (Object.keys(jour).length) tout[date] = jour; else delete tout[date];
    ecrireTout(tout);
    return !!on;
  }
  function cocherTout(date, on) {
    if (!estDate(date)) return;
    var tout = lireTout();
    if (on) {
      var jour = {};
      momentsRequis(date).forEach(function (m) { m.items.forEach(function (it) { jour[it.cle] = true; }); });
      tout[date] = jour;
    } else {
      delete tout[date];
    }
    ecrireTout(tout);
  }
  function cocherMoment(date, idMoment, on) {
    var tout = lireTout();
    var jour = Object.assign({}, tout[date] || {});
    var m = moments().filter(function (x) { return x.id === idMoment; })[0];
    if (!m) return;
    m.items.forEach(function (it) { if (on) jour[it.cle] = true; else delete jour[it.cle]; });
    if (Object.keys(jour).length) tout[date] = jour; else delete tout[date];
    ecrireTout(tout);
  }

  /* ---------------------------------------------------------
     Les scores
     --------------------------------------------------------- */
  function scoreJour(date) {
    var jour = lireJour(date);
    var requis = momentsRequis(date);
    var faits = 0, total = 0;
    requis.forEach(function (m) {
      m.items.forEach(function (it) { total++; if (jour[it.cle]) faits++; });
    });
    var horsRevue = 0;
    moments().forEach(function (m) {
      if (m.id === 'rh') return;
      m.items.forEach(function (it) { if (!requis.some(function (r) { return r.id === m.id; }) && jour[it.cle]) horsRevue++; });
    });
    return {
      date: date, faits: faits, total: total, pct: total ? Math.round(faits / total * 100) : 0,
      complet: total > 0 && faits === total, commence: faits > 0, horsRevue: horsRevue,
      revue: jourSemaine(date) === 0
    };
  }

  /** Les jours complets à la suite : aujourd'hui s'il est déjà commencé, sinon à partir d'hier. */
  function serie(depuis) {
    var date = depuis || aujourdhui();
    var s = scoreJour(date);
    if (!s.complet) {
      if (s.commence) return 0;              // journée entamée mais pas finie : la série s'arrête là
      date = decaler(date, -1);              // journée pas encore commencée : on compte jusqu'à hier
    }
    var n = 0, garde = 0;
    while (garde++ < 400 && scoreJour(date).complet) { n++; date = decaler(date, -1); }
    return n;
  }

  /** Le mois d'une date : une case par jour, avec son état. */
  function mois(iso) {
    var d = enDate(iso);
    var an = d.getUTCFullYear(), m = d.getUTCMonth();
    var premier = new Date(Date.UTC(an, m, 1)).toISOString().slice(0, 10);
    var nb = new Date(Date.UTC(an, m + 1, 0)).getUTCDate();
    var cases = [];
    for (var i = 0; i < nb; i++) {
      var date = decaler(premier, i);
      var s = scoreJour(date);
      cases.push({
        date: date, num: i + 1, faits: s.faits, total: s.total, pct: s.pct,
        complet: s.complet, commence: s.commence, revue: s.revue,
        dimanche: jourSemaine(date) === 0, futur: date > aujourdhui()
      });
    }
    /* colonne du premier jour : lundi = 0 */
    var decalage = (jourSemaine(premier) + 6) % 7;
    return { an: an, m: m, titre: MOIS[m] + ' ' + an, premier: premier, cases: cases, decalage: decalage };
  }

  /** Bilan du mois : jours complets, jours commencés, jours écoulés. */
  function bilanMois(iso) {
    var M = mois(iso);
    var auj = aujourdhui();
    var ecoules = M.cases.filter(function (c) { return c.date <= auj; }).length;
    var complets = M.cases.filter(function (c) { return c.complet; }).length;
    var commences = M.cases.filter(function (c) { return c.commence && !c.complet; }).length;
    var taux = ecoules ? Math.round(complets / ecoules * 100) : 0;
    return { complets: complets, commences: commences, ecoules: ecoules, taux: taux, total: M.cases.length };
  }

  /** Bilan de la semaine en cours (lundi → dimanche). */
  function bilanSemaine(iso) {
    var d = enDate(iso), decalage = (jourSemaine(iso) + 6) % 7;
    var lundi = decaler(iso, -decalage);
    var ouverts = 0, faits = 0;
    for (var i = 0; i < 5; i++) {
      var date = decaler(lundi, i);
      if (date > aujourdhui()) break;
      ouverts++;
      if (scoreJour(date).complet) faits++;
    }
    return { lundi: lundi, ouverts: ouverts, complets: faits };
  }

  var selection = null;                       // jour affiché (garde la sélection pendant la session)
  function jourAffiche() { return selection || aujourdhui(); }
  function choisir(date) { selection = estDate(date) ? date : null; return jourAffiche(); }

  /* ---------------------------------------------------------
     L'affichage
     --------------------------------------------------------- */
  function esc(s) { return (global.UI && global.UI.esc) ? global.UI.esc(s) : String(s == null ? '' : s); }
  function barre(pct, ton) {
    return '<div class="rt-barre' + (ton ? ' ' + ton : '') + '"><span style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></div>';
  }

  function carte(App) {
    var ms = moments();
    if (!ms.length) return '';
    var date = jourAffiche();
    var s = scoreJour(date);
    var auj = aujourdhui();
    var semaine = bilanSemaine(date);
    var M = mois(date);
    var bilan = bilanMois(date);
    var enSerie = serie();
    var html = '';

    html += '<section class="plan-block" id="bloc-routine-jour">' +
      '<header><span class="num">14</span><h3>Ma routine, jour par jour</h3></header>' +
      '<p class="lead">Chaque case cochée est datée : votre routine s\'enregistre avec le journal et se lit sur le mois. ' +
      'La revue hebdomadaire ne compte que le dimanche.</p>';

    /* --- le jour affiché --- */
    html += '<div class="rt-jour"><div class="rt-jour-tete">' +
      '<button type="button" class="btn ghost small" id="rtPrec" title="Jour précédent">Jour précédent</button>' +
      '<div class="rt-date"><b>' + esc(jourLong(date)) + '</b>' +
      (date === auj ? '<span class="rt-aujourd">aujourd\'hui</span>' : '<button type="button" class="rt-lien" id="rtAujourd">revenir à aujourd\'hui</button>') +
      '</div>' +
      '<button type="button" class="btn ghost small" id="rtSuiv" title="Jour suivant"' + (date >= auj ? ' disabled' : '') + '>Jour suivant</button>' +
      '</div>';

    html += '<div class="rt-score">' + barre(s.pct, s.complet ? 'ok' : (s.commence ? 'warn' : '')) +
      '<span class="rt-score-texte">' + s.faits + ' / ' + s.total + ' case(s)' +
      (s.complet ? ' — journée complète' : (s.commence ? ' — journée entamée' : ' — rien de coché')) + '</span></div>';

    /* --- les moments --- */
    ms.forEach(function (m) {
      var requis = m.id !== 'rh' || jourSemaine(date) === 0;
      var jour = lireJour(date);
      var faits = m.items.filter(function (it) { return jour[it.cle]; }).length;
      var complet = faits === m.items.length;
      html += '<article class="rt-moment' + (complet ? ' complet' : '') + (requis ? '' : ' facultatif') + '" data-moment="' + m.id + '">' +
        '<header><h4>' + esc(m.titre) + '</h4>' +
        '<span class="rt-compte">' + faits + '/' + m.items.length + '</span></header>' +
        '<ul>' + m.items.map(function (it) {
          return '<li><label><input type="checkbox" data-rt="' + it.cle + '" data-date="' + date + '"' +
            (jour[it.cle] ? ' checked' : '') + '><span>' + esc(it.texte) + '</span></label></li>';
        }).join('') + '</ul>' +
        '<footer><button type="button" class="btn ghost small" data-rt-moment="' + m.id + '" data-on="' + (complet ? 'false' : 'true') + '">' +
        (complet ? 'Décocher ce moment' : 'Cocher ce moment') + '</button>' +
        (!requis ? '<span class="rt-note">Ne compte que le dimanche</span>' : '') + '</footer></article>';
    });

    html += '<div class="rt-jour-pied">' +
      '<span class="rt-resume">Cette semaine : ' + semaine.complets + ' / ' + semaine.ouverts + ' jour(s) ouvré(s) complet(s)' +
      (enSerie ? ' · ' + enSerie + ' jour(s) complet(s) d\'affilée' : '') + '</span>' +
      '<button type="button" class="btn ghost small" data-rt-jour="' + (s.complet ? 'off' : 'on') + '">' +
      (s.complet ? 'Vider cette journée' : 'Tout cocher aujourd\'hui') + '</button></div></div>';

    /* l'exemple en basse unité de temps (la phrase de la routine, dépliée) */
    html += '<p class="rt-legende rt-ltf">Attendre la prise de liquidité, puis le ChoCh : la routine est dépliée sur une ' +
      'séance réelle de 15 minutes. <button type="button" class="rt-lien" id="rtLtf">Voir cet exemple en 15 minutes</button></p>';

    /* --- le mois --- */
    html += '<div class="rt-mois"><header><h4>' + esc(M.titre) + '</h4>' +
      '<span class="rt-mois-bilan">' + bilan.complets + ' jour(s) complet(s) sur ' + bilan.ecoules + ' écoulé(s)' +
      (bilan.commences ? ' · ' + bilan.commences + ' entamé(s)' : '') + ' · ' + bilan.taux + ' %</span></header>' +
      '<div class="rt-grille">' +
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (l, i) { return '<span class="rt-tete-col' + (i > 4 ? ' we' : '') + '">' + l + '</span>'; }).join('') +
      '<span class="rt-vide"></span>'.repeat(M.decalage) +
      M.cases.map(function (c) {
        var ton = c.complet ? 'complet' : (c.commence ? 'partiel' : 'vide');
        return '<button type="button" class="rt-case ' + ton + (c.date === auj ? ' auj' : '') + (c.dimanche ? ' we' : '') +
          (c.date === date ? ' choisi' : '') + (c.futur ? ' futur' : '') + '" data-rt-jour-cell="' + c.date + '"' +
          ' title="' + c.faits + '/' + c.total + ' case(s) le ' + esc(jourLong(c.date)) + '">' +
          '<span class="rt-num">' + c.num + '</span>' +
          '<span class="rt-mini"><i style="width:' + c.pct + '%"></i></span></button>';
      }).join('') +
      '</div>' +
      '<p class="rt-legende"><span class="rt-puce complet"></span> complète' +
      ' <span class="rt-puce partiel"></span> entamée' +
      ' <span class="rt-puce vide"></span> rien de coché' +
      ' · s\'enregistre avec le journal (chiffré et sauvegardé dans votre dépôt)</p></div>';

    html += '</section>';
    return html;
  }

  /* ---------------------------------------------------------
     Le câblage
     --------------------------------------------------------- */
  function cabler(host, App) {
    if (!host) return;
    var recharger = function () { if (App && App.render) App.render(); };

    host.querySelectorAll('[data-rt]').forEach(function (box) {
      box.addEventListener('change', function () {
        basculer(box.dataset.date, box.dataset.rt, box.checked);
        var date = box.dataset.date, cle = box.dataset.rt;
        var item = itemParCle(cle);
        if (item && box.checked && global.UI && global.UI.toast) {
          /* discret : on confirme sans interrompre */
        }
        majMoment(host, date);
      });
    });

    host.querySelectorAll('[data-rt-moment]').forEach(function (b) {
      b.addEventListener('click', function () {
        var date = jourAffiche();
        cocherMoment(date, b.dataset.rtMoment, b.dataset.on === 'true');
        recharger();
      });
    });

    var tout = host.querySelector('[data-rt-jour]');
    if (tout) tout.addEventListener('click', function () {
      cocherTout(jourAffiche(), tout.dataset.rtJour === 'on');
      recharger();
    });

    var prec = host.querySelector('#rtPrec');
    if (prec) prec.addEventListener('click', function () { choisir(decaler(jourAffiche(), -1)); recharger(); });
    var suiv = host.querySelector('#rtSuiv');
    if (suiv) suiv.addEventListener('click', function () {
      if (jourAffiche() >= aujourdhui()) return;
      choisir(decaler(jourAffiche(), 1));
      recharger();
    });
    var auj = host.querySelector('#rtAujourd');
    if (auj) auj.addEventListener('click', function () { choisir(null); recharger(); });

    /* l'exemple vit dans la vue Formation : on y va, on le vise, on le montre */
    var ltf = host.querySelector('#rtLtf');
    if (ltf) ltf.addEventListener('click', function () {
      if (!App || !App.state || !App.render) return;
      App.state.view = 'formation';
      App.render();
      setTimeout(function () {
        var cible = document.querySelector('#etudeLtf');
        if (!cible) return;
        if (cible.scrollIntoView) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        cible.style.transition = 'box-shadow .5s';
        cible.style.boxShadow = '0 0 0 3px rgba(237,187,82,.35)';
        setTimeout(function () { cible.style.boxShadow = ''; }, 2600);
      }, 90);
    });

    host.querySelectorAll('[data-rt-jour-cell]').forEach(function (c) {
      c.addEventListener('click', function () {
        if (c.classList.contains('futur')) return;      // on ne coche pas demain
        choisir(c.dataset.rtJourCell);
        recharger();
      });
    });
    return true;
  }

  /** Met à jour le compteur d'un moment sans redessiner toute la vue. */
  function majMoment(host, date) {
    var jour = lireJour(date);
    moments().forEach(function (m) {
      var bloc = host.querySelector('[data-moment="' + m.id + '"]');
      if (!bloc) return;
      var faits = m.items.filter(function (it) { return jour[it.cle]; }).length;
      var compte = bloc.querySelector('.rt-compte');
      if (compte) compte.textContent = faits + '/' + m.items.length;
      bloc.classList.toggle('complet', faits === m.items.length);
      var bouton = bloc.querySelector('[data-rt-moment]');
      if (bouton) {
        bouton.dataset.on = faits === m.items.length ? 'false' : 'true';
        bouton.textContent = faits === m.items.length ? 'Décocher ce moment' : 'Cocher ce moment';
      }
    });
    var s = scoreJour(date);
    var barre2 = host.querySelector('.rt-score .rt-barre');
    if (barre2) {
      var span = barre2.querySelector('span');
      if (span) span.style.width = s.pct + '%';
      barre2.className = 'rt-barre' + (s.complet ? ' ok' : (s.commence ? ' warn' : ''));
    }
    var texte = host.querySelector('.rt-score-texte');
    if (texte) {
      texte.textContent = s.faits + ' / ' + s.total + ' case(s)' +
        (s.complet ? ' — journée complète' : (s.commence ? ' — journée entamée' : ' — rien de coché'));
    }
  }

  global.Routine = {
    CLE: CLE,
    moments: moments,
    momentsRequis: momentsRequis,
    aujourdhui: aujourdhui,
    jourLong: jourLong,
    decaler: decaler,
    lireTout: lireTout,
    lireJour: lireJour,
    basculer: basculer,
    cocherTout: cocherTout,
    cocherMoment: cocherMoment,
    scoreJour: scoreJour,
    serie: serie,
    mois: mois,
    bilanMois: bilanMois,
    bilanSemaine: bilanSemaine,
    jourAffiche: jourAffiche,
    choisir: choisir,
    carte: carte,
    cabler: cabler
  };
})(typeof window !== 'undefined' ? window : globalThis);
