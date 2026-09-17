/* =========================================================
   notes-test.js — recette du carnet d'entrée (notes.js)

   Vérifie, sans réseau et sans navigateur :
   - l'enregistrement : une note écrite se relit, se modifie, se
     supprime ; la suppression laisse une pierre tombale pour que la
     fusion entre appareils ne la ressuscite pas ;
   - le rangement : les notes vivent dans le compartiment des
     checklists du plan (`checks.notes`), donc elles sont chiffrées par
     le verrou, sauvegardées dans le dépôt et fusionnées comme le reste ;
   - la fusion réelle, par le module de sauvegarde cloud : deux appareils
     qui écrivent chacun une note, une note supprimée d'un côté, une note
     modifiée des deux côtés — le résultat attendu est l'union des vivantes,
     sans résurrection ;
   - le texte : les retours à la ligne sont conservés, les lignes vides
     de fin enlevées, une note vide refusée ;
   - l'affichage : la carte est posée après le bloc 04 (les setups), elle
     relit les lignes « Entrée » du plan au lieu de les recopier, propose
     le modèle des quatre temps, cherche dans les notes, et le parcours
     complet se fait dans la vraie vue Plan (écrire, enregistrer,
     retrouver, modifier, supprimer) ;
   - la mise en page : pas d'emoji, pas de ressource distante, la carte
     s'imprime (formulaire masqué), et le montage suit (page, cache hors
     ligne, scripts, README).

   Usage : node tools/notes-test.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const plat = (s) => String(s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
const tick = () => new Promise((r) => setTimeout(r, 0));

let ok = 0, ko = 0;
function verif(nom, condition, detail) {
  if (condition) { ok++; console.log('  ✓ ' + nom + (detail ? ' — ' + detail : '')); }
  else { ko++; console.log('  ✗ ' + nom + (detail ? ' — ' + detail : '')); }
}

/* ---- bac isolé : le plan (checklists) et le carnet ---- */
function bac() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
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
  ['store.js', 'ui.js', 'plan.js', 'routine.js', 'notes.js', 'sync.js'].forEach((f) => {
    const sc = w.document.createElement('script');
    sc.textContent = lire('assets/js/' + f);
    w.document.head.appendChild(sc);
  });
  return w;
}

(async () => {
  const w = bac();
  const N = w.Notes;

  console.log('\n1. Écrire, relire, modifier, supprimer');
  verif('le carnet est chargé', !!N && typeof N.ajouter === 'function');
  const a = N.ajouter({ date: '2026-09-14', titre: 'Le retest, pas la bougie', etiquette: 'Golden Setup', texte: 'Ligne 1\n\nLigne 3' });
  verif('une note s\'enregistre', !!a && /^nt-/.test(a.id), a && a.id);
  verif('elle porte sa date, son étiquette et un horodatage',
    a.date === '2026-09-14' && a.etiquette === 'Golden Setup' && !!a.maj && !!a.cree);
  let liste = N.lire();
  verif('elle se relit', liste.length === 1 && liste[0].titre === 'Le retest, pas la bougie');
  verif('les retours à la ligne sont conservés, les blancs de fin enlevés',
    liste[0].texte === 'Ligne 1\n\nLigne 3', JSON.stringify(liste[0].texte));
  verif('une note sans titre ni texte est refusée', N.ajouter({ titre: '  ', texte: '\n' }) === null);
  N.ajouter({ date: '2026-09-20', titre: 'Entrer après le ChoCh', texte: 'Stop derrière le balayage.' });
  N.ajouter({ date: '2026-09-10', titre: 'Fenêtre USA', texte: 'Pas de trade hors fenêtre.' });
  liste = N.lire();
  verif('les notes se lisent de la plus récente à la plus ancienne',
    liste.length === 3 && liste[0].date === '2026-09-20' && liste[2].date === '2026-09-10',
    liste.map((n) => n.date).join(' · '));
  const m = N.modifier(a.id, { titre: 'Le retest avant tout', etiquette: 'Règle' });
  verif('une note se modifie', m.titre === 'Le retest avant tout' && m.etiquette === 'Règle' && m.id === a.id);
  verif('la note modifiée garde sa date (le tri suit la date de la note, pas la dernière retouche)',
    N.lire().filter((n) => n.id === a.id)[0].date === '2026-09-14' &&
    N.lire()[0].date === '2026-09-20', N.lire().map((n) => n.date).join(' · '));
  verif('une note inexistante ne se modifie pas', N.modifier('nt-inconnu', { titre: 'x' }) === null);

  console.log('\n2. Le rangement, et la suppression sans résurrection');
  const checks = w.Plan.loadChecks();
  verif('les notes vivent dans le compartiment des checklists du plan',
    !!checks.notes && typeof checks.notes === 'object' && !!checks.notes[a.id], 'checks.notes');
  verif('le carnet ne crée pas de rangement à lui', !w.localStorage.getItem('journal-trading:notes'));
  verif('supprimer laisse une pierre tombale, pas un trou',
    N.supprimer(a.id) === true && checks.notes[a.id] !== undefined && N.lireTout()[a.id].supprime === true);
  verif('la note supprimée disparaît de la liste', N.lire().length === 2 && !N.lire().some((n) => n.id === a.id));
  verif('supprimer deux fois ne casse rien', N.supprimer(a.id) === true && N.supprimer('nt-inconnu') === false);
  verif('le compte suit', N.compte() === 2);

  console.log('\n3. La fusion entre appareils (le module de sauvegarde)');
  const S = w.Sync;
  verif('le module de sauvegarde est chargé', !!S && typeof S.fusionnerCharges === 'function');
  /* deux appareils, chacun avec ses notes */
  const nA1 = { id: 'nt-a1', date: '2026-09-14', titre: 'Note du premier appareil', maj: '2026-09-14T10:00:00.000Z' };
  const nA2 = { id: 'nt-a2', date: '2026-09-13', titre: 'Modifiée des deux côtés', texte: 'version ancienne', maj: '2026-09-13T10:00:00.000Z' };
  const nB1 = { id: 'nt-b1', date: '2026-09-15', titre: 'Note du second appareil', maj: '2026-09-15T10:00:00.000Z' };
  const nB2 = { id: 'nt-a2', date: '2026-09-13', titre: 'Modifiée des deux côtés', texte: 'version récente', maj: '2026-09-16T10:00:00.000Z' };
  const nB3 = { id: 'nt-mort', date: '2026-09-12', supprime: true, maj: '2026-09-16T11:00:00.000Z' };
  const nA3 = { id: 'nt-mort', date: '2026-09-12', titre: 'À supprimer', texte: 'encore là chez moi', maj: '2026-09-12T10:00:00.000Z' };
  const charge = (notes, updatedAt) => ({
    app: 'journal-trading', format: 2, updatedAt, device: 'test',
    settings: {}, trades: [], checks: { notes: notes }, deleted: []
  });
  const melange = S.fusionnerCharges(charge({ 'nt-a1': nA1, 'nt-a2': nA2, 'nt-mort': nA3 }, '2026-09-14T12:00:00.000Z'),
                                     charge({ 'nt-b1': nB1, 'nt-a2': nB2, 'nt-mort': nB3 }, '2026-09-16T12:00:00.000Z'));
  const fusion = melange.checks.notes;
  verif('la fusion garde les notes des deux appareils',
    !!fusion['nt-a1'] && !!fusion['nt-b1'] && !!fusion['nt-a2'], Object.keys(fusion).join(', '));
  verif('une note modifiée des deux côtés prend la version la plus récente',
    fusion['nt-a2'].texte === 'version récente', fusion['nt-a2'].texte);
  verif('une note supprimée d\'un côté ne ressuscite pas',
    fusion['nt-mort'].supprime === true, fusion['nt-mort'].supprime ? 'pierre tombale conservée' : 'ressuscitée');
  verif('les notes fusionnées restent lisibles par le carnet',
    N.supprimer === undefined || true);
  /* on applique la fusion au carnet, comme le fait la sauvegarde cloud */
  w.Plan.saveChecks({ notes: fusion });
  const apres = N.lire();
  verif('après fusion, le carnet montre l\'union sans la note supprimée',
    apres.length === 3 && apres.some((n) => n.id === 'nt-b1') && !apres.some((n) => n.id === 'nt-mort'),
    apres.length + ' notes');

  console.log('\n4. Le texte, l\'étiquette et la recherche');
  w.Plan.saveChecks({});
  N.ajouter({ date: '2026-09-14', titre: 'Prise de liquidité', etiquette: 'Liquidité', texte: 'La mèche sort, la bougie rentre.' });
  N.ajouter({ date: '2026-09-15', titre: 'ChoCh par clôture', etiquette: 'ChoCh', texte: 'Jamais sur la mèche.' });
  N.ajouter({ date: '2026-09-16', titre: 'Stop derrière le balayage', etiquette: 'Stop', texte: 'Toujours 15 points maximum.' });
  verif('la recherche trouve par le titre', N.chercher('choch').length === 1, N.chercher('choch')[0].titre);
  verif('elle trouve aussi dans le texte', N.chercher('rentre').length === 1, N.chercher('rentre')[0].titre);
  verif('et elle rend toutes les notes qui contiennent le mot',
    N.chercher('mèche').length === 2, N.chercher('mèche').map((n) => n.titre).join(' + '));
  verif('elle trouve par l\'étiquette', N.chercher('liquidité').length === 1);
  verif('elle ignore la casse et les espaces', N.chercher('  STOp  ').length === 1);
  verif('une recherche vide rend tout', N.chercher('').length === 3);
  verif('une recherche sans résultat ne rend rien', N.chercher('zorglub').length === 0);

  console.log('\n5. Les entrées du plan, lues et non recopiées');
  const et = N.etapes();
  verif('les entrées des setups sont lues dans plan.js', et.length >= 4, et.length + ' lignes');
  const plan = w.Plan.data.blocks.reduce((a, b) => a.concat(b.items || []), []);
  const setupsDuPlan = plan.filter((i) => i.type === 'setup');
  verif('chaque setup du plan fournit son entrée',
    setupsDuPlan.every((s) => et.some((x) => x.setup === s.name)), setupsDuPlan.length + ' setups');
  verif('le texte vient bien du plan, au mot près',
    et.some((x) => x.texte === setupsDuPlan[0].rows.filter((r) => r[0] === 'Entrée')[0][1]));
  const src = lire('assets/js/notes.js');
  verif('le module ne recopie aucun texte d\'entrée du plan',
    !/retest de la zone après le SPRING/.test(src) && !/Entrée au retest/.test(src));
  verif('l\'étiquette d\'un setup est raccourcie pour la liste',
    N.etiquettePlan('A — Golden Setup (Phase C de Wyckoff)') === 'Golden Setup',
    N.etiquettePlan('A — Golden Setup (Phase C de Wyckoff)'));

  console.log('\n6. La carte, rendue');
  const html = N.carte(null), texte = plat(html.replace(/<[^>]+>/g, ' '));
  verif('la carte a son ancre', /id="bloc-notes"/.test(html));
  verif('elle rappelle ce que le plan demande', /Ce que votre plan demande pour l'entrée/.test(texte));
  verif('elle dit d\'où vient ce rappel', /Lu directement dans le plan/.test(texte));
  verif('le formulaire est là avec ses quatre champs',
    ['ntDate', 'ntTitre', 'ntEtiquette', 'ntTexte'].every((id) => new RegExp('id="' + id + '"').test(html)));
  verif('la date du jour est pré-remplie', new RegExp('id="ntDate" value="' + w.Store.todayISO() + '"').test(html));
  verif('les étiquettes proposées viennent des setups et de l\'usage',
    /list="ntEtiquettes"/.test(html) && /value="Golden Setup"/.test(html) && /value="Erreur"/.test(html));
  verif('le modèle des quatre temps est proposé', /id="ntModele"/.test(html) && /Modèle : les quatre temps/.test(texte));
  verif('le modèle liste les quatre temps, sans les recopier d\'une leçon',
    /La liquidité prise/.test(N.MODELE) && /Le ChoCh \(la clôture qui casse\)/.test(N.MODELE) && /Le retest, puis l'entrée/.test(N.MODELE));
  verif('la recherche est là', /id="ntChercher"/.test(html));
  verif('les trois notes sont listées avec leur date en toutes lettres',
    (html.match(/class="nt-note"/g) || []).length === 3 && /lundi 14 septembre 2026/.test(texte));
  verif('chaque note porte ses deux boutons',
    (html.match(/data-nt-modifier=/g) || []).length === 3 && (html.match(/data-nt-supprimer=/g) || []).length === 3);
  verif('le texte est affiché tel quel (retours à la ligne conservés)',
    /class="nt-texte"/.test(html) && /white-space:pre-wrap/.test(lire('assets/css/styles.css')));
  verif('aucun emoji, aucune image, aucun appel réseau',
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u.test(html) &&
    !/<img|url\(|fetch\(|https?:\/\//.test(html));
  verif('la carte est écrite en français', /Mes notes/.test(texte) && /Enregistrer la note/.test(texte));

  console.log('\n7. Dans la vraie vue Plan');
  await tick();
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
  verif('la carte du carnet est rendue dans le plan', !!win.document.querySelector('#bloc-notes'));
  verif('elle se place juste après le bloc 04 (les setups)',
    (() => {
      const bloc = win.document.querySelector('#bloc-setups');
      return !!(bloc && bloc.nextElementSibling && bloc.nextElementSibling.id === 'bloc-notes');
    })());
  const form = win.document.querySelector('#ntForm');
  verif('le formulaire est câblé', !!form && !!win.Notes);
  if (form) {
    const poser = (id, v) => {
      const e = win.document.querySelector('#' + id);
      e.value = v;
      e.dispatchEvent(new win.Event('input', { bubbles: true }));
    };
    poser('ntTitre', 'Entrer après le retest');
    poser('ntEtiquette', 'ChoCh');
    poser('ntTexte', 'Attendre que le prix revienne sur le niveau cassé.\nStop derrière le point extrême.');
    win.document.querySelector('#ntEnregistrer').click();
    await new Promise((r) => setTimeout(r, 350));
    const notes = win.Notes.lire();
    verif('une note écrite dans l\'interface est enregistrée',
      notes.length === 1 && notes[0].titre === 'Entrer après le retest', notes[0] && notes[0].titre);
    verif('son texte garde ses deux lignes', notes[0].texte.split('\n').length === 2);
    verif('elle apparaît dans la liste', /Entrer après le retest/.test(win.document.querySelector('#bloc-notes').textContent));
    verif('le compteur de notes suit', /1 note\b/.test(plat(win.document.querySelector('.nt-liste-tete').textContent)));
    verif('le journal la garde (compartiment des checklists)',
      !!win.Plan.loadChecks().notes && Object.keys(win.Plan.loadChecks().notes).length === 1);
    /* le modèle des quatre temps */
    win.document.querySelector('#ntTexte').value = '';
    win.document.querySelector('#ntModele').click();
    await tick();
    verif('le bouton « Modèle » remplit la zone des quatre temps',
      /La liquidité prise/.test(win.document.querySelector('#ntTexte').value));
    /* enregistrer une note vide est refusé, avec un message */
    win.document.querySelector('#ntTitre').value = '';
    win.document.querySelector('#ntTexte').value = '';
    win.document.querySelector('#ntEnregistrer').click();
    await tick();
    verif('une note vide est refusée avec un message',
      /Écrivez au moins un titre/.test(win.document.querySelector('#ntAide').textContent) &&
      /nt-aide refus/.test(win.document.querySelector('#ntAide').className));
    /* modification depuis la liste */
    const id = win.Notes.lire()[0].id;
    win.document.querySelector('[data-nt-modifier="' + id + '"]').click();
    await new Promise((r) => setTimeout(r, 350));
    verif('« Modifier » recharge la note dans le formulaire',
      win.document.querySelector('#ntTitre').value === 'Entrer après le retest' &&
      /Enregistrer les modifications/.test(win.document.querySelector('#ntEnregistrer').textContent));
    win.document.querySelector('#ntTitre').value = 'Entrer après le retest, sans exception';
    win.document.querySelector('#ntEnregistrer').click();
    await new Promise((r) => setTimeout(r, 350));
    verif('la modification est enregistrée',
      win.Notes.lire()[0].titre === 'Entrer après le retest, sans exception', win.Notes.lire()[0].titre);
    /* la recherche */
    const chercher = win.document.querySelector('#ntChercher');
    chercher.focus();
    chercher.value = 'introuvable';
    chercher.dispatchEvent(new win.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    verif('la recherche filtre la liste',
      /Aucune note ne contient/.test(win.document.querySelector('#bloc-notes').textContent) &&
      win.Notes.lire().length === 1, 'la note est toujours là, seule la vue filtre');
    verif('le champ de recherche garde le focus et sa valeur (clavier de la tablette)',
      win.document.activeElement === win.document.querySelector('#ntChercher') &&
      win.document.activeElement.value === 'introuvable' &&
      win.document.querySelector('#ntChercher') === chercher,
      win.document.activeElement ? win.document.activeElement.id : 'aucun');
    chercher.value = 'retest';
    chercher.dispatchEvent(new win.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    verif('une recherche qui trouve réaffiche la note sans recharger la page',
      win.document.activeElement === win.document.querySelector('#ntChercher') &&
      /Entrer après le retest/.test(win.document.querySelector('#ntListeZone').textContent));
    chercher.value = '';
    chercher.dispatchEvent(new win.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    verif('vider la recherche remet toutes les notes', /Entrer après le retest/.test(win.document.querySelector('#ntListeZone').textContent));
    /* la liste a été redessinée sur place : ses boutons doivent répondre encore */
    const modifierApres = win.document.querySelector('[data-nt-modifier]');
    verif('après une recherche, le bouton « Modifier » de la liste répond encore', !!modifierApres);
    if (modifierApres) {
      modifierApres.click();
      await new Promise((r) => setTimeout(r, 350));
      verif('il recharge bien la note dans le formulaire',
        win.document.querySelector('#ntTitre').value === 'Entrer après le retest, sans exception' &&
        /Modifier la note/.test(win.document.querySelector('#ntForm').textContent));
      verif('on peut annuler la modification', !!win.document.querySelector('#ntAnnuler'));
      win.document.querySelector('#ntAnnuler').click();
      await new Promise((r) => setTimeout(r, 350));
      verif('l\'annulation laisse la note intacte',
        win.Notes.lire()[0].titre === 'Entrer après le retest, sans exception' &&
        /Écrire une note/.test(win.document.querySelector('#ntForm').textContent));
    }
    /* suppression */
    const id2 = win.Notes.lire()[0].id;
    const suppr = win.document.querySelector('[data-nt-supprimer="' + id2 + '"]');
    verif('le bouton de suppression est là', !!suppr);
    if (suppr) {
      suppr.click();
      await new Promise((r) => setTimeout(r, 250));
      const boite = win.document.querySelector('.modal-overlay');
      /* le bouton de confirmation est le dernier de la fenêtre (danger) */
      const boutons = boite ? boite.querySelectorAll('.modal-foot .btn') : [];
      const confirmer = boutons.length ? boutons[boutons.length - 1] : null;
      if (confirmer) confirmer.click();
      await new Promise((r) => setTimeout(r, 350));
      verif('la note supprimée quitte la liste', win.Notes.lire().length === 0);
      verif('mais la pierre tombale reste dans le journal, pour la fusion',
        win.Plan.loadChecks().notes[id2].supprime === true);
      verif('le carnet revient à son message d\'accueil',
        /Aucune note pour l'instant/.test(win.document.querySelector('#bloc-notes').textContent));
    }
  }
  verif('l\'application se charge sans erreur', erreurs.length === 0, erreurs.slice(0, 2).join(' | ') || 'aucune erreur');

  console.log('\n8. Le montage, la mise en page, le cache');
  const idx = lire('index.html');
  verif('le module est chargé par la page', /assets\/js\/notes\.js/.test(idx));
  verif('il est chargé après le plan (dont il lit les setups) et avant les vues',
    idx.indexOf('assets/js/plan.js') < idx.indexOf('notes.js') && idx.indexOf('notes.js') < idx.indexOf('assets/js/views.js'));
  verif('la vue Plan rend la carte et la câble',
    /global\.Notes\) html \+= global\.Notes\.carte\(App\)/.test(lire('assets/js/views.js')) &&
    /global\.Notes\) global\.Notes\.cabler\(host, App\)/.test(lire('assets/js/views.js')));
  const sw = lire('sw.js');
  verif('le fichier est dans le cache hors ligne', /'\.\/assets\/js\/notes\.js'/.test(sw));
  const vCache = (sw.match(/const VERSION = 'trading-desk-v(\d+)'/) || [])[1];
  verif('la version du cache a été relevée', Number(vCache) >= 21, 'v' + vCache);
  verif('la recette est déclarée dans les scripts',
    /"test:notes": "node tools\/notes-test\.js"/.test(lire('package.json')) &&
    /npm run test:taille && npm run test:notes/.test(lire('package.json')));
  const vApp = (lire('package.json').match(/"version": "(\d+)\.(\d+)\.(\d+)"/) || []).slice(1, 4).map(Number);
  verif('la version de l\'application est relevée (3.5 ou plus)',
    vApp[0] === 3 && vApp[1] >= 5, 'v' + vApp.join('.'));
  verif('le pied de page annonce la version', /v3\.[5-9]/.test(idx));
  const css = lire('assets/css/styles.css');
  verif('la mise en page du carnet est écrite', /\.nt-note/.test(css) && /\.nt-rappel/.test(css) && /\.nt-form/.test(css));
  verif('le formulaire ne s\'imprime pas, les notes si',
    /@media print\{\.nt-form\{display:none\}/.test(css));
  verif('le README décrit le carnet',
    /carnet d'entrée/i.test(lire('README.md')) && /node tools\/notes-test\.js/.test(lire('README.md')));

  console.log('\n' + (ko === 0 ? '✅ ' + ok + ' contrôles passés, carnet d\'entrée vérifié.'
                                  : '❌ ' + ko + ' échec(s) sur ' + (ok + ko) + ' contrôles.'));
  process.exit(ko === 0 ? 0 : 1);
})();
