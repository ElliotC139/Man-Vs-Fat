# Promo video

`out/quickcals-promo.mp4` is a 35-second, 1080×1920, 60fps H.264 video for
Reels, TikTok and YouTube Shorts. It has no soundtrack on purpose: add a
trending sound inside each app when posting, because the platforms push
videos that use their own audio library.

| Time | Beat |
|---|---|
| 0–3s | The mark lands, "QuicKcals" spells itself out |
| 3–6s | "Calorie counting. Without the counting." |
| 6–12s | **Snap it.** Photo of a plate, shutter, AI finds each item, itemised sheet (486 kcal), logged |
| 12–15s | **Scan it.** Barcode locks on, "Verified" product card |
| 15–17s | **Or just say it.** "two poached eggs on sourdough", itemised answer |
| 17–21s | **Every calorie. Every macro.** Day total counts to 1,512 / 2,100, macros fill |
| 21–26s | **Watch the trend.** Weight dots, trend line, goal projection, then the learned burn replacing the formula's guess (2,450 → 2,318) |
| 26–30s | **And everything else.** Offline, keto & fasting, WHOOP, weekly report, saved meals, privacy |
| 30–35s | End card: "The calorie diary that stops being work.", Start free, quickcals.com |

## Editing it

`promo.html` is the whole video. Open it in a browser and it plays on a
loop. Timings are seconds in `seek(t)`, captions are in `CAPS`, and the
phone screens are in `SCREENS`.

## Rendering it

```bash
pip install imageio-ffmpeg     # any ffmpeg with libx264 will do
export FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")
node tools/promo/render.mjs                        # full video, about 8 minutes
node tools/promo/render.mjs --stills 8.9,19.5      # single frames, to check a change
```

This needs Playwright and its Chromium. The fonts are in `fonts/` so a render
never depends on the network.
