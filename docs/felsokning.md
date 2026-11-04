# Felsökning med agent

## Problemet du analyserade

Gäst trycker "Betala med Swish". Swish-appen öppnas men visar att länken inte är korrekt. Appen öppnas, så `open_swish` loggas aldrig och `client_errors` säger ingenting.

Kod: `src/lib/guest/swish.ts` (`swishAppLink`, `swishPayee`), `src/views/guest/BillSheet.tsx`.

## Hur du beskrev det för agenten (vad gav du för kontext?)

"När en user klickar på swish och swish-appen öppnas så fungerar inte länken korrekt, det är som att numret är fel eller något annat inte fungerar." Bad om tre hypoteser om rotorsaken med mekanism och verifieringssteg. Senare: den exakta länken som skapades och symptomet (felet "länken är inte korrekt").

## Agentens hypoteser

1. **Fel format på `payee.value`** (`46…` mot `07…`). Mest sannolik.
2. **Oväntat innehåll i länken**: tecken i meddelandet, saknade `editable`-fält, kodning.
3. **Miljön hanterar `swish://` fel**: in-app-webbläsare klipper eller blockerar länken.

Avfärdat tidigt: beloppet (`owed` är heltal) och lagringen av numret (alltid `46` + 9 siffror).

## Vilken hypotes du valde och varför

Hypotes 1. Symptomet "numret är fel" pekade på `payee`, och `46…`-formatet var hämtat från QR-formatet, inte från Swish deep link.

## Vad som faktiskt var fel

Numret var inte fel. Swishs dokumentation (som du kollade) bekräftar att landskodsformatet `46…` är korrekt. Felet låg i övrig JSON i `swishAppLink`:

- `version` ska vara strängen `"1"`, inte talet `1`.
- `payee` ska ha `editable: false`.

Båda ändringarna finns i PR 246. Ej testat på riktig telefon.

## Vad agenten fick rätt och vad den missade

- Rätt: felet låg i hur `swishAppLink` bygger `data`, inte i beloppet, lagringen av numret eller loggningen. Den pekade också på det saknade `editable`-fältet (hypotes 2), som visade sig behövas.
- Fel: hypotes 1, att `46…` var fel format. Agenten gissade från minnet och hade inte kollat Swishs dokumentation. Du gjorde det och visade att numret var rätt.
- Missade: `version` som sträng. Den kom från dig, och agentens testlänkar hade alltid talet `1`.

## Lärdom

Förankra i dokumentationen som finns innan hypoteserna formuleras. Ett klassiskt fel vid integrationer mot andra tjänster: formatet antas från minnet eller från en näraliggande lösning (här QR-formatet) i stället för att slås upp i tjänstens egen dokumentation. En uppslagning hade här visat både `version` som sträng och `editable` på `payee` direkt.

## Uppföljning efter PR 246 (felet kvarstod)

PR 246 ändrade `version` till strängen `"1"` och la till `editable: false` på `payee`. Swish visade fortfarande "Felaktig länk: Länken som användes för att öppna appen har ett felaktigt format." på en riktig iPhone.

Vad som går att belägga: Swish egen dokumentation (developer.swish.nu) gick inte att nå från agentens miljö. Det enda som kunde läsas var en tredjeparts-snutt som bygger länken så här och som är känd att fungera: `swish://payment?data=` + URL-kodad JSON `{"version":1,"payee":{"value":"0701234567"},"amount":{"value":100,"editable":true},"message":{"value":"Thanks"}}`. Skillnaderna mot vår länk: `version` är talet `1` (inte strängen), och numret står i nationell form `07…` (inte `46…`). `46…`-formatet hör till QR-koden och handlarlänkar, inte till den här privatlänken.

Ändring: `swishAppLink` skickar nu `version: 1` och numret som `0701234567`, utan `editable` på `payee`. QR-koden är oförändrad. Testet låser exakt URL.

**Ej verifierat utan telefon.** Testa i ordning på iPhonen (skriv in ditt eget nummer; öppna länken från Safari, t.ex. som ett Notes-/meddelandelänk):

1. Appens nya länk (`07…`, version 1):
   `swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220701234567%22%7D%2C%22amount%22%3A%7B%22value%22%3A100%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Mingle%20test%22%7D%7D`
2. Samma med landskod (`46…`, version 1):
   `swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%2246701234567%22%7D%2C%22amount%22%3A%7B%22value%22%3A100%2C%22editable%22%3Atrue%7D%2C%22message%22%3A%7B%22value%22%3A%22Mingle%20test%22%7D%7D`
3. Minimal, bara nummer:
   `swish://payment?data=%7B%22version%22%3A1%2C%22payee%22%3A%7B%22value%22%3A%220701234567%22%7D%7D`

Byt `0701234567` mot det riktiga numret. Berätta vilken som fungerar, så låser vi den.
