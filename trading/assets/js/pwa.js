/* =========================================================
   pwa.js — Installation sur tablette/mobile, service worker,
   synchronisation entre onglets et rafraîchissement manuel.
   ========================================================= */
(function (global) {
  'use strict';

  var UI = global.UI, App = global.App;
  var $ = UI.$, $$ = UI.$$;
  var DISMISS_KEY = 'journal-trading:install-banner';
  var installEvent = null;

  function isStandalone() {
    try {
      return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) ||
        global.navigator.standalone === true ||
        (global.navigator.userAgent || '').indexOf('TradingDeskApp') > -1;
    } catch (e) { return false; }
  }
  function isAppleTouch() {
    var ua = global.navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (ua.indexOf('Mac') > -1 && 'ontouchend' in document);
  }
  function isAndroid() { return /Android/i.test(global.navigator.userAgent || ''); }

  /* ---------------------------------------------------------
     1. Service worker (hors ligne + installation)
     --------------------------------------------------------- */
  function registerSW() {
    if (!('serviceWorker' in global.navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return; // file:// : pas de SW
    global.addEventListener('load', function () {
      global.navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(function (reg) {
          reg.addEventListener('updatefound', function () { /* nouvelle version en arrière-plan */ });
        })
        .catch(function (err) { console.warn('Service worker non enregistré :', err && err.message); });
    });
  }

  /* ---------------------------------------------------------
     2. Bandeau d'installation
     --------------------------------------------------------- */
  function dismissed() {
    try { return global.localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function dismiss() {
    try { global.localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
    hideBanner();
  }
  function hideBanner() {
    var b = $('#installBanner');
    if (b) b.hidden = true;
  }
  function showBanner() {
    var b = $('#installBanner');
    if (!b) return;
    var txt = $('#installBannerText');
    var action = $('#ibAction');
    if (isAppleTouch()) {
      txt.innerHTML = 'Sur iPad / iPhone : bouton <b>Partager</b> (carré avec une flèche) → <b>Sur l\'écran d\'accueil</b> → <b>Ajouter</b>.';
      action.hidden = true;
    } else if (isAndroid()) {
      txt.innerHTML = 'Menu <b>⋮</b> du navigateur → <b>Ajouter à l\'écran d\'accueil</b> (ou bouton Installer ci-contre).';
    } else {
      txt.innerHTML = 'Utilisez l\'icône d\'installation dans la barre d\'adresse du navigateur, ou le menu → « Installer l\'application ».';
    }
    if (installEvent) { action.hidden = false; action.textContent = 'Installer'; }
    b.hidden = false;
  }

  function listenInstall() {
    global.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installEvent = e;
      var side = $('#btnInstall');
      if (side) side.hidden = false;
      if (!dismissed() && !isStandalone()) showBanner();
    });
    global.addEventListener('appinstalled', function () {
      installEvent = null;
      hideBanner();
      var side = $('#btnInstall');
      if (side) side.hidden = true;
      UI.toast('Application installée : ouvrez-la depuis votre écran d\'accueil.', 'info', 6000);
    });

    var ib = $('#ibAction');
    if (ib) ib.addEventListener('click', function () { promptInstall(); });
    var side = $('#btnInstall');
    if (side) side.addEventListener('click', function () { promptInstall(); });
    var close = $('#ibClose');
    if (close) close.addEventListener('click', dismiss);

    // iPad/iPhone : pas de beforeinstallprompt → bandeau d'explication
    if (!installEvent && !isStandalone() && !dismissed() && isAppleTouch()) {
      setTimeout(showBanner, 1500);
    }
    if (!installEvent && isStandalone()) hideBanner();
  }

  function promptInstall() {
    if (!installEvent) {
      showBanner();
      UI.toast('Suivez les indications affichées pour installer l\'application.', 'info', 5000);
      return;
    }
    installEvent.prompt();
    installEvent.userChoice.then(function (choice) {
      if (choice && choice.outcome === 'accepted') UI.toast('Installation lancée.');
      installEvent = null;
    });
  }

  /* ---------------------------------------------------------
     3. Synchronisation : plusieurs onglets/appareils, retour au premier plan
     --------------------------------------------------------- */
  function refreshFromStorage(silent) {
    if (document.querySelector('.modal-overlay')) return; // ne pas casser une saisie en cours
    var saved = global.Store.loadState();
    App.state.trades = saved.trades;
    App.state.settings = saved.settings;
    App.state.demo = saved.demo;
    App.state.checks = global.Plan.loadChecks();
    UI.setCurrency(App.state.settings.currency);
    App.render();
    if (!silent) UI.toast('Données rechargées.', 'info', 2200);
  }

  function watchSync() {
    // Un autre onglet a modifié le journal
    global.addEventListener('storage', function (e) {
      if (e.key === global.Store.STORAGE_KEY) refreshFromStorage(true);
    });
    // Retour sur l'app (tablette restée ouverte, veille, changement d'app)
    var last = Date.now();
    function maybeRefresh() {
      if (Date.now() - last < 1500) return;
      last = Date.now();
      refreshFromStorage(true);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') maybeRefresh();
    });
    global.addEventListener('focus', maybeRefresh);

    var btn = $('#btnRefresh');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.classList.add('spin');
        refreshFromStorage(false);
        setTimeout(function () { btn.classList.remove('spin'); }, 600);
      });
    }
  }

  /* ---------------------------------------------------------
     4. Raccourcis de lancement (manifest.shortcuts) et état d'affichage
     --------------------------------------------------------- */
  function handleLaunchParams() {
    var params = new URLSearchParams(location.search);
    var view = params.get('view');
    if (view) {
      App.state.view = view;
      App.render();
      history.replaceState(null, '', location.pathname);
    }
    if (params.get('action') === 'add') {
      App.openTradeForm(null, App.buildModel());
      history.replaceState(null, '', location.pathname);
    }
  }

  function init() {
    registerSW();
    listenInstall();
    watchSync();
    handleLaunchParams();
    // Mode plein écran : ajuste la hauteur (barres du navigateur sur tablette)
    if (isStandalone()) document.body.classList.add('standalone');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.PWA = {
    isStandalone: isStandalone,
    refreshFromStorage: refreshFromStorage,
    promptInstall: promptInstall,
    showBanner: showBanner
  };
})(typeof window !== 'undefined' ? window : globalThis);
