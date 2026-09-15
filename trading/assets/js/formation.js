/* =========================================================
   formation.js — Vue « Formation » : cours, exercices notés
   et entraîneur de lecture de graphique

   - le cours suit les 12 chapitres du plan, dans l'ordre
   - chaque chapitre : l'essentiel, les leçons, ce qu'il faut voir
     sur le graphique, les étapes à suivre, les erreurs fréquentes
   - des exercices notés : QCM par chapitre, et calculs de risque
     générés à la demande (taille de position, R, distance au stop)
   - un entraîneur de graphiques (entraineur.js) avec correction
   - la progression est enregistrée dans le journal, donc chiffrée
     au repos quand le verrou est actif, et sauvegardée dans le
     cloud avec le reste des données
   ========================================================= */
(function (global) {
  'use strict';

  var CLE = 'formation';

  /* ---------------------------------------------------------
     Progression
     --------------------------------------------------------- */
  function vide() {
    return { chapitres: {}, entraineur: { essais: 0, questions: 0, bonnes: 0, serie: 0, meilleureSerie: 0, parConcept: {} }, calculs: { bonnes: 0, total: 0 } };
  }
  function lire() {
    var checks = {};
    try { checks = (global.Plan && global.Plan.loadChecks()) || {}; } catch (e) { checks = {}; }
    var brut = checks[CLE];
    if (!brut || typeof brut !== 'object') return vide();
    var p = vide();
    p.chapitres = brut.chapitres && typeof brut.chapitres === 'object' ? brut.chapitres : {};
    ['essais', 'questions', 'bonnes', 'serie', 'meilleureSerie'].forEach(function (k) {
      p.entraineur[k] = Number(brut.entraineur && brut.entraineur[k]) || 0;
    });
    p.entraineur.parConcept = (brut.entraineur && brut.entraineur.parConcept) || {};
    p.calculs.bonnes = Number(brut.calculs && brut.calculs.bonnes) || 0;
    p.calculs.total = Number(brut.calculs && brut.calculs.total) || 0;
    return p;
  }
  function ecrire(p) {
    try {
      var checks = (global.Plan && global.Plan.loadChecks()) || {};
      checks[CLE] = p;
      if (global.Plan) global.Plan.saveChecks(checks);
      if (global.App && global.App.persist) global.App.persist();
    } catch (e) { /* ignore */ }
    return p;
  }
  function chapitreProgression(p, id) {
    if (!p.chapitres[id]) p.chapitres[id] = { vu: false, qcm: {}, calculs: {} };
    var c = p.chapitres[id];
    if (!c.qcm) c.qcm = {};
    if (!c.calculs) c.calculs = {};
    return c;
  }
  function scoreQcm(p, chapitre) {
    var c = chapitreProgression(p, chapitre.id);
    var total = chapitre.exercices ? chapitre.exercices.length : 0;
    var bonnes = Object.keys(c.qcm).filter(function (k) { return c.qcm[k] === true; }).length;
    return { bonnes: bonnes, total: total, repondu: Object.keys(c.qcm).length };
  }
  function chapitresVus(p) {
    p = p || lire();
    return global.FormationContenu.chapitres.filter(function (c) { return chapitreProgression(p, c.id).vu; }).length;
  }
  function tauxEntraineur(p) {
    p = p || lire();
    var e = p.entraineur;
    return e.questions ? Math.round(e.bonnes / e.questions * 100) : null;
  }
  function reinitialiser() {
    ecrire(vide());
  }

  /* ---------------------------------------------------------
     Outils d'affichage
     --------------------------------------------------------- */
  function esc(s) { return UI.esc(s); }
  function attr(s) { return UI.attr(s); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function barre(valeur) {
    return '<div class="prog"><span style="width:' + Math.max(0, Math.min(100, valeur)) + '%"></span></div>';
  }
  function badge(texte, ton) { return '<span class="badge ' + (ton || 'flat') + '">' + esc(texte) + '</span>'; }

  /* ---------------------------------------------------------
     Vue principale
     --------------------------------------------------------- */
  function rendre(host, model, App) {
    appCourante = App || null;
    var p = lire();
    var chapitres = global.FormationContenu.chapitres;
    var html = '';

    html += carteEntete(p, chapitres, App);
    html += carteEntraineur(p, App);
    html += carteRelecture(App);
    html += carteVraisGraphiques(App);

    html += '<section class="card form-card"><header class="card-head"><h3>Le cours — 12 chapitres, dans l\'ordre du plan</h3>' +
      '<div class="card-tools"><button class="btn ghost small" id="fToutOuvrir">Tout déplier (impression)</button>' +
      '<button class="btn ghost small" id="fRemise">Remettre à zéro</button></div></header>' +
      '<div class="card-body">';
    chapitres.forEach(function (c) { html += chapitreHTML(c, p); });
    html += carteSources() + '</div></section>';

    host.innerHTML = html;
    cabler(host, App);
    rafraichirRelecture(host, App);
    var voirReel = host.querySelector('#fVraisOuvrir');
    if (voirReel) voirReel.addEventListener('click', ouvrirGraphiqueReel);
    return html;
  }

  /* ---- en-tête : où en est l'élève ---- */
  function carteEntete(p, chapitres, App) {
    var vus = chapitresVus(p), total = chapitres.length;
    var e = p.entraineur;
    var taux = tauxEntraineur(p);
    var suivant = chapitres.filter(function (c) { return !chapitreProgression(p, c.id).vu; })[0];
    var exercicesFaits = chapitres.reduce(function (a, c) { var s = scoreQcm(p, c); return a + s.repondu; }, 0);
    var exercicesTotal = chapitres.reduce(function (a, c) { return a + (c.exercices ? c.exercices.length : 0); }, 0);
    var bonnes = chapitres.reduce(function (a, c) { return a + scoreQcm(p, c).bonnes; }, 0);

    return '<section class="card form-card form-entete">' +
      '<div class="form-entete-titre">' +
      '<h2>Formation SMV — comprendre la méthode et s\'entraîner</h2>' +
      '<p class="muted">Cours construit à partir de vos deux documents (<em>Ultra Book FX</em> et <em>Plan trading</em>), organisé selon les 12 chapitres de votre plan. Tout fonctionne hors ligne.</p>' +
      '</div>' +
      '<div class="form-scores">' +
      score('Chapitres étudiés', vus + ' / ' + total, barre(pct(vus, total)), vus + ' chapitre(s) sur ' + total) +
      score('Exercices de cours', bonnes + ' / ' + exercicesFaits + ' justes', barre(pct(bonnes, Math.max(1, exercicesFaits))), exercicesFaits + ' exercice(s) fait(s) sur ' + exercicesTotal) +
      score('Entraîneur', taux === null ? '—' : taux + ' %', barre(taux === null ? 0 : taux), e.bonnes + ' bonnes réponses sur ' + e.questions + ' · meilleure série ' + e.meilleureSerie) +
      '</div>' +
      (suivant
        ? '<div class="form-suivant"><span>Chapitre suivant conseillé :</span> <b>' + esc(suivant.num + ' — ' + suivant.titre) + '</b>' +
          '<button class="btn primary small" data-chap="' + attr(suivant.id) + '">Ouvrir le chapitre</button></div>'
        : '<div class="form-suivant"><span>Les 12 chapitres sont étudiés.</span> <b>Continuez avec l\'entraîneur</b> : c\'est la répétition qui installe la lecture.</div>') +
      '</section>';
  }
  function score(label, valeur, jauge, sous) {
    return '<div class="form-score"><span class="fs-label">' + esc(label) + '</span>' +
      '<b class="fs-valeur">' + esc(valeur) + '</b>' + jauge +
      '<span class="muted small">' + esc(sous) + '</span></div>';
  }

  /* ---------------------------------------------------------
     Entraîneur de graphiques
     --------------------------------------------------------- */
  var etat = {
    concept: 'tendance', scenario: null, index: 0, reponses: [], clic: null, correction: false, fini: false,
    ouverts: {}   // chapitres dépliés : conservés d'un redessin à l'autre
  };

  /* L'application en cours de rendu : la vue Formation reçoit App (état, réglages,
     trades) et le garde sous la main pour les boutons posés dans le HTML. */
  var appCourante = null;

  /** Réglages de l'application (pour savoir si le lien externe est autorisé). */
  function planReglages() {
    return (appCourante && appCourante.state && appCourante.state.settings) || {};
  }

  /** Ouvre le graphique réel de l'instrument le plus tradé (graphe.js). */
  function ouvrirGraphiqueReel() {
    var G = global.Graphe;
    if (!G) return;
    var reglages = planReglages();
    var trades = (appCourante && appCourante.state && appCourante.state.trades) || [];
    G.ouvrir(G.instrumentPrincipal(trades, reglages), reglages);
  }

  /* ---------------------------------------------------------
     Relire ses vrais trades (relecture.js)
     --------------------------------------------------------- */
  function carteRelecture(App) {
    if (!global.Relecture) return '';
    var p = global.Relecture.lire();
    return '<section class="card form-card relecture" id="relecture">' +
      '<header class="card-head"><h3>Relire mes vrais trades — se corriger sur ses propres décisions</h3>' +
      '<div class="card-tools"><span class="badge ' + (p.questions ? 'ok' : 'flat') + '">' +
      (p.questions ? p.bonnes + ' / ' + p.questions + ' juste(s)' : 'à commencer') + '</span></div></header>' +
      '<div class="card-body">' +
      '<p class="muted">L\'entraîneur fabrique des graphiques pour travailler chaque concept, hors ligne. Ici, c\'est le marché qui a parlé : ' +
      'l\'application reprend vos trades du journal et vous repose les questions du plan — règles chiffrées d\'un côté (stop, ratio, risque, fenêtre de tir), ' +
      'jugement de lecture de l\'autre. <b>Le résultat reste masqué jusqu\'à ce que vous ayez conclu</b> : c\'est la seule façon de juger sa lecture sans être influencé par ce qu\'on sait déjà.</p>' +
      '<div id="fZoneRelire">' + global.Relecture.zoneHTML(App) + '</div>' +
      '</div></section>';
  }

  function rafraichirRelecture(host, App) {
    var zone = host.querySelector('#fZoneRelire');
    if (!zone) return;
    zone.innerHTML = global.Relecture.zoneHTML(App);
    global.Relecture.cabler(zone, App, function () { rafraichirRelecture(host, App); });
  }

  /* ---------------------------------------------------------
     Pratiquer sur de vrais graphiques — depuis la tablette
     --------------------------------------------------------- */
  function carteVraisGraphiques(App) {
    var G = global.Graphe;
    var dispo = G && G.actif(planReglages());
    var lignes = [
      ['Lire la structure, trouver le biais (ch. 05)', 'TradingView, replay en <b>journalier</b> (gratuit dans l\'application Android)', 'Le replay gratuit s\'arrête à l\'unité journalière : c\'est exactement l\'échelle du biais HTF du plan. Vous avancez jour par jour et vous concluez : haussière, baissière ou consolidation — puis vous vérifiez.'],
      ['Les zones d\'offre et de demande (ch. 06)', 'TradingView, replay en journalier', 'Sur chaque journée rejouée, marquez la zone avant de faire avancer le prix. Vous verrez combien de vos zones sont réellement défendues, et combien étaient du bruit.'],
      ['La liquidité (ch. 07)', 'TradingView, replay en journalier', 'Repérez les EQH/EQL et les intacts avant l\'avance, puis notez lequel est venu chercher le prix. C\'est l\'exercice qui fait le plus progresser sur cette loi.'],
      ['Les phases de Wyckoff (ch. 04)', 'TradingView, replay en journalier', 'Rejouez une fourchette jour par jour et nommez les phases A à E à mesure qu\'elles se forment, sans voir la suite.'],
      ['La routine et l\'exécution (ch. 03 et 09)', 'MetaTrader 5 pour Android, <b>compte démo gratuit</b>', 'Ne rejoue pas l\'histoire, mais entraîne le geste en conditions réelles : fenêtre de tir, calcul de taille, stop 15 pips, breakeven, prises partielles, arrêt après deux stop loss. Le journal reprend ensuite ce que vous avez fait.'],
      ['Le tri des configurations (ch. 08)', G && G.actif(planReglages()) ? 'QuizTraders (navigateur, en anglais)' : 'QuizTraders (navigateur, en anglais)', 'Décider « acheter / vendre / ne rien faire » sur de vrais graphiques SMC, avec correction immédiate. Offre gratuite limitée : à utiliser en complément, pas en pilier.']
    ];
    var html = '<section class="card form-card vrais" id="vrais">' +
      '<header class="card-head"><h3>Pratiquer sur de vrais graphiques — depuis la tablette</h3>' +
      '<div class="card-tools"><span class="badge flat">gratuit</span></div></header>' +
      '<div class="card-body">' +
      '<p class="muted">L\'entraîneur travaille les concepts sur des graphiques fabriqués par l\'application : c\'est parfait pour répéter, mais ce n\'est pas le marché. ' +
      'Voici ce qui est réellement gratuit, <b>utilisable depuis votre tablette Android</b>, et à quoi cela sert dans l\'ordre du plan. ' +
      'Limites constatées en 2026 — si elles changent, vous me le dites et je mets à jour.</p>' +
      '<div class="vrais-table">' + lignes.map(function (l) {
        return '<div class="vrais-ligne"><div class="vrais-quoi"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>' +
          '<p class="muted small">' + l[2] + '</p></div>';
      }).join('') + '</div>' +
      '<div class="alert warn"><span class="alert-ico">' + UI.icon('info') + '</span><span><b>La limite à connaître :</b> ' +
      'le replay <b>intraday</b> (15 min, 1 h) n\'est plus gratuit chez TradingView (offre payante depuis 2026). ' +
      'Le gratuit couvre le <b>journalier</b> — donc la lecture HTF, les zones, la liquidité et Wyckoff — ' +
      'tandis que l\'entraîneur de l\'application couvre l\'intraday à 50–60 bougies, hors ligne. ' +
      'Les deux ensemble couvrent tout le plan.</span></div>' +
      '<p class="small">Un contournement existe pour l\'intraday sur TradingView : un <b>indicateur communautaire gratuit</b> qui rejoue les bougies ' +
      'en faisant glisser une zone sur le graphique. La qualité dépend de son auteur, à essayer avec prudence — ' +
      'le principe reste le même : avancer une bougie à la fois, conclure avant de voir la suite.</p>' +
      (dispo ? '<p class="small"><button class="btn ghost small" id="fVraisOuvrir">' + UI.icon('link') +
        ' Ouvrir un graphique TradingView maintenant</button> <span class="muted small">(nécessite internet ; l\'entraîneur fonctionne sans)</span></p>' : '') +
      '<p class="muted small"><b>Si un jour vous avez un ordinateur :</b> MetaTrader 5 dispose d\'un mode de test <i>visuel</i> gratuit qui rejoue ' +
      'n\'importe quelle période en intraday, bougie par bougie, avec des ordres placés à la main — c\'est la seule façon gratuite de s\'entraîner ' +
      'en intraday sur des données réelles. Dites-le moi ce jour-là : j\'ajouterai la procédure pas à pas.</p>' +
      applisHTML() +
      '</div></section>';
    return html;
  }

  /* ---------------------------------------------------------
     Les applications du Play Store : ce qu'elles font vraiment
     --------------------------------------------------------- */
  function applisHTML() {
    var APPLIS = [
      {
        nom: 'Candle Master : Trading Game', editeur: 'Aman33kh',
        fait: 'Prédire la prochaine bougie, quiz de chandeliers (180+ questions), précision et séries suivies, RSI/MACD sur le graphique.',
        prix: 'Gratuit', langue: 'Français',
        piege: 'Petit éditeur (peu de téléchargements) et l\'application partage l\'identifiant de votre appareil. Excellent pour le réflexe bougie, muet sur la méthode SMV.'
      },
      {
        nom: 'Chart Quiz — Stock & Crypto', editeur: 'chartquizamerica',
        fait: 'Vrais graphiques (crypto, actions, indices) : prédire le mouvement suivant, correction immédiate, série suivie.',
        prix: 'Gratuit', langue: 'Anglais',
        piege: 'Marchés surtout américains, aucune notion SMC. Utile pour le coup d\'œil sur la tendance, pas pour vos 12 chapitres.'
      },
      {
        nom: 'Trading Game (GoForex)', editeur: 'tiim',
        fait: 'Simulateur en temps réel, plus de 400 questions de quiz et des leçons courtes, sans pub ni inscription.',
        prix: 'Gratuit', langue: 'Français',
        piege: 'Orienté débutant et forex classique. La partie « signaux quotidiens » n\'a rien à voir avec votre plan : à ignorer.'
      },
      {
        nom: 'Forex Smart Money Concept', editeur: 'Appnovasi',
        fait: 'Fiches SMC : order blocks, FVG, premium/discount, cassures de structure, plans de trade avec entrée, stop et objectifs.',
        prix: 'Gratuit', langue: 'Anglais',
        piege: 'C\'est de la lecture, sans exercices corrigés ni score. Vocabulaire SMC/ICT générique, pas celui de votre livre.'
      },
      {
        nom: 'Forex Trading : Learn SMC & ICT (GTS)', editeur: 'Golden Trading Strategies',
        fait: 'SMC et ICT, simulateur papier, calcul de position, journal de trades, préparation aux challenges de prop firms.',
        prix: 'Gratuit + offres payantes', langue: 'Anglais',
        piege: 'Beaucoup de contenu verrouillé en premium, sources non citées. À prendre comme complément, jamais comme référence.'
      }
    ];
    return '<h4 class="vrais-titre">Applications du Play Store (Android) qui font vraiment réviser</h4>' +
      '<p class="muted small">Ce sont des applications d\'entraînement, pas des courtiers. Les trois premières corrigent et notent ; les deux suivantes ' +
      'expliquent sans interroger. Aucune ne suit l\'ordre de vos 12 chapitres — c\'est le rôle de cette formation — mais elles font travailler le coup d\'œil, ' +
      'ce qui se complète bien.</p>' +
      '<div class="applis">' + APPLIS.map(function (a) {
        return '<article class="appli">' +
          '<div class="appli-tete"><b>' + esc(a.nom) + '</b>' +
          '<span class="badge ' + (a.prix === 'Gratuit' ? 'ok' : 'flat') + '">' + esc(a.prix) + '</span></div>' +
          '<p class="small"><b>Ce qu\'elle fait :</b> ' + esc(a.fait) + '</p>' +
          '<p class="muted small"><b>La limite :</b> ' + esc(a.piege) + ' <span class="appli-langue">' + esc(a.langue) + ' · ' + esc(a.editeur) + '</span></p>' +
          '</article>';
      }).join('') + '</div>' +
      '<div class="alert warn"><span class="alert-ico">' + UI.icon('warn') + '</span><span><b>Attention aux fausses applications éducatives.</b> ' +
      'Une grande partie des applications « trading » du Play Store sont des <b>vitrines de courtiers</b> : elles poussent à déposer de l\'argent réel, ' +
      'et certaines accumulent les avis de retraits en échec. Aucune n\'est nécessaire pour s\'entraîner : les applications ci-dessus suffisent, et pour ' +
      'passer des ordres sans argent réel, utilisez un <b>compte démo</b> d\'un courtier régulé. Ne déposez jamais d\'argent sur une application découverte ' +
      'par hasard, même si elle se présente comme éducative.</span></div>';
  }

  function carteEntraineur(p, App) {
    var E = global.Entraineur;
    var html = '<section class="card form-card entraineur" id="entraineur">' +
      '<header class="card-head"><h3>Entraîneur de lecture — graphiques générés et corrigés</h3></header>' +
      '<div class="card-body">' +
      '<p class="muted">Chaque graphique est fabriqué à l\'instant (bougies, structure, zones, liquidité) : vous pouvez vous entraîner indéfiniment, hors ligne. La correction s\'appuie sur les règles du plan, et les réponses sont vérifiées sur les bougies réellement tracées.</p>' +
      '<div class="seg concept" id="fConcepts">' +
      Object.keys(E.CONCEPTS).map(function (id) {
        return '<button class="seg-btn' + (etat.concept === id ? ' active' : '') + '" data-concept="' + attr(id) + '">' + esc(E.CONCEPTS[id]) + '</button>';
      }).join('') + '</div>' +
      '<div id="fZoneEntraineur">' + entraineurHTML(p) + '</div>' +
      '</div></section>';
    return html;
  }

  function entraineurHTML(p) {
    var E = global.Entraineur;
    if (!etat.scenario) {
      return '<div class="ent-vide"><p>Choisissez un concept, puis lancez un graphique.</p>' +
        '<button class="btn primary" id="fTirer">Nouveau graphique</button></div>';
    }
    var sc = etat.scenario;
    var qs = sc.questions;
    var i = Math.min(etat.index, qs.length - 1);
    var q = qs[i];
    var fini = etat.fini;
    var rep = etat.reponses[i];

    var html = '<div class="ent-barre">' +
      '<span class="ent-nom">' + esc(sc.nom) + '</span>' +
      '<span class="muted small">tirage n° ' + sc.graine + ' · ' + sc.bougies.length + ' bougies · question ' + (i + 1) + ' sur ' + qs.length + '</span>' +
      '<span class="ent-points">' + etat.reponses.filter(function (r) { return r && r.correct; }).length + ' / ' + qs.length + '</span>' +
      '</div>';

    html += '<div class="ent-graphique-boite" id="fGraphique" data-question="' + attr(q.type) + '">' +
      E.rendreGraphique(sc, { correction: etat.correction, clic: etat.clic }) +
      (q.type === 'zone' && !rep ? '<p class="ent-consigne">Cliquez sur la zone demandée, directement dans le graphique.</p>' : '') +
      '</div>';

    html += '<div class="ent-question">';
    html += '<p class="ent-intitule">' + esc(q.intitule) + '</p>';
    if (q.type === 'qcm') {
      html += '<div class="ent-choix">' + q.choix.map(function (c) {
        var classe = 'ent-choix-btn';
        if (rep) {
          if (c.id === q.bonne) classe += ' bonne';
          else if (rep.reponse === c.id) classe += ' mauvaise';
          else classe += ' neutre';
        }
        return '<button class="' + classe + '" data-choix="' + attr(c.id) + '"' + (rep ? ' disabled' : '') + '>' + esc(c.label) + '</button>';
      }).join('') + '</div>';
    }
    if (rep) {
      html += '<div class="ent-retour ' + (rep.correct ? 'ok' : 'ko') + '">' +
        '<b>' + (rep.correct ? 'Juste.' : 'Pas tout à fait.') + '</b> ' + esc(rep.explication || '') +
        (!rep.correct && rep.bonneReponse && q.type === 'qcm' ? ' <em>Réponse attendue : ' + esc(rep.bonneReponse) + '.</em>' : '') +
        '</div>';
      if (i < qs.length - 1) html += '<button class="btn primary" id="fSuivante">Question suivante</button>';
      else html += '<div class="ent-fin"><b>Graphique terminé : ' +
        etat.reponses.filter(function (r) { return r && r.correct; }).length + ' / ' + qs.length + '.</b> ' +
        (etat.correction ? 'Les repères sont affichés sur le graphique.' : 'Affichez la correction pour voir les repères (zones, BOS, sommets).') +
        '</div>';
    }
    html += '</div>';

    html += '<div class="ent-actions">' +
      '<button class="btn' + (etat.correction ? '' : ' ghost') + '" id="fCorrection">' + (etat.correction ? 'Masquer la correction' : 'Voir la correction') + '</button>' +
      '<button class="btn primary" id="fTirer">Nouveau graphique</button>' +
      '<button class="btn ghost" id="fRelire">Relire la leçon du chapitre lié</button>' +
      (global.Graphe && global.Graphe.actif(planReglages()) ? '<button class="btn ghost" id="fReel">' + UI.icon('link') + ' Comparer sur un graphique réel</button>' : '') +
      '</div>';

    var e = p.entraineur;
    html += '<p class="muted small">Bilan entraîneur : ' + e.essais + ' graphique(s), ' + e.questions + ' question(s), ' + e.bonnes + ' juste(s), série en cours ' + e.serie + ', meilleure série ' + e.meilleureSerie + '.</p>';
    return html;
  }

  function tirer(App) {
    var E = global.Entraineur;
    var liste = E.listeModeles(etat.concept);
    var modele = liste[Math.floor(Math.random() * liste.length)];
    var graine = 1 + Math.floor(Math.random() * 999999);
    etat.scenario = E.scenario(modele, graine);
    etat.index = 0;
    etat.reponses = [];
    etat.clic = null;
    etat.correction = false;
    etat.fini = false;
    var p = lire();
    p.entraineur.essais++;
    p.entraineur.parConcept[etat.concept] = p.entraineur.parConcept[etat.concept] || { essais: 0, questions: 0, bonnes: 0 };
    p.entraineur.parConcept[etat.concept].essais++;
    ecrire(p);
    return etat.scenario;
  }

  function repondre(reponse, detail, App) {
    var E = global.Entraineur;
    if (!etat.scenario) return;
    var q = etat.scenario.questions[etat.index];
    if (etat.reponses[etat.index]) return;
    var verdict = E.corriger(q, reponse);
    etat.reponses[etat.index] = { correct: verdict.correct, reponse: reponse, explication: verdict.explication, bonneReponse: verdict.bonneReponse };
    if (detail) etat.clic = detail;

    var p = lire();
    var e = p.entraineur;
    e.questions++;
    var concept = p.entraineur.parConcept[etat.concept] || (p.entraineur.parConcept[etat.concept] = { essais: 0, questions: 0, bonnes: 0 });
    concept.questions++;
    if (verdict.correct) {
      e.bonnes++; concept.bonnes++;
      e.serie++;
      if (e.serie > e.meilleureSerie) e.meilleureSerie = e.serie;
    } else {
      e.serie = 0;
    }
    if (etat.index >= etat.scenario.questions.length - 1) etat.fini = true;
    ecrire(p);
  }

  /* ---------------------------------------------------------
     Chapitre : leçon + exercices
     --------------------------------------------------------- */
  function chapitreHTML(c, p) {
    var prog = chapitreProgression(p, c.id);
    var s = scoreQcm(p, c);
    var html = '<details class="chap' + (prog.vu ? ' vu' : '') + '" id="chap-' + attr(c.id) + '"' + (etat.ouverts[c.id] ? ' open' : '') + '>' +
      '<summary><span class="chap-num">' + esc(c.num) + '</span>' +
      '<span class="chap-titre">' + esc(c.titre) + '</span>' +
      '<span class="chap-meta">' + (s.repondu ? badge(s.bonnes + ' / ' + s.total + ' juste(s)', s.bonnes === s.total ? 'ok' : 'flat') : '') +
      (prog.vu ? badge('étudié', 'flat') : '') + '</span></summary>' +
      '<div class="chap-corps">' +
      '<p class="chap-source">Source : ' + esc(c.source) + '</p>' +
      '<p class="chap-essentiel"><b>L\'essentiel.</b> ' + esc(c.essentiel) + '</p>';

    (c.lecons || []).forEach(function (l) {
      html += '<div class="lecon"><h4>' + esc(l.titre) + '</h4><p>' + esc(l.texte) + '</p>';
      if (l.points && l.points.length) {
        html += '<ul>' + l.points.map(function (pt) { return '<li>' + esc(pt) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
    });

    if (c.graphique) html += bloc('Sur le graphique', 'graphique', '<p>' + esc(c.graphique) + '</p>');
    if (c.etapes) html += bloc('Étapes à suivre', 'etapes', '<ol>' + c.etapes.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ol>');
    if (c.erreurs) html += bloc('Erreurs fréquentes', 'erreurs', '<ul>' + c.erreurs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>');

    if (c.exercices && c.exercices.length) {
      html += '<div class="quiz" data-chapitre="' + attr(c.id) + '"><h4>Exercices notés — ' + c.exercices.length + ' question(s)</h4>';
      c.exercices.forEach(function (ex, i) {
        var repondu = prog.qcm[i];
        html += '<div class="quiz-q" data-q="' + i + '">' +
          '<p class="quiz-intitule">' + (i + 1) + '. ' + esc(ex.q) + '</p>' +
          '<div class="quiz-choix">' + ex.choix.map(function (ch, k) {
            var classe = 'quiz-btn';
            if (repondu !== undefined) {
              if (k === ex.bonne) classe += ' bonne';
              else if (repondu === false && prog.qcmDernier === k) classe += ' mauvaise';
              else classe += ' neutre';
            }
            return '<button class="' + classe + '" data-choix="' + k + '"' + (repondu !== undefined ? ' disabled' : '') + '>' + esc(ch) + '</button>';
          }).join('') + '</div>' +
          '<div class="quiz-correction"' + (repondu !== undefined ? '' : ' hidden') + '>' +
          '<b>' + (repondu ? 'Juste.' : 'À revoir.') + '</b> ' + esc(ex.explication) + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    if (c.id === 'risque') html += blocCalculs(p);

    if (c.entraineur) {
      html += '<div class="chap-action"><button class="btn primary" data-entraineur="' + attr(c.entraineur) + '">S\'entraîner sur ce concept : ' +
        esc(global.Entraineur.CONCEPTS[c.entraineur] || c.entraineur) + '</button></div>';
    }
    html += '</div></details>';
    return html;
  }
  function bloc(titre, classe, contenu) {
    return '<div class="bloc ' + classe + '"><h4>' + esc(titre) + '</h4>' + contenu + '</div>';
  }

  /* ---------------------------------------------------------
     Exercices de calcul (risque et money management)
     --------------------------------------------------------- */
  function tirageCalcul() {
    var capital = (5 + Math.floor(Math.random() * 16)) * 1000;          // 5 000 à 20 000
    var risquePct = [0.25, 0.5, 1][Math.floor(Math.random() * 3)];
    var pips = 5 + Math.floor(Math.random() * 11);                       // 5 à 15 pips
    var pipLot = 10;
    var R = capital * risquePct / 100;
    var lots = R / (pips * pipLot);
    return {
      capital: capital, risquePct: risquePct, pips: pips, pipLot: pipLot,
      R: Math.round(R * 100) / 100,
      lots: Math.round(lots * 100) / 100,
      depasse: pips > 15
    };
  }
  var calcul = null;

  function blocCalculs(p) {
    if (!calcul) calcul = tirageCalcul();
    var c = calcul;
    return '<div class="calculs" id="fCalculs"><h4>Exercice de calcul — taille de position</h4>' +
      '<p class="calcul-enonce">Capital <b>' + c.capital + ' €</b> · risque <b>' + c.risquePct + ' %</b> · stop à <b>' + c.pips + ' pips</b> · pip à ' + c.pipLot + ' € par lot.</p>' +
      '<div class="calcul-lignes">' +
      '<label>Risque en devise (R) : <input class="input input-sm" id="fR" inputmode="decimal" placeholder="€"><span class="muted small">&nbsp;€</span></label>' +
      '<label>Taille de position : <input class="input input-sm" id="fLots" inputmode="decimal" placeholder="lots"><span class="muted small">&nbsp;lots</span></label>' +
      '</div>' +
      '<div class="form-actions"><button class="btn primary" id="fVerifCalcul">Vérifier</button>' +
      '<button class="btn ghost" id="fAutreCalcul">Nouvel énoncé</button>' +
      '<span class="muted small">Résultats de calcul : ' + p.calculs.bonnes + ' / ' + p.calculs.total + '</span></div>' +
      '<div class="quiz-correction" id="fCalculRetour" hidden></div></div>';
  }

  function verifierCalcul(App) {
    var c = calcul;
    var r = parseFloat(String((document.getElementById('fR') || {}).value || '').replace(',', '.'));
    var l = parseFloat(String((document.getElementById('fLots') || {}).value || '').replace(',', '.'));
    var okR = isFinite(r) && Math.abs(r - c.R) <= Math.max(0.5, c.R * 0.01);
    var okL = isFinite(l) && Math.abs(l - c.lots) <= Math.max(0.02, c.lots * 0.02);
    var p = lire();
    p.calculs.total++;
    if (okR && okL) p.calculs.bonnes++;
    ecrire(p);

    var zone = document.getElementById('fCalculRetour');
    if (zone) {
      zone.hidden = false;
      zone.className = 'quiz-correction ' + (okR && okL ? 'ok' : 'ko');
      zone.innerHTML = '<b>' + (okR && okL ? 'Juste.' : 'Reprenons le calcul.') + '</b> ' +
        'R = capital × taux de risque = ' + c.capital + ' × ' + c.risquePct + ' % = <b>' + c.R + ' €</b>. ' +
        'Taille = R ÷ (distance au stop × valeur du pip) = ' + c.R + ' ÷ (' + c.pips + ' × ' + c.pipLot + ') = <b>' + c.lots + ' lot(s)</b>.';
    }
    var compteur = document.querySelector('#fCalculs .form-actions .muted');
    if (compteur) compteur.textContent = 'Résultats de calcul : ' + p.calculs.bonnes + ' / ' + p.calculs.total;
    return okR && okL;
  }

  /* ---------------------------------------------------------
     Câblage des interactions
     --------------------------------------------------------- */
  function cabler(host, App) {
    // en-tête : ouvrir le chapitre conseillé
    host.querySelectorAll('[data-chap]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = host.querySelector('#chap-' + b.dataset.chap);
        if (d) { d.open = true; etat.ouverts[b.dataset.chap] = true; marquerVu(b.dataset.chap, App); d.scrollIntoView({ block: 'start' }); }
      });
    });

    // déplier / remettre à zéro
    var tout = host.querySelector('#fToutOuvrir');
    if (tout) tout.addEventListener('click', function () {
      host.querySelectorAll('details.chap').forEach(function (d) { d.open = true; etat.ouverts[d.id.replace('chap-', '')] = true; });
      UI.toast('Tous les chapitres sont dépliés : l\'impression donnera le manuel complet.', 'success', 6000);
    });
    var remise = host.querySelector('#fRemise');
    if (remise) remise.addEventListener('click', function () {
      UI.confirmDialog({
        title: 'Remettre la progression à zéro ?',
        message: 'Les scores de cours, les calculs et le bilan de l\'entraîneur sont effacés. Les leçons restent en place.',
        confirmLabel: 'Remettre à zéro',
        onConfirm: function () { reinitialiser(); UI.toast('Progression remise à zéro.'); App.render(); }
      });
    });

    // chapitres : marquer comme vu à l'ouverture
    host.querySelectorAll('details.chap').forEach(function (d) {
      d.addEventListener('toggle', function () {
        var id = d.id.replace('chap-', '');
        etat.ouverts[id] = d.open;
        if (d.open) marquerVu(id, App);
      });
    });

    // QCM des chapitres
    host.querySelectorAll('.quiz').forEach(function (quiz) {
      var id = quiz.dataset.chapitre;
      var chapitre = global.FormationContenu.chapitres.filter(function (c) { return c.id === id; })[0];
      if (!chapitre) return;
      quiz.querySelectorAll('.quiz-q').forEach(function (blocQ) {
        var i = Number(blocQ.dataset.q);
        var ex = chapitre.exercices[i];
        blocQ.querySelectorAll('.quiz-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var choix = Number(btn.dataset.choix);
            var p = lire();
            var prog = chapitreProgression(p, id);
            if (prog.qcm[i] !== undefined) return;
            prog.qcm[i] = choix === ex.bonne;
            prog.qcmDernier = choix;
            prog.vu = true;
            ecrire(p);
            App.render();
          });
        });
      });
    });

    // exercices de calcul
    var verif = host.querySelector('#fVerifCalcul');
    if (verif) verif.addEventListener('click', function () { verifierCalcul(App); });
    var autre = host.querySelector('#fAutreCalcul');
    if (autre) autre.addEventListener('click', function () { calcul = tirageCalcul(); App.render(); });

    // entraîneur : choix du concept
    host.querySelectorAll('#fConcepts .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        etat.concept = b.dataset.concept;
        etat.scenario = null; etat.index = 0; etat.reponses = []; etat.correction = false; etat.clic = null;
        App.render();
      });
    });
    // boutons de l'entraîneur et boutons « s'entraîner » des chapitres
    host.querySelectorAll('[data-entraineur]').forEach(function (b) {
      b.addEventListener('click', function () {
        etat.concept = b.dataset.entraineur;
        etat.scenario = null; etat.index = 0; etat.reponses = []; etat.correction = false; etat.clic = null;
        App.render();
        var zone = document.getElementById('entraineur');
        if (zone) zone.scrollIntoView({ block: 'start' });
      });
    });
    rafraichirEntraineur(host, App);
  }

  function rafraichirEntraineur(host, App) {
    var zone = host.querySelector('#fZoneEntraineur');
    if (!zone) return;
    var p = lire();
    zone.innerHTML = entraineurHTML(p);
    var tirer = zone.querySelector('#fTirer');
    if (tirer) tirer.addEventListener('click', function () {
      tirer_(App);
      rafraichirEntraineur(host, App);
    });
    var suivante = zone.querySelector('#fSuivante');
    if (suivante) suivante.addEventListener('click', function () {
      etat.index++;
      etat.clic = null;
      rafraichirEntraineur(host, App);
    });
    var corr = zone.querySelector('#fCorrection');
    if (corr) corr.addEventListener('click', function () {
      etat.correction = !etat.correction;
      rafraichirEntraineur(host, App);
    });
    var relire = zone.querySelector('#fRelire');
    if (relire) relire.addEventListener('click', function () {
      var chapitre = chapitreDuConcept(etat.concept);
      if (!chapitre) return;
      var d = document.getElementById('chap-' + chapitre.id);
      if (d) { d.open = true; etat.ouverts[chapitre.id] = true; d.scrollIntoView({ block: 'start' }); }
    });
    var reel = zone.querySelector('#fReel');
    if (reel) reel.addEventListener('click', ouvrirGraphiqueReel);
    zone.querySelectorAll('.ent-choix-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        repondre(b.dataset.choix, null, App);
        rafraichirEntraineur(host, App);
      });
    });
    // clic sur le graphique pour les questions de zone
    var boite = zone.querySelector('#fGraphique');
    if (boite && boite.dataset.question === 'zone' && !etat.reponses[etat.index]) {
      var svg = boite.querySelector('svg');
      if (svg) svg.addEventListener('click', function (ev) {
        var rect = svg.getBoundingClientRect();
        var point = global.Entraineur.clicVersPrix(etat.scenario, rect, ev.clientX, ev.clientY);
        repondre(point, point, App);
        rafraichirEntraineur(host, App);
      });
    }
  }
  function tirer_(App) { tirer(App); }

  function chapitreDuConcept(concept) {
    var liste = global.FormationContenu.chapitres.filter(function (c) { return c.entraineur === concept; });
    if (liste.length) return liste[0];
    if (concept === 'zones') return global.FormationContenu.chapitres.filter(function (c) { return c.id === 'offre-demande'; })[0];
    if (concept === 'liquidite') return global.FormationContenu.chapitres.filter(function (c) { return c.id === 'liquidite'; })[0];
    if (concept === 'bos') return global.FormationContenu.chapitres.filter(function (c) { return c.id === 'structure'; })[0];
    if (concept === 'wyckoff') return global.FormationContenu.chapitres.filter(function (c) { return c.id === 'setups'; })[0];
    return null;
  }

  function marquerVu(id, App) {
    var p = lire();
    var c = chapitreProgression(p, id);
    if (c.vu) return;
    c.vu = true;
    ecrire(p);
  }

  function carteSources() {
    var m = global.FormationContenu.manques || [];
    var s = global.FormationContenu.sources || [];
    return '<details class="chap sources"><summary><span class="chap-num">i</span><span class="chap-titre">Sources et points à compléter</span></summary>' +
      '<div class="chap-corps"><div class="lecon"><h4>Documents utilisés</h4><ul>' +
      s.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="bloc erreurs"><h4>Ce qui reste à compléter</h4><ul>' +
      m.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<p class="muted small">Le cours reprend le vocabulaire des documents (HH/HL, LH/LL, BOS, ChoCh, EQH/EQL, SPRING, UTAD, inducement, intact). Lorsqu\'un point du livre n\'était pas exploitable en texte (captures d\'écran), un exercice de l\'entraîneur le remplace.</p>' +
      '</div></details>';
  }

  /* ---------------------------------------------------------
     API + enregistrement de la vue
     --------------------------------------------------------- */
  global.Formation = {
    rendre: rendre,
    lire: lire,
    ecrire: ecrire,
    reinitialiser: reinitialiser,
    chapitresVus: chapitresVus,
    tauxEntraineur: tauxEntraineur,
    tirageCalcul: tirageCalcul,
    CLE: CLE,
    /* réservé aux recettes */
    __test: {
      etat: etat,
      chapitreProgression: chapitreProgression,
      scoreQcm: scoreQcm,
      entraineurHTML: entraineurHTML,
      repondre: repondre,
      cabler: cabler
    }
  };
  global.Views = global.Views || {};
  global.Views.formation = rendre;
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Formation;
})(typeof window !== 'undefined' ? window : globalThis);
