/* =========================================================
   etude-ltf-test.js — recette de l'exemple en basse unité de temps
   (« j'attends la prise de liquidité, puis le ChoCh »)

   Vérifie, sans réseau et sans navigateur :
   - l'intégrité des 15 minutes encodées : 96 créneaux de 15 minutes qui
     se suivent, chaque bougie cohérente (plus haut ≥ ouverture et
     clôture, plus bas ≤ les deux), les quatre trous de cotation au même
     endroit dans les cinq séries ;
   - les faits de la séance : plus haut 4 396,8 à 02:30, plus bas 4 293,0
     à 13:00 dans la fenêtre USA, 103,8 points d'amplitude ;
   - les deux séquences relues bougie par bougie, sans passer par la
     carte : le balayage dépasse bien le niveau attendu, la bougie
     revient de l'autre côté, le ChoCh est la PREMIÈRE clôture qui casse
     l'extrême formé depuis le balayage, l'entrée est cette clôture, le
     stop est l'extrême balayé, il n'est jamais touché avant la sortie ;
   - l'arithmétique : risque, gain, multiple, et le fait que la séquence
     de 13:00 reste dans la fenêtre de tir USA ;
   - les refus du plan : 2,07 % du capital pour le premier stop, 1,68 %
     pour le second, un 1:7 impossible dans les deux cas alors que la
     check-list les compte (4 règles sur 6, 3 règles sur 6) ;
   - le dessin : cinq figures fabriquées en SVG, les bougies attendues,
     les repères numérotés, aucune étiquette vide, aucune qui se
     chevauche, aucune qui sorte du cadre ;
   - le montage : page, cache hors ligne, vue Formation, scripts, README.

   Usage : node tools/etude-ltf-test.js
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
const plat = (s) => String(s).replace(/\u00a0/g, ' ');
/* « 4 293,0 » : les prix s'écrivent en français, virgule et espace fine */
const fr = (v, d) => plat(Number(v).toFixed(d === undefined ? 1 : d).replace('.', ',')
  .replace(/\B(?=(\d{3})+(?!\d))/g, ' '));

/* ---- bac isolé : données, étude de cas (dessinateur) et exemple LTF ---- */
function bac() {
  const dom = new JSDOM('<!doctype html><html><body><div id="h"></div></body></html>',
    { url: 'https://x.test/', runScripts: 'dangerously' });
  const w = dom.window;
  ['store.js', 'plan.js', 'etude-or-donnees.js', 'etude-or.js', 'etude-ltf-donnees.js', 'etude-ltf.js']
    .forEach((f) => {
      const sc = w.document.createElement('script');
      sc.textContent = lire('assets/js/' + f);
      w.document.head.appendChild(sc);
    });
  return w;
}

const heure = (t) => new Date(t * 1000).toISOString().slice(11, 16);

/* ---------------------------------------------------------
   La lecture indépendante d'une séquence : on ne relit que les bougies
   --------------------------------------------------------- */
function relire(D, spec) {
  const S = D.serie, achat = spec.sens === 'achat';
  const i = spec.iBalayage, j = spec.iChoc, f = spec.iSuite;
  const avant = [];
  for (let k = i - 12; k < i; k++) avant.push(achat ? S.l[k] : S.h[k]);
  const niveau = achat ? Math.min.apply(null, avant) : Math.max.apply(null, avant);
  const extreme = achat ? S.l[i] : S.h[i];

  /* le niveau cassé : l'extrême formé depuis le balayage */
  let casse = null;
  for (let k = i; k < j; k++) {
    const v = achat ? S.h[k] : S.l[k];
    if (casse === null || (achat ? v > casse : v < casse)) casse = v;
  }
  /* la première clôture qui casse vraiment ce niveau, en avançant bougie par bougie */
  let premier = null, courant = achat ? S.h[i] : S.l[i];
  for (let k = i + 1; k < S.c.length; k++) {
    if (S.c[k] === null) continue;
    if (achat ? S.c[k] > courant : S.c[k] < courant) { premier = k; break; }
    courant = achat ? Math.max(courant, S.h[k]) : Math.min(courant, S.l[k]);
  }
  const entree = S.c[j], stop = extreme;
  const chemin = [];
  for (let k = j + 1; k <= f; k++) chemin.push(achat ? S.l[k] : S.h[k]);
  const fenetre = [];
  for (let k = j + 1; k <= j + 16 && k < S.h.length; k++) fenetre.push(achat ? S.h[k] : S.l[k]);
  const sortie = achat ? S.h[f] : S.l[f];
  return {
    achat: achat, i: i, j: j, f: f,
    heureBalayage: heure(S.t[i]), heureChoc: heure(S.t[j]), heureSuite: heure(S.t[f]),
    niveau: niveau, extreme: extreme, retour: achat ? S.c[i] > niveau : S.c[i] < niveau,
    depassement: Math.abs(extreme - niveau), casse: casse, premier: premier,
    clotureChoc: S.c[j], entree: entree, stop: stop, risque: Math.abs(entree - stop),
    stopTouche: achat ? Math.min.apply(null, chemin) <= stop : Math.max.apply(null, chemin) >= stop,
    plusLoin: achat ? Math.min.apply(null, chemin) : Math.max.apply(null, chemin),
    sortie: sortie, sortieMax: achat ? Math.max.apply(null, fenetre) : Math.min.apply(null, fenetre),
    gain: Math.abs(sortie - entree), multiple: Math.abs(sortie - entree) / Math.abs(entree - stop)
  };
}

(async () => {
  const w = bac();
  const D = w.EtudeLtfDonnees, E = w.EtudeLtf, EO = w.EtudeOr;
  const S = D.serie, C = w.EtudeLtf.SEQUENCES;
  const S1 = C[0], S2 = C[1];

  console.log('\n1. Les quinze minutes encodées');
  verif('les cinq séries sont là', ['t', 'o', 'h', 'l', 'c'].every((k) => Array.isArray(S[k])));
  const n = S.t.length;
  verif('96 créneaux de 15 minutes', n === 96, n + ' créneaux');
  verif('les cinq séries ont la même longueur',
    ['o', 'h', 'l', 'c'].every((k) => S[k].length === n));
  let pas = true;
  for (let k = 1; k < n; k++) if (S.t[k] - S.t[k - 1] !== 900) pas = false;
  verif('les créneaux se suivent de 15 en 15 minutes', pas);
  const jour = new Date(S.t[0] * 1000).toISOString().slice(0, 10);
  verif('la séance encodée est le lundi 14 septembre 2026', jour === '2026-09-14' && new Date(S.t[0] * 1000).getUTCDay() === 1, jour);
  verif('elle va de 00:00 à 23:45', heure(S.t[0]) === '00:00' && heure(S.t[n - 1]) === '23:45',
    heure(S.t[0]) + ' → ' + heure(S.t[n - 1]));
  const incoherentes = [];
  for (let k = 0; k < n; k++) {
    if (S.c[k] === null) continue;
    if (!(S.h[k] >= Math.max(S.o[k], S.c[k]) - 1e-6 && S.l[k] <= Math.min(S.o[k], S.c[k]) + 1e-6)) incoherentes.push(heure(S.t[k]));
  }
  verif('chaque bougie est cohérente (plus haut ≥ corps, plus bas ≤ corps)', incoherentes.length === 0,
    incoherentes.slice(0, 3).join(' ') || 'aucune anomalie');
  const vides = S.c.map((v, k) => (v === null ? heure(S.t[k]) : null)).filter(Boolean);
  verif('les quatre créneaux vides sont ceux de 21:00 à 21:45',
    vides.length === 4 && vides.join(' ') === '21:00 21:15 21:30 21:45', vides.join(' '));
  verif('les créneaux vides le sont dans les cinq séries',
    [S.o, S.h, S.l, S.c].every((serie) => serie.filter((v) => v === null).length === 4));
  const cotees = S.c.filter((v) => v !== null).length;
  verif('92 bougies cotées', cotees === 92, cotees + ' bougies');
  verif('la clôture de la veille est celle du relevé', D.cloturePrecedente === 4332.8,
    fr(D.cloturePrecedente));
  const donnees = lire('assets/js/etude-ltf-donnees.js');
  verif('la source est citée dans le fichier de données',
    /Yahoo Finance/.test(donnees) && /GC=F/.test(donnees) && /16 septembre 2026/.test(donnees));
  verif('l\'unité de temps et l\'instrument sont annoncés',
    D.unite === '15 minutes' && D.instrument === 'XAUUSD' && /^Or /.test(D.nom));

  console.log('\n2. Les faits de la séance');
  const hauts = [], bas = [];
  for (let k = 0; k < n; k++) if (S.c[k] !== null) { hauts.push(S.h[k]); bas.push(S.l[k]); }
  const haut = Math.max.apply(null, hauts), min = Math.min.apply(null, bas);
  verif('le plus haut de la séance est 4 396,8', haut === 4396.8, fr(haut));
  verif('il est fait à 02:30', heure(S.t[S.h.indexOf(haut)]) === '02:30', heure(S.t[S.h.indexOf(haut)]));
  verif('le plus bas de la séance est 4 293,0', min === 4293, fr(min));
  verif('il est fait à 13:00', heure(S.t[S.l.indexOf(min)]) === '13:00', heure(S.t[S.l.indexOf(min)]));
  verif('l\'amplitude de la séance est 103,8 points', Math.abs((haut - min) - 103.8) < 0.05, fr(haut - min));
  const iBas = S.l.indexOf(min), hBas = heure(S.t[iBas]);
  verif('ce plus bas tombe dans la fenêtre de tir USA (13h–14h)', hBas >= '13:00' && hBas <= '14:00', hBas);
  const b13 = { o: S.o[52], h: S.h[52], l: S.l[52], c: S.c[52] };
  verif('la bougie de 13:00 est celle du relevé',
    b13.o === 4311.2 && b13.h === 4312.9 && b13.l === 4293 && b13.c === 4306.1,
    b13.o + ' / ' + b13.h + ' / ' + b13.l + ' / ' + b13.c);
  const b6 = { o: S.o[24], h: S.h[24], c: S.c[24] };
  verif('la bougie de 06:00 est celle du relevé',
    b6.o === 4377.9 && b6.h === 4379.3 && b6.c === 4370.5, b6.o + ' / ' + b6.h + ' / ' + b6.c);
  verif('la séance se termine au-dessus du plus bas (reprise)', S.c[95] === null || S.c[95] > min);

  console.log('\n3. Les fenêtres de tir du plan');
  verif('trois fenêtres sont déclarées', E.FENETRES.length === 3);
  const plan = w.Plan.fenetres;
  verif('ce sont exactement celles du plan',
    plan.length === 3 && plan.every((f, k) => f.id === E.FENETRES[k].id && f.debut === E.FENETRES[k].debut && f.fin === E.FENETRES[k].fin),
    E.FENETRES.map((f) => f.nom + ' ' + f.debut + '–' + f.fin).join(' · '));
  verif('les horaires du plan sont bien 01:00, 08:00 et 13:00',
    E.FENETRES.map((f) => f.debut).join(' ') === '01:00 08:00 13:00');
  verif('les bandes du premier graphique couvrent ces fenêtres',
    heure(S.t[4]) === '01:00' && heure(S.t[8]) === '02:00' && heure(S.t[32]) === '08:00' &&
    heure(S.t[36]) === '09:00' && heure(S.t[52]) === '13:00' && heure(S.t[56]) === '14:00');

  console.log('\n4. Séquence 1 — la prise de liquidité de 13:00, puis le ChoCh');
  const r1 = relire(D, S1), m1 = E.mesures(S1);
  verif('le balayage part de la bougie de 13:00', r1.heureBalayage === '13:00' && r1.i === 52);
  verif('la mèche passe sous le plus bas des douze bougies précédentes',
    4293 < r1.niveau && r1.niveau === 4305.7, 'niveau ' + fr(r1.niveau));
  verif('elle le dépasse de 12,7 points', Math.abs(r1.depassement - 12.7) < 0.01, fr(r1.depassement));
  verif('la bougie de balayage revient au-dessus du niveau', r1.retour && r1.extreme === 4293);
  verif('le ChoCh est la première clôture qui casse l\'extrême formé depuis le balayage',
    r1.premier === r1.j, 'bougie ' + r1.premier + ' (' + r1.heureChoc + ')');
  verif('le niveau cassé est le sommet laissé par la bougie de balayage', r1.casse === 4312.9, fr(r1.casse));
  verif('la clôture du ChoCh est 4 313,7', r1.clotureChoc === 4313.7, fr(r1.clotureChoc));
  verif('l\'entrée est cette clôture', r1.entree === r1.clotureChoc && r1.entree === m1.entree);
  verif('le stop est l\'extrême balayé, 4 293,0', r1.stop === 4293 && r1.stop === m1.stop, fr(r1.stop));
  verif('le risque est de 20,7 points', Math.abs(r1.risque - 20.7) < 0.01, fr(r1.risque));
  verif('le stop n\'est jamais touché avant la sortie', r1.stopTouche === false, 'plus bas du chemin ' + fr(r1.plusLoin));
  verif('la sortie est le plus haut des seize bougies suivantes',
    r1.sortie === r1.sortieMax && r1.sortie === 4358.9, fr(r1.sortie) + ' à ' + r1.heureSuite);
  verif('la sortie dépasse le sommet d\'avant la chute (4 337,7)', r1.sortie > 4337.7 && m1.avantBalayage === 4337.7,
    fr(m1.avantBalayage));
  verif('le gain est de 45,2 points', Math.abs(r1.gain - 45.2) < 0.01, fr(r1.gain));
  verif('la séquence a rapporté 2,2 fois le risque', Math.abs(r1.multiple - m1.multiple) < 1e-9 && fr(m1.multiple) === '2,2');
  verif('la carte annonce ces mêmes chiffres',
    r1.entree === m1.entree && r1.stop === m1.stop && r1.sortie === m1.sortie && Math.abs(r1.risque - m1.risque) < 1e-9);

  console.log('\n5. Séquence 2 — la même mécanique, à la vente (06:00 puis 06:45)');
  const r2 = relire(D, S2), m2 = E.mesures(S2);
  verif('le balayage part de la bougie de 06:00', r2.heureBalayage === '06:00' && r2.i === 24);
  verif('la mèche passe au-dessus du plus haut des douze bougies précédentes',
    4379.3 > r2.niveau && r2.niveau === 4378.1, 'niveau ' + fr(r2.niveau));
  verif('elle ne le dépasse que de 1,2 point', Math.abs(r2.depassement - 1.2) < 0.01, fr(r2.depassement));
  verif('la bougie de balayage revient sous le niveau', r2.retour && r2.extreme === 4379.3);
  verif('les sommets suivants sont plus bas (4 373,0 puis 4 372,9)',
    S.h[25] === 4373 && S.h[26] === 4372.9, S.h[25] + ' puis ' + S.h[26]);
  verif('le ChoCh est la première clôture qui casse le dernier plus bas',
    r2.premier === r2.j && r2.casse === 4365.7, 'bougie ' + r2.premier + ' (' + r2.heureChoc + ')');
  verif('la clôture du ChoCh est 4 362,5', r2.clotureChoc === 4362.5, fr(r2.clotureChoc));
  verif('l\'entrée est cette clôture', r2.entree === r2.clotureChoc);
  verif('le stop est l\'extrême balayé, 4 379,3', r2.stop === 4379.3, fr(r2.stop));
  verif('le risque est de 16,8 points', Math.abs(r2.risque - 16.8) < 0.01, fr(r2.risque));
  verif('le stop n\'est jamais touché avant la sortie', r2.stopTouche === false, 'plus haut du chemin ' + fr(r2.plusLoin));
  verif('la sortie est le plus bas des seize bougies suivantes',
    r2.sortie === r2.sortieMax && r2.sortie === 4317.3, fr(r2.sortie) + ' à ' + r2.heureSuite);
  verif('le gain est de 45,2 points', Math.abs(r2.gain - 45.2) < 0.01, fr(r2.gain));
  verif('la séquence a rapporté 2,7 fois le risque', fr(m2.multiple) === '2,7', fr(m2.multiple));
  verif('la baisse continue ensuite jusqu\'au plus bas de la séance',
    r2.sortie > 4293 && r2.heureSuite < '13:00');
  verif('la carte annonce ces mêmes chiffres',
    r2.entree === m2.entree && r2.stop === m2.stop && r2.sortie === m2.sortie && Math.abs(r2.risque - m2.risque) < 1e-9);

  console.log('\n6. Ce que le plan accepte, ce qu\'il refuse');
  const se = E.seance();
  verif('la séance est mesurée à 103,8 points', fr(se.amplitude) === '103,8');
  verif('les 92 bougies cotées sont comptées', se.bougies === 92 && se.creneaux === 96);
  verif('la première séquence tombe dans la fenêtre USA', m1.fenetre === 'USA' && m1.heureChoc === '13:15');
  verif('la seconde ne tombe dans aucune fenêtre', m2.fenetre === null && m2.heureChoc === '06:45');
  verif('le premier stop coûte 20,70 $ sur un compte de 1 000 $ en 0,01 lot',
    Math.abs(m1.coutStop - 20.7) < 0.01 && fr(m1.coutStop) === '20,7');
  verif('soit 2,07 % du capital, au-delà de la règle du 1 %', fr(m1.partCapital, 2) === '2,07');
  verif('il faudrait un compte de 2 070 $ pour que ce stop tienne dans 1 %', Math.abs(m1.capitalMinimum - 2070) < 0.01,
    fr(m1.capitalMinimum, 0) + ' $');
  verif('un rapport 1:7 demanderait 145 points, plus que la séance entière (103,8)',
    Math.round(m1.objectifUnSept) === 145 && m1.objectifUnSept > se.amplitude);
  verif('le second stop coûte 16,80 $, soit 1,68 % du capital', fr(m2.partCapital, 2) === '1,68');
  verif('il faudrait 1 680 $ pour tenir dans 1 %', Math.abs(m2.capitalMinimum - 1680) < 0.01, fr(m2.capitalMinimum, 0) + ' $');
  verif('un rapport 1:7 demanderait 118 points, plus que la baisse entière (86,3)',
    Math.round(m2.objectifUnSept) === 118 && Math.abs((m2.stop - 4293) - 86.3) < 0.01,
    fr(m2.stop - 4293) + ' points de baisse');

  console.log('\n7. Le dessin');
  const html = E.carte(null), texte = plat(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];
  verif('cinq figures sont dessinées', svgs.length === 5, svgs.length + ' graphiques');
  const bougies = svgs.map((s) => (s.match(/<rect[^>]*fill="var\(--(?:green|red)\)"/g) || []).length);
  verif('la première montre les 92 bougies cotées de la séance', bougies[0] === 92, bougies[0] + ' bougies');
  verif('la deuxième montre les dix bougies du balayage (12:15 → 14:30)', bougies[1] === 10);
  verif('la troisième montre la suite jusqu\'à la sortie (20 bougies)', bougies[2] === 20);
  verif('la quatrième montre les huit bougies du balayage de 06:00', bougies[3] === 8);
  verif('la cinquième montre la baisse jusqu\'à 09:45 (26 bougies)', bougies[4] === 26);
  const reperes = svgs.map((s) => (s.match(/class="etude-repere"/g) || []).length);
  verif('les repères numérotés sont posés (3, 2, 1, 2, 1)', reperes.join(',') === '3,2,1,2,1', reperes.join(','));
  verif('les trois fenêtres de tir sont dessinées et nommées',
    /Asie/.test(svgs[0]) && /Europe/.test(svgs[0]) && /USA/.test(svgs[0]) &&
    (svgs[0].match(/<rect[^>]*rgba\(99,176,255,\.07\)/g) || []).length === 3);
  verif('l\'entrée, le stop et la sortie sont dessinés sur la suite de la séquence 1',
    /entrée 4 313,7/.test(plat(svgs[2])) && /stop 4 293/.test(plat(svgs[2])) && /sortie 4 358,9/.test(plat(svgs[2])));
  verif('la séquence 2 dessine son risque et sa sortie',
    /entrée 4 362,5/.test(plat(svgs[4])) && /stop 4 379,3/.test(plat(svgs[4])) && /sortie 4 317,3/.test(plat(svgs[4])));
  verif('aucune étiquette n\'est restée vide',
    !/class="etude-(?:niveau|repere-texte|note-champ)"[^>]*><\/text>/.test(html));
  const chevauchent = [], cadre = [];
  svgs.forEach((svg, k) => {
    const boites = [];
    const large = (t) => t.length * 6.4 + 12;
    [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="etude-(niveau|repere-texte|note-champ)" text-anchor="(start|end)"[^>]*>([^<]*)</g)]
      .forEach((mm) => {
        const x = +mm[1], y = +mm[2], t = mm[5], l = large(t);
        boites.push({ t: t, x0: mm[4] === 'start' ? x : x - l, x1: mm[4] === 'start' ? x + l : x, y0: y - 10, y1: y + 3 });
      });
    for (let a = 0; a < boites.length; a++) for (let b = a + 1; b < boites.length; b++) {
      const A = boites[a], B = boites[b];
      if (A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0)
        chevauchent.push('figure ' + (k + 1) + ' : ' + A.t + ' / ' + B.t);
    }
    const vb = (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []);
    boites.forEach((b) => { if (b.x0 < 2 || b.x1 > +vb[1] - 2 || b.y1 > +vb[2] - 2) cadre.push('figure ' + (k + 1) + ' : ' + b.t); });
  });
  verif('deux étiquettes ne se recouvrent jamais', chevauchent.length === 0,
    chevauchent.slice(0, 3).join(' ; ') || 'placement automatique vérifié');
  verif('aucune étiquette ne sort du cadre', cadre.length === 0, cadre.slice(0, 3).join(' ; ') || 'tout est dedans');
  const ecrasees = [];
  svgs.forEach((svg, k) => {
    const pastilles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="9"/g)]
      .map((m) => ({ x0: +m[1] - 10, x1: +m[1] + 10, y0: +m[2] - 10, y1: +m[2] + 10 }));
    [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="etude-(?:niveau|repere-texte|note-champ)" text-anchor="(start|end)"[^>]*>([^<]*)</g)]
      .forEach((m) => {
        const x = +m[1], y = +m[2], l = m[4].length * 6.4 + 12;
        const b = { x0: m[3] === 'start' ? x : x - l, x1: m[3] === 'start' ? x + l : x, y0: y - 10, y1: y + 3 };
        pastilles.forEach((p) => {
          if (p.x0 < b.x1 && p.x1 > b.x0 && p.y0 < b.y1 && p.y1 > b.y0) ecrasees.push('figure ' + (k + 1) + ' : ' + m[4]);
        });
      });
  });
  verif('aucune pastille numérotée ne recouvre une étiquette', ecrasees.length === 0,
    ecrasees.slice(0, 3).join(' ; ') || 'les pastilles réservent leur place avant les textes');
  verif('les prix sont écrits en français (virgule, jamais de point)',
    !/<text[^>]*class="etude-(?:niveau|axe|repere-texte)"[^>]*>[\d ]*\.[\d]*</.test(html));
  verif('aucun lien externe dans l\'exemple',
    !/https?:\/\//.test(lire('assets/js/etude-ltf.js').replace(/^\s*\/\*[\s\S]*?\*\//gm, '') + html));
  verif('aucune image ni appel réseau', !/<img|url\(|fetch\(|XMLHttpRequest/.test(html));
  verif('aucun emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u.test(html));
  verif('la zone imprimable connaît les figures', /@media print\{\.etude-figure/.test(lire('assets/css/styles.css')));

  console.log('\n8. Ce que la carte raconte');
  verif('elle cite la phrase de la routine', /prise de liquidité/.test(texte) && /ChoCh/.test(texte));
  verif('elle donne le plus haut et le plus bas de la séance', texte.indexOf('4 396,8') > -1 && texte.indexOf('4 293,0') > -1);
  verif('elle explique les quatre temps', /La liquidité est prise/.test(texte) && /Le ChoCh est confirmé/.test(texte) &&
    /L\'entrée et le stop/.test(texte));
  verif('le carnet de la séquence 1 est daté et chiffré',
    /lundi 14 septembre, 13:00/.test(texte) && texte.indexOf('4 313,7') > -1 && texte.indexOf('20,7') > -1);
  verif('le carnet de la séquence 2 est daté et chiffré',
    /lundi 14 septembre, 06:00/.test(texte) && texte.indexOf('4 362,5') > -1 && texte.indexOf('16,8') > -1);
  verif('les deux verdicts comptent les règles tenues',
    /4 règles sur 6/.test(texte) && /3 règles sur 6/.test(texte));
  verif('la check-list porte six règles par séquence',
    (html.match(/Règle du plan/g) || []).length === 2 &&
    (html.match(/etude-oui/g) || []).length === 7 && (html.match(/etude-non/g) || []).length === 5,
    (html.match(/etude-oui/g) || []).length + ' ok / ' + (html.match(/etude-non/g) || []).length + ' non');
  verif('le refus est écrit noir sur blanc (stop trop large, 1:7 impossible)',
    texte.indexOf('2 070') > -1 && texte.indexOf('1 680') > -1 && texte.indexOf('145') > -1 && texte.indexOf('118') > -1);
  verif('la séquence acceptée du 21 octobre 2025 est rappelée',
    /21 octobre 2025/.test(texte) && texte.indexOf('4 402') > -1 && texte.indexOf('4 130') > -1);
  verif('la source des cours est citée sur la carte',
    /Yahoo Finance/.test(texte) && /COMEX GC=F/.test(texte) && /GC=F/.test(texte));
  verif('elle est reliée à l\'étude de cas', /étude de cas/i.test(texte));

  console.log('\n9. Le montage dans l\'application');
  const idx = lire('index.html');
  verif('les données sont chargées par la page', /assets\/js\/etude-ltf-donnees\.js/.test(idx));
  verif('l\'exemple est chargé avant la vue Formation',
    idx.indexOf('etude-ltf.js') < idx.indexOf('assets/js/formation.js'));
  verif('il est chargé après le dessinateur de l\'étude de cas',
    idx.indexOf('assets/js/etude-or.js') < idx.indexOf('assets/js/etude-ltf.js'));
  verif('la Formation appelle la carte', /EtudeLtf\) html \+= global\.EtudeLtf\.carte\(App\)/.test(lire('assets/js/formation.js')));
  verif('la Formation câble le bouton de graphique', /EtudeLtf && global\.EtudeLtf\.cabler/.test(lire('assets/js/formation.js')));
  const sw = lire('sw.js');
  verif('les deux fichiers sont dans le cache hors ligne',
    /'\.\/assets\/js\/etude-ltf-donnees\.js'/.test(sw) && /'\.\/assets\/js\/etude-ltf\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 17, 'v' + vCache);
  verif('la recette est déclarée dans les scripts',
    /"test:ltf": "node tools\/etude-ltf-test\.js"/.test(lire('package.json')) &&
    /npm run test:routine && npm run test:ltf/.test(lire('package.json')));
  /* la version doit être au moins celle du chantier : les suivantes passent aussi */
  const vApp = (lire('package.json').match(/"version": "(\d+)\.(\d+)\.(\d+)"/) || []).slice(1, 4).map(Number);
  verif('la version de l\'application est relevée',
    vApp[0] === 3 && vApp[1] >= 1, vApp.length === 3 ? 'v' + vApp.join('.') : 'absente');
  verif('le pied de page annonce la version', /v3\.[1-9]/.test(idx));
  const rd = lire('README.md');
  verif('le README annonce l\'exemple en basse unité de temps',
    /15 minutes/.test(rd) && /ChoCh/.test(rd) && /prise de liquidité/.test(rd));
  verif('le README donne la commande de la recette', /node tools\/etude-ltf-test\.js/.test(rd));

  console.log('\n10. La carte dans la vraie vue Formation');
  const erreurs = [];
  const vc = new VirtualConsole();
  /* jsdom ne sait pas faire défiler la page : « Not implemented » n'est pas une erreur de l'application */
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
  const onglet = win.document.querySelector('[data-view="formation"]');
  if (onglet) onglet.click();
  await new Promise((r) => setTimeout(r, 300));
  const carte = win.document.querySelector('#etudeLtf');
  verif('la carte de l\'exemple est rendue dans la Formation', !!carte);
  if (carte) {
    verif('elle contient les cinq graphiques', carte.querySelectorAll('svg').length === 5);
    verif('elle se place après l\'étude de cas',
      carte.previousElementSibling === win.document.querySelector('#etudeOr') || !!win.document.querySelector('#etudeOr'));
    verif('aucune donnée du journal n\'y apparaît', !/riskAmount|journal-trading|entry=/.test(carte.innerHTML));
    const ouvertes = [];
    win.open = (u) => { ouvertes.push(u); return null; };
    const bouton = carte.querySelector('#ltfOuvrirQuinze');
    verif('le bouton de graphique réel est là', !!bouton);
    if (bouton) {
      Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => true });
      bouton.click();
      await tick();
      verif('il ouvre l\'or en 15 minutes sur TradingView',
        ouvertes.length === 1 && /XAUUSD/.test(ouvertes[0] || '') && /interval=15/.test(ouvertes[0] || ''),
        (ouvertes[0] || '').slice(0, 70));
      Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => false });
      bouton.click();
      await tick();
      verif('hors ligne, il n\'ouvre rien (le journal continue de marcher)', ouvertes.length === 1);
      Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => true });
    }
  }
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, exemple en basse unité de temps vérifié.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
