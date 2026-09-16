/* =========================================================
   taille.js — Calculateur de taille de position

   La formule du plan (bloc 03, « Taille de position ») mise en outil :
   on saisit le capital, le risque par trade, l'entrée et le stop, et
   l'application donne la taille en lots — dans le sens que le plan
   demande, c'est-à-dire DU RISQUE VERS LA TAILLE.

     R (devise)        = capital × risque %
     distance (pips)   = |entrée − stop| ÷ pas du pip
     taille (lots)     = R ÷ (distance × valeur du pip par lot)

   Le calculateur dit aussi la vérité qui décide souvent de tout : ce que
   coûte le plus petit lot négociable (0,01 lot). Si ce minimum dépasse
   le risque autorisé, la réponse n'est pas « arrondir » mais « laisser
   passer, ou augmenter le capital » — exactement la conclusion de
   l'étude de cas et de l'exemple en 15 minutes.

   Deux endroits dans l'application :
   - la carte de la vue Plan, juste sous la formule du bloc 03 (carte +
     cabler) : on y saisit tout, c'est le poste de travail ;
   - le formulaire de trade (bloc + cablerFormulaire), où l'entrée et le
     stop sont déjà là : la taille suit la saisie et un bouton la reprend.

   Les valeurs de départ sont celles des Paramètres (capital de départ,
   risque par trade, valeur du pip par lot, premier instrument) ; la
   carte garde ensuite ce qu'on y a tapé, et le journal ne mélange pas
   les deux (il lit toujours les Paramètres). Rien n'est envoyé nulle
   part, rien n'est téléchargé, rien n'est enregistré.

   API : window.Taille = { calcul, regles, tailleTexte, carte, cabler,
                           majCarte, bloc, cablerFormulaire, majFormulaire,
                           lireReglages, valeurs, MODELE, MINI,
                           MAX_STOP_PIPS }
   ========================================================= */
'use strict';

(function (global) {
  var MINI = 0.01;          /* le plus petit lot de la plupart des courtiers */

  /* ---------------------------------------------------------
     Lectures et écritures de nombres (virgule acceptée)
     --------------------------------------------------------- */
  function nombre(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function arrondiBas(v) { return Math.floor(v * 100 + 1e-9) / 100; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function ps(symbole) {
    if (global.Store && global.Store.pipSize) return global.Store.pipSize(symbole);
    return 0.0001;
  }
  function unite(psv) { return psv >= 1 ? 'points' : 'pips'; }
  function fmt(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (global.UI && global.UI.fmtNum) return global.UI.fmtNum(v, d === undefined ? 2 : d);
    return Number(v).toFixed(d === undefined ? 2 : d).replace('.', ',');
  }
  function devise(s) {
    if (!s) return '';
    return s.currencySymbol || s.currency || '';
  }
  /* l'espace qui précède la devise, seulement s'il y en a une */
  function uniteSymb(s) { return s ? ' ' + s : ''; }
  /* L'application garde ses Paramètres dans App.state.settings : c'est là
     qu'on lit le capital, le risque par trade et la valeur du pip par lot. */
  var APP = null;
  function reglages(app) {
    var a = app || APP || global.App;
    /* on peut recevoir l'application, ou directement ses Paramètres */
    if (a && (a.startingCapital !== undefined || a.riskPerTradePct !== undefined)) return a;
    if (a && a.state && a.state.settings) return a.state.settings;
    if (a && a.settings) return a.settings;
    if (global.Store && global.Store.state && global.Store.state.settings) return global.Store.state.settings;
    return {};
  }
  /* Les valeurs de départ : celles des Paramètres, rien d'autre */
  function valeurs(app) {
    var s = reglages(app);
    return {
      capital: s.startingCapital !== undefined ? s.startingCapital : 10000,
      risquePct: s.riskPerTradePct !== undefined ? s.riskPerTradePct : 1,
      pipValuePerLot: s.pipValuePerLot !== undefined ? s.pipValuePerLot : 10,
      symbole: (s.symbols && s.symbols[0]) || 'EURUSD'
    };
  }

  /* ---------------------------------------------------------
     La formule du plan, en une seule fonction
     --------------------------------------------------------- */
  function calcul(o) {
    o = o || {};
    var capital = nombre(o.capital);
    var pct = nombre(o.risquePct);
    var entree = nombre(o.entree);
    var stop = nombre(o.stop);
    var pipValue = nombre(o.pipValuePerLot);
    var psv = nombre(o.pipSize) || ps(o.symbole);
    var sens = o.sens === 'short' ? 'short' : 'long';

    var r = (capital !== null && pct !== null) ? capital * pct / 100 : null;
    var distance = (entree !== null && stop !== null) ? Math.abs(entree - stop) : null;
    var distancePips = (distance !== null && psv) ? distance / psv : null;
    var denominateur = (distancePips !== null && pipValue !== null) ? distancePips * pipValue : null;
    var taille = (r !== null && denominateur) ? r / denominateur : null;

    /* ce que coûte le plus petit lot : c'est lui qui décide */
    var risqueMini = (distancePips !== null && pipValue !== null) ? MINI * distancePips * pipValue : null;
    var pctMini = (risqueMini !== null && capital) ? risqueMini / capital * 100 : null;
    var capitalMini = (risqueMini !== null && pct) ? risqueMini * 100 / pct : null;

    /* l'objectif que le plan exige : 1:7, soit sept fois la distance */
    var cible = (distance !== null && entree !== null)
      ? entree + (sens === 'short' ? -1 : 1) * 7 * distance : null;

    var c = {
      capital: capital, risquePct: pct, sens: sens,
      entree: entree, stop: stop, symbole: o.symbole || '',
      pipSize: psv, pipValuePerLot: pipValue,
      r: r, distance: distance, distancePips: distancePips,
      unite: unite(psv),
      taille: taille,
      /* jamais au-dessus du risque : on arrondit vers le bas */
      tailleArrondie: taille === null ? null : arrondiBas(taille),
      mini: MINI,
      risqueMini: risqueMini, pctMini: pctMini, capitalMini: capitalMini,
      cibleUnSept: cible,
      /* la taille tient-elle dans le risque, avec le lot minimum du courtier ? */
      faisable: (taille !== null && taille >= MINI) ? true : (taille === null ? null : false),
      /* le lot minimum dépasse-t-il le risque autorisé ? */
      miniTropGros: (pctMini !== null && pct !== null) ? pctMini > pct + 1e-9 : null
    };
    var parts = [];
    if (c.r === null) parts.push('capital et risque par trade');
    if (c.distance === null) parts.push('prix d\'entrée et stop');
    if (c.distancePips !== null && c.pipValuePerLot === null) parts.push('valeur du pip par lot');
    c.manquant = parts;
    return c;
  }

  /* ---------------------------------------------------------
     Le modèle : ce que l'utilisateur a tapé la dernière fois
     --------------------------------------------------------- */
  var MODELE = { capital: null, risquePct: null, symbole: '', pipValuePerLot: null, entree: null, stop: null, sens: 'long' };

  function lireReglages(app) {
    var d = valeurs(app);
    ['capital', 'risquePct', 'pipValuePerLot', 'symbole'].forEach(function (k) {
      if (MODELE[k] === null || MODELE[k] === '') MODELE[k] = d[k];
    });
    return MODELE;
  }

  /* ---------------------------------------------------------
     Le résultat, en clair
     --------------------------------------------------------- */
  var MAX_STOP_PIPS = 15;   /* la règle du plan, écrite pour le forex */

  function tailleTexte(c) {
    if (c.taille === null) return '—';
    if (c.taille < MINI) return fmt(c.taille, 3) + ' lot : sous le lot minimum (0,01)';
    return fmt(c.tailleArrondie, 2) + ' lot' + (c.tailleArrondie >= 2 ? 's' : '') + ' (arrondi vers le bas)';
  }

  /* Les règles chiffrées du plan, confrontées à ce qu'on vient de saisir */
  function regles(c) {
    var out = [];
    if (c.risquePct !== null) {
      out.push({ texte: 'Risque 1 % maximum par trade', ok: c.risquePct <= 1 + 1e-9,
        detail: fmt(c.risquePct, 2) + ' %' + (c.capital !== null ? ' de ' + fmt(c.capital, 0) : '') });
    }
    if (c.distancePips !== null) {
      if (c.pipSize <= 0.01) {
        out.push({ texte: 'Stop 15 pips maximum, jamais élargi', ok: c.distancePips <= MAX_STOP_PIPS + 1e-9,
          detail: fmt(c.distancePips, 1) + ' pips' });
      } else {
        out.push({ texte: 'Stop 15 pips maximum (règle écrite pour le forex)', ok: null,
          detail: 'ici la distance se compte en ' + c.unite + ' : ' + fmt(c.distancePips, 1) });
      }
    }
    if (c.cibleUnSept !== null) {
      out.push({ texte: 'Ratio minimum 1:7', ok: true,
        detail: 'objectif ' + fmt(c.cibleUnSept, 5) + ', soit ' + fmt(c.distancePips * 7, 1) + ' ' + c.unite + ' de l\'entrée' });
    }
    return out;
  }

  function reglesHTML(c) {
    return regles(c).map(function (x) {
      return '<div class="preview-item"><span>' + esc(x.texte) + '</span><b class="' +
        (x.ok === null ? 'flat' : (x.ok ? 'pos' : 'neg')) + '">' + esc(x.detail) + '</b></div>';
    }).join('');
  }

  function resultatHTML(c) {
    var symb = devise(reglages());
    var lignes = [
      ['Risque engagé (R)',
        c.r === null ? '—' : fmt(c.r, 2) + uniteSymb(symb) + ' (' + fmt(c.risquePct, 2) + ' % de ' + fmt(c.capital, 0) + uniteSymb(symb) + ')'],
      ['Distance du stop',
        c.distance === null ? '—' : fmt(c.distancePips, 1) + ' ' + c.unite + ' (' + fmt(c.distance, 5) + ' de prix)'],
      ['Taille pour ce risque', tailleTexte(c)],
      ['Le plus petit lot (0,01)',
        c.risqueMini === null ? '—' : fmt(c.risqueMini, 2) + uniteSymb(symb) + ' = ' + fmt(c.pctMini, 2) + ' % du capital'],
      ['Capital pour ' + (c.risquePct === null ? 'ce risque' : fmt(c.risquePct, 2) + ' %') + ' avec ce stop',
        c.capitalMini === null ? '—' : fmt(c.capitalMini, 0) + uniteSymb(symb)],
      ['Objectif 1:7 (le plan l\'exige)',
        c.cibleUnSept === null ? '—' : fmt(c.cibleUnSept, 5) + (c.distancePips === null ? '' : ' — ' + fmt(c.distancePips * 7, 1) + ' ' + c.unite + ' de l\'entrée')]
    ];
    var h = '<div class="preview-grid">' + lignes.map(function (l) {
      return '<div class="preview-item"><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></div>';
    }).join('') + reglesHTML(c) + '</div>';

    var verdict;
    if (c.taille === null) {
      verdict = 'Complétez ' + (c.manquant.join(', ') || 'les champs') + ' pour connaître la taille.';
      h += '<p class="tz-verdict neutre" id="tzVerdict">' + verdict + '</p>';
      return h;
    }
    if (c.miniTropGros) {
      verdict = 'Au plus petit lot, ce stop engage ' + fmt(c.pctMini, 2) + ' % du capital : au-dessus du risque ' +
        'autorisé (' + fmt(c.risquePct, 2) + ' %). Le plan ne dit pas « arrondir » : il dit laisser passer — ou travailler ' +
        'un autre instrument, ou attendre ' + fmt(c.capitalMini, 0) + uniteSymb(symb) + ' de capital.';
      h += '<p class="tz-verdict refus" id="tzVerdict">' + esc(verdict) + '</p>';
    } else {
      verdict = 'Conforme : ' + fmt(c.tailleArrondie, 2) + ' lot engage ' + fmt(c.r, 2) + uniteSymb(symb) + ' — soit ' +
        fmt(c.risquePct, 2) + ' % du capital — et le plus petit lot ne coûte que ' + fmt(c.pctMini, 2) + ' %. Objectif du plan : ' +
        fmt(c.distancePips * 7, 1) + ' ' + c.unite + ' (' + fmt(c.cibleUnSept, 5) + ').';
      h += '<p class="tz-verdict ok" id="tzVerdict">' + esc(verdict) + '</p>';
    }
    return h;
  }

  /* ---------------------------------------------------------
     La carte (vue Plan, sous le bloc 03 — la formule)
     --------------------------------------------------------- */
  function carte(App) {
    if (App) APP = App;
    var m = lireReglages(App);
    var s = reglages(App);
    var symboles = (s.symbols || []).slice();
    if (symboles.indexOf(m.symbole) === -1 && m.symbole) symboles.unshift(m.symbole);
    var champ = function (id, label, valeur, pas, aide) {
      return '<div class="form-field"><label for="' + id + '">' + esc(label) + '</label>' +
        '<input class="input" type="number" step="' + (pas || 'any') + '" inputmode="decimal" id="' + id + '" value="' +
        esc(valeur === null || valeur === undefined ? '' : valeur) + '">' +
        (aide ? '<span class="field-hint">' + esc(aide) + '</span>' : '') + '</div>';
    };
    var h = '';
    h += '<section class="card form-card tz-carte" id="tailleCalc">' +
      '<header class="card-head"><h3>Calculateur de taille de position</h3></header><div class="card-body">' +
      '<p>La formule du bloc 03, posée à l\'envers : je donne le risque, elle donne la taille. ' +
      'Vos valeurs de départ viennent des Paramètres ; vous pouvez les changer ici, rien n\'est enregistré.</p>' +
      '<div class="settings-grid">' +
      '<div class="form-field"><label for="tzCapital">Capital</label>' +
        '<input class="input" type="number" step="any" inputmode="decimal" id="tzCapital" value="' + esc(m.capital) + '">' +
        '<span class="field-hint">devise des Paramètres : ' + esc(devise(s) || '—') + '</span></div>' +
      '<div class="form-field"><label for="tzRisque">Risque par trade (%)</label>' +
        '<input class="input" type="number" step="any" inputmode="decimal" id="tzRisque" value="' + esc(m.risquePct) + '">' +
        '<span class="field-hint">le plan plafonne à 1 %</span></div>' +
      '<div class="form-field"><label for="tzSymbole">Instrument</label>' +
        '<input class="input" id="tzSymbole" list="tzSymboles" value="' + esc(m.symbole) + '">' +
        '<datalist id="tzSymboles">' + symboles.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
        '<span class="field-hint">donne le pas du pip</span></div>' +
      '<div class="form-field"><label for="tzPipValue">Valeur du pip par lot</label>' +
        '<input class="input" type="number" step="any" inputmode="decimal" id="tzPipValue" value="' + esc(m.pipValuePerLot) + '">' +
        '<span class="field-hint">10 pour un lot EURUSD, 1 pour un indice à 1 point</span></div>' +
      '<div class="form-field"><label for="tzEntree">Prix d\'entrée</label>' +
        '<input class="input" type="number" step="any" inputmode="decimal" id="tzEntree" value="' + esc(m.entree === null ? '' : m.entree) + '"></div>' +
      '<div class="form-field"><label for="tzStop">Stop loss</label>' +
        '<input class="input" type="number" step="any" inputmode="decimal" id="tzStop" value="' + esc(m.stop === null ? '' : m.stop) + '"></div>' +
      '<div class="form-field"><label for="tzSens">Sens</label>' +
        '<select class="input" id="tzSens">' +
        '<option value="long"' + (m.sens === 'long' ? ' selected' : '') + '>Achat</option>' +
        '<option value="short"' + (m.sens === 'short' ? ' selected' : '') + '>Vente</option></select>' +
        '<span class="field-hint">pour placer l\'objectif 1:7</span></div>' +
      '</div>' +
      '<div id="tzResultat" class="preview">' + resultatHTML(calcul({ capital: m.capital, risquePct: m.risquePct, symbole: m.symbole, pipValuePerLot: m.pipValuePerLot, entree: m.entree, stop: m.stop, sens: m.sens })) + '</div>' +
      '<p class="etude-source tz-note">Taille = R ÷ (distance en pips × valeur du pip par lot), et les règles chiffrées du ' +
      'plan sont rappelées à droite du résultat : 1 % maximum, stop 15 pips maximum (règle écrite pour le forex), ratio 1:7 ' +
      'minimum. Le calcul ne quitte pas l\'appareil : cette carte marche hors ligne. Si le plus petit lot dépasse le risque, ' +
      'la taille juste n\'existe pas — c\'est écrit en clair dans la réponse.</p>' +
      '</div></section>';
    return h;
  }

  /* La carte lit ses champs et se met à jour */
  function majCarte(host) {
    if (!host) return null;
    var champ = function (id) { var e = host.querySelector('#' + id); return e ? e.value : ''; };
    var c = calcul({
      capital: champ('tzCapital'), risquePct: champ('tzRisque'), symbole: champ('tzSymbole'),
      pipValuePerLot: champ('tzPipValue'), entree: champ('tzEntree'), stop: champ('tzStop'), sens: champ('tzSens')
    });
    var zone = host.querySelector('#tzResultat');
    if (zone) zone.innerHTML = resultatHTML(c);
    /* on se souvient des valeurs pour la prochaine ouverture */
    MODELE.capital = nombre(champ('tzCapital'));
    MODELE.risquePct = nombre(champ('tzRisque'));
    MODELE.pipValuePerLot = nombre(champ('tzPipValue'));
    MODELE.symbole = champ('tzSymbole');
    MODELE.entree = nombre(champ('tzEntree'));
    MODELE.stop = nombre(champ('tzStop'));
    MODELE.sens = champ('tzSens') === 'short' ? 'short' : 'long';
    return c;
  }

  function cabler(host, App) {
    if (App) APP = App;
    if (!host) return;
    var entete = host.querySelector('#tailleCalc');
    if (!entete) return;
    ['tzCapital', 'tzRisque', 'tzSymbole', 'tzPipValue', 'tzEntree', 'tzStop', 'tzSens'].forEach(function (id) {
      var e = host.querySelector('#' + id);
      if (!e) return;
      e.addEventListener('input', function () { majCarte(host); });
      e.addEventListener('change', function () { majCarte(host); });
    });
    return true;
  }

  /* ---------------------------------------------------------
     Dans le formulaire de trade : la taille à partir du risque,
     calculée avec l'entrée et le stop déjà saisis
     --------------------------------------------------------- */
  function bloc(reglagesApp) {
    var m = valeurs(reglagesApp);
    var s = reglages(reglagesApp);
    return '<div class="tz-ligne" id="tzLigne">' +
      '<span class="tz-ligne-titre" id="tzLigneTitre">Taille pour ' + esc(fmt(m.risquePct, 2)) + ' % de ' +
      esc(fmt(m.capital, 0)) + uniteSymb(esc(devise(s))) + ' sur ce stop :</span> <b id="tzTaille">—</b>' +
      '<span class="tz-ligne-note" id="tzLigneNote"></span>' +
      '<button type="button" class="btn ghost small" id="tzUtiliser">Utiliser cette taille</button>' +
      '</div>';
  }

  function majFormulaire(form, s) {
    if (!form) return null;
    var ligne = form.querySelector('#tzLigne');
    if (!ligne) return null;
    var val = function (nom) { var e = form.querySelector('[name="' + nom + '"]'); return e ? e.value : ''; };
    /* les Paramètres, pas la mémoire de la carte : le journal ne mélange pas les deux */
    var m = valeurs(s);
    var seg = form.querySelector('.seg[data-name="direction"] .seg-btn.active');
    var c = calcul({
      capital: m.capital, risquePct: m.risquePct, pipValuePerLot: m.pipValuePerLot,
      symbole: val('symbol') || m.symbole, entree: val('entry'), stop: val('stop'),
      sens: seg && seg.dataset.val ? seg.dataset.val : 'long'
    });
    var taille = ligne.querySelector('#tzTaille');
    var titre = ligne.querySelector('#tzLigneTitre');
    if (titre) {
      titre.textContent = 'Taille pour ' + fmt(m.risquePct, 2) + ' % de ' + fmt(m.capital, 0) + uniteSymb(devise(s)) + ' sur ce stop :';
    }
    var texteTaille = tailleTexte(c);
    var note = ligne.querySelector('#tzLigneNote');
    var bouton = ligne.querySelector('#tzUtiliser');
    if (c.taille === null) {
      if (taille) taille.textContent = '—';
      if (note) note.textContent = 'renseignez l\'entrée et le stop, ou le capital dans les Paramètres';
      if (bouton) bouton.disabled = true;
      return c;
    }
    if (taille) taille.textContent = texteTaille.replace(' (arrondi vers le bas)', '');
    if (note) {
      var miniTexte = fmt(c.risqueMini, 2) + uniteSymb(devise(s)) + ', soit ' + fmt(c.pctMini, 2) + ' % du capital';
      note.textContent = c.miniTropGros
        ? 'au plus petit lot (0,01), ce stop engage ' + miniTexte + ' : au-dessus du risque autorisé'
        : (c.taille >= MINI
          ? 'le plus petit lot (0,01) engage ' + miniTexte
          : 'trop petit pour 0,01 lot : il faudrait ' + fmt(c.capitalMini, 0) + uniteSymb(devise(s)) + ' à ' + fmt(c.risquePct, 2) + ' %');
    }
    if (note) note.className = 'tz-ligne-note' + (c.miniTropGros || c.taille < MINI ? ' refus' : '');
    if (bouton) bouton.disabled = false;
    return c;
  }

  function cablerFormulaire(form, s, apres) {
    if (!form) return;
    var ligne = form.querySelector('#tzLigne');
    if (!ligne) return;
    var rafraichir = function () { majFormulaire(form, s); };
    ['symbol', 'entry', 'stop'].forEach(function (nom) {
      var e = form.querySelector('[name="' + nom + '"]');
      if (e) { e.addEventListener('input', rafraichir); e.addEventListener('change', rafraichir); }
    });
    /* le sens est un contrôle segmenté : on écoute ses deux boutons */
    Array.prototype.forEach.call(form.querySelectorAll('.seg[data-name="direction"] .seg-btn'), function (b) {
      b.addEventListener('click', function () { setTimeout(rafraichir, 0); });
    });
    var bouton = ligne.querySelector('#tzUtiliser');
    if (bouton) bouton.addEventListener('click', function () {
      var c = majFormulaire(form, s);
      if (!c || c.taille === null) return;
      var champTaille = form.querySelector('[name="size"]');
      if (champTaille) champTaille.value = c.tailleArrondie;
      if (typeof apres === 'function') apres();
    });
    rafraichir();
    return true;
  }

  global.Taille = {
    calcul: calcul,
    carte: carte,
    cabler: cabler,
    majCarte: majCarte,
    bloc: bloc,
    cablerFormulaire: cablerFormulaire,
    majFormulaire: majFormulaire,
    lireReglages: lireReglages,
    valeurs: valeurs,
    tailleTexte: tailleTexte,
    regles: regles,
    MODELE: MODELE,
    MINI: MINI,
    MAX_STOP_PIPS: MAX_STOP_PIPS
  };
})(typeof window !== 'undefined' ? window : globalThis);
