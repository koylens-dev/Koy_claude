# Claude Code Prompt: "Sigma's Hangout 2.0" Event Poster

*Prepared 2026-10-02*

A ready-to-paste Claude Code prompt that recreates the **Market Square presents
Sigma's Hangout 2.0** flyer as code (HTML/CSS/SVG → PNG). All copy, colours,
layout and layering were taken from the reference flyer.

## How to use

1. In your project, create `poster/assets/` and add:
   - `performer.png`: the performer photo. A transparent cut-out works best.
   - `reference.jpg` (optional): the original flyer, so Claude can compare its
     render against it.
2. Start Claude Code in the project folder and paste the prompt below.
3. To make changes, ask for them in plain language, for example: "make the rays
   thicker", "push the grain harder" or "move the ribbon up 20px".

## Prompt

```text
Design an event flyer as code. Build a print-quality poster in HTML/CSS/inline
SVG and export it to PNG.

## Deliverables
- poster/index.html: one self-contained file with a fixed 1080 × 1350 px
  artboard (4:5 Instagram portrait). Inline CSS and inline SVG only; fonts from
  Google Fonts only.
- poster/render.mjs: a Playwright script (install playwright + chromium if
  missing) that waits for document.fonts.ready, then screenshots ONLY the
  artboard to:
    poster/out/sigmas-hangout-2.0@2x.png  (2160 × 2700, deviceScaleFactor 2)
    poster/out/sigmas-hangout-2.0.png     (1080 × 1350)
- Performer photo: poster/assets/performer.png. If it is not a transparent
  cut-out, remove the background first (e.g. `pip install rembg` →
  `rembg i in.png out.png`) and tell me you did.
- If poster/assets/reference.jpg exists, open it and match it closely.

## Art direction
Retro Afro-summer gig poster with a collage, screen-print feel: warm cream paper,
orange flame-like sun rays, a grainy black-and-white performer cut-out, and
dark-brown torn-paper hills. Keep everything flat and slightly distressed: no
glossy effects, no gradients, no drop shadows.

## Palette (define as CSS custom properties; use nothing else except the B&W photo)
--paper        #F2E4D2   background paper
--paper-shade  #E7D4BD   paper mottling / blotches
--orange       #F5A04A   rays, sun, info box, accents
--orange-deep  #E8862F   bottom strip, subtle edge shading
--maroon       #5A1D12   "HANGOUT", front hills, ribbon, dark text
--brown        #7B3420   back hill layer
--red          #C4252C   "SIGMA'S", BRYMO FANS/SONGS, LAGOS STATE, slashes, asterisk
--cream-text   #FBF1E3   text on dark backgrounds

## Typography (Google Fonts)
- Headline: "Anton", all caps, letter-spacing -0.01em, line-height 0.9.
- Labels/info: "Bebas Neue".
- Small multi-line text (contacts, handle): "Oswald" 500–600.
- Distress the headline ONLY: an SVG mask built from feTurbulence speckle
  that knocks out about 8–12% of the ink, like a worn screen print.

## Layer stack (back → front), coordinates on the 1080 × 1350 artboard
1. Paper: --paper fill + feTurbulence noise (baseFrequency ≈ 0.9, opacity
   ≈ 0.12, multiply) + a few large, soft --paper-shade blotches.
2. Sun rays: about 8 tapered, slightly curved flame/brush-stroke shapes in
   --orange that radiate from a point behind the performer's head
   (≈ 540, 600) and run off the canvas edges. Put a large one in each top
   corner, a small one at top-centre above "MARKET SQUARE PRESENTS", and one or
   two on each side edge between y ≈ 280 and y ≈ 620. Give them rough,
   hand-cut edges. They must NOT pass behind the headline letters.
3. Sun: a large --orange semicircle with slightly faceted/angular edges,
   ≈ 720 px wide and centred at x ≈ 550. Its top sits at y ≈ 665, and the hills
   hide its lower part.
4. Back hills: a --brown torn-paper mountain silhouette, peaks y ≈ 850–900.
5. Front hills: a --maroon mountain band with a jagged torn top edge (peaks
   y ≈ 860–880 at the left/right sides, dipping behind the photo) and a
   2–3 px cream paper-fibre highlight along the tear. It fills down to
   y ≈ 1160.
6. Performer cut-out (details below).
7. Info blocks: date ribbon, orange box, side texts.
8. Footer paper band: a --paper torn strip from y ≈ 1120 to the bottom. Its
   irregular torn top edge overlaps the hills and crops the bottom of the
   photo.
9. Bottom strip: a --orange band about 30 px tall at the very bottom, with a
   torn top edge.
10. Global grain over everything (noise, opacity ≈ 0.08, multiply) to tie
    the layers together.

## Performer photo
- Centre x ≈ 560, top of hat at y ≈ 475, width ≈ 620 px. The footer band
  crops it at about y ≈ 1170.
- Treatment: grayscale(1) contrast(1.4) brightness(1.05), then a fine
  halftone/grain overlay (SVG dot pattern or noise, multiply) so it reads
  like a photocopy.
- Draw a thin 3–4 px --paper cut-out outline around the silhouette (SVG
  feMorphology dilate, or four stacked 0-blur drop-shadows).
- The photo sits in front of the sun and hills, and behind the date ribbon
  and orange box.

## Copy: use EXACTLY this text (caps, punctuation, digits)
1. Top line, centred, top y ≈ 115, Bebas Neue 34 px:
   "MARKET SQUARE" in --maroon + " PRESENTS" in --orange.
2. "SIGMA'S": --red, Anton ≈ 120 px, centred, top y ≈ 185. Add a short
   slanted --red brush accent above the "M".
3. "HANGOUT": --maroon, Anton ≈ 175 px, top y ≈ 290, shifted ~30 px left
   of centre. Immediately right of the "T", place "2.0" (--maroon, Anton
   ≈ 44 px) vertically mid-height, with a thick --maroon bar (≈ 80 × 18 px)
   under it sitting on HANGOUT's baseline.
4. "A BEACH + APARTMENT PARTY EXPERIENCE": --maroon, Bebas Neue 34 px,
   letter-spacing 0.02em, centred, y ≈ 460.
5. Date ribbon: a --maroon torn-paper ribbon ≈ 540 × 66 px, centre x ≈ 515,
   top y ≈ 910, rotated -1°. Inside, Bebas Neue 46 px:
   "19 JULY 2025" (--cream-text)  • (small --red dot)  "1PM TILL DAWN" (--orange)
6. Orange info box: a --orange torn-paper rectangle ≈ 530 × 115 px, centre
   x ≈ 535, top y ≈ 1005, rotated +0.5°. It has two columns split by a thick
   slanted --maroon "/" stroke. Bebas Neue 38 px, line-height 1, centred:
     left:  "JUST" (--maroon) above "BRYMO FANS" (--red)
     right: "JUST" (--maroon) above "BRYMO SONGS" (--red)
7. Left side, on the maroon hill (block left x ≈ 60, top y ≈ 1015), Bebas
   Neue 32 px, centre-aligned, --cream-text:
   "STRICTLY BY" / "INVITATION" followed by a superscript --red "*".
8. Right side, on the maroon hill (block right edge x ≈ 1020, top y ≈ 1010),
   Bebas Neue 28 px, centre-aligned, --cream-text:
   "MAXIMUM" / "SECURITY" / "GUARANTEED".
9. Footer row on the paper band (y ≈ 1200–1265), left to right:
   - x ≈ 150: map-pin icon (inline SVG, --maroon) + "LEKKI," (--maroon)
     over "LAGOS STATE" (--red), Bebas Neue 40 px.
   - x ≈ 360: a slanted --red "/" divider.
   - x ≈ 385: "FOR ENQUIRIES" / "CONTACT:" (--maroon, Oswald 600, 22 px),
     then a dashed arrow "- - - - ▷" (inline SVG, --maroon, ≈ 80 px wide).
   - x ≈ 640, left-aligned (--maroon, Oswald 600, 20 px):
       "FIZZY- 09092833535 (WHATSAPP),"
       "DOLAPO- 08120187648, NASDOT- 08106130680"
10. Centred at y ≈ 1295: Instagram outline glyph (inline SVG) +
    "@market_square_sigmas_" (--maroon, Oswald 500, 18 px).

## Process
1. Scaffold the files and load the fonts.
2. Build the layers in order. Draw every shape as an inline SVG path, and
   generate the torn edges, mountain ridges and rays procedurally with a
   SEEDED random function so every render is identical.
3. Run the render script, then OPEN the exported PNG and critique it against
   this brief (and reference.jpg if present): alignment, overlaps, hierarchy,
   colour fidelity, texture strength. Fix and re-render, at least two
   rounds, before reporting back.
4. Report the output paths, a one-line summary of each iteration, and
   anything you could not match.

## Acceptance checklist
- Every line of copy is present and spelled exactly as above; check the
  phone numbers digit by digit.
- No text overlaps another piece of text, a ray, or the performer's face.
  Keep at least 40 px of safe margin on all sides for text.
- Reading order: headline first, date ribbon second, performer third,
  then the info box and footer.
- Only the palette colours above are used (plus the grayscale photo).
- The PNGs are exactly 1080 × 1350 and 2160 × 2700.
```
