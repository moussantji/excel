/* =========================================================
   entraineur.js — Entraîneur de lecture de graphique (SMV)

   Fabrique des graphiques en bougies hors ligne, à partir de
   scénarios écrits d'après le plan et l'Ultra Book FX :

   - structure haussière / baissière / consolidation
   - les trois BOS : continuation, changement de tendance, piège
   - les zones d'offre et de demande (bougie manipulatrice +
     bougie qui prend l'argent)
   - la liquidité : EQH/EQL, intacts, fourchette
   - le déroulé de Wyckoff : SPRING (accumulation), UTAD (distribution)

   Règle de conception : la bonne réponse n'est JAMAIS écrite en dur
   dans la question, elle est DÉDUITE des bougies générées. Le
   scénario déclare seulement son intention (par exemple « ici, la
   cassure doit être un piège ») ; la recette tools/formation-test.js
   vérifie, sur des centaines de tirages, que les bougies racontent
   bien l'histoire annoncée. Si ce n'est pas le cas, la recette
   échoue plutôt que d'enseigner une erreur.

   Aucune ressource externe, aucun appel réseau : tout est fabriqué
   par l'appareil, à partir d'une graine reproductible.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------
     1. Tirage pseudo-aléatoire reproductible
     --------------------------------------------------------- */
  function alea(graine) {
    var a = (graine >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function entre(rnd, mini, maxi) { return mini + rnd() * (maxi - mini); }
  function entier(rnd, mini, maxi) { return Math.floor(entre(rnd, mini, maxi + 1)); }
  function arr(v) { return Math.round(v * 1000) / 1000; }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /* ---------------------------------------------------------
     2. Bougies

     Un segment = { dir: 1 | -1, pips, bars, nom, oscillation, bruit, meche }
     ou, pour une fourchette, { dir, vers: prixAbsolu, bars, ... }.
     --------------------------------------------------------- */
  function genererBougies(segments, rnd, depart) {
    var bougies = [], bascules = [], plages = [], prix = depart;
    segments.forEach(function (seg) {
      var debut = bougies.length;
      var cible = seg.vers !== undefined ? seg.vers : prix + seg.dir * seg.pips;
      var bruit = seg.bruit === undefined ? 0.28 : seg.bruit;
      var oscill = seg.oscillation === undefined ? 0.5 : seg.oscillation;
      var echelleMeche = seg.meche === undefined ? 1 : seg.meche;
      for (var k = 1; k <= seg.bars; k++) {
        var part = k / seg.bars;
        var ouverture = bougies.length ? bougies[bougies.length - 1].c : prix;
        var attendu = prix + (cible - prix) * part;
        var ecart = (rnd() - 0.5) * 2 * Math.abs(cible - prix) * bruit * oscill;
        var cloture = k === seg.bars ? cible + (rnd() - 0.5) * Math.abs(cible - prix) * 0.03 : attendu + ecart * (1 - part * 0.35);
        if (k === seg.bars) cloture = cible;
        var corps = Math.abs(cloture - ouverture);
        var mecheH = (corps * entre(rnd, 0.15, 0.7) + Math.abs(cible - prix) * 0.06 * rnd()) * echelleMeche;
        var mecheB = (corps * entre(rnd, 0.15, 0.7) + Math.abs(cible - prix) * 0.06 * rnd()) * echelleMeche;
        bougies.push({ o: arr(ouverture), h: arr(Math.max(ouverture, cloture) + mecheH), l: arr(Math.min(ouverture, cloture) - mecheB), c: arr(cloture) });
        prix = cloture;
      }
      bascules.push({ i: bougies.length - 1, prix: arr(cible), sens: seg.dir > 0 ? 'haut' : 'bas', nom: seg.nom || '' });
      plages.push({ debut: debut, fin: bougies.length - 1, nom: seg.nom || '', dir: seg.dir });
    });
    return { bougies: bougies, bascules: bascules, plages: plages };
  }

  /* ---------------------------------------------------------
     3. Analyse — tout est relu dans les bougies
     --------------------------------------------------------- */

  /** Tendance d'après les deux derniers hauts et les deux derniers bas. */
  function tendance(bascules, tolerance) {
    var tol = tolerance === undefined ? 0.03 : tolerance;
    var hauts = bascules.filter(function (b) { return b.sens === 'haut'; });
    var bas = bascules.filter(function (b) { return b.sens === 'bas'; });
    if (hauts.length < 2 || bas.length < 2) return 'incoherente';
    var h1 = hauts[hauts.length - 2].prix, h2 = hauts[hauts.length - 1].prix;
    var l1 = bas[bas.length - 2].prix, l2 = bas[bas.length - 1].prix;
    var ambit = Math.max(Math.abs(h1), Math.abs(l1), 1);
    var dh = (h2 - h1) / ambit, dl = (l2 - l1) / ambit;
    var hautsEgaux = Math.abs(dh) <= tol, basEgaux = Math.abs(dl) <= tol;
    if (hautsEgaux && basEgaux) return 'consolidation';
    if (dh > 0 && dl > 0) return 'haussiere';
    if (dh < 0 && dl < 0) return 'baissiere';
    return 'incoherente';
  }

  /** Toutes les cassures de structure (clôture au-delà d'un sommet antérieur). */
  function cassures(bougies, bascules) {
    var liste = [];
    for (var i = 1; i < bougies.length; i++) {
      var hauts = bascules.filter(function (b) { return b.sens === 'haut' && b.i < i - 1; });
      var bas = bascules.filter(function (b) { return b.sens === 'bas' && b.i < i - 1; });
      var h = hauts[hauts.length - 1], b2 = bas[bas.length - 1];
      if (h && bougies[i].c > h.prix) liste.push({ i: i, niveau: h.prix, ext: h.i, sens: 'haut' });
      else if (b2 && bougies[i].c < b2.prix) liste.push({ i: i, niveau: b2.prix, ext: b2.i, sens: 'bas' });
    }
    return liste;
  }

  /**
   * Nature d'une cassure : piège si elle n'a pas tenu, sinon continuation
   * si elle va dans le sens de la structure en place, changement sinon.
   */
  function natureCassure(bougies, bascules, ev) {
    var avant = bascules.filter(function (b) { return b.i < ev.i; });
    var tAvant = avant.length >= 4 ? tendance(avant) : 'indecise';
    var retour = 0, apres = bougies.length - 1 - ev.i;
    for (var j = ev.i + 1; j < bougies.length; j++) {
      if (ev.sens === 'haut' && bougies[j].c < ev.niveau) retour++;
      if (ev.sens === 'bas' && bougies[j].c > ev.niveau) retour++;
    }
    var tenue = apres > 0 ? 1 - Math.min(1, retour / apres) : 1;
    var nature;
    if (tenue < 0.34) nature = 'piege';
    else if (tAvant === 'consolidation' || tAvant === 'indecise' || tAvant === 'incoherente') nature = 'changement';
    else if ((tAvant === 'haussiere' && ev.sens === 'haut') || (tAvant === 'baissiere' && ev.sens === 'bas')) nature = 'continuation';
    else nature = 'changement';
    return { nature: nature, tenue: arr(tenue), tendanceAvant: tAvant };
  }

  /** Dernière cassure comprise dans la plage d'un segment. */
  function bosDuSegment(bougies, bascules, plage) {
    var dansPlage = cassures(bougies, bascules).filter(function (e) { return e.i >= plage.debut && e.i <= plage.fin; });
    if (!dansPlage.length) return null;
    var ev = dansPlage[dansPlage.length - 1];
    var n = natureCassure(bougies, bascules, ev);
    ev.nature = n.nature;
    ev.tenue = n.tenue;
    ev.tendanceAvant = n.tendanceAvant;
    return ev;
  }

  /**
   * Zone d'offre ou de demande à l'origine d'une impulsion :
   * la dernière bougie de sens contraire (bougie manipulatrice)
   * et la bougie qui prend l'argent, juste avant l'impulsion.
   */
  function zoneImpulsion(bougies, plage) {
    var debut = plage.debut;
    var j = debut - 1;
    var jusqua = Math.max(0, debut - 5);
    while (j > jusqua && (plage.dir > 0 ? bougies[j].c >= bougies[j].o : bougies[j].c <= bougies[j].o)) j--;
    if (j < 0) j = Math.max(0, debut - 1);
    var k = Math.min(bougies.length - 1, debut);      // la bougie qui prend l'argent
    var pmin = Math.min(bougies[j].l, bougies[k].l), pmax = Math.max(bougies[j].h, bougies[k].h);
    if (pmax - pmin <= 0) return null;
    return {
      i0: Math.max(0, j - 1), i1: Math.min(bougies.length - 1, k + 1),
      pmin: arr(pmin), pmax: arr(pmax),
      type: plage.dir > 0 ? 'demande' : 'offre',
      bougieManipulatrice: j
    };
  }

  /** EQH / EQL : deux hauts ou deux bas au même niveau (ligne de liquidité). */
  function niveauxEgaux(bascules, tolerance) {
    var tol = tolerance === undefined ? 0.025 : tolerance;
    var res = [];
    ['haut', 'bas'].forEach(function (sens) {
      var liste = bascules.filter(function (b) { return b.sens === sens; });
      for (var a = 0; a < liste.length - 1; a++) {
        for (var b = a + 1; b < liste.length; b++) {
          var ref = Math.max(Math.abs(liste[a].prix), 1);
          if (Math.abs(liste[a].prix - liste[b].prix) / ref <= tol) {
            res.push({ sens: sens, niveau: arr(liste[a].prix), indices: [liste[a].i, liste[b].i] });
          }
        }
      }
    });
    return res;
  }

  /** Intacts : hauts et bas de la structure jamais dépassés par la suite. */
  function intacts(bougies, bascules) {
    return bascules.map(function (b) {
      var apres = bougies.slice(b.i + 1);
      for (var k = 0; k < apres.length; k++) {
        if (b.sens === 'haut' && apres[k].h > b.prix) return null;
        if (b.sens === 'bas' && apres[k].l < b.prix) return null;
      }
      return { i: b.i, sens: b.sens, prix: b.prix };
    }).filter(Boolean);
  }

  /* ---------------------------------------------------------
     4. Modèles de scénarios
     --------------------------------------------------------- */
  var MODELES = {
    hausse_continuation: {
      nom: 'Tendance haussière — BOS de continuation',
      concept: 'tendance',
      intention: 'Structure haussière (HH/HL), retour dans la demande, puis cassure du haut précédent qui tient : on suit les 80 %.',
      segments: function (rnd) {
        return [
          { dir: -1, pips: entre(rnd, 26, 34), bars: entier(rnd, 7, 10), nom: 'départ' },
          { dir: 1, pips: entre(rnd, 40, 48), bars: entier(rnd, 7, 10), nom: 'impulsion 1' },
          { dir: -1, pips: entre(rnd, 18, 24), bars: entier(rnd, 5, 8), nom: 'retracement — bas plus haut' },
          { dir: 1, pips: entre(rnd, 34, 42), bars: entier(rnd, 7, 10), nom: 'impulsion 2 — haut plus haut' },
          { dir: -1, pips: entre(rnd, 20, 26), bars: entier(rnd, 6, 9), nom: 'retracement — nouveau bas plus haut' },
          { dir: 1, pips: entre(rnd, 40, 52), bars: entier(rnd, 8, 11), nom: 'impulsion 3 — cassure du haut' },
          { dir: -1, pips: entre(rnd, 12, 18), bars: entier(rnd, 5, 8), nom: 'repli' }
        ];
      },
      etude: { bosSegment: 5, zoneSegment: 5, zone: 'demande' },
      attendu: { tendance: 'haussiere', bos: 'continuation' },
      decision: {
        bonne: 'J\'attends le retour du prix dans la zone de demande et une confirmation LTF (ChoCh) pour acheter dans le sens des 80 %.',
        mauvaises: ['Je vends maintenant : le prix a monté, il doit redescendre.', 'J\'achète au marché, tout de suite, sans attendre la zone.'],
        explication: 'Structure haussière (HH/HL), cassure du haut précédent qui tient (BOS de continuation), zone de demande identifiable, liquidité au-dessus comme cible : les quatre lois sont alignées.'
      }
    },
    baisse_continuation: {
      nom: 'Tendance baissière — BOS de continuation',
      concept: 'tendance',
      intention: 'Structure baissière (LH/LL), retour dans l\'offre, puis cassure du bas précédent qui tient : on vend les 80 %.',
      segments: function (rnd) {
        return [
          { dir: 1, pips: entre(rnd, 24, 32), bars: entier(rnd, 6, 9), nom: 'départ' },
          { dir: -1, pips: entre(rnd, 40, 48), bars: entier(rnd, 7, 10), nom: 'impulsion 1' },
          { dir: 1, pips: entre(rnd, 18, 24), bars: entier(rnd, 5, 8), nom: 'correction — haut plus bas' },
          { dir: -1, pips: entre(rnd, 34, 42), bars: entier(rnd, 7, 10), nom: 'impulsion 2 — bas plus bas' },
          { dir: 1, pips: entre(rnd, 20, 26), bars: entier(rnd, 6, 9), nom: 'correction — nouveau haut plus bas' },
          { dir: -1, pips: entre(rnd, 40, 52), bars: entier(rnd, 8, 11), nom: 'impulsion 3 — cassure du bas' },
          { dir: 1, pips: entre(rnd, 12, 18), bars: entier(rnd, 5, 8), nom: 'repli' }
        ];
      },
      etude: { bosSegment: 5, zoneSegment: 5, zone: 'offre' },
      attendu: { tendance: 'baissiere', bos: 'continuation' },
      decision: {
        bonne: 'J\'attends le retour du prix dans la zone d\'offre et une confirmation LTF (ChoCh) pour vendre dans le sens de la structure.',
        mauvaises: ['J\'achète maintenant : le prix a beaucoup baissé, c\'est une bonne affaire.', 'Je vends au marché sans attendre la zone.'],
        explication: 'En structure baissière (LH/LL), les 80 % sont vendeurs : on vend sur les hauts, jamais sur les bas.'
      }
    },
    changement: {
      nom: 'Changement de caractère (BOS classique)',
      concept: 'bos',
      intention: 'Après une hausse, le prix casse un bas de structure : la tendance s\'arrête, le caractère change.',
      segments: function (rnd) {
        return [
          { dir: -1, pips: entre(rnd, 20, 26), bars: entier(rnd, 5, 8), nom: 'départ' },
          { dir: 1, pips: entre(rnd, 34, 42), bars: entier(rnd, 7, 10), nom: 'impulsion 1' },
          { dir: -1, pips: entre(rnd, 18, 24), bars: entier(rnd, 5, 8), nom: 'retracement — bas de structure' },
          { dir: 1, pips: entre(rnd, 24, 32), bars: entier(rnd, 6, 9), nom: 'sommet' },
          { dir: -1, pips: entre(rnd, 52, 66), bars: entier(rnd, 9, 12), nom: 'cassure du bas de structure' },
          { dir: 1, pips: entre(rnd, 18, 24), bars: entier(rnd, 6, 9), nom: 'retour dans l\'offre' },
          { dir: -1, pips: entre(rnd, 34, 44), bars: entier(rnd, 6, 9), nom: 'suite baissière' }
        ];
      },
      etude: { bosSegment: 4, zoneSegment: 4, zone: 'offre' },
      attendu: { tendance: 'baissiere', bos: 'changement' },
      decision: {
        bonne: 'La structure haussière est cassée : le caractère a changé. J\'attends le retour dans la zone d\'offre laissée par la cassure et je vends sur confirmation LTF.',
        mauvaises: ['C\'est un simple repli : j\'achète dans la continuité comme avant.', 'Je vends au marché immédiatement, sans attendre le retour dans la zone.'],
        explication: 'BOS classique : il montre l\'arrêt de la tendance et l\'intention inverse. On ne l\'échange pas au moment de la cassure, on attend le retest de la zone.'
      }
    },
    consolidation: {
      nom: 'Consolidation — EQH / EQL',
      concept: 'liquidite',
      intention: 'Fourchette avec des hauts et des bas au même niveau : aucune direction donnée, la liquidité s\'accumule des deux côtés.',
      segments: function (rnd) {
        var haut = 100 + entre(rnd, 16, 20), bas = 100 - entre(rnd, 16, 20);
        return [
          { dir: 1, vers: haut, bars: entier(rnd, 5, 7), nom: 'vers le haut de fourchette', oscillation: 0.3, meche: 0.5 },
          { dir: -1, vers: bas, bars: entier(rnd, 5, 7), nom: 'vers le bas de fourchette', oscillation: 0.3, meche: 0.5 },
          { dir: 1, vers: haut - entre(rnd, 0, 0.4), bars: entier(rnd, 5, 7), nom: 'retour au haut', oscillation: 0.3, meche: 0.5 },
          { dir: -1, vers: bas + entre(rnd, 0, 0.4), bars: entier(rnd, 5, 7), nom: 'retour au bas', oscillation: 0.3, meche: 0.5 },
          { dir: 1, vers: haut - entre(rnd, 0.5, 1.2), bars: entier(rnd, 5, 7), nom: 'oscillation', oscillation: 0.3, meche: 0.5 }
        ];
      },
      etude: { liquidite: true },
      attendu: { tendance: 'consolidation', liquidite: 'deux-cotes' },
      decision: {
        bonne: 'Aucune direction n\'est donnée : j\'attends la prise de liquidité (EQH/EQL) puis le BOS pour connaître le biais. Je ne trade pas l\'intérieur de la fourchette.',
        mauvaises: ['J\'achète au bas de la fourchette, c\'est un support.', 'Je vends au haut de la fourchette, c\'est une résistance.'],
        explication: 'Dans une consolidation, la liquidité s\'accumule au-dessus des hauts égaux et sous les bas égaux. C\'est la prise de cette liquidité, puis le BOS, qui donnent le biais directionnel.'
      }
    },
    piege: {
      nom: 'BOS piège (trap)',
      concept: 'bos',
      intention: 'Une cassure de haut ne tient pas : les big boyz ont piégé les acheteurs, puis la structure s\'inverse.',
      segments: function (rnd) {
        return [
          { dir: -1, pips: entre(rnd, 22, 28), bars: entier(rnd, 6, 9), nom: 'départ' },
          { dir: 1, pips: entre(rnd, 36, 44), bars: entier(rnd, 7, 10), nom: 'impulsion 1' },
          { dir: -1, pips: entre(rnd, 16, 22), bars: entier(rnd, 5, 8), nom: 'retracement' },
          { dir: 1, pips: entre(rnd, 26, 34), bars: entier(rnd, 6, 9), nom: 'impulsion 2' },
          { dir: -1, pips: entre(rnd, 10, 14), bars: entier(rnd, 4, 6), nom: 'repli court', oscillation: 0.35 },
          { dir: 1, pips: entre(rnd, 18, 24), bars: entier(rnd, 3, 5), nom: 'fausse cassure', oscillation: 0.3, meche: 0.6 },
          { dir: -1, pips: entre(rnd, 44, 56), bars: entier(rnd, 8, 11), nom: 'chute rapide' },
          { dir: 1, pips: entre(rnd, 12, 18), bars: entier(rnd, 5, 7), nom: 'rebond qui échoue' }
        ];
      },
      etude: { bosSegment: 5, zoneSegment: 6, zone: 'offre' },
      attendu: { tendance: 'baissiere', bos: 'piege' },
      decision: {
        bonne: 'La cassure n\'a pas tenu : c\'est un BOS piège. Je lis la structure de gauche à droite et j\'attends un vrai ChoCh confirmé avant toute position.',
        mauvaises: ['La cassure est validée : j\'achète pour suivre la tendance.', 'La chute est un simple repli : j\'achète plus bas, sans confirmation.'],
        explication: 'Le BOS piège est laissé par les big boyz : il attrape ceux qui ne lisent pas la structure de gauche à droite. Une cassure qui ne tient pas n\'est pas une cassure.'
      }
    },
    spring: {
      nom: 'Accumulation — SPRING (golden setup)',
      concept: 'wyckoff',
      intention: 'Fourchette d\'accumulation : le SPRING balaie la liquidité sous le bas, puis l\'effet se déroule à la hausse.',
      segments: function (rnd) {
        var haut = 100 + entre(rnd, 15, 19), bas = 100 - entre(rnd, 14, 18);
        return [
          { dir: 1, vers: 100 + entre(rnd, 7, 10), bars: entier(rnd, 5, 7), nom: 'PS — première tentative d\'arrêt de la baisse', oscillation: 0.35 },
          { dir: -1, vers: bas, bars: entier(rnd, 5, 7), nom: 'SC — point culminant des ventes' },
          { dir: 1, vers: haut, bars: entier(rnd, 5, 7), nom: 'AR — élargit la fourchette' },
          { dir: -1, vers: bas + entre(rnd, 1, 2), bars: entier(rnd, 4, 6), nom: 'ST — teste la demande', oscillation: 0.3, meche: 0.6 },
          { dir: 1, vers: haut - entre(rnd, 1, 2), bars: entier(rnd, 4, 6), nom: 'STB — reprend la liquidité du SC', oscillation: 0.3, meche: 0.6 },
          { dir: -1, vers: bas - entre(rnd, 7, 10), bars: entier(rnd, 3, 5), nom: 'SPRING — prend la liquidité du STB', oscillation: 0.3, meche: 0.8 },
          { dir: 1, pips: entre(rnd, 54, 64), bars: entier(rnd, 9, 12), nom: 'impulsion — sortie de fourchette' },
          { dir: -1, pips: entre(rnd, 5, 8), bars: entier(rnd, 5, 7), nom: 'retest qui tient au-dessus du haut', meche: 0.7 }
        ];
      },
      // La secousse doit sortir franchement sous les bas laissés par le SC (segment 1)
      // et le ST (segment 3) : c'est cette liquidité que le SPRING vient chercher.
      etude: { bosSegment: 6, zoneSegment: 6, zone: 'demande', evenement: 'SPRING', evenementSegment: 5, secousseReference: [1, 3] },
      attendu: { tendance: 'haussiere', bos: 'changement', evenement: 'SPRING' },
      decision: {
        bonne: 'Le SPRING a pris la liquidité sous la fourchette : j\'attends le retest de la zone de demande et j\'achète sur confirmation LTF, stop sous le plus bas du SPRING.',
        mauvaises: ['Le prix a cassé le bas de la fourchette : je vends la cassure.', 'J\'achète immédiatement, sans attendre le retest.'],
        explication: 'Golden setup (phase C de Wyckoff) : la cause s\'est construite en phase B (STB), la secousse de phase C (SPRING) balaie la liquidité, puis l\'effet se déroule. On prend position au retest, pas dans la secousse.'
      }
    },
    distribution: {
      nom: 'Distribution — UTAD',
      concept: 'wyckoff',
      intention: 'Fourchette de distribution : l\'UTAD balaie la liquidité au-dessus du haut, puis l\'effet se déroule à la baisse.',
      segments: function (rnd) {
        var haut = 100 + entre(rnd, 14, 18), bas = 100 - entre(rnd, 15, 19);
        return [
          { dir: -1, vers: 100 - entre(rnd, 7, 10), bars: entier(rnd, 5, 7), nom: 'PSY — première tentative d\'arrêt de la hausse', oscillation: 0.35 },
          { dir: 1, vers: haut, bars: entier(rnd, 5, 7), nom: 'BC — point culminant des achats' },
          { dir: -1, vers: bas, bars: entier(rnd, 5, 7), nom: 'AR — élargit la fourchette' },
          { dir: 1, vers: haut - entre(rnd, 1, 2), bars: entier(rnd, 4, 6), nom: 'ST — teste l\'offre', oscillation: 0.3, meche: 0.6 },
          { dir: -1, vers: bas + entre(rnd, 1, 2), bars: entier(rnd, 4, 6), nom: 'mSOW — reprend la liquidité du BC', oscillation: 0.3, meche: 0.6 },
          { dir: 1, vers: haut + entre(rnd, 7, 10), bars: entier(rnd, 3, 5), nom: 'UTAD — prend la liquidité du UT', oscillation: 0.3, meche: 0.8 },
          { dir: -1, pips: entre(rnd, 54, 64), bars: entier(rnd, 9, 12), nom: 'impulsion — sortie de fourchette' },
          { dir: 1, pips: entre(rnd, 5, 8), bars: entier(rnd, 5, 7), nom: 'retest qui tient sous le bas', meche: 0.7 }
        ];
      },
      // La secousse doit sortir franchement au-dessus des hauts laissés par le BC
      // (segment 1) et le ST (segment 3) : c'est cette liquidité que l'UTAD vient chercher.
      etude: { bosSegment: 6, zoneSegment: 6, zone: 'offre', evenement: 'UTAD', evenementSegment: 5, secousseReference: [1, 3] },
      attendu: { tendance: 'baissiere', bos: 'changement', evenement: 'UTAD' },
      decision: {
        bonne: 'L\'UTAD a pris la liquidité au-dessus de la fourchette : j\'attends le retest de la zone d\'offre et je vends sur confirmation LTF, stop au-dessus du plus haut de l\'UTAD.',
        mauvaises: ['Le prix a cassé le haut de la fourchette : j\'achète la cassure.', 'Je vends immédiatement, sans attendre le retest.'],
        explication: 'Distribution : la cause se construit en phase B (mSOW), l\'UTAD (phase C) balaie la liquidité au-dessus du haut, puis l\'effet vendeur se déroule.'
      }
    }
  };

  var CONCEPTS = {
    tendance: 'Lire la structure et en déduire la tendance',
    bos: 'Reconnaître la nature d\'une cassure de structure',
    zones: 'Identifier les zones d\'offre et de demande',
    liquidite: 'Repérer la liquidité (EQH/EQL, intacts)',
    wyckoff: 'Reconnaître le déroulé de Wyckoff (golden setup)',
    melange: 'Mélange de tous les concepts'
  };
  function listeModeles(concept) {
    var ids = Object.keys(MODELES);
    if (!concept || concept === 'melange') return ids;
    if (concept === 'zones') return ['hausse_continuation', 'baisse_continuation', 'spring', 'distribution'];
    if (concept === 'liquidite') return ['consolidation', 'spring', 'distribution', 'piege'];
    return ids.filter(function (id) { return MODELES[id].concept === concept; });
  }

  /* ---------------------------------------------------------
     5. Un scénario complet
     --------------------------------------------------------- */
  function scenario(modele, graine) {
    var id = MODELES[modele] ? modele : 'hausse_continuation';
    var g = (graine === undefined || graine === null) ? 1 : graine;
    var rnd = alea(g * 2654435761);
    var segments = MODELES[id].segments(rnd);
    var gen = genererBougies(segments, rnd, 100);
    var etude = MODELES[id].etude || {};
    var bos = etude.bosSegment !== undefined ? bosDuSegment(gen.bougies, gen.bascules, gen.plages[etude.bosSegment]) : null;
    var zone = etude.zoneSegment !== undefined ? zoneImpulsion(gen.bougies, gen.plages[etude.zoneSegment]) : null;
    var eq = niveauxEgaux(gen.bascules);

    var sc = {
      modele: id,
      nom: MODELES[id].nom,
      concept: MODELES[id].concept,
      graine: g,
      bougies: gen.bougies,
      bascules: gen.bascules,
      plages: gen.plages,
      sommets: gen.bascules.map(function (b) { return { i: b.i, sens: b.sens, prix: b.prix, nom: b.nom }; }),
      tendance: tendance(gen.bascules),
      bos: bos,
      bosNature: bos ? bos.nature : null,
      zone: zone,
      zoneType: zone ? zone.type : null,
      eqh: eq.filter(function (e) { return e.sens === 'haut'; }),
      eql: eq.filter(function (e) { return e.sens === 'bas'; }),
      intacts: intacts(gen.bougies, gen.bascules),
      evenement: etude.evenement || null,
      attendu: MODELES[id].attendu,
      decision: MODELES[id].decision,
      intention: MODELES[id].intention
    };
    sc.questions = composerQuestions(sc);
    return sc;
  }

  /* ---------------------------------------------------------
     6. Questions — les réponses viennent de l'analyse
     --------------------------------------------------------- */
  var LIBELLE_TENDANCE = {
    haussiere: 'Structure haussière (HH/HL)',
    baissiere: 'Structure baissière (LH/LL)',
    consolidation: 'Consolidation (fourchette)',
    incoherente: 'Structure incohérente (haut plus haut, bas plus bas)'
  };
  var LIBELLE_BOS = {
    continuation: 'BOS de continuation',
    changement: 'BOS classique — changement de tendance',
    piege: 'BOS piège (trap)'
  };
  var LIBELLE_EVENEMENT = {
    SPRING: 'SPRING (le mouvement qui prend la liquidité du STB, sous la fourchette)',
    UTAD: 'UTAD (le mouvement qui prend la liquidité du UT, au-dessus de la fourchette)'
  };

  function questionTendance(sc) {
    return {
      type: 'qcm', concept: 'tendance', reperes: 'structure',
      intitule: 'Quelle est la structure de ce graphique ?',
      choix: ['haussiere', 'baissiere', 'consolidation', 'incoherente'].map(function (k) { return { id: k, label: LIBELLE_TENDANCE[k] }; }),
      bonne: sc.tendance,
      explication: 'Lecture de gauche à droite : ' + resumeStructure(sc) + '. Tendance retenue : ' + (LIBELLE_TENDANCE[sc.tendance] || sc.tendance) + '.'
    };
  }
  function questionBos(sc) {
    if (!sc.bos) return null;
    return {
      type: 'qcm', concept: 'bos', reperes: 'bos',
      intitule: 'La cassure marquée par le trait pointillé : de quelle nature est-elle ?',
      choix: ['continuation', 'changement', 'piege'].map(function (k) { return { id: k, label: LIBELLE_BOS[k] }; }),
      bonne: sc.bos.nature,
      explication: sc.bos.nature === 'piege'
        ? 'Après cette cassure, ' + Math.round((1 - sc.bos.tenue) * 100) + ' % des clôtures reviennent de l\'autre côté du niveau : elle n\'a pas tenu. C\'est un piège laissé par les big boyz.'
        : sc.bos.nature === 'continuation'
          ? 'La cassure se fait dans le sens de la structure en place et le prix continue : BOS de continuation, on suit les 80 %.'
          : 'La cassure se fait contre la structure en place : le caractère change. On attend le retest de la zone pour trader dans le nouveau sens.'
    };
  }
  function questionZone(sc) {
    if (!sc.zone) return null;
    var type = sc.zone.type;
    return {
      type: 'zone', concept: 'zones', reperes: 'zone',
      intitule: 'Cliquez sur la zone ' + (type === 'demande' ? 'de demande' : 'd\'offre') + ' à l\'origine de la dernière impulsion.',
      bonne: sc.zone,
      explication: 'La zone ' + (type === 'demande' ? 'de demande' : 'd\'offre') + ' est délimitée par la bougie manipulatrice et la bougie qui prend l\'argent : ' +
        fmt(sc.zone.pmin) + ' – ' + fmt(sc.zone.pmax) + '. ' +
        (type === 'demande' ? 'Sur une demande on achète, au retour du prix dans la zone.' : 'Sur une offre on vend, au retour du prix dans la zone.')
    };
  }
  function questionEvenement(sc) {
    if (!sc.evenement) return null;
    var autres = sc.evenement === 'SPRING' ? ['STB', 'SC'] : ['UT', 'BC'];
    return {
      type: 'qcm', concept: 'wyckoff', reperes: 'evenement',
      intitule: 'Quel événement vient de balayer la liquidité et déclenche le mouvement ?',
      choix: [{ id: sc.evenement, label: LIBELLE_EVENEMENT[sc.evenement] }].concat(autres.map(function (a) {
        return { id: a, label: a + (sc.evenement === 'SPRING'
          ? (a === 'STB' ? ' (le mouvement qui reprend la liquidité du SC, dans la fourchette)' : ' (le point culminant des ventes, en début de fourchette)')
          : (a === 'UT' ? ' (la première prise de liquidité au-dessus du haut)' : ' (le point culminant des achats, en début de fourchette)')) };
      })),
      bonne: sc.evenement,
      explication: sc.evenement === 'SPRING'
        ? 'Le SPRING est le mouvement brutal qui vient prendre la liquidité laissée par le STB : c\'est la secousse de la phase C, celle qui précède l\'effet haussier. On prend position au test, pas dedans.'
        : 'L\'UTAD est le balayage final au-dessus de la fourchette : il prend la liquidité au-dessus du UT et marque la fin de la distribution. On vend au retest de la zone d\'offre.'
    };
  }
  function questionLiquidite(sc) {
    return {
      type: 'qcm', concept: 'liquidite', reperes: 'liquidite',
      intitule: 'Où se trouve la liquidité en attente sur cette fourchette ?',
      choix: [
        { id: 'deux-cotes', label: 'Des deux côtés : au-dessus des hauts égaux (EQH) et sous les bas égaux (EQL)' },
        { id: 'au-dessus', label: 'Uniquement au-dessus de la fourchette' },
        { id: 'aucune', label: 'Nulle part : une fourchette ne contient pas de liquidité' }
      ],
      bonne: (sc.eqh.length && sc.eql.length) ? 'deux-cotes' : (sc.eqh.length ? 'au-dessus' : 'aucune'),
      explication: 'Les hauts au même niveau (EQH) et les bas au même niveau (EQL) forment des lignes de liquidité : ' +
        sc.eqh.length + ' niveau(x) de hauts égaux et ' + sc.eql.length + ' niveau(x) de bas égaux détectés. ' +
        'Les stops s\'y accumulent, et c\'est cette liquidité que les big boyz viennent chercher avant de partir.'
    };
  }
  function questionDecision(sc) {
    var choix = [{ id: 'bonne', label: sc.decision.bonne }];
    sc.decision.mauvaises.forEach(function (m, k) { choix.push({ id: 'mauvaise' + (k + 1), label: m }); });
    return {
      type: 'qcm', concept: sc.concept, reperes: 'decision',
      intitule: 'Que faites-vous maintenant, selon le plan ?',
      choix: melanger(choix, sc.graine * 7 + 13),
      bonne: 'bonne',
      explication: sc.decision.explication
    };
  }

  function composerQuestions(sc) {
    var qs = [questionTendance(sc)];
    if (sc.evenement) qs.push(questionEvenement(sc));
    var qb = questionBos(sc);
    if (qb && !sc.evenement) qs.push(qb);
    if (sc.modele === 'consolidation') qs.push(questionLiquidite(sc));
    var qz = questionZone(sc);
    if (qz) qs.push(qz);
    qs.push(questionDecision(sc));
    return qs.filter(Boolean);
  }

  function melanger(liste, graine) {
    var rnd = alea((graine >>> 0) || 1);
    var copie = liste.slice();
    for (var i = copie.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = copie[i]; copie[i] = copie[j]; copie[j] = t;
    }
    return copie;
  }

  function resumeStructure(sc) {
    var h = sc.sommets.filter(function (s) { return s.sens === 'haut'; });
    var b = sc.sommets.filter(function (s) { return s.sens === 'bas'; });
    if (h.length < 2 || b.length < 2) return 'pas assez de sommets pour conclure';
    var h1 = h[h.length - 2].prix, h2 = h[h.length - 1].prix;
    var l1 = b[b.length - 2].prix, l2 = b[b.length - 1].prix;
    return 'dernier haut ' + fmt(h1) + ' puis ' + fmt(h2) + ' (' + compar(h2, h1) + '), ' +
      'dernier bas ' + fmt(l1) + ' puis ' + fmt(l2) + ' (' + compar(l2, l1) + ')';
  }
  function compar(a, b) {
    var tol = Math.max(Math.abs(a), Math.abs(b), 1) * 0.03;
    if (Math.abs(a - b) <= tol) return 'au même niveau';
    return a > b ? 'plus haut' : 'plus bas';
  }

  /* ---------------------------------------------------------
     7. Correction
     --------------------------------------------------------- */
  function corriger(question, reponse) {
    if (!question) return { correct: false, explication: 'Question inconnue.' };
    if (question.type === 'qcm') {
      var ok = reponse === question.bonne;
      var bonne = (question.choix.filter(function (c) { return c.id === question.bonne; })[0] || {}).label || question.bonne;
      return { correct: ok, explication: question.explication, bonneReponse: bonne };
    }
    var z = question.bonne;
    var dedans = !!reponse && reponse.prix >= z.pmin && reponse.prix <= z.pmax;
    return {
      correct: dedans,
      explication: question.explication,
      bonneReponse: fmt(z.pmin) + ' – ' + fmt(z.pmax),
      detail: dedans ? 'Bonne zone.' : 'Votre clic est en dehors de la zone' + (reponse ? ' (prix ' + fmt(reponse.prix) + ')' : '') + '.'
    };
  }

  /* ---------------------------------------------------------
     8. Rendu SVG
     --------------------------------------------------------- */
  var GEOM = { largeur: 720, hauteur: 340, margeG: 8, margeD: 62, margeH: 16, margeB: 26 };

  function echelle(sc) {
    var mini = Infinity, maxi = -Infinity;
    sc.bougies.forEach(function (b) { if (b.h > maxi) maxi = b.h; if (b.l < mini) mini = b.l; });
    [sc.zone].forEach(function (z) { if (z) { mini = Math.min(mini, z.pmin); maxi = Math.max(maxi, z.pmax); } });
    var marge = (maxi - mini) * 0.07;
    var pmin = mini - marge, pmax = maxi + marge;
    var pasX = (GEOM.largeur - GEOM.margeG - GEOM.margeD) / Math.max(1, sc.bougies.length - 1);
    return {
      pmin: pmin, pmax: pmax, pasX: pasX,
      x: function (i) { return GEOM.margeG + i * pasX; },
      y: function (p) { return GEOM.margeH + (pmax - p) / (pmax - pmin) * (GEOM.hauteur - GEOM.margeH - GEOM.margeB); },
      prix: function (y) { return pmax - (y - GEOM.margeH) / (GEOM.hauteur - GEOM.margeH - GEOM.margeB) * (pmax - pmin); },
      index: function (x) { return Math.round((x - GEOM.margeG) / pasX); }
    };
  }

  function rendreGraphique(sc, options) {
    options = options || {};
    var e = echelle(sc);
    var largeurBougie = Math.max(2, Math.min(9, e.pasX * 0.62));
    var p = [];

    var pas = (e.pmax - e.pmin) / 5;
    for (var k = 0; k <= 5; k++) {
      var prix = e.pmin + pas * k, y = e.y(prix);
      p.push('<line class="ent-grille" x1="' + GEOM.margeG + '" y1="' + y.toFixed(1) + '" x2="' + (GEOM.largeur - GEOM.margeD) + '" y2="' + y.toFixed(1) + '"/>');
      p.push('<text class="ent-axe" x="' + (GEOM.largeur - GEOM.margeD + 6) + '" y="' + (y + 3.5).toFixed(1) + '">' + fmt(prix) + '</text>');
    }

    sc.bougies.forEach(function (b, i) {
      var hausse = b.c >= b.o, x = e.x(i);
      var haut = e.y(Math.max(b.o, b.c)), bas = e.y(Math.min(b.o, b.c));
      p.push('<line class="ent-meche ' + (hausse ? 'haut' : 'bas') + '" x1="' + x.toFixed(1) + '" y1="' + e.y(b.h).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + e.y(b.l).toFixed(1) + '"/>');
      p.push('<rect class="ent-corps ' + (hausse ? 'haut' : 'bas') + '" x="' + (x - largeurBougie / 2).toFixed(1) + '" y="' + haut.toFixed(1) +
        '" width="' + largeurBougie.toFixed(1) + '" height="' + Math.max(1, bas - haut).toFixed(1) + '" rx="0.8"/>');
    });

    if (options.correction) {
      if (sc.zone) {
        var z = sc.zone;
        var x0 = e.x(z.i0) - largeurBougie, x1 = e.x(z.i1) + largeurBougie;
        var yT = e.y(z.pmax), yB = e.y(z.pmin);
        p.push('<rect class="ent-zone ' + z.type + '" x="' + x0.toFixed(1) + '" y="' + yT.toFixed(1) + '" width="' + Math.max(8, x1 - x0).toFixed(1) +
          '" height="' + Math.max(5, yB - yT).toFixed(1) + '" rx="2"/>');
        p.push('<text class="ent-etiquette zone" x="' + (x0 + 4).toFixed(1) + '" y="' + (yT - 5).toFixed(1) + '">' + (z.type === 'demande' ? 'DEMANDE' : 'OFFRE') + '</text>');
      }
      if (sc.bos) {
        var yb = e.y(sc.bos.niveau);
        p.push('<line class="ent-niveau bos" x1="' + e.x(sc.bos.ext).toFixed(1) + '" y1="' + yb.toFixed(1) + '" x2="' + e.x(sc.bougies.length - 1).toFixed(1) + '" y2="' + yb.toFixed(1) + '"/>');
        p.push('<text class="ent-etiquette bos" x="' + (e.x(sc.bos.ext) + 4).toFixed(1) + '" y="' + (yb - 6).toFixed(1) + '">' + (LIBELLE_BOS[sc.bos.nature] || 'BOS') + '</text>');
      }
      sc.sommets.forEach(function (s) {
        var y = e.y(s.prix) + (s.sens === 'haut' ? -7 : 14);
        p.push('<text class="ent-etiquette sommet" x="' + e.x(s.i).toFixed(1) + '" y="' + y.toFixed(1) + '">' + (s.sens === 'haut' ? 'H' : 'B') + '</text>');
      });
      sc.eqh.forEach(function (x) {
        p.push('<line class="ent-niveau eq" x1="' + e.x(x.indices[0]).toFixed(1) + '" y1="' + e.y(x.niveau).toFixed(1) + '" x2="' + e.x(x.indices[1]).toFixed(1) + '" y2="' + e.y(x.niveau).toFixed(1) + '"/>');
      });
      sc.eql.forEach(function (x) {
        p.push('<line class="ent-niveau eq" x1="' + e.x(x.indices[0]).toFixed(1) + '" y1="' + e.y(x.niveau).toFixed(1) + '" x2="' + e.x(x.indices[1]).toFixed(1) + '" y2="' + e.y(x.niveau).toFixed(1) + '"/>');
      });
    }

    if (options.clic) {
      var xc = e.x(options.clic.index), yc = e.y(options.clic.prix);
      p.push('<circle class="ent-clic" cx="' + xc.toFixed(1) + '" cy="' + yc.toFixed(1) + '" r="8"/>');
      p.push('<path class="ent-clic-croix" d="M' + (xc - 4).toFixed(1) + ' ' + yc.toFixed(1) + 'H' + (xc + 4).toFixed(1) +
        'M' + xc.toFixed(1) + ' ' + (yc - 4).toFixed(1) + 'V' + (yc + 4).toFixed(1) + '"/>');
    }

    return '<svg class="ent-graphique" viewBox="0 0 ' + GEOM.largeur + ' ' + GEOM.hauteur + '" preserveAspectRatio="none" role="img" ' +
      'aria-label="Graphique en bougies, ' + sc.bougies.length + ' unités de temps">' + p.join('') + '</svg>';
  }

  /** Convertit un clic écran en { index, prix } du graphique. */
  function clicVersPrix(sc, rect, clientX, clientY) {
    var e = echelle(sc);
    var x = (clientX - rect.left) / rect.width * GEOM.largeur;
    var y = (clientY - rect.top) / rect.height * GEOM.hauteur;
    return {
      index: Math.max(0, Math.min(sc.bougies.length - 1, e.index(x))),
      prix: e.prix(y)
    };
  }

  /** Où doit-on cliquer pour tomber juste ? (utilisé par la recette) */
  function centreZone(sc, rect) {
    var e = echelle(sc);
    var z = sc.zone;
    return {
      clientX: rect.left + ((e.x((z.i0 + z.i1) / 2)) / GEOM.largeur) * rect.width,
      clientY: rect.top + (e.y((z.pmin + z.pmax) / 2) / GEOM.hauteur) * rect.height
    };
  }

  global.Entraineur = {
    alea: alea,
    genererBougies: genererBougies,
    tendance: tendance,
    cassures: cassures,
    natureCassure: natureCassure,
    bosDuSegment: bosDuSegment,
    zoneImpulsion: zoneImpulsion,
    niveauxEgaux: niveauxEgaux,
    intacts: intacts,
    MODELES: MODELES,
    CONCEPTS: CONCEPTS,
    listeModeles: listeModeles,
    scenario: scenario,
    composerQuestions: composerQuestions,
    corriger: corriger,
    rendreGraphique: rendreGraphique,
    clicVersPrix: clicVersPrix,
    centreZone: centreZone,
    echelle: echelle,
    GEOM: GEOM,
    libelleTendance: LIBELLE_TENDANCE,
    libelleBos: LIBELLE_BOS,
    libelleEvenement: LIBELLE_EVENEMENT,
    resumeStructure: resumeStructure,
    fmt: fmt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Entraineur;
})(typeof window !== 'undefined' ? window : globalThis);
