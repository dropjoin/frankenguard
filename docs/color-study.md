# Color selection study: harmony, proportion, contrast

Studied 2026-11-12 on the user's order. Applies to ALL future projects,
competitions and own projects alike. This file records the method and the
verified numbers for the FrankenGuard palette. Every future project picks
its own theme palette with the same method, and verifies contrast by
computation before build.

## Sources

- Biznet Gio, 100+ Kode Warna HTML (user-sent): hex codes, pastel/neon/
  flat/material palettes, 60-30-10, contrast, brand character, accents.
- InventiveHQ, Color Harmonies Guide for Web Design: seven harmonies,
  harmony-to-mood table, 60-30-10, WCAG 4.5:1 / 3:1.
- colorpalette.shop, A Complete Guide to Color Theory for Web Designers:
  five harmonies with hex codes, contrast ratio, 60-30-10.
- TL3 Tools, Color Theory for Web Designers: wheel, harmonies, WCAG
  minimums, 60-30-10.
- WCAG contrast guides (palettes.newbeeproduct.com, fbsubnet.com,
  toolsdocks.com, toolkitsphere.com): thresholds, luminance formula,
  large-text definition, non-text contrast, no-rounding rule.

## 1. Harmony: which hues belong together

Harmony is geometry on the 12-hue wheel. It decides which hues sit
together. It says nothing about readability.

- Complementary: two hues 180 degrees apart. Maximum contrast, maximum
  energy. Use one dominant, one accent only. Equal area at equal
  lightness vibrates and tires the eye.
- Analogous: 3 to 5 neighboring hues within 30 to 60 degrees. Calm,
  cohesive, safest scheme. Best for backgrounds, gradients, and
  content-heavy pages. Add one complementary pop for hierarchy.
- Triadic: three hues 120 degrees apart. Vibrant and balanced. One
  dominant, one secondary, one accent. Hard to control at full
  saturation: keep chroma low on two of the three.
- Split-complementary: one base hue plus the two hues beside its
  opposite. Contrast without harshness. The safe default for modern,
  professional UI.
- Tetradic: two complementary pairs, a rectangle on the wheel.
- Square: four hues 90 degrees apart.
- Monochromatic: one hue in different tints, shades, tones. Never
  clashes, needs a contrast accent for hierarchy.

## 2. Proportion: 60-30-10

Harmony tells which colors. 60-30-10 tells how much.

- 60 percent: dominant color. Backgrounds, large sections, surfaces.
- 30 percent: secondary color. Content areas, supporting elements.
- 10 percent: accent color. CTAs, highlights, the elements people
  must click. The boldest color is reserved for the smallest area.

## 3. Contrast: WCAG AA, verified by computation

Formula: contrast ratio = (lighter luminance + 0.05) / (darker
luminance + 0.05). Relative luminance runs 0 (black) to 1 (white).
Scale runs 1:1 to 21:1.

Thresholds (WCAG 2.x, success criteria 1.4.3, 1.4.6, 1.4.11):

- Normal text: 4.5:1 at AA, 7:1 at AAA.
- Large text: 3:1 at AA, 4.5:1 at AAA. Large text means 24px or
  larger regular, or 18.66px or larger bold. A 19px regular label is
  still normal text and needs 4.5:1.
- UI components and meaningful graphics: 3:1 at AA. Form borders,
  focus indicators, icon-only buttons, chart lines.
- Exempt: logos, decorative elements, disabled controls.

Hard rules from the sources:

- Harmony does not equal accessibility. A harmonious palette can
  still be unreadable. Verify contrast separately, always.
- 4.5:1 is a floor, not a target. A pair passing by 0.01 on one
  screen can fail on another.
- No rounding. WCAG compares the exact ratio. 4.48:1 fails AA for
  normal text even though it rounds to 4.5.
- Small, gray, and secondary text gets no discount. Placeholders and
  captions are still text.

## 4. FrankenGuard palette: harmony analysis

Base: an analogous cool family. Violet #673AB7 and #9B59B6, blue
#3498DB, light tints #D7EBFF and #E9E2FF. Neighbors on the wheel,
calm and cohesive, carries the Kiro purple identity.

Accents: two complementary pairs against that base. Orange #FF5F1F
sits opposite blue: the CTA color. Yellow #F1C40F sits opposite
purple: the highlight color. Neon green #39FF14 is the Frankenstein
electric accent, used sparingly, graphics only, never text.

Proportion holds it together: the loud hues live in the 10 percent
accent slice, never as large surfaces. Neon as a big background
tires the eye; the Biznet article says the same.

## 5. Contrast verification, computed 2026-11-12

WCAG 2.x relative luminance formula, threshold 0.04045. Background
#F2F2F2 unless noted. AA normal needs 4.5:1, AA large needs 3:1.

PASS, safe for normal text:

- Body #1F2937 on #F2F2F2: 13.11:1
- Body #111827 on #F2F2F2: 15.85:1
- Body #1F2937 on #D7EBFF: 12.03:1
- Body #1F2937 on #E9E2FF: 11.73:1
- Deep purple text #673AB7: 6.55:1
- Violet text #7C3AED: 5.09:1
- White on deep purple #673AB7: 7.33:1
- White on flat purple #9B59B6: 4.67:1 (marginal, avoid for small text)
- Dark #111111 on orange CTA #FF5F1F: 6.21:1
- White on hero gradient #8E2DE2 to #4A00E0: 5.80:1 to 8.87:1
- Dark #111111 on yellow #F1C40F: 11.37:1
- Corrected green text #166534: 6.37:1
- Corrected red text #B91C1C: 5.78:1
- Corrected amber text #92400E: 6.33:1
- Corrected blue text #1D4ED8: 5.99:1 (#2563EB at 4.62:1 is marginal)
- Corrected orange text #C2410C: 4.63:1 (marginal, prefer sparingly)
- Corrected info text #0369A1: 5.30:1

FAIL for normal text, and the rule each failure creates:

- Flat purple #9B59B6 text: 4.17:1. Large/bold headings only, or
  graphics. Never body text.
- Flat blue #3498DB text: 2.82:1. Fails even large text. Never text
  on light backgrounds. Graphics, borders, fills only. Text uses
  #1D4ED8.
- White on orange CTA #FF5F1F: 3.04:1. Orange buttons use DARK text
  (#111111, 6.21:1), not white.
- Success green #16A34A text: 2.94:1. Fails even large text. The
  Biznet semantic green is for icons and fills, not text. Text uses
  #166534. Note #15803D measures 4.48:1 and still fails: no rounding.
- Error red #EF4444 text: 3.36:1. Large text only. Normal text uses
  #B91C1C. Note #DC2626 at 4.31:1 also fails.
- Warning amber #F59E0B text: 1.92:1. Never text. Text uses #92400E.
  Note #B45309 at 4.49:1 fails by 0.01.
- Neon green #39FF14 text: 1.21:1. Never text, ever. Accents and
  graphics only.
- Info sky #0EA5E9 text: 2.48:1. Never text. Text uses #0369A1.
- White on flat blue #3498DB: 3.15:1. Large/bold only. Blue buttons
  with normal-size white labels must use a darker blue.

## 6. Standing method for every project

1. Name the theme first. Palette follows the competition or project
   theme, never a generic default.
2. State the harmony in writing: which hues, which relationship on
   the wheel, and why.
3. Apply 60-30-10. Boldest color in the smallest slice.
4. Bright and alive base. No all-dark default. Dark only when the
   user explicitly asks.
5. Compute every text/background pair before build. No pair ships
   unmeasured. Near-misses fail: 4.48:1 is a fail.
6. Separate fill colors from text colors. A color that works as an
   icon or button fill often fails as text. Keep a darker text
   variant for every status color.
7. Neon and saturated accents stay accents. Never big backgrounds,
   never body text.
8. Re-verify after any palette change. One changed hex re-opens the
   whole table.
