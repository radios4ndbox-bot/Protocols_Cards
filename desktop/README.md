# Protocol Cards — tool PC

Importa la lista esami del RIS, permette di verificarla e la invia al
telefono attraverso un canale cifrato. Contiene anche l'editor della **libreria protocolli**:
fasi, zone, mezzo di contrasto, regola della basale e termini che fanno
riconoscere il protocollo dal quesito.

## Costruzione

```
node build.js          # produce protocol-cards-pc.html
node ris-parser.test.js
node protocolli.test.js
```

`protocol-cards-pc.html` è un file unico e autosufficiente: pdf.js, l'encoder
QR (per l'abbinamento), il parser, la libreria protocolli e il canale sono
incorporati. Va copiato su una chiavetta e aperto in Chrome. Importare e
verificare **non richiede rete**, e il PDF non lascia il computer; la rete
serve solo per abbinare il telefono e inviare la lista.

## Info

Le pagine del tool non hanno didascalie: le spiegazioni (privacy e dati del PDF,
lista del giorno, protocolli, builder, profilo e backup) stanno nella sezione
**Info** del pannello del profilo, in alto a destra.

## Invio al telefono via rete

I passi sono due: si carica il PDF, poi si verifica la lista e la si invia dalla
stessa pagina, con il tasto in cima alla tabella. Il PC del
reparto e il telefono non si raggiungono direttamente: entrambi si collegano
in uscita al relay pubblico [ntfy.sh](https://ntfy.sh), come verificato in
reparto con `sync-test/`.

- **Accesso, una volta sola per telefono.** Dal profilo in alto a destra,
  «Accedi» genera argomento del
  relay e chiave AES-GCM a 256 bit e li mostra in un QR che apre l'app del
  telefono. La chiave sta solo nel frammento dell'indirizzo (`#…`), che non
  arriva a nessun server; il telefono la toglie subito dalla barra degli
  indirizzi. Il PC salva l'abbinamento solo quando il telefono conferma.
- **Invio.** «Invia la lista al telefono» manda la lista compressa e cifrata,
  a pezzi sotto i 4 KB (oltre, ntfy.sh la trasformerebbe in allegato). Il
  telefono la ricompone, la importa nel calendario e manda la ricevuta.
  Se l'app è chiusa la riceve all'apertura: il relay conserva i messaggi 12 ore.
  Ogni paziente porta il protocollo scelto in verifica (l'id, oppure `-` per
  «nessuno, si imposta sul telefono»): il telefono lo usa se lo conosce,
  altrimenti lo riconosce da sé.
- **Sincronizza.** Il tasto in alto, accanto al profilo, porta al telefono la
  libreria ufficiale di questo PC e il profilo con i personali: il telefono
  riconosce e propone gli stessi protocolli del PC, comprese le fasi
  urografica e tardiva per surrene. Un pallino rosso segnala modifiche che il
  telefono non ha ancora; il telefono conferma e il pallino si spegne. Inviare
  una lista le manda da sole, prima della lista. Dal telefono, in Impostazioni,
  «Sincronizza con il PC» chiede al PC (se è aperto) di rimandare tutto; finché
  non arriva nulla il telefono usa la libreria SIRM 2022 incorporata.
- **Seduta.** Elettiva o pronto soccorso si sceglie importando: al passo 1 ci
  sono due ingressi, «Importa TC elettiva» e «Importa pronto soccorso». La
  seduta viaggia con la lista. Il telefono non sceglie: all'apertura il dorso della carta
  con il marchio StructuRad si gira e mostra direttamente la seduta
  dell'ultima lista ricevuta, con i suoi colori.
- **Giornata d'esame.** È la data della colonna «Orario» dei pazienti, non
  quella di stampa del report; se i pazienti non sono tutti dello stesso giorno
  vale la più frequente, e la verifica lo segnala. Il telefono tiene solo oggi
  e i giorni a venire: scarta le liste di giornate passate (il PC lo mostra) e
  all'avvio toglie le schede dei giorni precedenti.
- **Importazione sul telefono.** Le schede nuove entrano come elettive da fare,
  con 70 kg di peso (il RIS non lo riporta) da correggere in scheda; quelle
  ancora da fare si aggiornano; quelle già lavorate o nel cestino restano
  come sono.

Il relay vede solo testo cifrato. Senza un telefono abbinato il tool contatta la
rete solo quando si preme «Accedi»: aprirlo e lavorare resta un'operazione senza
rete. Con un telefono abbinato si mette in ascolto all'apertura, per il profilo.
Il canale è in `canale.js`, condiviso con l'app del telefono.

## Profilo dell'operatore

I protocolli personali, compresi quelli appresi, sono di chi li usa e non del
PC: vivono nel **profilo**, sul telefono dell'operatore. Abbinando il telefono a
un PC qualsiasi, di questo o di un altro ospedale, il profilo arriva al PC e i
suoi personali diventano quelli del tool; ciò che si crea o si impara sul PC
torna al telefono dallo stesso canale cifrato delle liste. Vince la versione più
recente.

- **Sul PC, in alto a destra.** Il pulsante del profilo apre un pannello con
  l'accesso e le impostazioni. Da scollegati dice «Accedi»: il pulsante omonimo
  mostra il QR. Quando il profilo arriva, il tool saluta per nome e il pulsante
  mostra iniziali e nome di cortesia: titolo e cognome («Dr. Viggiano»,
  «Dr.ssa Viggiano»), oppure nome e cognome se non c'è titolo. Il titolo non si
  ricava dal nome: lo sceglie l'operatore nel profilo. «Esci» scollega.
- **Sul telefono, al primo avvio.** Dopo l'apertura una finestra chiede nome,
  cognome e titolo (Dr., Dr.ssa o nessuno) e crea la cartella del profilo
  nell'area privata dell'app (`protocol-cards/profilo/profilo.json`, Origin
  Private File System), chiedendo al browser di proteggerla dalla pulizia
  automatica. «Più tardi» la rimanda; i dati si cambiano in Impostazioni →
  «Il tuo profilo», e il PC si aggiorna da solo. Se la memoria del browser
  viene svuotata, il profilo si ricarica dalla cartella.

- Sul PC resta solo la copia del profilo abbinato. Se si abbina il telefono di un
  altro operatore, o si scollega, quella copia sparisce dal PC; i protocolli
  restano sul telefono.
- I personali creati prima dei profili restano «di questo PC»: al primo
  abbinamento il tool propone di portarli nel profilo.
- Sul telefono «Esporta profilo» ne fa un file, con anche i protocolli appresi
  sul telefono, da salvare dove si vuole (Drive, mail); «Importa profilo» lo
  riporta su un telefono nuovo.
- Con un telefono abbinato il tool si mette in ascolto sul relay all'apertura,
  per ricevere il profilo; senza abbinamento aprirlo resta senza rete.

## Backup del profilo su Google Drive

Sul telefono, in Impostazioni → «Backup su Google Drive», «Collega Google Drive»
fa accedere l'operatore al proprio account Google e da lì il profilo si copia da
solo nella cartella nascosta riservata all'app (`appDataFolder`, permesso
`drive.appdata`): Protocol Cards vede solo quel file, e il file non compare fra i
documenti del Drive. Nel file vanno nome, titolo, protocolli personali e appresi,
questi ultimi senza il testo del quesito; mai dati dei pazienti né la chiave di
abbinamento. Il token di Google resta solo in memoria.

- **Accesso con andata e ritorno.** L'app passa dalla pagina di Google nella
  stessa scheda e Google la riapre con l'accesso nel frammento dell'indirizzo,
  che l'app toglie subito. Niente finestre a comparsa: sui telefoni diventano
  schede e non sempre tornano all'app.
- **Automatico mentre l'accesso vale.** Google concede l'accesso per un'ora.
  Finché vale, ogni modifica al profilo va su Drive dopo pochi secondi; dopo, il
  backup resta in sospeso: un pallino sulle impostazioni e «Aggiorna backup», che
  ripassa da Google con lo stesso account, di solito senza chiedere nulla. Il
  pallino compare anche se l'ultima copia ha più di un giorno.
- **Telefono nuovo.** Al primo accesso «Hai già un profilo? Recuperalo da Google
  Drive»; oppure «Recupera da Drive» nelle impostazioni.
- **Scollega** revoca l'accesso; la copia su Drive resta.

L'ID client OAuth di Google è in `DRIVE_CLIENT_ID` in `prototype/index.html`
(progetto Google Cloud «Protocol Cards», app in test: accedono solo gli utenti di
test aggiunti nel progetto). Google lo accetta solo dall'origine autorizzata,
`https://radios4ndbox-bot.github.io`: da una copia locale il backup resta spento
e l'app non contatta Google. Per ricrearlo:

1. [console.cloud.google.com](https://console.cloud.google.com): nuovo progetto,
   per esempio «Protocol Cards».
2. API e servizi → Libreria → **Google Drive API** → Abilita.
3. Schermata di consenso OAuth (Google Auth Platform): tipo *Esterno*, nome
   dell'app, email di assistenza; fra gli ambiti
   `.../auth/drive.appdata`. Finché l'app è *in test* possono accedere solo gli
   account aggiunti come utenti di test (fino a 100).
4. Credenziali → Crea credenziali → **ID client OAuth** → *Applicazione web*;
   origini JavaScript autorizzate: `https://radios4ndbox-bot.github.io`;
   URI di reindirizzamento autorizzati:
   `https://radios4ndbox-bot.github.io/Protocols_Cards/prototype/index.html`.
5. L'ID client (`….apps.googleusercontent.com`) va in `DRIVE_CLIENT_ID`. Non è
   un segreto: identifica l'app, e Google accetta richieste solo dalle origini
   autorizzate.

## Fasi per sezione (telefono)

Nella scheda del telefono le fasi non si scelgono più zona per zona: i distretti
della richiesta (anche più esami insieme, «TC torace | TC addome») diventano
**sezioni** — encefalo, collo, torace, addome superiore o completo — e per ciascuna
si toccano le fasi possibili. Le acquisizioni si compongono da sole:

- sezioni vicine nella stessa fase diventano una sola scansione: torace + addome
  in venosa → torace-addome completo (o superiore), collo + torace + addome →
  «collo + torace-addome»; fasi diverse restano separate;
- «separa» / «unisci» su un'acquisizione tiene distinti o riunisce torace e addome;
- il protocollo applicato si stende sulle sezioni, che si mostrano già colorate;
- per l'encefalo c'è la fase **Ritardo 5'** (300 s), a sé;
- nel calcolatore il **flusso** (ml/s) si cambia direttamente, con − e + o
  scrivendolo: l'IDR segue (flusso × concentrazione del mezzo), nei suoi limiti, e la
  dose risulta «modificata»;
- le zone che non sono un distretto (l'angio-TC, le fasi fisse dei protocolli)
  restano come sono; per i casi particolari resta «Aggiunta manuale».

La lettura della richiesta ora riconosce anche «TC collo torace addome» come
un'unica regione dal collo all'addome (prima risultava solo «collo»).

## Planning

Si può importare la lista di un giorno a venire, per esempio quella di domani, e
preparare i protocolli in anticipo: in verifica sul PC, oppure sul telefono.

- **PC.** La giornata è quella del PDF: se è futura, la verifica la segna
  «planning» e il tasto diventa «Invia il planning». Il telefono deve aprire l'app
  entro 12 ore dall'invio (il relay non tiene i messaggi più a lungo).
- **Telefono.** Se si sta lavorando sulla giornata di oggi, resta aperta: il
  planning compare nel selettore delle giornate in cima alla bacheca («Oggi ·
  Planning · dom 4 ott»). Le schede si possono già impostare; «Fine giornata» non
  c'è finché la giornata non arriva.
- **Il giorno degli esami** l'app si apre da sola su quella giornata, con le
  schede e i protocolli già pronti, senza reimportare nulla. Se il PC rimanda la
  lista quel giorno, le schede già impostate restano come sono e si aggiungono
  solo i pazienti nuovi.

## Zona ospedale (telefono)

In Impostazioni → «Zona ospedale», stando in ospedale, «L'ospedale è qui: attiva»
salva sul telefono il centro e il raggio: 2 km di base, per stare larghi anche negli
ospedali grandi; 1 km o 500 m per quelli piccoli. Da lì le schede
dei pazienti si vedono solo dentro la zona:

- all'apertura e a ogni ritorno nell'app restano coperte finché la posizione non
  conferma «dentro»; con l'app aperta la posizione si segue di continuo, e si
  rilegge comunque ogni 20 secondi;
- se risulta «fuori» (anche tolto l'errore dichiarato dal GPS) le schede di oggi e
  il cestino si cancellano subito e le liste del PC non entrano finché non si
  torna: non vengono segnate come ricevute, quindi arrivano al rientro (il relay le
  tiene 12 ore). Il planning dei giorni a venire resta nel telefono, nascosto (né in
  bacheca né nel selettore), e ricompare al rientro, con le schede già impostate;
- se la posizione non arriva entro 15 secondi o il permesso è negato, le schede
  restano coperte senza essere cancellate; si può disattivare la zona solo
  cancellandole.

Un'app web non può leggere la posizione quando è chiusa: il controllo avviene alla
riapertura, prima di mostrare qualsiasi scheda. La posizione non lascia il
telefono.

## Icone

Il marchio StructuRad sul dorso blu della carta. Sorgenti vettoriali in `brand/`
(`icona.svg`, `icona-maskable.svg`, `favicon.svg` con le sole lettere SD); i PNG
dell'app (192, 512, maskable, Apple, favicon 32) si rigenerano con
`node brand/genera-icone.js`. Il tool PC ha la favicon incorporata, per restare un
file unico; l'app ha il manifest per la schermata Home.

## Backup della libreria ufficiale

La libreria ufficiale è del reparto e resta sul PC. Nelle impostazioni del
pannello del profilo (in alto a destra), «Scegli cartella» collega una cartella del computer, anche dentro
Google Drive o OneDrive per desktop, che ne fanno la copia nel cloud. Il tool ci
scrive `protocol-cards-backup.json` e lo riscrive da solo a ogni modifica, con
accanto la versione precedente (`protocol-cards-backup.precedente.json`). Nel
file ci sono solo i protocolli ufficiali: niente personali (sono nel profilo),
nessun dato paziente, nessuna chiave di abbinamento.

Su un PC nuovo «Recupera dal backup» rilegge la cartella, mostra cosa contiene e,
confermando, sostituisce la libreria ufficiale; la cartella resta collegata.

Serve Chrome o Edge (File System Access). Il browser può chiedere di nuovo il
permesso a ogni apertura: il backup va in pausa e riparte con «Riattiva».
Chrome offre anche «Consenti a ogni visita», che evita la richiesta.

## Intro

All'apertura parte la stessa coreografia di ER Oncology Archivist, con le carte
al posto del marchio e lo sfondo del tool: le quattro fasi (basale, arteriosa,
venosa, tardiva) compaiono raccolte al centro in dissolvenza, poi si aprono a
ventaglio scivolando a sinistra mentre «Protocol Cards» compare lettera per
lettera con i tempi di Archivist; entra «a StructuRad product»; poi le carte si raccolgono in
una, che si gira e mostra sul dorso il marchio StructuRad, e vola nel marchio
della barra portandosi su la pagina. Nella barra resta la copia del dorso, su
cui la carta atterra al pixel (lo verifica `intro.test.js`). Dura circa
poco più di quattro secondi;
si salta con un clic, Esc, Invio o Spazio. Con «riduci movimento» attivo nel
sistema non parte.

- `intro/fase-*.jpg`: una TC dell'addome per fase, ritagliate dalla figura
  fornita e incorporate da `build.js` come data URI. Prima di distribuire il
  tool va verificato che la licenza della figura ne consenta l'uso; per
  sostituirle basta rimpiazzare i quattro file (360×311 px).
- Il nome è in Sora 300 (SIL Open Font License), convertito in tracciati:
  un `<path>` per lettera, nessun font da caricare.
- `intro.test.js` controlla sequenza, salto e «riduci movimento»; gli altri
  test aprono il tool con «riduci movimento», così l'intro non li copre.

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
validazione. È condiviso con il telefono, che lo carica da `../desktop/`:
stessa libreria, stesso riconoscimento, così il PC mostra esattamente cosa
suggerirà il telefono.

I quesiti reali sono scritti per sigle. Prima del confronto ogni sigla diventa
il termine per esteso: *npl, neopl, k, carcinoma* → neoplasia; *sec, mts, M+* →
metastasi; *rival* → rivalutazione; *RCC* → neoplasia renale; *PNX* →
pneumotorace; *AAA* → aneurisma aorta addominale; *noduli* → nodulo. La regola
vale anche per i termini scritti nella libreria. Un termine può chiedere più
parole insieme: `followup + neoplasia` vale solo se ci sono entrambe, in
qualunque punto del quesito. Con più esami, la regione è l'unione dei distretti
del tronco (torace + addome completo → torace-addome completo).

La libreria di partenza ha una **revisione**. Se la libreria ufficiale salvata
sul PC è identica a una revisione precedente, si aggiorna da sola all'apertura.
Se il reparto l'ha modificata resta com'è, e la nuova revisione si adotta con
«Ripristina».

La libreria modificata resta nel browser del PC (localStorage): non contiene
dati personali. La **firma** di 7 caratteri identifica la versione e cambia a
ogni modifica; si può esportare e reimportare come JSON.

## Due opzioni per paziente

All'import ogni paziente riceve, dal riconoscimento del quesito, un'opzione
**ufficiale** e una **personale** (voce appresa per quel caso o protocollo
personale riconosciuto dai termini). Si propone la personale quando c'è;
in verifica si passa dall'una all'altra con un clic, e il telefono le riceverà
entrambe per poter cambiare idea anche in reparto.

## Protocol builder

Sta dentro **Protocolli**: si apre con «+ Insegna un protocollo», dalla scheda
dei personali o dalla colonna Protocollo della verifica, per un caso preciso.
Insegna al tool un protocollo personale partendo da richieste d'esempio: ne
ricava i termini del quesito e la regione dell'esame, mostra se gli esempi
verrebbero riconosciuti e quanti pazienti della lista caricata passerebbero
al nuovo protocollo. Gli esempi non vengono salvati.

## Colori delle fasi

| fase | colore |
|---|---|
| basale | grigio |
| arteriosa | rosso |
| venosa | blu |
| tardiva | verde acqua |
| urografica | giallo |
| tardiva per surrene | bordeaux |

## Dati dei pazienti

Le liste RIS reali **non vanno nel repository**: `.gitignore` blocca i PDF.
Il test usa una fixture sintetica che riproduce il layout con dati inventati.

## Test

```
node ris-parser.test.js                          # fixture sintetica, nessun dato reale
node protocolli.test.js                          # riconoscimento identico al prototipo
RIS_PDF_DIR=/percorso node end-to-end.test.js    # richiede una lista RIS chiamata lista.pdf
node sincronizzazione.test.js                    # PC → telefono con un relay finto locale
node profilo.test.js                             # primo accesso, «Dr. Viggiano», profilo fra due PC, relay finto
node backup.test.js                              # backup della libreria ufficiale in una cartella
node tendine.test.js                             # menu a tendina del tool
node intro.test.js                               # intro, salto e «riduci movimento"
```

Il test end-to-end apre il file costruito da `file://` e verifica anche che
non parta **nessuna richiesta di rete**.
