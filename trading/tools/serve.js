#!/usr/bin/env node
/* =========================================================
   serve.js — Sert l'application en local + sur le réseau Wi-Fi
   et affiche un QR code à scanner depuis la tablette.

   Usage :
     node tools/serve.js            → port 8777
     node tools/serve.js 9000       → autre port
     node tools/serve.js --no-qr    → sans QR code

   Depuis la tablette : ouvrez l'adresse « réseau Wi-Fi » affichée
   (même réseau que cet ordinateur). Pour l'installer en plein écran
   et l'utiliser hors ligne, il faut du HTTPS : voir README.md
   (section « Sur tablette »).
   ========================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const noQr = args.indexOf('--no-qr') > -1;
const PORT = Number(args.filter((a) => /^\d+$/.test(a))[0] || process.env.PORT || 8777);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------- adresses réseau ---------- */
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((i) => {
      if (i.family === 'IPv4' && !i.internal) out.push({ name: name, address: i.address });
    });
  });
  return out;
}

/* ---------- QR code en caractères (scannable depuis une tablette) ---------- */
function qrAscii(text) {
  let qrcode;
  try { qrcode = require(path.join(__dirname, 'vendor', 'qrcode.js')); }
  catch (e) { return null; }
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const lines = [];
  for (let r = -quiet; r < n + quiet; r += 2) {
    let line = '';
    for (let c = -quiet; c < n + quiet; c++) {
      const top = r >= 0 && r < n && c >= 0 && c < n && qr.isDark(r, c);
      const bottom = r + 1 >= 0 && r + 1 < n && c >= 0 && c < n && qr.isDark(r + 1, c);
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/* ---------- serveur ---------- */
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Interdit'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Fichier introuvable : ' + rel);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddresses();
  const localUrl = 'http://localhost:' + PORT + '/';
  const lanUrl = lan.length ? 'http://' + lan[0].address + ':' + PORT + '/' : null;

  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────────────┐');
  console.log('  │  Journal & Plan de trading — serveur local                   │');
  console.log('  └──────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('   Sur cet ordinateur  :  ' + localUrl);
  if (lan.length) {
    console.log('   Sur la tablette     :  ' + lanUrl + '   (même réseau Wi-Fi)');
    if (lan.length > 1) {
      console.log('   Autres adresses     :  ' + lan.slice(1).map((i) => 'http://' + i.address + ':' + PORT + '/').join('  '));
    }
  } else {
    console.log('   Sur la tablette     :  aucune adresse réseau détectée (vérifiez le Wi-Fi)');
  }
  console.log('');

  if (lanUrl && !noQr) {
    const art = qrAscii(lanUrl);
    if (art) {
      console.log('   Scannez ce QR code avec la tablette pour ouvrir l\'application :');
      console.log('');
      console.log(art.split('\n').map((l) => '      ' + l).join('\n'));
      console.log('');
    }
  }

  console.log('   Rappel : en http:// (réseau local), l\'application fonctionne');
  console.log('   entièrement, mais n\'est pas installable et pas disponible hors');
  console.log('   ligne. Pour l\'installation sur écran d\'accueil, servez-la en');
  console.log('   HTTPS (GitHub Pages, Netlify Drop, Cloudflare Pages) : voir');
  console.log('   README.md, section « Sur tablette ».');
  console.log('');
  console.log('   Arrêter le serveur : Ctrl + C');
  console.log('');

});
