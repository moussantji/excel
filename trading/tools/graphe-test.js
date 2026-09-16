/* =========================================================
   graphe-test.js — recette du lien « Graphique » (TradingView)

   Vérifie, sans réseau et sans navigateur :
   - les symboles par défaut (forex, or, indices, pétrole, crypto) et la
     façon dont un instrument inconnu est traité ;
   - la correction écrite par l'utilisateur dans les Paramètres, qui doit
     toujours gagner sur le défaut, quelle que soit la casse saisie ;
   - l'adresse produite : bon symbole, bonne unité de temps, https ;
   - la confidentialité : l'adresse ne transporte aucune donnée du journal ;
   - hors ligne : rien ne s'ouvre, et l'utilisateur est prévenu ;
   - les boutons dans l'application (journal, fiche de trade, formulaire,
     carte des Paramètres, entraîneur) et leur disparition quand on éteint ;
   - l'absence totale de chargement externe : l'application n'appelle
     jamais TradingView toute seule, ni à l'ouverture ni au rendu ;
   - la présence du module dans le cache hors ligne (version relevée).

   Usage : NODE_PATH=/tmp/node_modules node tools/graphe-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

let ok = 0, ko = 0;
const tick = () => new Promise((r) => setTimeout(r, 0));
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---- l'application entière, comme dans les autres recettes ---- */
async function bac() {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = String(e.message || e);
    if (/Not implemented/.test(msg)) return;   // bruit connu de jsdom (scroll, canvas…)
    erreurs.push(msg);
  });
  vc.on('error', (m) => erreurs.push(String(m)));
  const dom = await JSDOM.fromFile(path.join(RACINE, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      // aucune fenêtre externe ne doit s'ouvrir pendant la recette : on les compte
      win.__ouvertes = [];
      win.open = (u) => { win.__ouvertes.push(u); return { focus() {} }; };
    }
  });
  const win = dom.window;
  await new Promise((r) => setTimeout(r, 600));
  if (win.App && win.App.loadDemo) { await win.App.loadDemo(); await new Promise((r) => setTimeout(r, 120)); }
  return { dom, win, doc: win.document, erreurs };
}

(async function () {
  console.log('\n1. Symboles par défaut');
  const g = new JSDOM('<!doctype html><html></html>', { url: 'https://x.test/', runScripts: 'dangerously' });
  const winSeul = g.window;
  winSeul.open = () => ({ focus() {} });
  const sc = winSeul.document.createElement('script');
  sc.textContent = lire('assets/js/graphe.js');
  winSeul.document.head.appendChild(sc);
  const G = winSeul.Graphe;
  verif('le module expose son interface', !!G && typeof G.url === 'function');

  const attendus = [
    ['EURUSD', 'FX:EURUSD'], ['GBPJPY', 'FX:GBPJPY'], ['AUDCAD', 'FX:AUDCAD'],
    ['XAUUSD', 'OANDA:XAUUSD'], ['XAGUSD', 'OANDA:XAGUSD'],
    ['US30', 'TVC:DJI'], ['NAS100', 'TVC:NDX'], ['SPX500', 'TVC:SPX'], ['GER40', 'TVC:DAX'],
    ['WTI', 'TVC:USOIL'], ['BTCUSD', 'BITSTAMP:BTCUSD']
  ];
  const faux = attendus.filter(([i, s]) => G.symboleTV(i) !== s);
  verif('les instruments connus visent le bon symbole', faux.length === 0,
    faux.map(([i, s]) => i + '→' + G.symboleTV(i) + ' (attendu ' + s + ')').join(' | ') || attendus.length + ' instruments');

  verif('une paire forex inconnue est déduite', G.symboleTV('eurchf') === 'FX:EURCHF', G.symboleTV('eurchf'));
  verif('un instrument vraiment inconnu est laissé tel quel', G.symboleTV('XYZABC') === 'XYZABC', G.symboleTV('XYZABC'));
  verif('les espaces et minuscules sont tolérés', G.symboleTV(' eur usd ') === 'FX:EURUSD', G.symboleTV(' eur usd '));
  verif('un instrument vide ne produit pas d\'adresse', G.url('') === '' && G.symboleTV('') === '');

  console.log('\n2. Correction de l\'utilisateur');
  const reglages = { graphique: { actif: true, intervalle: '240', symboles: { US30: 'CAPITALCOM:US30', xauusd: 'FOREXCOM:XAUUSD' } } };
  verif('la correction gagne sur le défaut', G.symboleTV('US30', reglages) === 'CAPITALCOM:US30', G.symboleTV('US30', reglages));
  verif('la casse de la correction n\'a pas d\'importance', G.symboleTV('XAUUSD', reglages) === 'FOREXCOM:XAUUSD', G.symboleTV('XAUUSD', reglages));
  verif('les instruments non corrigés gardent le défaut', G.symboleTV('EURUSD', reglages) === 'FX:EURUSD', G.symboleTV('EURUSD', reglages));

  console.log('\n3. Adresse du graphique');
  const u = G.url('XAUUSD');
  verif('l\'adresse est en https et sur TradingView',
    /^https:\/\/www\.tradingview\.com\/chart\//.test(u), u);
  verif('le symbole est dans l\'adresse', u.indexOf('symbol=OANDA:XAUUSD') > -1, u);
  verif('l\'unité de temps est dans l\'adresse', u.indexOf('interval=60') > -1, u);
  verif('l\'unité de temps choisie est respectée', G.url('EURUSD', reglages).indexOf('interval=240') > -1, G.url('EURUSD', reglages));
  verif('une unité de temps inconnue retombe sur 1 heure', G.url('EURUSD', { graphique: { intervalle: 'zzz' } }).indexOf('interval=60') > -1);
  verif('le jour et la semaine sont des unités valides',
    ['D', 'W'].every((iv) => G.url('US30', { graphique: { intervalle: iv } }).indexOf('interval=' + iv) > -1));
  verif('toutes les unités proposées sont des unités TradingView',
    G.INTERVALLES.every((x) => ['15', '60', '240', 'D', 'W'].indexOf(x.id) > -1),
    G.INTERVALLES.map((x) => x.id).join(' '));

  console.log('\n4. Confidentialité et silence');
  const adresse = G.url('EURUSD', reglages);
  verif('l\'adresse ne contient que le symbole et l\'unité de temps',
    /^https:\/\/www\.tradingview\.com\/chart\/\?symbol=[^&]+&interval=[^&]+$/.test(adresse), adresse);
  verif('aucune donnée de trade ne peut s\'y glisser',
    !/date|time=|prix|note|pnl|capital|poids/i.test(adresse), adresse);
  const src = lire('assets/js/graphe.js');
  verif('le module ne charge jamais rien tout seul',
    !/fetch\(|XMLHttpRequest|createElement\(.script|\.src\s*=/.test(src));
  verif('le module ne fait aucun appel réseau automatique',
    !/new Image|sendBeacon|navigator\.send/.test(src));
  verif('le chargement de la page ne mentionne aucun domaine externe',
    !/tradingview\.com/.test(lire('index.html')));

  console.log('\n5. Hors ligne');
  winSeul.navigator.__defineGetter__ && Object.defineProperty(winSeul.navigator, 'onLine', { value: false, configurable: true });
  let ouvertes = [];
  winSeul.open = (uu) => { ouvertes.push(uu); return { focus() {} }; };
  let messages = [];
  winSeul.UI = { toast: (m) => messages.push(String(m)) };
  const res = G.ouvrir('EURUSD', reglages);
  verif('hors ligne, aucune fenêtre ne s\'ouvre', res === null && ouvertes.length === 0);
  verif('hors ligne, l\'utilisateur est prévenu', messages.length === 1 && /internet/i.test(messages[0]), messages[0] || 'aucun message');
  Object.defineProperty(winSeul.navigator, 'onLine', { value: true, configurable: true });
  messages = [];
  const res2 = G.ouvrir('EURUSD', reglages);
  verif('en ligne, la fenêtre s\'ouvre', ouvertes.length === 1 && res2 === adresse, res2 || 'rien');
  verif('l\'adresse ouverte est bien celle du graphique', ouvertes[0] === adresse);

  const apres = await bac();
  const doc = apres.doc;
  verif('l\'application se charge sans erreur', apres.erreurs.length === 0, apres.erreurs.slice(0, 2).join(' | ') || 'aucune erreur');
  verif('aucune fenêtre ne s\'ouvre à l\'ouverture de l\'application',
    apres.win.__ouvertes.length === 0, (apres.win.__ouvertes.length) + ' ouverture(s)');

  console.log('\n6. Les boutons dans l\'application');
  const journal = doc.querySelector('[data-view="journal"]');
  if (journal) journal.click();
  await tick(); await tick();
  const vueJournal = doc.querySelector('#view-journal') || doc.body;
  verif('le bouton « Graphique » est dans l\'en-tête du journal', !!doc.querySelector('#btnGraph'));
  verif('le bouton de l\'en-tête est expliqué et accessible',
    !!doc.querySelector('#btnGraph').getAttribute('title') && /Graphique/.test(doc.querySelector('#btnGraph').textContent),
    doc.querySelector('#btnGraph').textContent.trim());
  const lignes = vueJournal.querySelectorAll('[data-action="graph"]');
  verif('chaque trade porte son bouton de graphique', lignes.length > 0, lignes.length + ' bouton(s)');
  verif('le bouton du trade indique l\'instrument',
    lignes.length > 0 && !!lignes[0].dataset.sym, lignes.length ? lignes[0].dataset.sym : '—');
  verif('le bouton est accessible (libellé et titre)',
    lignes.length > 0 && !!lignes[0].getAttribute('aria-label') && !!lignes[0].getAttribute('title'));

  // le clic du bouton de ligne ouvre l'adresse de l'instrument de ce trade
  const trade = apres.win.App.state.trades[0];
  if (lignes.length && trade) {
    apres.win.__ouvertes = [];
    lignes[0].dispatchEvent(new apres.win.MouseEvent('click', { bubbles: true }));
    const attendu = G.url(lignes[0].dataset.sym, apres.win.App.state.settings);
    verif('le clic ouvre le graphique du bon instrument',
      apres.win.__ouvertes[0] === attendu, apres.win.__ouvertes[0] || 'rien ouvert');
  } else {
    verif('le clic ouvre le graphique du bon instrument', false, 'aucun trade dans la recette');
  }

  // fiche de trade : le bouton suit l'instrument
  const fiche = vueJournal.querySelector('tr[data-id], .trade-card[data-id]');
  if (fiche) { fiche.click(); await tick(); }
  const modaleForm = doc.querySelector('.modal');
  const btnForm = doc.querySelector('#fGraphTV');
  verif('la fiche de trade propose le graphique', !!btnForm);
  if (btnForm) {
    const champ = doc.querySelector('.modal input[name="symbol"]');
    if (champ) champ.value = 'US30';
    apres.win.__ouvertes = [];
    btnForm.click();
    verif('le bouton de la fiche suit l\'instrument saisi',
      apres.win.__ouvertes[0] === G.url('US30', apres.win.App.state.settings), apres.win.__ouvertes[0] || 'rien ouvert');
  }
  if (modaleForm) {
    const fermer = modaleForm.querySelector('[data-close]');
    if (fermer) fermer.click();
    await tick();
  }

  console.log('\n7. Paramètres : la carte du graphique');
  const params = doc.querySelector('[data-view="params"]');
  if (params) params.click();
  await tick(); await tick();
  const carte = doc.querySelector('#tvForm');
  verif('la carte « Graphique TradingView » existe', !!carte);
  if (carte) {
    verif('une ligne par instrument suivi', carte.querySelectorAll('.tv-ligne').length === apres.win.App.state.settings.symbols.length,
      carte.querySelectorAll('.tv-ligne').length + ' ligne(s)');
    verif('les symboles par défaut sont montrés en repère',
      !!carte.querySelector('.tv-ligne input[placeholder*=":"]'), (carte.querySelector('.tv-ligne input') || {}).placeholder || '—');
    verif('l\'unité de temps est réglable', !!carte.querySelector('select[name="tvIntervalle"]'));
    verif('l\'interrupteur du bouton est présent', !!carte.querySelector('input[name="tvActif"]'));
    verif('les limites sont écrites (écran partagé, tracés non lisibles)',
      /affichage fractionné/.test(doc.querySelector('.tv-card').textContent) &&
      /tracés/i.test(doc.querySelector('.tv-card').textContent));

    // enregistrement : une correction saisie doit persister
    const champUS30 = carte.querySelector('input[name="tv:US30"]');
    if (champUS30) {
      champUS30.value = 'CAPITALCOM:US30';
      const champIv = carte.querySelector('select[name="tvIntervalle"]');
      if (champIv) champIv.value = '240';
      carte.dispatchEvent(new apres.win.Event('submit', { bubbles: true, cancelable: true }));
      await tick(); await tick();
      const enr = apres.win.App.state.settings.graphique;
      verif('la correction est enregistrée', enr && enr.symboles && enr.symboles.US30 === 'CAPITALCOM:US30', JSON.stringify(enr && enr.symboles));
      verif('l\'unité de temps est enregistrée', enr && enr.intervalle === '240', enr && enr.intervalle);
      verif('la correction est utilisée pour l\'adresse',
        apres.win.Graphe.url('US30', apres.win.App.state.settings).indexOf('CAPITALCOM:US30') > -1,
        apres.win.Graphe.url('US30', apres.win.App.state.settings));
    } else {
      verif('la correction est enregistrée', false, 'champ US30 absent (instrument non suivi)');
    }

    // extinction : les boutons doivent disparaître
    const interrupteur = carte.querySelector('input[name="tvActif"]');
    if (interrupteur) {
      interrupteur.checked = false;
      carte.dispatchEvent(new apres.win.Event('submit', { bubbles: true, cancelable: true }));
      await tick(); await tick();
      const j2 = doc.querySelector('[data-view="journal"]');
      if (j2) j2.click();
      await tick(); await tick();
      verif('bouton éteint : plus aucun bouton de graphique',
        !doc.querySelector('#btnGraph') && doc.querySelectorAll('[data-action="graph"]').length === 0);
      verif('bouton éteint : l\'entraîneur n\'a plus de lien non plus', !doc.querySelector('#fReel'));
      // on rallume par l'interface (le rendu a remplacé le formulaire : on le relit)
      const p2 = doc.querySelector('[data-view="params"]');
      if (p2) p2.click();
      await tick(); await tick();
      const carte2 = doc.querySelector('#tvForm');
      if (carte2) {
        carte2.querySelector('input[name="tvActif"]').checked = true;
        carte2.dispatchEvent(new apres.win.Event('submit', { bubbles: true, cancelable: true }));
        await tick(); await tick();
        verif('rallumé, le bouton revient', !!apres.win.App.state.settings.graphique.actif);
      }
    }
  }

  console.log('\n8. Formation et intégration');
  const info = doc.querySelector('[data-view="formation"]');
  if (info) info.click();
  await tick(); await tick();
  // le bouton accompagne un graphique tiré : on tire d'abord
  const tirer = doc.querySelector('#fTirer');
  if (tirer) { tirer.click(); await tick(); await tick(); }
  const reel = doc.querySelector('#fReel');
  verif('l\'entraîneur propose un graphique réel', !!reel);
  if (reel) {
    apres.win.__ouvertes = [];
    reel.click();
    await tick();
    const attendu = G.url(G.instrumentPrincipal(apres.win.App.state.trades, apres.win.App.state.settings), apres.win.App.state.settings);
    verif('le bouton de l\'entraîneur ouvre l\'instrument le plus tradé',
      apres.win.__ouvertes[0] === attendu, apres.win.__ouvertes[0] || 'rien ouvert');
  }
  verif('la formation reste utilisable sans le module externe', !/tradingview/i.test(lire('assets/js/formation-contenu.js')));

  const sw = lire('sw.js');
  verif('le module est dans le cache hors ligne', /'\.\/assets\/js\/graphe\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 12, 'v' + vCache);
  verif('le module est chargé par la page', /assets\/js\/graphe\.js/.test(lire('index.html')));
  verif('le module est chargé après store (dont il lit les réglages)',
    lire('index.html').indexOf('assets/js/store.js') < lire('index.html').indexOf('assets/js/graphe.js'));
  verif('les réglages par défaut existent (bouton allumé, 1 heure)',
    /graphique:\s*\{[\s\S]{0,80}actif:\s*true[\s\S]{0,60}intervalle:\s*'60'/.test(lire('assets/js/store.js')));
  verif('le bouton est masqué à l\'impression', /\.lien-ext[^{]*\{[^}]*display:none/.test(lire('assets/css/styles.css')));
  verif('la fonctionnalité est annoncée dans le README', /TradingView/.test(lire('README.md')));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, lien graphique vérifié.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
