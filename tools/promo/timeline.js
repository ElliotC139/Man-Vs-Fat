// The promo's running order. Loaded by promo.html as a script, and by
// audio/score.py through node (`require`), so picture and sound are always
// cut from the same schedule.
//
// The phone section is a run of beats, and every beat goes the same way, so
// there is only ever one thing moving at a time:
//
//   1. the caption comes in over a still screen
//   2. a moment to read it (and, if the beat pushes in, the push happens here)
//   3. the footage plays — the caption sits still
//   4. the result holds, then the caption leaves
//
// `from`/`to` are frames of the recorded clip (60 per second, see
// capture/clips/markers.json). `hold` adds extra seconds at step 4. `push`
// is [frame, frame]: the camera is fully in on the ring by the first and
// starts easing out at the second.
(function () {
  const FPS = 60;
  const CAP_IN = 0.9; // title words, then the sub-line
  const READ = 0.6;
  const SETTLE = 0.8;
  const CAP_OUT = 0.45;
  const GRID = 0.25; // beats start on the music's sixteenth-note grid

  const BEATS = [
    { clip: 'today', from: 7, to: 160, push: [8, 150],
      title: ['Know where', 'you stand.'], sub: 'The ring fills as the day does.' },
    { clip: 'log', from: 0, to: 236,
      title: ['Just type', 'what you ate.'], sub: 'Or say it. Or snap a photo.' },
    { clip: 'log', from: 236, to: 329, hold: 0.8,
      title: ['It does', 'the maths.'], sub: 'Itemised, so you can fix any line.' },
    { clip: 'log', from: 329, to: 588, push: [372, 452],
      title: ['Watch the', 'day add up.'], sub: 'Every item lands in your diary.' },
    { clip: 'diary', from: 0, to: 262,
      title: ['Your whole', 'week.'], sub: 'Every meal, every day, in one place.' },
    { clip: 'stats', from: 0, to: 250,
      title: ['Watch the trend.', 'Not the day.'], sub: 'One heavy Saturday means nothing.' },
    { clip: 'target', from: 127, to: 205, hold: 1.4,
      title: ['It learns what', 'you really burn.'], sub: 'From your weight, not a formula.' },
    { clip: 'target', from: 205, to: 416, push: [300, 404],
      title: ['Then moves', 'your target.'], sub: 'So the plan keeps up with you.' },
  ];

  const snap = (t) => Math.ceil(t / GRID - 1e-9) * GRID;

  const T = {
    fps: FPS,
    bpm: 120,
    capIn: CAP_IN,
    capOut: CAP_OUT,
    drop: 6.0, // the music drops as the phone arrives
    phoneIn: 5.75,
  };

  let t = 7.0;
  T.beats = BEATS.map((b) => {
    const start = t;
    const playAt = start + CAP_IN + READ;
    const playEnd = playAt + (b.to - b.from) / FPS;
    const outAt = playEnd + SETTLE + (b.hold || 0);
    t = snap(outAt + CAP_OUT);
    const at = (frame) => playAt + (frame - b.from) / FPS;
    return { ...b, start, playAt, playEnd, outAt, end: t, pushAt: b.push && [at(b.push[0]), at(b.push[1])] };
  });

  T.phoneOut = t;
  T.tilesIn = snap(t + 0.5);
  T.endIn = snap(T.tilesIn + 5.5);
  T.duration = T.endIn + 5.5;

  // Which beat, and which frame of its clip, the phone shows at time t.
  T.frameAt = (time) => {
    let b = T.beats[0];
    for (const x of T.beats) if (time >= x.start) b = x;
    const f = time < b.playAt ? b.from : Math.min(b.to, b.from + Math.floor((time - b.playAt) * FPS));
    return { clip: b.clip, frame: f };
  };

  // When a frame of a clip is on screen, for the sound effects.
  T.timeOf = (clip, frame) => {
    const b = T.beats.find((x) => x.clip === clip && frame >= x.from && frame < x.to);
    return b ? b.playAt + (frame - b.from) / FPS : null;
  };

  if (typeof module !== 'undefined') module.exports = T;
  else window.TIMELINE = T;
})();
