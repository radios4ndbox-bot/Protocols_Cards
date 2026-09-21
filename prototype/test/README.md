# Test del prototipo

Girano in Chromium con Playwright, su `../index.html` aperto da `file://`.

```
npm install playwright
node interazione.test.js   # calendario, sedute, schede, cestino, apprendimento
node zone.test.js          # deduzione della regione dall'esame
node sigle.test.js         # sigle di zona espandibili
node escaping.test.js      # testo ostile nei campi non deve iniettare markup
```
