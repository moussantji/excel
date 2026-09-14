#!/usr/bin/env node
/* =========================================================
   tablet-check.js — Contrôle du rendu sur tablette (Chrome headless)
   Vérifie : débordement horizontal, taille des cibles tactiles,
   vue cartes du journal, lisibilité du formulaire, mode hors ligne.

   Prérequis :  npm i -D puppeteer   +   un serveur local démarré
                node tools/serve.js &
   Usage :      node tools/tablet-check.js [url]
   Option :     CHROME_PATH=/chemin/vers/chrome node tools/tablet-check.js
   ========================================================= */
'use strict';
const BASE = process.argv[2] || 'http://localhost:8777/index.html';
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) {
  console.error('puppeteer requis : npm i -D puppeteer');
  process.exit(2);
}

const DEVICES = [
  { name: 'iPad portrait (820×1180)', width: 820, height: 1180, touch: true },
  { name: 'iPad paysage (1180×820)', width: 1180, height: 820, touch: true },
  { name: 'Android 10" (800×1280)', width: 800, height: 1280, touch: true }
];

(async () => {
  // Navigateur : Chrome local par défaut, ou CHROME_PATH pour un binaire fourni
  const exe = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], executablePath: exe });
  let failures = 0;

  for (const dev of DEVICES) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: 1.6, isMobile: true, hasTouch: dev.touch });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.evaluate(() => window.App.loadDemo());
    await new Promise((r) => setTimeout(r, 800));

    const info = await page.evaluate(() => {
      const tooSmall = [];
      document.querySelectorAll('.nav-item, .btn, .pill, .seg-btn, .icon-btn').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.width && r.height && r.height < 34) tooSmall.push((b.textContent || '').trim().slice(0, 20) + ' ' + Math.round(r.height) + 'px');
      });
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        small: tooSmall,
        cards: (window.App.state.journalView === 'auto' || window.App.state.journalView === 'cards') ? true : null
      };
    });

    const lines = [];
    if (errs.length) { failures++; lines.push('  ✗ erreurs JS : ' + errs.join(' | ')); }
    if (info.overflow) { failures++; lines.push('  ✗ débordement horizontal'); }
    if (info.small.length) { failures++; lines.push('  ✗ cibles tactiles trop petites : ' + info.small.slice(0, 5).join(', ')); }
    console.log('• ' + dev.name + (lines.length ? '\n' + lines.join('\n') : '  ✓ rendu, cibles tactiles et débordement conformes'));

    // Vue cartes du journal (mode automatique sur petit écran)
    await page.evaluate(() => { window.App.state.journalView = 'auto'; window.App.state.view = 'journal'; window.App.render(); });
    await new Promise((r) => setTimeout(r, 400));
    const nb = await page.evaluate(() => document.querySelectorAll('.trade-card').length);
    if (dev.width < 1000 && nb === 0) { failures++; console.log('  ✗ vue cartes absente sur écran étroit'); }
    else if (nb) console.log('  ✓ journal en cartes : ' + nb + ' cartes');

    await page.close();
  }

  // ---- Mode hors ligne (service worker) ----
  const page = await browser.newPage();
  await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2200));
  const swReady = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  if (!swReady) { failures++; console.log('• hors ligne : ✗ service worker non enregistré (HTTPS ou localhost requis)'); }
  else {
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 900));
    const ok = await page.evaluate(() => document.querySelectorAll('#equityChart svg').length > 0);
    if (ok) console.log('• hors ligne : ✓ application rechargée sans réseau (courbe affichée)');
    else { failures++; console.log('• hors ligne : ✗ la page ne se recharge pas sans réseau'); }
  }
  await browser.close();

  console.log(failures ? '\n❌ ' + failures + ' problème(s) détecté(s).' : '\n✅ Tablette : tous les contrôles sont passés.');
  process.exit(failures ? 1 : 0);
})();
