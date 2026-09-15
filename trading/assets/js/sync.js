/* =========================================================
   sync.js — Sauvegarde cloud (dépôt GitHub) + états d'erreur
   ---------------------------------------------------------
   Fonctionnement :
   - le navigateur reste la source de vérité et fonctionne hors ligne ;
   - chaque modification locale est marquée « à sauvegarder » ;
   - dès que le réseau revient (ou après une courte pause), le fichier
     de sauvegarde est écrit dans le dépôt GitHub configuré ;
   - au démarrage, si le cloud contient une version plus récente,
     l'application propose de la récupérer ou de fusionner.

   12 états exposés par Sync.status() :
   off · empty · offline · pending · syncing · ok · remote ·
   conflict · auth · quota · server · error
   ========================================================= */
(function (global) {
  'use strict';

  var CFG_KEY = 'journal-trading:cloud';
  var ST_KEY = 'journal-trading:sync';
  var API = 'https://api.github.com';
  var DEFAUT = {
    owner: 'moussantji', repo: 'journal-trading', branch: 'main', path: 'journal-trading/sauvegarde.json',
    token: '', enabled: false, autoSync: true
  };
  var DELAI_AUTO = 45000;      // 45 s après la dernière modification
  var TIMEOUT = 15000;         // délai maximum par appel réseau

  /* ---------------------------------------------------------
     Stockage local de la configuration et de l'état
     --------------------------------------------------------- */
  function lire(cle, defaut) {
    try {
      var brut = global.localStorage.getItem(cle);
      return brut ? JSON.parse(brut) : defaut;
    } catch (e) { return defaut; }
  }
  function ecrire(cle, valeur) {
    try { global.localStorage.setItem(cle, JSON.stringify(valeur)); return true; }
    catch (e) { return false; }
  }

  function loadConfig() {
    var c = Object.assign({}, DEFAUT, lire(CFG_KEY, {}) || {});
    c.enabled = !!c.enabled && !!c.owner && !!c.repo && !!c.token;
    return c;
  }
  function saveConfig(patch) {
    var c = Object.assign(loadConfig(), patch || {});
    c.owner = String(c.owner || '').trim();
    c.repo = String(c.repo || '').trim();
    c.branch = String(c.branch || 'main').trim() || 'main';
    c.path = String(c.path || DEFAUT.path).trim() || DEFAUT.path;
    c.token = String(c.token || '').trim();
    c.enabled = !!c.enabled && !!c.owner && !!c.repo && !!c.token;
    ecrire(CFG_KEY, c);
    emit();
    return c;
  }
  function clearConfig() {
    try { global.localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ }
    etatRepos = { lastSyncAt: null, remoteUpdatedAt: null, remoteSha: null, pending: false, error: null, log: [] };
    ecrire(ST_KEY, etatRepos);
    emit();
  }
  function isConfigured() { return loadConfig().enabled; }

  var etatRepos = Object.assign({
    lastSyncAt: null, remoteUpdatedAt: null, remoteSha: null,
    pending: false, error: null, log: []
  }, lire(ST_KEY, {}) || {});

  function saveEtat() { ecrire(ST_KEY, etatRepos); }
  function journaliser(texte, ton) {
    etatRepos.log = (etatRepos.log || []).slice(-9);
    etatRepos.log.push({ at: new Date().toISOString(), text: texte, tone: ton || 'info' });
    etatRepos.log = etatRepos.log.slice(-10);
    saveEtat();
  }

  /* ---------------------------------------------------------
     Abonnés (pour rafraîchir l'interface)
     --------------------------------------------------------- */
  var abonnes = [];
  function onChange(cb) { abonnes.push(cb); }
  function emit() { abonnes.forEach(function (cb) { try { cb(status()); } catch (e) { /* ignore */ } }); }

  /* ---------------------------------------------------------
     États
     --------------------------------------------------------- */
  function status() {
    var c = loadConfig();
    var code = 'off';
    if (c.enabled) {
      if (!global.navigator || global.navigator.onLine === false) {
        code = (etatRepos.pending || etatRepos.remoteUpdatedAt === null) ? 'offline' : 'ok';
      } else if (etatRepos.error && etatRepos.error.code) {
        code = etatRepos.error.code;
      } else if (etatRepos.conflict) {
        code = 'conflict';
      } else if (etatRepos.busy) {
        code = 'syncing';
      } else if (etatRepos.remoteNeuf) {
        code = 'remote';
      } else if (etatRepos.pending) {
        code = 'pending';
      } else if (!etatRepos.lastSyncAt) {
        code = 'empty';
      } else {
        code = 'ok';
      }
    }
    return Object.assign({}, etatRepos, { code: code, label: LIBELLES[code].label(resume()), tone: LIBELLES[code].tone });
  }

  function resume() {
    return {
      pending: etatRepos.pending,
      lastSyncAt: etatRepos.lastSyncAt,
      remoteUpdatedAt: etatRepos.remoteUpdatedAt,
      error: etatRepos.error,
      date: dateCourte(etatRepos.lastSyncAt),
      dateDistante: dateCourte(etatRepos.remoteUpdatedAt),
      chemin: cheminLisible()
    };
  }

  var LIBELLES = {
    off:      { tone: 'flat', label: function () { return 'Sauvegarde cloud désactivée'; } },
    empty:    { tone: 'warn', label: function () { return 'Configuré, aucune sauvegarde envoyée pour l\'instant'; } },
    offline:  { tone: 'warn', label: function (r) { return r.pending ? 'Hors ligne — ' + r.pending + ' modification' + (r.pending > 1 ? 's' : '') + ' en attente' : 'Hors ligne — les données restent sur cet appareil'; } },
    pending:  { tone: 'warn', label: function (r) { return (r.pending || 0) + ' modification' + ((r.pending || 0) > 1 ? 's' : '') + ' à sauvegarder'; } },
    syncing:  { tone: 'info', label: function () { return 'Synchronisation en cours…'; } },
    ok:       { tone: 'ok',   label: function (r) { return r.lastSyncAt ? 'À jour · sauvegardé le ' + r.date : 'À jour'; } },
    remote:   { tone: 'info', label: function (r) { return 'Sauvegarde disponible dans le cloud (' + (r.dateDistante || 'date inconnue') + ')'; } },
    conflict: { tone: 'warn', label: function (r) { return 'Conflit : le cloud a été modifié ailleurs (' + (r.dateDistante || 'date inconnue') + ')'; } },
    auth:     { tone: 'ko',   label: function () { return 'Clé refusée : vérifiez le jeton et ses droits'; } },
    quota:    { tone: 'ko',   label: function () { return 'Quota GitHub atteint — réessayez plus tard'; } },
    server:   { tone: 'ko',   label: function (r) { return 'GitHub injoignable' + (r.error && r.error.detail ? ' (' + r.error.detail + ')' : ''); } },
    error:    { tone: 'ko',   label: function (r) { return 'Échec de la sauvegarde' + (r.error && r.error.message ? ' : ' + r.error.message : ''); } },
    emptyFile:{ tone: 'warn', label: function () { return 'Aucune sauvegarde dans le cloud pour l\'instant'; } }
  };

  /* Ce que chaque état signifie, en clair (affiché dans les Paramètres). */
  var EXPLICATIONS = {
    off: 'Aucun dépôt configuré : tout reste sur cet appareil.',
    empty: 'Le dépôt et le jeton sont enregistrés ; le premier envoi se fera à la prochaine modification.',
    offline: 'Pas de réseau : les trades continuent d\'être enregistrés ici et partiront tout seuls au retour de la connexion.',
    pending: 'Des modifications attendent leur envoi (envoi automatique 45 s après la dernière).',
    syncing: 'Appel en cours vers GitHub (15 s maximum, puis état d\'erreur).',
    ok: 'Tout est sauvegardé dans le dépôt.',
    remote: 'Le cloud contient une sauvegarde plus récente et le journal local est vide : l\'application propose de la récupérer, jamais sans votre accord.',
    conflict: 'Deux appareils ont modifié le journal : fusionnez les deux, gardez vos données ou prenez celles du cloud.',
    auth: 'Jeton refusé : expiré, révoqué, ou sans la permission Contents (Read and write) sur ce dépôt.',
    quota: 'GitHub limite temporairement les requêtes : réessai plus tard, rien n\'est perdu.',
    server: 'GitHub ne répond pas : réessai automatique, les données locales sont intactes.',
    error: 'Autre échec : le message exact de GitHub est affiché.'
  };
  function etats() {
    return Object.keys(LIBELLES).filter(function (c) { return c !== 'emptyFile'; }).map(function (c) {
      return { code: c, label: LIBELLES[c].label({ pending: 0, lastSyncAt: null, dateDistante: null, error: null }), tone: LIBELLES[c].tone, sens: EXPLICATIONS[c] || '' };
    });
  }

  function dateCourte(iso) {
    if (!iso) return null;
    try {
      var d = new Date(iso);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return null; }
  }
  function cheminLisible() {
    var c = loadConfig();
    return c.owner && c.repo ? c.owner + '/' + c.repo + ' · ' + c.path + ' (' + c.branch + ')' : '';
  }

  /* ---------------------------------------------------------
     Base64 (UTF-8) — les accents doivent survivre au voyage
     --------------------------------------------------------- */
  function b64encode(str) {
    try { return global.btoa(unescape(encodeURIComponent(str))); }
    catch (e) { return null; }
  }
  function b64decode(b64) {
    try { return decodeURIComponent(escape(global.atob(String(b64).replace(/[\s\r\n]/g, '')))); }
    catch (e) { return null; }
  }

  /* ---------------------------------------------------------
     Appels réseau
     --------------------------------------------------------- */
  function appeler(chemin, options) {
    var c = loadConfig();
    options = options || {};
    var controleur = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var minuteur = controleur ? setTimeout(function () { controleur.abort(); }, TIMEOUT) : null;
    var entetes = {
      'Authorization': 'Bearer ' + c.token,
      'Accept': options.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (options.body) entetes['Content-Type'] = 'application/json';
    var fini = function () { if (minuteur) clearTimeout(minuteur); };
    return global.fetch(API + chemin, {
      method: options.method || 'GET',
      headers: entetes,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controleur ? controleur.signal : undefined,
      cache: 'no-store'
    }).then(function (r) {
      return r.text().then(function (txt) {
        fini();
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        return { ok: r.ok, statut: r.status, data: data, texte: txt, retryAfter: r.headers.get('retry-after') };
      });
    }).catch(function (e) {
      fini();
      return { ok: false, statut: 0, reseau: true, erreur: e, data: null };
    });
  }

  /** Traduit une réponse en panne exploitable. */
  function classerErreur(rep) {
    if (rep.reseau) {
      return { code: 'offline', message: 'réseau indisponible' };
    }
    var msg = (rep.data && rep.data.message) || '';
    if (rep.statut === 401) return { code: 'auth', message: 'jeton refusé (401)', detail: '401' };
    if (rep.statut === 403) {
      if (/rate limit|secondary rate/i.test(msg)) return { code: 'quota', message: 'quota GitHub atteint', detail: rep.retryAfter ? 'nouvelle tentative dans ' + rep.retryAfter + ' s' : '403' };
      return { code: 'auth', message: 'droits insuffisants sur ce dépôt (403)', detail: '403' };
    }
    if (rep.statut === 404) return { code: 'auth', message: 'dépôt introuvable ou jeton sans accès (404)', detail: '404' };
    if (rep.statut === 409) return { code: 'conflict', message: 'le fichier a changé entre-temps (409)', detail: '409' };
    if (rep.statut === 422) return { code: 'error', message: 'requête refusée par GitHub (422)', detail: '422' };
    if (rep.statut >= 500) return { code: 'server', message: 'GitHub a répondu ' + rep.statut, detail: String(rep.statut) };
    return { code: 'error', message: msg || ('erreur ' + rep.statut), detail: String(rep.statut) };
  }

  function echec(panne) {
    etatRepos.busy = false;
    etatRepos.error = panne;
    etatRepos.conflict = panne.code === 'conflict' ? true : false;
    journaliser('Échec : ' + panne.message, 'ko');
    saveEtat();
    emit();
    return { ok: false, error: panne };
  }
  function reussite(texte) {
    etatRepos.error = null;
    etatRepos.busy = false;
    journaliser(texte, 'ok');
    saveEtat();
    emit();
  }

  /* ---------------------------------------------------------
     Charge utile (ce qui est sauvegardé)
     --------------------------------------------------------- */
  function appareil() {
    var ua = (global.navigator && global.navigator.userAgent) || '';
    if (/iPad|Tablet|Android/i.test(ua)) return 'tablette';
    if (/iPhone|Mobile/i.test(ua)) return 'téléphone';
    return 'ordinateur';
  }

  /** Trades réels uniquement : la démonstration sert à découvrir l'application, elle n'a pas sa place dans le dépôt. */
  function tradesReels(st) {
    return (st.trades || []).filter(function (t) { return t && !t.demo; });
  }

  function construireCharge() {
    var App = global.App;
    var st = (App && App.state) || {};
    var checks = {};
    try { checks = global.Plan ? global.Plan.loadChecks() : {}; } catch (e) { checks = {}; }
    return {
      app: 'journal-trading',
      format: 2,
      updatedAt: new Date().toISOString(),
      device: appareil(),
      settings: st.settings || {},
      trades: tradesReels(st),
      checks: checks,
      deleted: st.deleted || []
    };
  }

  function nombreTrades(charge) { return (charge && charge.trades ? charge.trades.length : 0); }

  /* ---------------------------------------------------------
     Lecture / écriture du fichier dans le dépôt
     --------------------------------------------------------- */
  function lireFichier() {
    var c = loadConfig();
    var chemin = '/repos/' + c.owner + '/' + c.repo + '/contents/' + c.path + '?ref=' + encodeURIComponent(c.branch);
    return appeler(chemin).then(function (rep) {
      if (rep.statut === 404) return { absent: true };
      if (!rep.ok) return { panne: classerErreur(rep) };
      var taille = rep.data && rep.data.size ? rep.data.size : 0;
      var contenu = rep.data && rep.data.content ? b64decode(rep.data.content) : null;
      // au-delà de 1 Mo, l'API JSON ne renvoie plus le contenu : on le demande en brut
      if (!contenu && taille > 0) {
        return appeler(chemin, { accept: 'application/vnd.github.raw' }).then(function (brut) {
          if (!brut.ok) return { panne: classerErreur(brut) };
          var charge = null;
          try { charge = JSON.parse(brut.texte); } catch (e) { charge = null; }
          return { sha: rep.data.sha, charge: charge, taille: taille };
        });
      }
      var charge = null;
      if (contenu) { try { charge = JSON.parse(contenu); } catch (e) { charge = null; } }
      return { sha: rep.data.sha, charge: charge, taille: taille };
    });
  }

  function ecrireFichier(charge, sha) {
    var c = loadConfig();
    var contenu = JSON.stringify(charge);
    var b64 = b64encode(contenu);
    if (!b64) return Promise.resolve({ ok: false, error: { code: 'error', message: 'encodage impossible' } });
    if (contenu.length > 950000) {
      return Promise.resolve({ ok: false, error: { code: 'error', message: 'sauvegarde trop lourde pour l\'API (max ≈ 950 Ko) — exportez en JSON' } });
    }
    var corps = {
      message: 'Sauvegarde du journal — ' + nombreTrades(charge) + ' trade' + (nombreTrades(charge) > 1 ? 's' : '') + ' (' + appareil() + ')',
      content: b64,
      branch: c.branch
    };
    if (sha) corps.sha = sha;
    return appeler('/repos/' + c.owner + '/' + c.repo + '/contents/' + c.path, { method: 'PUT', body: corps }).then(function (rep) {
      if (!rep.ok) return { ok: false, error: classerErreur(rep) };
      var nouveauSha = rep.data && rep.data.content ? rep.data.content.sha : null;
      etatRepos.lastSyncAt = charge.updatedAt;
      etatRepos.remoteUpdatedAt = charge.updatedAt;
      etatRepos.remoteSha = nouveauSha;
      etatRepos.pending = false;
      etatRepos.conflict = false;
      etatRepos.remoteNeuf = false;
      return { ok: true, charge: charge };
    });
  }

  /* ---------------------------------------------------------
     Fusion (deux appareils ont modifié le journal)
     --------------------------------------------------------- */
  function ts(iso) { var t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }

  function fusionner(local, distant) {
    var parId = {};
    [distant, local].forEach(function (p) {
      ((p && p.trades) || []).forEach(function (t) {
        if (!t || !t.id) return;
        var ancien = parId[t.id];
        if (!ancien || ts(t.updatedAt) >= ts(ancien.updatedAt)) parId[t.id] = t;
      });
    });
    // pierres tombales : un trade supprimé quelque part reste supprimé
    var tombes = {};
    [distant, local].forEach(function (p) {
      ((p && p.deleted) || []).forEach(function (d) {
        if (!d || !d.id) return;
        if (!tombes[d.id] || ts(d.at) > ts(tombes[d.id])) tombes[d.id] = d.at;
      });
    });
    var trades = Object.keys(parId).map(function (id) { return parId[id]; }).filter(function (t) {
      var at = tombes[t.id];
      return !(at && ts(at) >= ts(t.updatedAt));
    });
    // réglages : la version la plus récente gagne
    var recent = ts(local && local.updatedAt) >= ts(distant && distant.updatedAt) ? local : distant;
    var ancien = recent === local ? distant : local;
    // checklists : on garde ce qui est coché d'un côté ou de l'autre
    var checks = {};
    [ancien, recent].forEach(function (p) {
      var src = (p && p.checks) || {};
      Object.keys(src).forEach(function (id) {
        checks[id] = Object.assign({}, checks[id] || {}, src[id] || {});
      });
    });
    return {
      app: 'journal-trading',
      format: 2,
      updatedAt: new Date().toISOString(),
      device: appareil(),
      settings: (recent && recent.settings) || (ancien && ancien.settings) || {},
      trades: trades,
      checks: checks,
      deleted: Object.keys(tombes).map(function (id) { return { id: id, at: tombes[id] }; }).slice(-500),
      fusion: true
    };
  }

  /* ---------------------------------------------------------
     Application d'une charge distante en local
     --------------------------------------------------------- */
  function appliquer(charge) {
    var App = global.App;
    if (!App || !App.state) return false;
    var st = App.state;
    if (charge.settings && Object.keys(charge.settings).length) st.settings = charge.settings;
    // la démonstration locale, si elle est chargée, n'est pas écrasée par la sauvegarde distante
    if (charge.trades) st.trades = charge.trades.concat((st.trades || []).filter(function (t) { return t && t.demo; }));
    st.deleted = charge.deleted || [];
    if (charge.settings) {
      st.settings = Object.assign({}, global.Store.defaultSettings(), charge.settings);
      st.settings.sessions = st.settings.sessions || [];
      st.settings.setups = st.settings.setups || [];
    }
    if (App.setChecks && charge.checks) App.setChecks(charge.checks);
    else if (global.Plan && charge.checks) { global.Plan.saveChecks(charge.checks); st.checks = charge.checks; }
    try { global.Store.saveState({ version: 1, settings: st.settings, trades: st.trades, demo: st.demo, deleted: st.deleted }); } catch (e) { /* ignore */ }
    if (App.reloadFromStorage) App.reloadFromStorage();
    else App.render();
    return true;
  }

  /* ---------------------------------------------------------
     Actions publiques
     --------------------------------------------------------- */
  function markDirty() {
    if (!isConfigured()) return;
    etatRepos.pending = true;
    etatRepos.remoteNeuf = false;
    saveEtat();
    emit();
    planifier();
  }

  var minuteur = null;
  function planifier() {
    var c = loadConfig();
    if (!c.autoSync || !isConfigured()) return;
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(function () { minuteur = null; syncNow({ silent: true }); }, DELAI_AUTO);
  }

  function compteEnAttente() {
    var App = global.App;
    return App && App.state ? App.state.trades.length : 0;
  }

  /** Vérifie le jeton, l'accès au dépôt et l'état du fichier de sauvegarde. */
  function tester() {
    var c = loadConfig();
    if (!c.token || !c.owner || !c.repo) {
      return Promise.resolve({ ok: false, error: { code: 'auth', message: 'renseignez le dépôt et le jeton' } });
    }
    etatRepos.busy = true; emit();
    return appeler('/repos/' + c.owner + '/' + c.repo).then(function (rep) {
      if (!rep.ok) { return echec(classerErreur(rep)); }
      var infos = rep.data || {};
      var prive = !!infos.private;
      var pousse = infos.permissions ? !!infos.permissions.push : null;
      return lireFichier().then(function (f) {
        etatRepos.busy = false;
        if (f.panne) { return echec(f.panne); }
        etatRepos.remoteSha = f.sha || null;
        etatRepos.remoteUpdatedAt = f.charge ? f.charge.updatedAt : null;
        etatRepos.error = null;
        journaliser('Connexion réussie — ' + (prive ? 'dépôt privé' : 'dépôt public') + (f.charge ? ', sauvegarde du ' + dateCourte(f.charge.updatedAt) : ', aucune sauvegarde encore'), 'ok');
        saveEtat(); emit();
        return {
          ok: true, prive: prive, pousse: pousse, existe: !!f.charge,
          trades: nombreTrades(f.charge), updatedAt: f.charge ? f.charge.updatedAt : null,
          depose: infos.full_name || (c.owner + '/' + c.repo)
        };
      });
    }).catch(function (e) {
      return echec({ code: 'error', message: e && e.message ? e.message : 'erreur inconnue' });
    });
  }

  /** Envoie la sauvegarde locale vers le dépôt. */
  function pousser(options) {
    options = options || {};
    var c = loadConfig();
    if (!c.enabled) return Promise.resolve({ ok: false, error: { code: 'off', message: 'sauvegarde cloud désactivée' } });
    if (global.navigator && global.navigator.onLine === false) {
      etatRepos.pending = true; saveEtat(); emit();
      return Promise.resolve({ ok: false, error: { code: 'offline', message: 'hors ligne' } });
    }
    etatRepos.busy = true; etatRepos.error = null; emit();
    return lireFichier().then(function (f) {
      if (f.panne) { return echec(f.panne); }
      // le cloud a-t-il bougé depuis notre dernière synchro ?
      if (f.charge && ts(f.charge.updatedAt) > ts(etatRepos.lastSyncAt) + 1000 && !options.force) {
        etatRepos.busy = false;
        etatRepos.conflict = true;
        etatRepos.remoteUpdatedAt = f.charge.updatedAt;
        etatRepos.remoteSha = f.sha;
        etatRepos.remoteNeuf = false;
        etatRepos.pending = true;
        journaliser('Conflit détecté : version distante du ' + dateCourte(f.charge.updatedAt), 'warn');
        saveEtat(); emit();
        return { ok: false, conflict: true, distant: f.charge };
      }
      var charge = construireCharge();
      charge.deleted = (global.App && global.App.state && global.App.state.deleted) || [];
      return ecrireFichier(charge, f.sha).then(function (r) {
        if (!r.ok) { return echec(r.error); }
        reussite('Sauvegarde envoyée — ' + nombreTrades(charge) + ' trade' + (nombreTrades(charge) > 1 ? 's' : '') + ' (' + appareil() + ')');
        return { ok: true, updatedAt: charge.updatedAt };
      });
    });
  }

  /** Récupère la sauvegarde distante (remplace le local après confirmation). */
  function tirer(options) {
    options = options || {};
    var c = loadConfig();
    if (!c.enabled) return Promise.resolve({ ok: false, error: { code: 'off', message: 'sauvegarde cloud désactivée' } });
    if (global.navigator && global.navigator.onLine === false) {
      return Promise.resolve({ ok: false, error: { code: 'offline', message: 'hors ligne' } });
    }
    etatRepos.busy = true; etatRepos.error = null; emit();
    return lireFichier().then(function (f) {
      if (f.panne) { return echec(f.panne); }
      if (!f.charge) {
        etatRepos.busy = false;
        etatRepos.error = null;
        journaliser('Aucune sauvegarde dans le cloud', 'warn');
        saveEtat(); emit();
        return { ok: false, vide: true };
      }
      if (!f.charge.trades || (f.charge.app && f.charge.app !== 'journal-trading')) {
        return echec({ code: 'error', message: 'le fichier distant n\'est pas une sauvegarde de cette application' });
      }
      appliquer(f.charge);
      etatRepos.lastSyncAt = f.charge.updatedAt;
      etatRepos.remoteUpdatedAt = f.charge.updatedAt;
      etatRepos.remoteSha = f.sha;
      etatRepos.pending = false;
      etatRepos.conflict = false;
      etatRepos.remoteNeuf = false;
      reussite('Sauvegarde récupérée — ' + nombreTrades(f.charge) + ' trade' + (nombreTrades(f.charge) > 1 ? 's' : ''));
      return { ok: true, charge: f.charge };
    });
  }

  /** Fusionne local et distant puis renvoie le résultat. */
  function fusionnerAvecDistant() {
    var c = loadConfig();
    if (!c.enabled) return Promise.resolve({ ok: false, error: { code: 'off', message: 'désactivé' } });
    etatRepos.busy = true; emit();
    return lireFichier().then(function (f) {
      if (f.panne) { return echec(f.panne); }
      var local = construireCharge();
      if (!f.charge) {
        etatRepos.busy = false; emit();
        return pousser({ force: true });
      }
      var melange = fusionner(local, f.charge);
      appliquer(melange);
      return ecrireFichier(melange, f.sha).then(function (r) {
        if (!r.ok) { return echec(r.error); }
        reussite('Fusion effectuée — ' + nombreTrades(melange) + ' trades au total');
        return { ok: true, trades: nombreTrades(melange) };
      });
    });
  }

  /** Synchronisation complète : tire, pousse ou signale le conflit. */
  function syncNow(options) {
    options = options || {};
    if (!isConfigured()) return Promise.resolve({ ok: false, error: { code: 'off', message: 'désactivé' } });
    if (!etatRepos.pending && !options.force) {
      // rien de neuf en local : on regarde simplement si le cloud a bougé
      if (global.navigator && global.navigator.onLine === false) return Promise.resolve({ ok: false, error: { code: 'offline', message: 'hors ligne' } });
      return lireFichier().then(function (f) {
        if (f.panne) { return echec(f.panne); }
        var App = global.App;
        var localVide = !App || !App.state || App.state.trades.length === 0;
        if (f.charge && ts(f.charge.updatedAt) > ts(etatRepos.lastSyncAt || 0) + 1000) {
          if (localVide) {
            etatRepos.remoteUpdatedAt = f.charge.updatedAt;
            etatRepos.remoteSha = f.sha;
            etatRepos.remoteNeuf = true;
            journaliser('Sauvegarde distante détectée (' + dateCourte(f.charge.updatedAt) + ')', 'info');
            saveEtat(); emit();
            return { ok: true, distant: true, charge: f.charge };
          }
          etatRepos.conflict = true;
          etatRepos.remoteUpdatedAt = f.charge.updatedAt;
          etatRepos.remoteSha = f.sha;
          journaliser('Conflit : version distante du ' + dateCourte(f.charge.updatedAt), 'warn');
          saveEtat(); emit();
          return { ok: false, conflict: true, distant: f.charge };
        }
        if (f.charge) {
          etatRepos.remoteUpdatedAt = f.charge.updatedAt;
          etatRepos.remoteSha = f.sha;
          etatRepos.remoteNeuf = false;
        }
        if (!f.charge && !localVide && !options.force) {
          // le fichier n'existe plus côté cloud : on pousse plutôt que d'effacer
          return pousser({ force: true });
        }
        saveEtat(); emit();
        return { ok: true, rien: true };
      });
    }
    return pousser(options);
  }

  /** Résolution d'un conflit : « local » écrase, « distant » remplace, « fusion » assemble. */
  function resoudre(choix) {
    if (choix === 'distant') return tirer({ force: true });
    if (choix === 'fusion') return fusionnerAvecDistant();
    return pousser({ force: true });
  }

  /** File d'attente : on retente quand le réseau revient. */
  function autoStart() {
    if (global.addEventListener) {
      global.addEventListener('online', function () {
        journaliser('Réseau rétabli', 'info');
        emit();
        if (isConfigured() && (etatRepos.pending || etatRepos.remoteNeuf)) syncNow({ silent: true });
      });
      global.addEventListener('offline', function () {
        journaliser('Réseau perdu — les modifications sont conservées', 'warn');
        emit();
      });
      global.addEventListener('visibilitychange', function () {
        if (global.document && global.document.visibilityState === 'hidden' && etatRepos.pending) {
          syncNow({ silent: true });
        }
      });
      global.addEventListener('pagehide', function () {
        if (etatRepos.pending) { try { global.navigator.sendBeacon && null; } catch (e) { /* ignore */ } syncNow({ silent: true }); }
      });
    }
    if (isConfigured()) { syncNow({ silent: true }); }
  }

  /* ---------------------------------------------------------
     Export
     --------------------------------------------------------- */
  global.Sync = {
    loadConfig: loadConfig, saveConfig: saveConfig, clearConfig: clearConfig, isConfigured: isConfigured,
    status: status, cheminLisible: cheminLisible, dateCourte: dateCourte, etats: etats,
    markDirty: markDirty, onChange: onChange,
    tester: tester, pousser: pousser, tirer: tirer, fusionner: fusionnerAvecDistant,
    syncNow: syncNow, resoudre: resoudre, autoStart: autoStart,
    fusionnerCharges: fusionner, appliquer: appliquer,
    construireCharge: construireCharge, b64encode: b64encode, b64decode: b64decode,
    reset: function () { etatRepos = { lastSyncAt: null, remoteUpdatedAt: null, remoteSha: null, pending: false, error: null, log: [] }; saveEtat(); emit(); },
    etat: function () { return etatRepos; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
