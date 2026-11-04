# Design

Mingle's look is a grown-up party in a nice lounge: charcoal, brass and warm room colours, chunky outlines and hard offset shadows on what you press, and a few bright pops. The colours of the default theme, `lounge`, come from the office lounge where the first event is held: a charcoal floor and velvet sofas, greige walls, a brass chandelier, a rust rug, rose and fig-tree green. The parts (tokens, tiles, buttons) come from the Kalas design system and are copied into this repo, so nothing here depends on an outside source.

**To change the look, edit `src/app/theme.css` (and this file). Components use tokens only: never a hardcoded color, font or size.**

## Personality

- **Grown-up party.** A good dinner with a game after it, not a children's app. Charcoal and brass, with small doses of rust, rose and green.
- **Chunky and tactile.** Rounded rectangles, 2.5px outlines and hard offset shadows on things you press, tilted stickers.
- **Quiet until it counts.** Most screens are calm and readable. The reveal, the winner and the countdown get the loud treatment.

## Themes

A theme is set with `data-theme` on `<html>` or a wrapper. Niche configs in `src/niches/` name theirs as data. The device's dark-mode setting is ignored.

| Theme | id | Look | Used by |
| --- | --- | --- | --- |
| Lounge | `lounge` | Charcoal ground, cream cards, brass accents, a greige TV mat, a green join card. Default, also before an event is read (`index.html` and `:root`). | Every niche; Bachelor has blush (rose) leading |
| Garden party | `garden` | Forest ground, champagne and cream cards, near-black hard shadows. The look before November 2026. | None now |
| One loud color | `loud` | Deeper forest, champagne outlines, dark cards, coral only in shadows and stickers. | None now |
| Champagne day | `day` | Champagne ground, forest TV cards. | Host's "bright room" switch (`events.bright_room`), on the TV and guest phones |

A niche can override a few tokens on top of its theme (`overrides` in its config), for example Bachelor sets `--primary` to blush.

## Color roles

The token names are kept from Kalas so components keep their roles. In `lounge` the brights are room colours: **coral** is rust (the rug), **champagne** is brass (the chandelier), **blush** is rose, **sage** is fig-tree green, and **forest** is a deep green used for the join card and the host bar.

- Ground is `surface`. Cards, chips, rows and answer tiles are `paper`. Wells, tracks and inputs are `surface-sunken`.
- Text is `ink`, secondary `ink-muted`. On paper use `on-paper` and `on-paper-muted`. On a bright fill use `on-bright`. On forest use `on-forest`.
- **Coral** is the brand: primary button, answer A, active states. One primary action per screen.
- **Blush** is the fun accent: answer C, bonuses, accent button.
- **Champagne** is celebration: answer B, first place, the TV join code.
- **Sage** is success: answer D, correct, joined, saved.
- **Forest** is the deep block: the TV join card, the host bar.
- **Stage** (`stage`, text `on-stage`) is the panel an activity shows on the TV.
- **Frame** is the mat round the TV picture (decoration only, no text on it).
- **Award** (`award`, text `on-award` and `on-award-muted`, dots `award-glow`) is the wine-red diploma for award winners and host-entered winners.
- `danger` is only for wrong answers and destructive actions, always with a word or icon.
- Each bright has a `-soft` tint for panels, a `-text` version for colored text and a `-soft-fill` for an answer that steps back: when another answer was chosen, or an option that wasn't right on a reveal. Never fade an answer with opacity; it turns the colours muddy.
- `edge` is the chunky outline, `press` the hard shadow and bottom edge. `line` is decoration only; `line-strong` is for input borders.
- At most three bright fills in one view, plus forest.

## Logo

- The wordmark "mingle" is brass (`champagne-text`) display type with a tilted rust (`coral`) square as the dot on the i (`src/components/Logo.tsx`), so it matches the brass line under it on the TV.
- It is always a link to the start page, wherever it shows.

## Typography

- **Bricolage Grotesque** (`font-display`) for everything that shouts: headings, buttons, answers, names, scores, join codes. Weight 700 to 800.
- **Figtree** (`font-body`) for reading: instructions, helper text, labels.
- Phone: question in a large heading, body at 18px, helper text at 14px. TV: question about 64px, scores about 96px, names about 40px, nothing smaller than about 22px.
- Make size jumps big: a huge score beside a small label. A screen with one text size is a defect.
- Never set paragraphs in the display font, and never set big numbers in Figtree.
- **Bodoni Moda** (`font-serif`) only for award titles ("Kvällens pris", the winners heading, a host-entered winner's title), like a printed diploma. The winner's name is Figtree light in spaced capitals.
- All three fonts are self-hosted with `@fontsource-variable`, so pages make no third-party font requests.

## Shape, borders and shadows

- Corners: `radius-md` 12px for buttons, chips, inputs, tiles; `radius-lg` 14px for cards; `radius-xl` for hero and TV panels; `radius-sm` for stickers and badges; pill only for round things.
- **The hard shadow means "press me".** Only pressable controls (buttons, switches, the wizard's choice buttons, answer tiles) get the 2.5px `edge` outline and the hard offset `shadow-pop-sm`; pressed, they move into the shadow. Cards, panels, stickers, chips, badges and TV panels have a 2px `edge` outline and no shadow. `npm run check:design` enforces it.
- Inputs use a 2px `line-strong` border.
- Shadows are hard and offset, never blurred.
- Cards and stickers may lean up to 3 degrees, alternating the sign between neighbors.

## The fun dial

Host panel and wizard are calm. Guest phones are playful, with a brief party moment at a reveal or winner. The TV idle party screen is playful with one gentle loop; reveals and the winner are party. Go to party for a moment, then back. Only one looping thing demands attention per screen. `prefers-reduced-motion` makes everything calm and is never overridden.

## Accessibility

- Every text pair below reaches 4.5:1 in all three themes, checked by `src/app/theme.test.ts`: `ink` and `ink-muted` on `surface` and `surface-sunken`; `ink` on each `-soft` tint; `on-paper` and `on-paper-muted` on `paper`; `on-disabled` on `disabled` (a disabled button is a flat `disabled` fill with `on-disabled` text and no shadow, never reduced opacity), `on-bright` on coral, blush, champagne, sage and danger, and on each `-soft-fill`; `on-forest` on `forest`; each `-text` color on `surface` and `surface-sunken`.
- `line-strong` reaches 3:1 on the surfaces.
- Keyboard focus is a solid 3px `focus` outline, offset 3px. Inside a `bg-paper` card it uses `focus-on-paper` instead (forest in Garden, champagne in Loud, ink in Day), because champagne is faint on cream.
- Phone tap targets are at least 48px. Color is never the only signal: answers carry a letter, results a word and an icon.
- Icons are lucide-react, never emoji.

## No generic look

Do not use: blue-purple gradients, emoji cards, cards with a colored left border, more than three bright fills in a view, a screen with a single text size, or system-default grey-and-white panels. Every UI PR includes a before/after screenshot.

## Checks that keep the rules true

- `npm test` runs `src/app/theme.test.ts`: every text pair above reaches 4.5:1 in all three themes, every text-bearing token a theme declares must be in the pair list (add new ones there), all themes declare the same tokens, `focus` and `line-strong` reach 3:1 on the surfaces, and `focus-on-paper` reaches 3:1 on `paper`.
- `npm test` also runs `scripts/check-design-rules.mjs` (`npm run check:design`). It fails on hex or `rgb()`/`hsl()`/`oklch()` colors, hardcoded font families and `dark:` classes anywhere in `src/`, except `src/app/theme.css` and the QR code (black on white).
- `npm run test:e2e` runs `e2e/look.spec.ts`: landing, guest and TV party screens and the quiz, awards and hot takes guest and TV screens (open, revealed, end) in each niche theme, no horizontal scroll at 412px and 1920x1080, every button at least 48px high on the phone, and that a TV reveal goes to party and back to playful.

## The TV party screen

- The whole TV sits inside a mat (`TvFrame`, `bg-frame`), like a framed poster or a Frame TV showing art. The language switcher sits inside the mat's corner.
- Inside: the logo over a thin brass line; the welcome on the left (shorter text is bigger, `welcome-size.ts`); the join card on the right; who is here as name chips along the bottom (the latest ten, then "+N till").
- Only one part rotates, under the welcome: menu, schedule, winners, wifi or music, every 30 seconds. The welcome, the join card and the guests never move.
- A running activity takes the left side; the join card and the guests stay.

## Quiz, awards and hot takes

- Answer tiles are coral, champagne, blush, sage for A to D (`src/modules/optionFills.ts`), with a letter chip. A picked tile is pressed in and carries a check, so selection is never color alone. Agree is sage, Disagree blush.
- The TV shows each activity on a stage panel (`src/modules/TvStage.tsx`). A reveal gets about 4 seconds of `party` with confetti (`usePartyMoment`), then goes back to `playful`. The ready screen has the one gentle float.
- An award winner (a revealed category and the closing list) uses `tone="award"`: the diploma, with soft light dots that glow slowly (`AwardDots`) instead of confetti. A host-entered winner pops up over the party screen as the same diploma (`WinnerCongrats`).
- The phone's reveal pops in with a word and an icon (`ResultBadge`, `WinnerCard`). Host sections stay calm.

## Known gaps

- The host panel, including the module sections, is not in the look spec (it needs a host key and several fakes); the TV and guest screens are.

## Host control panel

The panel is a stack of `PanelSection`s (`src/components/PanelSection.tsx`): paper cards that are shut by default, with a title and one calm summary line on the header. The content is only rendered while the section is open, so long lists cost nothing until asked for. A running activity's section opens by itself (`openWhen`). A new panel section uses `PanelSection`; an activity gets its header summary from `useSummary` in its module definition.
