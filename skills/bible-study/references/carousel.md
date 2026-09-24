# Carousel

## Format

- Instagram portrait 4:5, 1080×1350 px, 10 slides.
- Fonts: DM Serif Display (headlines, quotes), DM Sans (everything else).
- Header on every slide: the Abide vine mark and "ABIDE" on the left; "SERIES NAME · 03/10" on the right. Keep series names to about 20 characters so the header fits on one line.
- Footer on every slide: the scripture reference on the left ("reference · handle" on slide 10 when a handle is set); "Swipe →" on the right, or save and share icons on slide 10.
- The main combination for the cover, insights and grace slide; the key combination for the passage (2), Ellen White quote (8) and close (10).
- Background: soft isometric cubes in a diagonal band from upper left to lower right, very low opacity, fading away from the headline area. The script draws it; don't add other textures.
- No emojis, no gradient washes, no stock photos. Icons are thin stroke SVG only.

## Slide plan

| # | type    | content |
|---|---------|---------|
| 1 | cover   | A standalone hook statement: plain part + italic accent part, one supporting line. Optional stroke icon drawn from the passage's image. |
| 2 | passage | The passage text in full (the script scales long passages down) and the reference with version. |
| 3 | insight | Hearing and doing / the core truth. |
| 4 | insight | The hardest everyday reality the passage confronts. |
| 5 | insight | The hidden or inner-life angle. |
| 6 | insight | A practical temptation or shortcut. |
| 7 | insight | Where our security or identity really rests. |
| 8 | quote   | One verified Ellen G. White quote with book and page, plus a one-line reflection. |
| 9 | insight | Grace and balance: guard against legalism. |
| 10 | close  | A memorable call to action and a save/share line. |

Adapt the insight themes to the passage; the study's strongest original quotes become the headlines.

## Copy rules (each slide must stand alone)

- **Kicker:** "On <theme>", 2–4 words.
- **Headline:** 6–14 words, split into a plain part and an italic accent part. The accent is the turn of the sentence ("They reveal them.").
- **Reflection:** 1–2 sentences, about 90–160 characters, explaining the headline in everyday terms.
- **Practise this:** one concrete action someone can do this week, under about 100 characters.
- A person who sees only this slide, forwarded on WhatsApp, should understand it and know what to do.
- Headlines over about 60 characters: set `"size": 86` to keep them to three or four lines.

## Content JSON schema

```json
{
  "title": "Built to Last — Matthew 7:24–27 Carousel",
  "brand": "Abide",
  "handle": "@yourhandle",
  "series": "Built to Last",
  "reference": "Matthew 7:24–27",
  "combo": "vine",
  "key_combo": "cream",
  "cover_icon": ["M50 80L110 30l60 50", "M64 70v50h92V70", "M98 120V94h24v26", "M20 120h180", "M30 136h160", "M44 152h132"],
  "slides": [
    {"type": "cover", "headline": "You don’t choose your storms.", "accent": "You choose your foundation.", "sub": "Rain falls on every house. What decides whether yours stands was settled long before the clouds came."},
    {"type": "passage", "text": "“Therefore everyone who hears these words of mine…”", "ref": "Matthew 7:24–27 NIV"},
    {"type": "insight", "kicker": "On hearing and doing", "headline": "Hearing makes you informed.", "accent": "Doing makes you founded.", "reflection": "The foolish builder wasn’t a scoffer. He was a listener. Knowing the right thing has never been the same as living it.", "practice": "Pick one thing God has already told you to do. Do it this week, before you ask for anything new."},
    {"type": "insight", "kicker": "On storms", "headline": "Storms don’t create cracks.", "accent": "They reveal them.", "reflection": "…", "practice": "…"},
    {"type": "insight", "kicker": "On the hidden life", "headline": "Your hidden life holds up your", "accent": "visible one.", "reflection": "…", "practice": "…"},
    {"type": "insight", "kicker": "On shortcuts", "headline": "What’s easy to build on is often", "accent": "easy to lose.", "reflection": "…", "practice": "…"},
    {"type": "insight", "kicker": "On security", "headline": "If losing it would destroy you,", "accent": "you may be standing on it.", "size": 86, "reflection": "…", "practice": "…"},
    {"type": "quote", "kicker": "On character", "quote": "Character building is the most important work ever entrusted to human beings…", "author": "Ellen G. White", "book": "Education", "page": "p. 225", "reflection": "We are all builders. Every choice is a brick. The only question is what it rests on."},
    {"type": "insight", "kicker": "On grace", "headline": "Grace provides the rock.", "accent": "Obedience builds on it.", "reflection": "…", "practice": "…"},
    {"type": "close", "headline": "Dig deep while the", "accent": "sky is clear.", "sub": "Save this for the next storm. Share it with someone who is building something that matters."}
  ]
}
```

### The `weekly` block (Wednesday, Friday and story)

Add this to the same content JSON to build the rest of the week:

```json
"weekly": {
  "quote": {"headline": "Your hidden life holds up your", "accent": "visible one."},
  "challenge": {
    "headline": "Dig deep while", "accent": "the sky is clear.",
    "items": [
      {"day": "Mon", "text": "Write down one teaching of Jesus you know but don’t practise."},
      {"day": "Tue–Wed", "text": "Act on it once, on purpose."},
      {"day": "Thu", "text": "Fifteen minutes in Scripture and prayer before your phone."},
      {"day": "Fri", "text": "Settle one thing you’ve been putting off."},
      {"day": "Sun", "text": "Ask someone you trust where they see cracks."}
    ]
  },
  "prayer": {"text": "Lord, I don’t want to be only a hearer. Help me dig deep while the sky is clear…"},
  "story": {"kicker": "Short sermon", "headline": "Built to", "accent": "Last", "sub": "What is your life built on? A 10-slide study on Matthew 7:24–27."}
}
```

- **quote:** the study's single strongest original line, split into plain and accent parts. Light slide. Optional `"size"` (default 124) and `"ref"`.
- **challenge:** condense the 7-day challenge to 4–6 rows; group days where natural ("Tue–Wed"), keep each row under about 70 characters. Dark slide.
- **prayer:** the closing prayer, 40–60 words, without the final "Amen" (the slide adds it). Light slide. Optional `"size"` (default 60; use 52 for longer prayers).
- **story:** the series title split into plain and accent parts, with a one-line teaser. Dark, 1080×1920.

The weekly posts sit on a third row of the canvas, below the carousel.

`brand` defaults to "Abide". Leave `handle` out until the user confirms their handle.

`combo` is the main brand combination (cover, insights, Friday challenge); `key_combo` is the contrasting one (passage, Ellen White quote, closing slide, and by default the Wednesday quote and prayer). Both take one of: vine, cream, leaf, parchment, fruit, growth, water, harvest, vine_gold, water_gold. See `references/palettes.md`.

Optional per slide: `"size"` (headline px), `"theme"` ("dark" = main combo, "light" = key combo), `"combo"` (use a specific combination for just this slide), `"label"` (artboard name). The weekly quote, challenge, prayer and story also accept `"combo"`.

`cover_icon` is a list of SVG path strings in a 220×170 viewBox, drawn as 3 px strokes in the accent colour. Draw something simple from the passage's imagery (a house on rock, a vine leaf, a lamp, a wave, a crown, a sheaf of wheat), or omit it.

## Build and publish

```bash
python3 scripts/build_carousel.py content.json /mnt/user-data/outputs/artifacts/<canvas-id>/project
```

Then publish `Main.dc.html` as file_path and the other nine artboards plus `canvas.json` in files, with the canvas url. If the publish reply lists fewer than 11 files, publish the missing one again.

To revise a single slide later, read the canvas back first (the user may have edited it), change that slide's entry in the JSON or edit the artboard file directly, and republish only the changed files.
