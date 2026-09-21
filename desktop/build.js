#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   Costruisce il tool PC come file HTML unico e autosufficiente.

   Il file va copiato su una chiavetta e aperto in Chrome su un PC che
   può essere bloccato e senza rete: per questo pdf.js e il parser
   vengono incorporati invece di essere caricati da una CDN.

   Uso:  node build.js
   ═══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const QUI      = __dirname;
const VENDOR   = path.join(QUI, 'vendor');
const SORGENTE = path.join(QUI, 'src', 'index.html');
const USCITA   = path.join(QUI, 'protocol-cards-pc.html');

const leggi = f => fs.readFileSync(f, 'utf8');

/* Un blocco <script> non può contenere la sequenza "</script": va spezzata.
   Sui sorgenti attuali non compare, ma il controllo resta perché una
   versione futura della libreria potrebbe introdurla.                    */
function perScript(codice, nome) {
  if (/<\/script/i.test(codice)) {
    console.warn(`  ! ${nome}: sequenza </script neutralizzata`);
    return codice.replace(/<\/script/gi, '<\\/script');
  }
  return codice;
}

const pezzi = {
  PDFJS:       [path.join(VENDOR, 'pdf.min.js'),        'pdf.min.js'],
  PDFJSWORKER: [path.join(VENDOR, 'pdf.worker.min.js'), 'pdf.worker.min.js'],
  QRCODE:      [path.join(VENDOR, 'qrcode.js'),         'qrcode.js'],
  RISPARSER:   [path.join(QUI, 'ris-parser.js'),        'ris-parser.js'],
};

let html = leggi(SORGENTE);
let totale = 0;

for (const [chiave, [file, nome]] of Object.entries(pezzi)) {
  if (!fs.existsSync(file)) {
    console.error(`\n✗ manca ${file}`);
    console.error('  pdf.js si recupera da npm:');
    console.error('    npm pack pdfjs-dist@3.11.174');
    console.error('    tar xzf pdfjs-dist-3.11.174.tgz package/legacy/build/pdf.min.js \\');
    console.error('            package/legacy/build/pdf.worker.min.js package/LICENSE');
    console.error('    mv package/legacy/build/*.min.js package/LICENSE desktop/vendor/\n');
    process.exit(1);
  }
  const codice = perScript(leggi(file), nome);
  const segno = `/* ⟦${chiave}⟧ */`;
  if (!html.includes(segno)) {
    console.error(`✗ segnaposto ${segno} assente da src/index.html`);
    process.exit(1);
  }
  /* sostituto come funzione: con una stringa, replace interpreterebbe le
     sequenze $&, $` e $' — che nel codice minificato compaiono davvero, e
     incollerebbero pezzi dell'HTML dentro il codice.                     */
  html = html.replace(segno, () => codice);
  const kb = Buffer.byteLength(codice) / 1024;
  totale += kb;
  console.log(`  ${nome.padEnd(20)} ${kb.toFixed(0).padStart(5)} KB`);
}

fs.writeFileSync(USCITA, html);
const finale = fs.statSync(USCITA).size / 1024;
console.log(`  ${'—'.repeat(26)}`);
console.log(`  ${'incorporato'.padEnd(20)} ${totale.toFixed(0).padStart(5)} KB`);
console.log(`\n✓ ${path.relative(process.cwd(), USCITA)}  ${(finale/1024).toFixed(2)} MB`);
