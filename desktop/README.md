# Protocol Cards — tool PC

Importa la lista esami del RIS, permette di verificarla e la trasferisce sul
telefono con un codice QR. Contiene anche l'editor della **libreria protocolli**:
fasi, zone, mezzo di contrasto, regola della basale e termini che fanno
riconoscere il protocollo dal quesito.

## Costruzione

```
node build.js          # produce protocol-cards-pc.html
node ris-parser.test.js
node protocolli.test.js
```

`protocol-cards-pc.html` è un file unico e autosufficiente: pdf.js, l'encoder
QR, il parser e la libreria protocolli sono incorporati. Va copiato su una chiavetta e aperto in
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

## Libreria protocolli

`protocolli.js` contiene la libreria di partenza (estratto SIRM 2022), il
riconoscimento dal quesito, la deduzione della regione dall'esame e la
validazione. È scritto per essere condiviso con il telefono: stesso schema,
stesso riconoscimento, così il PC mostra esattamente cosa suggerirà il reparto.

La libreria modificata resta nel browser del PC (localStorage): non contiene
dati personali. La **firma** di 7 caratteri identifica la versione e cambia a
ogni modifica; si può esportare e reimportare come JSON.

## Dati dei pazienti

Le liste RIS reali **non vanno nel repository**: `.gitignore` blocca i PDF.
Il test usa una fixture sintetica che riproduce il layout con dati inventati.

## Test

```
node ris-parser.test.js                          # fixture sintetica, nessun dato reale
node protocolli.test.js                          # riconoscimento identico al prototipo
RIS_PDF_DIR=/percorso node end-to-end.test.js    # richiede una lista RIS chiamata lista.pdf
```

Il test end-to-end apre il file costruito da `file://` e verifica anche che
non parta **nessuna richiesta di rete**.
