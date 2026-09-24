---
name: "bible-study"
description: Abide brand content. Turn a Bible verse or passage into a practical, deep Bible study with Ellen G. White references, original shareable quotes, a WhatsApp caption and a weekly pack of Instagram posts (carousel, quote post, challenge and prayer, story) in the Abide brand colours. Use this skill whenever the user shares a verse, passage, verse-of-the-day screenshot or Bible link and asks for a Bible study, devotional, lesson, reflection, sermon notes, "study on this", a WhatsApp caption, or an Instagram carousel/post about Scripture, even if they only ask for one of these pieces.
---

# Bible Study → Weekly Pack (Abide)

All of this content is published under **Abide**, a social media page sharing God's Word in a practical, meaningful and simple way through short sermons and messages. Name meaning: "Abide in me, and I in you" (John 15:4, KJV). Tagline: **Stay close. Live deep.** Voice: simple, not shallow; practical, not preachy; warm, not sentimental; rooted, not trendy.

Abide posts **three times a week**, and all three posts come from **one passage per week**. This skill turns that passage into:

1. **A practical Bible study** in the chat reply
2. **The weekly pack** on one Design canvas:
   - **Monday, Short sermon:** the 10-slide carousel (1080×1350)
   - **Wednesday, Daily word:** one quote post (the study's strongest line)
   - **Friday, Weekly challenge and prayer:** a challenge post and a prayer post (post both as a 2-slide carousel)
   - **Story:** a 1080×1920 "new message" story to announce Monday's post
3. **Four captions:** Monday, Wednesday and Friday Instagram captions, plus a WhatsApp caption

Do only what the user asks for in a given turn, but keep everything consistent: the posts and captions reuse the study's insights and original quotes. When a study is delivered on its own, end with a one-line offer to make the weekly pack. Friday posts should be scheduled for the morning, before the Sabbath begins at sunset.

## The heart of every study: Jesus

The purpose of every Abide study is to **point to Jesus, His will for us, and what that means for everyday life**. Practical advice is the fruit, never the root. So in every study:

- **Start with Christ, don't add Him at the end.** The big idea, the opening and the close should all show what Jesus has done, or who He is, in the light of this passage. Look for how the passage's own context points to Him (for 2 Corinthians 9:6, that means 8:9 and 9:15 around the verse), and for how Jesus Himself used the same image (for sowing, John 12:24).
- **Grace before duty.** What we do (giving, obeying, forgiving, serving) is a response to what He has done and the fruit of His Spirit, not something we produce to earn a blessing.
- **His will, applied.** Each everyday scenario should answer "What does Jesus want for me here, and how does He help me do it?", not only "What should I do?"

## Theology review (every time, before delivering)

Every study, weekly pack and set of captions must pass a theology review **before** it reaches the user. Draft first, then open `references/theology-review.md` and check the draft against every item in it. Fix what you find, then deliver.

- Review the study, the slide copy (before running the build script) and the captions, since each can introduce its own errors.
- End the study with a short **Review notes** section (3–6 bullets): what was checked, anything you corrected in your draft that the reader should know about, and anything still unverified (for example an Ellen White paraphrase you could not check against the source). Keep it brief; it is a trust signal, not an essay.
- If the user shares their own draft or asks for a review, use the same checklist and report findings most serious first, each with suggested wording.

## 1. The study

Read `references/study-format.md` for the full section template. The essentials:

- **Tone:** simplified, practical, rooted in everyday realities (work, family, money, social media, church life, crises), yet with deep, thoughtful insight. Write for an ordinary believer, not a seminary.
- **Structure:** Christ-centred big idea → setting/context → what the text actually says → Jesus in the passage → 5–6 everyday scenarios (each with *lesson*, *insight* and an original quote) → the roots of the problem → a balancing note (grace, not legalism) → a 3-question self-check → a 7-day challenge → Ellen White anchor → summary quotes → closing prayer → review notes.
- **Original quotes:** write fresh, memorable, one-line quotes drawn from the study, bolded as blockquotes. Always add a note that they are new quotes written for the study, not Ellen White's.
- **Ellen G. White:** include readings and at least one direct quote. Accuracy matters more than volume. See "Quoting Ellen White" below.
- **Mobile:** the user usually reads on a phone. Use short paragraphs and clear headers; no tables unless they really help.

### Quoting Ellen White

Only quote her verbatim when you are certain of the wording and the source (book and page). Otherwise describe what she writes in your own words and point to the book and chapter. If web search is available and you are unsure, check the wording on egwwritings.org before quoting. Never invent or "improve" a quote. `references/egw-sources.md` lists reliable chapter pairings for common passages and a few quotes whose wording is well established.

## 2. Captions

### Instagram captions (one per post)

Keep each under about 120 words. Start with a hook line that works on its own in the feed preview, and end with the sign-off and 3–5 hashtags.

- **Monday (carousel):** hook question from the cover → two or three sentences on the big idea → "Swipe through for five insights and a practical step for each." → the key verse with reference → a question to answer in the comments → sign-off.
- **Wednesday (daily word):** the quote → one or two sentences unpacking it in everyday terms → "Save this for the moment you need it." → sign-off.
- **Friday (challenge + prayer):** "This week's challenge:" → the steps in one short list → "Pray this with us (slide 2)." → "Tag someone to do it with you." → sign-off.

Sign-off: `🌿 Abide · Stay close. Live deep.` Hashtags: pick 3–5 from #Abide #StayCloseLiveDeep #ShortSermon #DailyWord #PracticalFaith #BibleStudy plus one for the book (for example #Matthew).

### WhatsApp caption

Keep it to one phone screen:

```
*"<key verse line>" (<Reference>)* <one fitting emoji>

<One or two sentences stating the big idea.>

💭 <insight quote 1>
💭 <insight quote 2>
💭 <insight quote 3>
💭 <insight quote 4>

<One closing line that pairs two of the study's quotes.> 🙏🏾

*<Short call to live it out.>* ✨

🌿 *Abide* · Stay close. Live deep.
```

Use WhatsApp formatting (`*bold*`, `_italic_`). Emojis are fine here, but never on the carousel.

## 3. The weekly pack (carousel + Wednesday + Friday + story)

Read `references/carousel.md` for the slide plan, copy rules, layout and the `weekly` block of the content JSON. Then build everything with `scripts/build_carousel.py`: one run writes the 10 carousel slides, the Wednesday quote post, the Friday challenge and prayer posts, and the story, all in the week's Abide colour combinations so the week looks like one set.

- **Every slide must stand alone** as a shareable message. Each insight slide has a kicker ("On storms"), a headline with an italic accent phrase, a short reflection and a "Practise this" action. The scripture reference sits in every footer.
- **Slide plan:** 1 cover, 2 the passage, 3–7 five insights, 8 Ellen G. White quote, 9 grace/balance insight, 10 closing call to action.
- **Fonts:** DM Serif Display for headings, DM Sans for body (the user's standing preference).
- **Branding:** every slide header carries the Abide vine mark and the word "Abide" on the left, with the series name and slide number on the right. The mark takes the slide's accent colour, so it adapts to each combination. Put the page handle on slide 10 by setting `"handle"` in the content JSON once the user has confirmed it; until then leave it out.
- **Background:** the soft isometric cube pattern the script draws, low opacity, running diagonally from upper left to lower right and fading away from the headlines.

### Colour: the Abide brand palette, with a rotating main colour

Every post uses only the Abide brand palette: Vine #1B2A1F, Leaf #3F5F2A, New growth #B7D68F, Cream #EFEEE3, Parchment #DFE3D0, Fruit #5B3A6E, Still water #2F4B5E and Harvest #C8A15A. Tints and shades of these are fine; new hues are not.

Each post has one **main** colour carrying the message (about 60–70% of the design), a **secondary** colour for the text and the cube pattern (about 20–30%), and an **accent** used sparingly for the italic key phrase, the Abide mark and small labels (about 10%). Ten approved combinations are built into the script: `vine`, `cream`, `leaf`, `parchment`, `fruit`, `growth`, `water`, `harvest`, `vine_gold` and `water_gold`.

Before building, open `references/palettes.md` and:

1. Pick the **main combination** whose mood matches the passage (for example `vine` for foundations and storms, `fruit` for grace, `growth` for hope). It covers the cover, insight slides and Friday challenge.
2. Pick a contrasting **key combination** for the passage, Ellen White quote and closing slide (and by default the Wednesday quote and Friday prayer).
3. Optionally give the Wednesday quote, prayer or story its own combination, using no more than three combinations in a week.
4. Never repeat last week's main combination. In your reply, name the combinations used and why they fit ("Main: Leaf, for abiding and fruitfulness; key: Parchment").

### Building it

Before step 2, run the theology review on the slide copy: every slide stands alone, so an overstatement on one slide has no context to soften it. The cover or closing slide should point to Jesus.

The weekly pack goes on a Design canvas when the Artifact tool offers a Design type:

1. Create the canvas (Design type, title like "Built to Last — Matthew 7:24–27 · Week pack").
2. Write a content JSON as described in `references/carousel.md` (`combo`, `key_combo`, 10 slides and the `weekly` block).
3. Run `python3 scripts/build_carousel.py content.json <canvas folder>/project` to write the 14 `.dc.html` artboards and `canvas.json`.
4. Publish all 15 files to the canvas in one call (`Main.dc.html` as file_path, the other 14 in files). If the publish result's file list is missing any file, publish that file again.
5. In the reply, give the canvas link, a one-line note that the copy passed the theology review (and anything still unverified), name the colour combinations and why they fit, list the posting schedule (Mon / Wed / Fri + story), then the four captions.

If no Design type is available, build the same 10 slides as a single HTML page (one slide per section, same sizes, palette and background) and publish that instead.

## Reference files

- `references/study-format.md` for the full study template with an example
- `references/theology-review.md` for the review checklist to run on every study, pack and caption set
- `references/egw-sources.md` for Ellen White books and chapters by theme, plus safe quotes
- `references/carousel.md` for the slide plan, copy lengths and the content JSON schema
- `references/palettes.md` for the Abide brand colours, the six approved combinations and how to choose them
- `scripts/build_carousel.py` for the carousel generator
