/* =========================================================
   lock-test.js — recette du verrouillage et du chiffrement

   Vérifie, dans JSDOM, que :
   - rien n'est lisible en clair quand le verrou est actif (localStorage) ;
   - la sauvegarde cloud part chiffrée (le fichier du dépôt est illisible) ;
   - le code, le code de secours et la biométrie (PRF simulée) ouvrent le journal ;
   - un mauvais code est refusé, avec ralentissement ;
   - l'application ne peut pas écraser la sauvegarde pendant le verrouillage.

   Usage : node tools/lock-test.js   (jsdom requis)
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { webcrypto } = require('crypto');

const RACINE = path.join(__dirname, '..');
const FICHIERS = ['store.js', 'metrics.js', 'charts.js', 'plan.js', 'ui.js', 'views.js', 'sync.js', 'lock.js', 'app.js'];
let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail !== undefined && detail !== '' ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail !== undefined && detail !== '' ? ' — ' + detail : '')); }
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- faux dépôt GitHub (comme pour la sauvegarde cloud) ---------- */
function fauxGitHub() {
  const etat = { fichier: null, sha: 'sha-1', prive: true };
  function reponse(statut, corps) {
    return { ok: statut >= 200 && statut < 300, status: statut, headers: { get: () => null },
      text: () => Promise.resolve(corps == null ? '' : JSON.stringify(corps)) };
  }
  etat.fetch = function (url, options) {
    options = options || {};
    const u = String(url);
    if (/\/repos\/[^/]+\/[^/]+$/.test(u)) return Promise.resolve(reponse(200, { full_name: 'demo/journal-trading', private: etat.prive, permissions: { push: true } }));
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      etat.fichier = Buffer.from(body.content, 'base64').toString('utf8');
      etat.sha = 'sha-' + Math.random().toString(36).slice(2, 8);
      return Promise.resolve(reponse(201, { content: { sha: etat.sha } }));
    }
    if (etat.fichier === null) return Promise.resolve(reponse(404, { message: 'Not Found' }));
    return Promise.resolve(reponse(200, { sha: etat.sha, size: etat.fichier.length,
      content: Buffer.from(etat.fichier, 'utf8').toString('base64') }));
  };
  return etat;
}

/* ---------- WebAuthn simulé, avec PRF (dérivation de clé par Face ID) ---------- */
// Le capteur est partagé entre les « rechargements » : un même appareil garde la même passkey.
const CAPTEUR = { secret: require('crypto').randomBytes(32), credId: require('crypto').randomBytes(16) };

function fauxWebAuthn(w) {
  const secret = CAPTEUR.secret;
  const credId = CAPTEUR.credId;
  const hmac = (salt) => new Uint8Array(require('crypto').createHmac('sha256', secret).update(Buffer.from(salt)).digest());
  const secrets = new Map();
  w.PublicKeyCredential = function () {};
  w.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(true);
  Object.defineProperty(w.navigator, 'credentials', { value: {}, configurable: true });
  w.navigator.credentials.create = (options) => {
    const salt = Buffer.from(options.publicKey.extensions.prf.eval.first);
    secrets.set(Buffer.from(credId).toString('hex'), salt);
    return Promise.resolve({
      rawId: credId.slice(),
      getClientExtensionResults: () => ({ prf: { results: { first: hmac(salt) } } })
    });
  };
  w.navigator.credentials.get = (options) => {
    const salt = Buffer.from(options.publicKey.extensions.prf.eval.first);
    return Promise.resolve({
      rawId: credId.slice(),
      getClientExtensionResults: () => ({ prf: { results: { first: hmac(salt) } } })
    });
  };
  return { secret, credId };
}

/* ---------- application ---------- */
function demarrer(opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const vc = new VirtualConsole();
  const erreurs = [];
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: opts.url || 'https://moussantji.github.io/excel/trading/',
    pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window;
  // JSDOM ne fournit ni WebCrypto complet ni TextEncoder : on les branche sur ceux de Node
  Object.defineProperty(w, 'crypto', { value: opts.sansCrypto ? { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } : webcrypto, configurable: true });
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.JT_KDF_FORCE = 20000;                 // dérivation rapide en test (20 000 tours au lieu de ~700 000)
  if (opts.biometrie) fauxWebAuthn(w);
  if (opts.github) w.fetch = (url, o) => opts.github.fetch(url, o);
  if (opts.storageAvant) opts.storageAvant(w);
  FICHIERS.forEach((f) => {
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(RACINE, 'assets/js', f), 'utf8');
    w.document.body.appendChild(el);
  });
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { dom, w, erreurs };
}

/** Copie le stockage local d'une fenêtre vers la suivante (comme un rechargement de page). */
function vidanger(w) {
  const entrees = {};
  for (let i = 0; i < w.localStorage.length; i++) {
    const k = w.localStorage.key(i);
    entrees[k] = w.localStorage.getItem(k);
  }
  return entrees;
}
function remettre(w, entrees) {
  Object.keys(entrees).forEach((k) => { try { w.localStorage.setItem(k, entrees[k]); } catch (e) { /* ignore */ } });
}

function tresor(w, trades, checks) {
  const modele = w.Store.normalizeTrade({ date: '2026-09-10', symbol: 'EURUSD', direction: 'achat', entry: 1.1, stop: 1.0985, exit: 1.1105, lots: 1 }, w.App.state.settings);
  w.App.state.trades = (trades || 3) === 3
    ? [Object.assign({}, modele, { id: 'T1', updatedAt: '2026-09-10T10:00:00Z' }),
       Object.assign({}, modele, { id: 'T2', updatedAt: '2026-09-10T11:00:00Z' }),
       Object.assign({}, modele, { id: 'T3', updatedAt: '2026-09-10T12:00:00Z' })]
    : [];
  w.App.state.settings.capital = 12345;
  w.App.persist(true);
  w.Plan.saveChecks(checks || { 'c-1': { fait: true } });
}

(async function () {
  console.log('\n1. Avant le verrouillage : données en clair');
  let github = fauxGitHub();
  let app = demarrer({ github, biometrie: true });
  let w = app.w, L = w.Lock;
  let { erreurs } = app;
  verif('module Lock chargé', !!L);
  await attendre(50);
  tresor(w);
  const brut1 = w.localStorage.getItem('journal-trading:v1') || '';
  verif('données en clair dans le navigateur', /EURUSD/.test(brut1));
  verif('chiffrement disponible', L.cryptoDisponible() === true);
  verif('verrou inactif au départ', L.actif() === false);

  /* ---------- 2. activation ---------- */
  console.log('\n2. Activation du verrouillage');
  let r = await L.activer({ code: '1234', confirmation: '1234' });
  verif('code trop court refusé', r.ok === false, r.message);
  r = await L.activer({ code: '123456', confirmation: '123457' });
  verif('confirmation différente refusée', r.ok === false, r.message);
  r = await L.activer({ code: '752318', confirmation: '752318' });
  verif('activation réussie', r.ok === true, r.message || '');
  if (!r.ok) { console.log('     détail :', r.message); }
  verif('code de secours fourni', /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/.test(r.codeSecours || ''), r.codeSecours);
  const coeff = w.localStorage.getItem('journal-trading:coffre');
  verif('coffre écrit (enveloppes)', !!coeff && coeff.indexOf('"actif":true') > -1);
  verif('le code n\'est pas stocké en clair', coeff.indexOf('752318') === -1);
  await L.viderAttente();
  await attendre(150);
  const brut2 = w.localStorage.getItem('journal-trading:v1') || '';
  const checks2 = w.localStorage.getItem('journal-trading:plan:v1') || '';
  verif('les trades ne sont plus lisibles en clair', brut2.indexOf('EURUSD') === -1 && brut2.indexOf('"chiffre":true') > -1, brut2.slice(0, 60) + '…');
  verif('les checklists non plus', checks2.indexOf('"chiffre":true') > -1);
  verif('aucun montant en clair', brut2.indexOf('12345') === -1 && checks2.indexOf('c-1') === -1);
  verif('le journal reste ouvert juste après l\'activation', L.deverrouille() === true);
  verif('trades toujours accessibles à l\'application', w.App.state.trades.length === 3);
  verif('biométrie proposée/inscrite', /"bio":\{/.test(coeff), (L.infos().bio ? 'inscrite' : 'non inscrite'));

  /* ---------- 3. sauvegarde cloud chiffrée ---------- */
  console.log('\n3. La sauvegarde cloud part chiffrée');
  w.Sync.saveConfig({ owner: 'moussantji', repo: 'journal-trading', token: 'github_pat_test', branch: 'main', path: 'sauvegarde.json', enabled: true });
  let p = await w.Sync.pousser({ force: true });
  verif('envoi réussi', p.ok === true);
  const fichier = github.fichier || '';
  verif('le fichier du dépôt ne contient pas les trades en clair', fichier.indexOf('EURUSD') === -1, fichier.slice(0, 90) + '…');
  verif('le fichier est marqué chiffré', /"chiffre":true/.test(fichier));
  verif('toujours daté (pour les conflits)', /"updatedAt":"/.test(fichier));
  verif('la date de modification est lisible', (JSON.parse(fichier).updatedAt || '').length > 0);

  /* ---------- 4. mauvais code ---------- */
  console.log('\n4. Mauvais code');
  await L.verrouiller();
  verif('journal verrouillé', L.deverrouille() === false);
  let echec = null;
  try { await L.ouvrirAvecCode('000000'); } catch (e) { echec = e; }
  verif('mauvais code refusé', !!echec);
  verif('compteur de tentatives incrémenté', L.infos().essais.n >= 1, 'n=' + L.infos().essais.n);
  verif('une simple faute de frappe ne bloque pas (pas d\'attente avant 5 essais)', (L.infos().essais.jusqua || 0) <= Date.now());
  for (let i = 0; i < 4; i++) { try { await L.ouvrirAvecCode('111111'); } catch (e) { /* attendu */ } }
  verif('ralentissement après 5 essais', L.infos().essais.jusqua > Date.now(), 'jusqu\'à ' + new Date(L.infos().essais.jusqua).toISOString().slice(11, 19));
  // on lève le ralentissement pour ne pas ralentir la suite de la recette
  const coffreRepare = JSON.parse(w.localStorage.getItem('journal-trading:coffre'));
  coffreRepare.essais = { n: 0, jusqua: 0 };
  w.localStorage.setItem('journal-trading:coffre', JSON.stringify(coffreRepare));

  /* ---------- 5. code correct ---------- */
  console.log('\n5. Ouverture avec le code');
  // on relance l'application comme après un rechargement de page (le stockage est conservé,
  // la mémoire de session ne l'est pas : le journal doit redemander le code)
  const stockage = vidanger(w);
  app = demarrer({ github, biometrie: true, storageAvant: (nw) => remettre(nw, stockage) });
  w = app.w; L = w.Lock;
  erreurs = app.erreurs;
  await attendre(60);
  const ecran = w.document.getElementById('ecranVerrou');
  verif('écran de verrouillage affiché au démarrage', !!ecran && ecran.hidden === false);
  verif('le journal n\'est pas rendu avant le code', (w.document.getElementById('view').innerHTML || '').length === 0);
  verif('aucun trade chargé en mémoire avant le code', w.App.state.trades.length === 0);
  // on passe par l'écran, comme l'utilisateur : saisie du code puis validation du formulaire
  const champCode = w.document.getElementById('lockCode');
  champCode.value = '752318';
  w.document.getElementById('lockForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await attendre(120);
  verif('ouverture réussie', L.deverrouille() === true);
  Object.assign(stockage, vidanger(w));
  verif('écran masqué', w.document.getElementById('ecranVerrou').hidden === true);
  verif('application réveillée après le déverrouillage', (w.document.getElementById('view').innerHTML || '').length > 0);
  await attendre(80);
  verif('trades restaurés', w.App.state.trades.length === 3, String(w.App.state.trades.length));
  verif('symboles lisibles', w.App.state.trades[0].symbol === 'EURUSD');
  verif('capital restauré', w.App.state.settings.capital === 12345);
  verif('checklists restaurées', w.Plan.loadChecks()['c-1'].fait === true);

  /* ---------- 6. code de secours ---------- */
  console.log('\n6. Code de secours');
  const secours = JSON.parse(w.localStorage.getItem('journal-trading:coffre'));
  const codeRepare = r.codeSecours;
  await L.verrouiller();
  let secoursEchec = null;
  try { await L.ouvrirAvecSecours('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'); } catch (e) { secoursEchec = e; }
  verif('faux code de secours refusé', !!secoursEchec);
  await L.ouvrirAvecSecours(codeRepare.toLowerCase());
  verif('code de secours accepté (minuscules et tirets ignorés)', L.deverrouille() === true);
  verif('trades récupérés avec le code de secours', w.App.state.trades.length === 3);
  verif('le coffre a bien gardé les deux enveloppes', !!secours.code && !!secours.secours);

  /* ---------- 7. biométrie (PRF simulée) ---------- */
  console.log('\n7. Biométrie');
  const inscription = await L.inscriptionBiometrie(L.cle() ? null : null);
  verif('inscription refusée sans clé maîtresse', inscription.etat === 'indisponible' || inscription.etat === 'erreur');
  await L.verrouiller();
  let bio = null;
  try { await L.deverrouillerBiometrie(); bio = 'ok'; } catch (e) { bio = e.message; }
  const infosBio = L.infos().bio;
  if (infosBio) {
    verif('déverrouillage biométrique', bio === 'ok', bio === 'ok' ? 'Face ID simulé' : bio);
    verif('journal ouvert par la biométrie', L.deverrouille() === true);
    verif('trades lisibles', w.App.state.trades.length === 3);
  } else {
    verif('biométrie non inscrite sur cette machine (repli sur le code)', bio !== 'ok', 'repli attendu');
  }
  const possible = await L.biometriePossible();
  verif('détection biométrie disponible', possible === true, 'WebAuthn simulé présent');

  /* ---------- 8. sauvegarde bloquée pendant le verrouillage ---------- */
  console.log('\n8. Aucune écriture tant que le journal est verrouillé');
  const avant = github.fichier;
  await L.verrouiller();
  w.App.effacerMemoire();
  const etatSync = w.Sync.status();
  verif('état « locked »', etatSync.code === 'locked', etatSync.label);
  const refus = await w.Sync.syncNow();
  verif('synchronisation refusée', refus.ok === false && refus.error.code === 'locked');
  const refusPush = await w.Sync.pousser({ force: true });
  verif('envoi refusé', refusPush.ok === false && refusPush.error.code === 'locked');
  verif('la sauvegarde distante est intacte', github.fichier === avant);
  verif('charge refusée (journal verrouillé)', w.Sync.construireCharge() === null);
  const refusTirer = await w.Sync.tirer();
  verif('récupération refusée', refusTirer.ok === false && refusTirer.error.code === 'locked');

  /* ---------- 9. reprise après déverrouillage ---------- */
  console.log('\n9. Reprise après déverrouillage');
  await L.ouvrirAvecCode('752318');
  const reprise = await w.Sync.syncNow();
  verif('synchronisation de nouveau possible', reprise.ok === true || reprise.rien === true, JSON.stringify(reprise.error || {}));
  verif('le fichier du dépôt reste chiffré', (github.fichier || '').indexOf('EURUSD') === -1);
  const distant = await w.Sync.tirer();
  verif('récupération de la sauvegarde chiffrée', distant.ok === true);
  verif('trades déchiffrés depuis le dépôt', w.App.state.trades.filter((t) => !t.demo).length === 3);

  /* ---------- 10. changement de code et de code de secours ---------- */
  console.log('\n10. Changer le code');
  let c = await L.changerCode('mauvais', '987654', '987654');
  verif('code actuel exigé', c.ok === false, c.message);
  c = await L.changerCode('752318', '987654', '987654');
  verif('changement accepté', c.ok === true, c.message || '');
  if (!c.ok) console.log('     détail changement :', c.message);
  await L.verrouiller();
  let ancien = null;
  try { await L.ouvrirAvecCode('752318'); } catch (e) { ancien = e; }
  verif('ancien code refusé', !!ancien);
  await L.ouvrirAvecCode('987654');
  verif('nouveau code accepté', L.deverrouille() === true);
  const ns = await L.nouveauCodeSecours('987654');
  verif('nouveau code de secours généré', ns.ok === true && L.codeValide(ns.codeSecours));
  await L.verrouiller();
  let vieuxSecours = null;
  try { await L.ouvrirAvecSecours(codeRepare); } catch (e) { vieuxSecours = e; }
  verif('ancien code de secours invalidé', !!vieuxSecours);
  await L.ouvrirAvecSecours(ns.codeSecours);
  verif('nouveau code de secours accepté', L.deverrouille() === true);

  /* ---------- 11. désactivation ---------- */
  console.log('\n11. Désactivation');
  const des = await L.desactiver('mauvais');
  verif('code exigé pour désactiver', des.ok === false);
  const des2 = await L.desactiver('987654');
  verif('désactivation réussie', des2.ok === true);
  await attendre(120);
  const brut3 = w.localStorage.getItem('journal-trading:v1') || '';
  verif('les données redeviennent lisibles en clair', brut3.indexOf('EURUSD') > -1);
  verif('coffre effacé', w.localStorage.getItem('journal-trading:coffre') === null);
  verif('verrou inactif', L.actif() === false);

  /* ---------- 12. navigateur sans chiffrement ---------- */
  console.log('\n12. Navigateur sans chiffrement');
  const app2 = demarrer({ sansCrypto: true });
  await attendre(60);
  const r2 = await app2.w.Lock.activer({ code: '246810', confirmation: '246810' });
  verif('activation refusée proprement', r2.ok === false, r2.message);

  /* ---------- 12 bis. la carte « Sécurité » des Paramètres ---------- */
  console.log('\n12 bis. Paramètres → Sécurité');
  const app3 = demarrer({ github: fauxGitHub(), biometrie: true });
  const w3 = app3.w;
  await attendre(60);
  w3.App.state.view = 'params';
  w3.App.render();
  let vue = w3.document.getElementById('view').innerHTML;
  verif('carte Sécurité présente', /Sécurité — verrouiller le journal/.test(vue));
  verif('champs de code proposés', /id="secCode"/.test(vue) && /id="secCode2"/.test(vue) && /id="secActiver"/.test(vue));
  verif('jauge de force du code', /id="secJauge"/.test(vue));
  verif('avertissement sur le code de secours', /code de secours/i.test(vue) && /illisible/i.test(vue));
  const jauge = w3.document.getElementById('secCode');
  jauge.value = '123456';
  jauge.dispatchEvent(new w3.Event('input', { bubbles: true }));
  verif('la jauge réagit à la saisie', /faible|moyen|solide/.test(w3.document.getElementById('secJaugeTxt').textContent), w3.document.getElementById('secJaugeTxt').textContent);
  const r3 = await w3.Lock.activer({ code: 'Cheval-Batterie-Piano-Clou', confirmation: 'Cheval-Batterie-Piano-Clou' });
  verif('phrase de passe acceptée', r3.ok === true);
  w3.App.render();
  vue = w3.document.getElementById('view').innerHTML;
  verif('carte passée en mode chiffré', /Sécurité — journal chiffré/.test(vue));
  verif('boutons de gestion', /id="secVerrou"/.test(vue) && /id="secChanger"/.test(vue) && /id="secSecours"/.test(vue) && /id="secDesactiver"/.test(vue));
  verif('réglage du verrouillage automatique', /id="secDelai"/.test(vue));
  verif('mention AES-GCM 256', /AES-GCM 256/.test(vue));
  verif('avertissement « code oublié »', /illisible pour toujours/i.test(vue));

  /* ---------- 13. fichiers et caches ---------- */
  console.log('\n13. Intégration');
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  verif('lock.js est chargé par la page', /assets\/js\/lock\.js/.test(html));
  verif('lock.js est en cache hors ligne', /assets\/js\/lock\.js/.test(sw));
  verif('cache du service worker en v6', /trading-desk-v6/.test(sw));
  verif('écran de verrouillage présent dans la page', /id="ecranVerrou"/.test(html) && /id="lockForm"/.test(html) && /id="lockSecours"/.test(html));
  verif('aucune erreur JS pendant la recette', erreurs.length === 0, erreurs.join(' | '));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, aucune erreur JS.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})().catch((e) => { console.error('\nErreur du test :', (e && e.stack) || e); process.exit(1); });
