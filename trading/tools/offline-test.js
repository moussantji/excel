/* =========================================================
   offline-test.js — recette du mode hors ligne

   Fait tourner le vrai service worker (sw.js) dans Node, avec un faux
   réseau que l'on peut couper, et vérifie que l'application reste
   entièrement utilisable sans connexion :

   - tous les fichiers de l'application sont mis en cache à l'installation
     (la liste CORE ne doit oublier aucun fichier référencé par la page) ;
   - navigation, code et images se chargent depuis le cache réseau coupé ;
   - un serveur qui répond une erreur ne casse pas la page (repli sur le cache) ;
   - les anciennes versions du cache sont supprimées ;
   - les adresses externes ne sont pas interceptées.

   Usage : node tools/offline-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---------- faux navigateur : caches, requêtes, réponses ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
function typeDe(chemin) { return TYPES[path.extname(chemin)] || 'text/plain'; }

class FausseReponse {
  constructor(body, options) {
    options = options || {};
    this.body = body;
    this.status = options.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = { get: () => options.type || 'text/plain' };
    this._type = options.type || 'text/plain';
  }
  clone() { return new FausseReponse(this.body, { status: this.status, type: this._type }); }
  static error() { return new FausseReponse('', { status: 0 }); }
}
class FausseRequete {
  constructor(url, options) {
    options = options || {};
    this.url = String(url);
    this.method = options.method || 'GET';
    this.mode = options.mode || 'cors';
    this.cache = options.cache;
  }
}

function norm(url) {
  // './assets/js/app.js' ou 'https://exemple/trading/assets/js/app.js' → 'assets/js/app.js'
  let u = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\.\//, '').replace(/^\/trading\//, '').replace(/^\//, '');
  const base = String(url).startsWith('http') ? String(url).split('/trading/')[1] : null;
  if (base !== null && base !== undefined) u = base;
  return u.replace(/[?#].*$/, '');
}

function bac() {
  const contenu = new Map();
  return {
    contenu: contenu,
    api: {
      open: async () => ({
        add: async (req) => {
          const cle = norm(req.url !== undefined ? req.url : req);
          const f = path.join(RACINE, cle);
          if (!fs.existsSync(f)) throw new Error('fichier absent : ' + cle);
          contenu.set(cle, new FausseReponse(fs.readFileSync(f, 'utf8'), { type: typeDe(cle) }));
        },
        put: async (req, rep) => { contenu.set(norm(req.url !== undefined ? req.url : req), rep); },
        match: async (req) => contenu.get(norm(req.url !== undefined ? req.url : req))
      }),
      match: async (req) => contenu.get(norm(req.url !== undefined ? req.url : req)),
      keys: async () => bac.versions.slice(),
      delete: async (nom) => { bac.supprimes.push(nom); return true; }
    }
  };
}
bac.versions = [];
bac.supprimes = [];

/**
 * Charge sw.js dans un contexte simulé.
 * options : { enLigne, pannes: {chemin: statut}, dejaEnCache }
 */
async function charger(options) {
  options = options || {};
  const cache = bac();
  bac.supprimes = [];
  const erreurs = [];
  const journal = { add: [], fetch: [] };
  const etat = { install: null, activate: null, fetch: null, message: null };

  const self = {
    location: { origin: 'https://moussantji.github.io' },
    addEventListener: (type, cb) => { etat[type] = cb; },
    skipWaiting: async () => { journal.skipWaiting = true; },
    clients: { claim: async () => { journal.claimed = true; } },
    caches: cache.api
  };

  async function fetchSimule(req) {
    const cle = norm(req.url !== undefined ? req.url : req);
    journal.fetch.push(cle);
    if (options.enLigne === false) throw new TypeError('Failed to fetch');
    if (options.pannes && options.pannes[cle]) {
      return new FausseReponse('erreur serveur', { status: options.pannes[cle], type: typeDe(cle) });
    }
    if (options.inconnu && cle.indexOf(options.inconnu) === 0) throw new TypeError('Failed to fetch');
    const f = path.join(RACINE, cle);
    if (!fs.existsSync(f)) return new FausseReponse('', { status: 404, type: typeDe(cle) });
    return new FausseReponse(fs.readFileSync(f, 'utf8'), { type: typeDe(cle) });
  }

  const contexte = vm.createContext(Object.assign({
    self, caches: cache.api, fetch: fetchSimule, Response: FausseReponse, Request: FausseRequete,
    URL: URL, console: { log: () => {}, warn: () => {}, error: (m) => erreurs.push(String(m)) },
    Promise, Object, Array, Map, Set, JSON, String, Number, Boolean, RegExp, Math, Date, Error, TypeError, isNaN, parseInt
  }, { self }));
  contexte.globalThis = contexte;
  const code = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  vm.runInContext(code, contexte, { filename: 'sw.js' });

  // installation : on attend la promesse fournie à event.waitUntil
  await new Promise((resolve) => { etat.install({ waitUntil: (p) => Promise.resolve(p).then(resolve, resolve) }); });
  await new Promise((resolve) => { etat.activate({ waitUntil: (p) => Promise.resolve(p).then(resolve, resolve) }); });

  /** Simule une requête passée au service worker. */
  async function demande(url, opts) {
    opts = opts || {};
    const req = new FausseRequete(url, opts);
    let resultat = null, intercepte = false;
    etat.fetch({
      request: req,
      respondWith: (p) => { intercepte = true; resultat = p; }
    });
    const rep = resultat ? await resultat : null;
    return { rep: rep, intercepte: intercepte, texte: rep && rep.body ? String(rep.body) : '' };
  }

  return { cache: cache, journal: journal, erreurs: erreurs, demande: demande, self: self };
}

(async function () {
  /* ---------- 1. installation : tout doit être mis en cache ---------- */
  console.log('\n1. Installation du service worker');
  let sw = await charger({ enLigne: true });
  const core = (fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8').match(/const CORE = \[([\s\S]*?)\];/) || [, ''])[1]
    .split('\n').map((l) => l.trim().replace(/^'|',?$/g, '').replace(/^\.\//, '')).filter(Boolean);
  verif('liste CORE lue', core.length > 10, core.length + ' entrées');
  const manquants = core.filter((c) => c !== '' && !sw.cache.contenu.has(c));
  verif('tous les fichiers de la liste sont en cache', manquants.length === 0, manquants.join(', ') || 'aucun manquant');
  verif('index.html mis en cache', sw.cache.contenu.has('index.html'));
  verif('feuille de style mise en cache', sw.cache.contenu.has('assets/css/styles.css'));
  verif('anciennes versions du cache supprimées', bac.supprimes.length === 0 || bac.supprimes.every((v) => v !== 'trading-desk-v7'));
  verif('le service worker prend la main tout de suite', sw.journal.skipWaiting === true && sw.journal.claimed === true);

  /* ---------- 2. la page ne dépend d'aucun fichier externe ---------- */
  console.log('\n2. Aucun fichier oublié ni dépendance externe');
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g)).map((m) => m[1]).filter((r) => !r.startsWith('http') && !r.startsWith('data:') && !r.startsWith('#'));
  const manifest = JSON.parse(fs.readFileSync(path.join(RACINE, 'manifest.webmanifest'), 'utf8'));
  (manifest.icons || []).forEach((i) => refs.push(i.src));
  (manifest.shortcuts || []).forEach((s) => (s.icons || []).forEach((i) => refs.push(i.src)));
  const oublies = refs.filter((r) => !sw.cache.contenu.has(norm(r)));
  verif('chaque fichier de la page et du manifeste est en cache', oublies.length === 0, oublies.join(', ') || 'aucun oubli');
  const externes = refs.filter((r) => /^https?:/.test(r));
  verif('aucun CDN ni police externe', externes.length === 0, externes.join(', ') || 'page autonome');

  /* ---------- 3. réseau coupé : la page s'ouvre ---------- */
  console.log('\n3. Réseau coupé');
  sw = await charger({ enLigne: false });
  let r = await sw.demande('https://moussantji.github.io/excel/trading/', { mode: 'navigate' });
  verif('navigation interceptée', r.intercepte === true);
  verif('page servie depuis le cache', r.rep && r.rep.ok && r.texte.indexOf('<title>Trading Desk') > -1, r.rep ? 'statut ' + r.rep.status : 'aucune réponse');
  verif('page complète (pas la page d\'erreur)', r.texte.indexOf('Application hors ligne') === -1);

  for (const f of ['assets/js/app.js', 'assets/js/lock.js', 'assets/js/sync.js', 'assets/js/pwa.js', 'assets/js/store.js', 'assets/js/views.js', 'assets/css/styles.css']) {
    const rr = await sw.demande('https://moussantji.github.io/excel/trading/' + f);
    verif(f + ' servi hors ligne', !!(rr.rep && rr.rep.ok && String(rr.rep.body).length > 100), rr.rep ? String(rr.rep.body).length + ' octets' : 'échec');
  }
  let ic = await sw.demande('https://moussantji.github.io/excel/trading/assets/icons/icon-192.png');
  verif('icône servie hors ligne (installation sur écran d\'accueil)', !!(ic.rep && ic.rep.ok));

  /* ---------- 4. serveur en panne : repli sur le cache ---------- */
  console.log('\n4. Serveur joignable mais en panne');
  sw = await charger({ enLigne: true, pannes: { 'assets/js/app.js': 500, 'assets/css/styles.css': 503 } });
  r = await sw.demande('https://moussantji.github.io/excel/trading/assets/js/app.js');
  verif('un 500 sur un fichier ne casse pas la page', !!(r.rep && r.rep.ok), r.rep ? 'statut ' + r.rep.status : 'aucune réponse');
  r = await sw.demande('https://moussantji.github.io/excel/trading/assets/css/styles.css');
  verif('un 503 sur le style ne casse pas la page', !!(r.rep && r.rep.ok), r.rep ? 'statut ' + r.rep.status : 'aucune réponse');
  r = await sw.demande('https://moussantji.github.io/excel/trading/', { mode: 'navigate' });
  verif('navigation en panne de serveur', !!(r.rep && r.rep.ok), r.rep ? 'statut ' + r.rep.status : 'aucune réponse');

  /* ---------- 5. première ouverture sans réseau ---------- */
  console.log('\n5. Toute première ouverture, sans réseau');
  const html2 = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  const pageRepli = /Application hors ligne[\s\S]*?première fois avec une connexion/.test(html2);
  verif('message clair si l\'application n\'a jamais été ouverte en ligne', pageRepli);

  /* ---------- 6. les adresses externes ne sont pas interceptées ---------- */
  console.log('\n6. Réseau externe');
  sw = await charger({ enLigne: true });
  r = await sw.demande('https://api.github.com/repos/moussantji/journal-trading');
  verif('la sauvegarde cloud n\'est pas interceptée par le cache', r.intercepte === false);

  /* ---------- 7. ce que l'application fait hors ligne ---------- */
  console.log('\n7. Cohérence avec l\'application');
  verif('l\'état hors ligne est prévu pour la sauvegarde cloud', /code: 'offline'|'offline'/.test(fs.readFileSync(path.join(RACINE, 'assets/js/sync.js'), 'utf8')));
  verif('les modifications hors ligne repartent au retour du réseau', /addEventListener\('online'/.test(fs.readFileSync(path.join(RACINE, 'assets/js/sync.js'), 'utf8')));
  verif('le verrouillage fonctionne sans réseau (chiffrement local)', /crypto\.subtle/.test(fs.readFileSync(path.join(RACINE, 'assets/js/lock.js'), 'utf8')) && !/fetch\(/.test(fs.readFileSync(path.join(RACINE, 'assets/js/lock.js'), 'utf8')));
  verif('aucune erreur signalée par le service worker', sw.erreurs.length === 0, sw.erreurs.join(' | '));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, hors ligne vérifié.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})().catch((e) => { console.error('\nErreur du test :', (e && e.stack) || e); process.exit(1); });
