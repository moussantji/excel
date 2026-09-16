/* =========================================================
   taille-test.js — recette du calculateur de taille de position

   Vérifie, sans réseau et sans navigateur :
   - la formule du plan, recalculée à la main : R = capital × risque %,
     distance = |entrée − stop| ÷ pas du pip, taille = R ÷ (distance ×
     valeur du pip par lot) ;
   - l'exemple du plan (10 000 €, 1 %, 12 pips, 10 €/lot → 0,83 lot) et
     les cas limites : virgule acceptée, champs manquants listés, arrondi
     toujours vers le bas (jamais plus que le risque) ;
   - le pas du pip par instrument (EURUSD 0,0001, or 0,1, indices 1) ;
   - le contrôle qui décide : ce que coûte le plus petit lot (0,01) en
     pourcentage du capital, et le capital qu'il faudrait pour que le
     stop tienne dans le risque autorisé — le même calcul que l'étude de
     cas (or, 1 000 $, 20,7 points → 2,07 % et 2 070 $) ;
   - l'objectif 1:7 dans le bon sens (achat au-dessus, vente en dessous) ;
   - la carte de la vue Plan : rendue sous le bloc 03, préremplie avec les
     Paramètres, mise à jour à la saisie, verdict conforme ou refus ;
   - le formulaire de trade : la ligne « taille pour 1 % », le bouton qui
     remplit le champ Taille, et l'aperçu qui affiche le risque obtenu ;
   - le montage : page, cache hors ligne, scripts, version, README, CSS.

   Usage : node tools/taille-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const plat = (s) => String(s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');

let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const proche = (a, b, eps) => a !== null && a !== undefined && Math.abs(a - b) < (eps === undefined ? 1e-6 : eps);

/* ---- bac isolé : l'état (pas du pip) et le calculateur ---- */
function bac() {
  const dom = new JSDOM('<!doctype html><html><body><div id="h"></div></body></html>',
    { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  ['store.js', 'taille.js'].forEach((f) => {
    const sc = w.document.createElement('script');
    sc.textContent = lire('assets/js/' + f);
    w.document.head.appendChild(sc);
  });
  return w;
}

(async () => {
  const w = bac();
  const T = w.Taille;

  console.log('\n1. La formule du plan');
  /* l'exemple écrit dans le plan : 10 000 €, 1 %, stop 12 pips, 10 €/lot */
  const plan = T.calcul({ capital: 10000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1000, stop: 1.0988 });
  verif('le risque engagé est capital × risque %', proche(plan.r, 100), plat(String(plan.r)) + ' €');
  verif('la distance est convertie en pips', proche(plan.distancePips, 12, 1e-6), plan.distancePips.toFixed(4) + ' pips');
  verif('l\'exemple du plan donne 0,83 lot', proche(plan.taille, 100 / 120, 1e-9), plan.taille.toFixed(4));
  verif('la taille est arrondie vers le bas, jamais au-dessus du risque', proche(plan.tailleArrondie, 0.83), String(plan.tailleArrondie));
  verif('l\'unité affichée suit le pas du pip', plan.unite === 'pips', plan.unite);
  const or = T.calcul({ capital: 1000, risquePct: 1, symbole: 'XAUUSD', pipValuePerLot: 10, entree: 4313.7, stop: 4293 });
  verif('sur l\'or, 20,7 points font 207 pips (pas de 0,1)', proche(or.distancePips, 207, 1e-6), or.distancePips.toFixed(1));
  verif('et 0,00 lot pour 1 % de 1 000 $', or.tailleArrondie === 0 && proche(or.taille, 0.00483, 1e-4), or.taille.toFixed(4));
  verif('le verdict du plus petit lot est « trop gros »', or.miniTropGros === true && or.faisable === false);
  verif('la taille exacte reste disponible', proche(or.taille, 10 / (207 * 10), 1e-9));
  const indice = T.calcul({ capital: 10000, risquePct: 1, symbole: 'US30', pipValuePerLot: 1, entree: 45000, stop: 44850, sens: 'short' });
  verif('sur un indice, la distance se compte en points', indice.unite === 'points' && proche(indice.distancePips, 150), indice.distancePips + ' points');
  verif('0,66 lot pour 1 % de 10 000 $ avec 150 points', proche(indice.tailleArrondie, 0.66), String(indice.tailleArrondie));

  console.log('\n2. Les cas limites');
  const virgule = T.calcul({ capital: '1000,5', risquePct: '1,5', symbole: 'EURUSD', pipValuePerLot: '10', entree: '1,1000', stop: '1,0980' });
  verif('les nombres à la virgule sont acceptés', proche(virgule.r, 15.0075, 1e-6), String(virgule.r));
  const sansStop = T.calcul({ capital: 10000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1 });
  verif('sans stop, aucune taille n\'est inventée', sansStop.taille === null && sansStop.distance === null);
  verif('et l\'application dit ce qui manque', sansStop.manquant.length === 1 && /entrée/.test(sansStop.manquant[0]), sansStop.manquant.join(', '));
  const sansCapital = T.calcul({ symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1, stop: 1.09 });
  verif('sans capital, la taille reste vide et le manque est nommé',
    sansCapital.taille === null && /capital/.test(sansCapital.manquant.join(', ')), sansCapital.manquant.join(', '));
  const euros = T.calcul({ capital: 10000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1, stop: 1.1 });
  verif('une distance nulle ne produit pas d\'infini', euros.taille === null && euros.distance === 0);
  const gros = T.calcul({ capital: 100000, risquePct: 0.5, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.2, stop: 1.1995 });
  verif('un stop très serré donne une taille plafonnée par le risque',
    proche(gros.taille, 500 / 50, 1e-9) && proche(gros.tailleArrondie, 10), String(gros.tailleArrondie) + ' lots');

  console.log('\n3. Le pas du pip par instrument');
  verif('EURUSD : 0,0001', w.Store.pipSize('EURUSD') === 0.0001);
  verif('USDJPY : 0,01', w.Store.pipSize('USDJPY') === 0.01);
  verif('XAUUSD : 0,1', w.Store.pipSize('XAUUSD') === 0.1);
  verif('US30 : 1', w.Store.pipSize('US30') === 1);
  const devine = T.calcul({ capital: 1000, risquePct: 1, pipValuePerLot: 10, entree: 2000, stop: 1990 });
  verif('sans instrument, le pas par défaut est celui du forex', proche(devine.distancePips, 100000), devine.distancePips.toFixed(0) + ' pips');

  console.log('\n4. Ce que coûte le plus petit lot');
  const petit = T.calcul({ capital: 1000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1, stop: 1.08 });
  verif('un stop de 200 pips à 0,01 lot engage 20 $', proche(petit.risqueMini, 20, 1e-6), petit.risqueMini.toFixed(2) + ' $');
  verif('soit 2,00 % d\'un compte de 1 000 $', proche(petit.pctMini, 2, 1e-6), petit.pctMini.toFixed(2) + ' %');
  verif('il faudrait 2 000 $ pour tenir dans 1 %', proche(petit.capitalMini, 2000, 1e-6), petit.capitalMini.toFixed(0) + ' $');
  verif('le verdict refuse ce trade', petit.faisable === false && petit.miniTropGros === true);
  /* le même calcul que l'étude de cas et l'exemple en 15 minutes */
  const orMini = T.calcul({ capital: 1000, risquePct: 1, symbole: 'XAUUSD', pipValuePerLot: 10, entree: 4313.7, stop: 4293 });
  verif('or, 20,7 points : 20,70 $ au plus petit lot', proche(orMini.risqueMini, 20.7, 1e-6), orMini.risqueMini.toFixed(2) + ' $');
  verif('soit 2,07 % du capital (le chiffre de l\'exemple en 15 minutes)', proche(orMini.pctMini, 2.07, 1e-6), orMini.pctMini.toFixed(2) + ' %');
  verif('et 2 070 $ de capital minimum pour ce stop', proche(orMini.capitalMini, 2070, 1e-6), orMini.capitalMini.toFixed(0) + ' $');
  const or2500 = T.calcul({ capital: 2500, risquePct: 1, symbole: 'XAUUSD', pipValuePerLot: 10, entree: 4313.7, stop: 4293 });
  verif('avec 2 500 $, le plus petit lot tient dans 1 %', or2500.faisable === true && proche(or2500.tailleArrondie, 0.01),
    or2500.tailleArrondie + ' lot, ' + or2500.pctMini.toFixed(2) + ' %');

  console.log('\n5. L\'objectif 1:7');
  const achat = T.calcul({ capital: 10000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1, stop: 1.0988, sens: 'long' });
  verif('à l\'achat, l\'objectif est au-dessus de l\'entrée', proche(achat.cibleUnSept, 1.1 + 7 * 0.0012, 1e-9), achat.cibleUnSept.toFixed(4));
  const vente = T.calcul({ capital: 10000, risquePct: 1, symbole: 'EURUSD', pipValuePerLot: 10, entree: 1.1, stop: 1.1012, sens: 'short' });
  verif('à la vente, il est en dessous', proche(vente.cibleUnSept, 1.1 - 7 * 0.0012, 1e-9), vente.cibleUnSept.toFixed(4));
  verif('l\'objectif vaut sept fois la distance', proche(achat.distancePips * 7, 84, 1e-6), (achat.distancePips * 7).toFixed(1) + ' pips');
  const fort = T.calcul({ capital: 1000, risquePct: 1, symbole: 'XAUUSD', pipValuePerLot: 10, entree: 4358.9, stop: 4293, sens: 'short' });
  verif('sur l\'or, un stop de 659 pips demande un objectif à 7 fois',
    proche(fort.cibleUnSept, 4358.9 - 7 * 65.9, 1e-6), fort.cibleUnSept.toFixed(1) + ' $');

  /* ---- la carte et le formulaire, dans la vraie application ---- */
  console.log('\n6. La carte dans la vue Plan');
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
  const app = await JSDOM.fromFile(path.join(RACINE, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(win) {
      const store = new Map();
      Object.defineProperty(win, 'localStorage', {
        configurable: true,
        value: {
          getItem: (k) => (store.has(k) ? store.get(k) : null),
          setItem: (k, v) => store.set(k, String(v)),
          removeItem: (k) => store.delete(k),
          clear: () => store.clear(),
          key: (i) => [...store.keys()][i] || null,
          get length() { return store.size; }
        }
      });
    }
  });
  const win = app.window;
  await new Promise((r) => win.addEventListener('load', r, { once: true }));
  await tick();
  const onglet = win.document.querySelector('[data-view="plan"]');
  if (onglet) onglet.click();
  await new Promise((r) => setTimeout(r, 300));
  const carte = win.document.querySelector('#tailleCalc');
  verif('la carte du calculateur est rendue dans le plan', !!carte);
  if (carte) {
    const bloc = win.document.querySelector('#bloc-risque');
    verif('elle se place juste après le bloc 03 (la formule)',
      !!(bloc && bloc.nextElementSibling && bloc.nextElementSibling.id === 'tailleCalc'));
    const champ = (id) => carte.querySelector('#' + id);
    verif('le capital des Paramètres est prérempli', champ('tzCapital') && Number(champ('tzCapital').value) === 10000,
      champ('tzCapital') && champ('tzCapital').value);
    verif('le risque par trade aussi', champ('tzRisque') && Number(champ('tzRisque').value) === 1);
    verif('la valeur du pip par lot aussi', champ('tzPipValue') && Number(champ('tzPipValue').value) === 10);
    verif('le premier instrument des Paramètres est proposé', champ('tzSymbole') && champ('tzSymbole').value === 'EURUSD',
      champ('tzSymbole') && champ('tzSymbole').value);
    verif('les six champs et le sens sont là',
      ['tzCapital', 'tzRisque', 'tzSymbole', 'tzPipValue', 'tzEntree', 'tzStop', 'tzSens'].every((id) => !!champ(id)));
    /* l'exemple du plan, tapé comme un utilisateur */
    champ('tzEntree').value = '1.1000';
    champ('tzEntree').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzStop').value = '1.0988';
    champ('tzStop').dispatchEvent(new win.Event('input', { bubbles: true }));
    const texte = () => plat(carte.querySelector('#tzResultat').textContent);
    verif('saisir l\'entrée et le stop donne la taille en direct',
      /0,83/.test(texte()) && /100,00/.test(texte()), texte().slice(0, 90));
    verif('la distance est dite en pips', /12,0 pips/.test(texte()));
    verif('le plus petit lot est chiffré', /1,20/.test(texte()) && /0,01 %/.test(texte()));
    verif('l\'objectif 1:7 est donné', /1,10840/.test(texte()) && /84,0 pips/.test(texte()));
    verif('et le verdict est « conforme »', /Conforme/.test(texte()) && /tz-verdict ok/.test(carte.innerHTML));
    /* le cas qui refuse : l'or sur un petit compte */
    champ('tzSymbole').value = 'XAUUSD';
    champ('tzSymbole').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzCapital').value = '1000';
    champ('tzCapital').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzEntree').value = '4313.7';
    champ('tzEntree').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzStop').value = '4293';
    champ('tzStop').dispatchEvent(new win.Event('input', { bubbles: true }));
    const refus = texte();
    verif('l\'or sur 1 000 $ est refusé, chiffres à l\'appui',
      /2,07 %/.test(refus) && /2 070/.test(refus) && /laisser passer/.test(refus), refus.slice(0, 120));
    verif('le refus est signalé comme tel', /tz-verdict refus/.test(carte.innerHTML));
    champ('tzEntree').value = '4313.7';
    champ('tzEntree').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzStop').value = '4330';
    champ('tzStop').dispatchEvent(new win.Event('input', { bubbles: true }));
    champ('tzSens').value = 'short';
    champ('tzSens').dispatchEvent(new win.Event('change', { bubbles: true }));
    verif('passer en vente place l\'objectif en dessous',
      /4 199,6/.test(texte()), texte().slice(-90));
    verif('la formule est rappelée sous la carte', /Taille = R/.test(plat(carte.textContent)));
    verif('rien n\'est chargé de l\'extérieur',
      !/<img|url\(|https?:\/\/|fetch\(/.test(carte.innerHTML) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(carte.innerHTML));
  }

  console.log('\n7. Le formulaire de trade');
  const ongletJournal = win.document.querySelector('[data-view="journal"]');
  if (ongletJournal) ongletJournal.click();
  await new Promise((r) => setTimeout(r, 300));
  const ajouter = win.document.querySelector('#btnAdd');
  verif('le bouton « Nouveau trade » est là', !!ajouter);
  if (ajouter) {
    ajouter.click();
    await new Promise((r) => setTimeout(r, 120));
    const form = win.document.querySelector('.modal-overlay .trade-form-grid');
    verif('le formulaire s\'ouvre', !!form);
    if (form) {
      const ligne = form.querySelector('#tzLigne');
      verif('la ligne de taille conseillée est dans le formulaire', !!ligne);
      verif('sans entrée ni stop, elle reste vide et le bouton est éteint',
        plat(ligne.textContent).indexOf('—') > -1 && ligne.querySelector('#tzUtiliser').disabled === true);
      const poser = (nom, v) => {
        const e = form.querySelector('[name="' + nom + '"]');
        e.value = v;
        e.dispatchEvent(new win.Event('input', { bubbles: true }));
        e.dispatchEvent(new win.Event('change', { bubbles: true }));
      };
      poser('symbol', 'EURUSD');
      poser('entry', '1.1000');
      poser('stop', '1.0988');
      verif('entrée et stop saisis : la taille apparaît', /0,83 lot/.test(plat(ligne.textContent)), plat(ligne.textContent).slice(0, 80));
      verif('la note dit ce que coûte le plus petit lot', /1,20/.test(plat(ligne.textContent)) && /0,01 %/.test(plat(ligne.textContent)));
      ligne.querySelector('#tzUtiliser').click();
      await tick();
      const champTaille = form.querySelector('[name="size"]');
      verif('le bouton remplit le champ Taille', champTaille && Number(champTaille.value) === 0.83, champTaille && champTaille.value);
      const apercu = plat(form.querySelector('#preview').textContent);
      verif('l\'aperçu affiche alors le risque obtenu', /99,60 € \(1,00 % du capital\)/.test(apercu), apercu.slice(0, 100));
      /* un cas trop gros : l'or avec un petit compte */
      win.App.state.settings.startingCapital = 1000;
      poser('symbol', 'XAUUSD');
      poser('entry', '4313.7');
      poser('stop', '4293');
      const texteLigne = plat(ligne.textContent);
      verif('le titre de la ligne suit le capital des Paramètres', /de 1 000 € sur ce stop/.test(plat(ligne.textContent))),
      verif('sur l\'or à 1 000 $, la ligne prévient au lieu de laisser faire',
        /2,07 %/.test(texteLigne) && /au-dessus du risque autorisé/.test(texteLigne), texteLigne.slice(0, 110));
      verif('l\'avertissement est marqué en rouge', /tz-ligne-note refus/.test(ligne.innerHTML));
      /* on enregistre le trade pour vérifier le risque réellement stocké */
      win.App.state.settings.startingCapital = 10000;
      poser('symbol', 'EURUSD');
      poser('entry', '1.1000');
      poser('stop', '1.0988');
      ligne.querySelector('#tzUtiliser').click();
      await tick();
      const boutonAjout = win.document.querySelector('.modal-foot .btn.primary');
      if (boutonAjout) {
        boutonAjout.click();
        await new Promise((r) => setTimeout(r, 120));
        const trades = win.App.state.trades || [];
        const t = trades[trades.length - 1];
        verif('le trade enregistré porte la taille calculée', t && Number(t.size) === 0.83, t && String(t.size));
        verif('et son risque vaut bien 1 % du capital',
          t && Number(t.riskAmount) > 0 && Number(t.riskAmount) <= 100.0001, t && String(t.riskAmount));
      }
    }
  }

  console.log('\n8. Le montage dans l\'application');
  const idx = lire('index.html');
  verif('le module est chargé par la page', /assets\/js\/taille\.js/.test(idx));
  verif('il est chargé avant les vues qui l\'appellent',
    idx.indexOf('taille.js') < idx.indexOf('assets/js/views.js') && idx.indexOf('taille.js') < idx.indexOf('assets/js/app.js'));
  verif('la vue Plan rend la carte et la câble',
    /global\.Taille\) html \+= global\.Taille\.carte\(App\)/.test(lire('assets/js/views.js')) &&
    /global\.Taille\) global\.Taille\.cabler\(host, App\)/.test(lire('assets/js/views.js')));
  verif('le formulaire de trade reçoit le bloc et son câblage',
    /global\.Taille \? global\.Taille\.bloc\(s\)/.test(lire('assets/js/app.js')) &&
    /global\.Taille\.cablerFormulaire\(form, s/.test(lire('assets/js/app.js')));
  const sw = lire('sw.js');
  verif('le fichier est dans le cache hors ligne', /'\.\/assets\/js\/taille\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 18, 'v' + vCache);
  verif('la recette est déclarée dans les scripts',
    /"test:taille": "node tools\/taille-test\.js"/.test(lire('package.json')) &&
    /npm run test:ltf && npm run test:taille/.test(lire('package.json')));
  const vAppT = (lire('package.json').match(/"version": "(\d+)\.(\d+)\.(\d+)"/) || []).slice(1, 4).map(Number);
  verif('la version de l\'application est relevée (3.2 ou plus)',
    vAppT[0] === 3 && vAppT[1] >= 2, vAppT.length === 3 ? 'v' + vAppT.join('.') : 'absente');
  verif('le pied de page annonce la version', /v3\.[2-9]/.test(idx));
  verif('le README explique le calculateur',
    /calculateur de taille|taille de position/i.test(lire('README.md')) && /node tools\/taille-test\.js/.test(lire('README.md')));
  const css = lire('assets/css/styles.css');
  verif('le style de la carte et de la ligne existe', /\.tz-carte/.test(css) && /\.tz-ligne/.test(css) && /\.tz-verdict\.refus/.test(css));
  verif('le calculateur ne s\'imprime pas', /@media print\{\.tz-carte,\.tz-ligne\{display:none\}\}/.test(css));
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, calculateur de taille vérifié.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
