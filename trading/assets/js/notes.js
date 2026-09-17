/* =========================================================
   notes.js — Le carnet d'entrée

   « La bonne manière de rentrer en position » ne se lit pas, elle
   s'écrit : ce carnet est là pour ça. Chaque note porte sa date, un
   titre, une étiquette libre et le texte qu'on veut — ce qu'on a vu,
   ce qu'on a fait, ce qu'on referait.

   Trois choses sont tenues par la conception :

   1. Les entrées du plan ne sont PAS recopiées. La carte affiche les
      lignes « Entrée » des setups en les LISANT dans plan.js (comme la
      routine lit ses moments) : le jour où le plan change, le carnet
      suit sans qu'une ligne soit à réécrire.
   2. Les notes vivent dans le même compartiment que les checklists et
      la routine (`checks.notes`, via Plan.loadChecks/saveChecks) : elles
      sont donc chiffrées par le verrou, sauvegardées dans le dépôt
      GitHub et fusionnées entre appareils sans code en plus.
   3. Une note supprimée laisse une pierre tombale (`supprime: true`) :
      la fusion ne la ressuscite pas depuis un autre appareil.

   API : window.Notes = { CLE, lire, lireTout, ajouter, modifier,
                          supprimer, chercher, etapes, carte, cabler,
                          MODELE, VIDE }
   ========================================================= */
'use strict';

(function (global) {
  var CLE = 'notes';                  /* dans les checklists du plan */
  var MAX = 400;                      /* au-delà, on élague les plus anciennes pierres */

  /* Le squelette proposé par le bouton « Modèle » : une forme à remplir,
     jamais une leçon recopiée. */
  var MODELE = 'La liquidité prise :\n\n' +
    'Le dernier extrême formé :\n\n' +
    'Le ChoCh (la clôture qui casse) :\n\n' +
    'Le retest, puis l\'entrée :\n\n' +
    'Où je pose mon stop :\n\n' +
    'Ce que j\'en retiens :';

  var VIDE = 'Aucune note pour l\'instant. Écrivez ce que vous avez vu, ce que vous avez fait, ' +
    'et ce que vous referiez — c\'est ce texte-là qui sert la prochaine fois.';

  /* ---------------------------------------------------------
     Outils
     --------------------------------------------------------- */
  function esc(s) { return (global.UI && global.UI.esc) ? global.UI.esc(s) : String(s == null ? '' : s); }
  function attr(s) { return (global.UI && global.UI.attr) ? global.UI.attr(s) : esc(s); }
  function aujourdhui() {
    if (global.Store && global.Store.todayISO) return global.Store.todayISO();
    return new Date().toISOString().slice(0, 10);
  }
  function estDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function jourLong(iso) {
    if (global.Routine && global.Routine.jourLong) return global.Routine.jourLong(iso);
    return iso;
  }
  function identifiant() {
    return 'nt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function maintenant() { return new Date().toISOString(); }
  /* le texte est saisi dans un champ : on garde les retours à la ligne,
     on enlève juste les espaces inutiles */
  function nettoie(t) {
    return String(t == null ? '' : t).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------------------------------------------------------
     Lecture / écriture : le compartiment des checklists du plan
     --------------------------------------------------------- */
  function lireTout() {
    var checks = {};
    try { checks = (global.Plan && global.Plan.loadChecks()) || {}; } catch (e) { checks = {}; }
    var brut = checks[CLE];
    return (brut && typeof brut === 'object') ? brut : {};
  }

  function ecrireTout(tout) {
    try {
      var checks = (global.Plan && global.Plan.loadChecks()) || {};
      checks[CLE] = elaguer(tout);
      if (global.Plan) global.Plan.saveChecks(checks);
      /* le reste de l'application garde les checklists en mémoire */
      if (global.App && global.App.state) global.App.state.checks = checks;
      if (global.App && global.App.persist) global.App.persist();
    } catch (e) { /* journal indisponible : on n'empêche pas d'écrire la note à l'écran */ }
    return tout;
  }

  /** Les pierres tombales s'accumulent : on garde les plus récentes. */
  function elaguer(tout) {
    var cles = Object.keys(tout);
    if (cles.length <= MAX) return tout;
    var mortes = cles.filter(function (k) { return tout[k] && tout[k].supprime; })
      .sort(function (a, b) { return String(tout[a].maj || '').localeCompare(String(tout[b].maj || '')); });
    var propre = {};
    cles.forEach(function (k) { propre[k] = tout[k]; });
    while (Object.keys(propre).length > MAX && mortes.length) delete propre[mortes.shift()];
    return propre;
  }

  /** Les notes vivantes, de la plus récente à la plus ancienne. */
  function lire() {
    var tout = lireTout();
    return Object.keys(tout).map(function (k) { return tout[k]; })
      .filter(function (n) { return n && !n.supprime && (n.titre || n.texte); })
      .sort(function (a, b) {
        var d = String(b.date || '').localeCompare(String(a.date || ''));
        if (d) return d;
        return String(b.maj || '').localeCompare(String(a.maj || ''));
      });
  }

  /* ---------------------------------------------------------
     Écrire une note, la modifier, la supprimer
     --------------------------------------------------------- */
  function propre(n, base) {
    n = n || {};
    var p = Object.assign({}, base || {});
    if (n.date !== undefined) p.date = estDate(n.date) ? n.date : aujourdhui();
    if (n.titre !== undefined) p.titre = nettoie(n.titre).slice(0, 160);
    if (n.etiquette !== undefined) p.etiquette = nettoie(n.etiquette).slice(0, 60);
    if (n.texte !== undefined) p.texte = nettoie(n.texte);
    if (!p.date) p.date = aujourdhui();
    p.maj = maintenant();
    delete p.supprime;
    return p;
  }

  function ajouter(n) {
    if (!n || (!nettoie(n.titre) && !nettoie(n.texte))) return null;
    var tout = lireTout();
    var note = propre(n, { id: identifiant(), cree: maintenant() });
    tout[note.id] = note;
    ecrireTout(tout);
    return note;
  }

  function modifier(id, champs) {
    var tout = lireTout();
    if (!tout[id] || tout[id].supprime) return null;
    tout[id] = propre(champs, tout[id]);
    ecrireTout(tout);
    return tout[id];
  }

  /** On ne supprime pas la ligne : on pose une pierre tombale, pour que
      la note ne revienne pas lors de la prochaine fusion entre appareils. */
  function supprimer(id) {
    var tout = lireTout();
    if (!tout[id]) return false;
    tout[id] = { id: id, date: tout[id].date, supprime: true, maj: maintenant() };
    ecrireTout(tout);
    return true;
  }

  function chercher(texte, liste) {
    var q = nettoie(texte).toLowerCase();
    if (!q) return liste || lire();
    return (liste || lire()).filter(function (n) {
      return (n.titre + ' ' + n.etiquette + ' ' + n.texte).toLowerCase().indexOf(q) > -1;
    });
  }

  function compte() { return lire().length; }

  /* ---------------------------------------------------------
     Les entrées du plan, lues dans plan.js (jamais recopiées)
     --------------------------------------------------------- */
  function etapes() {
    var sortie = [];
    var blocs = (global.Plan && global.Plan.data && global.Plan.data.blocks) || [];
    blocs.forEach(function (b) {
      (b.items || []).forEach(function (it) {
        if (!it || it.type !== 'setup' || !it.rows) return;
        it.rows.forEach(function (r) {
          if (String(r[0]).toLowerCase().indexOf('entrée') !== 0) return;
          sortie.push({ setup: it.name, texte: r[1], tag: it.tag });
        });
      });
    });
    /* la règle d'entrée du bloc risque, quand elle est écrite là-bas */
    blocs.forEach(function (b) {
      (b.items || []).forEach(function (it) {
        if (it && it.type === 'kv') {
          (it.rows || []).forEach(function (r) {
            if (/^(entrée|déclencheur)$/i.test(String(r[0]))) sortie.push({ setup: r[0], texte: r[1], tag: '' });
          });
        }
      });
    });
    return sortie;
  }

  function etiquettePlan(nom) {
    /* « A — Golden Setup (Phase C de Wyckoff) » → « Golden Setup » */
    var t = String(nom || '');
    var m = t.match(/—\s*(.+)$/);
    var court = m ? m[1] : t;
    court = court.replace(/\s*\(.+\)\s*$/, '').trim();
    return court || t;
  }

  /* ---------------------------------------------------------
     L'affichage
     --------------------------------------------------------- */
  var edite = null;        /* la note en cours de modification */
  var recherche = '';

  function rappelHTML() {
    var e = etapes();
    if (!e.length) return '';
    return '<div class="nt-rappel"><h4>Ce que votre plan demande pour l\'entrée</h4>' +
      '<ul>' + e.map(function (x) {
        return '<li><b>' + esc(etiquettePlan(x.setup)) + '</b><span>' + esc(x.texte) + '</span></li>';
      }).join('') + '</ul>' +
      '<p class="nt-rappel-note">Lu directement dans le plan (blocs 03 et 04) : si vous le modifiez, cette liste suit.</p></div>';
  }

  function noteHTML(n) {
    return '<article class="nt-note" data-note="' + attr(n.id) + '">' +
      '<header><span class="nt-date">' + esc(jourLong(n.date)) + '</span>' +
      (n.etiquette ? '<span class="nt-etiquette">' + esc(n.etiquette) + '</span>' : '') + '</header>' +
      (n.titre ? '<h5>' + esc(n.titre) + '</h5>' : '') +
      (n.texte ? '<p class="nt-texte">' + esc(n.texte) + '</p>' : '') +
      '<footer><button type="button" class="btn ghost small" data-nt-modifier="' + attr(n.id) + '">Modifier</button>' +
      '<button type="button" class="btn ghost small" data-nt-supprimer="' + attr(n.id) + '">Supprimer</button>' +
      '<span class="nt-maj">enregistrée le ' + esc(jourLong(String(n.maj || '').slice(0, 10) || n.date)) + '</span>' +
      '</footer></article>';
  }

  function formHTML() {
    var n = edite ? (lireTout()[edite] || {}) : {};
    var s = (global.App && global.App.state && global.App.state.settings) || {};
    var etiquettes = (s.setups || []).map(etiquettePlan)
      .concat(etapes().map(function (x) { return etiquettePlan(x.setup); }))
      .concat(['Règle', 'Erreur', 'À refaire', 'Observation']);
    var vues = {};
    etiquettes = etiquettes.filter(function (x) {
      if (!x || vues[x]) return false;
      vues[x] = true; return true;
    });
    return '<form class="nt-form" id="ntForm" autocomplete="off" onsubmit="return false">' +
      '<h4>' + (edite ? 'Modifier la note' : 'Écrire une note') + '</h4>' +
      '<div class="nt-champs">' +
      '<div class="form-field"><label for="ntDate">Date</label>' +
      '<input class="input" type="date" id="ntDate" value="' + attr(n.date || aujourdhui()) + '"></div>' +
      '<div class="form-field"><label for="ntTitre">Titre</label>' +
      '<input class="input" type="text" id="ntTitre" maxlength="160" placeholder="Ce que je veux retenir" value="' + attr(n.titre || '') + '"></div>' +
      '<div class="form-field"><label for="ntEtiquette">Étiquette</label>' +
      '<input class="input" type="text" id="ntEtiquette" maxlength="60" list="ntEtiquettes" placeholder="Setup, règle, erreur" value="' + attr(n.etiquette || '') + '">' +
      '<datalist id="ntEtiquettes">' + etiquettes.map(function (x) { return '<option value="' + attr(x) + '">'; }).join('') + '</datalist></div>' +
      '</div>' +
      '<div class="form-field"><label for="ntTexte">La note</label>' +
      '<textarea class="input nt-zone" id="ntTexte" rows="6" placeholder="Ce que j\'ai vu, ce que j\'ai fait, ce que je referais.">' + esc(n.texte || '') + '</textarea></div>' +
      '<div class="nt-actions">' +
      '<button type="button" class="btn primary" id="ntEnregistrer">' + (edite ? 'Enregistrer les modifications' : 'Enregistrer la note') + '</button>' +
      '<button type="button" class="btn ghost" id="ntModele">Modèle : les quatre temps</button>' +
      (edite ? '<button type="button" class="btn ghost" id="ntAnnuler">Annuler la modification</button>' : '') +
      '<span class="nt-aide" id="ntAide"></span>' +
      '</div></form>';
  }

  function listeHTML(liste, vues) {
    if (!liste.length) return '<p class="nt-vide">' + esc(VIDE) + '</p>';
    if (!vues.length) {
      return '<p class="nt-vide">Aucune note ne contient « ' + esc(nettoie(recherche)) + ' ».</p>';
    }
    return '<div class="nt-liste" id="ntListe">' + vues.map(noteHTML).join('') + '</div>';
  }

  function carte() {
    var liste = lire();
    var vues = chercher(recherche, liste);
    var h = '<section class="plan-block" id="bloc-notes">' +
      '<header><h3>Mes notes — la bonne manière de rentrer en position</h3></header>' +
      '<p class="lead">Le plan dit <i>où</i> entrer ; ce carnet dit <i>comment vous y arrivez</i>. Vos notes s\'enregistrent ' +
      'avec le journal : chiffrées par le verrou, sauvegardées dans votre dépôt, fusionnées entre appareils.</p>' +
      rappelHTML() + formHTML();

    h += '<div class="nt-liste-tete"><h4>' + (liste.length === 0 ? 'Mes notes' : liste.length + ' note' + (liste.length > 1 ? 's' : '')) + '</h4>' +
      '<input class="input" type="search" id="ntChercher" list="ntTitres" placeholder="Chercher dans mes notes" value="' + attr(recherche) + '">' +
      '<datalist id="ntTitres">' + liste.map(function (n) { return '<option value="' + attr(n.titre || '') + '">'; }).join('') + '</datalist>' +
      '</div>';

    h += '<div id="ntListeZone">' + listeHTML(liste, vues) + '</div></section>';
    return h;
  }

  /* ---------------------------------------------------------
     Le câblage
     --------------------------------------------------------- */
  function cabler(host, App) {
    if (!host) return;
    var form = host.querySelector('#ntForm');
    if (!form) return;
    var champ = function (id) { var e = host.querySelector('#' + id); return e ? e.value : ''; };
    var aide = host.querySelector('#ntAide');
    var dire = function (texte, ton) {
      if (!aide) return;
      aide.textContent = texte || '';
      aide.className = 'nt-aide' + (ton ? ' ' + ton : '');
    };
    var recharger = function () { if (App && App.render) App.render(); };

    var enregistrer = host.querySelector('#ntEnregistrer');
    if (enregistrer) enregistrer.addEventListener('click', function () {
      var donnees = { date: champ('ntDate'), titre: champ('ntTitre'), etiquette: champ('ntEtiquette'), texte: champ('ntTexte') };
      if (!nettoie(donnees.titre) && !nettoie(donnees.texte)) {
        dire('Écrivez au moins un titre ou une note.', 'refus');
        return;
      }
      if (edite) { modifier(edite, donnees); edite = null; } else { ajouter(donnees); }
      recharger();
    });

    var modele = host.querySelector('#ntModele');
    if (modele) modele.addEventListener('click', function () {
      var zone = host.querySelector('#ntTexte');
      if (!zone) return;
      if (nettoie(zone.value)) { dire('Le modèle s\'ajoute à la suite du texte existant.', ''); zone.value = nettoie(zone.value) + '\n\n' + MODELE; }
      else { zone.value = MODELE; dire('Complétez chaque ligne, puis enregistrez.', ''); }
      zone.focus();
    });

    var annuler = host.querySelector('#ntAnnuler');
    if (annuler) annuler.addEventListener('click', function () { edite = null; recharger(); });

    function cablerListe() {
      Array.prototype.forEach.call(host.querySelectorAll('[data-nt-modifier]'), function (b) {
        b.addEventListener('click', function () {
          edite = b.dataset.ntModifier;
          recharger();
          var zone = host.querySelector('#ntTexte');
          if (zone && zone.scrollIntoView) zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-nt-supprimer]'), function (b) {
        b.addEventListener('click', function () {
          var id = b.dataset.ntSupprimer;
          var note = lireTout()[id] || {};
          var question = 'Supprimer cette note' + (note.titre ? ' (« ' + note.titre + ' »)' : '') + ' ?';
          var faire = function () { supprimer(id); if (edite === id) edite = null; recharger(); };
          if (global.UI && global.UI.confirmDialog) {
            global.UI.confirmDialog({ title: 'Supprimer la note', message: question, confirmLabel: 'Supprimer', danger: true })
              .then(function (confirme) { if (confirme) faire(); });
          } else if (!global.confirm || global.confirm(question)) { faire(); }
        });
      });
    }
    cablerListe();

    var rechercheChamp = host.querySelector('#ntChercher');
    if (rechercheChamp) {
      rechercheChamp.addEventListener('input', function () {
        recherche = rechercheChamp.value;
        /* on ne redessine que la liste : le champ garde le focus et le
           curseur, sinon le clavier de la tablette se referme à chaque lettre */
        var zone = host.querySelector('#ntListeZone');
        if (zone) {
          zone.innerHTML = listeHTML(lire(), chercher(recherche));
          /* la liste est neuve : ses boutons doivent être recâblés */
          cablerListe();
        }
      });
    }
    return true;
  }

  global.Notes = {
    CLE: CLE,
    MODELE: MODELE,
    VIDE: VIDE,
    lire: lire,
    lireTout: lireTout,
    ajouter: ajouter,
    modifier: modifier,
    supprimer: supprimer,
    chercher: chercher,
    compte: compte,
    etapes: etapes,
    etiquettePlan: etiquettePlan,
    carte: carte,
    cabler: cabler,
    /* pour la recette */
    etat: function () { return { edite: edite, recherche: recherche }; },
    reinitialiser: function () { edite = null; recherche = ''; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
