# Promo video

`out/quickcals-promo.mp4` is a 70-second, 1080×1920, 60fps H.264 video with
AAC sound, for Reels, TikTok and YouTube Shorts.

Everything on the phone is the real app, filmed running. The soundtrack is
original, synthesised by `audio/score.py`, so there's no music licence to
clear.

**One thing moves at a time.** The phone section is a run of beats, and each
one goes the same way: the caption comes in over a still screen, holds long
enough to read, and only then does the app do its thing, under a caption that
has stopped moving. The result holds before the next beat. Push-ins on the
ring happen on a still screen, before it turns. `timeline.js` sets all of it.

| Beat | On screen |
|---|---|
| Title | The mark, "QuicKcals", then "Calorie counting. Without the counting." |
| **Know where you stand.** | Today: the ring sweeps up to 1,153 |
| **Just type what you ate.** | "salmon, new potatoes and green beans" → Estimating… → the sheet rises |
| **It does the maths.** | The real "Looks right?" sheet, four items, held (the drums drop out) |
| **Watch the day add up.** | Log it → the ring turns to 1,692 → the new rows in the diary |
| **Your whole week.** | My week loads in; scroll through the food diary |
| **Watch the trend. Not the day.** | Stats: weight cards cascade in, the trend line |
| **It learns what you really burn.** | "Your target could move", held so it can be read |
| **Then moves your target.** | Use 1,740 → the ring re-targets |
| Everything else | Photo, barcode, offline, WHOOP, keto, privacy — a row at a time |
| End | "The calorie diary that stops being work." · Start free · quickcals.com |

## How it's made

1. **Film the app** (`capture/`). `fresh-app.sh` starts the app on a new local
   database and `seed.mjs` fills it with a month of meals and weigh-ins
   through the real API. `capture.mjs` then drives it in headless Chromium at
   iPhone 15 Pro size, on a virtual clock (`clock.js`), so every frame of the
   ring and every CSS animation is captured exactly, at 60fps. The only thing
   stood in for is the AI's answer to the typed dinner, returned in the real
   response shape. Frames go to `capture/clips/` (not committed), and the
   frame of every tap and keystroke to `capture/clips/markers.json`.
2. **Score it**: `audio/score.py` reads `timeline.js` and `markers.json` and
   writes `out/score.wav`, with taps, typing and the ring's shimmer landing
   on their frames.
3. **Compose and render**: `promo.html` puts the footage in a phone with the
   captions, title cards and end card; `render.mjs` steps through it frame by
   frame and muxes in the score.

`timeline.js` is the running order: `promo.html` loads it as a script and
`score.py` runs it through node, so the picture and the sound effects are
cut from the same schedule. To change pacing, change a beat there.

```bash
npm ci && cp .env.example .env    # any non-empty ANTHROPIC_API_KEY will do; the AI is never called
pip install imageio-ffmpeg numpy scipy
export FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")

tools/promo/capture/fresh-app.sh              # app on :3000, demo account seeded
node tools/promo/capture/capture.mjs          # ~2 min
python3 tools/promo/audio/score.py            # seconds
node tools/promo/render.mjs                   # ~15 min
node tools/promo/render.mjs --stills 8.4,16.4 # single frames, to check a change
```

Open `promo.html` in a browser to watch it without rendering (silent).

Needs Playwright's Chromium. Fonts for the title cards are in `fonts/`; the
app's own fonts are fetched once by curl and cached (`capture/fonts.mjs`),
because headless Chromium here can't reach Google Fonts.
