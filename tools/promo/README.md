# Promo video

`out/quickcals-promo.mp4` is a 45-second, 1080×1920, 60fps H.264 video with
AAC sound, for Reels, TikTok and YouTube Shorts.

Everything on the phone is the real app, filmed running: the Today ring
sweeping round, dinner typed in and itemised, the ring moving on, the week's
food diary loading in, the weight trend, and the target moving to the
learned burn. The soundtrack is original, synthesised by `audio/score.py`, so
there's no music licence to clear.

| Time | Beat |
|---|---|
| 0–3s | The mark lands, "QuicKcals" spells itself out |
| 3–6s | "Calorie counting. Without the counting." |
| 6–10s | Phone arrives on the drop. **Know where you stand.** The ring sweeps up to 1,153 |
| 10–13s | **Just say what you ate.** "salmon, new potatoes and green beans" |
| 13–16s | **It does the maths.** The real "Looks right?" sheet, four items |
| 16–20s | **Watch the day add up.** Ring turns to 1,692; the new rows in the diary |
| 20–24s | **Your whole week.** My week loads in, scroll through the food diary |
| 24–28s | **Watch the trend. Not the day.** Stats: weight cards, the trend line |
| 28–35s | **It learns what you really burn.** "Your target could move" → Use 1,740 → the ring re-targets |
| 35–40s | **And everything else.** Photo, barcode, offline, WHOOP, keto, privacy |
| 40–45s | End card: "The calorie diary that stops being work." · Start free · quickcals.com |

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

`timeline.js` is the running order both 2 and 3 read.

```bash
npm ci && cp .env.example .env    # any non-empty ANTHROPIC_API_KEY will do; the AI is never called
pip install imageio-ffmpeg numpy scipy
export FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")

tools/promo/capture/fresh-app.sh              # app on :3000, demo account seeded
node tools/promo/capture/capture.mjs          # ~2 min
python3 tools/promo/audio/score.py            # seconds
node tools/promo/render.mjs                   # ~12 min
node tools/promo/render.mjs --stills 8.4,16.4 # single frames, to check a change
```

Open `promo.html` in a browser to watch it without rendering (silent).

Needs Playwright's Chromium. Fonts for the title cards are in `fonts/`; the
app's own fonts are fetched once by curl and cached (`capture/fonts.mjs`),
because headless Chromium here can't reach Google Fonts.
