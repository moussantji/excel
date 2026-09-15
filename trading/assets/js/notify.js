/* =========================================================
   notify.js — Rappels du plan en notifications système

   Aux heures du plan (fenêtres de tir SMV, heure de Bamako) :
   - préparation : quelques minutes avant l'ouverture
   - ouverture   : la fenêtre s'ouvre
   - fermeture   : la fenêtre se ferme, place à la saisie du journal
   - revue       : revue hebdomadaire du dimanche (facultatif)

   Rien n'est envoyé vers l'extérieur : les notifications sont
   fabriquées par l'appareil lui-même (Notification API / service
   worker). Aucun serveur, aucun compte, aucun tiers.

   Limite assumée : une application fermée ne peut pas se réveiller
   toute seule sans serveur de push. Les rappels partent donc quand
   l'application est ouverte (y compris en arrière-plan), et les
   rappels manqués sont signalés à la réouverture.
   ========================================================= */
(function (global) {
  'use strict';

  var CLE_JOURNAL = 'journal-trading:notifications';
  var JOURS_GARDES = 8;

  /* Le Mali est à UTC+0 toute l'année : l'heure du plan est donc
     directement l'heure UTC, quel que soit le réglage de l'appareil. */
  var FUSEAU_MALI = 0;

  /* Retard toléré avant qu'un rappel ne soit considéré comme périmé
     (une alerte sur une fenêtre terminée depuis longtemps n'a plus d'objet). */
  var RETARD_MAX = { preparation: 30, ouverture: 60, cloture: 180, revue: 360 };

  var FENETRES_REPLI = [
    { id: 'asie', nom: 'Asie', court: 'Asie 1h–2h', debut: '01:00', fin: '02:00' },
    { id: 'europe', nom: 'Europe', court: 'Europe 8h–9h', debut: '08:00', fin: '09:00' },
    { id: 'usa', nom: 'USA', court: 'USA 13h–14h', debut: '13:00', fin: '14:00' }
  ];

  var REGLAGES_DEFAUT = {
    actif: false,
    fenetres: ['asie', 'europe', 'usa'],
    avance: 15,
    preparation: true,
    ouverture: true,
    cloture: true,
    revue: false,
    revueHeure: '18:00'
  };
  var AVANCES_POSSIBLES = [0, 5, 10, 15, 30];
  var MINUTEUR_MAX = 6 * 3600 * 1000;   // au-delà, les navigateurs étranglent les minuteurs : on reprogramme
  var ICONE = 'assets/icons/icon-192.png';

  var minuteur = null;
  var demarre = false;
  var horloge = null;                   // horloge injectable (recette)
  var journal = null;                   // trace des rappels déjà partis

  /* ---------------------------------------------------------
     Outils de temps (heure du Mali)
     --------------------------------------------------------- */
  function maintenant() { return typeof horloge === 'function' ? horloge() : Date.now(); }

  /** Jour du Mali (calendrier) correspondant à un instant. */
  function jourMali(ts) {
    var d = new Date((ts === undefined ? maintenant() : ts) + FUSEAU_MALI * 60000);
    return {
      annee: d.getUTCFullYear(), mois: d.getUTCMonth(), jour: d.getUTCDate(),
      cle: d.toISOString().slice(0, 10), jourSemaine: d.getUTCDay()
    };
  }
  function jourDepuis(annee, mois, jour) {
    var d = new Date(Date.UTC(annee, mois, jour));
    return {
      annee: d.getUTCFullYear(), mois: d.getUTCMonth(), jour: d.getUTCDate(),
      cle: d.toISOString().slice(0, 10), jourSemaine: d.getUTCDay()
    };
  }
  function jourSuivant(jour) { return jourDepuis(jour.annee, jour.mois, jour.jour + 1); }

  /** Instant (timestamp) d'une heure du Mali pour un jour du Mali donné. */
  function instantMali(jour, hhmm) {
    var p = String(hhmm || '00:00').split(':');
    return Date.UTC(jour.annee, jour.mois, jour.jour, Number(p[0]) || 0, Number(p[1]) || 0, 0, 0);
  }

  /** Décalage de l'appareil par rapport à l'heure du Mali, en minutes. */
  function decalageAppareil(ts) {
    var d = new Date(ts === undefined ? maintenant() : ts);
    return -d.getTimezoneOffset() - FUSEAU_MALI;
  }
  function zero(n) { return (n < 10 ? '0' : '') + n; }
  /** « 07:45 » à l'heure de l'appareil. */
  function heureAppareil(ts) {
    var d = new Date(ts);
    return zero(d.getHours()) + ':' + zero(d.getMinutes());
  }
  var JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  /** « aujourd'hui 07:45 », « demain 00:45 » ou « dim. 20/09 18:00 ». */
  function quand(ts) {
    var jour = jourMali(ts);
    var auj = jourMali(maintenant());
    if (jour.cle === auj.cle) return 'aujourd\'hui ' + heureAppareil(ts);
    if (jour.cle === jourSuivant(auj).cle) return 'demain ' + heureAppareil(ts);
    return JOURS_COURTS[jour.jourSemaine] + ' ' + zero(jour.jour) + '/' + zero(jour.mois + 1) + ' ' + heureAppareil(ts);
  }

  /** « 07:45 » à l'heure du Mali. */
  function heureMali(ts) {
    var d = new Date(ts + FUSEAU_MALI * 60000);
    return zero(d.getUTCHours()) + ':' + zero(d.getUTCMinutes());
  }

  /* ---------------------------------------------------------
     Réglages
     --------------------------------------------------------- */
  function fenetres() {
    var f = global.Plan && global.Plan.fenetres;
    return (f && f.length) ? f : FENETRES_REPLI;
  }
  function fenetreParId(id) {
    var liste = fenetres();
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  /** Réglages normalisés, quel que soit l'état enregistré (même partiel). */
  function reglages(source) {
    var brut = source || (global.App && global.App.state && global.App.state.settings
      ? global.App.state.settings.notifications : null) || {};
    var r = {};
    r.actif = brut.actif === true;
    r.fenetres = Array.isArray(brut.fenetres)
      ? brut.fenetres.filter(function (id) { return !!fenetreParId(id); })
      : REGLAGES_DEFAUT.fenetres.slice();
    var avance = Number(brut.avance);
    r.avance = AVANCES_POSSIBLES.indexOf(avance) > -1 ? avance : REGLAGES_DEFAUT.avance;
    r.preparation = brut.preparation !== false && r.avance > 0;
    r.ouverture = brut.ouverture !== false;
    r.cloture = brut.cloture !== false;
    r.revue = brut.revue === true;
    r.revueHeure = /^([01]\d|2[0-3]):[0-5]\d$/.test(brut.revueHeure || '') ? brut.revueHeure : REGLAGES_DEFAUT.revueHeure;
    return r;
  }

  /* ---------------------------------------------------------
     État : l'appareil peut-il afficher des notifications ?
     --------------------------------------------------------- */
  function applicationInstallee() {
    try {
      return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
        global.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function estApple() {
    var ua = (global.navigator && global.navigator.userAgent) || '';
    return /iPad|iPhone|iPod/.test(ua) || (ua.indexOf('Mac') > -1 && 'ontouchend' in (global.document || {}));
  }
  function contexteSecurise() {
    var loc = global.location || {};
    var protocole = loc.protocol || '';
    if (protocole === 'https:') return true;
    if (protocole === 'file:') return false;
    var hote = loc.hostname || '';
    if (hote === 'localhost' || hote === '127.0.0.1' || hote === '[::1]') return true;
    return global.isSecureContext === true;
  }
  function supporte() { return !!global.Notification; }
  function permission() {
    if (!supporte()) return 'indisponible';
    var p = global.Notification.permission;
    return (p === 'granted' || p === 'denied') ? p : 'default';
  }

  /** Photographie complète, pour l'interface. */
  function etat() {
    var e = {
      support: supporte(),
      securise: contexteSecurise(),
      permission: permission(),
      installe: applicationInstallee(),
      apple: estApple(),
      serviceWorker: !!(global.navigator && global.navigator.serviceWorker),
      actif: reglages().actif,
      prets: false,
      raison: ''
    };
    if (!e.support) {
      e.raison = (e.apple && !e.installe)
        ? 'Sur iPhone et iPad, les notifications n\'existent que si l\'application est installée : ouvrez-la depuis son icône sur l\'écran d\'accueil.'
        : 'Ce navigateur ne gère pas les notifications.';
    } else if (!e.securise) {
      e.raison = 'Les notifications exigent une adresse sécurisée (https). En Wi-Fi local (http://), elles restent indisponibles.';
    } else if (e.permission === 'denied') {
      e.raison = 'Notifications refusées pour ce site. Autorisez-les dans les réglages du navigateur ou de la tablette, puis revenez ici.';
    } else if (e.permission === 'default') {
      e.raison = 'Autorisation à donner : appuyez sur « Autoriser les notifications ».';
    } else {
      e.raison = 'Autorisation accordée.';
    }
    e.prets = e.support && e.securise && e.permission === 'granted';
    return e;
  }

  /** Demande l'autorisation — à déclencher depuis un geste de l'utilisateur. */
  function demander() {
    if (!supporte()) return Promise.resolve('indisponible');
    if (!contexteSecurise()) return Promise.resolve('non-securise');
    if (global.Notification.permission === 'granted') return Promise.resolve('granted');
    if (global.Notification.permission === 'denied') return Promise.resolve('denied');
    return new Promise(function (res) {
      try {
        // Signature récente (promesse) et ancienne (rappel) : les deux sont couvertes.
        var r = global.Notification.requestPermission(function (rep) { res(rep); });
        if (r && typeof r.then === 'function') r.then(function (rep) { res(rep); });
      } catch (e) { res('erreur'); }
    });
  }

  /* ---------------------------------------------------------
     Envoi
     --------------------------------------------------------- */
  function envoyer(titre, corps, options) {
    options = options || {};
    var details = {
      body: corps,
      tag: options.tag || 'trading-rappel',
      icon: ICONE,
      badge: ICONE,
      silent: false,
      data: { url: options.url || './', type: options.type || '', fenetre: options.fenetre || '' }
    };
    var sw = global.navigator && global.navigator.serviceWorker;
    if (sw && sw.ready) {
      return sw.ready.then(function (reg) {
        if (reg && typeof reg.showNotification === 'function') return reg.showNotification(titre, details);
        return repli(titre, details);
      }).catch(function () { return repli(titre, details); });
    }
    return repli(titre, details);
  }
  function repli(titre, details) {
    try {
      if (!supporte()) return null;
      var n = new global.Notification(titre, details);
      n.onclick = function () { try { if (global.focus) global.focus(); } catch (e) { /* ignore */ } };
      return n;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------
     Journal des rappels (anti-doublon + rattrapage)
     --------------------------------------------------------- */
  function lireJournal() {
    if (journal) return journal;
    journal = {};
    try {
      var brut = global.localStorage && global.localStorage.getItem(CLE_JOURNAL);
      if (brut) {
        var obj = JSON.parse(brut);
        if (obj && typeof obj === 'object') journal = obj;
      }
    } catch (e) { journal = {}; }
    return journal;
  }
  function ecrireJournal() {
    var j = lireJournal();
    var veille = maintenant() - JOURS_GARDES * 86400000;
    var limite = Date.UTC(jourMali(veille).annee, jourMali(veille).mois, jourMali(veille).jour);
    var gardees = {};
    Object.keys(j).forEach(function (cle) {
      var entree = j[cle];
      if (entree && entree.ts && entree.ts >= limite) gardees[cle] = entree;
    });
    journal = gardees;
    try { global.localStorage.setItem(CLE_JOURNAL, JSON.stringify(gardees)); } catch (e) { /* ignore */ }
    return gardees;
  }
  function cleRappel(jourCle, ev) { return jourCle + '|' + ev.fenetre + '|' + ev.type; }
  function dejaTraite(cle) { return !!lireJournal()[cle]; }
  function marquer(cle, etatRappel) {
    lireJournal()[cle] = { etat: etatRappel, ts: maintenant() };
    ecrireJournal();
  }
  /** Efface la trace : les rappels du jour peuvent repartir. */
  function oublier() {
    journal = {};
    try { global.localStorage.removeItem(CLE_JOURNAL); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------
     Composition des rappels
     --------------------------------------------------------- */
  function messagePreparation(f, r) {
    return {
      titre: 'Fenêtre ' + f.nom + ' dans ' + r.avance + ' min',
      corps: f.debut + '–' + f.fin + ' (heure du Mali). Préparez votre biais HTF, vos zones et la taille de position.'
    };
  }
  function messageOuverture(f) {
    return {
      titre: 'Fenêtre ' + f.nom + ' ouverte',
      corps: f.debut + '–' + f.fin + '. Attendez la prise de liquidité, le ChoCh et le BOS. Hors fenêtre, pas d\'entrée.'
    };
  }
  function messageCloture(f) {
    return {
      titre: 'Fenêtre ' + f.nom + ' terminée',
      corps: 'Notez vos trades tant que c\'est frais : setup, session, émotion, erreur, capture.'
    };
  }
  function messageRevue(r) {
    return {
      titre: 'Revue hebdomadaire',
      corps: 'Dimanche, 30 min (' + r.revueHeure + ') : relisez le journal de la semaine et remplissez la checklist de revue.'
    };
  }

  /** Tous les rappels d'un jour du Mali, triés par heure. */
  function evenementsDuJour(jour, r) {
    r = r || reglages();
    var liste = [];
    (r.fenetres || []).forEach(function (id) {
      var f = fenetreParId(id);
      if (!f) return;
      if (r.preparation && r.avance > 0) {
        var mp = messagePreparation(f, r);
        liste.push({ at: instantMali(jour, f.debut) - r.avance * 60000, type: 'preparation', fenetre: f.id,
          titre: mp.titre, corps: mp.corps });
      }
      if (r.ouverture) {
        var mo = messageOuverture(f);
        liste.push({ at: instantMali(jour, f.debut), type: 'ouverture', fenetre: f.id, titre: mo.titre, corps: mo.corps });
      }
      if (r.cloture) {
        var mc = messageCloture(f);
        liste.push({ at: instantMali(jour, f.fin), type: 'cloture', fenetre: f.id, titre: mc.titre, corps: mc.corps });
      }
    });
    if (r.revue && jour.jourSemaine === 0) {
      var mr = messageRevue(r);
      liste.push({ at: instantMali(jour, r.revueHeure), type: 'revue', fenetre: 'hebdo', titre: mr.titre, corps: mr.corps });
    }
    liste.sort(function (a, b) { return a.at - b.at; });
    return liste;
  }

  /** Prochain rappel à venir (aujourd'hui, sinon demain). */
  function prochainRappel() {
    var r = reglages();
    if (!r.actif) return null;
    var t = maintenant();
    var jour = jourMali(t);
    var liste = evenementsDuJour(jour, r).concat(evenementsDuJour(jourSuivant(jour), r));
    for (var i = 0; i < liste.length; i++) if (liste[i].at > t) return liste[i];
    return null;
  }

  /* ---------------------------------------------------------
     Déclenchement
     --------------------------------------------------------- */
  /** Rappels arrivés à échéance, dans la limite du retard toléré. */
  function rappelsDus(margeMinutes) {
    var r = reglages();
    if (!r.actif) return [];
    // Rien ne peut être délivré (autorisation absente ou refusée, http://, navigateur
    // sans notifications) : on ne consomme aucun rappel. Le prochain partira dès que
    // l'appareil sera prêt, tant que la fenêtre du plan reste d'actualité.
    if (!etat().prets) return [];
    var t = maintenant();
    var jour = jourMali(t);
    var dus = [];
    evenementsDuJour(jour, r).forEach(function (ev) {
      var cle = cleRappel(jour.cle, ev);
      if (dejaTraite(cle)) return;
      var retard = (t - ev.at) / 60000;
      if (retard < -(margeMinutes || 0)) return;                 // pas encore l'heure
      if (retard > (RETARD_MAX[ev.type] || 60)) { marquer(cle, 'perime'); return; }   // trop tard : sans objet
      dus.push({ ev: ev, cle: cle });
    });
    return dus;
  }

  /** Plusieurs rappels d'un coup : un seul message, jamais une rafale. */
  function envoyerEnsemble(dus) {
    if (dus.length === 1) {
      var ev = dus[0].ev;
      return envoyer(ev.titre, ev.corps, { tag: 'trading-' + ev.fenetre + '-' + ev.type, type: ev.type, fenetre: ev.fenetre });
    }
    var type = dus[dus.length - 1].ev.type;
    return envoyer(
      dus.length + ' rappels du plan',
      dus.map(function (d) { return d.ev.titre + ' — ' + d.ev.corps; }).join(' · '),
      { tag: 'trading-plan-' + dus.length, type: type, fenetre: '' }
    );
  }

  function enPremierPlan() {
    // Une notification système par-dessus l'application ouverte serait redondante :
    // dans ce cas le rappel s'affiche dans l'application.
    try { return !!(global.document && global.document.visibilityState === 'visible'); } catch (e) { return false; }
  }

  /** Envoie ce qui est dû (système si l'app est en arrière-plan, message sinon). */
  function envoyerDus() {
    var dus = rappelsDus(0.5);
    if (!dus.length) return 0;
    if (enPremierPlan()) {
      if (global.UI && global.UI.toast) {
        var texte = dus.length === 1
          ? dus[0].ev.titre + ' — ' + dus[0].ev.corps
          : dus.map(function (d) { return d.ev.titre; }).join(' · ');
        global.UI.toast(texte, 'info', 9000);
      }
    } else {
      envoyerEnsemble(dus);
    }
    dus.forEach(function (d) { marquer(d.cle, 'envoye'); });
    return dus.length;
  }

  /* ---------------------------------------------------------
     Programmation
     --------------------------------------------------------- */
  function arreter() {
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
  }

  function programmer() {
    arreter();
    if (!reglages().actif || !etat().prets) return null;
    var prochain = prochainRappel();
    if (!prochain) return null;
    var delai = Math.max(250, Math.min(prochain.at - maintenant(), MINUTEUR_MAX));
    minuteur = setTimeout(function () { minuteur = null; declencher(); }, delai);
    return delai;
  }

  function declencher() {
    var n = envoyerDus();
    programmer();
    return n;
  }

  /** À l'ouverture, au retour au premier plan et après un changement de réglage. */
  function rafraichir() {
    var n = envoyerDus();
    programmer();
    return n;
  }

  function demarrer() {
    if (demarre) return;
    demarre = true;
    rafraichir();
    try {
      if (global.document) {
        global.document.addEventListener('visibilitychange', function () {
          if (global.document.hidden) programmer(); else rafraichir();
        });
      }
    } catch (e) { /* ignore */ }
    // Un minuteur peut être étranglé (onglet en arrière-plan, veille) : on revérifie régulièrement.
    try { global.setInterval(function () { declencher(); }, 5 * 60000); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------
     Essai manuel
     --------------------------------------------------------- */
  function tester() {
    var prochain = prochainRappel();
    var corps = prochain
      ? 'Essai réussi. Prochain rappel : ' + prochain.titre + ' — ' + quand(prochain.at) +
        (decalageAppareil(prochain.at) === 0 ? '' : ' (soit ' + heureMali(prochain.at) + ' heure du Mali)') + '.'
      : 'Essai réussi. Activez les rappels ci-dessus pour être prévenu aux heures du plan.';
    return envoyer('Journal de trading — essai', corps, { tag: 'trading-essai', type: 'essai' });
  }

  global.Notify = {
    demarrer: demarrer,
    arreter: arreter,
    rafraichir: rafraichir,
    programmer: programmer,
    declencher: declencher,
    demander: demander,
    tester: tester,
    envoyer: envoyer,
    etat: etat,
    reglages: reglages,
    prochainRappel: prochainRappel,
    evenementsDuJour: evenementsDuJour,
    jourMali: jourMali,
    jourSuivant: jourSuivant,
    instantMali: instantMali,
    heureMali: heureMali,
    heureAppareil: heureAppareil,
    quand: quand,
    decalageAppareil: decalageAppareil,
    fenetres: fenetres,
    oublier: oublier,
    DEFAUT: REGLAGES_DEFAUT,
    AVANCES: AVANCES_POSSIBLES,
    CLE_JOURNAL: CLE_JOURNAL,
    /* réservé à la recette : horloge injectable, minuteur observable */
    __test: {
      reglerHorloge: function (fn) { horloge = fn || null; },
      lireJournal: lireJournal,
      minuteurActif: function () { return !!minuteur; },
      enPremierPlan: enPremierPlan,
      retardMax: RETARD_MAX,
      reinitialiser: function () { arreter(); demarre = false; oublier(); }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Notify;
})(typeof window !== 'undefined' ? window : globalThis);
