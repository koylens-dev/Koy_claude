# Audio → SATB Score: Capability Assessment & Open-Source Pipeline

*Prepared 2026-06-14*

## 1. Direct capability assessment (honest answer first)

**I cannot natively transcribe an audio file into a professional-quality SATB
score.** As a language model I do not ingest or analyze raw audio waveforms, I
cannot perform the signal-processing (multi-pitch estimation, onset detection,
beat tracking, source separation) that transcription requires, and I cannot
render engraved notation. Even the best dedicated AI models today do **not**
produce publication-ready four-part choral notation end-to-end; every credible
result still requires a human editor.

What I *can* do is design and drive a reproducible pipeline from
free/open-source components, generate the glue scripts, and tell you precisely
where manual review remains unavoidable. That is what this document delivers.

### Why SATB is one of the hardest cases in music transcription

- **Dense, overlapping polyphony in a narrow pitch range.** S/A/T/B frequently
  cross and share pitches; generic polyphonic models collapse unisons and
  octaves and mis-assign voices.
- **Voice assignment is a separate, unsolved-ish problem.** Detecting *which*
  pitches are sounding (multi-f0) is different from deciding *which voice* each
  belongs to. State-of-the-art research treats these as two stages.
- **Homophonic vs. polyphonic textures, divisi, and humming/“oo” passages**
  break rhythm quantizers and lyric aligners.
- **Lyrics** must be transcribed *and* aligned per voice — a second ML problem
  layered on top.

Realistic expectation: a good pipeline on a clean recording gets you to roughly
**70–90% correct notes/rhythms** and a usable lyric draft; the last mile to
publication quality is manual work in a notation editor.

---

## 2. Recommended end-to-end pipeline (overview)

```
                         ┌─────────────────────────────────────────────┐
  audio (mp3/wav/m4a)    │  STAGE 0  Pre-process                        │
        │                │  ffmpeg → mono/stereo WAV 44.1k, normalize   │
        ▼                └─────────────────────────────────────────────┘
                         ┌─────────────────────────────────────────────┐
                         │  STAGE 1  Source separation (Demucs)         │
                         │  isolate the vocal stem from accompaniment   │
                         └─────────────────────────────────────────────┘
                         ┌─────────────────────────────────────────────┐
                         │  STAGE 2  Multi-pitch / voice transcription  │
                         │  (a) SATB-specialized multi-f0 + voice asgmt │
                         │  (b) general AMT fallback (Basic Pitch/MT3)  │
                         │  → 4 MIDI tracks (S, A, T, B)                 │
                         └─────────────────────────────────────────────┘
                         ┌─────────────────────────────────────────────┐
                         │  STAGE 3  Lyrics: transcribe + align         │
                         │  WhisperX (words+timestamps) → MFA (phoneme) │
                         └─────────────────────────────────────────────┘
                         ┌─────────────────────────────────────────────┐
                         │  STAGE 4  Symbolic clean-up                  │
                         │  music21: tempo/key/meter, quantize, attach  │
                         │  lyrics → MusicXML                           │
                         └─────────────────────────────────────────────┘
                         ┌─────────────────────────────────────────────┐
                         │  STAGE 5  Engraving + MANUAL REVIEW          │
                         │  MuseScore 4 (GUI) and/or LilyPond → PDF     │
                         └─────────────────────────────────────────────┘
```

---

## 3. Stage-by-stage tool recommendations

### Stage 0 — Pre-processing
- **FFmpeg** — decode any container (mp3/m4a/wav) to 44.1 kHz WAV, normalize,
  trim. https://ffmpeg.org/
- Optional: **pyloudnorm** for LUFS normalization.

### Stage 1 — Source separation (isolate the choir/vocals)
| Tool | Repo | Notes |
|---|---|---|
| **Demucs (htdemucs / htdemucs_ft)** | https://github.com/facebookresearch/demucs | Best-in-class open separation. `--two-stems=vocals` gives vocals vs. accompaniment (karaoke split). `htdemucs_ft` = best quality (slower, GPU). |

> Demucs separates *vocals from instruments*, **not** soprano from bass. For
> a‑cappella SATB it isn’t needed; for choir-with-piano/orchestra it cleans the
> input before pitch estimation. True per-voice splitting is research-grade
> (see Stage 2 SATB tools).

### Stage 2 — Transcription (the core, audio → notes)

**Path A — SATB / vocal-ensemble–specialized (preferred for choir):**

| Tool | Repo | Role | Maturity |
|---|---|---|---|
| **multif0-estimation-polyvocals** (Cuesta, ISMIR 2020) | https://github.com/helenacuesta/multif0-estimation-polyvocals | CNN multiple-F0 estimation purpose-built for vocal ensembles; the closest thing to an "SATB transcriber." | Research code, actively cited; CSD/ Choral Singing Dataset trained. |
| **choir_separation_f0_analysis** (Chandna/Cuesta/Gómez) | https://github.com/pc2752/choir_separation_f0_analysis | Multi-pitch extraction + **source separation for SATB choirs** (DeepSalience-based). | Research code. |
| **icassp2022-vocal-transcription** (keums) | https://github.com/keums/icassp2022-vocal-transcription | Frame→note singing transcription from polyphonic music (teacher–student). Good for the dominant/melody line. | Research code. |

> These give you **multi-f0 contours** and (for Cuesta's framework) a voice-
> assignment step. You convert the per-voice f0/notes into four MIDI tracks.
> This is where the real SATB accuracy comes from — and where most manual
> correction concentrates (octave errors, crossing voices, unison collapse).

**Path B — General-purpose AMT (robust fallback / accompaniment / piano reduction):**

| Tool | Repo | Strength | Weakness for SATB |
|---|---|---|---|
| **Spotify Basic Pitch** | https://github.com/spotify/basic-pitch | Tiny, fast, CPU-only, polyphonic, instrument-agnostic, pitch-bend aware; direct MIDI export. Great first pass / baseline. | Single stream — no voice separation; will merge SATB into one polyphonic track. |
| **Magenta MT3** | https://github.com/magenta/mt3 | Multi-instrument transformer; strong multi-track results. | Heavy (T5X/JAX), tuned to instruments not choir; setup complexity high. |
| **Omnizart** | https://github.com/Music-and-Culture-Technology-Lab/omnizart | One library for vocal melody, chords, drums, beats — handy for key/chord/beat context. | Vocal module is melody-line, not 4-part. |
| **ByteDance piano_transcription** | https://github.com/bytedance/piano_transcription | SOTA if there's a piano accompaniment to notate. | Piano only. |

**Recommendation:** Run **Demucs → Cuesta multi-f0 (Path A)** as the primary
choir transcriber, and use **Basic Pitch** in parallel as a sanity-check
baseline and to capture any instrumental accompaniment. Use Omnizart purely to
estimate **key, tempo, beat, and chords** to seed Stage 4.

### Stage 3 — Lyrics (transcription + per-voice alignment)
| Tool | Repo | Role |
|---|---|---|
| **WhisperX** | https://github.com/m-bain/whisperX | ASR with **word-level timestamps** + diarization; transcribe sung text from the isolated vocal stem. |
| **Montreal Forced Aligner (MFA)** | https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner | Phoneme-level forced alignment → snap syllables to note onsets per voice. |

> Tip from current research: separating the vocal stem *first* (Stage 1) then
> running Whisper materially improves lyric accuracy. Expect to hand-correct
> wording; sung diction is much harder than speech.

### Stage 4 — Symbolic processing / assembly
| Tool | Repo | Role |
|---|---|---|
| **music21** (MIT) | https://github.com/cuthbertLab/music21 | The programmatic glue: import the per-voice MIDI, set key/time signatures and tempo, **quantize** rhythms, merge S/A/T/B into a 4-part `Score`, attach lyric syllables, export **MusicXML**. |
| **pretty_midi** | https://github.com/craffel/pretty-midi | Convenient MIDI manipulation/merging before handing to music21. |

### Stage 5 — Engraving (publication-quality output) + review
| Tool | Repo / site | Role |
|---|---|---|
| **MuseScore 4** | https://github.com/musescore/MuseScore | Import MusicXML, **this is where you do manual review/correction** in a GUI, then export print-ready PDF. Best beautiful-default engraving with least effort. |
| **LilyPond** | https://github.com/lilypond/lilypond | Highest-quality automated engraving for the *final* pass; `musicxml2ly` converts MusicXML → `.ly`. |
| **Frescobaldi** | https://github.com/frescobaldi/frescobaldi | LilyPond IDE if you go the LilyPond route. |

**Recommendation:** Do correction in **MuseScore 4** (fastest path to clean,
readable choral layout). If you need the most refined published look,
round-trip the finished MusicXML through **LilyPond** via `musicxml2ly`.

---

## 4. Where manual review is unavoidable

Plan for human editing at these points — this is the realistic 10–30% the tools
won't nail:

1. **Voice assignment / crossing voices** — automatic S/A/T/B labeling is the
   weakest link; expect to re-assign notes, especially where parts cross or
   sing in unison/octaves.
2. **Octave errors** in low bass / high soprano from f0 estimators.
3. **Rhythm quantization** — triplets, syncopation, fermatas, rubato, and
   pickup measures routinely need manual correction.
4. **Key & time signature confirmation**, enharmonic spelling (the tools guess;
   choral keys/accidentals need a human).
5. **Lyric verification and syllable placement** (melismas, repeated text,
   verse vs. refrain).
6. **Dynamics, articulation, breath marks, tempo text** — only *some* dynamics
   are discernible from audio (loudness), and notation-level markings almost
   always need manual entry.
7. **Engraving polish** — system breaks, spacing, divisi, multi-voice stems.

---

## 5. Realistic accuracy & complexity summary

| Component | Tooling | Expected accuracy (clean recording) | Setup complexity |
|---|---|---|---|
| Source separation | Demucs htdemucs_ft | High (vocals vs. backing) | Low–Med (GPU preferred) |
| SATB multi-f0 / voice assign | Cuesta multif0 / choir_separation | Moderate; the bottleneck | High (research code, deps) |
| General AMT baseline | Basic Pitch | Good for single stream | Very low |
| Lyrics ASR + align | WhisperX + MFA | Draft-quality, needs edits | Medium |
| Symbolic assembly | music21 | Deterministic (logic, not ML) | Low (Python) |
| Engraving | MuseScore 4 / LilyPond | Publication-quality (with manual review) | Low / Medium |

**Bottom line:** No free (or paid) tool gives you a finished, publication-ready
SATB score automatically. The pipeline above gets you ~70–90% of the way on a
clean recording — strongest when the source is **a-cappella or lightly
accompanied** and the parts are clearly separated — and MuseScore 4 is where a
musician finishes the job. Budget the majority of your time for Stage 5 review,
not for running the models.

---

## 6. Suggested minimal first build (fastest useful result)

1. `ffmpeg` → WAV.
2. `demucs --two-stems=vocals` (skip if a-cappella).
3. **Basic Pitch** on the vocal stem → one MIDI (baseline you can hear/inspect).
4. **WhisperX** on the vocal stem → lyrics + timestamps.
5. `music21` script → set key/meter/tempo, quantize, split/clean, attach lyrics,
   export MusicXML.
6. Open in **MuseScore 4**, manually split into S/A/T/B staves, correct, export PDF.

Then upgrade Stage 2 to the **Cuesta SATB multi-f0** models once the plumbing
works, since that is what actually buys you four-part accuracy.

---

## Sources
- [music-transcription · GitHub Topics](https://github.com/topics/music-transcription?l=python&o=desc&s=updated)
- [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) · [announcement](https://engineering.atspotify.com/2022/06/meet-basic-pitch)
- [Magenta MT3](https://github.com/magenta/mt3) · [paper](https://arxiv.org/abs/2111.03017)
- [Omnizart](https://github.com/Music-and-Culture-Technology-Lab/omnizart) · [docs](https://music-and-culture-technology-lab.github.io/omnizart-doc/)
- [ByteDance piano_transcription](https://sourceforge.net/projects/piano-transcription.mirror/)
- [facebookresearch/demucs](https://github.com/facebookresearch/demucs)
- [helenacuesta/multif0-estimation-polyvocals](https://github.com/helenacuesta/multif0-estimation-polyvocals)
- [pc2752/choir_separation_f0_analysis](https://github.com/pc2752/choir_separation_f0_analysis/blob/master/README.md)
- [keums/icassp2022-vocal-transcription](https://github.com/keums/icassp2022-vocal-transcription)
- [A Framework for Multi-f0 Modeling in SATB Choir Recordings (Cuesta et al.)](https://arxiv.org/pdf/1904.05086)
- [m-bain/whisperX](https://github.com/m-bain/whisperX)
- [Exploiting Music Source Separation for Automatic Lyrics Transcription with Whisper](https://arxiv.org/pdf/2506.15514)
- [STARS: Unified Singing Transcription, Alignment, and Style Annotation (ACL 2025)](https://arxiv.org/pdf/2507.06670)
- [music21 (cuthbertLab)](https://github.com/cuthbertLab/music21)
- [MuseScore](https://github.com/musescore/MuseScore) · [LilyPond](https://github.com/lilypond/lilypond) · [Frescobaldi](https://github.com/frescobaldi/frescobaldi)
- [LilyPond ↔ MuseScore via MusicXML](https://francopasut.netlify.app/post/lilypond_musescore_musicxml/)
