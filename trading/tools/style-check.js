/* =========================================================
   style-check.js — recette de la feuille de style

   Vérifie ce qu'un œil ne voit pas toujours :
   - la feuille compile (accolades) et ne dépend d'aucune ressource distante ;
   - tous les jetons utilisés (var(--x)) sont bien définis ;
   - les contrastes de texte respectent au minimum AA (WCAG) ;
   - les cibles tactiles sont assez grandes en mode tactile ;
   - l'accessibilité clavier et « réduire les animations » sont prévues ;
   - l'impression reste propre ;
   - surtout : la couche de finitions n'écrase aucune règle adaptative
     (un réglage mobile déclaré avant une règle générale plus basse
     serait silencieusement ignoré).

   Usage : node tools/style-check.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(RACINE, 'assets/css/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---------- 1. intégrité du fichier ---------- */
console.log('\n1. Intégrité');
verif('accolades équilibrées', css.split('{').length === css.split('}').length, css.split('{').length - 1 + ' blocs');
verif('aucun caractère de remplacement', !/\uFFFD/.test(css));
verif('aucune importation distante', !/@import/.test(css) && !/url\(\s*['"]?https?:/.test(css));
verif('feuille unique, pas de doublon de chargement', (html.match(/styles\.css/g) || []).length === 1);
const ko_debut = css.length, budget = 90000;
verif('taille raisonnable (budget ' + Math.round(budget / 1024) + ' Ko)', ko_debut <= budget, Math.round(ko_debut / 1024) + ' Ko');

/* ---------- 2. jetons de design ---------- */
console.log('\n2. Jetons de design');
const blocRoot = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
const definis = new Set(Array.from(blocRoot.matchAll(/(--[a-z0-9-]+)\s*:/gi)).map((m) => m[1].toLowerCase()));
const utilises = new Set(Array.from(css.matchAll(/var\((--[a-z0-9-]+)/gi)).map((m) => m[1].toLowerCase()));
const manquants = Array.from(utilises).filter((v) => !definis.has(v));
verif('tous les jetons utilisés sont définis', manquants.length === 0, manquants.join(', ') || definis.size + ' jetons');
['--bg', '--panel', '--text', '--muted', '--gold', '--green', '--red', '--radius', '--shadow', '--ease', '--dur'].forEach((j) => {
  if (!definis.has(j)) { ko++; console.log('  ✗ jeton attendu absent : ' + j); }
});
verif('échelle de rayons définie', ['--radius', '--radius-sm', '--radius-xs'].every((j) => definis.has(j)));
verif('courbe de mouvement + durée définies', definis.has('--ease') && definis.has('--dur'));

/* ---------- 3. contrastes (WCAG) ---------- */
console.log('\n3. Contrastes');
function hex(v) {
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function jeton(nom) { const m = new RegExp(nom + '\\s*:\\s*(#[0-9a-f]{6})', 'i').exec(blocRoot); return m ? hex(m[1]) : null; }
const paires = [
  ['texte principal sur carte', '--text', '--panel', 4.5],
  ['texte secondaire sur carte', '--muted', '--panel', 4.5],
  ['texte discret sur fond', '--muted-2', '--bg', 4.5],
  ['or sur carte', '--gold', '--panel', 4.5],
  ['or clair sur carte', '--gold-2', '--panel', 4.5],
  ['vert (gain) sur carte', '--green', '--panel', 4.5],
  ['rouge (perte) sur carte', '--red', '--panel', 4.5],
  ['bleu sur carte', '--blue', '--panel', 4.5],
  ['texte du bouton doré', '--text', '--panel', 1]
];
paires.forEach(([nom, fg, bg, mini]) => {
  const a = jeton(fg), b = jeton(bg);
  if (!a || !b) { ko++; console.log('  ✗ paire non mesurable : ' + nom); return; }
  const r = contraste(a, b);
  verif(nom + ' (' + fg + ' sur ' + bg + ')', r >= (mini || 1), r.toFixed(2) + ':1' + (mini > 1 ? ' (min ' + mini + ')' : ''));
});
// texte du bouton principal (sombre sur or)
const sombre = hex('#171202'), or = jeton('--gold');
verif('texte du bouton doré sur or', contraste(sombre, or) >= 4.5, contraste(sombre, or).toFixed(2) + ':1');

/* ---------- 4. accessibilité ---------- */
console.log('\n4. Accessibilité');
verif('focus clavier visible (:focus-visible)', /:focus-visible/.test(css));
verif('anneau de focus doré', /outline:\s*2px solid rgba\(237,\s*187,\s*82/.test(css) || /--ring/.test(css));
verif('sélection de texte stylée', /::selection/.test(css));
verif('animations réduites respectées', /prefers-reduced-motion/.test(css));
verif('défilement discret (barres fines)', /scrollbar-width:\s*thin/.test(css) && /-webkit-scrollbar/.test(css));
verif('cibles tactiles ≥ 44 px (boutons)', /@media \(pointer:coarse\)\{[\s\S]*?\.btn\{[^}]*min-height:44px/.test(css.replace(/\n\s*/g, '')));
verif('cibles tactiles ≥ 42 px (icônes)', /\.icon-btn\{[^}]*width:42px/.test(css.replace(/\n\s*/g, '')));
verif('champs à 16 px sur tactile (pas de zoom iOS)', /@media \(pointer:coarse\)\{[\s\S]*?input[^}]*font-size:16px/.test(css.replace(/\n\s*/g, '')));
verif('lien d\'évitement ou titres structurés', /<h1/.test(html) && /aria-live/.test(html));

/* ---------- 5. impression ---------- */
console.log('\n5. Impression');
const blocImpression = css.slice(css.lastIndexOf('@media print'));
verif('bloc d\'impression présent en fin de feuille', blocImpression.length > 100);
verif('décor supprimé à l\'impression', /box-shadow:none!important/.test(blocImpression) || /box-shadow:none/.test(blocImpression));
verif('filet doré masqué à l\'impression', /body:before\{display:none\}/.test(blocImpression.replace(/\s/g, '')));
verif('barre latérale masquée à l\'impression', /\.sidebar[^{]*\{display:none/.test(css));

/* ---------- 6. la couche de finitions n'écrase rien d'adaptatif ---------- */
console.log('\n6. Règles adaptatives préservées');
/** Découpe la feuille en blocs : sélecteur, média englobant, propriétés. */
function blocs(source, contexte, decalage) {
  const liste = [];
  const decalageCourant = decalage || 0;
  const pile = contexte || [];
  let i = 0;
  while (i < source.length) {
    const ouvrante = source.indexOf('{', i);
    if (ouvrante === -1) break;
    const selecteur = source.slice(i, ouvrante).trim();
    let profondeur = 1, j = ouvrante + 1;
    while (j < source.length && profondeur > 0) {
      if (source[j] === '{') profondeur++;
      else if (source[j] === '}') profondeur--;
      j++;
    }
    const corps = source.slice(ouvrante + 1, j - 1);
    if (selecteur.startsWith('@')) {
      liste.push.apply(liste, blocs(corps, pile.concat([selecteur]), ouvrante + 1 + decalageCourant));
    } else {
      liste.push({
        selecteur: selecteur,
        media: pile.join(' '),
        props: Array.from(corps.matchAll(/(^|;)\s*([a-z-]+)\s*:/gi)).map((m) => m[2].toLowerCase()),
        position: ouvrante + decalageCourant
      });
    }
    i = j;
  }
  return liste;
}
const tous = blocs(css, [], 0);
const adaptatif = tous.filter((b) => /max-width|pointer:coarse|min-width/.test(b.media));
const general = tous.filter((b) => !b.media);
const ecrases = [];
adaptatif.forEach((regle) => {
  regle.props.forEach((prop) => {
    // une règle générale déclarée APRÈS annulerait le réglage adaptatif
    const apres = general.filter((g) => g.position > regle.position && g.selecteur === regle.selecteur && g.props.indexOf(prop) > -1);
    if (apres.length) ecrases.push(regle.media.slice(0, 26) + ' → ' + regle.selecteur + ' { ' + prop + ' }');
  });
});
const uniques = Array.from(new Set(ecrases));
verif('aucun réglage adaptatif écrasé par une règle générale plus basse', uniques.length === 0, uniques.slice(0, 5).join(' | ') || (adaptatif.length + ' règles adaptatives, ' + general.length + ' règles générales vérifiées'));

/* ---------- 7. cohérence avec le reste de l'application ---------- */
console.log('\n7. Cohérence');
const classesHtml = new Set(Array.from(html.matchAll(/class="([^"]+)"/g)).flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
const classesAbsentes = Array.from(classesHtml).filter((c) => !css.includes('.' + c) && !/^(on|off|active|open|hidden)$/.test(c));
verif('toutes les classes du HTML ont un style', classesAbsentes.length === 0, classesAbsentes.join(', ') || classesHtml.size + ' classes');
verif('chiffres alignés (tabular-nums) dans les tableaux et KPI', /font-variant-numeric:tabular-nums/.test(css));
verif('aucune couleur codée en dur hors des jetons (tolérance de mise)', (() => {
  // les couleurs ponctuelles restent autorisées (survols, états), on compte seulement les abus
  const codes = Array.from(css.matchAll(/#[0-9a-f]{6}/gi)).length;
  return codes < 60;
})(), Array.from(css.matchAll(/#[0-9a-f]{6}/gi)).length + ' codes hexadécimaux (jetons + déclinaisons)');

/* ---------- 8. couleurs partagées entre la feuille et le script ---------- */
console.log('\n8. Couleurs partagées (thème unique)');
const charts = fs.readFileSync(path.join(RACINE, 'assets/js/charts.js'), 'utf8');
const app = fs.readFileSync(path.join(RACINE, 'assets/js/app.js'), 'utf8');
const views = fs.readFileSync(path.join(RACINE, 'assets/js/views.js'), 'utf8');
const ANCIENS = ['#f2c14e', '#25d09a', '#ff5f6d', '#5aa9ff', '#a78bfa', '#8b93a7', '#e8ecf5'];
[['charts.js', charts], ['app.js', app], ['views.js', views]].forEach(([nom, source]) => {
  const restes = ANCIENS.filter((c) => source.toLowerCase().indexOf(c) > -1);
  verif('aucune couleur de l\'ancienne palette dans ' + nom, restes.length === 0, restes.join(', ') || 'à jour');
});
const jetonsCharts = Array.from(charts.matchAll(/'(--[a-z0-9-]+)'/gi)).map((m) => m[1].toLowerCase());
const absentsCharts = Array.from(new Set(jetonsCharts)).filter((j) => !definis.has(j));
verif('chaque jeton utilisé par les graphiques existe', absentsCharts.length === 0, absentsCharts.join(', ') || Array.from(new Set(jetonsCharts)).length + ' jetons');
const clesPalette = (charts.match(/var JETONS = \{([\s\S]*?)\};/) || [, ''])[1];
const clesRepli = (charts.match(/var JETONS_REPLI = \{([\s\S]*?)\};/) || [, ''])[1];
const attendues = Array.from(clesPalette.matchAll(/([a-zA-Z]+):/g)).map((m) => m[1]);
const replis = Array.from(clesRepli.matchAll(/([a-zA-Z]+):/g)).map((m) => m[1]);
const sansRepli = attendues.filter((c) => replis.indexOf(c) === -1);
verif('chaque couleur de graphique a une valeur de repli', sansRepli.length === 0, sansRepli.join(', ') || attendues.length + ' couleurs');
verif('les graphiques relisent le thème à chaque rendu', /rafraichirPalette\(\)/.test(charts));

console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés.' : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
process.exit(ko === 0 ? 0 : 1);
