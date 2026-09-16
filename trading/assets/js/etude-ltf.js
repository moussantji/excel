/* =========================================================
   etude-ltf.js — « J'attends la prise de liquidité, puis le ChoCh »

   La phrase de la routine (bloc 09 du plan) dépliée en basse unité de
   temps : 96 bougies de 15 minutes d'une même séance de l'or, le lundi
   14 septembre 2026, heure de Bamako. Deux séquences ressortent, une
   dans chaque sens — la première tombe dans la fenêtre de tir USA.

   Les cours sont réels (relevé figé, source citée dans
   etude-ltf-donnees.js). Le montage pédagogique (où placer l'entrée, le
   stop, la sortie) est ajouté, et il est recalculé par la recette
   tools/etude-ltf-test.js à partir des bougies. La page dit aussi quand
   le plan refuse le trade : une séquence juste ne suffit pas.

   API : window.EtudeLtf = { SEQUENCES, FENETRES, mesures, dessiner,
                             carte, cabler, donnees }
   ========================================================= */
'use strict';

(function (global) {
  var D = global.EtudeLtfDonnees || null;

  /* ---------------------------------------------------------
     Petits outils d'écriture
     --------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 4368.4 s'écrit « 4 368,4 » */
  function f1(v, d) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
    var n = Number(v).toFixed(d === undefined ? 1 : d).split('.');
    n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return n.join(',');
  }

  function prix(v) { return f1(v, 1); }

  /* « 13:15 » — les données sont en UTC, comme l'heure de Bamako */
  function heure(i) {
    if (!D || !D.serie || D.serie.t[i] === undefined) return '';
    var d = new Date(D.serie.t[i] * 1000);
    var h = d.getUTCHours(), mn = d.getUTCMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (mn < 10 ? '0' : '') + mn;
  }

  function euros(v) { return f1(v, 2) + '\u00a0$'; }

  /* ---------------------------------------------------------
     Les fenêtres de tir du plan (bloc 01) — mêmes horaires que plan.js
     --------------------------------------------------------- */
  var FENETRES = [
    { id: 'asie', nom: 'Asie', debut: '01:00', fin: '02:00' },
    { id: 'europe', nom: 'Europe', debut: '08:00', fin: '09:00' },
    { id: 'usa', nom: 'USA', debut: '13:00', fin: '14:00' }
  ];

  /* ---------------------------------------------------------
     Les deux séquences de la séance. Seuls les numéros de bougies sont
     écrits ici : tous les prix sont relus dans les données, puis
     revérifiés par la recette.
     --------------------------------------------------------- */
  var SEQUENCES = [
    {
      id: 'usa',
      titre: "Séquence 1 — l'achat, dans la fenêtre de tir USA",
      sens: 'achat',
      fenetre: 'USA',
      iBalayage: 52,      /* 13:00 : la mèche sous les plus bas du jour */
      iChoc: 53,          /* 13:15 : la clôture qui casse le dernier sommet */
      iSuite: 67,         /* 16:45 : le plus haut de la reprise, sortie */
      figureSerree: { debut: 49, fin: 59, min: 4286, max: 4340 },
      figureSuite: { debut: 51, fin: 71, min: 4286, max: 4366 }
    },
    {
      id: 'nuit',
      titre: 'Séquence 2 — la vente, hors des trois fenêtres',
      sens: 'vente',
      fenetre: null,
      iBalayage: 24,      /* 06:00 : la mèche au-dessus des hauts de la nuit */
      iChoc: 27,          /* 06:45 : la clôture qui casse le dernier plus bas */
      iSuite: 39,         /* 09:45 : le plus bas atteint, sortie */
      figureSerree: { debut: 22, fin: 30, min: 4352, max: 4386 },
      figureSuite: { debut: 22, fin: 48, min: 4310, max: 4386 }
    }
  ];

  /* ---------------------------------------------------------
     Ce que la séquence donne, chiffre par chiffre
     --------------------------------------------------------- */
  function mesures(sq) {
    if (!D || !D.serie || !sq) return null;
    var S = D.serie, i = sq.iBalayage, j = sq.iChoc, f = sq.iSuite;
    var achat = sq.sens === 'achat';
    var m = {
      sens: sq.sens,
      heureBalayage: heure(i), heureChoc: heure(j), heureSuite: heure(f),
      /* le niveau que le balayage est allé chercher : l'extrême des 12 bougies d'avant */
      niveauBalaye: achat ? Math.min.apply(null, S.l.slice(i - 12, i)) : Math.max.apply(null, S.h.slice(i - 12, i)),
      /* l'extrême opposé, formé juste avant le balayage : le sommet d'où la baisse est partie,
         ou le plancher d'où la hausse est partie */
      avantBalayage: achat ? Math.max.apply(null, S.h.slice(i - 6, i)) : Math.min.apply(null, S.l.slice(i - 6, i)),
      ouvertureBalayage: S.o[i], hautBalayage: S.h[i], basBalayage: S.l[i], clotureBalayage: S.c[i],
      /* l'extrême du balayage : le bas pour un achat, le haut pour une vente */
      extreme: achat ? S.l[i] : S.h[i],
      clotureChoc: S.c[j],
      /* le niveau cassé par le ChoCh : l'extrême formé depuis le balayage */
      casse: casse(sq, i, j, achat),
      entree: S.c[j],
      stop: achat ? S.l[i] : S.h[i],
      sortie: achat ? S.h[f] : S.l[f]
    };
    m.heureNiveauBalaye = heure(achat ? S.l.indexOf(m.niveauBalaye) : S.h.indexOf(m.niveauBalaye));
    m.risque = Math.abs(m.entree - m.stop);
    m.gain = Math.abs(m.sortie - m.entree);
    m.multiple = m.risque ? m.gain / m.risque : 0;
    /* le balayage, mesuré depuis le niveau attendu puis depuis l'entrée */
    m.depassement = Math.abs(m.extreme - m.niveauBalaye);
    m.distanceEntree = Math.abs(m.entree - m.extreme);
    /* ce que le plan exige : 1 % du capital sur un compte de 1 000 $ à 0,01 lot
       (1 point de l'or = 1 $ sur le plus petit lot du courtier) */
    m.coutStop = m.risque;
    m.partCapital = m.risque / 10;             /* en % d'un compte de 1 000 $ */
    m.capitalMinimum = m.risque * 100;         /* pour que le stop tienne dans 1 % */
    m.objectifUnSept = m.risque * 7;           /* le 1:7 du plan, en points */
    m.fenetre = sq.fenetre;
    return m;
  }

  function casse(sq, i, j, achat) {
    var S = D.serie, v = null;
    for (var k = i; k < j; k++) {
      var x = achat ? S.h[k] : S.l[k];
      if (v === null || (achat ? x > v : x < v)) v = x;
    }
    return v;
  }

  /* La séance entière, pour le premier graphique */
  function seance() {
    if (!D || !D.serie) return null;
    var S = D.serie, hauts = [], bas = [], i;
    for (i = 0; i < S.h.length; i++) if (S.c[i] !== null) { hauts.push(S.h[i]); bas.push(S.l[i]); }
    var haut = Math.max.apply(null, hauts), suivant = Math.min.apply(null, bas);
    return {
      haut: haut, heureHaut: heure(S.h.indexOf(haut)), bas: suivant, heureBas: heure(S.l.indexOf(suivant)),
      amplitude: haut - suivant, bougies: hauts.length, creneaux: S.t.length
    };
  }

  /* ---------------------------------------------------------
     Le retest — ce qui suit le ChoCh

     La règle, écrite en clair pour qu'elle soit vérifiable :
     - l'extrême du retest est le point le plus loin atteint à contresens
       entre la bougie du ChoCh et la reprise (le plus bas pour un achat,
       le plus haut pour une vente) ;
     - l'entrée au retest est la PREMIÈRE clôture qui repart du côté du
       ChoCh après que cet extrême est formé ;
     - le stop se pose derrière cet extrême : c'est tout l'intérêt du
       retest, il est plus serré que celui de la clôture du ChoCh ;
     - ce qui annule le ChoCh n'est pas le retour sur le niveau, mais une
       clôture au-delà de l'extrême du balayage.
     --------------------------------------------------------- */
  function retest(sq) {
    if (!D || !D.serie || !sq) return null;
    var S = D.serie, j = sq.iChoc, f = sq.iSuite, achat = sq.sens === 'achat';
    var niveau = casse(sq, sq.iBalayage, j, achat);
    var iExt = null, ext = null, iEntree = null, k, x, c;
    for (k = j + 1; k <= f; k++) {
      x = achat ? S.l[k] : S.h[k];
      if (ext === null || (achat ? x < ext : x > ext)) { ext = x; iExt = k; }
      c = S.c[k];
      /* la clôture repart du côté du ChoCh, une fois l'extrême du retest formé */
      if (c !== null && iExt < k && (achat ? c > niveau : c < niveau)) { iEntree = k; break; }
    }
    if (iExt === null || iEntree === null) return null;
    var entree = S.c[iEntree];
    var sortie = achat ? S.h[f] : S.l[f];
    var risque = Math.abs(entree - ext);
    var gain = Math.abs(sortie - entree);
    /* l'ordre posé sur le niveau cassé : rempli si le retest est allé jusque-là */
    var extremeRetest = achat ? Math.min.apply(null, S.l.slice(j + 1, iEntree + 1))
                              : Math.max.apply(null, S.h.slice(j + 1, iEntree + 1));
    var atteint = achat ? (extremeRetest <= niveau) : (extremeRetest >= niveau);
    var ecart = achat ? (niveau - extremeRetest) : (extremeRetest - niveau);   /* positif = le niveau est dépassé */
    var risqueNiveau = Math.abs(niveau - ext);
    var r = {
      sens: sq.sens, achat: achat, niveau: niveau,
      iBalayage: sq.iBalayage, iChoc: j, iExt: iExt, iEntree: iEntree, iSuite: f,
      ext: ext, heureExt: heure(iExt),
      entree: entree, heureEntree: heure(iEntree),
      sortie: sortie, heureSortie: heure(f),
      risque: risque, gain: gain, multiple: risque ? gain / risque : 0,
      /* ce que le stop coûte au plus petit lot (1 point = 1 $ sur 0,01 lot d'or) */
      cout: risque, partCapital: risque / 10, capitalMinimum: risque * 100,
      /* la variante « ordre posé sur le niveau cassé » */
      atteint: atteint, ecartNiveau: Math.abs(ecart), depasse: ecart >= 0,
      entreeNiveau: niveau, risqueNiveau: risqueNiveau,
      multipleNiveau: risqueNiveau ? Math.abs(sortie - niveau) / risqueNiveau : 0,
      partCapitalNiveau: risqueNiveau / 10, capitalMinimumNiveau: risqueNiveau * 100,
      /* le retest, mesuré : de combien le prix est revenu vers le niveau */
      profondeur: Math.abs((achat ? S.c[j] : S.c[j]) - ext),
      /* ce qui aurait annulé la lecture : une clôture au-delà de l'extrême du balayage */
      iInvalidation: (function () {
        for (var m = j + 1; m <= f; m++) {
          if (S.c[m] === null) continue;
          if (achat ? S.c[m] < S.l[sq.iBalayage] : S.c[m] > S.h[sq.iBalayage]) return m;
        }
        return null;
      })(),
      CLOTURE_MIN: 15   /* la règle du plan : 15 points de stop maximum */
    };
    r.tientQuinze = r.risque <= r.CLOTURE_MIN;
    r.tientQuinzeNiveau = r.risqueNiveau <= r.CLOTURE_MIN;
    r.tientUnPourcent = r.partCapital <= 1 + 1e-9;
    return r;
  }

  /* ---------------------------------------------------------
     Les figures : un appel au dessinateur de l'étude de cas, une légende
     --------------------------------------------------------- */
  function figure(svg, legende) {
    return '<figure class="etude-figure">' + svg + '<figcaption>' + legende + '</figcaption></figure>';
  }

  function dessiner() {
    return (global.EtudeOr && global.EtudeOr.dessiner) ? global.EtudeOr.dessiner.apply(null, arguments) : '';
  }

  function figures() {
    var S = D.serie;
    var m1 = mesures(SEQUENCES[0]), m2 = mesures(SEQUENCES[1]);
    var se = seance();
    var h = '';

    /* --- la journée entière, avec les trois fenêtres de tir --- */
    h += figure(dessiner(S, {
      largeur: 640, hauteur: 320, min: 4280, max: 4418,
      aria: "Bougies de 15 minutes de l'or, lundi 14 septembre 2026, avec les trois fenêtres de tir",
      bandes: [
        { debut: 4, fin: 8, texte: 'Asie', ton: 'bleu' },
        { debut: 32, fin: 36, texte: 'Europe', ton: 'bleu' },
        { debut: 52, fin: 56, texte: 'USA', ton: 'bleu' }
      ],
      niveaux: [
        { prix: se.haut, texte: prix(se.haut) + ' — le plus haut', ton: 'or' },
        { prix: se.bas, texte: prix(se.bas) + ' — le plus bas', ton: 'bleu' }
      ],
      reperes: [
        { i: 10, num: '1', place: 'haut', texte: 'balayage', aDroite: true },
        { i: 24, num: '2', place: 'bas', texte: 'balayage', aDroite: true },
        { i: 52, num: '3', place: 'bas', texte: 'balayage' }
      ]
    }), 'Les 96 bougies de 15 minutes de la séance, de 00:00 à 23:45. Les trois bandes sont les fenêtres de tir du ' +
      'plan : Asie 1h–2h, Europe 8h–9h, USA 13h–14h. Les quatre trous de 21:00 à 21:45 sont l\'interruption de ' +
      'cotation : ils sont sautés, pas inventés. Les trois repères marquent les trois balayages de la journée : ' +
      'le plus haut de la nuit à 02:30 (4 396,8), les hauts de la fin de nuit à 06:00 (4 379,3) et les plus bas du ' +
      'jour à 13:00 (4 293,0) — celle-ci dans la fenêtre USA.');

    /* --- séquence 1 : la prise de liquidité du plus bas, puis le ChoCh --- */
    h += figure(dessiner(S, {
      debut: SEQUENCES[0].figureSerree.debut, fin: SEQUENCES[0].figureSerree.fin,
      min: SEQUENCES[0].figureSerree.min, max: SEQUENCES[0].figureSerree.max,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 12:15 à 14:30, avec la prise de liquidité de 13:00 et le ChoCh de 13:15",
      zones: [{ de: m1.extreme, a: m1.casse, debut: 52, fin: 54, texte: 'la liquidité prise', ton: 'or' }],
      niveaux: [
        { prix: m1.niveauBalaye, texte: prix(m1.niveauBalaye) + ' — les plus bas du jour', ton: 'bleu' },
        { prix: m1.casse, texte: prix(m1.casse) + ' — le sommet cassé', ton: 'or' }
      ],
      reperes: [
        { i: 52, num: '1', place: 'haut', texte: 'le balayage', decalage: 18 },
        { i: 53, num: '2', place: 'haut', texte: 'le ChoCh' }
      ],
      trade: { entree: m1.entree, stop: m1.stop, cible: null, depuis: 53, jusqua: 58 }
    }), '12:15 à 14:30. À ' + m1.heureBalayage + ', la mèche descend à <b>' + prix(m1.extreme) + '</b>, soit ' +
      f1(m1.depassement) + ' points sous le plus bas de ' + m1.heureNiveauBalaye + ' (' + prix(m1.niveauBalaye) + ') ; la bougie clôture à ' +
      prix(m1.clotureBalayage) + ' : la liquidité est prise, puis rendue. À 13:15, la clôture de ' +
      prix(m1.clotureChoc) + ' dépasse le sommet laissé par la bougie de balayage (' + prix(m1.casse) +
      ') : c\'est le ChoCh. L\'entrée se prend sur cette clôture, le stop derrière le balayage, à ' + prix(m1.stop) +
      ' — ' + f1(m1.risque) + ' points de risque.');

    /* --- séquence 1 : ce que la suite a donné --- */
    h += figure(dessiner(S, {
      debut: SEQUENCES[0].figureSuite.debut, fin: SEQUENCES[0].figureSuite.fin,
      min: SEQUENCES[0].figureSuite.min, max: SEQUENCES[0].figureSuite.max,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 12:45 à 17:30, avec la sortie à 4358,9",
      niveaux: [{ prix: m1.avantBalayage, texte: prix(m1.avantBalayage) + ' — le sommet d\'avant la chute', ton: 'bleu' }],
      reperes: [{ i: 52, num: '1', place: 'bas', texte: 'le plus bas du jour' }],
      trade: { entree: m1.entree, stop: m1.stop, cible: m1.sortie, depuis: 53, jusqua: 67,
        texteCible: 'sortie ' }
    }), '12:45 à 17:30. Le premier obstacle était le sommet d\'avant la chute (' + prix(m1.avantBalayage) +
      '), repris dans l\'après-midi ; la reprise s\'arrête à <b>' + prix(m1.sortie) + '</b> à ' + m1.heureSuite + ', soit ' +
      f1(m1.gain) + ' points et <b>' + f1(m1.multiple) + ' fois le risque</b>. C\'est ce que la séquence donne ' +
      'quand elle est prise au bon endroit — et c\'est aussi tout ce qu\'elle a donné ce jour-là.');

    /* --- séquence 2 : la même mécanique, à la vente --- */
    h += figure(dessiner(S, {
      debut: SEQUENCES[1].figureSerree.debut, fin: SEQUENCES[1].figureSerree.fin,
      min: SEQUENCES[1].figureSerree.min, max: SEQUENCES[1].figureSerree.max,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 05:30 à 07:15, avec le balayage de 06:00 et le ChoCh de 06:45",
      zones: [{ de: m2.casse, a: m2.extreme, debut: 24, fin: 26 }],
      niveaux: [
        { prix: m2.niveauBalaye, texte: prix(m2.niveauBalaye) + ' — les hauts depuis 04:00', ton: 'bleu' },
        { prix: m2.casse, texte: prix(m2.casse) + ' — le dernier plus bas', ton: 'or' }
      ],
      reperes: [
        { i: 24, num: '1', place: 'haut', texte: 'le balayage', decalage: 18 },
        { i: 27, num: '2', place: 'bas', texte: 'le ChoCh' }
      ],
      trade: { entree: m2.entree, stop: m2.stop, cible: null, depuis: 27, jusqua: 29 }
    }), '05:30 à 07:15. À 06:00, la mèche monte à <b>' + prix(m2.extreme) + '</b>, au-dessus de tous les hauts ' +
      'depuis 04:00 (' + prix(m2.niveauBalaye) + ') ; la bougie clôture à ' + prix(m2.clotureBalayage) +
      '. Les sommets suivants sont plus bas (4 373,0 puis 4 372,9). À 06:45, la clôture de ' + prix(m2.clotureChoc) +
      ' casse le dernier plus bas (' + prix(m2.casse) + ') : c\'est le ChoCh, cette fois à la vente. Entrée ' +
      prix(m2.entree) + ', stop derrière le balayage à ' + prix(m2.stop) + ' — ' + f1(m2.risque) + ' points.');

    /* --- séquence 2 : la baisse qui suit --- */
    h += figure(dessiner(S, {
      debut: SEQUENCES[1].figureSuite.debut, fin: SEQUENCES[1].figureSuite.fin,
      min: SEQUENCES[1].figureSuite.min, max: SEQUENCES[1].figureSuite.max,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 05:30 à 11:45, avec la baisse jusqu'à 4317,3",
      reperes: [{ i: 27, num: '2', place: 'bas', texte: 'le ChoCh' }],
      trade: { entree: m2.entree, stop: m2.stop, cible: m2.sortie, depuis: 27, jusqua: 39,
        texteCible: 'sortie ' }
    }), '05:30 à 11:45. La baisse casse le plancher d\'avant le balayage (' + prix(m2.avantBalayage) +
      ') et descend jusqu\'à <b>' + prix(m2.sortie) + '</b> à ' + m2.heureSuite + ', soit ' +
      f1(m2.gain) + ' points et <b>' + f1(m2.multiple) + ' fois le risque</b> en trois heures. Elle continue ' +
      'ensuite jusqu\'au plus bas de la séance, 4 293,0 à 13:00 — mais la bougie de 13:00 est celle de la ' +
      'séquence 1 : le marché a pris les deux côtés dans la même journée.');

    return h;
  }

  /* ---------------------------------------------------------
     Les figures du retest
     --------------------------------------------------------- */
  function figuresRetest(m1, m2, r1, r2) {
    var S = D.serie;
    var h = '';

    /* --- séquence 1 : le retest est allé jusque dans la zone --- */
    h += figure(dessiner(S, {
      debut: 51, fin: 62, min: 4296, max: 4334,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 12:45 à 15:30, avec le retour du prix sur le niveau cassé par le ChoCh",
      zones: [{ de: m1.extreme, a: r1.niveau, debut: 52, fin: 58, texte: 'la zone du balayage', ton: 'or' }],
      niveaux: [
        { prix: r1.niveau, texte: prix(r1.niveau) + ' — le niveau cassé', ton: 'or' },
        { prix: r1.ext, texte: prix(r1.ext) + ' — le point bas du retest', ton: 'bleu' }
      ],
      reperes: [
        { i: 57, num: '3', place: 'bas', texte: 'le retest' },
        { i: 58, num: '4', place: 'haut', texte: 'la reprise' }
      ],
      trade: { entree: r1.entree, stop: r1.ext, cible: null, depuis: 58, jusqua: 62 }
    }), '12:45 à 15:30 — le retest de la séquence 1. Le ChoCh a cassé ' + prix(r1.niveau) + ' à 13:15 ; le prix ' +
      'revient sur ce niveau dès 13:45 (bas à 4 309,5), puis descend jusqu\'à <b>' + prix(r1.ext) + '</b> à ' +
      r1.heureExt + ' — 9,2 points sous le niveau cassé, et toujours au-dessus du balayage de 4 293,0. La reprise ' +
      'repasse au-dessus du niveau à ' + r1.heureEntree + ' (clôture de ' + prix(r1.entree) + ') : c\'est l\'entrée ' +
      'au retest, et le stop se pose derrière le point bas, à ' + prix(r1.ext) + ' — <b>' + f1(r1.risque) +
      ' points</b> au lieu de ' + f1(m1.risque) + '. Un ordre posé sur le niveau cassé (' + prix(r1.niveau) +
      ') aurait été rempli pendant ce retour : ' + f1(r1.risqueNiveau) + ' points de risque seulement.');

    /* --- séquence 2 : le retest s'arrête juste avant le niveau --- */
    h += figure(dessiner(S, {
      debut: 26, fin: 40, min: 4310, max: 4374,
      largeur: 640, hauteur: 300,
      aria: "Bougies de 15 minutes du 14 septembre 2026 de 06:30 à 10:00, avec le rejet sous le niveau cassé par le ChoCh",
      /* une seule ligne de niveau : le rejet est matérialisé par la ligne du stop */
      niveaux: [
        { prix: r2.niveau, texte: prix(r2.niveau) + ' — le niveau cassé', ton: 'or' }
      ],
      reperes: [
        { i: 28, num: '3', place: 'haut', texte: 'le rejet', decalage: 18 },
        { i: 29, num: '4', place: 'bas', texte: 'la reprise' }
      ],
      trade: { entree: r2.entree, stop: r2.ext, cible: null, depuis: 29, jusqua: 40 }
    }), '06:30 à 10:00 — le retest de la séquence 2. Le ChoCh a cassé ' + prix(r2.niveau) + ' à 06:45 ; le prix ' +
      'remonte, mais <b>s\'arrête ' + f1(r2.ecartNiveau) + ' point sous le niveau</b> (' + prix(r2.ext) + ' à ' +
      r2.heureExt + ', puis 4 364,4) : un ordre posé sur le niveau cassé n\'aurait <b>jamais été rempli</b>. ' +
      'La clôture qui repart à la baisse est celle de ' + r2.heureEntree + ' (' + prix(r2.entree) + ') ; le stop ' +
      'se pose au-dessus du rejet, à ' + prix(r2.ext) + ' — <b>' + f1(r2.risque) + ' points</b> au lieu de ' +
      f1(m2.risque) + '. La baisse reprend ensuite sans jamais revenir sur le niveau.');

    return h;
  }

  /* ---------------------------------------------------------
     Le même trade, deux entrées : le tableau
     --------------------------------------------------------- */
  function linge(titre, entree, stop, risque, tientQuinze, partCapital, capital, multiple) {
    return '<tr><td>' + esc(titre) + '</td><td>' + prix(entree) + '</td><td>' + prix(stop) + '</td>' +
      '<td>' + f1(risque) + ' pts</td>' +
      '<td class="' + (tientQuinze ? 'pos' : 'neg') + '">' + (tientQuinze ? 'oui' : 'non, au-delà') + '</td>' +
      '<td>' + f1(partCapital, 2) + ' %</td><td>' + f1(capital, 0) + ' $</td>' +
      '<td>' + f1(multiple) + ' fois le risque</td></tr>';
  }

  function tableauRetest(m1, m2, r1, r2) {
    return '<div class="etude-tableau"><table><thead><tr><th>Entrée</th><th>Prix</th><th>Stop</th><th>Risque</th>' +
      '<th>Règle des 15 points</th><th>Sur 1 000 $ (0,01 lot)</th><th>Capital pour 1 %</th><th>Ce que ça a donné</th>' +
      '</tr></thead><tbody>' +
      linge('Séquence 1 — clôture du ChoCh', m1.entree, m1.stop, m1.risque, m1.risque <= 15, m1.partCapital, m1.capitalMinimum, m1.multiple) +
      linge('Séquence 1 — au retest', r1.entree, r1.ext, r1.risque, r1.tientQuinze, r1.partCapital, r1.capitalMinimum, r1.multiple) +
      linge('Séquence 2 — clôture du ChoCh', m2.entree, m2.stop, m2.risque, m2.risque <= 15, m2.partCapital, m2.capitalMinimum, m2.multiple) +
      linge('Séquence 2 — au retest', r2.entree, r2.ext, r2.risque, r2.tientQuinze, r2.partCapital, r2.capitalMinimum, r2.multiple) +
      '</tbody></table></div>';
  }

  /* ---------------------------------------------------------
     La section : comprendre le ChoCh, puis le retest
     --------------------------------------------------------- */
  function sectionRetest(m1, m2, r1, r2) {
    var h = '';
    h += '<h4 class="etude-titre">2. Comprendre : le ChoCh, puis le retest</h4>';
    h += '<p>Le ChoCh n\'est pas un signal d\'entrée, c\'est un constat : la première clôture qui casse le dernier ' +
      'extrême formé depuis la bougie de balayage. Une mèche qui dépasse ne suffit pas — il faut la clôture — et le ' +
      'constat dit seulement que <b>la structure locale a changé de caractère</b> : le marché ne fait plus de plus ' +
      'hauts descendants, ou plus de plus bas montants. Il ne dit pas que le prix est au bon prix. Le plan est précis ' +
      'là-dessus : « j\'entre au retest de la zone avec un stop serré ». Le <b>retest</b>, c\'est le retour du prix ' +
      'sur le niveau qu\'il vient de casser : c\'est ce retour qui rend le stop petit, et rien d\'autre.</p>';

    h += '<ol class="etude-etapes">' +
      '<li><b>Je note le niveau cassé.</b> ' + prix(r1.niveau) + ' pour l\'achat, ' + prix(r2.niveau) + ' pour la ' +
      'vente : c\'est le dernier extrême formé avant la clôture du ChoCh. Tout se mesure par rapport à lui.</li>' +
      '<li><b>Je ne cours pas après la bougie.</b> Je pose mon ordre <i>sur ce niveau</i>. Sur la première séquence, ' +
      'le prix revient jusque dans la zone du balayage (' + prix(r1.ext) + ' à ' + r1.heureExt + ') : l\'ordre est ' +
      'rempli, et le stop derrière ce point bas ne fait plus que ' + f1(r1.risqueNiveau) + ' points au lieu de ' +
      f1(m1.risque) + '.</li>' +
      '<li><b>Si le niveau n\'est pas touché, j\'attends la clôture qui repart.</b> Sur la deuxième séquence, le ' +
      'prix monte jusqu\'à ' + prix(r2.ext) + ' — ' + f1(r2.ecartNiveau) + ' point sous le niveau — puis repart : ' +
      'l\'ordre posé sur le niveau n\'aurait jamais été rempli. L\'entrée est alors la clôture de ' + r2.heureEntree +
      ' à ' + prix(r2.entree) + ', stop derrière le rejet : ' + f1(r2.risque) + ' points.</li>' +
      '<li><b>Ce qui annule le ChoCh n\'est pas le retour sur le niveau</b>, mais une clôture de l\'autre côté de ' +
      '<b>l\'extrême du balayage</b> : sous ' + prix(m1.extreme) + ' à l\'achat, au-dessus de ' + prix(m2.extreme) +
      ' à la vente. Sur cette séance, aucune des deux n\'est arrivée : les deux lectures ont tenu jusqu\'à la sortie.' +
      '</li></ol>';

    h += figuresRetest(m1, m2, r1, r2);

    h += '<h4 class="etude-titre">Le même trade, deux entrées</h4>';
    h += tableauRetest(m1, m2, r1, r2);
    h += '<p class="etude-note">Lecture du tableau : au retest, la distance entre l\'entrée et le stop tombe de ' +
      f1(m1.risque) + ' à ' + f1(r1.risque) + ' points sur la première séquence et de ' + f1(m2.risque) + ' à ' +
      f1(r2.risque) + ' sur la seconde. Les deux stops passent alors sous les 15 points que le plan exige, ce ' +
      'qu\'aucune des deux entrées sur la clôture du ChoCh ne respectait. Sur la deuxième séquence, le risque ' +
      'passe même sous 1 % d\'un compte de 1 000 $ (' + f1(r2.partCapital, 2) + ' %, soit ' + f1(r2.capitalMinimum, 0) +
      ' $ de capital nécessaire). En posant l\'ordre sur le niveau, la première séquence descend à ' +
      f1(r1.risqueNiveau) + ' points et ' + f1(r1.partCapitalNiveau, 2) + ' % du capital — mais ce n\'est possible ' +
      'que quand le prix revient <i>jusque-là</i>, et il ne le fait pas toujours.</p>';

    h += '<div class="etude-verdict"><b>Ce que le retest change, et ce qu\'il ne change pas.</b> Il resserre le ' +
      'stop (' + f1(m2.risque / r2.risque) + ' fois plus petit sur la seconde séquence), il fait rentrer les deux séquences dans la règle ' +
      'des 15 points, et il fait passer le risque de la seconde sous le 1 %. Il ne fabrique pas un trade pour autant : ' +
      'aucune des deux n\'atteint le 1:7 du plan (' + f1(r1.multiple) + ' et ' + f1(r2.multiple) + ' fois le risque ' +
      'au mieux), et la séquence 2 reste hors des fenêtres de tir. Et il n\'est jamais garanti : quand le prix part ' +
      'sans revenir, il ne reste que la première entrée, la plus large — ou le renoncement. C\'est ce qui est écrit ' +
      'dans le plan : je regarde le retest, je ne l\'exige pas.</div>';
    return h;
  }

  /* ---------------------------------------------------------
     Le tableau de la checklist du plan, appliqué à une séquence
     --------------------------------------------------------- */
  function checklistHTML(m) {
    var lignes = [
      {
        regle: 'Dans une fenêtre de tir', exige: 'Asie 1h–2h · Europe 8h–9h · USA 13h–14h',
        ok: !!m.fenetre,
        fait: m.fenetre ? ('oui — le déclenchement est à ' + m.heureChoc + ', dans la fenêtre ' + m.fenetre)
          : ('non — ' + m.heureChoc + ' tombe entre la fenêtre asie et la fenêtre Europe')
      },
      {
        regle: 'Prise de liquidité effectuée', exige: 'une mèche hors du niveau que le marché surveille',
        ok: true,
        fait: (m.sens === 'achat' ? 'oui — ' + prix(m.extreme) + ' sous ' : 'oui — ' + prix(m.extreme) + ' au-dessus de ') +
          prix(m.niveauBalaye) + ' (' + f1(m.depassement) + ' points)'
      },
      {
        regle: 'ChoCh confirmé en LTF', exige: 'une clôture qui casse le dernier extrême',
        ok: true,
        fait: 'oui — clôture de ' + m.heureChoc + ' à ' + prix(m.clotureChoc) +
          (m.sens === 'achat' ? ' au-dessus de ' : ' sous ') + prix(m.casse)
      },
      {
        regle: "Stop placé avant l'entrée", exige: 'derrière l\'extrême du balayage, jamais élargi',
        ok: true,
        fait: 'oui — ' + prix(m.stop) + ', ' + f1(m.risque) + ' points de risque'
      },
      {
        regle: 'Taille pour 1 % du capital', exige: 'le plus petit lot doit tenir dans 1 % du compte',
        ok: false,
        fait: 'non — ' + f1(m.risque) + ' points coûtent ' + euros(m.coutStop) + ' sur un compte de 1 000 $ en 0,01 lot, ' +
          'soit ' + f1(m.partCapital) + ' % ; il faudrait ' + f1(m.capitalMinimum, 0) + ' $'
      },
      {
        regle: 'Ratio minimum 1:7 vérifié', exige: f1(m.objectifUnSept, 0) + ' points de potentiel pour ce stop',
        ok: false,
        fait: 'non — la séquence a donné ' + f1(m.multiple) + ' fois le risque'
      }
    ];
    var h = '<div class="etude-tableau"><table><thead><tr><th>Règle du plan</th><th>Ce qu\'elle exige</th>' +
      '<th>Cette séquence</th><th></th></tr></thead><tbody>';
    lignes.forEach(function (l) {
      h += '<tr><td>' + esc(l.regle) + '</td><td class="doux">' + esc(l.exige) + '</td><td>' + esc(l.fait) + '</td>' +
        '<td class="' + (l.ok ? 'etude-oui' : 'etude-non') + '">' + (l.ok ? 'ok' : 'non') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function reussies(m) {
    return checklistHTML(m).split('etude-oui').length - 1;
  }

  /* ---------------------------------------------------------
     La carte complète
     --------------------------------------------------------- */
  function carte(App) {
    if (!D || !D.serie || !global.EtudeOr || !global.EtudeOr.dessiner) {
      return '<section class="card form-card etude" id="etudeLtf"><header class="card-head">' +
        '<h3>En basse unité de temps — la prise de liquidité, puis le ChoCh</h3></header>' +
        '<div class="card-body"><p class="muted">Les cours encodés sont introuvables : rechargez la page.</p>' +
        '</div></section>';
    }
    var m1 = mesures(SEQUENCES[0]), m2 = mesures(SEQUENCES[1]);
    var se = seance();
    var S1 = SEQUENCES[0], S2 = SEQUENCES[1];
    var h = '';

    h += '<section class="card form-card etude" id="etudeLtf">' +
      '<header class="card-head"><h3>En basse unité de temps — attendre la prise de liquidité, puis le ChoCh</h3>' +
      '<div class="card-tools">' +
      (App && global.Graphe ? '<button type="button" class="btn ghost small" id="ltfOuvrirQuinze">Ouvrir l\'or en 15 minutes</button>' : '') +
      '</div></header><div class="card-body">';

    h += '<p class="etude-chapeau">La routine du plan dit, au moment de la séance : « J\'attends la prise de ' +
      'liquidité, puis le ChoCh en LTF. Sans les deux, je ne fais rien. » Voici cette phrase en bougies de ' +
      '15 minutes, sur une seule séance réelle : l\'or, le lundi ' + esc(D.jour) + ', ' + se.creneaux +
      ' créneaux de 15 minutes (dont ' + se.bougies + ' bougies cotées), de 00:00 à 23:45 (heure de Bamako). ' +
      'Tout est dessiné par l\'application à partir des cours ' +
      'encodés : aucun téléchargement, aucune image, l\'exemple s\'affiche et s\'imprime hors ligne.</p>';

    /* ---------- 1. les quatre temps ---------- */
    h += '<h4 class="etude-titre">1. Ce que « en LTF » veut dire, en quatre temps</h4>';
    h += '<ol class="etude-etapes">' +
      '<li><b>La liquidité est prise.</b> Une mèche dépasse le niveau que tout le monde regarde — un plus haut de ' +
      'séance, un plus bas du jour, deux sommets égaux — puis la bougie clôture de l\'autre côté. Le marché est ' +
      'allé chercher les stops posés derrière ce niveau.</li>' +
      '<li><b>Le dernier extrême tombe.</b> Après le balayage, le prix laisse un petit plus haut (pour une vente) ' +
      'ou un petit plus bas (pour un achat). Ce n\'est pas encore une cassure de structure : c\'est le point de ' +
      'référence.</li>' +
      '<li><b>Le ChoCh est confirmé.</b> Une clôture casse ce dernier extrême. Là, et seulement là, la structure ' +
      'locale change de caractère : le marché ne monte plus, il descend (ou l\'inverse). C\'est un constat, pas un ' +
      'signal d\'entrée — le prix peut être très loin du niveau qu\'on vient de casser.</li>' +
      '<li><b>L\'entrée et le stop.</b> Deux entrées, dans cet ordre : <b>le retest</b> du niveau cassé quand il ' +
      'vient (c\'est là que le stop est le plus serré), sinon la clôture du ChoCh elle-même, avec le stop derrière ' +
      'l\'extrême du balayage — jamais sur la mèche. Le stop se place avant de cliquer, jamais après.</li></ol>';
    h += '<p>Deux séquences ressortent sur cette séance, une dans chaque sens. La première est dans la fenêtre de ' +
      'tir USA, la seconde tombe dans un creux d\'horaires : les deux sont dépliées, et les deux passent au ' +
      'crible de la checklist du plan.</p>';

    /* ---------- 2. comprendre le ChoCh, puis le retest ---------- */
    var r1 = retest(S1), r2 = retest(S2);
    if (r1 && r2) h += sectionRetest(m1, m2, r1, r2);

    /* ---------- 3. la journée ---------- */
    h += '<h4 class="etude-titre">3. La séance entière, du haut de la nuit au bas de la fenêtre USA</h4>';
    h += figures();
    h += '<p>La séance tient dans <b>' + f1(se.amplitude) + ' points</b> : un plus haut à ' + se.heureHaut +
      ' (' + prix(se.haut) + '), un plus bas à ' + se.heureBas + ' (' + prix(se.bas) + ') — 12,7 points sous les ' +
      'plus bas du jour, et pile dans la fenêtre de tir USA. Le chiffre rond des 4 300 a été touché pendant la ' +
      'descente ; la clôture de la veille était plus haut, à ' + prix(D.cloturePrecedente) + '.</p>';

    /* ---------- 3. séquence 1 ---------- */
    h += '<h4 class="etude-titre">4. ' + esc(S1.titre) + '</h4>';
    h += '<div class="etude-carnet"><div class="etude-carnet-tete">Mon carnet, lundi 14 septembre, ' +
      m1.heureBalayage + '</div><ul class="etude-liste">' +
      '<li>Ce que je vois : la séance a fait son plus haut à 02:30, puis elle glisse depuis 09:00. À 12:45, les ' +
      'plus bas du jour sont à <b>4 305,7</b>, juste au-dessus du chiffre rond des 4 300.</li>' +
      '<li>La prise de liquidité : à ' + m1.heureBalayage + ', la mèche descend à <b>' + prix(m1.extreme) +
      '</b> — ' + f1(m1.depassement) + ' points sous le plus bas du jour — et la bougie clôture à ' +
      prix(m1.clotureBalayage) + ', revenue au-dessus. Les stops des acheteurs sont fauchés.</li>' +
      '<li>Le ChoCh : à ' + m1.heureChoc + ', la clôture de <b>' + prix(m1.clotureChoc) + '</b> dépasse 4 312,9, ' +
      'le sommet laissé par la bougie de balayage.</li>' +
      '<li>Mon entrée : <b>' + prix(m1.entree) + '</b> sur cette clôture. Mon stop : <b>' + prix(m1.stop) +
      '</b>, derrière l\'extrême balayé — ' + f1(m1.risque) + ' points de risque.</li>' +
      '<li>Ma sortie, réellement : <b>' + prix(m1.sortie) + '</b> à ' + m1.heureSuite + ', soit ' +
      f1(m1.gain) + ' points et ' + f1(m1.multiple) + ' fois le risque.</li>' +
      '</ul></div>';
    h += checklistHTML(m1);
    h += '<div class="etude-verdict"><b>' + reussies(m1) + ' règles sur 6.</b> La séquence est juste du premier ' +
      'au dernier temps : liquidité prise, ChoCh, entrée, stop. Et pourtant le trade n\'est pas prenable. ' +
      f1(m1.risque) + ' points de stop coûtent ' + euros(m1.coutStop) + ' au plus petit lot, soit ' +
      f1(m1.partCapital) + ' % d\'un compte de 1 000 $ — la règle du 1 % demanderait ' +
      f1(m1.capitalMinimum, 0) + ' $. Et un rapport 1:7 voudrait ' + f1(m1.objectifUnSept, 0) + ' points de ' +
      'potentiel quand la séance entière en fait ' + f1(se.amplitude) + '. Je note le niveau (4 293,0), je ne ' +
      'clique pas : le déclencheur est bon, le contexte ne l\'est pas.</div>';

    /* ---------- 4. séquence 2 ---------- */
    h += '<h4 class="etude-titre">5. ' + esc(S2.titre) + '</h4>';
    h += '<div class="etude-carnet"><div class="etude-carnet-tete">Mon carnet, lundi 14 septembre, ' +
      m2.heureBalayage + '</div><ul class="etude-liste">' +
      '<li>Ce que je vois : après le plus haut de 02:30, le prix tourne entre 4 363 et 4 379 depuis 04:00. Les ' +
      'hauts sont là, bien alignés — exactement ce que le marché aime aller chercher.</li>' +
      '<li>La prise de liquidité : à ' + m2.heureBalayage + ', la mèche monte à <b>' + prix(m2.extreme) +
      '</b>, au-dessus des hauts depuis 04:00 (' + prix(m2.niveauBalaye) + '), puis la bougie clôture à ' +
      prix(m2.clotureBalayage) + '. Le balayage est haussier, la réaction est baissière.</li>' +
      '<li>Le ChoCh : les sommets suivants sont plus bas (4 373,0 puis 4 372,9). À ' + m2.heureChoc +
      ', la clôture de <b>' + prix(m2.clotureChoc) + '</b> casse le dernier plus bas (' + prix(m2.casse) +
      ') : la structure tourne à la baisse.</li>' +
      '<li>Mon entrée : <b>' + prix(m2.entree) + '</b>. Mon stop : <b>' + prix(m2.stop) + '</b>, derrière le ' +
      'balayage — ' + f1(m2.risque) + ' points.</li>' +
      '<li>Ma sortie, réellement : <b>' + prix(m2.sortie) + '</b> à ' + m2.heureSuite + ', ' + f1(m2.gain) +
      ' points, ' + f1(m2.multiple) + ' fois le risque. La baisse a continué jusqu\'à 4 293,0 à 13:00.</li>' +
      '</ul></div>';
    h += checklistHTML(m2);
    h += '<div class="etude-verdict"><b>' + reussies(m2) + ' règles sur 6.</b> Même mécanique, même lecture, et ' +
      'le plan refuse encore : l\'entrée de ' + m2.heureChoc + ' tombe entre la fenêtre asie (1h–2h) et la ' +
      'fenêtre Europe (8h–9h), et un rapport 1:7 demanderait ' + f1(m2.objectifUnSept, 0) + ' points quand la ' +
      'baisse entière de la séquence en fait ' + f1(Math.abs(m2.stop - 4293)) + '. C\'est exactement ce que la ' +
      'routine veut dire par « en LTF » : la séquence donne le droit de <i>regarder</i> à cet endroit précis, ' +
      'pas le droit de cliquer.</div>';

    /* ---------- 5. la séquence qu'on prend ---------- */
    h += '<h4 class="etude-titre">6. La séquence que le plan accepte : le trade du 21 octobre 2025</h4>';
    h += '<p>La même mécanique, mais tous les feux au vert. Du vendredi 17 au mardi 21 octobre 2025, sur l\'or : ' +
      'deux rejets au-dessus des records (4 398,0 puis 4 393,6) — <b>la liquidité prise</b> ; la clôture ' +
      'horaire du mardi 01:00 passe sous 4 370,2 — <b>le ChoCh confirmé</b> ; l\'entrée à 4 368 à 02:00, en ' +
      'pleine fenêtre de tir asie ; le stop à 4 402, derrière le sommet balayé (34 points) ; l\'objectif à ' +
      '4 130, soit 7 fois le risque. Le trade est allé au bout de l\'objectif.</p>';
    h += '<div class="etude-verdict bonne"><b>La différence n\'est pas la séquence.</b> Les trois exemples de ' +
      'cette page ont le même déclencheur : une liquidité prise, un ChoCh par clôture, une entrée, un stop ' +
      'derrière le balayage. Ce qui décide, c\'est ce qu\'il y a autour : un biais journalier clair, une fenêtre ' +
      'de tir respectée, une taille qui tient dans 1 % — et un objectif qui offre 1:7. La séquence ouvre la ' +
      'porte, la checklist dit si on entre. L\'étude de cas complète est plus haut dans cette page.</div>';

    /* ---------- 6. à retenir ---------- */
    h += '<h4 class="etude-titre">7. Ce qu\'il faut retenir</h4>';
    h += '<ul class="etude-liste">' +
      '<li>La prise de liquidité puis le ChoCh se lisent en quatre temps : la mèche hors du niveau, le retour, ' +
      'la clôture qui casse le dernier extrême, l\'entrée — le stop derrière le balayage, jamais élargi.</li>' +
      '<li>Le balayage seul ne suffit pas, et le ChoCh seul ne suffit pas non plus : c\'est la suite des deux qui ' +
      'donne l\'entrée. Sur cette séance, les deux séquences ont été justes du début à la fin.</li>' +
      '<li>Être juste en LTF, c\'est trouver <i>où</i> regarder. Ce n\'est pas une autorisation de cliquer : ' +
      'fenêtre de tir, taille et ratio 1:7 restent à valider avant, et ils se calculent sans le graphique.</li>' +
      '<li>Le ChoCh dit <i>où</i> la structure a tourné ; il ne dit pas à quel prix entrer. Le prix d\'entrée, ' +
      'c\'est le retest : le retour du prix sur le niveau cassé. Ce retour resserre le stop — ' +
      f1(r1.risque) + ' points au lieu de ' + f1(m1.risque) + ' sur la première séquence, ' + f1(r2.risque) +
      ' au lieu de ' + f1(m2.risque) + ' sur la seconde — et c\'est la seule chose qui le resserre.</li>' +
      '<li>Quand le retest vient, les deux séquences respectent enfin la règle des 15 points ; quand il ne vient ' +
      'pas (la seconde s\'arrête ' + f1(r2.ecartNiveau) + ' point sous le niveau), il ne reste que l\'entrée sur la ' +
      'clôture du ChoCh — ou le renoncement. On regarde le retest, on ne l\'exige pas.</li>' +
      '<li>Quand une séquence est bonne et le contexte mauvais, le plan gagne : sur cette journée, deux bons ' +
      'déclencheurs, deux refus. C\'est écrit ici noir sur blanc parce que c\'est ce qui se passe en vrai.</li>' +
      '</ul>';

    h += '<p class="etude-source">Cours réels : relevé Yahoo Finance, contrat à terme COMEX GC=F (l\'or en ' +
      'dollars l\'once), ' + se.creneaux + ' créneaux de 15 minutes dont ' + se.bougies + ' cotés, du lundi ' +
      esc(D.jour) + ' (00:00 à 23:45, ' +
      'heure de Bamako), arrêté le ' + esc(D.releve) + '. Les quatre créneaux de 21:00 à 21:45 sont le trou ' +
      'quotidien de cotation : ils sont sautés, pas inventés. Le repérage des séquences, les prix d\'entrée, de ' +
      'stop et de sortie sont recalculés à partir des bougies par la recette ' +
      '<span class="etude-code">tools/etude-ltf-test.js</span>, qui vérifie aussi les refus du plan. Le montage ' +
      'pédagogique est ajouté ; les cours, eux, ne sont pas retouchés.</p>';

    h += '</div></section>';
    return h;
  }

  /* ---------------------------------------------------------
     Câblage : le lien vers TradingView en 15 minutes
     --------------------------------------------------------- */
  function cabler(host, App) {
    if (!host) return;
    var bouton = host.querySelector('#ltfOuvrirQuinze');
    if (bouton && global.Graphe) {
      bouton.addEventListener('click', function () {
        var base = (global.Store && global.Store.state && global.Store.state.settings) || {};
        var s = {}, k;
        for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) s[k] = base[k];
        s.graphique = {};
        for (k in (base.graphique || {})) if (Object.prototype.hasOwnProperty.call(base.graphique, k)) s.graphique[k] = base.graphique[k];
        s.graphique.intervalle = '15';
        global.Graphe.ouvrir('XAUUSD', s);
      });
    }
    return true;
  }

  global.EtudeLtf = {
    carte: carte,
    cabler: cabler,
    figures: figures,
    retest: retest,
    mesures: mesures,
    seance: seance,
    dessiner: dessiner,
    FENETRES: FENETRES,
    SEQUENCES: SEQUENCES,
    donnees: D
  };
})(typeof window !== 'undefined' ? window : globalThis);
