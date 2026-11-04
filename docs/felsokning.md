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
