# Protocol Cards — tool PC

Importa la lista esami del RIS, permette di verificarla e la trasferisce sul
telefono con un codice QR.

## Costruzione

```
node build.js          # produce protocol-cards-pc.html
node ris-parser.test.js
```

`protocol-cards-pc.html` è un file unico e autosufficiente: pdf.js, l'encoder
QR e il parser sono incorporati. Va copiato su una chiavetta e aperto in
Chrome. **Non serve rete**, e il PDF non lascia il computer.

## Librerie incorporate

| | versione | licenza |
|---|---|---|
| pdf.js (`pdfjs-dist`) | 3.11.174, build legacy | Apache-2.0 |
| qrcode-generator | 2.0.4 | MIT |

I testi delle licenze sono in `vendor/`. Per rigenerare le copie:

```
npm pack pdfjs-dist@3.11.174
tar xzf pdfjs-dist-3.11.174.tgz package/legacy/build/pdf.min.js \
        package/legacy/build/pdf.worker.min.js package/LICENSE
npm pack qrcode-generator
```

## Dati dei pazienti

Le liste RIS reali **non vanno nel repository**: `.gitignore` blocca i PDF.
Il test usa una fixture sintetica che riproduce il layout con dati inventati.

## Test

```
node ris-parser.test.js                          # fixture sintetica, nessun dato reale
RIS_PDF_DIR=/percorso node end-to-end.test.js    # richiede una lista RIS chiamata lista.pdf
```

Il test end-to-end apre il file costruito da `file://` e verifica anche che
non parta **nessuna richiesta di rete**.
