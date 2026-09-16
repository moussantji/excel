/* =========================================================
   routine-test.js — recette de « Ma routine, jour par jour »

   Vérifie, sans réseau et sans navigateur :
   - la source unique : les moments et leurs cases viennent du
     plan (plan.js), ils ne sont pas recopiés — si le plan change,
     la routine suit ;
   - les dates : jour affiché, veille, lendemain, dimanche, et le
     fait que la revue hebdomadaire ne compte que le dimanche ;
   - le score d'une journée : 13 cases en semaine, 17 le dimanche,
     « entamée », « complète », le pourcentage ;
   - l'enregistrement : une case cochée est datée, une journée
     vidée disparaît du fichier, cocher un jour ne touche pas les
     autres (le lendemain reste vide) ;
   - la série de jours complets : deux jours d'affilée font 2, un
     trou la casse, une journée entamée mais non finie arrête la
     série, une journée pas encore commencée laisse compter hier ;
   - le mois : nombre de cases, décalage du premier jour, dimanches
     et jours à venir signalés, bilan du mois et de la semaine ;
   - l'affichage : 17 cases, 4 moments, la grille du mois, aucun
     lien externe, aucun emoji ;
   - l'intégration : fichier chargé par la page avant la vue Plan,
     présent dans le cache hors ligne, carte rendue dans la vue
     Plan, case cochée pour de vrai et état rangé dans le journal.

   Usage : NODE_PATH=/tmp/node_modules node tools/routine-test.js
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
const jour = (d) => new Date(d).toISOString().slice(0, 10);

/* ---- bac isolé : Store + Plan + Routine, sans navigateur ---- */
function bac() {
  const dom = new JSDOM('<!doctype html><html><body><div id="plan"></div></body></html>',
    { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  const store = new Map();
  Object.defineProperty(w, 'localStorage', {
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
  ['store.js', 'plan.js', 'routine.js'].forEach((f) => {
    const sc = w.document.createElement('script');
    sc.textContent = lire('assets/js/' + f);
    w.document.head.appendChild(sc);
  });
  w.__cles = () => [...store.keys()];
  return w;
}

(async () => {
  const w = bac();
  const R = w.Routine, Plan = w.Plan;
  const AUJ = R.aujourdhui();
  const lundi = (() => { let d = AUJ; while (new Date(d + 'T12:00:00Z').getUTCDay() !== 1) d = R.decaler(d, -1); return d; })();
  const dimanche = R.decaler(lundi, 6);

  console.log('\n1. Les moments viennent du plan');
  const bloc = Plan.data.blocks.filter((b) => b.id === 'routine')[0];
  const attendus = bloc.items.filter((i) => i.type === 'routine');
  const ms = R.moments();
  verif('quatre moments sont repris', ms.length === 4 && ms.length === attendus.length, ms.map((m) => m.id).join(' '));
  verif('les titres sont ceux du plan', ms.every((m, i) => m.titre === attendus[i].title),
    ms.map((m) => m.titre.split(' (')[0]).join(' · '));
  verif('les cases sont celles du plan, mot pour mot',
    ms.every((m, i) => m.items.length === attendus[i].items.length && m.items.every((it, k) => it.texte === attendus[i].items[k])));
  verif('les clés de cases sont uniques', new Set(ms.flatMap((m) => m.items.map((i) => i.cle))).size === ms.reduce((a, m) => a + m.items.length, 0));
  verif('chaque case porte sa clé et son texte', ms.every((m) => m.items.every((i) => /^[a-z]{2}:\d+$/.test(i.cle) && i.texte.length > 20)));

  console.log('\n2. Les dates');
  verif('le jour affiché est aujourd\'hui', R.jourAffiche() === AUJ, AUJ);
  verif('la veille et le lendemain se calculent', R.decaler(AUJ, -1) < AUJ && R.decaler(AUJ, 1) > AUJ);
  verif('le lundi est bien un lundi', new Date(lundi + 'T12:00:00Z').getUTCDay() === 1, lundi);
  verif('le dimanche de cette semaine est à +6 jours', new Date(dimanche + 'T12:00:00Z').getUTCDay() === 0, dimanche);
  verif('la date s\'écrit en français', /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{4}$/.test(R.jourLong(AUJ)),
    R.jourLong(AUJ));
  verif('les moments du dimanche contiennent la revue hebdomadaire', R.momentsRequis(dimanche).length === 4);
  verif('en semaine, la revue ne compte pas', R.momentsRequis(lundi).length === 3);

  console.log('\n3. Le score d\'une journée');
  R.choisir(lundi);
  verif('une journée vide ne compte rien', R.scoreJour(lundi).faits === 0 && !R.scoreJour(lundi).commence && !R.scoreJour(lundi).complet);
  verif('la semaine demande 13 cases', R.scoreJour(lundi).total === 13, R.scoreJour(lundi).total + ' cases');
  verif('le dimanche en demande 17', R.scoreJour(dimanche).total === 17, R.scoreJour(dimanche).total + ' cases');
  R.basculer(lundi, 'av:0');
  verif('une case cochée rend la journée « entamée »', R.scoreJour(lundi).commence && !R.scoreJour(lundi).complet);
  verif('le pourcentage suit', R.scoreJour(lundi).pct === Math.round(1 / 13 * 100), R.scoreJour(lundi).pct + ' %');
  R.cocherTout(lundi, true);
  const sl = R.scoreJour(lundi);
  verif('tout cocher rend la journée complète', sl.complet && sl.faits === sl.total && sl.pct === 100);
  R.cocherTout(lundi, false);
  verif('vider une journée la remet à zéro', R.scoreJour(lundi).faits === 0 && R.lireTout()[lundi] === undefined);

  console.log('\n4. L\'enregistrement, jour par jour');
  R.basculer(lundi, 'pe:0');
  R.basculer(lundi, 'ap:2');
  const tout = R.lireTout();
  verif('les cases sont datées', !!tout[lundi] && tout[lundi]['pe:0'] === true && tout[lundi]['ap:2'] === true,
    Object.keys(tout[lundi]).join(' '));
  verif('le lendemain reste vide', R.lireTout()[R.decaler(lundi, 1)] === undefined);
  verif('décocher retire la case', (R.basculer(lundi, 'pe:0', false), !R.lireTout()[lundi]['pe:0']));
  verif('une clé inconnue n\'est pas enregistrée', (R.basculer(lundi, 'zz:9'), R.lireTout()[lundi]['zz:9'] === undefined));
  verif('rien n\'est écrit hors du journal',
    w.__cles().every((k) => k.indexOf('journal-trading:plan') === 0), w.__cles().join(' '));
  verif('cocher un moment coche toutes ses cases', (R.cocherMoment(lundi, 'av', true), Object.keys(R.lireTout()[lundi]).filter((k) => k.indexOf('av:') === 0).length === 4));
  verif('décocher un moment les retire toutes', (R.cocherMoment(lundi, 'av', false), Object.keys(R.lireTout()[lundi]).filter((k) => k.indexOf('av:') === 0).length === 0));

  console.log('\n5. La série de jours complets');
  const J3 = R.decaler(AUJ, -2), J2 = R.decaler(AUJ, -1);
  R.cocherTout(J3, true);
  verif('un seul jour complet : série de 1', R.serie(AUJ) === 1 || R.serie(J3) === 1, 'série = ' + R.serie(J3));
  R.cocherTout(J2, true);
  verif('deux jours d\'affilée font 2', R.serie(J2) === 2, 'série = ' + R.serie(J2));
  R.cocherTout(J3, false);
  verif('un trou casse la série', R.serie(J2) === 1, 'série = ' + R.serie(J2));
  R.cocherTout(J2, false);
  verif('plus rien : série de 0', R.serie(AUJ) === 0);
  R.cocherTout(R.decaler(AUJ, -1), true);
  R.basculer(AUJ, 'av:0');
  verif('journée entamée mais non finie : la série s\'arrête', R.serie(AUJ) === 0);
  R.basculer(AUJ, 'av:0', false);
  verif('journée pas encore commencée : la série compte jusqu\'à hier', R.serie(AUJ) === 1);

  console.log('\n6. Le mois et la semaine');
  const M = R.mois(lundi);
  const nbj = new Date(Date.UTC(new Date(lundi + 'T12:00:00Z').getUTCFullYear(), new Date(lundi + 'T12:00:00Z').getUTCMonth() + 1, 0)).getUTCDate();
  verif('le mois a toutes ses cases', M.cases.length === nbj, M.cases.length + ' jours');
  verif('le décalage place le 1er sur la bonne colonne',
    M.decalage === (new Date(M.premier + 'T12:00:00Z').getUTCDay() + 6) % 7, 'décalage ' + M.decalage);
  verif('les dimanches sont signalés', M.cases.filter((c) => c.dimanche).length === M.cases.filter((c) => new Date(c.date + 'T12:00:00Z').getUTCDay() === 0).length);
  verif('les jours à venir sont marqués', M.cases.some((c) => c.futur) || M.cases[M.cases.length - 1].date <= AUJ);
  const bm = R.bilanMois(lundi);
  verif('le bilan du mois compte les jours écoulés et complets', bm.ecoules > 0 && bm.complets >= 1, JSON.stringify(bm));
  verif('le taux est un pourcentage', bm.taux >= 0 && bm.taux <= 100, bm.taux + ' %');
  const bs = R.bilanSemaine(lundi);
  verif('la semaine commence un lundi', new Date(bs.lundi + 'T12:00:00Z').getUTCDay() === 1, bs.lundi);
  verif('la semaine ne compte que les jours écoulés', bs.ouverts <= 5 && bs.ouverts >= 1, bs.ouverts + ' jour(s) ouvré(s)');

  console.log('\n7. La carte affichée');
  R.choisir(null);
  R.cocherTout(R.decaler(AUJ, -1), true);
  const html = R.carte({});
  verif('les espaces de saisie sont là', (html.match(/data-rt="/g) || []).length === 17, (html.match(/data-rt="/g) || []).length + ' cases');
  verif('les quatre moments sont rendus', (html.match(/class="rt-moment/g) || []).length === 4);
  verif('la grille du mois est là', (html.match(/class="rt-case /g) || []).length === M.cases.length);
  verif('le jour affiché est titré en français', new RegExp(R.jourLong(AUJ)).test(html));
  verif('le résumé de la semaine est écrit', /Cette semaine : \d+ \/ \d+ jour\(s\) ouvré\(s\)/.test(html));
  verif('la journée d\'hier marquée complète apparaît dans la grille', /rt-case complet/.test(html));
  verif('la légende explique les trois états', /complète/.test(html) && /entamée/.test(html) && /rien de coché/.test(html));
  verif('l\'enregistrement dans le journal est annoncé', /s\'enregistre avec le journal/.test(html));
  verif('aucun lien externe', !/https?:\/\//.test(lire('assets/js/routine.js').replace(/^\s*\*.*$/gm, '') + html));
  verif('aucun appel réseau', !/fetch\(|XMLHttpRequest|<img/.test(html));
  verif('aucun emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));

  console.log('\n8. L\'intégration à l\'application');
  const idx = lire('index.html');
  verif('le module est chargé par la page', /assets\/js\/routine\.js/.test(idx));
  verif('il est chargé après le plan (dont il lit les moments)', idx.indexOf('assets/js/plan.js') < idx.indexOf('assets/js/routine.js'));
  verif('il est chargé avant la vue Plan', idx.indexOf('assets/js/routine.js') < idx.indexOf('assets/js/views.js'));
  const sw = lire('sw.js');
  verif('il est dans le cache hors ligne', /'\.\/assets\/js\/routine\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 16, 'v' + vCache);
  verif('la vue Plan appelle la carte', /global\.Routine\) html \+= global\.Routine\.carte\(App\)/.test(lire('assets/js/views.js')));
  verif('la vue Plan câble la routine', /global\.Routine\) global\.Routine\.cabler\(host, App\)/.test(lire('assets/js/views.js')));
  verif('la recette est déclarée dans les scripts', /"test:routine": "node tools\/routine-test\.js"/.test(lire('package.json')));
  verif('la routine est documentée dans le README', /[Rr]outine.*jour par jour|jour par jour/.test(lire('README.md')));
  verif('les cases suivent la charte tactile (hauteur de cible)', /\.rt-moment li label\{[^}]*min-height:42px/.test(lire('assets/css/styles.css')));

  /* ---- 9. dans la vraie vue Plan, en bac complet ---- */
  console.log('\n9. La routine dans la vue Plan');
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
  const carte = win.document.querySelector('#bloc-routine-jour');
  verif('la carte est rendue dans la vue Plan', !!carte);
  if (carte) {
    verif('elle propose les 17 cases du jour', carte.querySelectorAll('[data-rt]').length === 17);
    verif('elle montre les quatre moments', carte.querySelectorAll('.rt-moment').length === 4);
    verif('elle montre le mois en cours', carte.querySelectorAll('.rt-case').length >= 28);
    const box = carte.querySelector('[data-rt="av:0"]');
    const date = box.getAttribute('data-date');
    box.click();
    await new Promise((r) => setTimeout(r, 60));
    const etat = (win.Plan.loadChecks() || {}).routine || {};
    verif('cocher une case enregistre la journée', !!etat[date] && etat[date]['av:0'] === true, date + ' → ' + JSON.stringify(Object.keys(etat[date])));
    verif('le compteur du moment se met à jour sans redessiner', /1\/4/.test(carte.querySelector('.rt-compte').textContent));
    verif('le score du jour suit', /1 \/ 13/.test(carte.querySelector('.rt-score-texte').textContent.replace(/\s+/g, ' ')));
    /* décocher : la journée disparaît proprement */
    box.click();
    await new Promise((r) => setTimeout(r, 60));
    const etat2 = (win.Plan.loadChecks() || {}).routine || {};
    verif('décocher retire la journée du fichier', etat2[date] === undefined);
    /* le mois suit : la case du jour est marquée aujourd\'hui */
    const celleDuJour = carte.querySelector('.rt-case.auj');
    verif('la case d\'aujourd\'hui est signalée dans la grille', !!celleDuJour && celleDuJour.getAttribute('data-rt-jour-cell') === win.Routine.aujourdhui());
    /* « tout cocher » puis navigation */
    const toutBouton = carte.querySelector('[data-rt-jour]');
    toutBouton.click();
    await new Promise((r) => setTimeout(r, 350));
    const carte2 = win.document.querySelector('#bloc-routine-jour');
    verif('« tout cocher » remplit la journée', /13 \/ 13/.test(carte2.querySelector('.rt-score-texte').textContent.replace(/\s+/g, ' ')));
    verif('la grille du mois passe la journée en « complète »', !!carte2.querySelector('.rt-case.auj.complet'));
    const prec = carte2.querySelector('#rtPrec');
    prec.click();
    await new Promise((r) => setTimeout(r, 350));
    const carte3 = win.document.querySelector('#bloc-routine-jour');
    verif('le bouton « jour précédent » change de journée', carte3.querySelector('[data-rt]').getAttribute('data-date') === win.Routine.decaler(win.Routine.aujourdhui(), -1));
    verif('la veille apparaît vide', /0 \/ 13/.test(carte3.querySelector('.rt-score-texte').textContent.replace(/\s+/g, ' ')));
    const retour = carte3.querySelector('#rtAujourd');
    verif('un lien ramène à aujourd\'hui', !!retour);
    if (retour) retour.click();
    await new Promise((r) => setTimeout(r, 350));
    verif('le retour à aujourd\'hui est effectif',
      win.document.querySelector('#bloc-routine-jour [data-rt]').getAttribute('data-date') === win.Routine.aujourdhui());
  }
  /* la routine mène à l'exemple en basse unité de temps, sans le recopier */
  verif('la carte de la routine propose l\'exemple en 15 minutes',
    /id="rtLtf"/.test(lire('assets/js/routine.js')) && /EtudeLtf/.test(lire('assets/js/routine.js')) === false,
    'un lien, pas une copie');
  const lienLtf = win.document.querySelector('#rtLtf');
  verif('le lien est dans la carte de la routine', !!lienLtf);
  if (lienLtf) {
    lienLtf.click();
    await new Promise((r) => setTimeout(r, 400));
    verif('le lien ouvre la vue Formation', win.App.state.view === 'formation', win.App.state.view);
    verif('l\'exemple en 15 minutes y est', !!win.document.querySelector('#etudeLtf'));
    verif('et il est entier (les deux séquences et le bouton TradingView)',
      !!win.document.querySelector('#etudeLtf #ltfOuvrirQuinze') &&
      win.document.querySelectorAll('#etudeLtf svg').length >= 5,
      win.document.querySelectorAll('#etudeLtf svg').length + ' figures');
  }
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, routine quotidienne vérifiée.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
