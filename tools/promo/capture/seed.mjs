// Fills a running local QuicKcals with the demo account the promo is filmed
// on: four weeks of weigh-ins drifting down, a month of ordinary days, and
// today's breakfast, lunch and snack already logged.
//
//   node tools/promo/capture/seed.mjs [http://localhost:3000]
//
// Everything goes through the real API, so the screens it produces are the
// screens a real account would see. The one thing the API can't do is put the
// account on a paid plan (that's Stripe's job), so pass --pro-sql to print the
// SQL that does, for a throwaway local database only.

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3000';
const USER = { username: 'elliot', password: 'promo-demo-password' };

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const signup = await api('POST', '/api/auth/signup', USER);
if (!signup?.id) await api('POST', '/api/auth/login', USER);

await api('PATCH', '/api/auth/me', {
  weightKg: 82.3,
  heightCm: 180,
  ageYears: 34,
  sex: 'male',
  activityLevel: 'light',
  goalWeightKg: 80,
  weeklyGoalKg: 0.5,
  dailyCalorieTarget: 2100,
  proteinTargetG: 150,
  carbsTargetG: 200,
  fatTargetG: 70,
  // The app's own "arrange this screen" setting: the ring, the log box and the
  // diary, in that order, so one phone screen holds the whole loop.
  layout: {
    today: {
      order: ['today:hero', 'today:log', 'today:entries'],
      hidden: ['today:what-now', 'today:insights', 'today:water', 'today:note', 'today:body', 'today:exercise'],
    },
    'stats-weight': { order: ['stats-weight:summary', 'stats-weight:breakdown'], hidden: ['stats-weight:log'] },
  },
});

// Weigh-ins: a real-looking scale — a steady fall with water noise on top.
const r = rng(11);
for (let d = 27; d >= 0; d--) {
  const trend = 84.6 - (2.3 * (27 - d)) / 27;
  const noise = (r() - 0.5) * 1.2 + (daysAgo(d).getDay() === 0 ? 0.6 : 0);
  await api('POST', '/api/weigh-ins', { date: dayKey(daysAgo(d)), weightKg: Math.round((trend + noise) * 10) / 10 });
}

const item = (label, kcal, p, c, f, quantity, unitLabel) => ({ label, kcal, proteinG: p, carbsG: c, fatG: f, quantity, unitLabel });
const MEALS = {
  breakfast: [
    [item('Porridge, banana, honey', 410, 12, 72, 8)],
    [item('Flat white', 125, 7, 10, 6)],
    [item('Poached eggs', 143, 13, 1, 10, 2, 'egg'), item('Sourdough toast', 180, 6, 34, 1)],
  ],
  lunch: [
    [item('Chicken salad', 486, 52, 12, 26)],
    [item('Tuna sandwich', 420, 28, 44, 14)],
    [item('Leftover chilli, rice', 610, 34, 70, 18)],
  ],
  dinner: [
    [item('Spaghetti bolognese', 690, 36, 82, 22)],
    [item('Chicken stir fry', 560, 44, 52, 16)],
    [item('Fish, chips, peas', 890, 38, 96, 38)],
  ],
  snack: [[item('Greek yoghurt 2%', 132, 17, 6, 4, 170, 'g')], [item('Apple', 80, 0, 21, 0)], [item('Protein bar', 210, 20, 22, 7)]],
};

// A month of ordinary days behind today.
for (let d = 27; d >= 1; d--) {
  const date = dayKey(daysAgo(d));
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const pick = MEALS[meal][Math.floor(r() * MEALS[meal].length)];
    await api('POST', '/api/entries/confirm', { items: pick, source: 'manual', date, mealType: meal });
  }
}

// Today so far. Dinner is what the promo logs on camera.
const today = dayKey(new Date());
const todays = [
  ['breakfast', [item('Porridge, banana, honey', 410, 12, 72, 8)], 'meal'],
  ['breakfast', [item('Flat white', 125, 7, 10, 6)], 'meal'],
  ['lunch', [item('Chicken salad', 486, 52, 12, 26)], 'ai'],
  ['snack', [item('Greek yoghurt 2%', 132, 17, 6, 4, 170, 'g')], 'database'],
];
for (const [mealType, items, source] of todays) {
  await api('POST', '/api/entries/confirm', { items, source, date: today, mealType });
}

const me = await api('GET', '/api/auth/me');
console.log(`Seeded ${USER.username} (id ${me.id}) at ${BASE}`);
if (process.argv.includes('--pro-sql')) {
  console.log(`UPDATE User SET plan = 'pro', subscriptionStatus = 'active' WHERE id = ${me.id};`);
}
