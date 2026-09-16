/* =========================================================
   graphe.js — Ouvrir le graphique d'un instrument sur TradingView

   Principe : l'application ne charge RIEN d'externe et n'ouvre
   jamais un lien toute seule. Le bouton « Graphique » construit une
   adresse et l'ouvre dans un nouvel onglet, au moment de l'appui.
   Hors ligne, il explique au lieu d'échouer.

   Confidentialité : l'adresse ne contient que le symbole et l'unité
   de temps — jamais une date, un prix, un montant ni une note du
   journal. Aucune donnée de trading ne sort de l'appareil.
   ========================================================= */
'use strict';

(function (global) {
  var HOTE = 'https://www.tradingview.com/chart/';

  /* Unités de temps proposées (valeur TradingView : minutes, ou D/W) */
  var INTERVALLES = [
    { id: '15', label: '15 minutes' },
    { id: '60', label: '1 heure' },
    { id: '240', label: '4 heures' },
    { id: 'D', label: '1 jour' },
    { id: 'W', label: '1 semaine' }
  ];
  var INTERVALLE_DEFAUT = '60';

  /* Symboles par défaut. Les paires forex vivent chez FX, l'or et l'argent
     chez OANDA, les indices chez TVC (flux publics), les cryptos chez
     BITSTAMP. Ces choix peuvent ne pas correspondre au courtier : tout est
     corrigeable instrument par instrument dans les Paramètres. */
  var SYMBOLES = {
    XAUUSD: 'OANDA:XAUUSD', GOLD: 'OANDA:XAUUSD', XAU: 'OANDA:XAUUSD',
    XAGUSD: 'OANDA:XAGUSD', SILVER: 'OANDA:XAGUSD', XAG: 'OANDA:XAGUSD',
    US30: 'TVC:DJI', DJ30: 'TVC:DJI', DOW: 'TVC:DJI', US30CASH: 'TVC:DJI',
    NAS100: 'TVC:NDX', US100: 'TVC:NDX', NDX: 'TVC:NDX', NASDAQ: 'TVC:NDX',
    SPX500: 'TVC:SPX', SP500: 'TVC:SPX', US500: 'TVC:SPX', SPX: 'TVC:SPX',
    GER40: 'TVC:DAX', DE40: 'TVC:DAX', DAX: 'TVC:DAX', GER30: 'TVC:DAX',
    UK100: 'TVC:UKX', FTSE: 'TVC:UKX',
    FRA40: 'TVC:CAC40', CAC40: 'TVC:CAC40',
    JP225: 'TVC:NI225', NIKKEI: 'TVC:NI225',
    HK50: 'TVC:HSI', US2000: 'TVC:RUT',
    WTI: 'TVC:USOIL', USOIL: 'TVC:USOIL', OIL: 'TVC:USOIL',
    BRENT: 'TVC:UKOIL', UKOIL: 'TVC:UKOIL', NGAS: 'TVC:NATGAS',
    BTCUSD: 'BITSTAMP:BTCUSD', ETHUSD: 'BITSTAMP:ETHUSD',
    SOLUSD: 'BITSTAMP:SOLUSD', XRPUSD: 'BITSTAMP:XRPUSD'
  };

  /* Devises reconnues : servent à deviner une paire forex (EURUSD, GBPJPY…) */
  var DEVISES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SEK', 'NOK', 'MXN', 'ZAR', 'TRY', 'PLN', 'DKK', 'HKD', 'SGD', 'CNH'];

  function normaliser(instrument) {
    return String(instrument == null ? '' : instrument).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function estPaire(s) {
    if (s.length !== 6) return false;
    return DEVISES.indexOf(s.slice(0, 3)) > -1 && DEVISES.indexOf(s.slice(3)) > -1;
  }

  /** Symbole TradingView d'un instrument : correction de l'utilisateur, sinon défaut. */
  function symboleTV(instrument, settings) {
    var brut = String(instrument == null ? '' : instrument).trim();
    if (!brut) return '';
    var s = normaliser(brut);
    var reglages = (settings && settings.graphique) || {};
    var perso = reglages.symboles || {};
    // la correction est cherchée sur le libellé exact, puis sur la forme normalisée
    var trouve = perso[brut] || perso[s];
    if (trouve && String(trouve).trim()) return String(trouve).trim();
    // une correction écrite sous une autre casse (ex. « eurusd ») doit aussi compter
    var cles = Object.keys(perso);
    for (var i = 0; i < cles.length; i++) {
      if (normaliser(cles[i]) === s && String(perso[cles[i]]).trim()) return String(perso[cles[i]]).trim();
    }
    if (SYMBOLES[s]) return SYMBOLES[s];
    if (estPaire(s)) return 'FX:' + s;
    // inconnu : on rend l'instrument tel quel, TradingView le cherchera
    return brut;
  }

  function intervalleDe(settings) {
    var iv = (settings && settings.graphique && settings.graphique.intervalle) || INTERVALLE_DEFAUT;
    iv = String(iv);
    for (var i = 0; i < INTERVALLES.length; i++) if (INTERVALLES[i].id === iv) return iv;
    return INTERVALLE_DEFAUT;
  }

  function libelleIntervalle(iv) {
    for (var i = 0; i < INTERVALLES.length; i++) if (INTERVALLES[i].id === iv) return INTERVALLES[i].label;
    return '1 heure';
  }

  /** Adresse du graphique : symbole + unité de temps, rien d'autre. */
  function url(instrument, settings) {
    var symbole = symboleTV(instrument, settings);
    if (!symbole) return '';
    // ':' est un caractère légal dans une chaîne de requête : on le garde lisible
    return HOTE + '?symbol=' + symbole.replace(/ /g, '') + '&interval=' + intervalleDe(settings);
  }

  /** Le bouton est-il autorisé ? (éteint par défaut : non — allumé, sauf choix contraire) */
  function actif(settings) {
    var g = (settings && settings.graphique) || {};
    return g.actif !== false;
  }

  /** Le réseau est-il là ? (les liens externes n'existent pas hors ligne) */
  function enLigne() {
    if (typeof global.navigator === 'undefined') return true;
    return global.navigator.onLine !== false;
  }

  /* Ouvrir réellement la fenêtre : isolé pour pouvoir le simuler dans les recettes */
  function fenetre(u) {
    var w = global.open(u, '_blank', 'noopener');
    if (w && w.focus) { try { w.focus(); } catch (e) { /* certains navigateurs refusent : sans conséquence */ } }
    return w;
  }

  /**
   * Ouvre le graphique d'un instrument.
   * @returns {string|null} l'adresse ouverte, ou null si rien n'a été ouvert.
   */
  function ouvrir(instrument, settings) {
    var reglages = settings || (global.Store && global.Store.state && global.Store.state.settings) || null;
    var symbole = symboleTV(instrument, reglages);
    if (!symbole) {
      if (global.UI) global.UI.toast('Choisissez d\'abord un instrument.', 'warn');
      return null;
    }
    if (!enLigne()) {
      if (global.UI) {
        global.UI.toast('Le graphique TradingView demande internet. Le journal, le plan et l\'entraîneur continuent de marcher hors ligne.', 'warn', 8000);
      }
      return null;
    }
    var u = url(symbole, reglages);
    fenetre(u);
    return u;
  }

  /** Instrument le plus utilisé du journal (à défaut, le premier des Paramètres). */
  function instrumentPrincipal(trades, settings) {
    var compte = {}, meilleur = '', max = 0;
    (trades || []).forEach(function (t) {
      var s = String((t && t.symbol) || '').trim();
      if (!s) return;
      compte[s] = (compte[s] || 0) + 1;
      if (compte[s] > max) { max = compte[s]; meilleur = s; }
    });
    if (meilleur) return meilleur;
    var liste = (settings && settings.symbols) || [];
    return liste.length ? liste[0] : 'EURUSD';
  }

  global.Graphe = {
    HOTE: HOTE,
    INTERVALLES: INTERVALLES,
    INTERVALLE_DEFAUT: INTERVALLE_DEFAUT,
    SYMBOLES: SYMBOLES,
    symboleTV: symboleTV,
    intervalleDe: intervalleDe,
    libelleIntervalle: libelleIntervalle,
    url: url,
    actif: actif,
    enLigne: enLigne,
    ouvrir: ouvrir,
    instrumentPrincipal: instrumentPrincipal
  };
})(typeof window !== 'undefined' ? window : globalThis);
