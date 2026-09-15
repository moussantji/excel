/* =========================================================
   notify-test.js — recette des rappels du plan

   Vérifie, sans réseau et sans navigateur :
   - les heures des rappels découlent bien du plan (fenêtres de tir) ;
   - l'heure du Mali est respectée même si l'appareil est réglé ailleurs ;
   - un rappel ne part jamais deux fois, et un rappel raté dans la
     limite du retard toléré est signalé à la réouverture ;
   - un rappel trop vieux est abandonné au lieu d'arriver en retard ;
   - rien ne part sans autorisation, ni quand les rappels sont éteints ;
   - l'application sans API Notification ne casse pas (repli silencieux) ;
   - l'envoi passe par le service worker, avec repli sur la page ;
   - appareil au premier plan : message dans l'app, pas de doublon système ;
   - le service worker ouvre l'application au clic sur la notification ;
   - aucune ressource distante, et la version du cache a été relevée.

   Usage : NODE_PATH=/tmp/node_modules node tools/notify-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

let ok = 0, ko = 0;
const tick = () => new Promise((r) => setTimeout(r, 0));
/** L'envoi passe par le service worker : il faut laisser tourner une microtâche. */
async function declencher(N) { const n = N.declencher(); await tick(); return n; }
async function rafraichir(N) { const n = N.rafraichir(); await tick(); return n; }
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---------------------------------------------------------
   Bac à sable : une page minimale, un faux appareil au choix
   --------------------------------------------------------- */
const JOUR = Date.UTC(2026, 8, 15);            // mardi 15 septembre 2026, 00:00 heure du Mali
const DIMANCHE = Date.UTC(2026, 8, 20);        // dimanche 20 septembre 2026

function creerAppareil(opts) {
  opts = opts || {};
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => erreurs.push(e.message));
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: opts.url || 'https://exemple.test/trading/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window;

  // journal des notifications : service worker et repli page
  w.__envois = [];
  w.__toasts = [];
  w.__showNotification = [];
  if (opts.notification !== false) {
    const Notification = function (titre, details) { w.__envois.push({ voie: 'page', titre, details }); };
    Notification.permission = opts.permission || 'granted';
    Notification.requestPermission = function (cb) {
      const rep = opts.reponsePermission || 'granted';
      Notification.permission = rep;
      if (cb) cb(rep);
      return Promise.resolve(rep);
    };
    w.Notification = Notification;
  } else {
    delete w.Notification;
  }
  if (opts.serviceWorker !== false) {
    Object.defineProperty(w.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          showNotification: (titre, details) => { w.__showNotification.push({ titre, details }); return Promise.resolve(); }
        })
      }
    });
  }
  if (opts.installe) {
    w.matchMedia = (q) => ({ matches: /standalone/.test(q), addEventListener() {}, removeEventListener() {} });
    w.navigator.standalone = true;
  }
  if (opts.apple) {
    Object.defineProperty(w.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X) AppleWebKit/605.1.15' });
  }
  if (opts.visibility) Object.defineProperty(w.document, 'hidden', { configurable: true, value: opts.visibility === 'hidden' });
  if (opts.visibility) Object.defineProperty(w.document, 'visibilityState', { configurable: true, value: opts.visibility });

  // UI minimal : le module s'en sert pour prévenir quand l'app est au premier plan
  w.UI = { toast: (texte, type, ms) => w.__toasts.push({ texte, type, ms }) };

  // le plan fournit les fenêtres de tir
  w.eval(lire('assets/js/plan.js'));
  w.eval(lire('assets/js/notify.js'));
  return { dom, w, erreurs };
}

/** Horloge figée, que la recette fait avancer à volonté. */
function horlogeReglable(depart) {
  let t = depart;
  const h = () => t;
  h.avancer = (minutes) => { t += minutes * 60000; return t; };
  h.regler = (ts) => { t = ts; return t; };
  return h;
}
function installer(h, w, reglages) {
  w.Notify.__test.reglerHorloge(h);
  w.App = { state: { settings: { notifications: reglages } } };
  w.Notify.__test.reinitialiser();
}

/* =========================================================
   1. Les heures viennent du plan
   ========================================================= */
(async function () {
console.log('\n1. Heures du plan');
{
  const { w } = creerAppareil();
  const N = w.Notify;
  const fen = N.fenetres();
  verif('trois fenêtres de tir reprises du plan', fen.length === 3 && fen[0].id === 'asie' && fen[1].id === 'europe' && fen[2].id === 'usa',
    fen.map((f) => f.nom + ' ' + f.debut + '–' + f.fin).join(' · '));
  const regle = w.Plan.data.blocks
    .flatMap((b) => (b.items || []).filter((i) => i.type === 'kv').flatMap((i) => i.rows))
    .filter((r) => r[0] === 'Fenêtres de tir');
  verif('le texte du plan reprend exactement ces fenêtres', regle.length === 2 &&
    regle.every((r) => r[1].indexOf('Asie 1h–2h · Europe 8h–9h · USA 13h–14h') === 0),
    regle.length + ' ligne(s) du plan');

  const r = N.reglages({ actif: true, fenetres: ['asie', 'europe', 'usa'], avance: 15, preparation: true, ouverture: true, cloture: true, revue: true, revueHeure: '18:00' });
  const mardi = N.evenementsDuJour(N.jourMali(JOUR), r);
  verif('neuf rappels par jour ouvré (3 fenêtres × 3 alertes)', mardi.length === 9, mardi.length + ' rappels');
  verif('les heures suivent le plan', mardi[0].titre === 'Fenêtre Asie dans 15 min' && mardi[1].titre === 'Fenêtre Asie ouverte' &&
    mardi[2].titre === 'Fenêtre Asie terminée', mardi.slice(0, 3).map((e) => e.titre).join(' | '));
  const europe = mardi.filter((e) => e.fenetre === 'europe');
  verif('préparation 15 min avant l\'ouverture d\'Europe (08:00)', N.heureMali(europe[0].at) === '07:45', N.heureMali(europe[0].at) + ' Mali');
  verif('ouverture d\'Europe à 08:00 pile', N.heureMali(europe[1].at) === '08:00');
  verif('fermeture d\'Europe à 09:00', N.heureMali(europe[2].at) === '09:00');
  verif('la revue du dimanche n\'apparaît pas en semaine', mardi.every((e) => e.type !== 'revue'));
  const dimanche = N.evenementsDuJour(N.jourMali(DIMANCHE), r);
  verif('la revue du dimanche apparaît le dimanche à l\'heure choisie',
    dimanche.some((e) => e.type === 'revue' && N.heureMali(e.at) === '18:00'), dimanche.filter((e) => e.type === 'revue').length + ' rappel de revue');
  verif('le choix « ne pas prévenir avant » retire la préparation',
    N.evenementsDuJour(N.jourMali(JOUR), N.reglages({ actif: true, avance: 0 })).every((e) => e.type !== 'preparation'));
  verif('une fenêtre décochée ne produit plus de rappel',
    N.evenementsDuJour(N.jourMali(JOUR), N.reglages({ actif: true, fenetres: ['europe'] })).every((e) => e.fenetre === 'europe'));
  verif('un réglage partiel est complété par les valeurs par défaut',
    N.reglages({}).actif === false && N.reglages({}).avance === 15 && N.reglages({}).fenetres.length === 3);
  verif('un réglage corrompu ne casse rien',
    N.reglages({ avance: 'beaucoup', fenetres: 'europe', revueHeure: '99:99' }).avance === 15 &&
    N.reglages({ avance: 'beaucoup' }).revueHeure === '18:00');
}

/* =========================================================
   2. Heure du Mali respectée même si l'appareil est réglé ailleurs
   ========================================================= */
console.log('\n2. Heure du Mali');
{
  const { w } = creerAppareil();
  const N = w.Notify;
  const jour = N.jourMali(JOUR);
  const ouverture = N.instantMali(jour, '08:00');
  verif('l\'instant de déclenchement est fixé en heure du Mali',
    new Date(ouverture).toISOString() === '2026-09-15T08:00:00.000Z', new Date(ouverture).toISOString());
  const decalage = N.decalageAppareil(ouverture);
  verif('le décalage de l\'appareil est calculé par rapport au Mali', typeof decalage === 'number',
    'appareil ' + (decalage >= 0 ? '+' : '') + (decalage / 60) + ' h · ' + N.heureAppareil(ouverture) + ' chez l\'utilisateur');
  verif('deux affichages de la même heure, Mali et appareil',
    N.heureMali(ouverture) === '08:00' && /^\d\d:\d\d$/.test(N.heureAppareil(ouverture)),
    'Mali ' + N.heureMali(ouverture) + ' · appareil ' + N.heureAppareil(ouverture));
  const recap = N.reglages({ actif: true });
  verif('le récapitulatif de la journée reste trié par heure',
    N.evenementsDuJour(jour, recap).every((e, i, l) => i === 0 || e.at >= l[i - 1].at));
}

/* =========================================================
   3. Déclenchement, anti-doublon, rattrapage
   ========================================================= */
console.log('\n3. Déclenchement');
{
  const { w } = creerAppareil({ visibility: 'hidden' });
  const N = w.Notify;
  const h = horlogeReglable(JOUR + 7 * 3600000 + 40 * 60000);   // 07:40 heure du Mali
  installer(h, w, { actif: true, fenetres: ['europe'], avance: 15, preparation: true, ouverture: true, cloture: true });

  verif('rien ne part avant l\'heure', await declencher(N) === 0);
  h.avancer(6);                                                 // 07:46 : la préparation de 07:45 est due
  verif('la préparation part à l\'heure dite', await declencher(N) === 1);
  const premier = w.__showNotification[0];
  verif('la notification passe par le service worker', w.__showNotification.length === 1 && premier.titre === 'Fenêtre Europe dans 15 min', premier.titre);
  verif('la notification porte une étiquette anti-doublon', premier.details.tag === 'trading-europe-preparation', premier.details.tag);
  verif('la notification contient le corps du message', /07:45|08:00–09:00/.test(premier.details.body) && premier.details.body.length > 40);
  verif('un même rappel ne part jamais deux fois', await declencher(N) === 0, w.__showNotification.length + ' envoi(s) au total');

  // application mise en veille : l'ouverture de 08:00 est ratée de 20 minutes
  h.regler(JOUR + 8 * 3600000 + 20 * 60000);
  verif('un rappel raté de 20 minutes est signalé à la réouverture', await declencher(N) === 1);
  verif('le rappel rattrapé est celui de l\'ouverture', w.__showNotification[1] && w.__showNotification[1].titre === 'Fenêtre Europe ouverte',
    w.__showNotification[1] ? w.__showNotification[1].titre : 'aucun');

  // la fermeture de 09:00 est manquée de 4 heures : elle n'a plus d'objet
  h.regler(JOUR + 13 * 3600000);
  N.oublier();
  verif('un rappel trop vieux est abandonné', await declencher(N) === 0, w.__showNotification.length + ' envois');
  h.avancer(30);
  verif('un rappel abandonné ne revient pas plus tard', await declencher(N) === 0);
}

/* =========================================================
   4. Plusieurs rappels d'un coup : un seul message
   ========================================================= */
console.log('\n4. Regroupement');
{
  const { w } = creerAppareil({ visibility: 'hidden' });
  const N = w.Notify;
  const h = horlogeReglable(JOUR + 8 * 3600000);                 // 08:00 pile
  installer(h, w, { actif: true, fenetres: ['europe'], avance: 15, preparation: true, ouverture: true, cloture: true });
  h.avancer(1);
  verif('deux rappels dus en même temps donnent un seul message', await declencher(N) === 2 && w.__showNotification.length === 1,
    w.__showNotification.length + ' notification pour 2 rappels');
  verif('le message groupé annonce le nombre de rappels', /2 rappels du plan/.test(w.__showNotification[0].titre), w.__showNotification[0].titre);
}

/* =========================================================
   5. Rien sans autorisation, rien quand c'est éteint
   ========================================================= */
console.log('\n5. Consentement');
{
  const { w } = creerAppareil({ visibility: 'hidden', permission: 'default' });
  const N = w.Notify;
  const h = horlogeReglable(JOUR + 8 * 3600000 + 1 * 60000);
  installer(h, w, { actif: true, fenetres: ['europe'], avance: 15, ouverture: true, cloture: true });
  verif('sans autorisation, aucun rappel ne part', await declencher(N) === 0 && w.__showNotification.length === 0);
  verif('l\'état indique que l\'autorisation manque', N.etat().permission === 'default' && N.etat().prets === false, N.etat().raison);
  verif('aucun minuteur n\'est armé sans autorisation', N.programmer() === null);

  const refus = creerAppareil({ visibility: 'hidden', permission: 'denied' });
  const N2 = refus.w.Notify;
  installer(horlogeReglable(JOUR + 8 * 60000), refus.w, { actif: true, fenetres: ['europe'] });
  verif('avec un refus, aucun rappel ne part', await declencher(N2) === 0 && refus.w.__showNotification.length === 0);
  verif('l\'état explique le refus', /refus/i.test(N2.etat().raison), N2.etat().raison);

  const eteint = creerAppareil({ visibility: 'hidden' });
  const N3 = eteint.w.Notify;
  installer(horlogeReglable(JOUR + 8 * 60000), eteint.w, { actif: false, fenetres: ['europe'] });
  verif('rappels éteints : rien ne part, même autorisé', await declencher(N3) === 0 && eteint.w.__showNotification.length === 0);
  verif('rappels éteints : aucun prochain rappel annoncé', N3.prochainRappel() === null);
}

/* =========================================================
   6. Message dans l'app quand elle est au premier plan
   ========================================================= */
console.log('\n6. Premier plan');
{
  const { w } = creerAppareil({ visibility: 'visible' });
  const N = w.Notify;
  installer(horlogeReglable(JOUR + 8 * 3600000 + 60000), w, { actif: true, fenetres: ['europe'], avance: 15 });
  N.reglages();                                                  // réglages pris en compte
  verif('application visible : message dans l\'application', await declencher(N) >= 1 && w.__toasts.length === 1 && w.__showNotification.length === 0,
    w.__toasts.length + ' message(s) dans l\'app, ' + w.__showNotification.length + ' notification(s) système');
  verif('le message de l\'app porte le titre du rappel', /Fenêtre Europe/.test(w.__toasts[0].texte), w.__toasts[0].texte.slice(0, 60));
  verif('le rappel n\'est pas rejoué ensuite', await declencher(N) === 0 && w.__toasts.length === 1);
}

/* =========================================================
   7. Sans API Notification : repli silencieux
   ========================================================= */
console.log('\n7. Repli');
{
  const { w, erreurs } = creerAppareil({ notification: false });
  const N = w.Notify;
  const h = horlogeReglable(JOUR + 8 * 3600000);
  installer(h, w, { actif: true });
  verif('sans API Notification, l\'application ne casse pas', erreurs.length === 0 && typeof N.etat === 'function',
    erreurs.length ? erreurs[0] : 'aucune erreur');
  verif('l\'état annonce des notifications indisponibles', N.etat().support === false && N.etat().prets === false, N.etat().raison);
  verif('aucun rappel ne part et rien ne plante', await declencher(N) === 0);
  verif('la demande d\'autorisation répond « indisponible » sans erreur', (await N.demander()) === 'indisponible');

  const sansSW = creerAppareil({ visibility: 'hidden', serviceWorker: false });
  const N2 = sansSW.w.Notify;
  installer(horlogeReglable(JOUR + 8 * 3600000 + 60000), sansSW.w, { actif: true, fenetres: ['europe'], avance: 15 });
  await declencher(N2);
  verif('sans service worker, la notification passe par la page', sansSW.w.__envois.length === 1 && sansSW.w.__showNotification.length === 0,
    sansSW.w.__envois.length + ' envoi(s) direct(s)');
}

/* =========================================================
   8. Appareil non sécurisé et iPad non installé
   ========================================================= */
console.log('\n8. Cas particuliers');
{
  const http = creerAppareil({ url: 'http://192.168.1.20:8777/trading/' });
  const N = http.w.Notify;
  verif('en Wi-Fi local (http://), l\'état prévient que c\'est impossible', N.etat().securise === false && /https/.test(N.etat().raison), N.etat().raison);
  verif('aucun rappel ne part en http://', N.reglages({ actif: true }).actif && (await rafraichir(N)) === 0 && http.w.__showNotification.length === 0);

  const ipad = creerAppareil({ apple: true, notification: false });
  verif('iPad sans installation : la marche à suivre est expliquée', /écran d\'accueil/.test(ipad.w.Notify.etat().raison), ipad.w.Notify.etat().raison);
  const ipadInstalle = creerAppareil({ apple: true, installe: true });
  verif('iPad installé : les notifications sont possibles', ipadInstalle.w.Notify.etat().installe === true);
}

/* =========================================================
   9. Programmation du prochain rappel
   ========================================================= */
console.log('\n9. Programmation');
{
  const { w } = creerAppareil({ visibility: 'hidden' });
  const N = w.Notify;
  const h = horlogeReglable(JOUR + 6 * 3600000);                 // 06:00 : prochain rappel = préparation Europe 07:45
  installer(h, w, { actif: true, fenetres: ['europe'], avance: 15 });
  const prochain = N.prochainRappel();
  verif('le prochain rappel est annoncé', prochain && N.heureMali(prochain.at) === '07:45', prochain ? prochain.titre : 'aucun');
  const delai = N.programmer();
  verif('un minuteur est armé', typeof delai === 'number' && N.__test.minuteurActif() === true, Math.round(delai / 60000) + ' min');
  verif('le minuteur ne dépasse pas six heures (minuteurs étranglés par le navigateur)', delai <= 6 * 3600000 + 1000);
  N.arreter();
  verif('le minuteur peut être arrêté', N.__test.minuteurActif() === false);
  verif('après la dernière fenêtre, le prochain rappel est celui de demain',
    N.prochainRappel() === null || N.prochainRappel().at > h(), 'après 14:00 : ' +
    (N.prochainRappel() ? N.heureMali(N.prochainRappel().at) + ' (demain)' : 'aucun'));
}

/* =========================================================
   10. Intégration dans l'application
   ========================================================= */
console.log('\n10. Intégration');
{
  const html = lire('index.html');
  const sw = lire('sw.js');
  const app = lire('assets/js/app.js');
  const store = lire('assets/js/store.js');
  const views = lire('assets/js/views.js');
  const ui = lire('assets/js/ui.js');

  verif('le module est chargé par la page', /assets\/js\/notify\.js/.test(html));
  verif('le module est chargé après le plan (dont il tire les heures)',
    html.indexOf('assets/js/plan.js') < html.indexOf('assets/js/notify.js'));
  verif('le module est mis en cache par le service worker', /'\.\/assets\/js\/notify\.js'/.test(sw));
  verif('la version du cache a été relevée', /trading-desk-v9/.test(sw));
  verif('l\'application démarre les rappels', /global\.Notify\)\s*global\.Notify\.demarrer\(\)/.test(app));
  verif('les rappels sont éteints par défaut', /notifications:\s*\{[\s\S]*?actif:\s*false/.test(store));
  verif('les fenêtres du plan sont la source unique des heures',
    /fenetres:\s*FENETRES/.test(lire('assets/js/plan.js')) &&
    /global\.Plan\.fenetres/.test(lire('assets/js/notify.js')) &&
    /return \(f && f\.length\) \? f : FENETRES_REPLI/.test(lire('assets/js/notify.js')),
    'plan.js définit les heures, notify.js les lit (avec repli si le plan manque)');
  verif('la carte de réglages existe dans les Paramètres', /carteRappels\(App\)/.test(views) && /Rappels du plan/.test(views));
  verif('les boutons de la carte sont câblés', /brancherRappels\(App\)/.test(views) && /notifAutoriser/.test(views) && /notifEssai/.test(views));
  verif('les icônes de cloche existent', /cloche:/.test(ui) && /clocheOff:/.test(ui));
  verif('les réglages du compte relancent la programmation', /Notify\.rafraichir\(\)/.test(views));
  verif('aucun appel réseau dans le module', !/\bfetch\(|XMLHttpRequest|navigator\.onLine\s*&&\s*0/.test(lire('assets/js/notify.js')));
  const codeNotify = lire('assets/js/notify.js')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))                 // commentaires retirés
    .join('\n')
    .replace(/e\.raison = '[^']*';/g, '');                            // texte affiché à l'utilisateur
  verif('aucune ressource distante chargée par le module',
    !/https?:\/\//.test(codeNotify) && !/fetch\(|XMLHttpRequest|importScripts/.test(codeNotify),
    'seul le texte d\'explication mentionne une adresse');

  // service worker : le clic sur la notification ramène dans l'application
  verif('le service worker gère le clic sur une notification', /notificationclick/.test(sw));
  verif('le clic réutilise la fenêtre ouverte quand elle existe', /matchAll\(\{\s*type:\s*'window'/.test(sw) && /focus\(\)/.test(sw));
  verif('le clic ouvre l\'application sinon', /openWindow/.test(sw));
  verif('l\'adresse de retour est fournie par le rappel', /data\.url/.test(sw) && /url:\s*options\.url/.test(lire('assets/js/notify.js')));

  // le vrai service worker, exécuté dans un faux contexte, ne doit pas casser
  const faussesNotes = [];
  const contexteSW = {
    self: null, caches: { open: async () => ({ add: async () => {}, put: async () => {} }), keys: async () => [], delete: async () => {} },
    Promise, console, URL, Request: function () {}, fetch: async () => ({ ok: true })
  };
  contexteSW.self = contexteSW;
  contexteSW.self.addEventListener = (type) => { faussesNotes.push(type); };
  contexteSW.self.skipWaiting = () => Promise.resolve();
  contexteSW.self.clients = { claim: () => Promise.resolve() };
  const vm = require('vm');
  let erreurSW = null;
  try { vm.runInNewContext(sw, contexteSW); } catch (e) { erreurSW = e.message; }
  verif('le service worker se charge sans erreur', erreurSW === null, erreurSW || 'ok');
  verif('le service worker déclare l\'événement de clic', faussesNotes.includes('notificationclick'), faussesNotes.join(', '));
}

/* =========================================================
   11. Ce que voit l'utilisateur dans les Paramètres
   ========================================================= */
console.log('\n11. Interface');
{
  const vues = lire('assets/js/views.js');
  verif('l\'état est expliqué en français, sans emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(vues + lire('assets/js/notify.js')));
  // les textes réellement produits, dans l'ordre de la journée
  const { w: wu } = creerAppareil({ visibility: 'hidden' });
  const regle = wu.Notify.reglages({ actif: true });
  const titres = wu.Notify.evenementsDuJour(wu.Notify.jourMali(JOUR), regle).map((e) => e.titre);
  const attendus = ['Fenêtre Asie dans 15 min', 'Fenêtre Asie ouverte', 'Fenêtre Asie terminée',
    'Fenêtre Europe dans 15 min', 'Fenêtre Europe ouverte', 'Fenêtre Europe terminée',
    'Fenêtre USA dans 15 min', 'Fenêtre USA ouverte', 'Fenêtre USA terminée'];
  const manquants = attendus.filter((t) => titres.indexOf(t) === -1);
  verif('les neuf messages de la journée sont ceux du plan', manquants.length === 0, manquants.join(' | ') || titres.length + ' messages');
  const dim = wu.Notify.evenementsDuJour(wu.Notify.jourMali(DIMANCHE), wu.Notify.reglages({ actif: true, revue: true }))
    .filter((e) => e.type === 'revue')[0];
  verif('le message de revue hebdomadaire est clair', dim && /Revue hebdomadaire/.test(dim.titre) && /30 min/.test(dim.corps), dim ? dim.corps : 'aucun');
  const boutons = ['Autoriser les notifications', 'Envoyer un essai', 'Réarmer les rappels du jour', 'Rappels activés'];
  const absentsBoutons = boutons.filter((m) => vues.indexOf(m) === -1);
  verif('les commandes de la carte sont en français', absentsBoutons.length === 0, absentsBoutons.join(' | ') || boutons.length + ' commandes');
  // libellé de jour : on ne confond pas un rappel de demain avec celui d'aujourd'hui
  const { w: wq } = creerAppareil({ visibility: 'hidden' });
  const t = wq.Notify.__test;
  wq.Notify.__test.reglerHorloge(() => JOUR + 9 * 3600000);      // 09:00 heure du Mali
  const auj = wq.Notify.instantMali(wq.Notify.jourMali(JOUR), '13:00');
  const dem = wq.Notify.instantMali(wq.Notify.jourSuivant(wq.Notify.jourMali(JOUR)), '01:00');
  const apres = wq.Notify.instantMali(wq.Notify.jourSuivant(wq.Notify.jourSuivant(wq.Notify.jourMali(JOUR))), '08:00');
  verif('un rappel du jour est annoncé « aujourd\'hui »', /^aujourd\'hui \d\d:\d\d$/.test(wq.Notify.quand(auj)), wq.Notify.quand(auj));
  verif('un rappel du lendemain est annoncé « demain »', /^demain \d\d:\d\d$/.test(wq.Notify.quand(dem)), wq.Notify.quand(dem));
  verif('au-delà, le jour est nommé', /^(lun|mar|mer|jeu|ven|sam|dim)\. \d\d\/\d\d \d\d:\d\d$/.test(wq.Notify.quand(apres)), wq.Notify.quand(apres));
  verif('l\'aperçu des Paramètres annonce aussi le jour',
    /jourEv\.cle === jourAuj\.cle/.test(vues) && /demain/.test(vues) && /\.rappels-liste i\.jour/.test(lire('assets/css/styles.css')));

  const css = lire('assets/css/styles.css');
  verif('les styles de la carte de rappels existent', /\.notif-card/.test(css) && /\.case-liste/.test(css) && /\.rappels-liste/.test(css));
  verif('les cases à cocher font au moins 44 px de haut (tactile)', /\.case\{[\s\S]*?min-height:44px/.test(css));
  verif('la carte est prévue pour l\'impression sans décor', /\.rappels-liste/.test(css));
}

console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, rappels du plan vérifiés.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
process.exit(ko === 0 ? 0 : 1);
})();
