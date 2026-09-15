/* =========================================================
   sync-test.js — recette de la sauvegarde cloud (dépôt GitHub)

   Lance l'application dans JSDOM avec un faux GitHub (fetch simulé)
   et vérifie les 12 états, l'envoi, la récupération, les conflits et
   la fusion.

   Usage : node tools/sync-test.js   (jsdom requis : NODE_PATH=/tmp/node_modules)
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---------- faux dépôt GitHub ---------- */
function fauxGitHub() {
  const etat = { fichier: null, sha: 1, statutForce: null, appels: [], reseau: false };
  function reponse(statut, corps, entetes) {
    return {
      ok: statut >= 200 && statut < 300,
      status: statut,
      headers: { get: (n) => (entetes && entetes[n.toLowerCase()]) || null },
      text: () => Promise.resolve(corps === null || corps === undefined ? '' : JSON.stringify(corps))
    };
  }
  function fetchSimule(url, options) {
    options = options || {};
    etat.appels.push(options.method + ' ' + url);
    if (etat.reseau) return Promise.reject(new TypeError('Failed to fetch'));
    if (etat.statutForce) { const s = etat.statutForce; etat.statutForce = null; return Promise.resolve(reponse(s, { message: s === 403 ? 'API rate limit exceeded' : 'Refus simulé' })); }

    const u = String(url);
    if (/\/repos\/[^/]+\/[^/]+$/.test(u)) {
      return Promise.resolve(reponse(200, { full_name: 'demo/journal-trading', private: etat.prive !== false, permissions: { push: etat.push !== false } }, {}));
    }
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      if (etat.fichier && body.sha !== etat.sha) return Promise.resolve(reponse(409, { message: 'sha mismatch' }));
      if (!etat.fichier && body.sha) return Promise.resolve(reponse(409, { message: 'sha mismatch' }));
      etat.fichier = Buffer.from(body.content, 'base64').toString('utf8');
      etat.sha = 'sha-' + (++etat.compteur || 1);
      return Promise.resolve(reponse(201, { content: { sha: etat.sha } }, {}));
    }
    if (etat.fichier === null) return Promise.resolve(reponse(404, { message: 'Not Found' }, {}));
    const contenu = etat.fichier;
    if (options.headers && /raw/.test(options.headers.Accept || '')) return Promise.resolve(reponse(200, contenu, {}));
    return Promise.resolve(reponse(200, {
      sha: etat.sha, size: contenu.length,
      content: Buffer.from(contenu, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n')
    }, {}));
  }
  etat.fetch = fetchSimule;
  etat.reponse = reponse;
  return etat;
}

/* ---------- application dans JSDOM ---------- */
function demarrer(github) {
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const vc = new VirtualConsole();
  const erreurs = [];
  vc.on('jsdomError', (e) => {
    // « Not implemented » : fonctions d'affichage absentes de JSDOM, sans rapport avec l'application
    if (!/Not implemented/.test(e.message)) erreurs.push(e.message);
  });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: undefined,
    virtualConsole: vc,
    url: 'https://moussantji.github.io/excel/trading/',
    pretendToBeVisual: true
  });
  const w = dom.window;
  w.fetch = (url, o) => github.fetch(url, o);
  w.AbortController = w.AbortController || function () { this.signal = null; this.abort = function () {}; };
  // les scripts sont injectés à la main : JSDOM ne va pas les chercher sur le réseau
  const srcs = Array.from(w.document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src'));
  srcs.forEach((src) => {
    const code = fs.readFileSync(path.join(RACINE, src), 'utf8');
    const el = w.document.createElement('script');
    el.textContent = code;
    w.document.body.appendChild(el);
  });
  if (w.document.readyState === 'loading') {
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  }
  return { dom, w, erreurs, srcs };
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const github = fauxGitHub();
  const { w, erreurs, srcs } = demarrer(github);
  const S = w.Sync, App = w.App, UI = w.UI;

  console.log('\n0. Chargement');
  verif('sync.js est chargé par index.html', srcs.indexOf('assets/js/sync.js') > -1, srcs.indexOf('assets/js/sync.js') + 1 + '/' + srcs.length);
  verif('module Sync présent', !!S);
  verif('aucune erreur JS au démarrage', erreurs.length === 0, erreurs.join(' | '));
  if (!S) { process.exit(1); }

  /* ---------- 1. états d'erreur hors configuration ---------- */
  console.log('\n1. États d\'erreur — avant configuration');
  verif('état « off »', S.status().code === 'off', S.status().label);
  verif('pastille masquée quand rien n\'est configuré', w.document.getElementById('topSync').hidden === true);

  /* ---------- 2. jeton refusé (401) ---------- */
  console.log('\n2. Jeton refusé');
  S.saveConfig({ owner: 'demo', repo: 'journal-trading', branch: 'main', path: 'journal-trading/sauvegarde.json', token: 'github_pat_faux', enabled: true });
  github.statutForce = 401;
  let r = await S.tester();
  verif('tester() échoue', r.ok === false, r.error && r.error.message);
  verif('état « auth »', S.status().code === 'auth', S.status().label);
  w.App.render();
  let bandeau = w.document.getElementById('syncBanner');
  verif('bandeau d\'erreur affiché', bandeau.hidden === false);
  verif('bandeau de ton rouge', bandeau.className.indexOf('ko') > -1, bandeau.className);
  verif('bouton « Réessayer » proposé', /Réessayer/.test(bandeau.innerHTML));
  verif('explication du jeton', /Contents/.test(bandeau.innerHTML));
  verif('pastille visible et en erreur', w.document.getElementById('topSync').classList.contains('ko') === true);

  /* ---------- 3. dépôt introuvable (404) ---------- */
  github.statutForce = 404;
  r = await S.tester();
  verif('état « auth » sur 404', S.status().code === 'auth', S.status().error.message);

  /* ---------- 4. quota GitHub (403 rate limit) ---------- */
  github.statutForce = 403;
  r = await S.tester();
  verif('état « quota » sur 403 rate limit', S.status().code === 'quota', S.status().label);

  /* ---------- 5. serveur injoignable (500) ---------- */
  github.statutForce = 500;
  r = await S.tester();
  verif('état « server » sur 5xx', S.status().code === 'server', S.status().label);

  /* ---------- 6. réseau coupé ---------- */
  github.reseau = true;
  r = await S.tester();
  verif('état « offline » sans réseau', S.status().code === 'offline', S.status().label);
  verif('message d\'erreur réseau', r.error.code === 'offline');
  github.reseau = false;

  /* ---------- 7. connexion réussie, fichier absent ---------- */
  console.log('\n7. Connexion réussie — première sauvegarde');
  r = await S.tester();
  verif('tester() réussit', r.ok === true, r.depose);
  verif('dépôt privé détecté', r.prive === true);
  verif('fichier absent au départ', r.existe === false);
  verif('état « empty »', S.status().code === 'empty', S.status().label);

  // 3 trades réels + 2 trades de démonstration
  const modele = w.Store.normalizeTrade({ date: '2026-09-10', symbol: 'EURUSD', direction: 'achat', entry: 1.1, stop: 1.0985, exit: 1.1105, lots: 1 }, w.App.state.settings);
  w.App.state.trades = [
    Object.assign({}, modele, { id: 'T1', updatedAt: '2026-09-10T10:00:00Z' }),
    Object.assign({}, modele, { id: 'T2', updatedAt: '2026-09-10T11:00:00Z' }),
    Object.assign({}, modele, { id: 'T3', updatedAt: '2026-09-10T12:00:00Z' }),
    Object.assign({}, modele, { id: 'D1', demo: true, updatedAt: '2026-09-10T13:00:00Z' }),
    Object.assign({}, modele, { id: 'D2', demo: true, updatedAt: '2026-09-10T14:00:00Z' })
  ];
  w.App.state.settings.capital = 12345;
  w.Plan.saveChecks({ 'c-1': { fait: true } });
  const p = await S.pousser({ force: true });
  verif('envoi réussi', p.ok === true);
  const charge = JSON.parse(github.fichier);
  verif('fichier écrit dans le dépôt', !!charge && charge.app === 'journal-trading');
  verif('3 trades réels envoyés', charge.trades.length === 3, charge.trades.map((t) => t.id).join(','));
  verif('trades de démonstration exclus', charge.trades.every((t) => !t.demo));
  verif('paramètres du compte inclus', charge.settings.capital === 12345);
  verif('checklists incluses', !!(charge.checks && charge.checks['c-1'] && charge.checks['c-1'].fait));
  verif('appareil renseigné', !!charge.device, charge.device);
  verif('état « ok » après envoi', S.status().code === 'ok', S.status().label);
  w.App.render();
  verif('bandeau masqué quand tout va bien', w.document.getElementById('syncBanner').hidden === true);

  /* ---------- 8. pastille + libellé en clair ---------- */
  console.log('\n8. Affichage de l\'état');
  const pastille = w.document.getElementById('topSync');
  verif('pastille visible', pastille.hidden === false);
  verif('pastille de ton vert', pastille.classList.contains('ok') === true);
  verif('libellé lisible', /À jour/.test(pastille.textContent), pastille.textContent.trim());

  /* ---------- 9. modifications en attente puis envoi automatique ---------- */
  console.log('\n9. Envoi différé');
  w.App.state.trades.push(Object.assign({}, modele, { id: 'T4', updatedAt: '2026-09-11T09:00:00Z' }));
  w.App.persist();
  verif('état « pending » après modif', S.status().code === 'pending', S.status().label);
  w.App.render();
  verif('bandeau masqué pour « pending » (pas d\'action)', w.document.getElementById('syncBanner').hidden === true);
  const p2 = await S.syncNow();
  verif('envoi manuel réussi', p2.ok === true);
  verif('4 trades dans le cloud', JSON.parse(github.fichier).trades.length === 4);

  /* ---------- 6 bis. hors ligne : travailler puis resynchroniser ---------- */
  console.log('\n9 bis. Travail hors ligne');
  Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
  github.appels.length = 0;
  const avantHorsLigne = github.fichier;
  const modeleHL = w.Store.normalizeTrade({ date: '2026-09-14', symbol: 'GBPUSD', direction: 'vente', entry: 1.27, stop: 1.2715, exit: 1.262, lots: 1 }, w.App.state.settings);
  w.App.state.trades.push(Object.assign({}, modeleHL, { id: 'H1', updatedAt: '2026-09-14T09:00:00Z' }));
  w.App.persist();
  verif('trade enregistré sans réseau', w.App.state.trades.filter(function (t) { return t.id === 'H1'; }).length === 1);
  verif('trade conservé dans le navigateur', /GBPUSD/.test(w.localStorage.getItem('journal-trading:v1') || ''));
  const stHL = S.status();
  verif('état « hors ligne »', stHL.code === 'offline', stHL.label);
  verif('modifications en attente annoncées', /modification/.test(stHL.label), stHL.label);
  const envoye = await S.syncNow();
  verif('aucun envoi tant que le réseau est coupé', envoye.ok === false && envoye.error.code === 'offline');
  verif('aucun appel réseau effectué', github.appels.length === 0, github.appels.length + ' appels');
  verif('la sauvegarde distante n\'a pas bougé', github.fichier === avantHorsLigne);
  w.App.render();
  const bandeauHL = w.document.getElementById('syncBanner');
  verif('bandeau hors ligne affiché', bandeauHL.hidden === false && /Hors ligne/.test(bandeauHL.innerHTML));
  verif('bouton Réessayer proposé', /Réessayer/.test(bandeauHL.innerHTML));
  verif('l\'application reste utilisable (écran rendu)', w.document.getElementById('view').innerHTML.length > 500);

  // le réseau revient
  Object.defineProperty(w.navigator, 'onLine', { value: true, configurable: true });
  w.dispatchEvent(new w.Event('online'));
  await attendre(150);
  verif('reprise automatique au retour du réseau', github.appels.length > 0, github.appels.length + ' appels');
  verif('le trade hors ligne est parti dans le dépôt', (github.fichier || '').indexOf('GBPUSD') > -1);
  verif('état revenu à « ok »', S.status().code === 'ok', S.status().label);
  // on retire le trade du test hors ligne et on propage la suppression (comme le ferait l'utilisateur)
  w.App.state.trades = w.App.state.trades.filter(function (t) { return t.id !== 'H1'; });
  w.App.state.deleted = (w.App.state.deleted || []).concat([{ id: 'H1', at: new Date().toISOString() }]);
  w.App.persist();
  const nettoyage = await S.syncNow({ force: true });
  const idsDistant = (JSON.parse(github.fichier || '{}').trades || []).map(function (t) { return t.id; });
  verif('nettoyage du trade de test', nettoyage.ok === true && idsDistant.indexOf('H1') === -1, idsDistant.join(','));

  /* ---------- 10. deuxième appareil : conflit ---------- */
  console.log('\n10. Conflit entre deux appareils');
  // l'autre appareil a ajouté un trade et poussé sa version
  const distant = JSON.parse(github.fichier);
  distant.trades.push(Object.assign({}, modele, { id: 'T9', updatedAt: '2026-09-12T08:00:00Z' }));
  distant.updatedAt = new Date(Date.now() + 60000).toISOString();
  github.fichier = JSON.stringify(distant);
  github.sha = 'sha-distant';
  w.App.state.trades.push(Object.assign({}, modele, { id: 'T5', updatedAt: '2026-09-12T09:00:00Z' }));
  w.App.persist();
  const pc = await S.syncNow();
  verif('conflit signalé', pc.ok === false && pc.conflict === true);
  verif('état « conflict »', S.status().code === 'conflict', S.status().label);
  w.App.render();
  bandeau = w.document.getElementById('syncBanner');
  verif('bandeau de conflit affiché', bandeau.hidden === false && /conflit/i.test(bandeau.innerHTML));
  verif('trois choix proposés', /Fusionner/.test(bandeau.innerHTML) && /Garder mes données/.test(bandeau.innerHTML) && /Prendre le cloud/.test(bandeau.innerHTML));
  const lisible = Array.from(bandeau.querySelectorAll('button')).map((b) => b.textContent);
  verif('boutons cliquables', lisible.length === 3, lisible.join(' / '));

  /* ---------- 11. fusion ---------- */
  console.log('\n11. Fusion des deux versions');
  const pf = await S.resoudre('fusion');
  verif('fusion réussie', pf.ok === true, pf.trades + ' trades');
  const apres = JSON.parse(github.fichier);
  const ids = apres.trades.map((t) => t.id).sort().join(',');
  verif('les deux appareils réunis', ids === 'T1,T2,T3,T4,T5,T9', ids);
  verif('état « ok » après fusion', S.status().code === 'ok', S.status().label);
  verif('démonstration toujours exclue', apres.trades.every((t) => !t.demo));

  /* ---------- 12. récupération sur un appareil neuf ---------- */
  console.log('\n12. Récupération (appareil neuf)');
  w.App.state.trades = [];
  w.App.state.deleted = [];
  w.Plan.saveChecks({});
  const pt = await S.tirer();
  verif('récupération réussie', pt.ok === true);
  verif('trades restaurés', w.App.state.trades.filter((t) => !t.demo).length === 6, String(w.App.state.trades.length));
  verif('paramètres restaurés', w.App.state.settings.capital === 12345);
  verif('cases des checklists restaurées', w.Plan.loadChecks()['c-1'].fait === true);
  verif('état « ok »', S.status().code === 'ok');

  /* ---------- 13. pierre tombale : suppression propagée ---------- */
  console.log('\n13. Suppression propagée entre appareils');
  w.App.state.trades = w.App.state.trades.filter((t) => t.id !== 'T2');
  w.App.state.deleted = [{ id: 'T2', at: new Date().toISOString() }];
  w.App.persist();
  const ps = await S.syncNow();
  verif('suppression envoyée', ps.ok === true);
  const sansT2 = JSON.parse(github.fichier);
  verif('le trade supprimé n\'est plus dans le cloud', sansT2.trades.every((t) => t.id !== 'T2'));
  verif('pierre tombale conservée', sansT2.deleted.some((d) => d.id === 'T2'));
  const fusionTest = S.fusionnerCharges(
    { trades: [], deleted: [{ id: 'T2', at: '2026-09-14T10:00:00Z' }], updatedAt: '2026-09-14T10:00:00Z' },
    { trades: [{ id: 'T2', updatedAt: '2026-09-13T10:00:00Z' }], deleted: [], updatedAt: '2026-09-13T10:00:00Z' });
  verif('une suppression faite ailleurs ne ressuscite pas le trade', fusionTest.trades.length === 0);
  const fusionGarde = S.fusionnerCharges(
    { trades: [], deleted: [{ id: 'T2', at: '2026-09-14T10:00:00Z' }], updatedAt: '2026-09-14T10:00:00Z' },
    { trades: [{ id: 'T2', updatedAt: '2026-09-15T10:00:00Z' }], deleted: [], updatedAt: '2026-09-15T10:00:00Z' });
  verif('un trade recréé après coup est bien conservé', fusionGarde.trades.length === 1);

  /* ---------- 14. dépôt public averti ---------- */
  console.log('\n14. Garde-fous');
  github.prive = false; github.push = false;
  const testPublic = await S.tester();
  verif('dépôt public détecté', testPublic.prive === false);
  verif('absence de droit d\'écriture détectée', testPublic.pousse === false);
  const vue = w.Views;
  w.App.state.view = 'params';
  w.App.render();
  const html = w.document.getElementById('view').innerHTML;
  verif('carte « Sauvegarde cloud » présente', /Sauvegarde cloud \(GitHub\)/.test(html));
  verif('boutons de la carte présents', /id="cfSync"/.test(html) && /id="cfPull"/.test(html) && /id="cfOff"/.test(html));
  verif('journal des opérations affiché', /Dernières opérations/.test(html));
  verif('interrupteur de sauvegarde automatique', /id="cfAuto"/.test(html) && /checked/.test(html));
  verif('tableau des états possibles', /cloud-etats/.test(html) && /Quota GitHub/.test(html));
  verif('aucune mention trompeuse « aucun envoi »', !/aucun envoi sur un serveur/.test(html));
  verif('chemin du dépôt affiché', /demo\/journal-trading/.test(html));

  /* ---------- 14 bis. nouvel appareil : proposition de récupération ---------- */
  console.log('\n14 bis. Nouvel appareil');
  github.prive = true; github.push = true;
  const memoire = w.App.state.trades.slice();
  await S.syncNow({ force: true });      // le cloud contient bien les 6 trades
  // tablette vierge : aucun trade, aucun historique de synchronisation
  w.App.state.trades = [];
  w.App.persist();
  S.reset();
  const pr = await S.syncNow();
  verif('sauvegarde distante détectée', pr.ok === true && pr.distant === true);
  verif('état « remote »', S.status().code === 'remote', S.status().label);
  w.App.render();
  bandeau = w.document.getElementById('syncBanner');
  verif('bandeau de récupération affiché', bandeau.hidden === false);
  verif('bouton « Récupérer la sauvegarde »', /Récupérer la sauvegarde/.test(bandeau.innerHTML));
  verif('le journal local n\'est pas écrasé sans confirmation', w.App.state.trades.length === 0);
  w.App.state.trades = memoire;

  /* ---------- 15. désactivation ---------- */
  console.log('\n15. Désactivation');
  S.clearConfig();
  verif('configuration effacée', S.isConfigured() === false);
  verif('jeton oublié', S.loadConfig().token === '');
  w.App.render();
  verif('pastille masquée', w.document.getElementById('topSync').hidden === true);
  verif('carte revenue au formulaire', /cfToken/.test(w.document.getElementById('view').innerHTML));

  /* ---------- 16. les 12 états sont tous prévus ---------- */
  console.log('\n16. États définis');
  const styles = fs.readFileSync(path.join(RACINE, 'assets/css/styles.css'), 'utf8');
  const etats = ['off', 'empty', 'offline', 'pending', 'syncing', 'ok', 'remote', 'conflict', 'auth', 'quota', 'server', 'error'];
  const etats2 = etats.concat(['locked']);   // « locked » : journal verrouillé, sauvegarde en pause
  const manquants2 = etats2.filter((e) => !new RegExp("^\\s*" + e + ":\\s*\\{", 'm').test(fs.readFileSync(path.join(RACINE, 'assets/js/sync.js'), 'utf8')));
  verif('13 états déclarés (12 + journal verrouillé)', manquants2.length === 0, manquants2.join(','));
  verif('bandeau stylé pour chaque ton', /\.sync-banner\.warn/.test(styles) && /\.sync-banner\.ko/.test(styles) && /\.sync-banner\.info/.test(styles));
  verif('pastille stylée', /\.sync-chip\.ok/.test(styles) && /\.sync-chip\.ko/.test(styles));
  verif('service worker en v7', /trading-desk-v8/.test(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8')));
  verif('lock.js en cache hors ligne', /assets\/js\/lock\.js/.test(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8')));
  verif('sync.js dans le cache hors ligne', /assets\/js\/sync\.js/.test(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8')));
  verif('aucune erreur JS sur toute la session', erreurs.length === 0, erreurs.join(' | '));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, aucune erreur JS.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})().catch((e) => { console.error('\nErreur du test :', e && e.stack || e); process.exit(1); });
