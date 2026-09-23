// The promo's running order, in seconds. Read by promo.html (as a script) and
// by audio/score.py (which strips the assignment and parses the JSON), so the
// picture and the soundtrack can't drift apart. Keep it pure JSON after the =.
//
// The music is 120bpm, so a beat is 0.5s and a bar is 2s; scene changes sit
// on the beat. Clip start times come from the clip lengths in
// capture/clips/markers.json — re-capture and they may need nudging.
window.TIMELINE = {
  "duration": 45,
  "bpm": 120,
  "drop": 6.0,
  "phoneIn": 6.0,
  "phoneOut": 35.25,
  "tilesIn": 35.75,
  "endIn": 40.0,
  "pushIns": [[7.1, 9.3], [15.6, 17.0], [32.85, 34.5]],
  "clips": [
    { "name": "today", "start": 7.0, "frames": 180 },
    { "name": "log", "start": 10.0, "frames": 588 },
    { "name": "diary", "start": 19.8, "frames": 262 },
    { "name": "stats", "start": 24.167, "frames": 250 },
    { "name": "target", "start": 28.333, "frames": 416 }
  ],
  "captions": [
    { "at": 7.0, "until": 9.75, "title": ["Know where", "you stand."], "sub": "The ring fills as the day does." },
    { "at": 10.0, "until": 13.25, "title": ["Just say", "what you ate."], "sub": "Or snap it. Or scan it. Whatever's fastest." },
    { "at": 13.5, "until": 16.0, "title": ["It does", "the maths."], "sub": "Itemised, so you fix one thing — not all of it." },
    { "at": 16.25, "until": 19.5, "title": ["Watch the", "day add up."], "sub": "Every item lands in your diary." },
    { "at": 19.85, "until": 23.9, "title": ["Your whole", "week."], "sub": "Every meal, every day, in one place." },
    { "at": 24.25, "until": 28.0, "title": ["Watch the trend.", "Not the day."], "sub": "One heavy Saturday means nothing." },
    { "at": 28.5, "until": 34.9, "title": ["It learns what", "you really burn."], "sub": "Then moves your target to match." }
  ]
};
