# Felsökning med agent

Arbetsdokument som fylls i under tiden vi löser problemet tillsammans.

## Problemet du analyserade

När en gäst trycker på "Betala med Swish" i sin räkning öppnas Swish-appen, men betalningen är inte rätt ifylld. Det ser ut som att numret är fel, eller att något annat i länken inte fungerar.

Relevant kod:

- `src/lib/guest/swish.ts`: `swishAppLink`, `swishPayee`, `swishMessage`, `swishQrText`
- `src/lib/guest/swish-open.ts`: `watchSwishOpen`
- `src/views/guest/BillSheet.tsx:167`: `<a href={swishAppLink(pay)}>`
- `src/lib/schemas/costs.ts`: `normalizeSwishNumber` (numret lagras som `46701234567`)

Länken som byggs idag:

```
swish://payment?data=<urlencoded JSON>
{ version: 1,
  payee:   { value: "46701234567" },
  amount:  { value: <heltal kr>, editable: true },
  message: { value: "Mingle K7Q2 Anna" } }
```

Redan utrett:

- Beloppet (`bill.owed`) är ett heltal, så decimaler är sannolikt inte orsaken.
- Lagringen och normaliseringen av numret ser konsekvent ut. Det lagras alltid som `46` + 9 siffror.

## Hur du beskrev det för agenten (vad gav du för kontext?)

Beskrivning från dig: "När en user klickar på swish och swish-appen öppnas så fungerar inte länken korrekt, det är som att numret är fel eller något annat inte fungerar."

Att komplettera (viktigt för att skilja hypoteserna åt):

- [ ] iOS eller Android? Vilken Swish-version?
- [ ] Öppnas länken från vanliga webbläsaren eller från en in-app-webbläsare (Messenger, Instagram och liknande)?
- [ ] Vad visar Swish exakt: tomt nummer, fel nummer, fel belopp, eller felmeddelande?
- [ ] Fungerar QR-koden med samma data?
- [ ] Vilket nummer hade hosten angett och vad visades i Swish?

## Agentens hypoteser

Ordnade efter sannolikhet.

### 1. Payee-värdet har fel format för Swish deep link (mest sannolik)

**Mekanism:** Koden skickar `payee.value = "46701234567"` (landskod, ingen nolla). Swish-appen tolkar payee-fältet i `swish://payment` strikt. Om den väntar sig nationellt format (`0701234567`), eller bara accepterar ett visst format för privatnummer, visas numret som ogiltigt eller fel. Det stämmer med symptomet "numret är fel". Fältet `payee` saknar också `editable`, så appens standardbeteende för det fältet kan skilja sig från vad vi tror. QR-formatet (`C46…;…`) är ett annat format som tar `46`-numret, vilket gör det lätt att anta att samma format gäller i deep linken.

**Verifiering:**

1. Öppna `swish://payment?data=…` på en riktig telefon med tre varianter av `payee.value`: `46701234567`, `0701234567` och `+46701234567`. Notera vad Swish visar.
2. Lägg till `"editable": false` på payee och testa igen.
3. Jämför mot Swish officiella dokumentation för deep links och mot en länk som Swish-appen själv skapar ("dela betalningslänk").
4. Kontrollera om QR-koden för samma gäst och belopp visar rätt nummer. Om QR är rätt och länken fel pekar det starkt på hypotes 1.

### 2. Appen får en tolkningsbar men oväntad länk (kodning, message eller saknade fält)

**Mekanism:** `data` är JSON som URL-kodas med `encodeURIComponent`. Swish kan kräva:

- att `message` bara innehåller tecken Swish tillåter. `ALLOWED` släpper igenom bland annat `'` och `"`, som kan vara otillåtna.
- att `message.editable` är satt.
- att fältordning, version eller citattecken är precis som dokumenterat.

Om ett fält underkänns kan Swish kasta hela länken eller ignorera ett fält, vilket kan se ut som att "något annat inte fungerar". Gästens namn ingår i meddelandet, så felet kan bero på namnet (till exempel apostrof, citattecken eller specialtecken), och då blir det oregelbundet.

**Verifiering:**

1. Skriv ut den färdiga länken i konsolen och dekoda `data`-parametern. Kontrollera att JSON är giltig.
2. Testa med ett enkelt namn ("Anna") och sedan med namn med `'`, `"`, å/ä/ö och emoji. Se om felet följer namnet.
3. Testa utan `message`, och med `message.editable: true`.
4. Kolla `client_errors` för `open_swish`. Det loggas bara när appen inte öppnas alls, så det täcker inte detta fall.

### 3. Länken öppnas i en miljö som hanterar `swish://` fel (webbläsare eller in-app-webbläsare)

**Mekanism:** Länken är en `<a href="swish://…">`. In-app-webbläsare (Messenger, Instagram, Snapchat) och vissa Android-webbläsare blockerar, kodar om eller trunkerar anpassade URL-scheman. En lång, URL-kodad `data`-parameter kan klippas, eller så öppnas Swish utan data. Då visas ett tomt eller fel formulär, vilket ser ut som "fel nummer". Gäster kommer ofta in via en QR-kod eller en delad länk i just en sådan webbläsare. `watchSwishOpen` upptäcker bara att appen inte öppnades, inte att den öppnades med fel innehåll.

**Verifiering:**

1. Testa samma länk i Safari, Chrome, Samsung Internet och i en in-app-webbläsare.
2. Jämför den URL som kommer fram med den som byggdes (logga längden på `href`).
3. Prova Swish "betala"-länken via en https-mellanlänk eller kopiera numret som reservlösning, och se om felet försvinner.
4. Fråga de drabbade gästerna hur de kom in på sidan.

## Vilken hypotes du valde och varför

_Att fylla i efter verifiering._

## Vad som faktiskt var fel

_Att fylla i._

## Vad agenten fick rätt och vad den missade

_Att fylla i._

## Undersökningsplan för hypotes 1 (payee-format)

Var numret passerar, från inmatning till Swish:

1. `src/lib/schemas/costs.ts:27` `normalizeSwishNumber`: host-inmatning blir `46701234567`.
2. `src/lib/costs/costs-form.ts:40` `nationalNumber`: visningsformen. Jämför mot det som skickas i länken.
3. `src/views/guest/BillSheet.tsx:76` `pay.number = bill.swishNumber`: det lagrade värdet matas in oförändrat.
4. `src/lib/guest/swish.ts:31` `swishPayee`: kör numret genom en andra normalisering.
5. `src/lib/guest/swish.ts:41` `swishAppLink`: `payee: { value: swishPayee(...) }`, utan `editable`.
6. `src/lib/guest/swish.ts:60` `swishQrText`: samma `swishPayee`, men i QR-formatet.
7. `src/lib/guest/swish.test.ts:46`: testet låser fast `46701234567`, så det bevisar bara att koden gör det vi tror, inte att Swish accepterar det.

Att leta efter:

- Vilket format Swish kräver för `payee.value` i `swish://payment`: `46…`, `07…` eller `+46…`.
- Om `payee` ska ha `editable: false`.
- Om `swishPayee` ger något oväntat för ett lagrat nummer, till exempel en rad utan landskod eller gamla rader som sparats före normaliseringen.
- Om QR-koden (rätt nummer?) och länken (fel nummer?) skiljer sig åt för samma gäst.

## Valt: hypotes 1 (payee-format)

Valt av dig 2026-11-04. Skälet: symptomet "numret är fel" pekar på payee-fältet, och `46…`-formatet är hämtat från QR-formatet, inte från en verifierad deep link-specifikation.

### Loggar

- `client_errors` i Supabase (dashboard, Table editor eller SQL editor). Sparas i 14 dagar. Läser man bara där, inte via API.
- Swish loggar bara `area=costs, action=open_swish` när appen **inte** öppnas. Fel nummer i en app som öppnas loggas inte, så loggen kan inte bekräfta eller avfärda hypotes 1.
- Regeln är att Swish-nummer aldrig loggas (`docs/logging.md`), så numret syns inte där heller.

```sql
select area, action, error_code, count(*), max(created_at)
from public.client_errors
group by 1, 2, 3
order by 4 desc;
```

### Nästa steg

1. Kolla `client_errors` efter `open_swish` (visar bara om appen inte öppnas).
2. Testa tre varianter av `payee.value` på en riktig telefon.
3. Ändra `swishPayee` i `swish.ts` bara om testet visar vilket format som fungerar.

## Nytt fynd: exakt symptom och verklig länk

Symptom (från dig): Swish-appen öppnas, men visar felet att länken inte är korrekt. Appen öppnas alltså, så `open_swish` loggas aldrig och `client_errors` visar inget.

Länken som skapades, avkodad:

```json
{"version":1,"payee":{"value":"46730212025"},"amount":{"value":100,"editable":true},"message":{"value":"Mingle Y474TV ffafaf"}}
```

Slutsatser:

- JSON:en är giltig och kodningen är korrekt, så problemet är inte trasig URL-kodning.
- Numret `46730212025` följer vårt eget mönster (46, 73, sju siffror), så det är inte ett lagringsfel.
- Det som skiljer sig från Swish förväntan (ej verifierat) är `payee.value` i landskodsformat och att `payee` och `message` saknar `editable`. Det passar med hypotes 1 och delvis hypotes 2.

Testlänkar för samma nummer (ändrar en sak i taget, testa i ordning A, B, C, D på telefonen):

- A: `payee.value = 0730212025`, i övrigt som idag.
- B: som A, plus `payee.editable = false`.
- C: som idag (`46730212025`), plus `payee.editable = false`.
- D: som B, plus `message.editable = true`.

Resultat: _att fylla i efter test._

## Kandidat från dig

Länken du föreslog behåller `46730212025` men skiljer sig från dagens på två punkter:

- `"version":"1"` (sträng) i stället för `1` (tal).
- `payee.editable = false`.

Detta testades inte i mina varianter A-D: de använde alltid `version` som tal. Om länken fungerar på telefonen är hypotes 1 (att landskodsformatet är fel) avfärdad. Felet ligger då i `version`-typen och/eller i att `payee.editable` saknas. Vilken av de två som spelade roll är inte känt. Resultat: _att fylla i efter test._

## Ändring gjord

`swishAppLink` i `src/lib/guest/swish.ts` bygger nu `version: "1"` (sträng) och `payee: { value, editable: false }`. Numret behåller landskod (`46…`). Testet i `swish.test.ts` uppdaterat. Enhetstest och typecheck gröna. Inte testat på riktig telefon.

## Logg

- 2026-11-04: Koden läst (swish.ts, swish-open.ts, BillSheet.tsx, schemas/costs.ts). Beloppet är heltal. Tre hypoteser formulerade, inget verifierat på riktig enhet än.
