/* =========================================================
   relecture-test.js — recette de « Relire mes vrais trades »

   Vérifie, sans réseau et sans navigateur :
   - les questions posées sur un trade : règles chiffrées du plan
     (stop 15 pips, ratio 1:7, risque 1 %, fenêtre de tir, limite du jour) ;
   - la justesse de la correction automatique, sur des trades fabriqués
     exprès (un conforme, un hors plan) ;
   - la règle des 15 pips réservée au forex : ni l'or ni les indices ne
     sont jugés avec une règle écrite pour les paires ;
   - l'ordre des jugements : la structure AVANT la révélation, le
     processus APRÈS — et le fait que le résultat reste réellement caché ;
   - les jugements non notés, enregistrés séparément du score ;
   - le bilan rangé dans le journal (chiffré par le verrou, sauvegardé
     dans le dépôt), la remise à zéro ;
   - la carte dans la vue Formation, le clic réel de bout en bout ;
   - l'absence totale d'appel réseau et de ressource distante ;
   - la présence du module dans le cache hors ligne (version relevée).

   Usage : NODE_PATH=/tmp/node_modules node tools/relecture-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ---- bac isolé : Store + Plan + Relecture, sans navigateur ---- */
function bacSeul() {
  const dom = new JSDOM('<!doctype html><html></html>', { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  ['store.js', 'plan.js', 'relecture.js'].forEach((f) => {
    const sc = w.document.createElement('script');
    sc.textContent = lire('assets/js/' + f);
    w.document.head.appendChild(sc);
  });
  return w;
}

function trade(w, champs) {
  const s = w.Store.defaultSettings();
  return w.Store.normalizeTrade(champs, s);
}

(async function () {
  const w = bacSeul();
  const R = w.Relecture;
  const S = w.Store;
  const reglages = S.defaultSettings();

  console.log('\n1. Ce que l\'application peut vérifier elle-même');
  verif('le module expose son interface', !!R && typeof R.questionsDuTrade === 'function');

  // trade entièrement conforme : 13 pips de stop, ratio élevé, fenêtre Europe,
  // 0,65 % de risque (0,5 lot), seul trade de la journée
  const conforme = trade(w, {
    date: '2026-09-01', time: '08:30', symbol: 'EURUSD', direction: 'long',
    entry: 1.0850, stop: 1.0837, target: 1.1000, size: 0.5, exit: 1.0980, pnl: 65
  });
  const horsPlan = trade(w, {
    date: '2026-09-02', time: '11:15', symbol: 'XAUUSD', direction: 'short',
    entry: 2400, stop: 2422, target: 2350, size: 0.1, exit: 2410, pnl: -50
  });
  const qConforme = R.questionsDuTrade(conforme, [conforme], reglages).verifiables;
  const qHors = R.questionsDuTrade(horsPlan, [horsPlan], reglages).verifiables;

  verif('le stop est mesuré en pips sur une paire forex',
    qConforme.some((q) => q.id === 'stop'), qConforme.map((q) => q.id).join(', '));
  const stopConforme = qConforme.filter((q) => q.id === 'stop')[0];
  verif('un stop de 13 pips est reconnu conforme', stopConforme && stopConforme.bonne === 1,
    stopConforme ? stopConforme.explication : 'question absente');

  const fxHorsStop = trade(w, {
    date: '2026-09-03', time: '08:30', symbol: 'EURUSD', direction: 'long',
    entry: 1.0850, stop: 1.0830, target: 1.1000, size: 1, exit: 1.0900, pnl: 50
  });
  const qFxHors = R.questionsDuTrade(fxHorsStop, [fxHorsStop], reglages).verifiables;
  const stopHors = qFxHors.filter((q) => q.id === 'stop')[0];
  verif('un stop de 20 pips est reconnu hors plan', stopHors && stopHors.bonne === 0,
    stopHors ? stopHors.explication : 'question absente');
  verif('l\'explication chiffre la distance mesurée', stopHors && /20,0 pips/.test(stopHors.explication),
    stopHors ? stopHors.explication.slice(0, 60) : '—');

  verif('la règle des 15 pips n\'est pas posée sur l\'or',
    !qHors.some((q) => q.id === 'stop'), qHors.map((q) => q.id).join(', '));

  const ratio = qConforme.filter((q) => q.id === 'ratio')[0];
  verif('un ratio visé au-dessus de 1:7 est reconnu conforme', ratio && ratio.bonne === 1,
    ratio ? ratio.explication : 'question absente');
  const ratioHors = qHors.filter((q) => q.id === 'ratio')[0];
  verif('un ratio visé sous 1:7 est signalé', ratioHors && ratioHors.bonne === 0,
    ratioHors ? ratioHors.explication : 'question absente');

  const fen = qConforme.filter((q) => q.id === 'fenetre')[0];
  verif('la fenêtre de tir est vérifiée sur l\'heure du trade', fen && fen.bonne === 1,
    fen ? fen.explication : 'question absente');
  const fenHors = qHors.filter((q) => q.id === 'fenetre')[0];
  verif('une entrée hors fenêtre est signalée', fenHors && fenHors.bonne === 0,
    fenHors ? fenHors.explication : 'question absente');

  // limite du jour : quatre trades le même jour avec une limite de 3
  const jour = ['08:00', '09:30', '13:10', '15:00'].map((h, i) => trade(w, {
    date: '2026-09-04', time: h, symbol: 'EURUSD', direction: 'long',
    entry: 1.0850, stop: 1.0840, target: 1.1000, size: 1, exit: 1.0900, pnl: 10 + i
  }));
  const qJour = R.questionsDuTrade(jour[0], jour, reglages).verifiables.filter((q) => q.id === 'jour')[0];
  verif('la limite de trades par jour est comptée', qJour && qJour.bonne === 0,
    qJour ? qJour.explication : 'question absente');

  const risque = qConforme.filter((q) => q.id === 'risque')[0];
  verif('le risque engagé est comparé à la limite de 1 %', risque && risque.bonne === 1,
    risque ? risque.explication : 'question absente');
  const risqueHors = qHors.filter((q) => q.id === 'risque')[0];
  verif('un risque au-delà de 1 % est signalé', risqueHors && risqueHors.bonne === 0,
    risqueHors ? risqueHors.explication : 'question absente');
  const jourConforme = qConforme.filter((q) => q.id === 'jour')[0];
  verif('la limite de trades par jour est interrogée aussi', jourConforme && jourConforme.bonne === 1,
    jourConforme ? jourConforme.explication : 'question absente');
  verif('un trade conforme obtient « oui » partout',
    qConforme.every((q) => q.bonne === 1), qConforme.map((q) => q.id + ':' + (q.bonne ? 'oui' : 'non')).join(' '));

  verif('cinq règles au maximum par trade, toutes du plan',
    qConforme.length <= 5 && qConforme.length >= 3 && qHors.length <= 5,
    qConforme.length + ' questions (conforme) et ' + qHors.length + ' (hors plan)');
  verif('chaque question a un énoncé, une vérité et une explication chiffrée',
    qConforme.concat(qHors).every((q) => q.texte && (q.bonne === 0 || q.bonne === 1) && /%|pips|trade|fenêtre|1:/.test(q.explication)));

  console.log('\n2. Le résultat reste caché jusqu\'à la révélation');
  w.App = { state: { trades: [conforme], settings: reglages } };
  R.tirer(w.App);
  const zoneAvant = R.zoneHTML(w.App);
  verif('la fiche du trade est proposée', /rel-fiche/.test(zoneAvant));
  verif('le contexte est montré sans le résultat',
    /Entrée/.test(zoneAvant) && !/rel-resultat/.test(zoneAvant), 'pas de bloc résultat avant révélation');
  verif('le masque est annoncé en clair', /résultat .*masqué|masqué jusqu/i.test(zoneAvant.replace(/\s+/g, ' ')));
  verif('les deux jugements ne sont pas notés', /n\'est pas notée/.test(zoneAvant) || /pas notée/.test(zoneAvant));
  verif('la question de structure est posée avant la révélation', /structure allait-elle/.test(zoneAvant));
  verif('la question de processus n\'apparaît qu\'après', !/bon trade selon le plan/.test(zoneAvant));

  console.log('\n3. Déroulé d\'un trade (boutons, correction, bilan)');
  const r = R.tirer(w.App);
  verif('un trade peut être tiré', !!r && r.symbol === conforme.symbol, r ? r.symbol : 'aucun');
  const zoneTir = R.zoneHTML(w.App);
  verif('le bouton de révélation est bloqué avant les réponses',
    /id="fRelReveler"[^>]*disabled/.test(zoneTir));

  const qs = R.questionsDuTrade(r, w.App.state.trades, reglages).verifiables;
  // première question juste, deuxième volontairement fausse, puis les suivantes
  verif('une réponse est enregistrée', R.repondre(qs[0].id, qs[0].bonne) === true);
  if (qs[1]) R.repondre(qs[1].id, qs[1].bonne === 1 ? 0 : 1);
  qs.slice(2).forEach((q) => R.repondre(q.id, q.bonne));
  verif('une deuxième réponse au même endroit est refusée', R.repondre(qs[0].id, 0) === false);
  R.juger('structure', 0);
  const zonePret = R.zoneHTML(w.App);
  verif('une fois toutes les règles répondues, la révélation se débloque',
    !/id="fRelReveler"[^>]*disabled/.test(zonePret));

  const bilan = R.reveler(w.App);
  verif('la révélation note les réponses', !!bilan && bilan.total === qs.length,
    bilan ? bilan.bonnes + ' / ' + bilan.total : 'aucune révélation');
  const zoneApres = R.zoneHTML(w.App);
  verif('le résultat est affiché après la révélation', /rel-resultat/.test(zoneApres));
  verif('la correction de chaque règle est expliquée', /rel-expl/.test(zoneApres));
  verif('la question de processus apparaît alors', /bon trade selon le plan/.test(zoneApres));
  verif('la révélation ne peut pas être refaite', R.reveler(w.App) === null);

  const p1 = R.lire();
  verif('le bilan est enregistré dans le journal', p1.essais === 1 && p1.questions === qs.length,
    JSON.stringify({ essais: p1.essais, questions: p1.questions, bonnes: p1.bonnes }));
  R.jugerProcess(0);
  const p2 = R.lire();
  verif('le jugement de processus est enregistré séparément',
    p2.jugements.bons === 1 && p2.jugements.juste === 1,
    JSON.stringify(p2.jugements));
  verif('le jugement n\'entre pas dans le score des règles', p2.bonnes === p1.bonnes);
  verif('un jugement déjà donné ne peut pas être changé', R.jugerProcess(1) === false);
  verif('la progression passe par le journal (chiffrée et sauvegardée au même endroit)',
    /Plan\.loadChecks/.test(lire('assets/js/relecture.js')) && /Plan\.saveChecks/.test(lire('assets/js/relecture.js')));
  R.reinitialiser();
  const p3 = R.lire();
  verif('la remise à zéro efface le bilan', p3.essais === 0 && p3.questions === 0 && p3.jugements.bons === 0);

  console.log('\n4. Cas particuliers');
  const videDom = bacSeul();
  videDom.App = { state: { trades: [], settings: reglages } };
  verif('sans trade clôturé, l\'application explique au lieu d\'échouer',
    /aucun trade clôturé|besoin de vos trades/i.test(videDom.Relecture.zoneHTML(videDom.App)));
  const ouvert = trade(videDom, { date: '2026-09-05', time: '08:30', symbol: 'EURUSD', direction: 'long', entry: 1.0850, stop: 1.0840, target: 1.1000, size: 1 });
  videDom.App.state.trades = [ouvert];
  verif('un trade encore ouvert n\'est pas proposé à la relecture',
    /besoin de vos trades|aucun trade clôturé/i.test(videDom.Relecture.zoneHTML(videDom.App)),
    videDom.Relecture.revisables([ouvert]).length + ' trade(s) revisable(s)');
  verif('un trade clôturé l\'est', R.revisables([conforme, ouvert]).length === 1);

  console.log('\n5. Vue Formation (application complète)');
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = String(e.message || e); if (!/Not implemented/.test(m)) erreurs.push(m); });
  vc.on('error', (m) => erreurs.push(String(m)));
  // jsdom refuse localStorage en file:// (origine opaque) : on fournit le même
  // contrat que le navigateur réel, sans quoi la persistance ne peut pas être testée
  const dom = await JSDOM.fromFile(path.join(RACINE, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      win.open = () => ({ focus() {} });
      const memoire = {};
      Object.defineProperty(win, 'localStorage', {
        configurable: true,
        value: {
          getItem: (k) => (k in memoire ? memoire[k] : null),
          setItem: (k, v) => { memoire[k] = String(v); },
          removeItem: (k) => { delete memoire[k]; },
          clear: () => { Object.keys(memoire).forEach((k) => delete memoire[k]); },
          key: (i) => Object.keys(memoire)[i] || null,
          get length() { return Object.keys(memoire).length; }
        }
      });
    }
  });
  const app = dom.window;
  await new Promise((r2) => setTimeout(r2, 600));
  await app.App.loadDemo();
  await new Promise((r2) => setTimeout(r2, 150));
  app.document.querySelector('[data-view="formation"]').click();
  await tick(); await tick(); await tick();

  verif('la carte de relecture est dans la vue Formation', !!app.document.querySelector('#relecture'));
  verif('la carte de pratique réelle est là aussi', !!app.document.querySelector('#vrais'));
  verif('la limite du replay intraday est écrite noir sur blanc',
    /intraday/.test(app.document.querySelector('#vrais').textContent) &&
    /payante|n'est plus gratuit/i.test(app.document.querySelector('#vrais').textContent.replace(/\s+/g, ' ')));
  const btn = app.document.querySelector('#fRelTirer');
  verif('le bouton de tirage est présent', !!btn);
  if (btn) {
    btn.click();
    await tick(); await tick();
    const zone = app.document.querySelector('#fZoneRelire');
    verif('le tirage affiche un trade du journal sans son résultat',
      !!zone.querySelector('.rel-fiche') && !/rel-resultat/.test(zone.innerHTML) && /masqué/.test(zone.textContent));
    // on répond à toutes les règles : la première réponse de chaque question
    const questions = zone.querySelectorAll('.rel-choix');
    verif('les règles du plan sont interrogées', questions.length >= 3, questions.length + ' question(s) + jugements');
    app.document.querySelectorAll('#fZoneRelire [data-rel]').forEach((b) => {
      if (!b.disabled && b.dataset.val === '1') b.click();
    });
    await tick(); await tick();
    const reveler = app.document.querySelector('#fRelReveler');
    verif('la révélation se débloque après les réponses', reveler && !reveler.disabled);
    if (reveler) {
      reveler.click();
      await tick(); await tick();
      const z2 = app.document.querySelector('#fZoneRelire');
      verif('le résultat du trade est alors affiché', /rel-resultat/.test(z2.innerHTML));
      const bilan = app.Relecture.lire();
      verif('le bilan est enregistré dans le journal de l\'application', bilan.essais >= 1, JSON.stringify({ essais: bilan.essais, questions: bilan.questions }));
      const suivant = app.document.querySelector('#fRelTirer');
      verif('un trade suivant est proposé', !!suivant && /Trade suivant/.test(suivant.textContent));
    }
  }

  console.log('\n6. Intégration');
  verif('le module est chargé par la page', /assets\/js\/relecture\.js/.test(lire('index.html')));
  verif('le module est chargé avant la vue Formation (qui l\'appelle)',
    lire('index.html').indexOf('assets/js/relecture.js') < lire('index.html').indexOf('assets/js/formation.js'));
  const sw = lire('sw.js');
  verif('le module est dans le cache hors ligne', /'\.\/assets\/js\/relecture\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 13, 'v' + vCache);
  verif('aucun appel réseau dans la relecture', !/fetch\(|XMLHttpRequest|new Image|navigator\.send/.test(lire('assets/js/relecture.js')));
  verif('aucune ressource distante dans la relecture', !/https?:\/\//.test(lire('assets/js/relecture.js').replace(/^\s*\*.*$/gm, '')));
  verif('la relecture est masquée à l\'impression', /@media print\{[\s\S]*?\.relecture[^}]*display:none/.test(lire('assets/css/styles.css')));
  verif('la fonctionnalité est annoncée dans le README', /Relire (mes|ses) vrais trades/.test(lire('README.md')) &&
    /replay/.test(lire('README.md')) && /MT5|MetaTrader/.test(lire('README.md')),
    'section relecture + guide des outils gratuits');
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, relecture des trades vérifiée.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
