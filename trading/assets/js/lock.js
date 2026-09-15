/* =========================================================
   lock.js — Verrouillage et chiffrement du journal

   Principe (enveloppe) :
   - une clé maîtresse aléatoire (32 octets) chiffre réellement les
     données (AES-GCM 256) — localement ET dans le dépôt GitHub ;
   - cette clé n'est jamais écrite en clair : elle est enveloppée
     (chiffrée) par une clé dérivée du code de l'utilisateur, par une
     clé dérivée du code de secours, et — quand la machine le permet —
     par une clé dérivée d'une passkey (Face ID / empreinte) ;
   - perdre un moyen de déverrouillage ne perd pas les données : les
     autres enveloppes ouvrent la même clé maîtresse.

   Aucun serveur, aucun compte : tout se passe dans le navigateur.
   ========================================================= */
(function (global) {
  'use strict';

  var COFFRE = 'journal-trading:coffre';
  var SESSION = 'journal-trading:cle-session';
  var KEY = { etat: 'journal-trading:v1', checks: 'journal-trading:plan:v1' };
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford : ni I, L, O ni U
  var VERSION_COFFRE = 1;
  var CIBLE_MS = 900;            // durée visée pour la dérivation (une seule fois par ouverture)
  var ITER_MIN = 250000;
  var ITER_MAX = global.JT_KDF_MAX || 2000000;
  var ITER_FORCE = global.JT_KDF_FORCE || 0;   // utilisé uniquement par les tests
  var DELAI_ECRITURE = 80;       // regroupement des écritures (ms)

  /* ---------------------------------------------------------
     Petits utilitaires binaires
     --------------------------------------------------------- */
  function octets(n) {
    var t = new Uint8Array(n);
    global.crypto.getRandomValues(t);
    return t;
  }
  function b64(buf) {
    var o = '', t = new Uint8Array(buf);
    for (var i = 0; i < t.length; i++) o += String.fromCharCode(t[i]);
    return global.btoa(o);
  }
  function deB64(s) {
    var brut = global.atob(String(s || ''));
    var t = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) t[i] = brut.charCodeAt(i);
    return t;
  }
  function b64url(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deB64url(s) { return deB64(String(s || '').replace(/-/g, '+').replace(/_/g, '/')); }
  function utf8(txt) { return new TextEncoder().encode(txt); }
  function texte(buf) { return new TextDecoder().decode(buf); }

  /* ---------------------------------------------------------
     Disponibilité de la cryptographie
     --------------------------------------------------------- */
  function cryptoDisponible() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.getRandomValues &&
      global.PublicKeyCredential !== null && typeof TextEncoder !== 'undefined');
  }
  function contexteSecurise() {
    return global.isSecureContext !== false && (global.location.protocol === 'https:' ||
      global.location.hostname === 'localhost' || global.location.hostname === '127.0.0.1');
  }

  /* ---------------------------------------------------------
     Dérivation de clé (PBKDF2) et enveloppes
     --------------------------------------------------------- */
  function deriverBrut(secret, salt, iterations) {
    return global.crypto.subtle.importKey('raw', utf8(secret), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return global.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, base, 256);
      });
  }
  function importAes(brut) {
    return global.crypto.subtle.importKey('raw', brut, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  function deriverKek(secret, saltB64, iterations) {
    return deriverBrut(secret, deB64(saltB64), iterations).then(importAes);
  }
  function chiffrerAvec(kek, brut, aad) {
    var iv = octets(12);
    return global.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(aad) }, kek, brut)
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function dechiffrerAvec(kek, env, aad) {
    return global.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deB64(env.iv), additionalData: utf8(aad) }, kek, deB64(env.ct));
  }

  /** Enveloppe la clé maîtresse avec un secret (code, code de secours, biométrie). */
  function envelopper(brut, secret, saltB64, iterations, aad) {
    return deriverKek(secret, saltB64, iterations).then(function (kek) {
      return chiffrerAvec(kek, brut, aad);
    });
  }
  /** Ouvre une enveloppe : rend la clé maîtresse (Uint8Array) ou lève une erreur. */
  function ouvrir(env, secret, iterations, aad) {
    return deriverKek(secret, env.salt, iterations).then(function (kek) {
      return dechiffrerAvec(kek, env, aad);
    }).then(function (brut) { return new Uint8Array(brut); });
  }

  /* ---------------------------------------------------------
     Code de secours
     --------------------------------------------------------- */
  function genererCodeSecours(groupes) {
    var total = (groupes || 6) * 4, sortie = '', alea = octets(total * 2), i = 0;
    while (sortie.length < total && i < alea.length) {
      var o = alea[i++];
      if (o >= 248) continue;                    // rejet pour éviter tout biais
      sortie += ALPHABET[o % 32];
    }
    return sortie.replace(/(.{4})(?=.)/g, '$1-');
  }
  function normaliserCode(c) {
    return String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1');
  }
  function codeValide(c) { return normaliserCode(c).length >= 16; }

  /* ---------------------------------------------------------
     État du coffre
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

  var coffre = lire(COFFRE, null);
  var cleMaitresse = null;      // CryptoKey AES-GCM (en mémoire seulement)
  var memoire = {};             // dernier texte en clair par compartiment (jamais écrit tel quel)
  var erreurs = [];
  var abonnes = [];

  function actif() { return !!(coffre && coffre.actif); }
  function deverrouille() { return !!cleMaitresse; }
  function ok() { return coffre && coffre.resteOnglet ? true : true; }
  function infos() {
    return {
      actif: actif(),
      deverrouille: deverrouille(),
      iterations: coffre ? coffre.iterations : null,
      bio: !!(coffre && coffre.bio),
      secours: !!(coffre && coffre.secours),
      delaiMin: coffre && coffre.delaiMin !== undefined ? coffre.delaiMin : 15,
      resterOnglet: !!(coffre && coffre.resterOnglet),
      cree: coffre ? coffre.cree : null,
      maj: coffre ? coffre.maj : null,
      essais: coffre && coffre.essais ? coffre.essais : { n: 0, jusqua: 0 },
      erreurs: erreurs.slice(-5)
    };
  }
  function memoireDe(nom) { return memoire[nom] || null; }
  function onChange(cb) { abonnes.push(cb); }
  function emit() { abonnes.forEach(function (cb) { try { cb(infos()); } catch (e) { /* ignore */ } }); }
  function signalerErreur(texte) {
    erreurs.push({ at: new Date().toISOString(), texte: texte });
    erreurs = erreurs.slice(-10);
    emit();
    if (global.UI && UI.toast) UI.toast(texte, 'error', 8000);
  }

  /* ---------------------------------------------------------
     Écriture chiffrée des compartiments (état, checklists)
     --------------------------------------------------------- */
  var minuteurs = {};

  function ecrireBrut(cle, env) {
    try { global.localStorage.setItem(cle, JSON.stringify(env)); return true; }
    catch (e) { signalerErreur('Sauvegarde impossible (espace insuffisant) : ' + e.message); return false; }
  }

  function chiffrerTexte(texteClair, aad) {
    var iv = octets(12);
    return global.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(aad) },
      cleMaitresse, utf8(texteClair)).then(function (ct) {
      return { chiffre: true, v: 3, iv: b64(iv), ct: b64(ct), maj: new Date().toISOString() };
    });
  }
  function dechiffrerTexte(env, aad) {
    return global.crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(env.iv), additionalData: utf8(aad) },
      cleMaitresse, deB64(env.ct)).then(texte);
  }

  /** Écrit un compartiment : mémoire tout de suite, disque chiffré juste après. */
  function ecrireCompartiment(nom, texteClair) {
    if (!actif()) return 'inactif';
    if (!deverrouille()) return 'verrouille';
    memoire[nom] = texteClair;
    if (minuteurs[nom]) clearTimeout(minuteurs[nom]);
    minuteurs[nom] = setTimeout(function () { minuteurs[nom] = null; viderCompartiment(nom); }, DELAI_ECRITURE);
    return 'local';
  }
  function viderCompartiment(nom) {
    var texteClair = memoire[nom];
    if (texteClair === undefined || !deverrouille()) return Promise.resolve({ ok: true });
    return chiffrerTexte(texteClair, 'journal-trading:' + nom)
      .then(function (env) { return { ok: ecrireBrut(KEY[nom], env) }; })
      .catch(function (e) { signalerErreur('Chiffrement impossible : ' + (e && e.message)); return { ok: false }; });
  }
  /** Force l'écriture des compartiments en attente (avant de verrouiller ou de fermer). */
  function viderAttente() {
    var taches = Object.keys(KEY).map(function (nom) {
      if (minuteurs[nom]) { clearTimeout(minuteurs[nom]); minuteurs[nom] = null; return viderCompartiment(nom); }
      return Promise.resolve({ ok: true });
    });
    return Promise.all(taches);
  }

  /* ---------------------------------------------------------
     Activation du verrou
     --------------------------------------------------------- */
  function iterationsCalibrees() {
    if (ITER_FORCE) return Promise.resolve(ITER_FORCE);
    var t0 = Date.now();
    return deriverBrut('etalonnage-du-journal', octets(16), 50000).then(function () {
      var ms = Math.max(Date.now() - t0, 1);
      var vise = Math.round(50000 * CIBLE_MS / ms / 10000) * 10000;
      return Math.max(ITER_MIN, Math.min(ITER_MAX, vise));
    });
  }

  function problemeActivation(code, confirmation) {
    if (!cryptoDisponible()) return 'Ce navigateur ne fournit pas le chiffrement nécessaire (WebCrypto).';
    if (!contexteSecurise()) return 'Le chiffrement exige une adresse sécurisée (https). Sur tablette, ouvrez l\'application depuis son adresse GitHub Pages.';
    if (!code) return 'Choisissez un code.';
    if (confirmation !== undefined && code !== confirmation) return 'Les deux saisies du code ne correspondent pas.';
    if (/^[0-9]+$/.test(code) && code.length < 6) return 'Un code de 4 ou 5 chiffres se casse en quelques minutes : utilisez au moins 6 chiffres, ou mieux, quelques mots.';
    if (code.length < 6) return 'Le code doit faire au moins 6 caractères.';
    return null;
  }

  /**
   * Active le verrouillage : la clé maîtresse est créée, les données
   * existantes (jusqu'ici en clair) sont chiffrées, le code de secours
   * est rendu une seule fois.
   */
  function activer(options) {
    options = options || {};
    var code = options.code || '';
    var p = problemeActivation(code, options.confirmation);
    if (p) return Promise.resolve({ ok: false, message: p });
    if (actif()) return Promise.resolve({ ok: false, message: 'Le verrouillage est déjà actif.' });

    var brutBrut = octets(32);
    var selCode = b64(octets(16));
    var selSecours = b64(octets(16));
    var codeSecours = genererCodeSecours();
    var iterations = options.iterations || 0;

    return (iterations ? Promise.resolve(iterations) : iterationsCalibrees()).then(function (n) {
      iterations = n;
      return envelopper(brutBrut, code, selCode, iterations, 'journal-trading:code');
    }).then(function (envCode) {
      return envelopper(brutBrut, normaliserCode(codeSecours), selSecours, iterations, 'journal-trading:secours')
        .then(function (envSecours) {
          coffre = {
            v: VERSION_COFFRE, actif: true, iterations: iterations,
            code: Object.assign({ salt: selCode }, envCode),
            secours: Object.assign({ salt: selSecours }, envSecours, { cree: new Date().toISOString() }),
            bio: null,
            delaiMin: options.delaiMin !== undefined ? options.delaiMin : 15,
            resterOnglet: !!options.resterOnglet,
            cree: new Date().toISOString(), maj: new Date().toISOString(),
            essais: { n: 0, jusqua: 0 }
          };
          return global.crypto.subtle.importKey('raw', brutBrut, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        });
    }).then(function (cle) {
      cleMaitresse = cle;
      ecrire(COFFRE, coffre);
      // reprendre le contenu actuel (encore en clair) et l'écrire chiffré
      var aChiffrer = obtenirTextesExistants();
      memoire.etat = aChiffrer.etat;
      memoire.checks = aChiffrer.checks;
      return viderAttenteForce();
    }).then(function () {
      garderSession(brutBrut);
      return inscriptionBiometrie(brutBrut);
    }).then(function (bio) {
      emit();
      return { ok: true, codeSecours: codeSecours, iterations: iterations, bio: bio };
    }).catch(function (e) {
      return { ok: false, message: 'Activation impossible : ' + (e && e.message ? e.message : e) };
    });
  }

  function viderAttenteForce() {
    Object.keys(KEY).forEach(function (nom) { if (minuteurs[nom]) { clearTimeout(minuteurs[nom]); minuteurs[nom] = null; } });
    return Promise.all(Object.keys(KEY).map(function (nom) { return viderCompartiment(nom); }));
  }

  /** Textes en clair déjà présents (migration depuis une version non chiffrée). */
  function obtenirTextesExistants() {
    var etat = '{"version":1,"settings":{},"trades":[],"demo":false,"deleted":[]}';
    var checks = '{}';
    try {
      var e = global.localStorage.getItem(KEY.etat);
      if (e && e.indexOf('"chiffre":true') === -1) etat = e;
      var c = global.localStorage.getItem(KEY.checks);
      if (c && c.indexOf('"chiffre":true') === -1) checks = c;
    } catch (err) { /* ignore */ }
    return { etat: etat, checks: checks };
  }

  /* ---------------------------------------------------------
     Changement de code / code de secours / désactivation
     --------------------------------------------------------- */
  function changerCode(codeActuel, nouveau, confirmation) {
    if (!actif()) return Promise.resolve({ ok: false, message: 'Le verrouillage n\'est pas actif.' });
    var p = problemeActivation(nouveau, confirmation);
    if (p) return Promise.resolve({ ok: false, message: p });
    var sel = b64(octets(16));
    return ouvrirAvecCode(codeActuel).then(function (brut) {
      return envelopper(brut, nouveau, sel, coffre.iterations, 'journal-trading:code').then(function (env) {
        coffre.code = Object.assign({ salt: sel }, env);
        coffre.maj = new Date().toISOString();
        coffre.essais = { n: 0, jusqua: 0 };
        ecrire(COFFRE, coffre);
        emit();
        return { ok: true };
      });
    }).catch(function () {
      return { ok: false, message: 'Code actuel incorrect.' };
    });
  }

  function nouveauCodeSecours(codeActuel) {
    if (!actif()) return Promise.resolve({ ok: false, message: 'Le verrouillage n\'est pas actif.' });
    var sel = b64(octets(16));
    var codeSecours = genererCodeSecours();
    return ouvrirAvecCode(codeActuel).then(function (brut) {
      return envelopper(brut, normaliserCode(codeSecours), sel, coffre.iterations, 'journal-trading:secours')
        .then(function (env) {
          coffre.secours = Object.assign({ salt: sel }, env, { cree: new Date().toISOString() });
          ecrire(COFFRE, coffre);
          emit();
          return { ok: true, codeSecours: codeSecours };
        });
    }).catch(function () { return { ok: false, message: 'Code incorrect.' }; });
  }

  function desactiver(code) {
    if (!actif()) return Promise.resolve({ ok: false, message: 'Le verrouillage n\'est pas actif.' });
    return ouvrirAvecCode(code).then(function () {
      return viderAttenteForce();
    }).then(function () {
      // les données repartent en clair : c'est ce que demande la désactivation
      try {
        if (memoire.etat !== undefined) global.localStorage.setItem(KEY.etat, memoire.etat);
        if (memoire.checks !== undefined) global.localStorage.setItem(KEY.checks, memoire.checks);
      } catch (e) { /* ignore */ }
      try { global.localStorage.removeItem(COFFRE); } catch (e) { /* ignore */ }
      try { global.sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
      coffre = null;
      cleMaitresse = null;
      erreurs = [];
      emit();
      return { ok: true };
    }).catch(function () {
      return { ok: false, message: 'Code incorrect : le verrouillage reste actif.' };
    });
  }

  /* ---------------------------------------------------------
     Ouverture / verrouillage
     --------------------------------------------------------- */
  function ouvrirAvecCode(code, options) {
    var essais = (coffre && coffre.essais) || { n: 0, jusqua: 0 };
    if (essais.jusqua && Date.now() < essais.jusqua) {
      return Promise.reject(new Error('Patientez ' + Math.ceil((essais.jusqua - Date.now()) / 1000) + ' s avant de réessayer.'));
    }
    return ouvrir(coffre.code, code, coffre.iterations, 'journal-trading:code').then(function (brut) {
      return poserCle(brut, options);
    }).catch(function (e) {
      enregistrerEchec();
      throw e;
    });
  }

  function ouvrirAvecSecours(code) {
    if (!coffre || !coffre.secours) return Promise.reject(new Error('Aucun code de secours enregistré.'));
    return ouvrir(coffre.secours, normaliserCode(code), coffre.iterations, 'journal-trading:secours')
      .then(function (brut) { return poserCle(brut); })
      .catch(function (e) {
        enregistrerEchec();
        throw e;
      });
  }

  function poserCle(brut, options) {
    var aInscrire = !!(options && options.inscrireBio) && !(coffre && coffre.bio);
    return global.crypto.subtle.importKey('raw', brut, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
      .then(function (cle) {
        cleMaitresse = cle;
        if (coffre) { coffre.essais = { n: 0, jusqua: 0 }; ecrire(COFFRE, coffre); }
        garderSession(brut);
        return ouvrirCompartiments();
      })
      .then(function (r) {
        if (ecranVisible()) { cacherEcran(); annoncerDeverrouillage(); emit(); }
        if (!aInscrire) return brut;   // la clé maîtresse, pour l'inscription biométrique ou un changement de code
        // proposé juste après la saisie du code : la clé maîtresse est disponible en clair ici
        return inscriptionBiometrie(brut).then(function (etat) {
          if (etat.etat === 'ok') { if (global.UI && UI.toast) UI.toast('Face ID / empreinte activé pour ce journal.', 'success', 6000); }
          else if (etat.etat === 'sans-prf' || etat.etat === 'indisponible') {
            if (global.UI && UI.toast) UI.toast('Cet appareil ne fournit pas de clé biométrique : le code sera demandé.', 'warn', 7000);
          } else if (etat.etat === 'refusee') {
            if (global.UI && UI.toast) UI.toast('Biométrie refusée : le code sera demandé.', 'warn');
          }
          return r;
        });
      });
  }

  /** Déchiffre les compartiments : alimente la mémoire et rend les textes. */
  function ouvrirCompartiments() {
    var noms = Object.keys(KEY);
    return Promise.all(noms.map(function (nom) {
      var brut = null;
      try { brut = global.localStorage.getItem(KEY[nom]); } catch (e) { brut = null; }
      if (!brut) { memoire[nom] = nom === 'checks' ? '{}' : null; return { nom: nom, absent: true }; }
      var env = null;
      try { env = JSON.parse(brut); } catch (e) { env = null; }
      if (!env || !env.chiffre) {
        // compartiment encore en clair (jamais activé ou migration) : on le prend tel quel
        memoire[nom] = brut;
        return chiffrerTexte(brut, 'journal-trading:' + nom)
          .then(function (e2) { ecrireBrut(KEY[nom], e2); return { nom: nom, clair: true }; });
      }
      return dechiffrerTexte(env, 'journal-trading:' + nom).then(function (t) {
        memoire[nom] = t;
        return { nom: nom, ok: true };
      }).catch(function () {
        return { nom: nom, echec: true };
      });
    })).then(function (resultats) {
      emit();
      return resultats;
    });
  }

  function enregistrerEchec() {
    if (!coffre) return;
    var essais = coffre.essais || { n: 0, jusqua: 0 };
    essais.n = (essais.n || 0) + 1;
    // ralentissement progressif : 5 essais libres, puis 5 s, 15 s, 60 s, 5 min
    var paliers = [0, 0, 0, 0, 0, 5, 15, 60, 300];
    var secondes = paliers[Math.min(essais.n, paliers.length - 1)];
    if (secondes === undefined) secondes = 300;
    essais.jusqua = secondes ? Date.now() + secondes * 1000 : 0;
    coffre.essais = essais;
    ecrire(COFFRE, coffre);
    emit();
  }

  function garderSession(brutBrut) {
    try {
      if (coffre && coffre.resterOnglet && global.sessionStorage) global.sessionStorage.setItem(SESSION, b64(brutBrut));
      else if (global.sessionStorage) global.sessionStorage.removeItem(SESSION);
    } catch (e) { /* ignore */ }
  }
  /** Recharge la clé laissée par le même onglet (si l'option est active). */
  function reprendreSession() {
    if (!actif()) return Promise.resolve(false);
    var garde = null;
    try { garde = global.sessionStorage && global.sessionStorage.getItem(SESSION); } catch (e) { garde = null; }
    if (!garde) return Promise.resolve(false);
    return global.crypto.subtle.importKey('raw', deB64(garde), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
      .then(function (cle) {
        cleMaitresse = cle;
        return ouvrirCompartiments();
      })
      .then(function (r) {
        return r.every(function (x) { return !x.echec; });
      })
      .catch(function () { cleMaitresse = null; return false; });
  }

  function verrouiller() {
    if (!actif()) return Promise.resolve();
    return viderAttenteForce().then(function () {
      cleMaitresse = null;
      memoire = {};
      try { global.sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
      emit();
      return true;
    });
  }

  /* ---------------------------------------------------------
     Biométrie (WebAuthn + extension PRF)
     --------------------------------------------------------- */
  function rpId() {
    var h = global.location.hostname;
    if (!h || /^[0-9.]+$/.test(h)) return null;   // les adresses IP ne peuvent pas héberger de passkey
    return h;
  }
  function biometriePossible() {
    return Promise.resolve().then(function () {
      if (!global.PublicKeyCredential || !global.navigator.credentials || !global.navigator.credentials.create) return false;
      if (!contexteSecurise() || !rpId()) return false;
      if (typeof global.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
      return global.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(function (ok) { return !!ok; })
        .catch(function () { return false; });
    });
  }

  function creerPasskey(salt) {
    var id = octets(16);
    return global.navigator.credentials.create({
      publicKey: {
        challenge: octets(32),
        rp: { id: rpId(), name: 'Journal de trading' },
        user: { id: id, name: 'journal-trading', displayName: 'Journal de trading' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none',
        extensions: { prf: { eval: { first: salt } } }
      }
    });
  }
  function secretPrf(extensionResults) {
    var prf = extensionResults && extensionResults.prf;
    var premiere = prf && prf.results && prf.results.first;
    if (premiere) return new Uint8Array(premiere);
    if (prf && prf.enabled) return null;
    return null;
  }
  function kekDepuisPrf(secret, salt) {
    return global.crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
      .then(function (base) {
        return global.crypto.subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: salt, info: utf8('journal-trading-biometrie') }, base, 256);
      })
      .then(importAes);
  }

  /** Inscrit Face ID / empreinte si la machine sait dériver un secret (PRF). */
  function inscriptionBiometrie(brutBrut) {
    if (!brutBrut) return Promise.resolve({ etat: 'indisponible' });
    return biometriePossible().then(function (possible) {
      if (!possible) return { etat: 'indisponible' };
      var salt = octets(32);
      return creerPasskey(salt).then(function (cred) {
        if (!cred) return { etat: 'refusee' };
        var secret = secretPrf(cred.getClientExtensionResults ? cred.getClientExtensionResults() : null);
        if (!secret) return { etat: 'sans-prf' };
        return kekDepuisPrf(secret, salt).then(function (kek) {
          return chiffrerAvec(kek, brutBrut, 'journal-trading:biometrie').then(function (env) {
            coffre.bio = {
              credentialId: b64url(cred.rawId), salt: b64(salt), iv: env.iv, ct: env.ct,
              rpId: rpId(), cree: new Date().toISOString()
            };
            ecrire(COFFRE, coffre);
            return { etat: 'ok' };
          });
        });
      }).catch(function (e) {
        return { etat: 'erreur', message: e && e.message };
      });
    });
  }

  function deverrouillerBiometrie() {
    if (!coffre || !coffre.bio) return Promise.reject(new Error('Aucune biométrie enregistrée sur cet appareil.'));
    var salt = deB64(coffre.bio.salt);
    return global.navigator.credentials.get({
      publicKey: {
        challenge: octets(32),
        rpId: coffre.bio.rpId,
        allowCredentials: [{ type: 'public-key', id: deB64url(coffre.bio.credentialId) }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: salt } } }
      }
    }).then(function (assertion) {
      if (!assertion) throw new Error('Biométrie refusée.');
      var secret = secretPrf(assertion.getClientExtensionResults ? assertion.getClientExtensionResults() : null);
      if (!secret) throw new Error('Cet appareil ne fournit pas de secret biométrique.');
      return kekDepuisPrf(secret, salt);
    }).then(function (kek) {
      return dechiffrerAvec(kek, { iv: coffre.bio.iv, ct: coffre.bio.ct }, 'journal-trading:biometrie');
    }).then(function (brut) {
      return poserCle(new Uint8Array(brut));
    }).catch(function (e) {
      // un échec biométrique n'est pas une tentative de devinette du code : on ne ralentit pas la saisie
      throw e;
    });
  }

  function oublierBiometrie() {
    if (!coffre) return;
    coffre.bio = null;
    ecrire(COFFRE, coffre);
    emit();
  }

  /* ---------------------------------------------------------
     Réglages
     --------------------------------------------------------- */
  function regler(options) {
    if (!coffre) return;
    if (options.delaiMin !== undefined) coffre.delaiMin = options.delaiMin;
    if (options.demanderBio !== undefined) coffre.demanderBio = !!options.demanderBio;
    if (options.resterOnglet !== undefined) {
      coffre.resterOnglet = !!options.resterOnglet;
      if (!coffre.resterOnglet) { try { global.sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ } }
      else if (cleMaitresse) {
        // on ne peut pas ressortir la clé d'un CryptoKey : on garde l'onglet tel quel,
        // l'option s'appliquera à la prochaine ouverture
      }
    }
    ecrire(COFFRE, coffre);
    emit();
  }

  function oublierTout() {
    try { global.localStorage.removeItem(COFFRE); } catch (e) { /* ignore */ }
    try { global.sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
    coffre = null;
    cleMaitresse = null;
    memoire = {};
    emit();
  }


  /* ---------------------------------------------------------
     Écran de verrouillage
     --------------------------------------------------------- */
  var abonnesDeverrouillage = [];
  var minuteurEssais = null;

  function surDeverrouillage(cb) { abonnesDeverrouillage.push(cb); }
  function annoncerDeverrouillage() {
    abonnesDeverrouillage.forEach(function (cb) { try { cb(); } catch (e) { /* ignore */ } });
  }

  function el(sel) { return global.document ? global.document.querySelector(sel) : null; }
  function message(texte, ton) {
    var zone = el('#lockMsg');
    if (!zone) return;
    zone.className = 'lock-msg' + (ton ? ' ' + ton : '');
    zone.innerHTML = texte || '';
  }

  function afficherEcran(motif) {
    var ecran = el('#ecranVerrou');
    if (!ecran) return;
    ecran.hidden = false;
    if (global.document.body) global.document.body.classList.add('verrouille');
    var lead = el('#lockLead');
    if (lead) {
      lead.textContent = motif === 'inactivite'
        ? 'Verrouillé automatiquement après une période sans activité. Vos données restent chiffrées sur cet appareil.'
        : 'Vos trades sont chiffrés sur cet appareil et dans votre dépôt. Saisissez votre code pour ouvrir le journal.';
    }
    var bio = el('#lockBio');
    if (bio) {
      bio.hidden = !(coffre && coffre.bio && coffre.bio.rpId === rpId());
      bio.textContent = 'Déverrouiller avec Face ID / empreinte';
    }
    var proposer = el('#lockBioOn');
    var enveloppe = el('#lockBioWrap');
    var dejaBio = !!(coffre && coffre.bio);
    if (proposer) {
      proposer.hidden = dejaBio;
      proposer.checked = !dejaBio && (coffre && coffre.demanderBio !== false);
    }
    if (enveloppe) {
      enveloppe.hidden = true;
      if (!dejaBio) {
        biometriePossible().then(function (possible) {
          enveloppe.hidden = !possible;
          if (proposer) proposer.checked = possible;
        });
      }
    }
    var champ = el('#lockCode');
    if (champ) { champ.value = ''; try { champ.focus(); } catch (e) { /* ignore */ } }
    surveillerEssais();
  }

  function ecranVisible() {
    var e = el('#ecranVerrou');
    return !!(e && !e.hidden);
  }

  function cacherEcran() {
    var ecran = el('#ecranVerrou');
    if (ecran) ecran.hidden = true;
    if (global.document.body) global.document.body.classList.remove('verrouille');
    if (minuteurEssais) { clearInterval(minuteurEssais); minuteurEssais = null; }
  }

  function surveillerEssais() {
    if (minuteurEssais) { clearInterval(minuteurEssais); minuteurEssais = null; }
    var jusqua = coffre && coffre.essais ? coffre.essais.jusqua : 0;
    if (!jusqua || Date.now() >= jusqua) return;
    var maj = function () {
      var reste = Math.ceil(((coffre.essais.jusqua || 0) - Date.now()) / 1000);
      if (reste <= 0) {
        clearInterval(minuteurEssais);
        minuteurEssais = null;
        message('');
        activerFormulaire(true);
        return;
      }
      message('Trop d\'essais : patientez ' + reste + ' s.', 'ko');
      activerFormulaire(false);
    };
    maj();
    minuteurEssais = setInterval(maj, 1000);
  }

  function activerFormulaire(actif) {
    var champ = el('#lockCode'), bouton = el('#lockGo'), secours = el('#lockSecoursGo'), bio = el('#lockBio');
    [champ, bouton, secours].forEach(function (e) { if (e) e.disabled = !actif; });
    if (bio) bio.disabled = !actif;
  }

  function reussi() {
    var visible = ecranVisible();
    cacherEcran();
    if (visible) annoncerDeverrouillage();
    emit();
  }
  function echoue(e) {
    var msg = e && e.message ? e.message : 'Code incorrect.';
    if (/incorrect|wrong|operation-specific/i.test(msg)) msg = 'Code incorrect.';
    message(esc(msg) + (coffre && coffre.secours ? ' <span class="muted">Utilisez le code de secours ci-dessous si nécessaire.</span>' : ''), 'ko');
    surveillerEssais();
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function brancherEcran() {
    var formulaire = el('#lockForm');
    if (formulaire) formulaire.addEventListener('submit', function (e) {
      e.preventDefault();
      var champ = el('#lockCode');
      if (!champ || !champ.value) return;
      message('Ouverture…', '');
      activerFormulaire(false);
      var coche = el('#lockBioOn');
      ouvrirAvecCode(champ.value, { inscrireBio: !!(coche && coche.checked && !coche.hidden) }).then(reussi).catch(function (err) {
        activerFormulaire(true);
        echoue(err);
      });
    });

    var bio = el('#lockBio');
    if (bio) bio.addEventListener('click', function () {
      message('Vérification biométrique…', '');
      deverrouillerBiometrie().then(reussi).catch(function (err) { echoue(err); });
    });

    var secoursGo = el('#lockSecoursGo');
    if (secoursGo) secoursGo.addEventListener('click', function () {
      var champ = el('#lockSecours');
      if (!champ || !champ.value) return;
      message('Ouverture avec le code de secours…', '');
      ouvrirAvecSecours(champ.value).then(function () {
        message('');
        reussi();
      }).catch(function (err) { echoue(err); });
    });

    var reset = el('#lockReset');
    if (reset) reset.addEventListener('click', function () {
      var confirmer = global.UI && UI.confirmDialog ? UI.confirmDialog({
        title: 'Effacer le journal de cet appareil ?',
        message: 'Les données chiffrées de cet appareil seront supprimées. Sans votre code ni votre code de secours, elles restent <b>illisibles partout</b>, y compris dans la copie du dépôt GitHub. Cette action ne se rattrape pas.',
        confirmLabel: 'Effacer cet appareil', danger: true
      }) : Promise.resolve(global.confirm('Effacer les données chiffrées de cet appareil ?'));
      confirmer.then(function (ok) {
        if (!ok) return;
        try {
          global.localStorage.removeItem(KEY.etat);
          global.localStorage.removeItem(KEY.checks);
        } catch (e) { /* ignore */ }
        oublierTout();
        if (global.location && global.location.reload) global.location.reload();
      });
    });
  }

  /* ---------------------------------------------------------
     Surveillance : inactivité et fermeture
     --------------------------------------------------------- */
  var derniereActivite = Date.now();
  var veille = null, veilleDebounce = null;

  function noterActivite() { derniereActivite = Date.now(); }

  function lancerSurveillance() {
    if (!global.addEventListener) return;
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (evt) {
      global.addEventListener(evt, function () {
        if (veilleDebounce) return;
        veilleDebounce = setTimeout(function () { veilleDebounce = null; }, 5000);
        noterActivite();
      }, { passive: true });
    });
    global.addEventListener('pagehide', function () {
      // ne jamais perdre la dernière modification
      if (deverrouille()) viderAttente();
    });
    global.addEventListener('visibilitychange', function () {
      if (!global.document || global.document.visibilityState === 'visible') {
        if (actif() && deverrouille() && delaiDepasse()) {
          verrouillerApplication('inactivite');
        }
        return;
      }
      if (deverrouille()) viderAttente();
    });
    veille = setInterval(function () {
      if (actif() && deverrouille() && delaiDepasse()) verrouillerApplication('inactivite');
    }, 20000);
  }

  function delaiDepasse() {
    var min = coffre && coffre.delaiMin !== undefined ? coffre.delaiMin : 15;
    if (!min) return false;
    return (Date.now() - derniereActivite) > min * 60000;
  }

  /** Verrouille, efface la mémoire de l'application et affiche l'écran. */
  function verrouillerApplication(motif) {
    return verrouiller().then(function () {
      if (global.App && global.App.effacerMemoire) global.App.effacerMemoire();
      afficherEcran(motif);
      emit();
    });
  }

  /* ---------------------------------------------------------
     Démarrage : rend une promesse résolue quand l'app est ouvrable
     --------------------------------------------------------- */
  function demarrer() {
    brancherEcran();
    if (!actif()) return Promise.resolve({ actif: false, verrouille: false });
    if (!cryptoDisponible()) {
      afficherEcran();
      message('Ce navigateur ne fournit pas le déchiffrement nécessaire. Ouvrez l\'application depuis son adresse https (GitHub Pages) dans un navigateur à jour.', 'ko');
      activerFormulaire(false);
      return Promise.resolve({ actif: true, verrouille: true, impossible: true });
    }
    lancerSurveillance();
    return reprendreSession().then(function (repris) {
      if (repris) {
        cacherEcran();
        annoncerDeverrouillage();
        return { actif: true, verrouille: false, repris: true };
      }
      afficherEcran();
      // on rend la main au premier déverrouillage réussi
      return new Promise(function (resolve) {
        abonnesDeverrouillage.push(function () { resolve({ actif: true, verrouille: false }); });
      });
    });
  }

  /* ---------------------------------------------------------
     Chargé du cloud : le fichier du dépôt est chiffré lui aussi
     --------------------------------------------------------- */
  function chiffrerPourCloud(objet) {
    if (!deverrouille()) return Promise.reject(new Error('journal verrouillé'));
    var texteJson = JSON.stringify(objet);
    var iv = octets(12);
    return global.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8('journal-trading:cloud') },
      cleMaitresse, utf8(texteJson)).then(function (ct) {
      return {
        app: 'journal-trading', format: 3, chiffre: true,
        updatedAt: objet.updatedAt || new Date().toISOString(),
        device: objet.device || null,
        iv: b64(iv), ct: b64(ct)
      };
    });
  }

  /** Ouvre une sauvegarde distante : rend la charge en clair (ou la charge telle quelle si elle ne l'était pas). */
  function dechiffrerPourCloud(charge) {
    if (!charge || !charge.chiffre) return Promise.resolve(charge);
    if (!deverrouille()) return Promise.reject(new Error('journal verrouillé'));
    return global.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deB64(charge.iv), additionalData: utf8('journal-trading:cloud') },
      cleMaitresse, deB64(charge.ct)
    ).then(function (brut) {
      var dedans = JSON.parse(texte(brut));
      dedans.app = 'journal-trading';
      dedans.format = 2;
      dedans.updatedAt = charge.updatedAt || dedans.updatedAt;
      dedans.device = charge.device || dedans.device;
      return dedans;
    }).catch(function () {
      var e = new Error('Cette sauvegarde a été chiffrée avec un autre code.');
      e.code = 'mauvais-code';
      throw e;
    });
  }

  /* ---------------------------------------------------------
     Export
     --------------------------------------------------------- */
  global.Lock = {
    actif: actif, deverrouille: deverrouille, infos: infos, onChange: onChange,
    cryptoDisponible: cryptoDisponible, contexteSecurise: contexteSecurise,
    activer: activer, desactiver: desactiver, changerCode: changerCode, nouveauCodeSecours: nouveauCodeSecours,
    ouvrirAvecCode: ouvrirAvecCode, ouvrirAvecSecours: ouvrirAvecSecours, reprendreSession: reprendreSession,
    verrouiller: verrouiller, viderAttente: viderAttente, memoireDe: memoireDe,
    ecrireCompartiment: ecrireCompartiment,
    biometriePossible: biometriePossible, deverrouillerBiometrie: deverrouillerBiometrie,
    inscriptionBiometrie: inscriptionBiometrie, oublierBiometrie: oublierBiometrie,
    regler: regler, oublierTout: oublierTout,
    demarrer: demarrer, surDeverrouillage: surDeverrouillage, verrouillerApplication: verrouillerApplication,
    afficherEcran: afficherEcran, cacherEcran: cacherEcran, noterActivite: noterActivite,
    genererCodeSecours: genererCodeSecours, normaliserCode: normaliserCode, codeValide: codeValide,
    chiffrerPourCloud: chiffrerPourCloud, dechiffrerPourCloud: dechiffrerPourCloud,
    cle: function () { return cleMaitresse; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
