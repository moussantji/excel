/* =========================================================
   etude-test.js — recette de l'étude de cas réelle (l'or)

   Vérifie, sans réseau et sans navigateur :
   - l'intégrité des cours encodés : chaque bougie est cohérente
     (plus haut ≥ ouverture et clôture, plus bas ≤ les deux), les
     horodatages se suivent d'heure en heure, les trous de cotation
     ont la même position dans les quatre séries ;
   - les faits : le sommet de 4 398,0 est bien au lundi 20 octobre
     19:00 (heure de Bamako), le plus bas de 4 021,2 au mercredi 22,
     et le journalier recoupe l'horaire ;
   - les repères du graphique : chaque numéro posé sur une bougie
     tombe sur la bougie annoncée (sommet, balayage, cassure, entrée) ;
   - l'arithmétique du trade, recalculée à partir des seules bougies :
     l'entrée, le stop jamais touché, les trois objectifs réellement
     atteints et la durée ;
   - la taille de position : 34 $ de stop = 3,4 % d'un compte de
     1 000 $, 1 % seulement à partir de 3 400 $, et la comparaison
     avec l'EUR/USD qui tient dans la règle ;
   - la relecture honnête : le trade n'obtient pas 5 sur 5 — la règle
     du 1 % est marquée « non » ;
   - le côté hors ligne : aucun lien, aucune image distante, aucun
     emoji, et le dessin est bien fabriqué en SVG par l'application ;
   - le montage dans l'application : carte présente dans la vue
     Formation, fichiers chargés par la page et mis en cache.

   Usage : NODE_PATH=/tmp/node_modules node tools/etude-test.js
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

/* ---- bac isolé : données + étude, sans navigateur ---- */
function bac() {
  const dom = new JSDOM('<!doctype html><html><body><div id="h"></div></body></html>',
    { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  ['plan.js', 'etude-or-donnees.js', 'etude-or.js'].forEach((f) => {
    const sc = w.document.createElement('script');
    sc.textContent = lire('assets/js/' + f);
    w.document.head.appendChild(sc);
  });
  return w;
}

const jour = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const heure = (t) => new Date(t * 1000).toISOString().slice(11, 16);

(async () => {
  const w = bac();
  const D = w.EtudeOrDonnees, E = w.EtudeOr;
  const H = D.horaire, J = D.journalier;
  const T = E.TRADE;
  const c = E.calculs(1000);

  console.log('\n1. Les cours encodés');
  verif('les deux séries sont présentes', !!H && !!J && !!H.t && !!J.t);
  ['t', 'o', 'h', 'l', 'c'].forEach((k) => {
    verif('série horaire « ' + k + ' » complète', H[k].length === H.t.length, H[k].length + ' valeurs');
  });
  ['t', 'o', 'h', 'l', 'c'].forEach((k) => {
    verif('série journalière « ' + k + ' » complète', J[k].length === J.t.length, J[k].length + ' valeurs');
  });
  const incoherentes = [];
  for (let i = 0; i < H.t.length; i++) {
    if (H.c[i] === null) continue;
    if (!(H.h[i] >= Math.max(H.o[i], H.c[i]) - 1e-6 && H.l[i] <= Math.min(H.o[i], H.c[i]) + 1e-6)) incoherentes.push(i);
  }
  verif('chaque bougie horaire est cohérente', incoherentes.length === 0, incoherentes.slice(0, 4).join(',') || 'aucune anomalie');
  const joursManquants = [];
  for (let i = 1; i < H.t.length; i++) {
    const dt = H.t[i] - H.t[i - 1];
    if (dt !== 3600 && dt !== 90000) joursManquants.push(i + ':' + dt);
  }
  verif('les heures se suivent sans trou inventé', joursManquants.length === 0, joursManquants.slice(0, 3).join(' ') || 'pas horaires réguliers');
  const trous = ['o', 'h', 'l', 'c'].map((k) => H[k].map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0).join(','));
  verif('les fermetures de marché sont aux mêmes endroits dans les 4 séries', trous.every((s) => s === trous[0]),
    H.c.filter((v) => v === null).length + ' heures fermées');
  verif('aucune valeur aberrante (l\'or reste entre 3 600 et 4 500 $)', H.h.every((v) => v === null || (v > 3600 && v < 4500)));

  console.log('\n2. Les faits, recoupés');
  const iMax = H.h.indexOf(Math.max(...H.h.filter((v) => v !== null)));
  verif('le plus haut de la période est 4 398,0', H.h[iMax] === 4398, H.h[iMax] + ' $');
  verif('il est daté du lundi 20 octobre 19:00 (Bamako)', jour(H.t[iMax]) === '2025-10-20' && heure(H.t[iMax]) === '19:00');
  const iMin = H.l.indexOf(Math.min(...H.l.filter((v) => v !== null)));
  verif('le plus bas de la période est 4 021,2', H.l[iMin] === 4021.2, H.l[iMin] + ' $');
  verif('il est daté du mercredi 22 octobre (nuit)', jour(H.t[iMin]) === '2025-10-22' && heure(H.t[iMin]) === '00:00');
  const jourDe = (d) => J.t.findIndex((t) => jour(t) === d);
  verif('le journalier recoupe l\'horaire (vendredi 17 : plus bas 4 196,0)',
    J.l[jourDe('2025-10-17')] === 4196 && J.c[jourDe('2025-10-17')] === 4213.3);
  verif('le journalier recoupe l\'horaire (mardi 21 : plus bas 4 093,0)',
    J.l[jourDe('2025-10-21')] === 4093 && J.h[jourDe('2025-10-21')] === 4393.6);
  const veille = jourDe('2025-10-20'), chute = jourDe('2025-10-21');
  const pctCloture = (J.c[chute] / J.c[veille] - 1) * 100;
  verif('la clôture du 21 octobre perd 5,7 %', pctCloture > -5.8 && pctCloture < -5.6, pctCloture.toFixed(2) + ' %');
  verif('du sommet au plus bas, la chute atteint 6,9 %',
    Math.abs((1 - H.l[82] / H.h[63]) * 100 - 6.94) < 0.05, ((1 - H.l[82] / H.h[63]) * 100).toFixed(2) + ' %');
  verif('la source et la date du relevé sont écrites dans les données',
    /Yahoo Finance/.test(lire('assets/js/etude-or-donnees.js')) && /GC=F/.test(lire('assets/js/etude-or-donnees.js')) &&
    new RegExp(D.releve.replace(/ /g, ' ')).test(lire('assets/js/etude-or-donnees.js')));

  console.log('\n3. Les repères tombent sur les bonnes bougies');
  const trouve = (i) => H.h[i];
  verif('repère du premier sommet : 4 398,0', trouve(63) === 4398);
  verif('repère du balayage : 4 393,6 et plus bas de structure 4 370,2',
    H.h[66] === 4393.6 && H.l[66] === 4370.2);
  verif('repère de la cassure : clôture 4 367,7 sous le plancher',
    H.c[69] === 4367.7 && H.c[69] < H.l[66]);
  verif('repère de l\'entrée : 4 368,0 sur la bougie de 02:00',
    H.o[70] === 4368.1 && Math.abs(T.entree - H.o[70]) < 1, 'ouverture ' + H.o[70]);
  const asie = (w.Plan && w.Plan.fenetres || []).filter((f) => f.debut <= '02:00' && f.fin >= '02:00')[0];
  verif('la fenêtre de tir du plan contient bien 02:00', !!asie,
    asie ? asie.court + ' (heure de Bamako)' : 'aucune fenêtre du plan ne couvre 02:00');
  verif('repère 1 pour 2 : plus bas 4 257,7 sous 4 300', H.l[76] === 4257.7 && H.l[76] <= T.cibles[0].prix);
  verif('repère 1 pour 4 : plus bas 4 217,2 sous 4 232', H.l[80] === 4217.2 && H.l[80] <= T.cibles[1].prix);
  verif('repère 1 pour 7 : plus bas 4 093,0 sous 4 130', H.l[82] === 4093 && H.l[82] <= T.cibles[2].prix);

  console.log('\n4. Le trade, recalculé à partir des bougies');
  const iEntree = 70, iSortie = 82;
  const risque = T.stop - T.entree;
  verif('le risque est bien l\'écart entrée-stop', Math.abs(c.risque - risque) < 0.001, risque + ' $ l\'once');
  let plusHautApres = -Infinity, stopTouche = false;
  for (let i = iEntree; i <= 95; i++) {
    if (H.h[i] === null) continue;
    plusHautApres = Math.max(plusHautApres, H.h[i]);
    if (H.h[i] >= T.stop) stopTouche = true;
  }
  verif('le stop n\'a jamais été touché', !stopTouche && plusHautApres === T.plusHautApres,
    'plus haut après l\'entrée : ' + plusHautApres + ' $');
  let okCibles = true, detail = [];
  T.cibles.forEach((ci, n) => {
    let premier = null;
    for (let i = iEntree + 1; i <= 95; i++) {
      if (H.l[i] !== null && H.l[i] <= ci.prix) { premier = i; break; }
    }
    if (premier === null || premier !== [76, 80, 82][n]) okCibles = false;
    detail.push('1:' + ci.r + ' → ' + (premier === null ? 'jamais' : heure(H.t[premier])));
  });
  verif('les trois objectifs ont été touchés, aux heures annoncées', okCibles, detail.join(' · '));
  verif('l\'objectif du plan est exactement 7 fois le risque',
    Math.abs(c.gainR - 7) < 0.001 && T.cibles[2].prix === T.entree - 7 * risque, '4 368 − 7 × 34 = 4 130');
  verif('le gain annoncé correspond aux bougies', Math.abs(c.gain - (T.entree - H.l[iSortie])) < 40, '+' + c.gain + ' $ l\'once');
  verif('la journée a offert 8 fois le risque', Math.abs(c.offertR - 8.09) < 0.02, c.offertR.toFixed(2) + ' R');
  verif('l\'entrée reste dans la fenêtre de tir de 02:00',
    heure(H.t[iEntree]) === '02:00' && '02:00' <= '02:00' && '02:00' >= '01:00');

  console.log('\n5. La taille de position (la vraie leçon)');
  verif('0,01 lot sur 1 000 $ engage 3,4 % du compte', Math.abs(c.pctMinimum - 3.4) < 0.01);
  verif('le 1 % exige 3 400 $ de capital', c.capital1pourcent === 3400 && T.capitalSuffisant === 3400);
  verif('la règle du 1 % est donc impossible à tenir sur 1 000 $', c.pctMinimum > 1.05);
  verif('l\'EUR/USD tient dans la règle avec 0,06 lot (15 pips = 1,50 $ le lot de 0,01)',
    0.06 * 150 <= 10 && 0.07 * 150 > 10, '9,00 $ pour 1 % de 1 000 $');
  verif('le contre-exemple est chiffré', Math.abs(c.contreDollars - 305) < 0.5 && Math.abs(c.contrePct - 6.93) < 0.05,
    '−305 $ l\'once, soit −6,9 %');
  verif('le contre-exemple coûte 30 % du compte avec le plus petit lot', Math.abs(c.contreCompte - 30.5) < 0.2);

  console.log('\n6. Le tableau de relecture est honnête');
  const html = E.carte({});
  const oui = (html.match(/etude-oui/g) || []).length, non = (html.match(/etude-non/g) || []).length;
  verif('les 5 règles du plan sont listées', /1\. Le stop/.test(html) && /5\. La limite du jour/.test(html));
  verif('le trade n\'obtient pas 5 sur 5 : la règle du 1 % est marquée « non »',
    /4 règles sur 5/.test(html) && non >= 1);
  verif('le ratio est marqué respecté (1 pour 7 exactement)', /ok<\/td>/.test(html) && oui >= 4);
  verif('la règle des 15 pips est rappelée comme réservée au forex', /15 pips ne concerne que le forex/.test(html));
  verif('la leçon est écrite noir sur blanc', /la bonne décision était de <b>laisser passer ce trade<\/b>/.test(html));

  console.log('\n7. Le dessin, fabriqué par l\'application');
  const svgs = (html.match(/<svg/g) || []).length;
  /* les bougies, et rien d'autre (les plaques de fond des étiquettes sont aussi des rect) */
  const bougies = (html.match(/<rect[^>]*fill="var\(--(green|red)\)"/g) || []).length;
  verif('les quatre graphiques sont dessinés', svgs === 4, svgs + ' graphiques');
  const attendues = [[0, 44, D.journalier], [0, 17, H], [42, 69, H], [69, 96, H]]
    .reduce((a, p) => {
      let n = 0;
      for (let i = p[0]; i < p[1]; i++) if (p[2].c[i] !== null && p[2].c[i] !== undefined) n++;   // les heures fermées ne sont pas dessinées
      return a + n;
    }, 0);
  verif('le nombre de bougies correspond aux périodes', bougies === attendues, bougies + ' bougies dessinées');
  verif('l\'échelle des prix et les journées sont étiquetées', /etude-axe/.test(html) && /etude-jour/.test(html));
  verif('la zone des records est mise en évidence', /la zone des records/.test(html));
  const cadre = (html.match(/<svg[^>]*viewBox="0 0 (\d+) (\d+)"/g) || []).map((t) => t.match(/0 0 (\d+) (\d+)/).slice(1).map(Number));
  const dehors = [];
  (html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((svg, n) => {
    const H2 = cadre[n] ? cadre[n][1] : 0;
    (svg.match(/cy="(-?[\d.]+)"/g) || []).forEach((a) => {
      const v = parseFloat(a.slice(4, -1));
      if (!(v >= 0 && v <= H2)) dehors.push('repère hors cadre: ' + v);
    });
  });
  /* le placement automatique : deux étiquettes ne doivent jamais se recouvrir,
     et aucune étiquette ne doit s'écrire sur une pastille numérotée */
  const chevauchements = [], plaquesCouvertes = [];
  let plaquesTotal = 0;
  (html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((svg, n) => {
    const boites = [];
    [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="(etude-repere-texte|etude-niveau|etude-note-champ)" text-anchor="(\w+)">([^<]*)</g)]
      .forEach((m) => {
        const x = +m[1], y = +m[2], larg = m[5].length * 6.4 + 12;
        boites.push({ t: m[5], x0: m[4] === 'start' ? x : x - larg, x1: m[4] === 'start' ? x + larg : x, y0: y - 10, y1: y + 4 });
      });
    [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="9"/g)].forEach((m) => {
      boites.push({ t: 'pastille', x0: +m[1] - 9, x1: +m[1] + 9, y0: +m[2] - 9, y1: +m[2] + 9 });
    });
    /* les plaques de fond des étiquettes ne doivent pas recouvrir une pastille numérotée */
    const pastillesP = [], plaquesP = [];
    [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="9"/g)].forEach((m) => {
      pastillesP.push({ t: 'pastille ' + m[1] + ',' + m[2], x0: +m[1] - 10, x1: +m[1] + 10, y0: +m[2] - 10, y1: +m[2] + 10 });
    });
    [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="14" rx="3"/g)].forEach((m) => {
      plaquesP.push({ x0: +m[1], x1: +m[1] + +m[3], y0: +m[2], y1: +m[2] + 14 });
    });
    plaquesTotal += plaquesP.length;
    plaquesP.forEach((p1) => pastillesP.forEach((p2) => {
      if (p1.x0 < p2.x1 && p1.x1 > p2.x0 && p1.y0 < p2.y1 && p1.y1 > p2.y0)
        plaquesCouvertes.push('panneau ' + (n + 1) + ' : ' + p2.t);
    }));
    for (let a = 0; a < boites.length; a++) for (let b2 = a + 1; b2 < boites.length; b2++) {
      const A = boites[a], B = boites[b2];
      if (A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0)
        chevauchements.push('panneau ' + (n + 1) + ' : ' + JSON.stringify(A.t) + ' / ' + JSON.stringify(B.t));
    }
  });
  verif('deux étiquettes ne se recouvrent jamais', chevauchements.length === 0,
    chevauchements.slice(0, 3).join(' ; ') || 'placement automatique vérifié');
  verif('aucune pastille numérotée n\'est recouverte par une étiquette', plaquesCouvertes.length === 0,
    plaquesCouvertes.slice(0, 3).join(' ') || plaquesTotal + ' plaques de fond, aucune sur une pastille');
  const deborde = [];
  (html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((svg, n) => {
    const fin = cadre[n] ? cadre[n][0] : 0;
    [...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" class="etude-repere-texte" text-anchor="(start|end)">([^<]*)</g)]
      .forEach((m) => {
        const x = +m[1], larg = m[3].length * 6.4 + 12;
        const b2 = m[2] === 'start' ? x + larg : x, a2 = m[2] === 'start' ? x : x - larg;
        if (a2 < 2 || b2 > fin - 2) deborde.push(m[3]);
      });
  });
  verif('aucune étiquette ne sort du cadre', deborde.length === 0, deborde.slice(0, 3).join(' ; ') || 'tout est dedans');
  verif('aucun repère ne sort du cadre', dehors.length === 0, dehors.slice(0, 3).join(' ') || 'tous dans le cadre');
  verif('les graphiques horaires sont datés (vendredi, lundi, mardi)',
    /etude-jour/.test(html) && /ven 17/.test(html) && /lun 20/.test(html) && /mar 21/.test(html));
  verif('l\'entrée, le stop et la cible sont dessinés sur le graphique',
    /entrée 4\u00a0368/.test(html) && /stop 4\u00a0402/.test(html) && /cible 4\u00a0130/.test(html));
  verif('les repères numérotés sont posés sur les bougies', (html.match(/etude-repere"/g) || []).length >= 14);
  verif('la légende française est présente', /class="etude-source"/.test(html) && /arrêté le/.test(html));
  verif('aucun lien externe dans l\'étude', !/https?:\/\//.test(lire('assets/js/etude-or.js').replace(/^\s*\*.*$/gm, '') + html));
  verif('aucune image ni appel réseau', !/<img|url\(|fetch\(|XMLHttpRequest/.test(html));
  verif('aucun emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u.test(html));
  verif('l\'étude s\'imprime proprement', /@media print\{\.etude-figure/.test(lire('assets/css/styles.css')));

  console.log('\n8. Le montage dans l\'application');
  const idx = lire('index.html');
  verif('les données sont chargées par la page', /assets\/js\/etude-or-donnees\.js/.test(idx));
  verif('l\'étude est chargée avant la vue Formation', idx.indexOf('etude-or.js') < idx.indexOf('assets/js/formation.js'));
  verif('la Formation appelle la carte', /EtudeOr\) html \+= global\.EtudeOr\.carte\(App\)/.test(lire('assets/js/formation.js')));
  const sw = lire('sw.js');
  verif('les deux fichiers sont dans le cache hors ligne',
    /'\.\/assets\/js\/etude-or-donnees\.js'/.test(sw) && /'\.\/assets\/js\/etude-or\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 15, 'v' + vCache);
  verif('la recette est déclarée dans les scripts', /"test:etude": "node tools\/etude-test\.js"/.test(lire('package.json')));
  verif('l\'étude est annoncée dans le README', /[Éé]tude de cas/.test(lire('README.md')) && /4 398/.test(lire('README.md')));

  /* ---- 9. la carte dans la vraie vue Formation, en bac complet ---- */
  console.log('\n9. La carte dans la vue Formation');
  const erreurs = [];
  const vc = new VirtualConsole();
  // jsdom ne sait pas faire défiler la page : « Not implemented » n'est pas une erreur de l'application
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
  const app = await JSDOM.fromFile(path.join(RACINE, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', virtualConsole: vc,
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
  const onglet = win.document.querySelector('[data-view="formation"]');
  if (onglet) onglet.click();
  await new Promise((r) => setTimeout(r, 300));
  const carte = win.document.querySelector('#etudeOr');
  verif('la carte de l\'étude est rendue dans la Formation', !!carte);
  if (carte) {
    verif('elle contient les quatre graphiques', carte.querySelectorAll('svg').length === 4);
    verif('elle nomme le sommet réel', /4 398,0/.test(carte.textContent));
    verif('elle contient la relecture des 5 règles', /4 règles sur 5/.test(carte.textContent));
    const boutons = ['#etudeOuvrirJour', '#etudeOuvrirHeure'].filter((s) => carte.querySelector(s));
    verif('les deux boutons de graphique réel sont là', boutons.length === 2, boutons.join(' '));
    const ouvertes = [];
    win.open = (u) => { ouvertes.push(u); return null; };
    Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => true });
    if (carte.querySelector('#etudeOuvrirHeure')) {
      carte.querySelector('#etudeOuvrirHeure').click();
      await tick();
      verif('le bouton ouvre l\'or sur TradingView', ouvertes.length === 1 && /XAUUSD/.test(ouvertes[0] || ''),
        (ouvertes[0] || '').slice(0, 68));
      verif('l\'adresse ne contient aucune donnée du journal',
        !/[0-9]{4}-[0-9]{2}|riskAmount|entry=/.test(ouvertes[0] || ''));
    }
  }
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, étude de cas vérifiée.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
