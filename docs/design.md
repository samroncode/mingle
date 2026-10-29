# Design

Mingle's look is a grown-up party: forest green and champagne, chunky outlines, hard offset shadows and a few bright pops. It is based on the Kalas design system and copied into this repo, so nothing here depends on an outside source.

**To change the look, edit `src/app/theme.css` (and this file). Components use tokens only: never a hardcoded color, font or size.**

## Personality

- **Grown-up party.** A good dinner with a game after it, not a children's app. Deep forest, champagne gold, small doses of coral, blush and sage.
- **Chunky and tactile.** Rounded rectangles, 2.5px outlines, hard offset shadows, tilted stickers.
- **Quiet until it counts.** Most screens are calm and readable. The reveal, the winner and the countdown get the loud treatment.

## Themes

A theme is set with `data-theme` on `<html>` or a wrapper. Niche configs in `src/niches/` name theirs as data. The device's dark-mode setting is ignored.

| Theme | id | Look | Used by |
| --- | --- | --- | --- |
| Garden party | `garden` | Forest ground, champagne and cream cards, near-black hard shadows. Default, also before an event is read. | Afterwork; Bachelor (blush leads) |
| One loud color | `loud` | Deeper forest, champagne outlines, dark cards, coral only in shadows and stickers. | Team event |
| Champagne day | `day` | Champagne ground, forest TV cards. | Host's "bright room" switch (later ticket) |

A niche can override a few tokens on top of its theme (`overrides` in its config), for example Bachelor sets `--primary` to blush.

## Color roles

- Ground is `surface`. Cards, chips, rows and answer tiles are `paper`. Wells, tracks and inputs are `surface-sunken`.
- Text is `ink`, secondary `ink-muted`. On paper use `on-paper` and `on-paper-muted`. On a bright fill use `on-bright`. On forest use `on-forest`.
- **Coral** is the brand: primary button, answer A, active states. One primary action per screen.
- **Blush** is the fun accent: answer C, bonuses, accent button.
- **Champagne** is celebration: answer B, first place, the join card.
- **Sage** is success: answer D, correct, joined, saved.
- **Forest** is the deep block: TV hero cards, the host bar.
- `danger` is only for wrong answers and destructive actions, always with a word or icon.
- Each bright has a `-soft` tint for panels and a `-text` version for colored text.
- `edge` is the chunky outline, `press` the hard shadow and bottom edge. `line` is decoration only; `line-strong` is for input borders.
- At most three bright fills in one view, plus forest.

## Typography

- **Bricolage Grotesque** (`font-display`) for everything that shouts: headings, buttons, answers, names, scores, join codes. Weight 700 to 800.
- **Figtree** (`font-body`) for reading: instructions, helper text, labels.
- Phone: question in a large heading, body at 18px, helper text at 14px. TV: question about 64px, scores about 96px, names about 40px, nothing smaller than about 22px.
- Make size jumps big: a huge score beside a small label. A screen with one text size is a defect.
- Never set paragraphs in the display font, and never set big numbers in Figtree.
- Both fonts are self-hosted with `@fontsource-variable`, so pages make no third-party font requests.

## Shape, borders and shadows

- Corners: `radius-md` 12px for buttons, chips, inputs, tiles; `radius-lg` 14px for cards; `radius-xl` for hero and TV panels; `radius-sm` for stickers and badges; pill only for round things.
- Chunky components have a 2.5px `edge` outline. Inputs use a 2px `line-strong` border.
- Shadows are hard and offset, never blurred: `shadow-pop-sm` stickers and chips, `shadow-pop-md` cards, `shadow-pop-lg` one hero card.
- Cards and stickers may lean up to 3 degrees, alternating the sign between neighbors.

## The fun dial

Host panel and wizard are calm. Guest phones are playful, with a brief party moment at a reveal or winner. The TV idle party screen is playful with one gentle loop; reveals and the winner are party. Go to party for a moment, then back. Only one looping thing demands attention per screen. `prefers-reduced-motion` makes everything calm and is never overridden.

## Accessibility

- Every text pair below reaches 4.5:1 in all three themes, checked by `src/app/theme.test.ts`: `ink` and `ink-muted` on `surface` and `surface-sunken`; `ink` on each `-soft` tint; `on-paper` and `on-paper-muted` on `paper`; `on-bright` on coral, blush, champagne, sage and danger; `on-forest` on `forest`; each `-text` color on `surface` and `surface-sunken`.
- `line-strong` reaches 3:1 on the surfaces.
- Keyboard focus is a solid 3px `focus` outline, offset 3px. Inside a `bg-paper` card it uses `focus-on-paper` instead (forest in Garden, champagne in Loud, ink in Day), because champagne is faint on cream.
- Phone tap targets are at least 48px. Color is never the only signal: answers carry a letter, results a word and an icon.
- Icons are lucide-react, never emoji.

## No generic look

Do not use: blue-purple gradients, emoji cards, cards with a colored left border, more than three bright fills in a view, a screen with a single text size, or system-default grey-and-white panels. Every UI PR includes a before/after screenshot.

## Checks that keep the rules true

- `npm test` runs `src/app/theme.test.ts`: every text pair above reaches 4.5:1 in all three themes, every text-bearing token a theme declares must be in the pair list (add new ones there), all themes declare the same tokens, `focus` and `line-strong` reach 3:1 on the surfaces, and `focus-on-paper` reaches 3:1 on `paper`.
- `npm test` also runs `scripts/check-design-rules.mjs` (`npm run check:design`). It fails on hex or `rgb()`/`hsl()`/`oklch()` colors, hardcoded font families and `dark:` classes anywhere in `src/`, except `src/app/theme.css` and the QR code (black on white).
- `npm run test:e2e` runs `e2e/look.spec.ts`: landing, guest and TV party screens in each niche theme, no horizontal scroll at 412px and 1920x1080, and every button at least 48px high on the phone.

**For the module screens (#130):** add the quiz, awards and hot takes guest, TV and host screens to `e2e/look.spec.ts` (each niche, phone and 1920x1080), and use new color tokens only if the pair list in `src/app/theme.test.ts` gets them too.

## Known gaps

- The host panel is not in the look spec (it needs a host key and several fakes); the TV and guest screens are.
