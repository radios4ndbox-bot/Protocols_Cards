/* Genera le icone PNG dal disegno vettoriale (brand/icona.svg).
     node brand/genera-icone.js
   Le icone servono al telefono (schermata Home, manifest) e al browser.  */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const qui = __dirname, app = path.join(qui, '..', 'prototype');
const lavori = [
  ['icona.svg', 'icon-192.png', 192], ['icona.svg', 'icon-512.png', 512],
  ['icona-maskable.svg', 'icon-maskable-512.png', 512],
  ['icona-maskable.svg', 'apple-touch-icon.png', 180],   // iOS arrotonda da sé
  ['favicon.svg', 'favicon-32.png', 32], 
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [src, out, n] of lavori) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    const svg = fs.readFileSync(path.join(qui, src), 'utf8').replace('width="512" height="512"', `width="${n}" height="${n}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: path.join(app, out), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    await p.close();
    console.log('✓', out);
  }
  fs.copyFileSync(path.join(qui, 'favicon.svg'), path.join(app, 'favicon.svg'));
  console.log('✓ favicon.svg');
  await b.close();
})();
