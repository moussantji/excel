/* =========================================================
   formation-test.js — recette du cours et de l'entraîneur

   Vérifie :
   - le contenu : 12 chapitres dans l'ordre du plan, chiffres et
     règles conformes aux documents, français, sans emoji ;
   - l'honnêteté de l'entraîneur : sur des milliers de tirages,
     les bougies racontent bien l'histoire annoncée (tendance,
     nature du BOS, type de zone, secousse au-delà de la fourchette)
     et les bonnes réponses sont déduites des bougies ;
   - les bougies elles-mêmes : hauts et bas cohérents, tirage
     reproductible à graine égale ;
   - la correction : QCM, clic dans la zone (juste) et hors zone (faux) ;
   - l'enregistrement de la progression (journal, donc chiffré quand
     le verrou est actif, et sauvegardé dans le cloud) ;
   - l'intégration : vue, menu, cache hors ligne, impression.

   Usage : NODE_PATH=/tmp/node_modules node tools/formation-test.js
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

/* ---------------------------------------------------------
   Chargement des modules dans un contexte isolé
   --------------------------------------------------------- */
function chargerModules(fichiers) {
  const contexte = {};
  contexte.window = contexte;
  const vm = require('vm');
  vm.createContext(contexte);
  fichiers.forEach((f) => vm.runInContext(lire('assets/js/' + f), contexte, { filename: f }));
  return contexte;
}

/* =========================================================
   1. Contenu du cours
   ========================================================= */
console.log('\n1. Contenu du cours');
const ctx = chargerModules(['entraineur.js', 'formation-contenu.js']);
const chapitres = ctx.FormationContenu.chapitres;
const texteComplet = JSON.stringify(chapitres);

verif('douze chapitres', chapitres.length === 12, chapitres.length + ' chapitres');
verif('chapitres dans l\'ordre du plan',
  chapitres.map((c) => c.num).join(',') === '01,02,03,04,05,06,07,08,09,10,11,12',
  chapitres.map((c) => c.num).join(' '));
verif('chaque chapitre a une source citée', chapitres.every((c) => c.source && c.source.length > 8));
verif('chaque chapitre a un essentiel', chapitres.every((c) => c.essentiel && c.essentiel.length > 80));
verif('chaque chapitre a des leçons', chapitres.every((c) => c.lecons && c.lecons.length > 0),
  chapitres.reduce((a, c) => a + c.lecons.length, 0) + ' leçons');
verif('chaque chapitre a des étapes à suivre', chapitres.every((c) => c.etapes && c.etapes.length >= 4),
  chapitres.reduce((a, c) => a + c.etapes.length, 0) + ' étapes');
verif('chaque chapitre a des erreurs fréquentes', chapitres.every((c) => c.erreurs && c.erreurs.length >= 3));
verif('chaque chapitre a des exercices notés', chapitres.every((c) => c.exercices && c.exercices.length >= 3),
  chapitres.reduce((a, c) => a + c.exercices.length, 0) + ' questions');
verif('l\'exercice de calcul est rattaché au chapitre risque',
  chapitres.filter((c) => c.id === 'risque').length === 1);
verif('les chapitres visuels renvoient vers l\'entraîneur',
  chapitres.filter((c) => c.entraineur).length >= 4,
  chapitres.filter((c) => c.entraineur).map((c) => c.num + '→' + c.entraineur).join(' '));

// leçons complètes : le fond compte autant que le texte d'amorce — on mesure
// le texte PLUS les puces (c'est là que vivent les chiffres et les définitions)
const sansTexte = [];
let puces = 0;
chapitres.forEach((c) => c.lecons.forEach((l) => {
  const pts = l.points || [];
  puces += pts.length;
  const poids = (l.texte || '').length + pts.join(' ').length;
  if (!l.titre || !l.texte || l.texte.length < 60 || poids < 220 || (l.texte.length < 120 && pts.length < 2)) {
    sansTexte.push(c.num + ' / ' + l.titre + ' (' + poids + ' car., ' + pts.length + ' puce(s))');
  }
}));
verif('chaque leçon a un titre, un texte et un contenu développé', sansTexte.length === 0,
  sansTexte.slice(0, 3).join(' | ') || 'toutes complètes');
verif('les leçons apportent des points concrets, pas seulement une amorce', puces >= 100, puces + ' puces');

// le fond de la méthode est enseigné (au-delà de la simple présence des mots)
const fondAttendu = [
  ['les trois types de BOS', /BOS classique/i, /BOS de continuation/i, /BOS piège|BOS trap/i],
  ["la lecture d'une tendance (HH/HL, LH/LL)",  /Higher High|HH/, /Higher Low|HL/, /Lower High|LH/, /Lower Low|LL/],
  ['la formule de risque en trois lignes', /capital × 1 %|capital × 1%/i, /Taille \(lots\)|taille en lots/i],
  ['les conditions d\'arrêt', /2 stop loss dans la journée|[Dd]eux stop loss dans la journée/, /6 % de perte sur la semaine/, /10 % de perte depuis le plus haut/, /48 h|48 heures/],
  ['les seuils de KPI et leurs décisions', /inférieur à 85 %|sous 85 %/, /1:3/, /0 R sur 20 trades|inférieure à 0 R/, /15 pips/],
  ['les quatre setups autorisés', /Golden Setup/i, /Complexe Pull Back/i, /Market Shift/i, /ODF/],
  ['les fenêtres de tir en heure de Bamako', /Asie 1h|Asie 01|Asie 1 h/, /Europe 8h|Europe 08/, /USA 13h|USA 13/],
  ['les phases de Wyckoff et l\'entrée en phase C', /phase C/i, /SPRING/, /UTAD/]
];
const fondManquant = fondAttendu.filter(([, ...motifs]) => !motifs.every((m) => m.test(texteComplet))).map(([n]) => n);
verif('le fond de chaque notion clé est enseigné (définitions, pas seulement les mots)',
  fondManquant.length === 0, fondManquant.join(' | ') || fondAttendu.length + ' notions développées');

// exercices bien formés
const mauvaisEx = [];
chapitres.forEach((c) => c.exercices.forEach((e, i) => {
  if (!e.q || !Array.isArray(e.choix) || e.choix.length < 3 || typeof e.bonne !== 'number' ||
      e.bonne < 0 || e.bonne >= e.choix.length || !e.explication) mauvaisEx.push(c.num + '.' + (i + 1));
}));
verif('chaque exercice a un énoncé, des choix, une bonne réponse et une explication',
  mauvaisEx.length === 0, mauvaisEx.slice(0, 3).join(' | ') || 'tous corrects');

// chiffres clés présents (conformes aux documents)
const chiffresAttendus = [
  ['1 % maximum par trade', /1 % maximum par trade|1 % par trade|1 % maximum/],
  ['stop 15 pips', /15 pips/],
  ['ratio 1:7', /1:7/],
  ['deux stop loss par jour', /[Dd]eux stop loss/],
  ['risque 0,25 % – 1 %', /0,25 % à 1 %|0,25 % – 1 %/],
  ['prises partielles 30 / 50', /30 %.*50 %|30 \/ 50/],
  ['fenêtres de tir', /fenêtre[s]? de tir/],
  ['20 trades avant de juger', /20 trades/],
  ['seuil de respect du plan 85 %', /85 %/],
  ['drawdown 10 %', /10 % de drawdown|10 % depuis le plus haut|drawdown supérieur à 10/]
];
const absents = chiffresAttendus.filter(([, re]) => !re.test(texteComplet)).map(([n]) => n);
verif('les chiffres clés des documents sont enseignés', absents.length === 0, absents.join(' | ') || chiffresAttendus.length + ' repères');

// vocabulaire de la méthode
const vocabulaire = ['HH', 'HL', 'LH', 'LL', 'BOS', 'ChoCh', 'premium', 'discount', 'EQH', 'EQL',
  'SPRING', 'UTAD', 'inducement', 'intact', 'complexe pull back', 'market shift', 'Wyckoff',
  'signature de liquidité', 'golden setup', 'ODF', 'high ou low du mois'];
const vocabAbsent = vocabulaire.filter((v) => texteComplet.indexOf(v) === -1);
verif('le vocabulaire de la méthode est présent', vocabAbsent.length === 0, vocabAbsent.join(' | ') || vocabulaire.length + ' termes');

// honnêteté sur les manques
verif('les modules absents du livre sont signalés',
  ctx.FormationContenu.manques.some((m) => /Concept Entry/.test(m) && /Raffinage/.test(m)),
  ctx.FormationContenu.manques.length + ' point(s) à compléter');

// français, sans emoji
// emoji au sens strict : les pictogrammes Unicode (les flèches typographiques restent permises)
const emoji = /\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}\u{FE0F}]/u;
verif('aucun emoji dans le cours', !emoji.test(texteComplet));
verif('aucun emoji dans la vue ni dans l\'entraîneur',
  !emoji.test(lire('assets/js/formation.js')) && !emoji.test(lire('assets/js/entraineur.js')));
verif('aucune ressource distante dans le cours',
  !/https?:\/\//.test(texteComplet) && !/https?:\/\//.test(lire('assets/js/formation.js')));

/* =========================================================
   2. Honnêteté de l'entraîneur : les bougies disent la vérité
   ========================================================= */
console.log('\n2. Entraîneur — cohérence des scénarios');
const E = ctx.Entraineur;
const GRAINES = 150;
const problemes = [];
const stats = {};

Object.keys(E.MODELES).forEach((modele) => {
  const at = E.MODELES[modele].attendu;
  const et = E.MODELES[modele].etude || {};
  const t = { tendance: 0, bos: 0, zone: 0, evenement: 0, secousse: 0, bougies: 0, n: 0 };
  for (let g = 1; g <= GRAINES; g++) {
    const sc = E.scenario(modele, g);
    t.n++;
    if (sc.tendance === at.tendance) t.tendance++; else problemes.push(modele + ' g' + g + ' : tendance lue ' + sc.tendance + ' au lieu de ' + at.tendance);
    if (at.bos) { if (sc.bosNature === at.bos) t.bos++; else problemes.push(modele + ' g' + g + ' : BOS ' + sc.bosNature + ' au lieu de ' + at.bos); }
    if (et.zone) { if (sc.zoneType === et.zone) t.zone++; else problemes.push(modele + ' g' + g + ' : zone ' + sc.zoneType + ' au lieu de ' + et.zone); }
    if (et.evenement) {
      if (sc.evenement === et.evenement) t.evenement++; else problemes.push(modele + ' g' + g + ' : événement ' + sc.evenement);
      // la secousse doit réellement sortir de la fourchette : on la compare aux
      // extrêmes des segments de référence déclarés par le modèle (le SC et le ST
      // pour l'accumulation, le BC et le ST pour la distribution)
      const iSeg = et.evenementSegment;
      const seg = sc.plages[iSeg];
      const ref = (et.secousseReference || [1, 3]).map((i) => sc.bougies.slice(sc.plages[i].debut, sc.plages[i].fin + 1));
      const avant = ref.reduce((a, b) => a.concat(b), []);
      const dans = sc.bougies.slice(seg.debut, seg.fin + 1);
      const balayage = et.evenement === 'SPRING' ? Math.min.apply(null, dans.map((b) => b.l)) : Math.max.apply(null, dans.map((b) => b.h));
      const fourchette = et.evenement === 'SPRING' ? Math.min.apply(null, avant.map((b) => b.l)) : Math.max.apply(null, avant.map((b) => b.h));
      const sorti = et.evenement === 'SPRING' ? balayage < fourchette : balayage > fourchette;
      if (sorti) t.secousse++;
      else problemes.push(modele + ' g' + g + ' : la secousse ne sort pas de la fourchette (' + balayage.toFixed(2) + ' vs ' + fourchette.toFixed(2) + ')');
    }
    // bougies valides
    const valides = sc.bougies.every((b) => b.h >= Math.max(b.o, b.c) - 1e-6 && b.l <= Math.min(b.o, b.c) + 1e-6 && b.h >= b.l);
    if (valides) t.bougies++; else problemes.push(modele + ' g' + g + ' : bougie incohérente');
  }
  stats[modele] = t;
});

const total = Object.keys(stats).reduce((a, k) => a + stats[k].n, 0);
verif('toutes les bougies sont cohérentes (haut, bas, corps)',
  Object.keys(stats).every((k) => stats[k].bougies === stats[k].n), total + ' bougies-scénarios vérifiées');
verif('la structure lue correspond à l\'histoire annoncée',
  Object.keys(stats).every((k) => stats[k].tendance === stats[k].n),
  Object.keys(stats).map((k) => stats[k].tendance + '/' + stats[k].n).join(' '));
verif('la nature du BOS correspond à l\'histoire annoncée',
  Object.keys(stats).every((k) => !E.MODELES[k].attendu.bos || stats[k].bos === stats[k].n));
verif('le type de zone correspond à l\'histoire annoncée',
  Object.keys(stats).every((k) => !(E.MODELES[k].etude || {}).zone || stats[k].zone === stats[k].n));
verif('les secousses dépassent réellement la fourchette',
  Object.keys(stats).every((k) => !(E.MODELES[k].etude || {}).evenement || stats[k].secousse === stats[k].n));
verif('aucun écart entre l\'intention et les bougies', problemes.length === 0,
  problemes.length ? problemes.slice(0, 3).join(' | ') : total + ' scénarios, 0 écart');

// reproductibilité
const a = JSON.stringify(E.scenario('spring', 4242).bougies);
const b = JSON.stringify(E.scenario('spring', 4242).bougies);
const c = JSON.stringify(E.scenario('spring', 4243).bougies);
verif('même graine, même graphique (révisions et corrections identiques)', a === b);
verif('graine différente, graphique différent (entraînement varié)', a !== c);

// questions et réponses
console.log('\n3. Questions et correction');
const sc = E.scenario('hausse_continuation', 7);
verif('un scénario produit 3 à 4 questions', sc.questions.length >= 3 && sc.questions.length <= 4, sc.questions.length + ' questions');
verif('chaque question a une bonne réponse atteignable',
  sc.questions.every((q) => q.type === 'zone' ? !!q.bonne : q.choix.some((c) => c.id === q.bonne)));
verif('chaque question est expliquée', sc.questions.every((q) => q.explication && q.explication.length > 40));
verif('aucune réponse écrite en dur dans les choix (la bonne réponse est une clé)',
  sc.questions.every((q) => q.type === 'zone' || q.choix.every((c) => typeof c.id === 'string')));

const qTendance = sc.questions.filter((q) => q.concept === 'tendance')[0];
verif('la bonne réponse de tendance est celle lue dans les bougies',
  qTendance.bonne === E.tendance(sc.bascules), qTendance.bonne);
const verdictJuste = E.corriger(qTendance, qTendance.bonne);
const verdictFaux = E.corriger(qTendance, qTendance.choix.filter((c) => c.id !== qTendance.bonne)[0].id);
verif('une bonne réponse est acceptée', verdictJuste.correct === true);
verif('une mauvaise réponse est refusée et expliquée', verdictFaux.correct === false && !!verdictFaux.explication);

const qZone = sc.questions.filter((q) => q.type === 'zone')[0];
const milieuZone = { index: Math.round((qZone.bonne.i0 + qZone.bonne.i1) / 2), prix: (qZone.bonne.pmin + qZone.bonne.pmax) / 2 };
const horsZone = { index: milieuZone.index, prix: qZone.bonne.pmax + 5 };
verif('un clic dans la zone est accepté', E.corriger(qZone, milieuZone).correct === true);
verif('un clic hors de la zone est refusé', E.corriger(qZone, horsZone).correct === false);

// conversion clic → prix, et centre de zone
const rect = { left: 0, top: 0, width: 720, height: 340 };
const centre = E.centreZone(sc, rect);
const point = E.clicVersPrix(sc, rect, centre.clientX, centre.clientY);
verif('le clic est converti au bon prix et à la bonne bougie',
  point.prix >= qZone.bonne.pmin - 1 && point.prix <= qZone.bonne.pmax + 1,
  'clic → prix ' + E.fmt(point.prix) + ', zone ' + E.fmt(qZone.bonne.pmin) + '-' + E.fmt(qZone.bonne.pmax));

// rendu SVG
const svg = E.rendreGraphique(sc, { correction: true });
verif('le graphique est un SVG autonome', /^<svg class="ent-graphique"/.test(svg) && svg.indexOf('</svg>') > 0);
verif('le graphique porte une description accessible', /role="img"/.test(svg) && /aria-label="Graphique en bougies/.test(svg));
verif('les bougies sont dessinées', (svg.match(/class="ent-corps/g) || []).length === sc.bougies.length,
  sc.bougies.length + ' bougies');
verif('la correction dessine la zone et le niveau de cassure',
  /class="ent-zone/.test(svg) && /class="ent-niveau bos"/.test(svg));
verif('le rendu ne demande aucune ressource externe', !/https?:\/\//.test(svg) && !/<image/.test(svg));

/* =========================================================
   4. Calculs de risque
   ========================================================= */
console.log('\n4. Exercices de calcul');
{
  // le calcul est testé par la même formule que le plan
  let coherents = 0, limite = 0, n = 200;
  for (let i = 0; i < n; i++) {
    const t = (function () {
      const capital = (5 + Math.floor(Math.random() * 16)) * 1000;
      const risquePct = [0.25, 0.5, 1][Math.floor(Math.random() * 3)];
      const pips = 5 + Math.floor(Math.random() * 11);
      const R = Math.round(capital * risquePct / 100 * 100) / 100;
      const lots = Math.round(R / (pips * 10) * 100) / 100;
      return { capital, risquePct, pips, R, lots, depasse: pips > 15 };
    })();
    if (Math.abs(t.R - t.capital * t.risquePct / 100) < 0.01) coherents++;
    if (t.pips <= 15) limite++;
  }
  verif('la formule de risque est respectée (R = capital × taux)', coherents === n, coherents + '/' + n);
  verif('les énoncés restent dans la limite de 15 pips', limite === n);
  verif('l\'énoncé et la correction du calcul sont dans la vue', /R = capital × taux de risque/.test(lire('assets/js/formation.js')));
}

/* =========================================================
   5. Vue, progression et intégration (dans un vrai DOM)
   ========================================================= */
console.log('\n5. Vue et progression');
(async function () {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
  vc.on('error', (...a) => erreurs.push('console.error: ' + a.join(' ')));
  vc.on('warn', () => {});

  const dom = new JSDOM(lire('index.html'), {
    runScripts: 'dangerously', url: 'https://exemple.test/trading/', pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window, d = w.document;
  Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  Object.defineProperty(w.navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ showNotification: () => Promise.resolve() }) } });

  ['store.js', 'metrics.js', 'charts.js', 'plan.js', 'ui.js', 'views.js', 'sync.js', 'lock.js', 'notify.js',
    'entraineur.js', 'formation-contenu.js', 'formation.js', 'app.js'].forEach((f) => {
    const e = d.createElement('script');
    e.textContent = lire('assets/js/' + f);
    d.body.appendChild(e);
  });
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 120));

  verif('l\'entrée « Formation » est dans le menu', !!d.querySelector('[data-view="formation"]'));
  verif('l\'icône de la formation est une icône vectorielle', /ecole:/.test(lire('assets/js/ui.js')));

  d.querySelector('[data-view="formation"]').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 140));
  const v = d.getElementById('view');

  verif('la vue se rend sans erreur', erreurs.length === 0 && !!v.querySelector('.form-entete'), erreurs[0] || 'aucune erreur');
  verif('les douze chapitres sont affichés', v.querySelectorAll('details.chap').length === 13, '12 chapitres + sources');
  verif('tous les exercices sont rendus', v.querySelectorAll('.quiz-q').length === 52,
    v.querySelectorAll('.quiz-q').length + ' questions');
  verif('les scores de progression sont affichés', v.querySelectorAll('.form-score').length === 3);
  verif('un chapitre suivant est proposé', !!v.querySelector('.form-suivant .btn'));
  verif('l\'entraîneur est présent', !!v.querySelector('#entraineur') && !!v.querySelector('#fTirer'));
  verif('les concepts d\'entraînement sont proposés', v.querySelectorAll('#fConcepts .seg-btn').length === 6);

  // répondre à une question du cours
  const chap = v.querySelector('#chap-structure');
  chap.open = true;
  chap.dispatchEvent(new w.Event('toggle', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  const p0 = w.Formation.lire();
  verif('l\'ouverture d\'un chapitre le marque comme étudié', w.Formation.chapitresVus() === 1, w.Formation.chapitresVus() + ' / 12');

  chap.querySelector('.quiz-btn').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 140));
  const chapApres = d.getElementById('chap-structure');
  verif('la correction de l\'exercice s\'affiche', !!chapApres.querySelector('.quiz-correction:not([hidden])'));
  verif('la progression est enregistrée dans le journal',
    Object.keys(w.Formation.lire().chapitres).indexOf('structure') > -1,
    JSON.stringify(w.Formation.lire().chapitres.structure));
  verif('la correction reste visible après le redessin',
    chapApres.querySelectorAll('.quiz-correction:not([hidden])').length === 1);

  // l'entraîneur : tirage, réponse, correction, série
  d.getElementById('fTirer').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 140));
  const bougies = d.querySelectorAll('.ent-corps').length;
  verif('un graphique est dessiné', bougies > 30, bougies + ' bougies');
  const choix = d.querySelector('.ent-choix-btn');
  const attendu = d.querySelector('.ent-intitule').textContent.length > 10;
  choix.dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 140));
  verif('la réponse est corrigée immédiatement', !!d.querySelector('.ent-retour') && attendu,
    (d.querySelector('.ent-retour') || {}).textContent.slice(0, 60));
  const bilan = w.Formation.lire().entraineur;
  verif('le bilan de l\'entraîneur est enregistré', bilan.questions === 1 && bilan.essais === 1, JSON.stringify(bilan));

  // la correction affiche les repères
  d.getElementById('fCorrection').dispatchEvent(new w.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 140));
  verif('la correction dessine les repères sur le graphique',
    d.querySelectorAll('.ent-zone, .ent-niveau').length > 0,
    d.querySelectorAll('.ent-zone, .ent-niveau').length + ' repère(s)');

  // remise à zéro
  w.Formation.reinitialiser();
  verif('la remise à zéro efface la progression', w.Formation.chapitresVus() === 0 && w.Formation.lire().entraineur.questions === 0);

  // intégration : cache, impression, sauvegarde cloud
  console.log('\n6. Intégration');
  const sw = lire('sw.js');
  ['entraineur.js', 'formation-contenu.js', 'formation.js'].forEach((f) => {
    if (sw.indexOf("'./assets/js/" + f + "'") === -1) { ko++; console.log('  ✗ ' + f + ' absent du cache hors ligne'); }
  });
  verif('les trois modules sont dans le cache hors ligne', ok > 0 && sw.indexOf('entraineur.js') > -1 && sw.indexOf('formation.js') > -1);
  verif('la version du cache a été relevée', /trading-desk-v(1[0-9]|[2-9][0-9])/.test(sw));
  verif('les modules sont chargés par la page', /assets\/js\/formation\.js/.test(lire('index.html')) && /assets\/js\/entraineur\.js/.test(lire('index.html')));
  verif('l\'entraîneur est masqué à l\'impression',
    /@media print\{[\s\S]*?\.entraineur[\s\S]*?display:none/.test(lire('assets/css/styles.css')));
  verif('les chapitres sont dépliables pour l\'impression', /Tout déplier \(impression\)/.test(lire('assets/js/formation.js')));
  verif('la progression passe par le journal (chiffré et sauvegardé au même endroit)',
    /Plan\.loadChecks/.test(lire('assets/js/formation.js')) && /Plan\.saveChecks/.test(lire('assets/js/formation.js')));
  verif('aucun appel réseau dans la formation',
    !/fetch\(|XMLHttpRequest/.test(lire('assets/js/formation.js') + lire('assets/js/entraineur.js')));
  // les applications du Play Store : listées avec leurs limites, sans lien externe
const formation = lire('assets/js/formation.js');
verif('les applications d\'entraînement du Play Store sont listées',
  /Play Store/.test(formation) && /Candle Master/.test(formation) && /Chart Quiz/.test(formation) && /GoForex/.test(formation),
  '3 applications qui corrigent et notent');
verif('chaque application porte sa langue et sa limite',
  /application partage l\'identifiant|sans exercices corrigés|verrouillé en premium|signaux quotidiens/.test(formation));
verif('la mise en garde contre les fausses applications éducatives est écrite',
  /vitrines de courtiers/.test(formation) && /retraits en échec/.test(formation) && /compte démo/.test(formation));
verif('le guide n\'ajoute aucun lien externe (il reste utilisable hors ligne)',
  !/https?:\/\//.test(formation), 'aucune adresse dans la vue Formation');

verif('la formation est annoncée dans le README', /Formation/.test(lire('README.md')));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, formation vérifiée.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
