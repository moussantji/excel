#!/usr/bin/env node
/* =========================================================
   make-site-zip.js — Prépare une archive prête à publier
   (Netlify Drop, Cloudflare Pages, GitHub Pages…) contenant
   l'application seule : index.html à la racine de l'archive.

   Usage :
     node tools/make-site-zip.js [chemin-de-sortie]
     défaut : ../trading-site.zip  (racine du dépôt)

   Aucune dépendance : l'archive ZIP est écrite avec les modules
   natifs de Node (zlib).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'trading-site.zip'));

/* ---------- éléments inclus dans le site publié ---------- */
const INCLUDE = ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'exemples', 'README.md'];
const EXCLUDE = [
  /^tools\//,            // outils de développement
  /^node_modules\//,
  /^exemples\/deploiement\//,  // modèle de workflow inutile dans le site
  /^apercu-.*\.jpe?g$/,  // aperçus lourds (documentation)
  /\.DS_Store$/, /^\./,  // fichiers cachés
  /^README\.md$/         // documentation (facultative dans le site)
];

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- parcours des fichiers ---------- */
function walk(rel, acc) {
  const abs = path.join(ROOT, rel);
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    fs.readdirSync(abs).sort().forEach((name) => walk(path.posix.join(rel, name), acc));
    return acc;
  }
  const relPosix = rel.split(path.sep).join('/');
  if (EXCLUDE.some((re) => re.test(relPosix))) return acc;
  acc.push(relPosix);
  return acc;
}

function dosDateTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  return { time, date };
}

/* ---------- écriture de l'archive ---------- */
function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const { time, date } = dosDateTime(now);

  files.forEach((rel) => {
    const data = fs.readFileSync(path.join(ROOT, rel));
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const name = Buffer.from(rel, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // version nécessaire
    local.writeUInt16LE(0x0800, 6);       // noms en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);              // version d'origine
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);              // extra
    cd.writeUInt16LE(0, 32);              // commentaire
    cd.writeUInt16LE(0, 34);              // disque
    cd.writeUInt16LE(0, 36);              // attributs internes
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38); // droits 0644
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + body.length;
  });

  const cdBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(chunks), cdBuffer, end]);
}

/* ---------- exécution ---------- */
const files = INCLUDE.reduce((acc, rel) => {
  if (!fs.existsSync(path.join(ROOT, rel))) return acc;
  return walk(rel, acc);
}, []);

if (!files.length) {
  console.error('Aucun fichier à archiver.');
  process.exit(1);
}

const zip = buildZip(files);
fs.writeFileSync(OUT, zip);

const kb = (n) => (n / 1024).toFixed(0) + ' Ko';
console.log('Archive créée : ' + OUT);
console.log('  ' + files.length + ' fichiers · ' + kb(zip.length));
console.log('');
console.log('Pour publier en HTTPS (installation sur tablette) :');
console.log('  • Netlify Drop  : ouvrir https://app.netlify.com/drop puis déposer cette archive');
console.log('  • Cloudflare Pages : « Upload assets » puis déposer cette archive');
console.log('  • GitHub Pages  : Settings → Pages → Deploy from a branch (branche + dossier /root)');
