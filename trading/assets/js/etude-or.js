/* =========================================================
   etude-or.js — Étude de cas réelle : l'or, 17 → 22 octobre 2025

   Un trade complet, du début à la fin : le contexte, la veille,
   le balayage de liquidité, le scénario écrit avant, le
   déclenchement, la gestion, la sortie, la relecture — puis le
   contre-exemple et la leçon de taille de position.

   Tout est fabriqué par l'application : les bougies sont dessinées
   en SVG à partir des cours réels encodés dans etude-or-donnees.js.
   Aucune image, aucun appel réseau, aucun outil externe : l'étude
   s'affiche et s'imprime hors ligne.

   Honnêteté de la page :
   - les cours sont réels (relevé figé, source citée) ;
   - le montage pédagogique (où placer l'entrée, le stop, les
     objectifs) est ajouté, et il est recalculé par la recette
     tools/etude-test.js à partir des bougies elles-mêmes ;
   - la relecture du trade ne s'attribue pas un 5 sur 5 : la règle
     du 1 % est violée sur un compte de 1 000 $, et c'est écrit.
   ========================================================= */
'use strict';

(function (global) {
  var D = global.EtudeOrDonnees || null;

  /* ---------------------------------------------------------
     Petits outils d'écriture
     --------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 4368 → « 4 368,0 » */
  function f1(v, d) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
    var n = Number(v).toFixed(d === undefined ? 1 : d).split('.');
    n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return n.join(',');
  }

  /* un prix d'entrée, de stop ou de cible : entier si c'est rond */
  function prix(v) {
    return f1(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
  }

  function copier(o) {
    var r = {}, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
    return r;
  }

  /* ---------------------------------------------------------
     Le trade de l'étude — les niveaux, puis les bougies qui les
     confirment. Chaque nombre est vérifiable dans les données.
     --------------------------------------------------------- */
  var TRADE = {
    instrument: 'XAUUSD',
    sens: 'vente',
    sommet: 4398.0,        // lundi 20 octobre, 19:00 (heure de Bamako)
    sommet2: 4393.6,       // lundi 20 octobre, 22:00 — le deuxième balayage
    balayage: 4393.6,      // la zone des records, balayée deux fois
    plancher: 4370.2,      // dernier plus bas de structure, lundi 22:00
    cassure: 4367.7,       // clôture horaire sous ce plancher (01:00)
    entree: 4368.0,        // entrée à 02:00, fin de la fenêtre Asie
    stop: 4402.0,          // au-dessus du sommet balayé
    cibles: [
      { r: 2, prix: 4300.0, touche: '08:00', plusBas: 4257.7 },
      { r: 4, prix: 4232.0, touche: '12:00', plusBas: 4217.2 },
      { r: 7, prix: 4130.0, touche: '14:00', plusBas: 4093.0 }
    ],
    plusHautApres: 4372.9, // le stop n'a jamais été approché
    plusBasJour: 4093.0,   // 14:00 : 8,1 R offerts
    contre: { achat: 4398.0, plusBas: 4093.0 },
    capital: 1000,
    capitalSuffisant: 3400
  };

  /* Le calcul de la position, à partir du trade et du capital */
  function calculs(capital) {
    var risque = TRADE.stop - TRADE.entree;              // 34 $ l'once
    var pct = capital ? risque / capital * 100 : null;    // 3,4 % sur 1 000 $
    var onceMax = capital ? capital * 0.01 / risque : null; // 0,29 once = 0,0029 lot
    return {
      risque: risque,
      pct: pct,
      onceMax: onceMax,
      points: Math.round(risque * 10) / 10,
      minimumSur1000: 34,                    // 0,01 lot = 1 once = 34 $
      pctMinimum: 3.4,
      capital1pourcent: risque / 0.01,       // 3 400 $
      gain: (TRADE.entree - TRADE.cibles[2].prix) * 1,   // +238 $ l'once
      gainR: (TRADE.entree - TRADE.cibles[2].prix) / risque,
      offertR: (TRADE.entree - TRADE.plusBasJour) / risque,
      contreDollars: TRADE.contre.achat - TRADE.contre.plusBas,
      contrePct: (TRADE.contre.achat - TRADE.contre.plusBas) / TRADE.contre.achat * 100,
      contreCompte: (TRADE.contre.achat - TRADE.contre.plusBas) / 1000 * 100,
      duree: '12 heures'
    };
  }

  /* ---------------------------------------------------------
     Le dessin des bougies (SVG fabriqué sur place)
     --------------------------------------------------------- */
  var COULEUR = {
    up: 'var(--green)', down: 'var(--red)', or: 'var(--gold)',
    texte: 'var(--text)', doux: 'var(--muted-2)', bleu: 'var(--blue)'
  };

  function jourDe(t) {
    var d = new Date(t * 1000);
    var noms = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    return { cle: d.toISOString().slice(0, 10), court: noms[d.getUTCDay()] + ' ' + d.getUTCDate() };
  }

  /**
   * Dessine une série de bougies.
   * @param {object} s    série {t,o,h,l,c}
   * @param {object} o    options : debut, fin, min, max, largeur, hauteur,
   *                      zones, niveaux, reperes, trade, journees, aria
   */
  /* ---- placement des étiquettes : jamais l'une sur l'autre ---- */
  function placeur(x0, x1p, y0, y1, H) {
    var posees = [];
    /* toutes les positions voisines, classées du plus près au plus loin */
    var candidats = (function () {
      var l = [], dxs = [0, 15, -15, 30, -30, 45, -45], dys = [0, -13, 13, -26, 26, -39, 39, -52, 52];
      dxs.forEach(function (dx) { dys.forEach(function (dy) { l.push([dx, dy]); }); });
      l.sort(function (a, b) { return (Math.abs(a[0]) / 15 + Math.abs(a[1]) / 13) - (Math.abs(b[0]) / 15 + Math.abs(b[1]) / 13); });
      return l;
    })();
    /* essaie des décalages verticaux successifs, puis accepte la dernière place */
    function placer(x, y, texte, options) {
      options = options || {};
      var larg = String(texte).length * 6.4 + 12, haut = 13;   // police monospace : 0,61 em
      /* une étiquette de niveau reste COLLÉE à sa ligne : elle glisse sur le côté,
         elle ne monte jamais au-dessus d'une autre ligne (sinon on ne sait plus
         quel prix elle désigne) */
      var positions = options.surLigne
        ? [[0, 0], [-17, 0], [17, 0], [-34, 0], [34, 0], [-51, 0], [51, 0], [-68, 0], [68, 0]]
        : candidats;
      /* une étiquette de niveau a le droit de toucher le haut du graphique : c'est
         justement là que se trouve le sommet qu'elle nomme */
      var hautMini = options.surLigne ? 13 : y0 + 11;
      var basMaxi = options.surLigne ? (H || y1) - 4 : y1 - 2;
      var choix = [], k;
      for (k = 0; k < positions.length; k++) {
        var ancre = options.ancre || 'start';
        var py = y + positions[k][1];
        /* hors cadre : ce n'est pas une place valable, on essaie la suivante */
        if (py < hautMini || py > basMaxi) continue;
        var px = x + positions[k][0];
        /* près du bord droit, l'étiquette bascule à gauche du point */
        if (ancre === 'start' && px + larg > x1p - 2) ancre = 'end';
        if (ancre === 'end' && px - larg < x0 + 2) { ancre = 'start'; px = Math.max(px, x0 + 2); }
        var box = {
          ancre: ancre, x: px, y: py, texte: String(texte),
          x0: ancre === 'start' ? px : px - larg, x1: ancre === 'start' ? px + larg : px,
          y0: py - haut + 3, y1: py + 3
        };
        /* une étiquette de niveau glisse sur sa ligne : les bougies ne la bloquent pas,
           elles lui valent seulement une plaque de fond */
        box.libre = !placer.occupe(box, !options.surLigne);
        choix.push(box);
        if (box.libre) break;                      // trouvé une place nette : on la garde
      }
      if (!choix.length) return null;
      var choisie = choix[choix.length - 1];
      for (k = 0; k < choix.length; k++) {          // sinon, celle qui ne touche aucun texte
        if (!placer.occupe(choix[k], false)) { choisie = choix[k]; break; }
      }
      /* reste-t-il une bougie (et seulement une bougie) sous le texte ?
         alors on lui posera une plaque de fond — jamais sur une pastille */
      choisie.plaque = placer.occupeMou(choisie) && !placer.occupe(choisie, false);
      posees.push(choisie);
      return choisie;
    }
    /* une pastille occupe elle aussi la place : les textes l'évitent */
    placer.reserver = function (xa, ya, xb, yb) {
      posees.push({ x0: xa, y0: ya, x1: xb, y1: yb, texte: '', ancre: 'start', x: 0, y: 0 });
    };
    /* obstacles « mous » : on préfère ne pas écrire dessus, mais c'est permis */
    var mous = [];
    placer.eviter = function (xa, ya, xb, yb) { mous.push({ x0: xa, y0: ya, x1: xb, y1: yb }); };
    /* la place est-elle prise par une bougie (obstacle mou) ? */
    placer.occupeMou = function (box) {
      for (var q = 0; q < mous.length; q++) {
        var m = mous[q];
        if (box.x0 < m.x1 && box.x1 > m.x0 && box.y0 < m.y1 && box.y1 > m.y0) return true;
      }
      return false;
    };
    placer.occupe = function (box, avecMous) {
      var q;
      for (q = 0; q < posees.length; q++) {
        var a = posees[q];
        if (box.x0 < a.x1 + 2 && box.x1 > a.x0 - 2 && box.y0 < a.y1 + 1 && box.y1 > a.y0 - 1) return true;
      }
      if (avecMous) {
        for (q = 0; q < mous.length; q++) {
          var m = mous[q];
          if (box.x0 < m.x1 && box.x1 > m.x0 && box.y0 < m.y1 && box.y1 > m.y0) return true;
        }
      }
      return false;
    };
    return placer;
  }

  /* ---- une étiquette de texte, placée proprement ---- */
  function etiquette(box, classe, couleur) {
    if (!box) return '';                       // aucune place propre : on n'écrit rien
    var plaque = box.plaque
      ? '<rect x="' + (box.x0 - 3).toFixed(1) + '" y="' + (box.y - 10).toFixed(1) + '" width="' +
        (box.x1 - box.x0 + 6).toFixed(1) + '" height="14" rx="3" fill="var(--bg-2)" opacity="0.86"/>'
      : '';
    return plaque + '<text x="' + box.x.toFixed(1) + '" y="' + box.y.toFixed(1) + '" class="' + classe +
      '" text-anchor="' + box.ancre + '"' + (couleur ? ' fill="' + couleur + '"' : '') + '>' +
      esc(box.texte) + '</text>';
  }

  /**
   * Dessine une série de bougies.
   * @param {object} s    série {t,o,h,l,c}
   * @param {object} o    options : debut, fin, min, max, largeur, hauteur,
   *                      zones, niveaux, reperes, trade, journees, aria
   */
  function dessiner(s, o) {
    o = o || {};
    if (!s || !s.t) return '<p class="muted">Pas de cours disponible.</p>';
    var debut = o.debut || 0, fin = (o.fin === undefined ? s.t.length : o.fin);
    var idx = [], i;
    for (i = debut; i < fin; i++) if (s.c[i] !== null && s.c[i] !== undefined) idx.push(i);
    if (!idx.length) return '<p class="muted">Pas de cours sur cette période.</p>';

    var W = o.largeur || 640, H = o.hauteur || 300;
    var x0 = 6, x1 = W - 66, y0 = 20, y1 = H - (o.journees === false ? 16 : 38);

    var min = o.min, max = o.max, k;
    if (min === undefined || max === undefined) {
      min = Infinity; max = -Infinity;
      for (k = 0; k < idx.length; k++) {
        if (s.l[idx[k]] < min) min = s.l[idx[k]];
        if (s.h[idx[k]] > max) max = s.h[idx[k]];
      }
      var marge = (max - min) * 0.05;
      min -= marge; max += marge;
    }
    var pas = (x1 - x0) / idx.length;
    var larg = Math.max(2.2, Math.min(12, pas * 0.64));
    var Y = function (p) { return y1 - (p - min) / (max - min) * (y1 - y0); };
    var X = function (n) { return x0 + pas * (n + 0.5); };
    var rang = {};
    idx.forEach(function (v, n) { rang[v] = n; });
    var place = placeur(x0, x1, y0, y1, H);

    var h = [];
    h.push('<svg class="etude-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
      '" role="img" aria-label="' + esc(o.aria || 'Graphique en bougies') + '">');

    /* grille + échelle des prix à droite */
    var nTicks = 5;
    for (i = 0; i <= nTicks; i++) {
      var p = min + (max - min) * (i / nTicks), y = Y(p);
      h.push('<line x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + x1 + '" y2="' + y.toFixed(1) +
        '" stroke="var(--line)" stroke-width="1"/>');
      h.push('<text x="' + (x1 + 6) + '" y="' + (y + 4).toFixed(1) + '" class="etude-axe">' + f1(p, 0) + '</text>');
      place.eviter(x0, y - 2, x1, y + 2);
    }

    /* zones (ex. la zone des records) */
    (o.zones || []).forEach(function (z) {
      var ya = Y(z.a), yb = Y(z.de), haut = Math.min(ya, yb), bas = Math.max(ya, yb);
      var xa = (z.debut === undefined ? 0 : (rang[z.debut] === undefined ? 0 : rang[z.debut]));
      var xb = (z.fin === undefined ? idx.length - 1 : (rang[z.fin] === undefined ? idx.length - 1 : rang[z.fin]));
      var gauche = x0 + pas * xa;
      h.push('<rect x="' + gauche.toFixed(1) + '" y="' + haut.toFixed(1) + '" width="' +
        (pas * (xb - xa + 1)).toFixed(1) + '" height="' + Math.max(1, bas - haut).toFixed(1) +
        '" fill="' + (z.ton === 'red' ? 'var(--red-dim)' : 'var(--gold-dim)') + '"/>');
      if (z.texte) {
        /* le nom de la zone est écrit dedans, sous son bord haut */
        var bz = place(gauche + 4, bas - 4, z.texte, { ancre: 'start' });
        h.push(etiquette(bz, 'etude-note-champ', 'var(--gold-2)'));
      }
    });

    /* les bougies */
    for (k = 0; k < idx.length; k++) {
      var j = idx[k], col = s.c[j] >= s.o[j] ? COULEUR.up : COULEUR.down;
      var xc = X(k);
      h.push('<line x1="' + xc.toFixed(1) + '" y1="' + Y(s.h[j]).toFixed(1) + '" x2="' + xc.toFixed(1) +
        '" y2="' + Y(s.l[j]).toFixed(1) + '" stroke="' + col + '" stroke-width="1.1"/>');
      var yh = Y(Math.max(s.o[j], s.c[j])), yb2 = Y(Math.min(s.o[j], s.c[j]));
      h.push('<rect x="' + (xc - larg / 2).toFixed(1) + '" y="' + yh.toFixed(1) + '" width="' + larg.toFixed(1) +
        '" height="' + Math.max(1.2, yb2 - yh).toFixed(1) + '" fill="' + col + '"/>');
    }

    /* séparations de journée + étiquettes */
    if (o.journees !== false) {
      var precedent = null, debutBloc = 0;
      var poser = function (jDebut, jFin) {
        if (jFin < 0) return;
        var milieu = (X(jDebut) + X(jFin)) / 2;
        h.push('<text x="' + milieu.toFixed(1) + '" y="' + (H - 12) + '" class="etude-jour" text-anchor="middle">' +
          esc(jourDe(s.t[idx[jDebut]]).court) + '</text>');
      };
      for (k = 0; k < idx.length; k++) {
        var cle = jourDe(s.t[idx[k]]).cle;
        if (precedent !== null && cle !== precedent) {
          h.push('<line x1="' + (X(k) - pas / 2).toFixed(1) + '" y1="' + y0 + '" x2="' + (X(k) - pas / 2).toFixed(1) +
            '" y2="' + y1 + '" stroke="var(--line-2)" stroke-width="1" stroke-dasharray="3 3"/>');
          poser(debutBloc, k - 1);
          debutBloc = k;
        }
        precedent = cle;
      }
      poser(debutBloc, idx.length - 1);
    }

    /* les bougies : on préfère ne pas écrire de texte dessus */
    for (k = 0; k < idx.length; k++) {
      place.eviter(X(k) - larg / 2 - 1, Y(s.h[idx[k]]) - 1, X(k) + larg / 2 + 1, Y(s.l[idx[k]]) + 1);
    }

    /* la position : risque et gain, dessinés (posés avant les étiquettes) */
    if (o.trade) {
      var t = o.trade;
      var xa2 = rang[t.depuis] === undefined ? x0 : X(rang[t.depuis]);
      var xb2 = rang[t.jusqua] === undefined ? x1 : X(rang[t.jusqua]) + pas / 2;
      var yE = Y(t.entree), yS = Y(t.stop), yC = Y(t.cible);
      h.push('<rect x="' + xa2.toFixed(1) + '" y="' + Math.min(yS, yE).toFixed(1) + '" width="' +
        (xb2 - xa2).toFixed(1) + '" height="' + Math.abs(yE - yS).toFixed(1) + '" fill="var(--red-dim)"/>');
      h.push('<rect x="' + xa2.toFixed(1) + '" y="' + Math.min(yC, yE).toFixed(1) + '" width="' +
        (xb2 - xa2).toFixed(1) + '" height="' + Math.abs(yE - yC).toFixed(1) + '" fill="var(--green-dim)"/>');
      [[yE, 'entrée ' + prix(t.entree), COULEUR.or], [yS, 'stop ' + prix(t.stop), COULEUR.down],
       [yC, 'cible ' + prix(t.cible), COULEUR.up]].forEach(function (l) {
        h.push('<line x1="' + xa2.toFixed(1) + '" y1="' + l[0].toFixed(1) + '" x2="' + xb2.toFixed(1) +
          '" y2="' + l[0].toFixed(1) + '" stroke="' + l[2] + '" stroke-width="1.3"/>');
        /* l'étiquette est posée à droite de la zone, face au prix */
        var b2 = place(xb2 - 6, l[0] - 5, l[1], { ancre: 'end', surLigne: true });
        h.push(etiquette(b2, 'etude-niveau', l[2]));
      });
    }

    /* niveaux horizontaux */
    (o.niveaux || []).forEach(function (n) {
      var y = Y(n.prix), col = n.ton === 'red' ? COULEUR.down : (n.ton === 'bleu' ? COULEUR.bleu : COULEUR.or);
      h.push('<line x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + x1 + '" y2="' + y.toFixed(1) +
        '" stroke="' + col + '" stroke-width="1.2" stroke-dasharray="6 4"/>');
      /* la ligne elle-même est une place occupée : aucun texte ne s'écrit dessus */
      place.reserver(x0, y - 3, x1, y + 3);
      var b3 = place(x0 + 4, y - 5, n.texte, { ancre: 'start', surLigne: true });
      h.push(etiquette(b3, 'etude-niveau', col));
    });

    /* repères numérotés posés sur les bougies — les pastilles occupent leur place
       avant que le moindre texte soit posé, sinon deux repères voisins se chevauchent */
    var reperes = (o.reperes || []).map(function (r) {
      var n = rang[r.i];
      if (n === undefined) return null;
      var ancreY = r.place === 'bas' ? Y(s.l[r.i]) + 14 + (r.decalage || 0) : Y(s.h[r.i]) - 14 - (r.decalage || 0);
      return {
        r: r, x: X(n), y: Math.max(y0 + 9, Math.min(y1 - 2, ancreY)),
        col: r.ton === 'red' ? COULEUR.down : (r.ton === 'bleu' ? COULEUR.bleu : COULEUR.or)
      };
    }).filter(Boolean);
    reperes.forEach(function (p) { place.reserver(p.x - 10, p.y - 10, p.x + 10, p.y + 10); });
    reperes.forEach(function (p) {
      var r = p.r;
      h.push('<line x1="' + p.x.toFixed(1) + '" y1="' + (r.place === 'bas' ? (p.y - 9) : (p.y + 9)).toFixed(1) +
        '" x2="' + p.x.toFixed(1) + '" y2="' + (r.place === 'bas' ? Y(s.l[r.i]) : Y(s.h[r.i])).toFixed(1) +
        '" stroke="' + p.col + '" stroke-width="0.9" stroke-dasharray="2 2"/>');
      h.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9" fill="var(--panel-3)" stroke="' +
        p.col + '" stroke-width="1.3"/>');
      h.push('<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 3.6).toFixed(1) +
        '" class="etude-repere" text-anchor="middle">' + esc(r.num) + '</text>');
      if (r.texte) {
        var cote = r.aDroite === false ? -13 : 13;
        var br = place(p.x + cote, p.y + 3.6, r.texte, { ancre: cote > 0 ? 'start' : 'end' });
        h.push(etiquette(br, 'etude-repere-texte'));
      }
    });

    h.push('</svg>');
    return h.join('');
  }

  /* ---------------------------------------------------------
     Le contenu : la carte complète
     --------------------------------------------------------- */
  function relectureHTML(c) {
    var lignes = [
      { r: '1. Le stop', exige: 'un stop posé au niveau qui invalide la lecture (la règle des 15 pips ne concerne que le forex)',
        fait: '4 402, juste au-dessus du sommet balayé (4 398,0)', ok: true, note: '29 $ de marge : le stop n\'a jamais été approché' },
      { r: '2. Le ratio', exige: 'viser au minimum 1 pour 7',
        fait: '34 $ de risque pour 238 $ d\'objectif : 4 130 = 4 368 − 7 × 34', ok: true,
        note: 'l\'objectif du plan tombe pile à 7 fois le risque' },
      { r: '3. La fenêtre', exige: 'Asie 01:00–02:00, Europe 08:00–09:00, USA 13:00–14:00 (heure de Bamako)',
        fait: 'entrée à 02:00, à la dernière minute de la fenêtre Asie', ok: true, note: 'une heure plus tard, le plan interdisait l\'entrée' },
      { r: '4. Le risque', exige: '1 % du capital au maximum, par trade',
        fait: '34 $ = 3,4 % d\'un compte de 1 000 $ (le plus petit lot, 0,01 lot = 1 once)', ok: false,
        note: 'la règle est respectée à partir de 3 400 $ de capital, pas avant' },
      { r: '5. La limite du jour', exige: '3 trades au maximum, la journée s\'arrête après 2 stops',
        fait: '1 seul trade, aucun stop', ok: true, note: 'la journée était finie après la sortie' }
    ];
    var html = '';
    html += '<div class="etude-tableau"><table><thead><tr><th>Règle du plan</th><th>Ce qu\'elle exige</th>' +
      '<th>Ce que le trade a fait</th><th></th></tr></thead><tbody>';
    lignes.forEach(function (l) {
      html += '<tr><td><b>' + esc(l.r) + '</b></td><td class="doux">' + esc(l.exige) + '</td><td>' + esc(l.fait) +
        (l.note ? '<br><span class="etude-note-cellule">' + esc(l.note) + '</span>' : '') + '</td>' +
        '<td class="' + (l.ok ? 'etude-oui' : 'etude-non') + '">' + (l.ok ? 'ok' : 'non') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="etude-verdict"><b>4 règles sur 5.</b> Le trade a gagné et il a pourtant violé la règle la plus ' +
      'importante : la taille. Sur un compte de 1 000 $, le plus petit lot possible engageait ' + f1(c.pctMinimum, 1) + ' % du capital. ' +
      'Un trade gagnant qui casse une règle reste une erreur : c\'est la répétition de cette erreur qui tue un compte, pas ce trade-là.</div>';
    return html;
  }

  /* ---------------------------------------------------------
     Le contenu : la carte complète
     --------------------------------------------------------- */
  function carte(App) {
    if (!D || !D.horaire || !D.journalier) {
      return '<section class="card form-card"><header class="card-head"><h3>Étude de cas : l\'or, octobre 2025</h3></header>' +
        '<div class="card-body"><p class="muted">Les cours encodés sont introuvables : rechargez la page.</p></div></section>';
    }
    var H = D.horaire, J = D.journalier;
    var c = calculs(TRADE.capital);

    /* --- index des bougies utiles, repérés dans les données --- */
    var i = {
      vendrediFin: 16,        // vendredi 17 octobre, 20:00 : clôture de la semaine
      creuxVendredi: 13,      // 17:00 : le plus bas de la chute
      dimanche: 42,           // dimanche 22:00 : ouverture en gap
      sommet1: 63,            // lundi 19:00 : 4 398,0
      sommet2: 66,            // lundi 22:00 : 4 393,6
      plancher: 66,           // lundi 22:00 : plus bas de structure 4 370,2
      cassure: 69,            // mardi 01:00 : clôture sous le plancher
      entree: 70,             // mardi 02:00 : entrée
      cible2: 76,             // mardi 08:00 : 1 pour 2 touché
      cible4: 80,             // mardi 12:00 : 1 pour 4 touché
      cible7: 82,             // mardi 14:00 : 1 pour 7 touché, plus bas 4 093,0
      fin: 95                 // mercredi 03:00 : la suite
    };

    var html = '';
    html += '<section class="card form-card etude" id="etudeOr">' +
      '<header class="card-head"><h3>Étude de cas réelle — l\'or, du vendredi 17 au mercredi 22 octobre 2025</h3>' +
      '<div class="card-tools">' +
      (App && global.Graphe ? '<button type="button" class="btn ghost small" id="etudeOuvrirJour">Ouvrir l\'or en journalier</button>' +
        '<button type="button" class="btn ghost small" id="etudeOuvrirHeure">La même semaine en horaire</button>' : '') +
      '</div></header><div class="card-body">';

    html += '<p class="etude-chapeau">Un trade complet, du début à la fin, sur des cours réels : les bougies de cette page ' +
      'sont un relevé figé de l\'or (' + esc(D.nom) + ') — 44 bougies journalières et 69 bougies horaires, du 16 septembre au ' +
      '14 novembre 2025 pour le journalier, du 17 au 22 octobre pour l\'horaire. ' +
      'Le graphique est fabriqué par l\'application : rien n\'est téléchargé, l\'étude marche hors ligne et s\'imprime.</p>';

    /* ---------- 1. le contexte ---------- */
    html += '<h4 class="etude-titre">1. Le contexte : un mois de hausse, puis un sommet</h4>';
    html += '<figure class="etude-figure">' + dessiner(J, {
      largeur: 640, hauteur: 300, journees: false,
      aria: 'Graphique journalier de l\'or du 16 septembre au 14 novembre 2025',
      zones: [{ de: 4356, a: 4398, texte: 'la zone des records', ton: 'or' }],
      niveaux: [{ prix: 4398, texte: 'sommet 4 398,0', ton: 'or' }],
      reperes: [
        { i: 0, num: '1', place: 'bas', texte: '3 725 le 16 sept.', aDroite: true },
        { i: 24, num: '2', place: 'haut', texte: 'sommet du 20 oct.', aDroite: true, decalage: 4 },
        { i: 25, num: '3', place: 'bas', texte: '−5,7 % (21 oct.)', aDroite: true, decalage: 16 },
        { i: 26, num: '4', place: 'bas', texte: 'plus bas 4 021,2', aDroite: true, decalage: 44 }
      ]
    }) + '<figcaption>Journalier. L\'or monte de 3 725 $ (16 septembre) à 4 398 $ (20 octobre), soit près de 20 % en un mois, ' +
      'et neuf semaines de hausse d\'affilée — la plus longue série depuis 2020. Les deux dernières bougies sont celles de ' +
      'l\'étude : le sommet, puis la chute.</figcaption></figure>';
    html += '<p>Ce qui monte depuis un mois attire du monde. Le plan ne dit pas « vendre parce que c\'est haut » : ' +
      'il dit attendre que la hausse se casse. Sur ce graphique, la cassure arrive les 20 et 21 octobre, et c\'est ' +
      'exactement ce que la méthode demande d\'aller chercher : <b>une liquidité prise au-dessus des records, puis un retournement</b>. ' +
      'C\'est la phase C du livre : après la cause (la hausse), l\'effet (le balayage).</p>';

    /* ---------- 2. la veille ---------- */
    html += '<h4 class="etude-titre">2. La veille : un premier échec sur les records (vendredi 17)</h4>';
    html += '<figure class="etude-figure">' + dessiner(H, {
      debut: 0, fin: 17, largeur: 640, hauteur: 260,
      aria: 'Bougies horaires du vendredi 17 octobre 2025',
      zones: [{ de: 4360, a: 4398, texte: 'la zone des records', ton: 'or' }],
      niveaux: [{ prix: 4390.4, texte: '4 390,4 : le sommet du matin', ton: 'or' }],
      reperes: [
        { i: 1, num: '1', place: 'haut', texte: 'le sommet est déjà là', aDroite: true },
        { i: 10, num: '2', place: 'haut', texte: 'vente de toute la journée', aDroite: true },
        { i: 13, num: '3', place: 'bas', texte: '4 196,0' },
        { i: 16, num: '4', place: 'bas', texte: 'clôture 4 213,3' }
      ]
    }) + '<figcaption>Horaire du vendredi 17. Le sommet du matin (4 390,4) est suivi d\'une vente continue : ' +
      '−4,4 % dans la journée, clôture à 4 213,3, très loin du plus haut.</figcaption></figure>';
    html += '<p>C\'est la première leçon de la semaine, et elle ne coûte rien : <b>la cassure des records a échoué une fois</b>. ' +
      'Ceux qui ont acheté le dépassement de 4 390 le vendredi matin ont passé la journée à regarder le prix s\'éloigner. ' +
      'Le plan n\'autorise pas ce trade : aucune mèche prise au-dessus d\'un ancien sommet, aucune cassure de structure ' +
      'dans l\'autre sens, aucune fenêtre de tir respectée.</p>';

    /* ---------- 3. le balayage ---------- */
    html += '<h4 class="etude-titre">3. Le balayage : deux poussées au-dessus des records</h4>';
    html += '<figure class="etude-figure">' + dessiner(H, {
      debut: 42, fin: 69, largeur: 640, hauteur: 280,
      aria: 'Bougies horaires de la nuit du dimanche au lundi 20 octobre 2025',
      zones: [{ de: 4360, a: 4398, texte: 'la zone des records', ton: 'or' }],
      niveaux: [
        { prix: 4398, texte: '4 398,0 — le sommet', ton: 'or' },
        { prix: 4370.2, texte: '4 370,2 — le plus bas de structure', ton: 'bleu' }
      ],
      reperes: [
        { i: 42, num: '1', place: 'bas', texte: 'ouverture en gap', aDroite: true },
        { i: 63, num: '2', place: 'haut', texte: '19:00', aDroite: true },
        { i: 66, num: '3', place: 'bas', texte: '22:00', aDroite: true },
        { i: 68, num: '4', place: 'bas', texte: '00:00', aDroite: true, decalage: 14 }
      ]
    }) + '<figcaption>Horaire. Dimanche 22:00 : ouverture en hausse à 4 269 (le vendredi avait clos à 4 213,3) — les acheteurs ' +
      'reviennent. Lundi 19:00 : sommet à 4 398,0. Lundi 22:00 : deuxième poussée à 4 393,6, refusée. ' +
      'Le dernier plus bas de structure avant cette poussée est 4 370,2 (lundi 22:00).</figcaption></figure>';
    html += '<p>Deux sommets, deux rejets, à 4 398,0 puis 4 393,6 : c\'est le <b>balayage de liquidité</b>. ' +
      'Tous les stops des vendeurs étaient au-dessus de l\'ancien record ; le marché va les chercher, puis ne tient pas. ' +
      'À ce moment précis, rien n\'est jouable : le livre est clair, on ne vend pas un sommet parce qu\'il est haut. ' +
      'On attend la <b>cassure de structure</b>.</p>';

    /* ---------- 4. le scenario ecrit avant ---------- */
    html += '<h4 class="etude-titre">4. Le scénario, écrit avant d\'entrer</h4>';
    html += '<div class="etude-carnet"><div class="etude-carnet-tete">Mon carnet, lundi 20 octobre au soir</div>' +
      '<ul class="etude-liste">' +
      '<li>Instrument : <b>or (XAUUSD)</b>, unité de temps horaire, contexte journalier haussier mais essoufflé.</li>' +
      '<li>Ce que je vois : deux rejets au-dessus des records (4 398,0 puis 4 393,6), plus bas de structure à <b>4 370,2</b>.</li>' +
      '<li>Ma condition d\'entrée : <b>clôture horaire sous 4 370,2</b> (cassure confirmée), dans une fenêtre de tir du plan.</li>' +
      '<li>Mon stop : <b>4 402</b>, au-dessus du sommet balayé. Si le prix reprend cette zone, mon scénario est faux.</li>' +
      '<li>Mon objectif : <b>4 130</b>, soit 7 fois mon risque (4 368 − 7 × 34 = 4 130).</li>' +
      '<li>Mon risque : 1 % du capital. Si le plus petit lot dépasse 1 %, je ne prends pas le trade.</li>' +
      '</ul></div>';
    html += '<p>Une ligne, surtout, vaut le trade entier : <b>le stop est déjà écrit</b>. Le prix qui monte ne me fera pas ' +
      'déplacer ce niveau, parce qu\'il est posé là où ma lecture devient fausse — pas là où mon compte a mal.</p>';

    /* ---------- 5. le declenchement, la gestion, la sortie ---------- */
    html += '<h4 class="etude-titre">5. Le déclenchement, la gestion, la sortie (mardi 21)</h4>';
    html += '<figure class="etude-figure">' + dessiner(H, {
      debut: 69, fin: 96, largeur: 640, hauteur: 340,
      aria: 'Bougies horaires du mardi 21 octobre 2025 avec l\'entrée, le stop et les objectifs',
      min: 4000, max: 4420,
      trade: { entree: TRADE.entree, stop: TRADE.stop, cible: TRADE.cibles[2].prix, depuis: 70, jusqua: 82 },
      reperes: [
        { i: 69, num: '1', place: 'bas', texte: '01:00 : cassure 4 367,7', aDroite: true },
        { i: 70, num: '2', place: 'haut', texte: '02:00 : entrée 4 368', aDroite: true },
        { i: 76, num: '3', place: 'bas', texte: '08:00 : 1 pour 2', decalage: 8 },
        { i: 80, num: '4', place: 'bas', texte: '12:00 : 1 pour 4', aDroite: true },
        { i: 82, num: '5', place: 'bas', texte: '14:00 : 1 pour 7' }
      ]
    }) + '<figcaption>Horaire du mardi 21 octobre. La bougie de 01:00 clôture à 4 367,7, sous le plus bas de structure : ' +
      'la cassure est confirmée. L\'entrée est prise à 4 368 (02:00, fin de la fenêtre Asie), le stop est à 4 402, ' +
      'l\'objectif du plan à 4 130. Le prix ne reviendra jamais au-dessus de 4 372,9 : le stop n\'a jamais été approché.</figcaption></figure>';

    html += '<ol class="etude-etapes">' +
      '<li><b>01:00 — la cassure.</b> La bougie horaire ouvre à 4 385,9, descend à 4 348,4 et clôture à <b>4 367,7</b>, ' +
      'sous le plus bas de structure de 4 370,2. Le scénario passe de « peut-être » à « prêt ».</li>' +
      '<li><b>02:00 — l\'entrée.</b> Vente à <b>4 368</b>, à la dernière heure de la fenêtre Asie du plan ' +
      '(Asie 01:00–02:00, heure de Bamako). Stop <b>4 402</b>, soit 34 $ de risque par once.</li>' +
      '<li><b>08:00 — 1 pour 2.</b> Le prix touche <b>4 300</b> (plus bas de l\'heure : 4 257,7). Premier tiers sorti, ' +
      'le reste est protégé.</li>' +
      '<li><b>12:00 — 1 pour 4.</b> <b>4 232</b> touché (plus bas : 4 217,2). Deuxième tiers sorti.</li>' +
      '<li><b>14:00 — 1 pour 7.</b> <b>4 130</b> touché (plus bas : 4 093,0). Sortie sur l\'objectif du plan, ' +
      'douze heures après l\'entrée. La journée a offert au total 8,1 fois le risque : le reste n\'était pas à nous.</li>' +
      '</ol>';

    /* ---------- 6. les chiffres ---------- */
    html += '<h4 class="etude-titre">6. Les chiffres, ligne par ligne</h4>';
    html += '<div class="etude-tableau"><table><tbody>' +
      ligne('Entrée', prix(TRADE.entree) + ' $ l\'once (mardi 21, 02:00)') +
      ligne('Stop', prix(TRADE.stop) + ' $ — au-dessus du sommet balayé') +
      ligne('Risque', f1(c.risque, 0) + ' $ l\'once, soit ' + f1(c.points, 0) + ' points') +
      ligne('Objectif du plan', prix(TRADE.cibles[2].prix) + ' $ — ratio 1 pour ' + f1(c.gainR, 1)) +
      ligne('Gain', '+' + f1(c.gain, 0) + ' $ l\'once en douze heures') +
      ligne('Plus haut après l\'entrée', prix(TRADE.plusHautApres) + ' $ : le stop n\'a jamais été menacé') +
      ligne('Plus bas de la journée', prix(TRADE.plusBasJour) + ' $, soit ' + f1(c.offertR, 1) + ' fois le risque') +
      '</tbody></table></div>';

    /* ---------- 7. la relecture ---------- */
    html += '<h4 class="etude-titre">7. La relecture — les 5 règles du plan appliquées à ce trade</h4>';
    html += '<p class="muted small">C\'est exactement ce que fait le module <b>Relire mes vrais trades</b> : il pose ces cinq ' +
      'questions à chaque trade clôturé, et il ne note jamais le résultat du trade — seulement le respect des règles.</p>';
    html += relectureHTML(c);

    /* ---------- 8. le contre-exemple ---------- */
    html += '<h4 class="etude-titre">8. Le contre-exemple : acheter le record</h4>';
    html += '<p>Le trade le plus évident de la semaine — et de loin le plus fréquenté — était l\'achat du nouveau record. ' +
      'Entrée à <b>' + prix(TRADE.contre.achat) + '</b> (lundi 19:00), sous prétexte que « ça ne peut plus s\'arrêter » :</p>';
    html += '<div class="etude-tableau"><table><tbody>' +
      ligne('Le prix atteint le lendemain', prix(TRADE.contre.plusBas) + ' $ l\'once') +
      ligne('Perte pour l\'acheteur, par once', '−' + f1(c.contreDollars, 0) + ' $, soit −' + f1(c.contrePct, 1) + ' %') +
      ligne('Avec le plus petit lot sur 1 000 $', '−' + f1(c.contreCompte, 0) + ' % du compte en une journée') +
      '</tbody></table></div>';
    html += '<p>Le journal de la semaine, c\'est ça : <b>un trade qui respecte les règles et un trade qui ne les respecte pas</b>, ' +
      'séparés de douze heures. Acheter une cassure de record, ce n\'est pas la méthode — c\'est la foule. Le livre demande ' +
      'l\'inverse : que le marché vienne chercher la liquidité au-dessus de ce record, et <b>échoue</b>.</p>';

    /* ---------- 9. la lecon de taille ---------- */
    html += '<h4 class="etude-titre">9. Ce que ça change sur un compte de 1 000 $</h4>';
    html += '<p>Voici la partie que beaucoup d\'applications oublient : sur l\'or, le plus petit lot possible engage déjà ' +
      'plus de 3 % du compte. La règle du 1 % devient alors impossible à tenir, et le plan dit ce qu\'il faut faire — ' +
      '<b>ne pas prendre le trade</b>.</p>';
    html += '<div class="etude-tableau"><table><thead><tr><th></th><th>Or (XAUUSD)</th><th>EUR/USD</th></tr></thead><tbody>' +
      '<tr><td>Plus petit lot</td><td>0,01 lot = 1 once</td><td>0,01 lot = 1 000 unités</td></tr>' +
      '<tr><td>Stop de l\'exemple</td><td>' + f1(c.risque, 0) + ' $ (34 points)</td><td>15 pips (la règle du plan)</td></tr>' +
      '<tr><td>Risque de ce lot</td><td>' + f1(c.risque, 0) + ' $ = <b>' + f1(c.pctMinimum, 1) + ' %</b></td><td>1,50 $ = <b>0,15 %</b></td></tr>' +
      '<tr><td>Taille pour 1 % de 1 000 $</td><td class="etude-non">impossible (0,0029 lot)</td><td class="etude-oui">0,06 lot</td></tr>' +
      '<tr><td>Capital nécessaire</td><td>' + f1(c.capital1pourcent, 0) + ' $</td><td>1 000 $ suffisent</td></tr>' +
      '</tbody></table></div>';
    html += '<p>Ce n\'est pas une raison d\'abandonner l\'or, c\'est une raison de savoir compter : sur un compte de ' +
      f1(TRADE.capitalSuffisant, 0) + ' $, le même trade risquait ' + f1(c.risque, 0) + ' $ (1 %) et rapportait ' +
      f1(c.gain, 0) + ' $, soit <b>+7 % du compte en douze heures</b>. Sur un compte de 1 000 $, la bonne décision était ' +
      'de <b>laisser passer ce trade</b> et de travailler l\'EUR/USD, où la même discipline tient avec 0,06 lot. ' +
      'En démo, les deux se pratiquent gratuitement — c\'est là qu\'on apprend à compter sans payer.</p>';

    /* ---------- 10. a vous ---------- */
    html += '<h4 class="etude-titre">10. À vous, sur le vrai graphique</h4>';
    html += '<ol class="etude-etapes">' +
      '<li>Ouvrez l\'or en journalier et repérez la bougie du 21 octobre 2025 : c\'est celle de la chute. ' +
      'Vous venez de lire, heure par heure, ce qu\'elle contient.</li>' +
      '<li>Passez en horaire, remontez à la nuit du 20 au 21. Cherchez les deux sommets, le plus bas de structure, ' +
      'puis la bougie qui casse.</li>' +
      '<li>Refaites l\'exercice à l\'envers : sur la nuit du 21 au 22, le plus bas de 4 021,2 a été pris dans la même zone. ' +
      'Le retournement de la semaine suivante, vous le verrez seul — c\'est le même schéma, dans l\'autre sens.</li>' +
      '</ol>';
    html += '<p class="etude-source">Cours réels : relevé ' + esc(D.nom) + ', du 16 septembre au 14 novembre 2025 (journalier) ' +
      'et du 17 au 22 octobre 2025 (horaire), source Yahoo Finance, arrêté le ' + esc(D.releve) + '. ' +
      'Le contrat à terme cote quelques dollars au-dessus du cours « spot » cité dans la presse (4 398,0 ici contre 4 381,21 le ' +
      '20 octobre) : les niveaux de cette page sont ceux du contrat. Les mouvements se recoupent : −' + f1((1 - 4109.1 / 4359.4) * 100, 1) +
      ' % sur la clôture du 21 octobre et jusqu\'à −' + f1((1 - 4093 / 4398) * 100, 1) + ' % depuis le sommet, ce que la presse a décrit ' +
      'comme la plus forte baisse quotidienne de l\'or en cinq ans (Reuters). Les cours sont réels ; le montage (où placer l\'entrée, le ' +
      'stop, les objectifs) est pédagogique, et il est recalculé par la recette <span class="etude-code">tools/etude-test.js</span> ' +
      'à partir des bougies elles-mêmes.</p>';

    html += '</div></section>';
    return html;

    function ligne(a, b) { return '<tr><td class="doux">' + esc(a) + '</td><td><b>' + esc(b) + '</b></td></tr>'; }
  }

  /* ---------------------------------------------------------
     Le câblage des boutons
     --------------------------------------------------------- */
  function cabler(host, App) {
    if (!host || !global.Graphe) return;
    var ouvrir = function (intervalle) {
      var s = copier((global.Store && global.Store.state && global.Store.state.settings) || {});
      s.graphique = copier(s.graphique || {});
      s.graphique.intervalle = intervalle;
      global.Graphe.ouvrir('XAUUSD', s);
    };
    var bJour = host.querySelector('#etudeOuvrirJour');
    if (bJour) bJour.addEventListener('click', function () { ouvrir('D'); });
    var bHeure = host.querySelector('#etudeOuvrirHeure');
    if (bHeure) bHeure.addEventListener('click', function () { ouvrir('60'); });
    return true;
  }

  global.EtudeOr = {
    carte: carte,
    cabler: cabler,
    dessiner: dessiner,
    calculs: calculs,
    TRADE: TRADE,
    donnees: D
  };
})(typeof window !== 'undefined' ? window : globalThis);
