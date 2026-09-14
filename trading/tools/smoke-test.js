#!/usr/bin/env node
/* =========================================================
   smoke-test.js — Vérifie que chaque vue se rend sans erreur.
   Usage :  node tools/smoke-test.js
   Requiert jsdom :  npm i -D jsdom   (ou chemin via JSDOM_PATH)
   ========================================================= */
'use strict';
const path = require('path');
const fs = require('fs');

function loadJsdom() {
  const candidates = [process.env.JSDOM_PATH, 'jsdom', '/tmp/domtest/node_modules/jsdom'].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* suivant */ }
  }
  console.error('jsdom introuvable. Installez-le : npm i -D jsdom');
  process.exit(2);
}
const { JSDOM, VirtualConsole } = loadJsdom();

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = String(e.message || e);
  if (/Not implemented/.test(msg)) return;           // bruit de jsdom (scroll, canvas…)
  errors.push('jsdomError: ' + msg);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('warn', () => {});
vc.on('log', () => {});

(async () => {
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window, d = w.document;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(600);

  const view = () => d.getElementById('view');
  const lastModal = () => Array.from(d.querySelectorAll('.modal-overlay')).pop();
  const purgeModals = () => Array.from(d.querySelectorAll('.modal-overlay')).forEach((o) => o.remove());
  const check = (name, fn) => {
    try {
      const info = fn();
      console.log('  ✓ ' + name + (info ? ' — ' + info : ''));
    } catch (e) {
      errors.push(name + ' → ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
      console.log('  ✗ ' + name + ' : ' + e.message);
    }
  };

  console.log('\n1. Démarrage (journal vide)');
  await w.App.loadDemo();
  await wait(60);
  check('démo chargée', () => w.App.state.trades.length + ' trades');

  console.log('\n2. Rendu de toutes les vues');
  for (const v of ['dashboard', 'journal', 'calendrier', 'analyses', 'plan', 'params']) {
    check('vue ' + v, () => {
      w.App.state.view = v;
      w.App.render();
      const n = view().innerHTML.length;
      if (n < 200) throw new Error('vue quasi vide (' + n + ' car.)');
      return n + ' car.';
    });
  }

  console.log('\n3. Graphiques SVG présents');
  w.App.state.view = 'dashboard'; w.App.render();
  check('courbe d\'équité', () => {
    const svg = d.querySelectorAll('#equityChart svg');
    if (!svg.length) throw new Error('aucun SVG');
    return svg.length + ' svg';
  });
  ['equity', 'r', 'dd', 'daily'].forEach((mode) => {
    check('mode ' + mode, () => {
      w.App.state.curveMode = mode; w.App.render();
      return d.querySelectorAll('#equityChart svg').length + ' svg';
    });
  });
  w.App.state.curveMode = 'equity'; w.App.render();
  ['setup', 'symbol', 'session', 'dow', 'hour', 'direction'].forEach((m) => {
    check('groupe ' + m, () => {
      w.App.state.groupMode = m;
      d.querySelectorAll('[data-name="groupMode"] .seg-btn').forEach((b) => { if (b.dataset.val === m) b.click(); });
      return d.querySelectorAll('#groupMount svg, #groupMount .hbars').length + ' graph';
    });
  });
  w.App.state.view = 'calendrier'; w.App.render();
  check('calendrier annuel', () => {
    const cells = d.querySelectorAll('.cal-cell:not(.cal-empty)').length;
    if (cells < 300) throw new Error(cells + ' cellules seulement');
    return cells + ' cellules';
  });
  check('clic sur une journée', () => {
    const cell = d.querySelector('.cal-cell.pos') || d.querySelector('.cal-cell.neg');
    cell.click();
    return 'journée sélectionnée';
  });

  console.log('\n4. Journal : filtres, tri, recherche');
  w.App.state.view = 'journal'; w.App.render();
  check('lignes du tableau', () => d.querySelectorAll('tr[data-id]').length + ' lignes');
  check('tri par colonne', () => {
    d.querySelector('th[data-sort="netPnl"]').click();
    return 'tri P&L net';
  });
  check('recherche « xau »', () => {
    w.App.state.filters.search = 'xau';
    w.App.render();
    const n = d.querySelectorAll('tr[data-id]').length;
    w.App.state.filters.search = '';
    w.App.render();
    return n + ' résultat(s)';
  });
  check('preset 7 jours', () => {
    w.App.applyPreset('7d');
    return d.querySelectorAll('tr[data-id]').length + ' lignes sur 7 jours';
  });
  check('preset tout', () => { w.App.applyPreset('all'); return d.querySelectorAll('tr[data-id]').length + ' lignes'; });

  console.log('\n4 bis. Journal en cartes (tablette / tactile)');
  check('bascule en vue cartes', () => {
    w.App.state.journalView = 'cards';
    w.App.render();
    const n = d.querySelectorAll('.trade-card').length;
    if (!n) throw new Error('aucune carte rendue');
    return n + ' cartes';
  });
  check('cellules clés de la carte', () => {
    const c = d.querySelector('.trade-card');
    ['tc-pnl', 'tc-grid', 'tc-meta'].forEach((cl) => { if (!c.querySelector('.' + cl)) throw new Error(cl + ' manquant'); });
    return 'P&L, grille, méta OK';
  });
  check('toucher une carte ouvre le formulaire', () => {
    d.querySelector('.trade-card').click();
    const f = lastModal() && lastModal().querySelector('form');
    if (!f) throw new Error('formulaire non ouvert');
    purgeModals();
    return 'édition au doigt OK';
  });
  check('retour en vue tableau', () => {
    w.App.state.journalView = 'table';
    w.App.render();
    if (!d.querySelectorAll('tr[data-id]').length) throw new Error('tableau absent');
    return 'OK';
  });

  console.log('\n5. Formulaire de trade');
  check('ouverture + aperçu calculé', () => {
    purgeModals();
    w.App.openTradeForm(null, w.App.buildModel());
    const form = lastModal().querySelector('form');
    if (!form) throw new Error('formulaire absent');
    form.elements.symbol.value = 'EURUSD';
    form.elements.entry.value = '1.0850';
    form.elements.stop.value = '1.0830';
    form.elements.exit.value = '1.0900';
    form.elements.size.value = '1';
    form.elements.entry.dispatchEvent(new w.Event('input'));
    const preview = lastModal().querySelector('#preview');
    if (!preview || preview.innerHTML.indexOf('Aperçu') === -1) throw new Error('aperçu manquant');
    return 'aperçu OK';
  });
  check('enregistrement du trade', () => {
    const before = w.App.state.trades.length;
    const btns = lastModal().querySelectorAll('.modal-foot .btn');
    btns[btns.length - 1].click();
    if (w.App.state.trades.length !== before + 1) throw new Error('trade non ajouté');
    return w.App.state.trades.length + ' trades';
  });

  console.log('\n6. Plan : checklists');
  w.App.state.view = 'plan'; w.App.render();
  check('blocs du plan', () => {
    const n = d.querySelectorAll('.plan-block').length;
    if (n < 9) throw new Error(n + ' blocs');
    return n + ' blocs';
  });
  check('case cochée + progression', () => {
    const box = d.querySelector('input[data-check]');
    box.checked = true;
    box.dispatchEvent(new w.Event('change'));
    const cnt = d.querySelector('[data-progress] .cl-count').textContent;
    return 'compteur ' + cnt;
  });

  console.log('\n6 bis. Application installable (PWA)');
  check('manifest lié et lisible', () => {
    const link = d.querySelector('link[rel=manifest]');
    if (!link) throw new Error('lien manifest absent');
    return link.getAttribute('href');
  });
  check('icônes et métadonnées iOS', () => {
    const apple = d.querySelector('link[rel=apple-touch-icon]');
    const cap = d.querySelector('meta[name=apple-mobile-web-app-capable]');
    if (!apple || !cap) throw new Error('métadonnées manquantes');
    return apple.getAttribute('href');
  });
  check('bandeau d\'installation présent', () => {
    if (!d.getElementById('installBanner') || !d.getElementById('ibAction')) throw new Error('bandeau absent');
    w.PWA.showBanner();
    return d.getElementById('installBanner').hidden ? 'masqué' : 'affiché';
  });
  check('service worker déclaré dans index.html', () => {
    const html = require('fs').readFileSync(require('path').join(ROOT, 'index.html'), 'utf8');
    if (!/pwa\.js/.test(html)) throw new Error('pwa.js non chargé');
    const sw = require('fs').readFileSync(require('path').join(ROOT, 'sw.js'), 'utf8');
    if (!/addEventListener\('fetch'/.test(sw)) throw new Error('gestion du cache absente');
    return 'sw.js + pwa.js présents';
  });

  console.log('\n7. Paramètres + export/import');
  check('formulaire paramètres', () => {
    w.App.state.view = 'params'; w.App.render();
    const f = d.getElementById('settingsForm');
    f.elements.startingCapital.value = '20000';
    f.dispatchEvent(new w.Event('submit'));
    return 'capital → ' + w.App.state.settings.startingCapital;
  });
  check('aller-retour CSV', () => {
    const csv = w.Store.tradesToCSV(w.App.state.trades);
    const back = w.Store.csvToTrades(csv);
    if (back.trades.length !== w.App.state.trades.length) throw new Error('perte de lignes');
    return back.trades.length + ' trades relus';
  });

  console.log('\n8. Import de CSV collé');
  check('import de 3 trades', () => {
    w.App.state.trades = [];
    w.App.state.view = 'journal';
    w.App.render();
    purgeModals();
    w.App.openImportDialog(w.App.buildModel());
    const mod = lastModal();
    if (!mod || !mod.querySelector('#impPaste')) throw new Error('modale d\'import absente');
    d.getElementById('impPasteBtn').click();
    mod.querySelector('.import-paste textarea').value =
      'Date;Heure;Instrument;Sens;Entrée;Stop;Sortie;Taille;Risque;Frais;Respect du plan;Émotion;Erreur;Notes\n' +
      '01/09/2026;09:15;EURUSD;Long;1,0850;1,0830;1,0892;0,50;100,00;5,00;oui;Calme;Aucune;Test import\n' +
      '2026-09-02;15:40;XAUUSD;Short;2342,50;2348,00;2330,00;0,20;115,00;6,50;partiel;Impatient;Entrée anticipée;\n' +
      '03/09/2026;10:05;US30;Long;39150;39060;39050;1,20;105,00;4,00;non;Revanche;Revenge trading;Hors plan';
    d.getElementById('impPasteGo', mod).click();
    if (w.App.state.trades.length !== 3) throw new Error(w.App.state.trades.length + ' trades importés au lieu de 3');
    const t = w.App.state.trades[0];
    return 'R=' + t.rMultiple + ', P&L net=' + t.netPnl + ', prix relu=' + t.entry;
  });
  check('rendu après import', () => {
    lastModal().querySelector('[data-close]').click();
    purgeModals();
    w.App.render();
    return d.querySelectorAll('tr[data-id]').length + ' lignes';
  });

  console.log('\n9. Vidage complet');
  check('journal vide → état vide', () => {
    w.App.state.trades = [];
    w.App.state.view = 'journal';
    w.App.render();
    if (!d.querySelector('.empty')) throw new Error('pas d\'état vide');
    return 'état vide affiché';
  });
  check('dashboard sans données', () => {
    w.App.state.view = 'dashboard'; w.App.render();
    return 'ok';
  });

  if (errors.length) {
    console.log('\n❌ ' + errors.length + ' erreur(s) :');
    errors.forEach((e) => console.log('   - ' + e));
    process.exit(1);
  }
  console.log('\n✅ Tous les contrôles sont passés, aucune erreur JS.\n');
})().catch((e) => {
  console.error('Échec du test :', e);
  process.exit(1);
});
