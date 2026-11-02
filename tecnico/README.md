# Protocol Cards — app tecnici

App di **sola lettura** per i tecnici di radiologia. Mostra le schede che il
medico ha **impostato** sul suo telefono (l'app del medico, `../prototype/`):
protocollo, fasi con ritardi e zone, volume e flusso dal peso e dal mezzo scelti
dal medico, nota del medico. Si aggiorna da sola; una scheda non impostata non
compare, e una riattivata sparisce. Le schede di oggi vengono prima, poi il
planning dei giorni a venire; le eseguite restano attenuate.

Pubblicata su GitHub Pages:
<https://radios4ndbox-bot.github.io/Protocols_Cards/tecnico/>

## Collegamento

1. Sul telefono del medico: **Impostazioni → App tecnici → Collega i tecnici**.
2. Il tecnico inquadra il codice con la fotocamera: si apre l'app, già collegata.
   Lo stesso codice vale per tutti i telefoni del reparto («Mostra il codice»).
3. «Nuovo abbinamento» sul telefono del medico scollega i tecnici collegati finora.

Nelle impostazioni del medico compare quali telefoni dei tecnici hanno ricevuto
l'ultima versione.

## Dati

- Il canale è quello di `../desktop/canale.js` (relay ntfy.sh, AES-GCM, chiave
  solo nel codice), con un abbinamento proprio, distinto da quello PC ↔ telefono.
- Viaggiano orario, accettazione, esame, quesito, protocollo, fasi, peso, mezzo e
  nota delle sole schede impostate. **Il nome del paziente non viaggia.**
- Sul telefono del tecnico resta solo l'abbinamento: le schede non vengono
  salvate e alla riapertura arrivano di nuovo dal canale (il relay conserva i
  messaggi 12 ore; se l'ultima pubblicazione è più vecchia, il telefono del
  medico la rimanda appena un tecnico si collega).

Prima dell'uso con dati reali va informato il DPO.
