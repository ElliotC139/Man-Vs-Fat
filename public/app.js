function icon(paths, extraClass = "") {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24">${paths}</svg>`;
}
const ICONS = {
  plus: icon('<path d="M5 12h14M12 5v14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  x: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  flame: icon(
    '<path d="M8.5 14.5a2.5 2.5 0 0 0 5 0c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 1 2.5Z"/>',
  ),
  watch: icon(
    '<rect x="9" y="1" width="6" height="4" rx="1"/><rect x="9" y="19" width="6" height="4" rx="1"/><circle cx="12" cy="12" r="7"/><path d="M12 9v3l2 2"/>',
  ),
  activity: icon('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  starOutline: icon(
    '<path d="M12 3.5 14.9 9.4l6.5.95-4.7 4.6 1.1 6.45L12 18.3 6.2 21.4l1.1-6.45-4.7-4.6 6.5-.95Z"/>',
  ),
  starFilled: icon(
    '<path d="M12 3.5 14.9 9.4l6.5.95-4.7 4.6 1.1 6.45L12 18.3 6.2 21.4l1.1-6.45-4.7-4.6 6.5-.95Z" fill="currentColor"/>',
  ),
  check: icon('<polyline points="20 6 9 17 4 12"/>'),
  pencil: icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  droplet: icon('<path d="M12 2.7 6.9 8.1a7.2 7.2 0 1 0 10.2 0Z"/>'),
  note: icon('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>'),
};

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const todayScreen = document.getElementById("today-screen");
const tabBar = document.getElementById("tab-bar");
const authForm = document.getElementById("auth-form");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const googleSigninBtn = document.getElementById("google-signin-btn");
const authDivider = document.getElementById("auth-divider");

const settingsScreen = document.getElementById("settings-screen");
const settingsBack = document.getElementById("settings-back");
const settingsUsername = document.getElementById("settings-username");
const settingsWeekday = document.getElementById("settings-weekday");
const settingsTime = document.getElementById("settings-time");
const weekStyleWhole = document.getElementById("week-style-whole");
const weekStyleTime = document.getElementById("week-style-time");
const weekTimeRow = document.getElementById("week-time-row");
const weekStyleNote = document.getElementById("week-style-note");
const settingsWeight = document.getElementById("settings-weight");
const settingsHeight = document.getElementById("settings-height");
const settingsHeightFt = document.getElementById("settings-height-ft");
const settingsHeightIn = document.getElementById("settings-height-in");
const heightCmWrap = document.getElementById("height-cm-wrap");
const heightFtWrap = document.getElementById("height-ft-wrap");
const weightLabel = document.getElementById("weight-label");
const goalLabel = document.getElementById("goal-label");
const settingsAge = document.getElementById("settings-age");
const settingsActivity = document.getElementById("settings-activity");
const settingsGoal = document.getElementById("settings-goal");
const settingsGoalWeight = document.getElementById("settings-goal-weight");
const goalWeightLabel = document.getElementById("goal-weight-label");
const unitsMetricBtn = document.getElementById("units-metric");
const unitsImperialBtn = document.getElementById("units-imperial");
const settingsSave = document.getElementById("settings-save");
const settingsError = document.getElementById("settings-error");
const logoutBtn = document.getElementById("logout-btn");

const whoopStatusText = document.getElementById("whoop-status-text");
const whoopConnectBtn = document.getElementById("whoop-connect-btn");
const whoopSyncBtn = document.getElementById("whoop-sync-btn");
const whoopDisconnectBtn = document.getElementById("whoop-disconnect-btn");
const whoopUnconfiguredNote = document.getElementById("whoop-unconfigured-note");

const budgetWidget = document.getElementById("budget-widget");
const budgetSourceLabel = document.getElementById("budget-source-label");
const balanceInTotal = document.getElementById("balance-in-total");
const balanceOutTotal = document.getElementById("balance-out-total");
const balanceOutCaption = document.getElementById("balance-out-caption");
const balanceDiffCell = document.getElementById("balance-diff-cell");
const balanceDiff = document.getElementById("balance-diff");
const balanceDiffCaption = document.getElementById("balance-diff-caption");
const balanceKgCell = document.getElementById("balance-kg-cell");
const balanceKg = document.getElementById("balance-kg");
const balanceKgCaption = document.getElementById("balance-kg-caption");

const foodLibraryScreen = document.getElementById("food-library-screen");
const foodLibraryBack = document.getElementById("food-library-back");
const foodSearchInput = document.getElementById("food-search");
const foodFavoritesSection = document.getElementById("food-favorites-section");
const foodFavoritesList = document.getElementById("food-favorites-list");
const foodAllList = document.getElementById("food-all-list");
const foodLibraryError = document.getElementById("food-library-error");

const statsScreen = document.getElementById("stats-screen");
const statsBack = document.getElementById("stats-back");
const weighinSummary = document.getElementById("weighin-summary");
const weighinCurrent = document.getElementById("weighin-current");
const weighinStart = document.getElementById("weighin-start");
const weighinChangeCell = document.getElementById("weighin-change-cell");
const weighinChange = document.getElementById("weighin-change");
const weighinChangeCaption = document.getElementById("weighin-change-caption");
const weighinBmiCell = document.getElementById("weighin-bmi-cell");
const weighinBmi = document.getElementById("weighin-bmi");
const weighinPaceCell = document.getElementById("weighin-pace-cell");
const weighinPace = document.getElementById("weighin-pace");
const weighinPaceCaption = document.getElementById("weighin-pace-caption");
const weighinChartCard = document.getElementById("weighin-chart-card");
const weighinChart = document.getElementById("weighin-chart");
const weighinTrendCaption = document.getElementById("weighin-trend-caption");
const weighinForm = document.getElementById("weighin-form");
const weighinDate = document.getElementById("weighin-date");
const weighinWeight = document.getElementById("weighin-weight");
const weighinWeightLabel = document.getElementById("weighin-weight-label");
const weighinSave = document.getElementById("weighin-save");
const weighinError = document.getElementById("weighin-error");
const weighinList = document.getElementById("weighin-list");

const whoopStatsCard = document.getElementById("whoop-stats-card");
const whoopStatsPrompt = document.getElementById("whoop-stats-prompt");
const statRecoveryHero = document.getElementById("stat-recovery-hero");
const statRecovery = document.getElementById("stat-recovery");
const statSleep = document.getElementById("stat-sleep");
const whoopStatsAvg = document.getElementById("whoop-stats-avg");
const statAvgKcal = document.getElementById("stat-avg-kcal");
const statAvgKcal28 = document.getElementById("stat-avg-kcal-28");
const statAvgBurn = document.getElementById("stat-avg-burn");
const statAvgNet = document.getElementById("stat-avg-net");
const statAvgNetCell = document.getElementById("stat-avg-net-cell");
const statAvgNetCaption = document.getElementById("stat-avg-net-caption");
const statAvgWeeklyChange = document.getElementById("stat-avg-weekly-change");
const statAvgWeeklyChangeCaption = document.getElementById("stat-avg-weekly-change-caption");
const statAvgWorkouts = document.getElementById("stat-avg-workouts");
const statAvgRecovery = document.getElementById("stat-avg-recovery");
const statAvgSleep = document.getElementById("stat-avg-sleep");
const averagesWindow = document.getElementById("averages-window");
const streakCard = document.getElementById("streak-card");
const streakCurrent = document.getElementById("streak-current");
const streakCurrentCaption = document.getElementById("streak-current-caption");
const streakBest = document.getElementById("streak-best");
const streakBestCaption = document.getElementById("streak-best-caption");
const streakNote = document.getElementById("streak-note");
const insightsCard = document.getElementById("insights-card");
const insightsList = document.getElementById("insights-list");
const balanceTrendCard = document.getElementById("balance-trend-card");
const balanceTrendChart = document.getElementById("balance-trend-chart");
const balanceTrendCaption = document.getElementById("balance-trend-caption");
const granularityBtns = document.querySelectorAll(".granularity-btn");
const breakdownWeightCard = document.getElementById("breakdown-weight-card");
const breakdownWeightBody = document.getElementById("breakdown-weight-body");
const breakdownCaloriesCard = document.getElementById("breakdown-calories-card");
const breakdownCaloriesBody = document.getElementById("breakdown-calories-body");
const breakdownRecoveryCard = document.getElementById("breakdown-recovery-card");
const weightHero = document.getElementById("weight-hero");
const weightHeroValue = document.getElementById("weight-hero-value");
const weightHeroNote = document.getElementById("weight-hero-note");
const goalProgress = document.getElementById("goal-progress");
const goalProgressLabel = document.getElementById("goal-progress-label");
const goalProgressEta = document.getElementById("goal-progress-eta");
const goalProgressFill = document.getElementById("goal-progress-fill");
const tdeeCard = document.getElementById("tdee-card");
const tdeeValue = document.getElementById("tdee-value");
const tdeeConfidence = document.getElementById("tdee-confidence");
const tdeeExplain = document.getElementById("tdee-explain");
const tdeeUnderlogging = document.getElementById("tdee-underlogging");
const tdeePendingCard = document.getElementById("tdee-pending-card");
const tdeePendingText = document.getElementById("tdee-pending-text");
const importFile = document.getElementById("import-file");
const importStatus = document.getElementById("import-status");
const breakdownRecoveryBody = document.getElementById("breakdown-recovery-body");
const statsTabBtns = document.querySelectorAll(".stats-tab-btn");
const statsTabPanels = {
  weight: document.getElementById("stats-tab-weight"),
  calories: document.getElementById("stats-tab-calories"),
  recovery: document.getElementById("stats-tab-recovery"),
};

const exerciseToggle = document.getElementById("exercise-toggle");
const exerciseForm = document.getElementById("exercise-form");
const exerciseText = document.getElementById("exercise-text");
const exercisePhotoInput = document.getElementById("exercise-photo");
const exercisePhotoStatus = document.getElementById("exercise-photo-status");
const exerciseSubmit = document.getElementById("exercise-submit");
const exerciseError = document.getElementById("exercise-error");
const exerciseListEl = document.getElementById("exercise-list");

let authMode = "login";
let googleClientId = null;
let gsiLoaded = false;

const form = document.getElementById("entry-form");
const textInput = document.getElementById("text");
const photoInput = document.getElementById("photo");
const photoStatus = document.getElementById("photo-status");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

const scanBarcodeBtn = document.getElementById("scan-barcode-btn");
const scanModal = document.getElementById("scan-modal");
const scanCloseBtn = document.getElementById("scan-close-btn");
const scanVideo = document.getElementById("scan-video");
const scanStatusEl = document.getElementById("scan-status-el");



const weekRangeEl = document.getElementById("week-range");
const weekPrevBtn = document.getElementById("week-prev");
const weekNextBtn = document.getElementById("week-next");
const weekNoteEl = document.getElementById("week-note");
const weekTotalEl = document.getElementById("week-total");
const weekAvgEl = document.getElementById("week-avg");
const daysLoggedEl = document.getElementById("days-logged");
const weekNetSummaryEl = document.getElementById("week-net-summary");
const dailyTotalsEl = document.getElementById("daily-totals");
const formGuideEl = document.getElementById("form-guide");
const formGuideDaysEl = document.getElementById("form-guide-days");
const formGuideRecordEl = document.getElementById("form-guide-record");
const entryListEl = document.getElementById("entry-list");
const pendingNoteEl = document.getElementById("pending-note");
const exportPdfEl = document.getElementById("export-pdf");

let weeksAgo = 0;
let userWeekStartWeekday = 0; // 0=Mon … 6=Sun (same encoding as settings select)
let userWeekStartHour = 17;
let userWeekStartMinute = 0;
let weekStyle = "time"; // "whole" | "time"
let currentUser = null;
let useImperial = localStorage.getItem("units") === "imperial";

const logWeekRow = document.getElementById("log-week-row");
const logWeekCurrentBtn = document.getElementById("log-week-current");
const logWeekLastBtn = document.getElementById("log-week-last");
let logToLastWeek = false;

logWeekCurrentBtn.addEventListener("click", () => {
  logToLastWeek = false;
  logWeekCurrentBtn.classList.add("log-week-btn--active");
  logWeekLastBtn.classList.remove("log-week-btn--active");
});
logWeekLastBtn.addEventListener("click", () => {
  logToLastWeek = true;
  logWeekLastBtn.classList.add("log-week-btn--active");
  logWeekCurrentBtn.classList.remove("log-week-btn--active");
});

function isRolloverDay(dateInputValue) {
  // A whole-day week has no split day, so nothing is ever ambiguous about
  // which week a date belongs to.
  if (userWeekStartHour === 0 && userWeekStartMinute === 0) return false;
  if (!dateInputValue) return false;
  const [year, month, day] = dateInputValue.split("-").map(Number);
  // App weekday: 0=Mon…6=Sun → JS getDay(): Mon=1…Sun=0, so JS day = (appWeekday+1)%7
  const rolloverJsDay = (userWeekStartWeekday + 1) % 7;
  return new Date(year, month - 1, day).getDay() === rolloverJsDay;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function toDateInputValue(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

photoInput.addEventListener("change", () => {
  photoStatus.textContent = photoInput.files?.[0] ? photoInput.files[0].name : "Add a photo (optional)";
});

weekPrevBtn.addEventListener("click", () => {
  weeksAgo += 1;
  refreshCurrentView();
});

weekNextBtn.addEventListener("click", () => {
  if (weeksAgo === 0) return;
  weeksAgo -= 1;
  refreshCurrentView();
});

/**
 * Reloads whatever screen is in front of you after something changed.
 *
 * Only the current tab, deliberately: navTo() reloads each tab as you arrive
 * at it, so refreshing the others now would be two or three requests whose
 * results nobody is looking at.
 */
function refreshCurrentView() {
  if (currentTab === "week") return loadWeek();
  return loadToday();
}

async function loadWeek() {
  const res = await fetch(`/api/match-weeks/current?weeksAgo=${weeksAgo}`);
  const week = await res.json();

  // Server-formatted in the app's timezone — see weekRangeLabel in
  // routes/matchWeeks.ts for why the browser can't be trusted to do this.
  weekRangeEl.textContent = week.rangeLabel;
  weekNextBtn.disabled = weeksAgo === 0;
  weekTotalEl.textContent = (week.totalKcal ?? 0).toLocaleString();
  weekAvgEl.textContent = week.dailyAverage;
  daysLoggedEl.textContent = week.daysLogged;
  exportPdfEl.href = `/api/match-weeks/current/report.pdf?weeksAgo=${weeksAgo}`;

  weekNoteEl.hidden = weeksAgo === 0;
  exerciseToggle.hidden = weeksAgo !== 0;
  if (weeksAgo !== 0) { exerciseForm.hidden = true; exerciseToggle.innerHTML = `${ICONS.plus} Log exercise`; }
  const todayJsDay = new Date().getDay();
  logWeekRow.hidden =
    weeksAgo !== 0
    || todayJsDay !== (userWeekStartWeekday + 1) % 7
    // Nothing to choose between on a whole-day week: today falls in exactly
    // one week whatever time it is.
    || (userWeekStartHour === 0 && userWeekStartMinute === 0);

  if (week.pendingEstimates > 0) {
    const plural = week.pendingEstimates > 1 ? "entries" : "entry";
    pendingNoteEl.textContent = `${week.pendingEstimates} ${plural} couldn't be estimated and isn't counted yet — tap Edit to add kcal.`;
    pendingNoteEl.hidden = false;
  } else {
    pendingNoteEl.hidden = true;
  }

  renderFormGuide(week.dailyTotals ?? [], week.whoop?.dailyBurn ?? []);
  renderDailyTotals(week.dailyTotals ?? [], week.whoop?.dailyBurn ?? []);
  renderEntries(week.entries);
  renderExercises(week.exercises ?? []);
  renderBudgetWidget(week);
  // After renderEntries, since the notes attach to day headings it creates.
  loadDayNotes();
}

/**
 * The week as a form guide.
 *
 * A football season is read as a run of results — W W L D W — and a week of
 * eating genuinely is the same shape: seven days, each either under your
 * burn or over it. This is the one thing on the screen that answers "am I
 * winning this week" without reading a single number, which is the question
 * the screen exists to answer.
 *
 * Deliberately not a chart. A chart invites you to study it; a form guide is
 * read at a glance, which is the point.
 */
function renderFormGuide(days, whoopDailyBurn) {
  const burnByDate = new Map((whoopDailyBurn ?? []).map((b) => [b.date, b]));
  formGuideDaysEl.innerHTML = "";
  // A match week touches 8 calendar days, not 7 — it opens and closes
  // part-way through a Monday. The grid is sized from the data so the row
  // never wraps.
  formGuideDaysEl.style.gridTemplateColumns = `repeat(${Math.max(days.length, 1)}, 1fr)`;

  // Without a tracker there's still a verdict to give — the user's own
  // calorie target, or failing that a Mifflin-St Jeor estimate. A form guide
  // that only works for WHOOP users would be worse than no form guide.
  const reference = dailyReference();

  let under = 0;
  let over = 0;

  for (const day of days) {
    const burn = burnByDate.get(day.date);
    const block = document.createElement("div");
    const initial = day.label?.trim().charAt(0) ?? "";

    // Three states, and the difference between them matters: a day you came
    // in under, a day you went over, and a day there simply isn't a verdict
    // for yet. A future day is not a good day.
    let state = "none";
    let detail = `${day.label}: nothing logged`;

    const measuredBurn = !burn?.future && burn?.kcalWeighted != null ? burn.kcalWeighted : null;
    // Today is still in progress, so judging it would call a result at
    // half-time.
    const burnForDay = measuredBurn ?? (day.isToday ? null : reference?.kcal ?? null);

    if (burnForDay != null && day.kcal > 0) {
      const net = day.kcal - burnForDay;
      state = net <= 0 ? "under" : "over";
      if (net <= 0) under += 1;
      else over += 1;
      const word = net <= 0 ? "under" : "over";
      // Says what the verdict was measured against, because "300 over" means
      // something different against a measured burn and against a target.
      const source = measuredBurn != null ? "" : reference?.kind === "target" ? " (vs target)" : " (est.)";
      detail = `${day.label}: ${Math.abs(Math.round(net)).toLocaleString()} kcal ${word}${source}`;
    } else if (day.kcal > 0) {
      state = "logged";
      detail = `${day.label}: ${day.kcal.toLocaleString()} kcal logged${day.isToday ? ", still going" : ""}`;
    }

    block.className = `form-day form-day--${state}`;
    if (day.isToday) block.classList.add("form-day--today");
    block.innerHTML = `<span class="form-day-letter">${initial}</span>`;
    block.dataset.tooltip = detail;
    block.classList.add("has-tooltip");
    block.tabIndex = 0;
    formGuideDaysEl.appendChild(block);
  }

  // No verdicts yet means no record to report — better silent than "0-0".
  if (under + over === 0) {
    formGuideRecordEl.textContent = "";
    formGuideEl.hidden = days.length === 0;
    return;
  }
  formGuideRecordEl.textContent = `${under} under · ${over} over`;
  formGuideRecordEl.className =
    under >= over ? "form-guide-record form-guide-record--good" : "form-guide-record form-guide-record--bad";
  formGuideEl.hidden = false;
}

function renderDailyTotals(days, whoopDailyBurn) {
  const burnByDate = new Map((whoopDailyBurn ?? []).map((b) => [b.date, b]));
  let weekNet = 0;
  let weekNetHasData = false;

  dailyTotalsEl.innerHTML = "";
  for (const day of days) {
    const row = document.createElement("div");
    row.className = day.isToday ? "day-total-row day-total-row--today" : "day-total-row";

    const label = document.createElement("span");
    label.className = "day-total-label";
    label.textContent = day.isToday ? `Today · ${day.label}` : day.label;

    const burn = burnByDate.get(day.date);
    // Future days only carry a trailing-average projection (folded into the
    // weekly total), not a real measurement — showing it here would read as
    // "this already happened," so it's hidden until the day arrives.
    if (!burn?.future && burn?.kcalWeighted != null) {
      const whoopLine = document.createElement("span");
      whoopLine.className = "day-total-whoop";
      whoopLine.innerHTML = `${ICONS.flame} ${burn.kcalWeighted.toLocaleString()} kcal${burn.estimated ? " (est.)" : ""} WHOOP`;
      label.appendChild(document.createElement("br"));
      label.appendChild(whoopLine);
    }

    const kcal = document.createElement("span");
    kcal.className = "day-total-kcal";
    kcal.textContent = day.pending ? `${day.kcal} kcal + pending` : `${day.kcal} kcal`;

    // Net = eaten minus burned for that specific day — positive means a
    // surplus (ate more than burned), negative a deficit. Only shown once
    // a real or projected burn figure exists for the day.
    if (!burn?.future && burn?.kcalWeighted != null) {
      const net = day.kcal - burn.kcalWeighted;
      weekNet += net;
      weekNetHasData = true;

      const netLine = document.createElement("span");
      netLine.className = net > 0 ? "day-total-net day-total-net--over" : net < 0 ? "day-total-net day-total-net--under" : "day-total-net";
      const sign = net > 0 ? "+" : net < 0 ? "−" : "";
      netLine.textContent = `${sign}${Math.abs(net).toLocaleString()} kcal net`;
      kcal.appendChild(document.createElement("br"));
      kcal.appendChild(netLine);
    }

    row.append(label, kcal);
    dailyTotalsEl.appendChild(row);
  }

  // Sum of the per-day net figures above (days that have actually happened
  // so far — future days never contribute, same restriction as each row).
  if (weekNetHasData) {
    weekNetSummaryEl.hidden = false;
    weekNetSummaryEl.className =
      weekNet > 0 ? "week-net-summary week-net-summary--over" : weekNet < 0 ? "week-net-summary week-net-summary--under" : "week-net-summary";
    const sign = weekNet > 0 ? "+" : weekNet < 0 ? "−" : "";
    weekNetSummaryEl.textContent = `${sign}${Math.abs(weekNet).toLocaleString()} kcal net so far this week (in vs out)`;
  } else {
    weekNetSummaryEl.hidden = true;
  }
}

function renderEntries(entries) {
  entryListEl.innerHTML = "";

  if (entries.length === 0) {
    // Left empty on purpose — the message is supplied by
    // #entry-list:empty::after in style.css, same as the exercise/food lists.
    return;
  }

  const todayKey = new Date().toDateString();

  const dayGroups = new Map();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const dayKey = d.toDateString();
    if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, { date: d, entries: [] });
    dayGroups.get(dayKey).entries.push(entry);
  }

  for (const [dayKey, { date, entries: dayEntries }] of dayGroups.entries()) {
    const group = document.createElement("div");
    group.className = "day-group";

    const isToday = dayKey === todayKey;
    const dayKcal = dayEntries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
    const dayPending = dayEntries.some((e) => e.kcal === null);

    const heading = document.createElement("div");
    heading.className = isToday ? "day-heading day-heading--today" : "day-heading";

    const headingLabel = document.createElement("span");
    headingLabel.className = "day-heading-label";
    headingLabel.textContent = isToday ? `Today · ${dayFmt.format(date)}` : dayFmt.format(date);

    const headingKcal = document.createElement("span");
    headingKcal.className = "day-heading-kcal";
    headingKcal.textContent = dayPending ? `${dayKcal} kcal + pending` : `${dayKcal} kcal`;

    // A note belongs to the calendar day, so it hangs off the day heading
    // rather than off any one meal. The button carries the note's presence as
    // well as opening it, so a day with something recorded reads differently
    // at a glance from one without.
    const dayKeyIso = toDateInputValue(date);
    const noteBtn = document.createElement("button");
    noteBtn.type = "button";
    noteBtn.className = "day-note-btn";
    noteBtn.innerHTML = ICONS.note;
    noteBtn.title = "Note for this day";
    noteBtn.setAttribute("aria-label", `Note for ${dayFmt.format(date)}`);
    noteBtn.addEventListener("click", () => toggleDayNoteEditor(group, dayKeyIso, noteBtn));

    heading.append(headingLabel, noteBtn, headingKcal);
    group.appendChild(heading);

    const noteText = document.createElement("p");
    noteText.className = "day-note";
    noteText.dataset.dayNote = dayKeyIso;
    noteText.hidden = true;
    group.appendChild(noteText);
    applyDayNote(group, dayKeyIso);

    for (const entry of dayEntries) {
      group.appendChild(renderEntryRow(entry));
    }

    entryListEl.appendChild(group);
  }
}

function renderEntryRow(entry) {
  const row = document.createElement("div");
  row.className = "entry-row";
  row.dataset.id = entry.id;

  // Time sits under the label rather than in its own column. At 390px the
  // old four-column row left the label about 76px, which wrapped "Beef
  // burger with bacon and cheese" over four lines. Stacking gives that
  // column back to the food's name, which is the part you actually read.
  // The photo was being uploaded, converted, resized and stored, and then
  // never shown — the one part of logging a meal that produced nothing to
  // look at afterwards.
  if (entry.imageUrl) {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "entry-thumb";
    thumb.setAttribute("aria-label", `View photo of ${entry.label}`);
    const img = document.createElement("img");
    img.src = entry.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
    thumb.addEventListener("click", () => openPhotoModal(entry.imageUrl, entry.label));
    row.appendChild(thumb);
  }

  const main = document.createElement("div");
  main.className = "entry-main";

  const label = document.createElement("div");
  label.className = "entry-label";
  label.textContent = entry.label;
  if (entry.quantity && entry.quantity !== 1) {
    const qty = document.createElement("span");
    qty.className = "entry-qty";
    qty.textContent = `×${formatQuantity(entry.quantity)}`;
    label.appendChild(qty);
  }

  const time = document.createElement("div");
  time.className = "entry-time";
  time.textContent = timeFmt.format(new Date(entry.timestamp));

  main.append(label, time);

  // Only shown once macros are switched on, and only for entries that have
  // them — the back catalogue stays exactly as it looked before.
  if (currentUser?.macroTargets && hasMacros(entry)) {
    const macros = document.createElement("div");
    macros.className = "entry-macros";
    macros.textContent = macroLine(entry);
    main.appendChild(macros);
  }

  const kcal = document.createElement("div");
  kcal.className = "entry-kcal";
  kcal.textContent = entry.kcal === null ? "Add kcal" : `${entry.kcal} kcal`;
  const badge = sourceBadgeFor(entry);
  if (badge) kcal.appendChild(badge);

  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.type = "button";
  editBtn.addEventListener("click", () => enterEditMode(row, entry));
  const repeatBtn = document.createElement("button");
  repeatBtn.innerHTML = ICONS.plus;
  repeatBtn.type = "button";
  repeatBtn.className = "entry-action-icon";
  repeatBtn.title = "Add to today";
  repeatBtn.setAttribute("aria-label", "Add to today");
  repeatBtn.addEventListener("click", () => repeatEntry(entry.id));
  const delBtn = document.createElement("button");
  delBtn.innerHTML = ICONS.x;
  delBtn.type = "button";
  delBtn.className = "entry-action-icon";
  delBtn.title = "Delete";
  delBtn.setAttribute("aria-label", "Delete entry");
  delBtn.addEventListener("click", () => deleteEntry(entry.id));
  actions.append(editBtn, repeatBtn, delBtn);

  row.append(main, kcal, actions);
  return row;
}

function enterEditMode(row, entry) {
  row.innerHTML = "";
  const editRow = document.createElement("div");
  editRow.className = "entry-edit-row";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.value = entry.label;

  const kcalInput = document.createElement("input");
  kcalInput.type = "number";
  kcalInput.min = "0";
  kcalInput.value = entry.kcal ?? "";

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "0.25";
  qtyInput.step = "0.25";
  qtyInput.className = "entry-qty-input";
  qtyInput.value = entry.quantity ?? 1;
  qtyInput.title = "How many";
  qtyInput.setAttribute("aria-label", "Quantity");

  // Only offered when macros are on. Adding three more fields to every edit
  // row for someone tracking calories alone would be pure clutter.
  const macroInputs = {};
  let macroRow = null;
  if (currentUser?.macroTargets) {
    macroRow = document.createElement("div");
    macroRow.className = "entry-macro-edit";
    for (const key of ["protein", "carbs", "fat"]) {
      const field = document.createElement("label");
      field.className = "entry-macro-field";
      const caption = document.createElement("span");
      caption.textContent = MACRO_LABELS[key];
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.placeholder = "g";
      input.value = entry[`${key}G`] ?? "";
      input.setAttribute("aria-label", `${MACRO_LABELS[key]} in grams`);
      macroInputs[key] = input;
      field.append(caption, input);
      macroRow.appendChild(field);
    }
  }

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = toDateInputValue(entry.timestamp);

  // On the rollover day an entry's timestamp determines which week it falls in
  // (before the rollover hour → last week; at/after → this week). Show a plain
  // selector so the user can move it without having to know what time to pick.
  const weekSelect = document.createElement("select");
  weekSelect.className = "week-select";
  const lastWeekOpt = document.createElement("option");
  lastWeekOpt.value = "last";
  lastWeekOpt.textContent = "Last week";
  const thisWeekOpt = document.createElement("option");
  thisWeekOpt.value = "current";
  thisWeekOpt.textContent = "This week";
  weekSelect.append(lastWeekOpt, thisWeekOpt);

  function updateWeekSelectVisibility() {
    weekSelect.hidden = !isRolloverDay(dateInput.value);
    if (!weekSelect.hidden) {
      const entryHour = new Date(entry.timestamp).getHours();
      weekSelect.value = entryHour < userWeekStartHour ? "last" : "current";
    }
  }
  updateWeekSelectVisibility();
  dateInput.addEventListener("input", updateWeekSelectVisibility);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.style.width = "auto";
  saveBtn.addEventListener("click", async () => {
    const body = {
      label: labelInput.value.trim(),
      kcal: kcalInput.value === "" ? null : Number(kcalInput.value),
      date: dateInput.value,
    };
    // Only sent when it actually changed. Sending it every time would make
    // the server rescale kcal on every save, undoing a figure typed by hand
    // in the same edit.
    const newQty = Number(qtyInput.value);
    if (Number.isFinite(newQty) && newQty > 0 && newQty !== (entry.quantity ?? 1)) {
      body.quantity = newQty;
    }
    // Sent only when edited, for the same reason as quantity: sending them
    // unchanged would override the server's quantity rescaling with the old
    // pre-scaled figures.
    for (const key of ["protein", "carbs", "fat"]) {
      const input = macroInputs[key];
      if (!input) continue;
      const typed = input.value === "" ? null : Number(input.value);
      const current = entry[`${key}G`] ?? null;
      if (typed !== current) body[`${key}G`] = typed;
    }
    if (isRolloverDay(dateInput.value)) {
      body.hour = weekSelect.value === "last"
        ? Math.max(0, userWeekStartHour - 1)
        : userWeekStartHour;
    }
    await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    refreshCurrentView();
  });

  editRow.append(labelInput, kcalInput, qtyInput, dateInput, weekSelect, saveBtn);
  row.appendChild(editRow);
  if (macroRow) row.appendChild(macroRow);
}

async function deleteEntry(id) {
  await fetch(`/api/entries/${id}`, { method: "DELETE" });
  refreshCurrentView();
}

async function repeatEntry(id) {
  const res = await fetch(`/api/entries/${id}/repeat`, { method: "POST" });
  const created = await res.json().catch(() => null);
  weeksAgo = 0;
  if (created?.id) {
    showToast(`${created.label} added again`, { actionLabel: "Undo", onAction: () => undoEntries([created.id]) });
  }
  refreshCurrentView();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const text = textInput.value.trim();
  const photo = photoInput.files?.[0];
  if (!text && !photo) {
    formError.textContent = "Add a description or a photo first.";
    formError.hidden = false;
    return;
  }

  const data = new FormData();
  if (text) data.append("text", text);
  if (photo) data.append("photo", photo);
  if (logToLastWeek) data.append("lastWeek", "true");

  submitBtn.disabled = true;
  submitBtn.textContent = "Estimating…";

  try {
    let res;
    try {
      res = await fetch("/api/entries/preview", { method: "POST", body: data });
    } catch (error) {
      // No connection: keep what was typed rather than losing it to an error
      // message. It goes out as soon as the network is back.
      if (!isNetworkFailure(error)) throw error;
      await enqueue({
        kind: "entry",
        payload: { text, photo: photo ?? null, photoName: photo?.name ?? null, lastWeek: logToLastWeek },
      });
      haptic();
      form.reset();
      photoStatus.textContent = "Add a photo (optional)";
      logToLastWeek = false;
      logWeekCurrentBtn.classList.add("log-week-btn--active");
      logWeekLastBtn.classList.remove("log-week-btn--active");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ? JSON.stringify(body.error) : "Failed to estimate that.");
    }
    const preview = await res.json();
    haptic();

    form.reset();
    photoStatus.textContent = "Add a photo (optional)";

    // Nothing is in the diary yet — the sheet is where it gets saved, and it
    // carries the "log to last week" choice with it so the form can reset.
    openConfirmSheet({
      items: preview.items,
      imageUrl: preview.imageUrl,
      rawInput: preview.rawInput,
      source: "ai",
      lastWeek: logToLastWeek,
      sourceLabel: "AI estimate",
      note: "Change anything that's off, then log it.",
    });

    logToLastWeek = false;
    logWeekCurrentBtn.classList.add("log-week-btn--active");
    logWeekLastBtn.classList.remove("log-week-btn--active");
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log it";
  }
});

function setAuthMode(mode) {
  authMode = mode;
  authSubmit.textContent = mode === "login" ? "Log in" : "Sign up";
  authToggleText.textContent = mode === "login" ? "Don't have an account?" : "Already have an account?";
  authToggleBtn.textContent = mode === "login" ? "Sign up" : "Log in";
  authError.hidden = true;
}

authToggleBtn.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.hidden = true;

  const username = authUsername.value.trim();
  const password = authPassword.value;

  authSubmit.disabled = true;
  try {
    const res = await fetch(`/api/auth/${authMode === "login" ? "login" : "signup"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Something went wrong. Try again.");
    }
    authForm.reset();
    const isNewAccount = res.status === 201;
    await showApp(body, { firstRun: isNewAccount });
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

function markGsiLoaded() {
  gsiLoaded = true;
  tryInitGoogleSignIn();
}

// The Google script's onload may have already fired (and set this flag)
// before this same-origin script finished loading and got here.
if (window.__gsiReady) {
  markGsiLoaded();
} else {
  window.__onGsiLoad = markGsiLoaded;
}

function tryInitGoogleSignIn() {
  if (!googleClientId || !gsiLoaded || !window.google) return;
  window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
  window.google.accounts.id.renderButton(googleSigninBtn, { theme: "outline", size: "large", width: 300 });
  googleSigninBtn.hidden = false;
  // Recorded so the forgotten-password view can hide and restore the button
  // without having to re-derive whether it was ever rendered.
  googleSigninBtn.dataset.ready = "1";
  authDivider.hidden = false;

  // The same credential flow, but pointed at /link-google so an existing
  // account gains Google as a way back in rather than a second account being
  // created. Linking is never inferred from a matching email address.
  const linkTarget = document.getElementById("google-link-btn");
  if (linkTarget) {
    window.google.accounts.id.renderButton(linkTarget, {
      theme: "outline",
      size: "large",
      width: 300,
      click_listener: () => {
        pendingGoogleAction = "link";
      },
    });
  }
}

// Which endpoint the next Google credential should go to. Google's button
// gives one shared callback, so the two uses have to be told apart here.
let pendingGoogleAction = "signin";

async function loadGoogleConfig() {
  try {
    const res = await fetch("/api/auth/google/config");
    const body = await res.json();
    googleClientId = body.clientId ?? null;
    tryInitGoogleSignIn();
  } catch {
    // Sign-in still works via username/password if this fails.
  }
}

async function handleGoogleCredential(response) {
  if (pendingGoogleAction === "link") {
    pendingGoogleAction = "signin";
    try {
      const res = await fetch("/api/auth/link-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't link that Google account.");
      currentUser = data;
      renderSecuritySection(data);
      showSecurityMessage("Google linked. You can now sign in that way if you forget your password.");
    } catch (error) {
      showSecurityMessage(error.message ?? "Couldn't link that Google account.", true);
    }
    return;
  }

  authError.hidden = true;
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Google sign-in failed.");
    }
    showApp(body);
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  }
}

function loadSettingsScreen() {
  refreshPushUi();
  loadRecoveryOptions();
  loadDiagnostics();
}


settingsBack.addEventListener("click", () => navTo("today"));

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  showAuthScreen();
});

settingsSave.addEventListener("click", async () => {
  settingsError.hidden = true;

  settingsSave.disabled = true;
  try {
    const rawWeight = settingsWeight.value ? Number(settingsWeight.value) : null;
    const weightVal = rawWeight === null ? null : useImperial ? +(rawWeight / 2.20462).toFixed(2) : rawWeight;
    let heightVal = null;
    if (useImperial) {
      const ft = Number(settingsHeightFt.value) || 0;
      const inches = Number(settingsHeightIn.value) || 0;
      if (ft || inches) heightVal = +((ft * 12 + inches) * 2.54).toFixed(1);
    } else {
      heightVal = settingsHeight.value ? Number(settingsHeight.value) : null;
    }
    const ageVal = settingsAge.value ? Number(settingsAge.value) : null;
    const activityVal = settingsActivity.value || null;
    const rawGoal = settingsGoal.value ? Number(settingsGoal.value) : null;
    const goalVal = rawGoal === null ? null : useImperial ? +(rawGoal / 2.20462).toFixed(3) : rawGoal;
    const rawGoalWeight = settingsGoalWeight.value ? Number(settingsGoalWeight.value) : null;
    const goalWeightVal = rawGoalWeight === null ? null : useImperial ? +(rawGoalWeight / 2.20462).toFixed(2) : rawGoalWeight;
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStartWeekday: Number(settingsWeekday.value),
        ...weekStartTimePayload(),
        weightKg: weightVal,
        heightCm: heightVal,
        ageYears: ageVal,
        activityLevel: activityVal,
        weeklyGoalKg: goalVal,
        goalWeightKg: goalWeightVal,
        // Always kcal, never converted — a calorie is a calorie in either
        // unit system, unlike every other figure on this form.
        dailyCalorieTarget: settingsCalorieTarget.value === "" ? null : Number(settingsCalorieTarget.value),
        ...macroSettingsPayload(),
        reminderHour: settingsReminderHour.value === "" ? null : Number(settingsReminderHour.value),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save settings.");
    }
    populateSettings(body);
    weeksAgo = 0;
    navTo("today");
  } catch (error) {
    settingsError.textContent = error.message;
    settingsError.hidden = false;
  } finally {
    settingsSave.disabled = false;
  }
});

function populateSettings(user) {
  currentUser = user;
  settingsUsername.textContent = user.username;
  settingsReminderHour.value = user.reminderHour === null ? "" : String(user.reminderHour);
  settingsWeekday.value = String(user.weekStartWeekday);
  settingsTime.value = `${String(user.weekStartHour).padStart(2, "0")}:${String(user.weekStartMinute).padStart(2, "0")}`;
  userWeekStartWeekday = user.weekStartWeekday;
  userWeekStartHour = user.weekStartHour;
  userWeekStartMinute = user.weekStartMinute;
  // A whole-day week is just a rollover at midnight — no separate stored
  // flag to drift out of step with the boundary it describes.
  setWeekStyle(user.weekStartHour === 0 && user.weekStartMinute === 0 ? "whole" : "time");
  applyUnitPreference();
  if (user.weightKg) {
    settingsWeight.value = useImperial ? +(user.weightKg * 2.20462).toFixed(1) : user.weightKg;
  } else {
    settingsWeight.value = "";
  }
  if (user.heightCm) {
    if (useImperial) {
      const totalIn = user.heightCm / 2.54;
      settingsHeightFt.value = Math.floor(totalIn / 12);
      settingsHeightIn.value = Math.round(totalIn % 12);
    } else {
      settingsHeight.value = user.heightCm;
    }
  } else {
    settingsHeight.value = "";
    settingsHeightFt.value = "";
    settingsHeightIn.value = "";
  }
  if (user.ageYears) settingsAge.value = user.ageYears;
  settingsActivity.value = user.activityLevel ?? "";
  if (user.weeklyGoalKg) {
    settingsGoal.value = useImperial ? +(user.weeklyGoalKg * 2.20462).toFixed(2) : user.weeklyGoalKg;
  } else {
    settingsGoal.value = "";
  }
  if (user.goalWeightKg) {
    settingsGoalWeight.value = useImperial ? +(user.goalWeightKg * 2.20462).toFixed(1) : user.goalWeightKg;
  } else {
    settingsGoalWeight.value = "";
  }
  settingsCalorieTarget.value = user.dailyCalorieTarget ?? "";
  populateMacroSettings(user);
  settingsEmail.value = user.email ?? "";
  renderSecuritySection(user);
  deleteConfirmInput.value = "";
  deletePasswordWrap.hidden = !user.hasPassword;
}

async function showApp(user, { firstRun = false } = {}) {
  populateSettings(user);
  settingsScreen.hidden = true;
  authScreen.hidden = true;

  // A fresh sign-up gets the wizard once. The flag is per-device rather than
  // per-account on purpose: it's a UI nicety, not data worth a column.
  if (firstRun && !localStorage.getItem(ONBOARDED_KEY)) {
    openOnboarding();
  } else {
    localStorage.setItem(ONBOARDED_KEY, "1");
    navTo("today");
  }
  // Awaited so a redirect error set below isn't silently overwritten by the
  // status fetch's own (less specific) message resolving afterward.
  await loadWhoopStatus();
  handleWhoopRedirect();
  handleLaunchParams();
  refreshOfflineBanner();
  flushQueue();
  loadWater();
}

// WHOOP's OAuth callback redirects back to "/" with a query param — surface
// the result once, then strip it so a page refresh doesn't repeat it.
function handleWhoopRedirect() {
  const params = new URLSearchParams(window.location.search);
  const whoopResult = params.get("whoop");
  if (!whoopResult) return;

  if (whoopResult === "connected") {
    navTo("settings");
  } else if (whoopResult === "error") {
    navTo("settings");
    const reason = params.get("reason");
    whoopStatusText.textContent = reason ? `Couldn't connect WHOOP: ${reason}` : "Couldn't connect WHOOP — please try again.";
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("whoop");
  url.searchParams.delete("reason");
  window.history.replaceState({}, "", url.pathname + url.search);
}

async function loadWhoopStatus() {
  try {
    const res = await fetch("/api/whoop/status");
    if (!res.ok) throw new Error();
    const status = await res.json();

    whoopUnconfiguredNote.hidden = status.configured;
    whoopConnectBtn.hidden = !status.configured || status.connected;
    whoopSyncBtn.hidden = !status.configured || !status.connected;
    whoopDisconnectBtn.hidden = !status.configured || !status.connected;

    applyTrackerAwareSettings(status.connected === true);

    if (!status.configured) {
      whoopStatusText.textContent = "Not connected";
    } else if (status.connected) {
      const synced = status.lastSyncedAt
        ? new Date(status.lastSyncedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "not yet";
      whoopStatusText.textContent = `Connected · last synced ${synced}`;
    } else {
      whoopStatusText.textContent = "Not connected";
    }
  } catch {
    whoopStatusText.textContent = "Couldn't check WHOOP status";
  }
}

whoopConnectBtn.addEventListener("click", () => {
  window.location.href = "/api/whoop/connect";
});

whoopSyncBtn.addEventListener("click", async () => {
  whoopSyncBtn.disabled = true;
  whoopSyncBtn.textContent = "Syncing…";
  try {
    const res = await fetch("/api/whoop/sync", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Sync failed — please try again.");
    }
    await loadWhoopStatus();
    await loadWeek();
  } catch (error) {
    whoopStatusText.textContent = error.message;
  } finally {
    whoopSyncBtn.disabled = false;
    whoopSyncBtn.textContent = "Sync now";
  }
});

whoopDisconnectBtn.addEventListener("click", async () => {
  whoopDisconnectBtn.disabled = true;
  try {
    await fetch("/api/whoop/disconnect", { method: "POST" });
    await loadWhoopStatus();
    await loadWeek();
  } finally {
    whoopDisconnectBtn.disabled = false;
  }
});

function showAuthScreen() {
  appShell.hidden = true;
  todayScreen.hidden = true;
  tabBar.hidden = true;
  authScreen.hidden = false;
  setAuthMode("login");
  authForm.reset();
}

async function checkAuth() {
  // A reset link lands on "/" with the token in the query. That view wins
  // over both the app and the sign-in form: someone following it is here to
  // set a password, whatever session the browser still has.
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  if (resetToken) {
    appShell.hidden = true;
    todayScreen.hidden = true;
    tabBar.hidden = true;
    authScreen.hidden = false;
    authForm.hidden = true;
    authToggleBtn.parentElement.hidden = true;
    authForgotBtn.parentElement.hidden = true;
    googleSigninBtn.hidden = true;
    authDivider.hidden = true;
    resetForm.hidden = false;
    return;
  }

  const res = await fetch("/api/auth/me");
  if (res.ok) {
    showApp(await res.json());
  } else {
    showAuthScreen();
  }
}

// Bootstrap moved to the bottom of this file: checkAuth() now touches
// elements whose consts are declared further down (the reset-password view),
// and a const referenced before its declaration is evaluated is a
// ReferenceError, not a hoisted undefined.

// ── Exercise photo status ──────────────────────────────────────────────────
exercisePhotoInput.addEventListener("change", () => {
  exercisePhotoStatus.textContent = exercisePhotoInput.files[0]
    ? exercisePhotoInput.files[0].name
    : "Add a screenshot (optional)";
});

// ── Exercise form toggle ───────────────────────────────────────────────────
exerciseToggle.addEventListener("click", () => {
  const hidden = exerciseForm.hidden;
  exerciseForm.hidden = !hidden;
  exerciseToggle.innerHTML = hidden ? `${ICONS.x} Cancel` : `${ICONS.plus} Log exercise`;
});

// ── Exercise form submit ───────────────────────────────────────────────────
exerciseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  exerciseError.hidden = true;

  const formData = new FormData();
  const text = exerciseText.value.trim();
  if (text) formData.append("text", text);
  if (exercisePhotoInput.files[0]) formData.append("photo", exercisePhotoInput.files[0]);

  if (!text && !exercisePhotoInput.files[0]) {
    exerciseError.textContent = "Describe the exercise or add a screenshot.";
    exerciseError.hidden = false;
    return;
  }

  exerciseSubmit.disabled = true;
  exerciseSubmit.textContent = "Estimating…";
  try {
    const res = await fetch("/api/exercises", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Failed to log exercise.");
    exerciseForm.reset();
    exercisePhotoStatus.textContent = "Add a screenshot (optional)";
    exerciseForm.hidden = true;
    exerciseToggle.innerHTML = `${ICONS.plus} Log exercise`;
    loadWeek();
  } catch (error) {
    exerciseError.textContent = error.message;
    exerciseError.hidden = false;
  } finally {
    exerciseSubmit.disabled = false;
    exerciseSubmit.textContent = "Log exercise";
  }
});

// ── Render exercises ───────────────────────────────────────────────────────
function renderExercises(exercises) {
  exerciseListEl.innerHTML = "";
  for (const ex of exercises) {
    const row = document.createElement("div");
    row.className = "exercise-entry";

    const icon = document.createElement("span");
    icon.className = "exercise-icon";
    icon.innerHTML = ex.fromWhoop ? ICONS.watch : ICONS.activity;

    const label = document.createElement("span");
    label.className = "exercise-label";
    label.textContent = ex.description;
    const timeLine = document.createElement("span");
    timeLine.className = "exercise-time";
    const exDate = new Date(ex.timestamp);
    const isToday = exDate.toDateString() === new Date().toDateString();
    timeLine.textContent = isToday ? timeFmt.format(exDate) : `${dateFmt.format(exDate)}, ${timeFmt.format(exDate)}`;
    label.appendChild(document.createElement("br"));
    label.appendChild(timeLine);

    const kcal = document.createElement("span");
    kcal.className = "exercise-kcal";
    kcal.textContent = ex.kcalBurned !== null ? `−${ex.kcalBurned} kcal` : "kcal unknown";

    const editBtn = document.createElement("button");
    editBtn.className = "exercise-del";
    editBtn.innerHTML = ICONS.pencil;
    editBtn.type = "button";
    editBtn.title = "Edit";
    editBtn.setAttribute("aria-label", "Edit exercise");
    editBtn.addEventListener("click", () => enterExerciseEditMode(row, ex));

    const delBtn = document.createElement("button");
    delBtn.className = "exercise-del";
    delBtn.innerHTML = ICONS.x;
    delBtn.type = "button";
    // Auto-imported entries reappear on the next WHOOP sync since they're
    // matched by the workout's own id, not tracked as user-deleted.
    if (ex.fromWhoop) delBtn.title = "Auto-imported from WHOOP — will reappear on next sync";
    delBtn.addEventListener("click", () => deleteExercise(ex.id));

    row.append(icon, label, kcal, editBtn, delBtn);
    exerciseListEl.appendChild(row);
  }
}

async function deleteExercise(id) {
  await fetch(`/api/exercises/${id}`, { method: "DELETE" });
  loadWeek();
}

// ── Calorie balance widget ──────────────────────────────────────────────────
// TDEE (Mifflin-St Jeor) — used as the "calories out" estimate only when
// WHOOP isn't connected and there's no measured burn to use instead.
/**
 * What to measure a day's eating against when there's no tracker.
 *
 * The manual target wins over the body-stats estimate: a figure someone typed
 * in is a statement of what they're aiming at, and quietly showing them a
 * Mifflin-St Jeor guess instead ignores the thing they told us. Only a real
 * measurement (WHOOP) beats it, and that's handled per-day by the callers,
 * which have the burn data this doesn't.
 *
 * Returns the kind as well as the number, because the two aren't
 * interchangeable: a burn estimate supports "deficit" and a projected weight
 * change, a target only supports "under" and "over".
 */
function dailyReference() {
  const target = currentUser?.dailyCalorieTarget ?? null;
  if (target) return { kcal: target, kind: "target" };
  const tdee = calculateTdee(currentUser);
  if (tdee) return { kcal: tdee, kind: "estimate" };
  return null;
}

function calculateTdee(user) {
  const { weightKg, heightCm, ageYears, activityLevel } = user ?? {};
  if (!weightKg || !heightCm || !ageYears || !activityLevel) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return bmr * (multipliers[activityLevel] ?? 1.2);
}

function renderBudgetWidget(week) {
  const whoop = week.whoop;

  const caloriesIn = week.totalKcal ?? 0;

  let caloriesOut = null;
  let sourceLabel = "";
  // A measured burn supports "deficit" and a projected weight change; a
  // target only supports "under" and "over". Tracked so the labels below can
  // say what the number actually is rather than calling a target a burn.
  let comparedAgainst = "burn";

  if (whoop?.connected && whoop.dailyBurn) {
    caloriesOut = 0;
    for (const d of whoop.dailyBurn) {
      if (d.future || d.kcalWeighted == null) continue;
      caloriesOut += d.kcalWeighted;
    }
    sourceLabel = "WHOOP";
  } else {
    const reference = dailyReference();
    if (reference && week.daysLogged > 0) {
      caloriesOut = Math.round(reference.kcal * week.daysLogged);
      sourceLabel = reference.kind === "target" ? "your target" : "estimated";
      comparedAgainst = reference.kind === "target" ? "target" : "burn";
    }
  }

  if (caloriesOut === null) {
    budgetWidget.hidden = true;
    return;
  }
  budgetWidget.hidden = false;

  budgetSourceLabel.textContent = sourceLabel ? `· ${sourceLabel}` : "";
  balanceInTotal.textContent = caloriesIn.toLocaleString();
  balanceOutTotal.textContent = caloriesOut.toLocaleString();
  balanceOutCaption.textContent = comparedAgainst === "target" ? "target so far" : "kcal out";

  // Direct so-far numbers — no projection to the rest of the week.
  const net = caloriesIn - caloriesOut; // positive = surplus, negative = deficit
  const kgChange = -net / 7700; // positive = lost, negative = gained

  balanceDiffCell.className = "balance-cell";
  balanceKgCell.className = "balance-cell";

  if (net <= 0) {
    balanceDiffCell.classList.add("balance-cell--loss");
    balanceDiff.textContent = `−${Math.abs(net).toLocaleString()}`;
    balanceDiffCaption.textContent = comparedAgainst === "target" ? "under target" : "kcal deficit";
  } else {
    balanceDiffCell.classList.add("balance-cell--gain");
    balanceDiff.textContent = `+${net.toLocaleString()}`;
    balanceDiffCaption.textContent = comparedAgainst === "target" ? "over target" : "kcal surplus";
  }

  // A weight projection needs a burn figure. Against a target it would be
  // predicting the scale from what you meant to eat, which it can't do — so
  // the cell goes rather than showing a number with no basis.
  balanceKgCell.hidden = comparedAgainst === "target";
  if (comparedAgainst === "target") return;

  if (kgChange >= 0) {
    balanceKgCell.classList.add("balance-cell--loss");
    balanceKg.textContent = kgChange.toFixed(2);
    balanceKgCaption.textContent = "kg lost";
  } else {
    balanceKgCell.classList.add("balance-cell--gain");
    balanceKg.textContent = Math.abs(kgChange).toFixed(2);
    balanceKgCaption.textContent = "kg gained";
  }
}

// ── Unit preference ────────────────────────────────────────────────────────
function applyUnitPreference() {
  if (useImperial) {
    unitsImperialBtn.classList.add("units-btn--active");
    unitsMetricBtn.classList.remove("units-btn--active");
    weightLabel.textContent = "Weight (lbs)";
    settingsWeight.placeholder = "e.g. 210";
    settingsWeight.min = "66";
    settingsWeight.max = "660";
    goalLabel.textContent = "Target loss (lbs/week)";
    settingsGoal.placeholder = "e.g. 1.0";
    settingsGoal.max = "6";
    goalWeightLabel.textContent = "Goal weight (lbs)";
    settingsGoalWeight.placeholder = "e.g. 187";
    settingsGoalWeight.min = "66";
    settingsGoalWeight.max = "1540";
    heightCmWrap.hidden = true;
    heightFtWrap.hidden = false;
  } else {
    unitsMetricBtn.classList.add("units-btn--active");
    unitsImperialBtn.classList.remove("units-btn--active");
    weightLabel.textContent = "Weight (kg)";
    settingsWeight.placeholder = "e.g. 95";
    settingsWeight.min = "30";
    settingsWeight.max = "300";
    goalLabel.textContent = "Target loss (kg/week)";
    settingsGoal.placeholder = "e.g. 0.5";
    settingsGoal.max = "3";
    goalWeightLabel.textContent = "Goal weight (kg)";
    settingsGoalWeight.placeholder = "e.g. 85";
    settingsGoalWeight.min = "30";
    settingsGoalWeight.max = "700";
    heightCmWrap.hidden = false;
    heightFtWrap.hidden = true;
  }
}

function switchUnits(imperial) {
  // Measurements follow the same unit preference as weight — a screen that
  // showed a waist in inches and a weight in kilos would be worse than either.
  setTimeout(() => {
    if (measurements.length > 0) renderMeasurements();
  }, 0);
  // Read current field values and convert them before switching display
  if (currentUser) {
    const oldWeightKg = currentUser.weightKg;
    const oldHeightCm = currentUser.heightCm;
    const oldGoalKg = currentUser.weeklyGoalKg;

    useImperial = imperial;
    localStorage.setItem("units", imperial ? "imperial" : "metric");
    applyUnitPreference();

    if (oldWeightKg) {
      settingsWeight.value = imperial ? +(oldWeightKg * 2.20462).toFixed(1) : oldWeightKg;
    }
    if (oldHeightCm) {
      if (imperial) {
        const totalIn = oldHeightCm / 2.54;
        settingsHeightFt.value = Math.floor(totalIn / 12);
        settingsHeightIn.value = Math.round(totalIn % 12);
      } else {
        settingsHeight.value = oldHeightCm;
      }
    }
    if (oldGoalKg) {
      settingsGoal.value = imperial ? +(oldGoalKg * 2.20462).toFixed(2) : oldGoalKg;
    }
  } else {
    useImperial = imperial;
    localStorage.setItem("units", imperial ? "imperial" : "metric");
    applyUnitPreference();
  }
  if (!statsScreen.hidden) renderStats();
}

unitsMetricBtn.addEventListener("click", () => switchUnits(false));
unitsImperialBtn.addEventListener("click", () => switchUnits(true));

// Apply on page load
applyUnitPreference();

// ── Barcode scanner ────────────────────────────────────────────────────────

let scanStream = null;
let scanRafId = null;
let quaggaLoopActive = false;
// Whether the scanner UI is up. Kept apart from scanStream because the stream
// now outlives a close (see below), so the detector loops can't use the
// stream's existence to decide whether to keep going.
let scannerActive = false;
let cameraReleaseTimer = null;

// How long a camera stream is held after the scanner closes. Safari asks for
// permission on every getUserMedia call, so a stream that dies between scans
// means a fresh prompt for every single scan. Holding it across a scanning
// burst turns that into one prompt. It is still released afterwards — and
// immediately if the app is backgrounded — so the camera indicator never
// stays lit on an idle app.
const CAMERA_HOLD_MS = 300_000;

async function acquireCameraStream() {
  clearTimeout(cameraReleaseTimer);
  const live = scanStream?.getVideoTracks().some((t) => t.readyState === "live");
  if (live) {
    // Held streams are left attached but muted between scans; wake it back up.
    scanStream.getVideoTracks().forEach((t) => { t.enabled = true; });
    return scanStream;
  }
  releaseCameraStream();
  scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  // iOS can end a track on its own — a phone call, another app taking the
  // camera. Forgetting it here means the next open asks for a fresh one
  // instead of handing the detector a dead stream.
  for (const track of scanStream.getVideoTracks()) {
    track.addEventListener("ended", () => {
      if (scanStream && scanStream.getVideoTracks().includes(track)) scanStream = null;
    });
  }
  return scanStream;
}

function releaseCameraStream() {
  clearTimeout(cameraReleaseTimer);
  if (!scanStream) return;
  scanStream.getTracks().forEach((t) => t.stop());
  scanStream = null;
  scanVideo.srcObject = null;
}

function openScanner() {
  scanModal.hidden = false;
  scannerActive = true;
  scanStatusEl.textContent = "Searching for barcode…";

  acquireCameraStream()
    .then((stream) => {
      if (!scannerActive) return;
      // Re-attached only when it isn't already the same stream, so reopening
      // within the hold window doesn't restart the capture session.
      if (scanVideo.srcObject !== stream) scanVideo.srcObject = stream;
      // Closing the scanner pauses the video, which rejects a play() that is
      // still starting up. Nothing has gone wrong when that happens, so it is
      // swallowed rather than left as an unhandled rejection.
      scanVideo.play().catch(() => {});
      if (typeof BarcodeDetector !== "undefined") {
        runBarcodeDetectorLoop();
      } else {
        // Safari and Firefox have no BarcodeDetector, so the decoder comes off
        // a CDN. If that fetch fails the scanner would otherwise sit on
        // "Searching for barcode…" for ever with nothing running behind it.
        loadQuagga2().then(runQuaggaLoop).catch(() => {
          scanStatusEl.textContent =
            "Couldn't load the barcode reader — check your connection, or type the food in instead.";
        });
      }
    })
    .catch(() => {
      scanStatusEl.textContent =
        "Camera access denied — allow camera use for this site and try again.";
    });
}

function stopScanner() {
  scannerActive = false;
  if (scanRafId) {
    cancelAnimationFrame(scanRafId);
    scanRafId = null;
  }
  quaggaLoopActive = false;

  // The stream stays attached to the video element. Detaching it (srcObject =
  // null) tears the capture session down on iOS: the track ends, the hold
  // below has nothing left to hold, and the next scan asks for permission
  // again — which is exactly what the hold was added to stop. Pausing and
  // muting the track keeps the session alive with no frames flowing.
  scanVideo.pause();
  scanStream?.getVideoTracks().forEach((t) => { t.enabled = false; });
  scanModal.hidden = true;

  clearTimeout(cameraReleaseTimer);
  cameraReleaseTimer = setTimeout(releaseCameraStream, CAMERA_HOLD_MS);
}

// Leaving the app drops the camera straight away rather than waiting out the
// hold — a held stream is a convenience while scanning, not a reason to keep
// the camera open in the background.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !scannerActive) releaseCameraStream();
});

// Native BarcodeDetector (Chrome, Edge, Android WebView)
function runBarcodeDetectorLoop() {
  const detector = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
  });

  async function tick() {
    if (!scannerActive) return;
    try {
      const results = await detector.detect(scanVideo);
      if (results.length > 0) {
        handleBarcode(results[0].rawValue);
        return;
      }
    } catch {
      // video not ready yet — keep looping
    }
    scanRafId = requestAnimationFrame(tick);
  }

  scanRafId = requestAnimationFrame(tick);
}

// Quagga2 fallback (Firefox, iOS Safari)
let quagga2Promise = null;
function loadQuagga2() {
  if (quagga2Promise) return quagga2Promise;
  quagga2Promise = new Promise((resolve, reject) => {
    if (window.Quagga) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.7.4/dist/quagga.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return quagga2Promise;
}

function runQuaggaLoop() {
  quaggaLoopActive = true;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function tick() {
    if (!quaggaLoopActive || !scannerActive) return;
    if (scanVideo.readyState < 2) { requestAnimationFrame(tick); return; }
    canvas.width = scanVideo.videoWidth;
    canvas.height = scanVideo.videoHeight;
    ctx.drawImage(scanVideo, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    window.Quagga.decodeSingle(
      {
        src: dataUrl,
        numOfWorkers: 0,
        inputStream: { size: 640 },
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"] },
      },
      (result) => {
        if (!quaggaLoopActive) return;
        if (result?.codeResult?.code) {
          handleBarcode(result.codeResult.code);
        } else {
          requestAnimationFrame(tick);
        }
      },
    );
  }

  requestAnimationFrame(tick);
}

async function handleBarcode(code) {
  scanStatusEl.textContent = "Looking up product…";
  const product = await lookupOpenFoodFacts(code);
  stopScanner();
  openProductSheet(product);
}

async function lookupOpenFoodFacts(barcode) {
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
      `?fields=product_name,brands,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url);
    if (!res.ok) return emptyProduct(barcode);
    const data = await res.json();
    if (data.status !== 1) return emptyProduct(barcode);
    const p = data.product;
    const kcalPer100g =
      p.nutriments?.["energy-kcal_100g"] ??
      p.nutriments?.["energy-kcal"] ??
      null;
    const defaultServing = p.serving_quantity ? Math.round(Number(p.serving_quantity)) : null;
    return {
      barcode,
      name: p.product_name || null,
      brand: p.brands || null,
      kcalPer100g: kcalPer100g !== null ? Number(kcalPer100g) : null,
      // Real label figures off the packet, so these skip the estimator
      // entirely — the same reason the calories do.
      macrosPer100g: {
        protein: numberOrNull(p.nutriments?.["proteins_100g"]),
        carbs: numberOrNull(p.nutriments?.["carbohydrates_100g"]),
        fat: numberOrNull(p.nutriments?.["fat_100g"]),
      },
      defaultServing,
    };
  } catch {
    return emptyProduct(barcode);
  }
}

function emptyProduct(barcode) {
  return {
    barcode,
    name: null,
    brand: null,
    kcalPer100g: null,
    macrosPer100g: { protein: null, carbs: null, fat: null },
    defaultServing: null,
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ── Confirm sheet ───────────────────────────────────────────────────────────
// One rule, everywhere: the app never puts its own guess in the diary without
// you seeing it first. Anything estimated or looked up lands here, editable,
// and only reaches the diary when "Save" is pressed. Things you approved
// earlier (a saved meal, a favourite, a repeat) still save on one tap — but
// they say so, with an undo. Before this, a photo estimate saved itself and
// then offered "Save corrections", while a scan waited for a second tap; that
// inconsistency is what this replaces.

const confirmSheet = document.getElementById("confirm-sheet");
const confirmTitleEl = document.getElementById("confirm-title");
const confirmSourceEl = document.getElementById("confirm-source");
const confirmNoteEl = document.getElementById("confirm-note");
const confirmWarningEl = document.getElementById("confirm-warning");
const confirmItemsEl = document.getElementById("confirm-items");
const confirmTotalEl = document.getElementById("confirm-total");
const confirmErrorEl = document.getElementById("confirm-error");
const confirmSaveBtn = document.getElementById("confirm-save");
const confirmDiscardBtn = document.getElementById("confirm-discard");
const confirmAltBtn = document.getElementById("confirm-alt");

// Null whenever the sheet is closed, so a stale save can't fire after it.
let confirmState = null;

/**
 * @param {object} opts
 * @param {Array} opts.items      rows to show, in the API's item shape
 * @param {string} opts.sourceLabel  badge text: where these figures came from
 * @param {string} [opts.note]    one line under the title
 * @param {string} [opts.warning] shown in red — a missing figure, say
 * @param {{label: string, run: Function}} [opts.alt]  optional third button
 */
function openConfirmSheet({
  items,
  imageUrl = null,
  rawInput = null,
  source = "ai",
  lastWeek = false,
  sourceLabel = "Estimate",
  note = "",
  warning = "",
  alt = null,
}) {
  confirmState = {
    items: items.map(normaliseConfirmItem),
    imageUrl,
    rawInput,
    source,
    lastWeek,
  };

  confirmSourceEl.textContent = sourceLabel;
  confirmNoteEl.textContent = note;
  confirmNoteEl.hidden = !note;
  const missingKcal = confirmState.items.some((i) => i.kcal === null);
  const effectiveWarning =
    warning
    || (missingKcal
      ? "That one couldn't be estimated — type the calories in yourself before saving."
      : "");
  confirmWarningEl.textContent = effectiveWarning;
  confirmWarningEl.hidden = !effectiveWarning;
  confirmErrorEl.hidden = true;

  confirmState.alt = alt;
  confirmAltBtn.hidden = !alt;
  if (alt) confirmAltBtn.textContent = alt.label;

  renderConfirmItems();
  confirmSheet.hidden = false;
  document.body.classList.add("sheet-open");
}

function normaliseConfirmItem(item) {
  return {
    label: item.label ?? "",
    kcal: item.kcal ?? null,
    protein: item.proteinG ?? item.protein ?? null,
    carbs: item.carbsG ?? item.carbs ?? null,
    fat: item.fatG ?? item.fat ?? null,
    quantity: item.quantity ?? 1,
    // Set only for packet items: per-100g figures plus the serving size, so
    // changing the grams rescales calories and macros off the real label
    // rather than an estimate.
    per100: item.per100 ?? null,
    grams: item.grams ?? null,
  };
}

function closeConfirmSheet() {
  confirmState = null;
  confirmSheet.hidden = true;
  confirmItemsEl.innerHTML = "";
  document.body.classList.remove("sheet-open");
}

/** Recalculates one packet row's figures from its serving size. */
function applyPer100(item) {
  if (!item.per100 || item.grams === null) return;
  const scale = (value) => (value === null || value === undefined ? null : Math.round((value * item.grams) / 100 * 10) / 10);
  item.kcal = item.per100.kcal === null ? null : Math.round((item.per100.kcal * item.grams) / 100);
  item.protein = scale(item.per100.protein);
  item.carbs = scale(item.per100.carbs);
  item.fat = scale(item.per100.fat);
}

function renderConfirmItems() {
  confirmItemsEl.innerHTML = "";
  // Macro fields would be pure clutter for someone tracking calories alone,
  // so they appear when macros are on or when there are figures to show.
  const anyMacros = confirmState.items.some((i) => i.protein !== null || i.carbs !== null || i.fat !== null);
  const showMacros = Boolean(currentUser?.macroTargets) || anyMacros;

  confirmState.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "confirm-item";

    // The inputs a serving-size change has to update in place. Populated as
    // they are built below; syncDerivedFields writes today's figures back
    // into them without touching the DOM the user is typing in.
    const derived = { kcal: null, protein: null, carbs: null, fat: null };
    function syncDerivedFields() {
      if (derived.kcal) derived.kcal.value = item.kcal ?? "";
      for (const key of ["protein", "carbs", "fat"]) {
        if (derived[key]) derived[key].value = item[key] ?? "";
      }
      renderConfirmTotal();
    }

    const top = document.createElement("div");
    top.className = "confirm-item-top";

    const labelField = document.createElement("label");
    labelField.className = "confirm-label-field";
    const labelCaption = document.createElement("span");
    labelCaption.textContent = "Item";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "confirm-label";
    labelInput.value = item.label;
    labelInput.addEventListener("input", () => {
      item.label = labelInput.value;
    });
    labelField.append(labelCaption, labelInput);

    const kcalField = document.createElement("label");
    kcalField.className = "confirm-kcal-field";
    const kcalCaption = document.createElement("span");
    kcalCaption.textContent = "kcal";
    const kcalInput = document.createElement("input");
    kcalInput.type = "number";
    kcalInput.min = "0";
    kcalInput.className = "confirm-kcal";
    kcalInput.value = item.kcal ?? "";
    kcalInput.addEventListener("input", () => {
      item.kcal = kcalInput.value === "" ? null : Number(kcalInput.value);
      renderConfirmTotal();
    });
    kcalField.append(kcalCaption, kcalInput);
    derived.kcal = kcalInput;

    top.append(labelField, kcalField);

    if (confirmState.items.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "confirm-remove";
      remove.setAttribute("aria-label", `Remove ${item.label || "this item"}`);
      remove.innerHTML = ICONS.x;
      remove.addEventListener("click", () => {
        confirmState.items.splice(index, 1);
        renderConfirmItems();
      });
      top.appendChild(remove);
    }

    row.appendChild(top);

    if (item.per100) {
      const servingRow = document.createElement("label");
      servingRow.className = "confirm-serving";
      const caption = document.createElement("span");
      caption.textContent = "Serving (g)";
      const gramsInput = document.createElement("input");
      gramsInput.type = "number";
      gramsInput.min = "1";
      gramsInput.step = "1";
      gramsInput.value = item.grams ?? "";
      // Writes into the sibling fields rather than re-rendering the list.
      // Rebuilding replaced the very input being typed into, so iOS closed
      // the keyboard after every digit — 250g took five attempts.
      gramsInput.addEventListener("input", () => {
        item.grams = gramsInput.value === "" ? null : Number(gramsInput.value);
        applyPer100(item);
        syncDerivedFields();
      });
      servingRow.append(caption, gramsInput);
      row.appendChild(servingRow);
    }

    if (showMacros) {
      const macroRow = document.createElement("div");
      macroRow.className = "confirm-macros";
      for (const key of ["protein", "carbs", "fat"]) {
        const field = document.createElement("label");
        field.className = "confirm-macro-field";
        const caption = document.createElement("span");
        caption.textContent = MACRO_LABELS[key];
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.placeholder = "g";
        input.value = item[key] ?? "";
        input.setAttribute("aria-label", `${MACRO_LABELS[key]} in grams`);
        input.addEventListener("input", () => {
          item[key] = input.value === "" ? null : Number(input.value);
          renderConfirmTotal();
        });
        derived[key] = input;
        field.append(caption, input);
        macroRow.appendChild(field);
      }
      row.appendChild(macroRow);
    }

    confirmItemsEl.appendChild(row);
  });

  renderConfirmTotal();
}

function renderConfirmTotal() {
  const items = confirmState?.items ?? [];
  const kcal = items.reduce((sum, i) => sum + (i.kcal ?? 0) * (i.quantity ?? 1), 0);
  const parts = [`${Math.round(kcal)} kcal`];
  if (currentUser?.macroTargets) {
    for (const key of ["protein", "carbs", "fat"]) {
      const total = items.reduce((sum, i) => sum + (i[key] ?? 0) * (i.quantity ?? 1), 0);
      if (total > 0) parts.push(`${MACRO_LABELS[key]} ${Math.round(total)}g`);
    }
  }
  const missing = items.some((i) => i.kcal === null);
  confirmTotalEl.textContent = `${items.length === 1 ? "Total" : `${items.length} items`}: ${parts.join(" · ")}` +
    (missing ? " — one item has no calories yet" : "");
}

confirmDiscardBtn.addEventListener("click", () => {
  closeConfirmSheet();
});

confirmAltBtn.addEventListener("click", () => {
  const alt = confirmState?.alt;
  closeConfirmSheet();
  alt?.run();
});

// Tapping the backdrop is the same as Discard — nothing was saved, so there's
// nothing to lose by closing it.
confirmSheet.addEventListener("click", (event) => {
  if (event.target === confirmSheet) closeConfirmSheet();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !confirmSheet.hidden) closeConfirmSheet();
});

confirmSaveBtn.addEventListener("click", async () => {
  if (!confirmState) return;
  const items = confirmState.items.filter((i) => i.label.trim().length > 0);
  if (items.length === 0) {
    confirmErrorEl.textContent = "Give at least one item a name, or discard this.";
    confirmErrorEl.hidden = false;
    return;
  }

  confirmSaveBtn.disabled = true;
  confirmSaveBtn.textContent = "Saving…";
  try {
    const res = await fetch("/api/entries/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          label: i.label.trim(),
          kcal: i.kcal === null ? null : Math.round(i.kcal),
          proteinG: i.protein,
          carbsG: i.carbs,
          fatG: i.fat,
          quantity: i.quantity,
        })),
        imageUrl: confirmState.imageUrl,
        rawInput: confirmState.rawInput,
        source: confirmState.source,
        lastWeek: confirmState.lastWeek,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save that — please try again.");
    }
    const created = await res.json();
    haptic();
    closeConfirmSheet();
    showToast(
      created.length === 1 ? "Saved to your diary" : `${created.length} items saved`,
      { actionLabel: "Undo", onAction: () => undoEntries(created.map((e) => e.id)) },
    );
    await refreshCurrentView();
  } catch (error) {
    confirmErrorEl.textContent = error.message;
    confirmErrorEl.hidden = false;
  } finally {
    confirmSaveBtn.disabled = false;
    confirmSaveBtn.textContent = "Log it";
  }
});

/** Opens the sheet for a scanned or searched packet. */
function openProductSheet(product) {
  const name = [product.brand, product.name].filter(Boolean).join(" ");

  // No calorie data on the packet means there is nothing to confirm yet —
  // send the name through the estimator so the sheet has real figures in it.
  if (product.kcalPer100g === null || product.kcalPer100g === undefined) {
    if (!name) {
      showToast("That barcode isn't in the food database — describe it instead.");
      return;
    }
    textInput.value = name;
    navTo("today");
    textInput.focus();
    showToast("Not in the food database — check the description and tap Log it.");
    return;
  }

  const grams = product.defaultServing ?? 100;
  const item = normaliseConfirmItem({
    label: name || "Scanned item",
    per100: {
      kcal: product.kcalPer100g,
      protein: product.macrosPer100g?.protein ?? null,
      carbs: product.macrosPer100g?.carbs ?? null,
      fat: product.macrosPer100g?.fat ?? null,
    },
    grams,
  });
  applyPer100(item);

  openConfirmSheet({
    items: [item],
    source: "database",
    sourceLabel: "From the packet",
    note: "Set the serving size — the figures follow it.",
    alt: product.barcode ? { label: "Scan again", run: openScanner } : null,
  });
}

// ── Toast ───────────────────────────────────────────────────────────────────
// Every save says so. The one-tap paths (a favourite, a saved meal, a repeat)
// don't get a confirm sheet — they were approved once already — so they get
// this instead, with an undo for the taps that were a mistake.

const toastEl = document.getElementById("toast");
const toastTextEl = document.getElementById("toast-text");
const toastActionBtn = document.getElementById("toast-action");
let toastTimer = null;
let toastAction = null;

function showToast(message, { actionLabel = null, onAction = null, duration = 5000 } = {}) {
  clearTimeout(toastTimer);
  toastTextEl.textContent = message;
  toastAction = onAction;
  toastActionBtn.hidden = !actionLabel;
  if (actionLabel) toastActionBtn.textContent = actionLabel;
  toastEl.hidden = false;
  // Next frame, so the transition runs from the hidden state rather than
  // being skipped because both states were set in one paint.
  requestAnimationFrame(() => toastEl.classList.add("toast--shown"));
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.classList.remove("toast--shown");
  toastAction = null;
  setTimeout(() => {
    if (!toastEl.classList.contains("toast--shown")) toastEl.hidden = true;
  }, 200);
}

toastActionBtn.addEventListener("click", async () => {
  const run = toastAction;
  hideToast();
  if (run) await run();
});

async function undoEntries(ids) {
  await Promise.all(ids.map((id) => fetch(`/api/entries/${id}`, { method: "DELETE" })));
  await refreshCurrentView();
}



// ── Food library ────────────────────────────────────────────────────────────
let foodSearchTimer = null;

function loadFoodLibraryScreen() {
  foodSearchInput.value = "";
  foodLibraryError.hidden = true;
  closeMealEditor();
  loadFoods("");
  loadMeals();
}

// The library's back arrow returns to Today, where the quick-add strip is —
// and meals or favourites may have changed while it was open, so that strip
// is rebuilt rather than showing a meal saved a moment ago as missing.
function leaveFoodLibrary() {
  loadQuickAdd();
  navTo("today");
}

async function loadFoods(query) {
  try {
    const res = await fetch(`/api/foods?q=${encodeURIComponent(query ?? "")}`);
    if (!res.ok) throw new Error();
    const foods = await res.json();
    renderFoodLibrary(foods);
  } catch {
    foodLibraryError.textContent = "Couldn't load your foods — please try again.";
    foodLibraryError.hidden = false;
  }
}

function renderFoodLibrary(foods) {
  const favorites = foods.filter((f) => f.favorite);
  foodFavoritesSection.hidden = favorites.length === 0;
  foodFavoritesList.innerHTML = "";
  for (const food of favorites) {
    foodFavoritesList.appendChild(renderFoodRow(food));
  }

  foodAllList.innerHTML = "";
  if (foods.length === 0) {
    foodAllList.innerHTML = '<p class="empty-state">No foods found.</p>';
    return;
  }
  for (const food of foods) {
    foodAllList.appendChild(renderFoodRow(food));
  }
}

function renderFoodRow(food) {
  const row = document.createElement("div");
  row.className = "food-row";

  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = "food-star";
  starBtn.innerHTML = food.favorite ? ICONS.starFilled : ICONS.starOutline;
  starBtn.setAttribute("aria-label", food.favorite ? "Remove from favourites" : "Add to favourites");
  starBtn.addEventListener("click", () => toggleFavorite(food));

  const info = document.createElement("div");
  info.className = "food-info";

  const labelEl = document.createElement("div");
  labelEl.className = "food-label";
  labelEl.textContent = food.label;

  const metaEl = document.createElement("div");
  metaEl.className = "food-meta";
  const lastDate = new Date(food.lastLoggedAt);
  const isToday = lastDate.toDateString() === new Date().toDateString();
  const countLabel = food.count === 1 ? "Logged once" : `Logged ${food.count}×`;
  const lastLabel = isToday ? "today" : dateFmt.format(lastDate);
  const kcalLabel = food.kcal !== null ? ` · ${food.kcal} kcal` : "";
  metaEl.textContent = `${countLabel} · last ${lastLabel}${kcalLabel}`;

  const tagsEl = document.createElement("div");
  tagsEl.className = "food-tags";
  for (const tag of food.tags) {
    const pill = document.createElement("span");
    pill.className = "food-tag-pill";
    pill.textContent = tag;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove tag ${tag}`);
    removeBtn.addEventListener("click", () => removeTag(food, tag));
    pill.appendChild(removeBtn);
    tagsEl.appendChild(pill);
  }
  const addTagBtn = document.createElement("button");
  addTagBtn.type = "button";
  addTagBtn.className = "food-tag-add";
  addTagBtn.textContent = "+ tag";
  addTagBtn.addEventListener("click", () => {
    if (tagsEl.querySelector(".food-tag-input")) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "food-tag-input";
    input.placeholder = "tag";
    input.maxLength = 30;
    let settled = false;
    const commit = async () => {
      if (settled) return;
      settled = true;
      const value = input.value.trim();
      if (value) await addTag(food, value);
      else loadFoods(foodSearchInput.value);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        settled = true;
        loadFoods(foodSearchInput.value);
      }
    });
    input.addEventListener("blur", commit);
    tagsEl.appendChild(input);
    input.focus();
  });
  tagsEl.appendChild(addTagBtn);

  info.append(labelEl, metaEl, tagsEl);

  const logBtn = document.createElement("button");
  logBtn.type = "button";
  logBtn.className = "food-log-btn";
  logBtn.textContent = "+Today";
  logBtn.addEventListener("click", () => logFood(food, logBtn));

  row.append(starBtn, info, logBtn);
  return row;
}

async function foodLibraryRequest(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      foodLibraryError.textContent = typeof err.error === "string" ? err.error : "Something went wrong — please try again.";
      foodLibraryError.hidden = false;
      return false;
    }
    foodLibraryError.hidden = true;
    return true;
  } catch {
    foodLibraryError.textContent = "Network error — please try again.";
    foodLibraryError.hidden = false;
    return false;
  }
}

async function toggleFavorite(food) {
  const ok = await foodLibraryRequest("/api/foods/favorite", { labelKey: food.labelKey, favorite: !food.favorite });
  if (ok) loadFoods(foodSearchInput.value);
}

async function addTag(food, tag) {
  const ok = await foodLibraryRequest("/api/foods/tags", { labelKey: food.labelKey, tag });
  if (ok) loadFoods(foodSearchInput.value);
}

async function removeTag(food, tag) {
  const ok = await foodLibraryRequest("/api/foods/tags/remove", { labelKey: food.labelKey, tag });
  if (ok) loadFoods(foodSearchInput.value);
}

async function logFood(food, btn) {
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const res = await fetch("/api/foods/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelKey: food.labelKey }),
    });
    if (res.ok) {
      const entry = await res.json();
      haptic();
      btn.textContent = "+Today";
      flashSaved(btn);
      showToast(`${food.label} logged`, { actionLabel: "Undo", onAction: () => undoEntries([entry.id]) });
      await refreshCurrentView();
      setTimeout(() => {
        btn.disabled = false;
      }, 1100);
    } else {
      btn.textContent = "+Today";
      btn.disabled = false;
    }
  } catch {
    btn.textContent = "+Today";
    btn.disabled = false;
  }
}


foodLibraryBack.addEventListener("click", leaveFoodLibrary);
foodSearchInput.addEventListener("input", () => {
  clearTimeout(foodSearchTimer);
  foodSearchTimer = setTimeout(() => loadFoods(foodSearchInput.value), 250);
});


scanBarcodeBtn.addEventListener("click", openScanner);
scanCloseBtn.addEventListener("click", stopScanner);

// ── Stats / weigh-ins ───────────────────────────────────────────────────────
let weighIns = [];

function todayDateValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function kgToDisplay(kg) {
  return useImperial ? +(kg * 2.20462).toFixed(1) : +kg.toFixed(1);
}

function displayToKg(value) {
  return useImperial ? +(value / 2.20462).toFixed(2) : +value;
}

function weightUnit() {
  return useImperial ? "lbs" : "kg";
}

function applyWeighinUnitFields() {
  weighinWeightLabel.textContent = `Weight (${weightUnit()})`;
  if (useImperial) {
    weighinWeight.min = "66";
    weighinWeight.max = "1540";
    weighinWeight.placeholder = "e.g. 210";
  } else {
    weighinWeight.min = "30";
    weighinWeight.max = "700";
    weighinWeight.placeholder = "e.g. 95";
  }
}

function switchStatsTab(name) {
  for (const [key, panel] of Object.entries(statsTabPanels)) panel.hidden = key !== name;
  statsTabBtns.forEach((btn) => btn.classList.toggle("stats-tab-btn--active", btn.dataset.statsTab === name));

  // A chart in a tab that was hidden has a 0×0 box and can't size or
  // animate itself correctly — re-render whichever chart just became
  // visible now that it actually has real layout dimensions.
  if (name === "weight") renderWeighinChart();
  if (name === "calories" && balanceTrendRaw) renderBalanceTrend(balanceTrendRaw);
}

statsTabBtns.forEach((btn) => btn.addEventListener("click", () => switchStatsTab(btn.dataset.statsTab)));

function loadStatsScreen() {
  weighinError.hidden = true;
  weighinDate.max = todayDateValue();
  weighinDate.value = todayDateValue();
  weighinWeight.value = "";
  applyWeighinUnitFields();
  switchStatsTab("weight");
  loadWeighIns();
  loadWhoopRecent();
  loadStatsSummary();
  loadInsights();
  loadBalanceTrend();
  loadWeeklyBreakdown();
  loadDeficitStreak();
  loadTdee();
  loadMeasurements();
  loadProgressPhotos();
  loadEatingWindow();
  loadMacroStats();
}


async function loadWeighIns() {
  try {
    const res = await fetch("/api/weigh-ins");
    if (!res.ok) throw new Error();
    weighIns = await res.json();
    renderStats();
  } catch {
    weighinError.textContent = "Couldn't load your weigh-ins — please try again.";
    weighinError.hidden = false;
  }
}

function renderStats() {
  applyWeighinUnitFields();
  renderWeighinSummary();
  renderWeighinChart();
  renderWeighinList();
}

function renderWeighinSummary() {
  if (weighIns.length === 0) {
    weighinSummary.hidden = true;
    return;
  }
  weighinSummary.hidden = false;

  const starting = weighIns[0].weightKg;
  const current = weighIns[weighIns.length - 1].weightKg;
  const changeKg = current - starting;

  weighinCurrent.textContent = `${kgToDisplay(current)} ${weightUnit()}`;
  weighinStart.textContent = `${kgToDisplay(starting)} ${weightUnit()}`;

  weighinChangeCell.classList.remove("balance-cell--loss", "balance-cell--gain");
  if (changeKg <= 0) {
    weighinChangeCell.classList.add("balance-cell--loss");
    weighinChange.textContent = `-${kgToDisplay(Math.abs(changeKg))} ${weightUnit()}`;
    weighinChangeCaption.textContent = "lost";
  } else {
    weighinChangeCell.classList.add("balance-cell--gain");
    weighinChange.textContent = `+${kgToDisplay(changeKg)} ${weightUnit()}`;
    weighinChangeCaption.textContent = "gained";
  }

  if (currentUser?.heightCm) {
    const heightM = currentUser.heightCm / 100;
    weighinBmiCell.hidden = false;
    weighinBmi.textContent = (current / (heightM * heightM)).toFixed(1);
  } else {
    weighinBmiCell.hidden = true;
  }
}

// ── Recovery, sleep & other stats ───────────────────────────────────────────
function formatSleepDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function loadWhoopRecent() {
  try {
    const res = await fetch("/api/whoop/recent?days=30");
    if (!res.ok) throw new Error();
    renderWhoopStats(await res.json());
  } catch {
    whoopStatsCard.hidden = true;
    whoopStatsPrompt.hidden = true;
  }
}

function renderWhoopStats(data) {
  const days = data.connected ? (data.days ?? []) : [];
  if (days.length === 0) {
    whoopStatsCard.hidden = true;
    whoopStatsPrompt.hidden = false;
    return;
  }
  whoopStatsPrompt.hidden = true;
  whoopStatsCard.hidden = false;

  const latestRecovery = [...days].reverse().find((d) => d.recoveryScore !== null);
  const latestSleep = [...days].reverse().find((d) => d.sleepMinutes !== null);

  statRecoveryHero.classList.remove("stat-hero--good", "stat-hero--fair", "stat-hero--poor");
  if (latestRecovery) {
    statRecovery.textContent = `${latestRecovery.recoveryScore}%`;
    const score = latestRecovery.recoveryScore;
    statRecoveryHero.classList.add(score >= 67 ? "stat-hero--good" : score >= 34 ? "stat-hero--fair" : "stat-hero--poor");
  } else {
    statRecovery.textContent = "—";
  }
  statSleep.textContent = latestSleep ? formatSleepDuration(latestSleep.sleepMinutes) : "—";

  const last7 = days.slice(-7);
  const recoveryValues = last7.filter((d) => d.recoveryScore !== null).map((d) => d.recoveryScore);
  const sleepValues = last7.filter((d) => d.sleepMinutes !== null).map((d) => d.sleepMinutes);
  if (recoveryValues.length && sleepValues.length) {
    const avgRecovery = Math.round(recoveryValues.reduce((a, b) => a + b, 0) / recoveryValues.length);
    const avgSleep = Math.round(sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length);
    whoopStatsAvg.textContent = `7-day avg: ${avgRecovery}% recovery · ${formatSleepDuration(avgSleep)} sleep`;
  } else {
    whoopStatsAvg.textContent = "";
  }
}

async function loadStatsSummary() {
  try {
    const res = await fetch("/api/stats/summary");
    if (!res.ok) throw new Error();
    renderStatsSummary(await res.json());
  } catch {
    statAvgKcal.textContent = "—";
    weighinPaceCell.hidden = true;
  }
}

/**
 * The Averages card. Every figure is either a real number or an em dash —
 * nothing is filled in with a zero that would read as a measurement.
 */
function renderAverages(averages, avgKcalPerDay) {
  const set = (el, value) => {
    el.textContent = value ?? "—";
  };
  const num = (value) => (value === null || value === undefined ? null : value.toLocaleString());

  averagesWindow.textContent = averages.windowDays ? `last ${averages.windowDays} days` : "";

  set(statAvgKcal, num(averages.kcalInPerDay7 ?? avgKcalPerDay));
  set(statAvgKcal28, num(averages.kcalInPerDay28));
  set(statAvgBurn, num(averages.kcalBurnedPerDay));

  if (averages.netKcalPerDay === null || averages.netKcalPerDay === undefined) {
    set(statAvgNet, null);
    statAvgNetCaption.textContent = "daily balance";
    statAvgNetCell.classList.remove("balance-cell--loss", "balance-cell--gain");
  } else {
    const net = averages.netKcalPerDay;
    // A deficit is the goal here, so it gets the positive colour.
    statAvgNet.textContent = `${net <= 0 ? "-" : "+"}${Math.abs(net).toLocaleString()}`;
    statAvgNetCaption.textContent = net <= 0 ? "deficit/day" : "surplus/day";
    statAvgNetCell.classList.toggle("balance-cell--loss", net <= 0);
    statAvgNetCell.classList.toggle("balance-cell--gain", net > 0);
  }

  if (averages.kgPerWeek === null || averages.kgPerWeek === undefined) {
    set(statAvgWeeklyChange, null);
    statAvgWeeklyChangeCaption.textContent = "per week";
  } else {
    const sign = averages.kgPerWeek <= 0 ? "-" : "+";
    statAvgWeeklyChange.textContent = `${sign}${kgToDisplay(Math.abs(averages.kgPerWeek))}`;
    statAvgWeeklyChangeCaption.textContent = `${weightUnit()}/week ${averages.kgPerWeek <= 0 ? "lost" : "gained"}`;
  }

  set(statAvgWorkouts, averages.workoutsPerWeek === null || averages.workoutsPerWeek === undefined ? null : String(averages.workoutsPerWeek));
  set(statAvgRecovery, averages.recovery === null || averages.recovery === undefined ? null : `${averages.recovery}%`);
  set(statAvgSleep, averages.sleepMinutes === null || averages.sleepMinutes === undefined ? null : formatSleep(averages.sleepMinutes));
}

function renderStatsSummary(data) {
  renderAverages(data.averages ?? {}, data.avgKcalPerDay);

  if (data.weightPace) {
    const { kgPerWeek, onTrack } = data.weightPace;
    weighinPaceCell.hidden = false;
    weighinPaceCell.classList.remove("balance-cell--loss", "balance-cell--gain");
    weighinPaceCell.classList.add(onTrack ? "balance-cell--loss" : "balance-cell--gain");
    const sign = kgPerWeek <= 0 ? "-" : "+";
    weighinPace.textContent = `${sign}${kgToDisplay(Math.abs(kgPerWeek))} ${weightUnit()}`;
    weighinPaceCaption.textContent = onTrack ? "on pace/wk" : "off pace/wk";
  } else {
    weighinPaceCell.hidden = true;
  }

  if (data.weightTrend) {
    const { kgPerWeek, projectedWeightKg4wk, currentWeightKg } = data.weightTrend;
    const verb = kgPerWeek <= 0 ? "losing" : "gaining";
    weighinTrendCaption.textContent =
      `At this pace (${verb} ${kgToDisplay(Math.abs(kgPerWeek))} ${weightUnit()}/wk), ` +
      `you'd be around ${kgToDisplay(projectedWeightKg4wk)} ${weightUnit()} in 4 weeks.`;

    weightHero.hidden = false;
    weightHeroValue.textContent = `${kgToDisplay(currentWeightKg)} ${weightUnit()}`;
    const last = weighIns.length ? weighIns[weighIns.length - 1] : null;
    weightHeroNote.textContent = last
      ? `Last weighed ${dateFmt.format(new Date(`${last.date}T00:00:00`))}`
      : "";
  } else {
    weighinTrendCaption.textContent = "";
    weightHero.hidden = true;
  }

  renderGoalProgress(data.goalProjection);
}

function renderGoalProgress(projection) {
  if (!projection) {
    goalProgress.hidden = true;
    return;
  }
  goalProgress.hidden = false;

  const { goalWeightKg, remainingKg, projectedDate, movingTowardGoal } = projection;
  const startKg = weighIns.length ? weighIns[0].weightKg : null;

  if (Math.abs(remainingKg) <= 0.05 || remainingKg <= 0) {
    goalProgressLabel.textContent = `Goal reached — ${kgToDisplay(goalWeightKg)} ${weightUnit()}`;
    goalProgressEta.textContent = "";
    goalProgressFill.style.width = "100%";
    return;
  }

  goalProgressLabel.textContent = `${kgToDisplay(remainingKg)} ${weightUnit()} to go`;
  goalProgressEta.textContent = movingTowardGoal && projectedDate
    ? dateFmt.format(new Date(`${projectedDate}T00:00:00`))
    : "no ETA at current pace";

  // Progress is measured from the first weigh-in on record to the goal, so
  // the bar reflects the whole journey rather than just the recent window.
  const totalKg = startKg !== null ? startKg - goalWeightKg : null;
  const pct = totalKg && totalKg > 0 ? Math.max(0, Math.min(100, ((totalKg - remainingKg) / totalKg) * 100)) : 0;
  goalProgressFill.style.width = `${pct.toFixed(1)}%`;
}

// ── Data import ──────────────────────────────────────────────────────────
importFile?.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  importStatus.hidden = false;
  importStatus.textContent = "Restoring…";
  try {
    const payload = JSON.parse(await file.text());
    const res = await fetch("/api/data/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Import failed.");
    const c = body.imported;
    importStatus.textContent =
      `Restored ${c.entries} food ${c.entries === 1 ? "entry" : "entries"}, ${c.weighIns} weigh-ins, ` +
      `${c.favorites} favourites.` + (c.skipped ? ` ${c.skipped} already present, skipped.` : "");
    await checkAuth();
    loadWeek();
  } catch (error) {
    importStatus.textContent = error instanceof Error ? error.message : "Couldn't read that file.";
  } finally {
    importFile.value = "";
  }
});

// ── Adaptive TDEE ────────────────────────────────────────────────────────
const TDEE_PENDING_COPY = {
  "no-weigh-ins": "Log a few weigh-ins and keep your food diary going — after about two weeks this works out what you actually burn each day.",
  "too-few-weigh-ins": "Nearly there — a couple more weigh-ins and this can work out what you actually burn each day.",
  "too-short-a-span": "Your weigh-ins don't span enough time yet. About two weeks between your first and latest lets this measure your real burn rate.",
  "not-enough-logging": "There are too many unlogged days in this stretch to work this out reliably. Keep logging and it'll appear.",
  "no-intake": "No food logged in this period yet — that's the other half of the sum.",
};

async function loadTdee() {
  try {
    const res = await fetch("/api/stats/tdee");
    if (!res.ok) throw new Error();
    renderTdee(await res.json());
  } catch {
    tdeeCard.hidden = true;
    tdeePendingCard.hidden = true;
  }
}

function renderTdee(data) {
  if (data.kcalPerDay === null) {
    tdeeCard.hidden = true;
    tdeePendingCard.hidden = false;
    tdeePendingText.textContent = TDEE_PENDING_COPY[data.reason] ?? TDEE_PENDING_COPY["no-weigh-ins"];
    return;
  }

  tdeePendingCard.hidden = true;
  tdeeCard.hidden = false;
  tdeeValue.textContent = data.kcalPerDay.toLocaleString();

  tdeeConfidence.textContent = `${data.confidence} confidence`;
  tdeeConfidence.className = `confidence-pill confidence-pill--${data.confidence}`;

  const pct = Math.round(data.completeness * 100);
  const direction = data.weightChangeKg <= 0 ? "lost" : "gained";
  tdeeExplain.textContent =
    `Worked out from what you actually ate and the ${kgToDisplay(Math.abs(data.weightChangeKg))} ${weightUnit()} you ` +
    `${direction} over ${data.windowDays} days (${pct}% of days logged). This is your real burn rate, not a formula.`;

  if (data.underLoggingKcalPerDay) {
    tdeeUnderlogging.hidden = false;
    tdeeUnderlogging.textContent =
      `WHOOP measures about ${data.whoopKcalPerDay.toLocaleString()} kcal/day burned — ` +
      `${data.underLoggingKcalPerDay.toLocaleString()} more than your food and weight change imply. ` +
      `That usually means some food isn't making it into the diary.`;
  } else {
    tdeeUnderlogging.hidden = true;
  }
}

// ── Tooltips ─────────────────────────────────────────────────────────────
// Tap/click-driven (not hover-only) so this works on the phone this app is
// mostly used on, not just with a mouse. Any element with data-tooltip and
// the has-tooltip class becomes a trigger.
let activeTooltipEl = null;
let activeTooltipTarget = null;

function hideTooltip() {
  if (activeTooltipEl) activeTooltipEl.remove();
  if (activeTooltipTarget) activeTooltipTarget.classList.remove("tooltip-active");
  activeTooltipEl = null;
  activeTooltipTarget = null;
}

/** Places an open tooltip against its target. Called on open and on scroll. */
function positionTooltip(tip, target) {
  const rect = target.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const anchorX = rect.left + rect.width / 2;

  // Prefer sitting above the point (so the tooltip never covers the data
  // you just tapped), flipping below only when there isn't room.
  let top = rect.top - tipRect.height - 10;
  let placement = "top";
  if (top < 8) {
    top = rect.bottom + 10;
    placement = "bottom";
  }
  tip.classList.toggle("app-tooltip--top", placement === "top");
  tip.classList.toggle("app-tooltip--bottom", placement === "bottom");
  tip.style.top = `${top}px`;

  // Keep the box on screen, then slide the caret back the other way by
  // however far the box had to move, so it still points at the point.
  const half = tipRect.width / 2;
  const clampedX = Math.min(Math.max(anchorX, half + 8), window.innerWidth - half - 8);
  tip.style.left = `${clampedX}px`;
  tip.style.setProperty("--caret-offset", `${anchorX - clampedX}px`);
}

function showTooltip(target) {
  const tip = document.createElement("div");
  tip.className = "app-tooltip";
  tip.textContent = target.dataset.tooltip;
  document.body.appendChild(tip);

  positionTooltip(tip, target);

  target.classList.add("tooltip-active");
  activeTooltipEl = tip;
  activeTooltipTarget = target;
}

document.addEventListener("click", (e) => {
  const trigger = e.target.closest(".has-tooltip");
  if (trigger) {
    e.stopPropagation();
    if (trigger === activeTooltipTarget) hideTooltip();
    else {
      hideTooltip();
      showTooltip(trigger);
    }
  } else {
    hideTooltip();
  }
});
// Scrolling used to dismiss the tooltip outright, which made it almost
// unusable on a phone: tapping a row near the bottom of the screen scrolls it
// into view, and the tooltip vanished before it could be read. It now follows
// its target instead, and only closes once that target has left the screen.
let tooltipFollowQueued = false;
window.addEventListener(
  "scroll",
  () => {
    if (!activeTooltipEl || !activeTooltipTarget || tooltipFollowQueued) return;
    tooltipFollowQueued = true;
    requestAnimationFrame(() => {
      tooltipFollowQueued = false;
      if (!activeTooltipEl || !activeTooltipTarget) return;
      const rect = activeTooltipTarget.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        hideTooltip();
        return;
      }
      positionTooltip(activeTooltipEl, activeTooltipTarget);
    });
  },
  true,
);

// ── Insights ─────────────────────────────────────────────────────────────
async function loadInsights() {
  try {
    const res = await fetch("/api/stats/insights");
    if (!res.ok) throw new Error();
    renderInsights(await res.json());
  } catch {
    insightsCard.hidden = true;
  }
}

function renderInsights(data) {
  const insights = data.insights ?? [];
  if (insights.length === 0) {
    insightsCard.hidden = true;
    return;
  }
  insightsCard.hidden = false;
  insightsList.innerHTML = "";
  for (const insight of insights) {
    const li = document.createElement("li");
    li.textContent = insight.text;
    insightsList.appendChild(li);
  }
}

// ── Calorie balance trend ───────────────────────────────────────────────
let balanceTrendRaw = null;
let balanceGranularity = "daily";

granularityBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    balanceGranularity = btn.dataset.granularity;
    granularityBtns.forEach((b) => b.classList.toggle("granularity-btn--active", b === btn));
    if (balanceTrendRaw) renderBalanceTrend(balanceTrendRaw);
  }),
);

async function loadBalanceTrend() {
  try {
    const res = await fetch("/api/stats/balance?days=90");
    if (!res.ok) throw new Error();
    balanceTrendRaw = await res.json();
    renderBalanceTrend(balanceTrendRaw);
  } catch {
    balanceTrendCard.hidden = true;
  }
}

// Groups a chronological daily array into consecutive 7-day buckets,
// averaging each field across whatever days in the bucket have data. The
// final bucket may hold fewer than 7 days if the range isn't a multiple of 7.
function bucketWeekly(days) {
  const buckets = [];
  for (let i = 0; i < days.length; i += 7) buckets.push(days.slice(i, i + 7));
  return buckets.map((chunk) => {
    const ins = chunk.map((d) => d.kcalIn).filter((v) => v !== null);
    const outs = chunk.map((d) => d.kcalOut).filter((v) => v !== null);
    const kcalIn = ins.length ? Math.round(ins.reduce((a, b) => a + b, 0) / ins.length) : null;
    const kcalOut = outs.length ? Math.round(outs.reduce((a, b) => a + b, 0) / outs.length) : null;
    return {
      date: chunk[0].date,
      endDate: chunk[chunk.length - 1].date,
      kcalIn,
      kcalOut,
      kcalOutSource: chunk.some((d) => d.kcalOutSource === "estimated") ? "estimated" : outs.length ? "whoop" : null,
      balance: kcalIn !== null && kcalOut !== null ? kcalIn - kcalOut : null,
    };
  });
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function balancePointTooltip(d) {
  const label =
    d.endDate && d.endDate !== d.date
      ? `${dateFmt.format(new Date(`${d.date}T00:00:00`))} – ${dateFmt.format(new Date(`${d.endDate}T00:00:00`))}`
      : dateFmt.format(new Date(`${d.date}T00:00:00`));
  const inText = d.kcalIn !== null ? `${d.kcalIn.toLocaleString()} in` : "no food logged";
  const outText =
    d.kcalOut !== null ? `${d.kcalOut.toLocaleString()} out${d.kcalOutSource === "estimated" ? " (estimated)" : ""}` : "no burn data";
  return `${label}: ${inText} · ${outText}`;
}

function renderBalanceTrend(data, animate = true) {
  const fullDays = data.days ?? [];
  const plotDays = (balanceGranularity === "weekly" ? bucketWeekly(fullDays) : fullDays.slice(-30)).filter(
    (d) => d.kcalIn !== null || d.kcalOut !== null,
  );
  if (plotDays.length < 2) {
    balanceTrendCard.hidden = true;
    balanceTrendChart.innerHTML = "";
    return;
  }
  balanceTrendCard.hidden = false;

  const box = measureChart(balanceTrendChart);
  if (!box) return; // hidden (e.g. a background Stats tab) — re-rendered when it becomes visible
  const { w, h } = box;

  const allValues = plotDays.flatMap((d) => [d.kcalIn, d.kcalOut]).filter((v) => v !== null);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues, min + 1);
  const range = max - min || 1;
  const padLeft = 42;
  const padRight = 10;
  const padY = 16;

  const xFor = (i) => padLeft + (i / (plotDays.length - 1)) * (w - padLeft - padRight);
  const yFor = (v) => h - padY - ((v - min) / range) * (h - padY * 2);

  const animateCls = animate ? " chart-animate" : "";

  function seriesPoints(field) {
    const pts = [];
    plotDays.forEach((d, i) => {
      if (d[field] === null) return;
      pts.push({ x: xFor(i), y: yFor(d[field]), day: d });
    });
    return pts;
  }
  const inPoints = seriesPoints("kcalIn");
  const outPoints = seriesPoints("kcalOut");

  const midValue = (min + max) / 2;
  const gridlines = [max, midValue, min]
    .map(
      (v) =>
        `<line x1="${padLeft}" y1="${yFor(v).toFixed(1)}" x2="${w - padRight}" y2="${yFor(v).toFixed(1)}" class="weighin-chart-grid" />`,
    )
    .join("");
  const labels = [max, midValue, min]
    .map(
      (v) =>
        `<text x="0" y="${(yFor(v) + 3).toFixed(1)}" class="weighin-chart-label">${Math.round(v).toLocaleString()}</text>`,
    )
    .join("");

  const dots = (pts, cls) => {
    const spec = dotSpecFor(pts.length);
    return pts
      .map(
        (p, i) =>
          `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${spec.r}" class="chart-dot ${cls}${spec.cls}${animateCls}"` +
          ` style="animation-delay:${(i * 10).toFixed(0)}ms" />`,
      )
      .join("");
  };

  // Tap targets sit on each real data point (not, as before, at the
  // midpoint between the two lines — which put the marker in empty space
  // between them and made the tooltip look unrelated to either value).
  // Both series show the same combined figures, so tapping either line's
  // dot for a given day reads the same, anchored where you actually tapped.
  const hitTargets = [...inPoints, ...outPoints]
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" class="chart-hit has-tooltip"` +
        ` tabindex="0" data-tooltip="${escapeAttr(balancePointTooltip(p.day))}" />`,
    )
    .join("");

  balanceTrendChart.innerHTML =
    `${gridlines}${labels}` +
    `<path d="${smoothPathD(inPoints)}" class="balance-trend-line balance-trend-line--in chart-draw" />` +
    `<path d="${smoothPathD(outPoints)}" class="balance-trend-line balance-trend-line--out chart-draw" />` +
    dots(inPoints, "chart-dot--in") +
    dots(outPoints, "chart-dot--out") +
    hitTargets;

  if (animate) animateChartIn(balanceTrendChart);
  // Reads the latest cached data at resize time (not the `data` this
  // particular render was called with) — watchChartResize only attaches
  // its observer once, so this closure must stay valid across every later
  // re-render, including ones triggered by a fresh fetch. animate is
  // false here: a resize (window resize, orientation change, even a
  // fullscreen-screenshot tool briefly resizing the viewport) should just
  // redraw the geometry at its new size, not replay the whole draw-in —
  // hiding a settled chart and redrawing it from scratch mid-resize would
  // be a jarring flash, not the animation this was meant to add.
  watchChartResize(balanceTrendChart, () => balanceTrendRaw && renderBalanceTrend(balanceTrendRaw, false));

  const recent = fullDays.filter((d) => d.balance !== null).slice(-7);
  if (recent.length) {
    const avgBalance = Math.round(recent.reduce((sum, d) => sum + d.balance, 0) / recent.length);
    const usedEstimate = recent.some((d) => d.kcalOutSource === "estimated");
    const verb = avgBalance <= 0 ? "deficit" : "surplus";
    balanceTrendCaption.textContent =
      `Averaging a ${Math.abs(avgBalance).toLocaleString()} kcal/day ${verb} over the last 7 days` +
      (usedEstimate ? " (partly estimated where WHOOP data wasn't available)." : ".");
  } else {
    balanceTrendCaption.textContent = "";
  }
}

// ── Weekly breakdown ─────────────────────────────────────────────────────
async function loadWeeklyBreakdown() {
  try {
    const res = await fetch("/api/stats/weekly-breakdown?weeks=12");
    if (!res.ok) throw new Error();
    renderWeeklyBreakdown(await res.json());
  } catch {
    breakdownWeightCard.hidden = true;
    breakdownCaloriesCard.hidden = true;
    breakdownRecoveryCard.hidden = true;
  }
}

function weekRangeLabel(week) {
  const start = dateFmt.format(new Date(`${week.weekStart}T00:00:00`));
  const end = dateFmt.format(new Date(`${week.weekEnd}T00:00:00`));
  return `${start} – ${end}`;
}

function weekOfCell(week) {
  const td = document.createElement("td");
  td.textContent = dateFmt.format(new Date(`${week.weekStart}T00:00:00`));
  return td;
}

// Applies the tooltip trigger to the whole row rather than just the date
// cell, so tapping anywhere on a row — not just its first column — shows
// the detail. Rows are otherwise inert (no click action), so this doesn't
// compete with anything else the row might do.
function makeRowTappable(row, week, extraDetail) {
  row.className = "has-tooltip";
  row.tabIndex = 0;
  row.dataset.tooltip = extraDetail ? `${weekRangeLabel(week)} · ${extraDetail}` : weekRangeLabel(week);
}

function renderWeeklyBreakdown(data) {
  const weeks = data.weeks ?? [];
  const hasAny = (field) => weeks.some((w) => w[field] !== null && w[field] !== undefined && w[field] !== 0);

  breakdownWeightCard.hidden = !hasAny("weightChangeKg");
  breakdownCaloriesCard.hidden = !(hasAny("avgKcalPerDay") || hasAny("workoutCount"));
  breakdownRecoveryCard.hidden = !(hasAny("avgRecovery") || hasAny("avgSleepMinutes"));

  breakdownWeightBody.innerHTML = "";
  breakdownCaloriesBody.innerHTML = "";
  breakdownRecoveryBody.innerHTML = "";

  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i];

    // ── Weight ──
    // A week nobody weighed in during has no change to report. The backend
    // sends null rather than 0 for exactly this reason, so the row is left
    // out entirely instead of claiming a confident 0.0kg.
    if (week.weightChangeKg !== null) {
      const weight = document.createElement("td");
      const sign = week.weightChangeKg <= 0 ? "-" : "+";
      weight.textContent = `${sign}${kgToDisplay(Math.abs(week.weightChangeKg))} ${weightUnit()}`;
      weight.className = week.weightChangeKg <= 0 ? "breakdown-loss" : "breakdown-gain";
      appendBreakdownRow(breakdownWeightBody, week, [weight], "weight");
    }

    // ── Calories ──
    const kcal = document.createElement("td");
    kcal.textContent = week.avgKcalPerDay !== null ? week.avgKcalPerDay.toLocaleString() : "—";
    const workouts = document.createElement("td");
    workouts.textContent = String(week.workoutCount);
    const kcalDetail =
      week.avgKcalPerDay !== null ? `Logged on ${formatDaysLogged(week.daysWithEntries)} of 7 days` : undefined;
    appendBreakdownRow(breakdownCaloriesBody, week, [kcal, workouts], "calories", kcalDetail);

    // ── Recovery ──
    const recovery = document.createElement("td");
    recovery.textContent = week.avgRecovery !== null ? `${week.avgRecovery}%` : "—";
    const sleep = document.createElement("td");
    sleep.textContent = week.avgSleepMinutes !== null ? formatSleep(week.avgSleepMinutes) : "—";
    appendBreakdownRow(breakdownRecoveryBody, week, [recovery, sleep], "recovery");
  }
}

/** "7h 12m" from a count of minutes. */
function formatSleep(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

/**
 * A match week's two boundary days count half each, so the total is often
 * fractional — 6.5, not 7. Shown to one decimal only when it needs one.
 */
function formatDaysLogged(days) {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

/**
 * One weekly row, with a disclosure button that pulls in the individual days
 * behind it. The days are fetched on first open and kept, so collapsing and
 * reopening doesn't re-request them.
 */
function appendBreakdownRow(tbody, week, cells, kind, extraDetail) {
  const row = document.createElement("tr");
  makeRowTappable(row, week, extraDetail);

  const toggleCell = document.createElement("td");
  toggleCell.className = "breakdown-toggle-cell";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "breakdown-toggle";
  toggle.innerHTML = ICONS.plus;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", `Show the days in the week of ${week.weekStart}`);
  toggleCell.appendChild(toggle);
  row.appendChild(toggleCell);

  row.appendChild(weekOfCell(week));
  for (const cell of cells) row.appendChild(cell);
  tbody.appendChild(row);

  // The detail lives in its own row spanning the full table, so the weekly
  // columns keep their alignment.
  const detailRow = document.createElement("tr");
  detailRow.className = "breakdown-detail-row";
  detailRow.hidden = true;
  const detailCell = document.createElement("td");
  detailCell.colSpan = cells.length + 2;
  detailRow.appendChild(detailCell);
  tbody.appendChild(detailRow);

  let loaded = false;
  toggle.addEventListener("click", async (event) => {
    // Otherwise the row's own tooltip fires on the same tap.
    event.stopPropagation();
    const opening = detailRow.hidden;
    detailRow.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    toggle.innerHTML = opening ? ICONS.minus : ICONS.plus;
    if (!opening || loaded) return;

    detailCell.innerHTML = '<p class="muted breakdown-detail-loading">Loading…</p>';
    try {
      const res = await fetch(`/api/stats/week-days?weekStart=${encodeURIComponent(week.weekStart)}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      renderWeekDays(detailCell, body.days ?? [], kind);
      loaded = true;
    } catch {
      detailCell.innerHTML = '<p class="muted breakdown-detail-loading">Couldn’t load those days.</p>';
    }
  });
}

/** Which column each table's drill-down shows, and how to render it. */
const WEEK_DAY_COLUMNS = {
  weight: {
    heading: "Weight",
    value: (day) => (day.weightKg !== null ? `${kgToDisplay(day.weightKg)} ${weightUnit()}` : null),
  },
  calories: {
    heading: "In / out",
    value: (day) => {
      if (day.kcalIn === null && day.kcalOut === null) return null;
      const inPart = day.kcalIn !== null ? `${day.kcalIn.toLocaleString()} in` : "— in";
      const outPart = day.kcalOut !== null ? `${day.kcalOut.toLocaleString()} out` : "— out";
      return `${inPart} · ${outPart}`;
    },
  },
  recovery: {
    heading: "Recovery / sleep",
    value: (day) => {
      if (day.recoveryScore === null && day.sleepMinutes === null) return null;
      const parts = [];
      if (day.recoveryScore !== null) parts.push(`${day.recoveryScore}%`);
      if (day.sleepMinutes !== null) parts.push(formatSleep(day.sleepMinutes));
      return parts.join(" · ");
    },
  },
};

function renderWeekDays(container, days, kind) {
  container.innerHTML = "";
  if (days.length === 0) {
    container.innerHTML = '<p class="muted breakdown-detail-loading">Nothing recorded for this week.</p>';
    return;
  }

  const column = WEEK_DAY_COLUMNS[kind] ?? WEEK_DAY_COLUMNS.calories;
  const list = document.createElement("div");
  list.className = "week-days";

  for (const day of days) {
    const rowEl = document.createElement("div");
    rowEl.className = "week-day";

    const label = document.createElement("span");
    label.className = "week-day-label";
    label.textContent = dayFmt.format(new Date(`${day.date}T12:00:00`));
    // The first and last days of a match week are shared with the weeks
    // either side of them, which is why they only count as half.
    if (day.partial) {
      const half = document.createElement("span");
      half.className = "week-day-half";
      half.textContent = "½";
      half.title = "The week starts and ends part-way through this day";
      label.appendChild(half);
    }

    const value = document.createElement("span");
    value.className = "week-day-value";
    const text = column.value(day);
    value.textContent = text ?? "—";
    if (text === null) value.classList.add("week-day-value--empty");

    rowEl.append(label, value);
    list.appendChild(rowEl);
  }

  container.appendChild(list);
}

// ── Shared line-chart rendering ─────────────────────────────────────────
// Used by both the weight trend and calorie balance charts. Two things
// separate a hand-rolled debug chart from one that reads as a native part
// of a considered app: the coordinate space actually matching the pixels
// it's drawn into (rather than a fixed viewBox stretched — and its text
// and stroke widths distorted — to fill whatever width the card happens
// to be), and curves instead of straight polyline segments between points.

const chartResizeObservers = new WeakMap();

/** The chart's real rendered size in CSS pixels, or null while hidden (e.g. a background Stats tab — 0×0 until it's shown). */
function measureChart(svgEl) {
  const rect = svgEl.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  return { w, h };
}

/** Re-runs `render` when the chart's container is resized (window resize, breakpoint change, orientation change) — debounced to one call per animation frame. */
function watchChartResize(svgEl, render) {
  let existing = chartResizeObservers.get(svgEl);
  if (existing) return; // already watching this element
  let pending = false;
  const ro = new ResizeObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  });
  ro.observe(svgEl);
  chartResizeObservers.set(svgEl, ro);
}

/**
 * A smooth curve through every point, as an SVG path `d` string, using
 * monotone cubic interpolation (Fritsch–Carlson).
 *
 * The obvious choice here is a Catmull-Rom spline, but its control points
 * are derived from the *neighbouring* points, so around a peak or trough
 * the curve bulges past the data — a line whose highest value is the top
 * gridline visibly arcs above that gridline, and past its own axis label.
 * That reads as the chart being misaligned with its own labels. Monotone
 * interpolation damps the tangent at every local extreme instead, so the
 * curve is guaranteed to stay within the data's own min/max.
 */
function smoothPathD(points) {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  // Secant slope of each segment.
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
  }

  // Tangent at each point: the average of its two neighbouring slopes,
  // but flattened to 0 wherever the direction reverses (a local peak or
  // trough) — that flattening is what prevents the overshoot.
  const m = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  m[n - 1] = slope[n - 2];

  // Fritsch–Carlson damping: keeps each segment monotone even where the
  // averaged tangent above would still be too steep for the segment.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * slope[i];
      m[i + 1] = tau * b * slope[i];
    }
  }

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = points[i].x + dx[i] / 3;
    const c1y = points[i].y + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1].x - dx[i] / 3;
    const c2y = points[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d +=
      ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)}` +
      ` ${points[i + 1].x.toFixed(1)},${points[i + 1].y.toFixed(1)}`;
  }
  return d;
}

/** Marker radius/treatment for a series of `count` points — see .chart-dot--dense. */
function dotSpecFor(count) {
  return count > 16 ? { r: 2, cls: " chart-dot--dense" } : { r: 3, cls: "" };
}

/** Draws every `.chart-draw` path on in, left to right, instead of popping in fully formed. */
function animateChartIn(svgEl) {
  svgEl.querySelectorAll(".chart-draw").forEach((path) => {
    const len = path.getTotalLength();
    if (!len) return;
    path.style.transition = "none";
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.getBoundingClientRect(); // flush the styles above before re-enabling the transition, so it actually animates
    path.style.transition = "stroke-dashoffset 0.65s cubic-bezier(0.4, 0, 0.2, 1)";
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = "0";
    });
  });
}

function weighinPointTooltip(entry) {
  const index = weighIns.indexOf(entry);
  const prev = index > 0 ? weighIns[index - 1] : null;
  const label = `${dateFmt.format(new Date(`${entry.date}T00:00:00`))}: ${kgToDisplay(entry.weightKg)} ${weightUnit()}`;
  if (!prev) return label;
  const deltaKg = entry.weightKg - prev.weightKg;
  const sign = deltaKg <= 0 ? "−" : "+";
  return `${label} · ${sign}${kgToDisplay(Math.abs(deltaKg))} ${weightUnit()}`;
}

function renderWeighinChart(animate = true) {
  if (weighIns.length < 2) {
    weighinChartCard.hidden = true;
    weighinChart.innerHTML = "";
    return;
  }
  weighinChartCard.hidden = false;

  const box = measureChart(weighinChart);
  if (!box) return; // hidden (e.g. a background Stats tab) — re-rendered when it becomes visible

  const { w, h } = box;
  const weights = weighIns.map((entry) => entry.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const padLeft = 42;
  const padRight = 10;
  const padY = 18;

  const yFor = (kg) => h - padY - ((kg - min) / range) * (h - padY * 2);
  const xFor = (i) => padLeft + (i / (weighIns.length - 1)) * (w - padLeft - padRight);

  const points = weighIns.map((entry, i) => ({ x: xFor(i), y: yFor(entry.weightKg) }));

  const animateCls = animate ? " chart-animate" : "";
  const gradientId = "weighin-area-gradient";
  const areaD = `${smoothPathD(points)} L${points[points.length - 1].x.toFixed(1)},${(h - padY).toFixed(1)} L${points[0].x.toFixed(1)},${(h - padY).toFixed(1)} Z`;
  const dotSpec = dotSpecFor(points.length);
  const circles = points
    .map(
      (p, i) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotSpec.r}" class="chart-dot chart-dot--weight${dotSpec.cls}${animateCls}" style="animation-delay:${(i * 10).toFixed(0)}ms" />`,
    )
    .join("");
  const hitTargets = points
    .map(
      (p, i) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" class="chart-hit has-tooltip"` +
        ` tabindex="0" data-tooltip="${escapeAttr(weighinPointTooltip(weighIns[i]))}" />`,
    )
    .join("");

  const midKg = (min + max) / 2;
  const gridlines = [max, midKg, min]
    .map(
      (v) =>
        `<line x1="${padLeft}" y1="${yFor(v).toFixed(1)}" x2="${w - padRight}" y2="${yFor(v).toFixed(1)}" class="weighin-chart-grid" />`,
    )
    .join("");
  const labels = [max, midKg, min]
    .map(
      (v) => `<text x="0" y="${(yFor(v) + 3).toFixed(1)}" class="weighin-chart-label">${kgToDisplay(v)}${weightUnit()}</text>`,
    )
    .join("");

  weighinChart.innerHTML =
    `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="var(--pitch)" stop-opacity="0.22" />` +
    `<stop offset="100%" stop-color="var(--pitch)" stop-opacity="0" /></linearGradient></defs>` +
    `${gridlines}${labels}` +
    `<path d="${areaD}" fill="url(#${gradientId})" class="chart-area${animateCls}" />` +
    `<path d="${smoothPathD(points)}" class="weighin-chart-line chart-draw" />` +
    circles +
    hitTargets;

  if (animate) animateChartIn(weighinChart);
  // animate:false — see the matching comment in renderBalanceTrend.
  watchChartResize(weighinChart, () => renderWeighinChart(false));
}

function renderWeighinList() {
  weighinList.innerHTML = "";
  if (weighIns.length === 0) {
    weighinList.innerHTML = '<p class="empty-state">No weigh-ins logged yet.</p>';
    return;
  }

  for (let ascIndex = weighIns.length - 1; ascIndex >= 0; ascIndex--) {
    const entry = weighIns[ascIndex];
    const prev = ascIndex > 0 ? weighIns[ascIndex - 1] : null;
    weighinList.appendChild(renderWeighinRow(entry, prev));
  }
}

function renderWeighinRow(entry, prev) {
  const row = document.createElement("div");
  row.className = "food-row weighin-row";

  const info = document.createElement("div");
  info.className = "food-info";

  const dateEl = document.createElement("div");
  dateEl.className = "food-label";
  dateEl.textContent = dateFmt.format(new Date(`${entry.date}T00:00:00`));

  const metaEl = document.createElement("div");
  metaEl.className = "food-meta";
  let metaText = `${kgToDisplay(entry.weightKg)} ${weightUnit()}`;
  if (prev) {
    const deltaKg = entry.weightKg - prev.weightKg;
    const sign = deltaKg <= 0 ? "-" : "+";
    metaText += ` · ${sign}${kgToDisplay(Math.abs(deltaKg))} ${weightUnit()}`;
  }
  metaEl.textContent = metaText;

  info.append(dateEl, metaEl);

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "food-log-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => {
    weighinDate.value = entry.date;
    weighinWeight.value = kgToDisplay(entry.weightKg);
    weighinWeight.focus();
  });

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "exercise-del weighin-del";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => deleteWeighIn(entry.date));

  row.append(info, editBtn, delBtn);
  return row;
}

async function deleteWeighIn(date) {
  try {
    const res = await fetch(`/api/weigh-ins/${encodeURIComponent(date)}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    await loadWeighIns();
    await loadStatsSummary();
  } catch {
    weighinError.textContent = "Couldn't delete that entry — please try again.";
    weighinError.hidden = false;
  }
}

weighinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  weighinError.hidden = true;

  const date = weighinDate.value;
  const rawWeight = weighinWeight.value === "" ? null : Number(weighinWeight.value);
  if (!date || rawWeight === null || Number.isNaN(rawWeight)) {
    weighinError.textContent = "Enter a date and weight.";
    weighinError.hidden = false;
    return;
  }

  weighinSave.disabled = true;
  try {
    const payload = { date, weightKg: displayToKg(rawWeight) };
    let res;
    try {
      res = await fetch("/api/weigh-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Scales live in bathrooms, which is where signal goes to die.
      if (!isNetworkFailure(error)) throw error;
      await enqueue({ kind: "weighIn", payload });
      weighinDate.value = todayDateValue();
      weighinWeight.value = "";
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save that weigh-in.");
    }
    weighinDate.value = todayDateValue();
    weighinWeight.value = "";
    await loadWeighIns();
    // Pace-vs-goal depends on weigh-in data too, so it needs refreshing
    // alongside the list rather than only once when the screen opens.
    await loadStatsSummary();
  } catch (error) {
    weighinError.textContent = error.message;
    weighinError.hidden = false;
  } finally {
    weighinSave.disabled = false;
  }
});

statsBack.addEventListener("click", () => navTo("today"));

// ── Bottom tab bar ──────────────────────────────────────────────────────────
// One function owns which screen is showing, rather than each screen's own
// open/close pair deciding independently. With five destinations that's the
// difference between "hide the other four" written once and written five
// times — and it's what stopped the screens ever being visible at once.
const TAB_SCREENS = {
  today: () => todayScreen,
  week: () => appShell,
  "food-library": () => foodLibraryScreen,
  stats: () => statsScreen,
  settings: () => settingsScreen,
};

let currentTab = "today";

function navTo(target) {
  if (!TAB_SCREENS[target]) return;

  // The weekly review is a detail view of the week rather than a tab of its
  // own, so navigating anywhere closes it.
  reviewScreen.hidden = true;

  for (const [name, screenFor] of Object.entries(TAB_SCREENS)) {
    screenFor().hidden = name !== target;
  }
  for (const btn of document.querySelectorAll(".tab-btn")) {
    const active = btn.dataset.nav === target;
    btn.classList.toggle("tab-btn--active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  }

  const previous = currentTab;
  currentTab = target;
  tabBar.hidden = false;

  // Each tab refreshes as you arrive. Cheap at this size, and it means food
  // logged on Today shows in the week the moment you switch rather than
  // leaving a stale total behind.
  // Arriving at the tab always lands on today; the arrows are for stepping
  // back from there, not a place you get stuck after switching tabs.
  if (target === "today") {
    if (previous !== "today") todayViewDate = null;
    loadToday();
  } else if (target === "week") loadWeek();
  else if (target === "food-library") loadFoodLibraryScreen();
  else if (target === "stats") loadStatsScreen();
  else if (target === "settings") loadSettingsScreen();

  // A tab arrived at halfway down reads as a broken page.
  window.scrollTo({ top: 0, behavior: "auto" });
}

for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => {
    haptic();
    navTo(btn.dataset.nav);
  });
}

// ── Where a calorie figure came from ────────────────────────────────────────
// Entry.source (see prisma/schema.prisma) records whether a number was
// estimated, looked up, or typed. Only a database-backed figure is marked:
// almost everything here is AI-estimated, so badging that said nothing while
// putting a label on nearly every row.
const SOURCE_BADGES = {
  database: { text: "✓", cls: "entry-source--verified", title: "From Open Food Facts nutrition data" },
};

function sourceBadgeFor(entry) {
  const spec = SOURCE_BADGES[entry.source];
  if (!spec || entry.kcal === null) return null;
  const badge = document.createElement("span");
  badge.className = `entry-source ${spec.cls}`;
  badge.textContent = spec.text;
  badge.title = spec.title;
  return badge;
}

// ── Quick add ───────────────────────────────────────────────────────────────
// The fastest path to a logged meal: saved meals and the foods logged most
// often, one tap each, above the form rather than two screens away.
const quickAddCard = document.getElementById("quick-add");
const quickAddChips = document.getElementById("quick-add-chips");
const quickAddError = document.getElementById("quick-add-error");
const quickAddManage = document.getElementById("quick-add-manage");
const quickAddToggle = document.getElementById("quick-add-toggle");
const quickAddLogBtn = document.getElementById("quick-add-log");
const quickAddHint = document.getElementById("quick-add-hint");

// What's been picked but not yet logged, keyed so the same chip can't be
// selected twice. Tapping a chip used to save it there and then, which left
// no way to tell an added item from an un-added one — and made it easy to add
// something twice by tapping again, then reach for the Log button underneath
// and add it a third time. Selecting is now free; only the button writes.
const quickAddSelection = new Map();

// The panel stays shut until asked for — it was competing with the thing
// people came to the screen to do, which is type what they ate.
function setQuickAddOpen(open) {
  quickAddCard.hidden = !open;
  quickAddToggle.setAttribute("aria-expanded", String(open));
}

quickAddToggle.addEventListener("click", () => setQuickAddOpen(quickAddCard.hidden));

const QUICK_ADD_FOODS = 6;

// Logging refreshes the Today screen, which rebuilds this strip — and a chip
// that gets replaced mid-animation never shows its tick. So while a flash is
// playing the rebuild waits, then runs once. (It also stops the chips
// reshuffling into their new most-used order under the user's finger.)
let quickAddFlashUntil = 0;
let quickAddRebuildTimer = null;

async function loadQuickAdd() {
  const wait = quickAddFlashUntil - Date.now();
  if (wait > 0) {
    clearTimeout(quickAddRebuildTimer);
    quickAddRebuildTimer = setTimeout(loadQuickAdd, wait + 50);
    return;
  }
  try {
    const [mealsRes, foodsRes] = await Promise.all([fetch("/api/meals"), fetch("/api/foods")]);
    if (!mealsRes.ok || !foodsRes.ok) throw new Error();
    const meals = await mealsRes.json();
    const foods = await foodsRes.json();
    renderQuickAdd(meals, foods);
  } catch {
    // A failed quick-add strip shouldn't shout — the form below still works.
    setQuickAddOpen(false);
    quickAddToggle.hidden = true;
  }
}

function renderQuickAdd(meals, foods) {
  quickAddChips.innerHTML = "";
  quickAddError.hidden = true;
  // The old chips are gone, so anything selected on them is too.
  quickAddSelection.clear();
  renderQuickAddLogButton();

  // Favourites first, then whatever has been logged most — a food starred on
  // purpose is a stronger signal than one that merely recurs.
  const byUse = [...foods].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.count - a.count;
  });
  const topFoods = byUse.slice(0, QUICK_ADD_FOODS);

  for (const meal of meals) {
    quickAddChips.appendChild(
      quickChip({
        key: `meal:${meal.id}`,
        label: meal.name,
        sub: meal.kind === "recipe" ? portionSubtitle(meal) : `${meal.items.length} items`,
        kind: "meal",
        log: () => logSavedMeal(meal),
      }),
    );
  }

  for (const food of topFoods) {
    quickAddChips.appendChild(
      quickChip({
        key: `food:${food.labelKey}`,
        label: food.label,
        sub: food.kcal !== null ? `${food.kcal} kcal` : null,
        kind: "food",
        favorite: food.favorite,
        log: () => quickLogFood(food),
      }),
    );
  }

  // Nothing to add again yet means no button at all, rather than a button
  // that opens an empty panel.
  const hasChips = quickAddChips.childElementCount > 0;
  quickAddToggle.hidden = !hasChips;
  if (!hasChips) setQuickAddOpen(false);
}

function portionSubtitle(meal) {
  return meal.kcalPerServing !== null ? `${meal.kcalPerServing} kcal / portion` : "recipe";
}

function quickChip({ key, label, sub, kind, favorite, log }) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `quick-chip quick-chip--${kind}`;
  chip.setAttribute("aria-pressed", "false");

  if (favorite) {
    const star = document.createElement("span");
    star.className = "quick-chip-star";
    star.innerHTML = ICONS.starFilled;
    chip.appendChild(star);
  }

  const text = document.createElement("span");
  text.className = "quick-chip-text";
  const main = document.createElement("span");
  main.className = "quick-chip-label";
  main.textContent = label;
  text.appendChild(main);
  if (sub) {
    const meta = document.createElement("span");
    meta.className = "quick-chip-sub";
    meta.textContent = sub;
    text.appendChild(meta);
  }
  chip.appendChild(text);

  chip.addEventListener("click", () => {
    if (chip.disabled) return;
    if (quickAddSelection.has(key)) {
      quickAddSelection.delete(key);
      chip.classList.remove("quick-chip--selected");
      chip.setAttribute("aria-pressed", "false");
    } else {
      quickAddSelection.set(key, { label, log, chip });
      chip.classList.add("quick-chip--selected");
      chip.setAttribute("aria-pressed", "true");
      haptic();
    }
    renderQuickAddLogButton();
  });
  return chip;
}

function renderQuickAddLogButton() {
  const count = quickAddSelection.size;
  quickAddLogBtn.hidden = count === 0;
  quickAddHint.hidden = count > 0;
  quickAddLogBtn.textContent = count === 1 ? "Log 1 item" : `Log ${count} items`;
}

function clearQuickAddSelection() {
  for (const { chip } of quickAddSelection.values()) {
    chip.classList.remove("quick-chip--selected");
    chip.setAttribute("aria-pressed", "false");
  }
  quickAddSelection.clear();
  renderQuickAddLogButton();
}

/**
 * Plays a green sweep-and-tick over a button that has just saved something.
 * The confirmation happens on the control you pressed, so there's no hunting
 * around the screen for whether the tap did anything.
 */
function flashSaved(el) {
  if (!el.querySelector(".saved-tick")) {
    const tick = document.createElement("span");
    tick.className = "saved-tick";
    tick.setAttribute("aria-hidden", "true");
    tick.innerHTML = ICONS.check;
    el.appendChild(tick);
  }
  el.classList.remove("is-saved");
  // Forces a reflow so replaying the flash on the same element restarts the
  // animation instead of being ignored as "already in that state".
  void el.offsetWidth;
  el.classList.add("is-saved");
  setTimeout(() => el.classList.remove("is-saved"), 1100);
}

quickAddLogBtn.addEventListener("click", async () => {
  const picked = [...quickAddSelection.values()];
  if (picked.length === 0) return;

  quickAddLogBtn.disabled = true;
  quickAddLogBtn.textContent = "Logging…";
  quickAddError.hidden = true;

  const savedIds = [];
  const failed = [];
  for (const item of picked) {
    try {
      const ids = await item.log();
      // A cancelled portions prompt returns null — not a failure, just a
      // change of mind, so it leaves the chip selected and says nothing.
      if (ids === null) continue;
      savedIds.push(...ids);
      quickAddFlashUntil = Date.now() + 1100;
      flashSaved(item.chip);
      item.chip.classList.remove("quick-chip--selected");
      item.chip.setAttribute("aria-pressed", "false");
      quickAddSelection.delete([...quickAddSelection.keys()].find((k) => quickAddSelection.get(k) === item));
    } catch {
      failed.push(item.label);
    }
  }

  quickAddLogBtn.disabled = false;
  renderQuickAddLogButton();

  if (failed.length > 0) {
    showQuickAddError(`Couldn't log ${listToSentence(failed)} — please try again.`);
  }
  if (savedIds.length > 0) {
    haptic();
    showToast(savedIds.length === 1 ? "Logged" : `${savedIds.length} items logged`, {
      actionLabel: "Undo",
      onAction: () => undoEntries(savedIds),
    });
    await refreshCurrentView();
  }
});

function showQuickAddError(message) {
  quickAddError.textContent = message;
  quickAddError.hidden = false;
}

/** Writes one repeat food. Returns the new entry's id so it can be undone. */
async function quickLogFood(food) {
  const res = await fetch("/api/foods/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labelKey: food.labelKey }),
  });
  if (!res.ok) throw new Error("log failed");
  const entry = await res.json();
  return [entry.id];
}

// A recipe needs to know how much was eaten before it can be logged; a
// template is the whole thing by definition, so it goes straight in.
async function logSavedMeal(meal) {
  let servings = 1;
  if (meal.kind === "recipe") {
    const answer = window.prompt(`How many portions of ${meal.name}?`, "1");
    if (answer === null) return null;
    servings = Number(answer);
    if (!Number.isFinite(servings) || servings <= 0) {
      showQuickAddError("Enter a number of portions greater than zero.");
      return null;
    }
  }
  const res = await fetch(`/api/meals/${meal.id}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servings }),
  });
  if (!res.ok) throw new Error("log failed");
  const created = await res.json();
  return created.map((e) => e.id);
}

quickAddManage.addEventListener("click", () => {
  setQuickAddOpen(false);
  navTo("food-library");
});

// ── Saved meals & recipes (Food Library screen) ─────────────────────────────
const mealsSection = document.getElementById("meals-section");
const mealListEl = document.getElementById("meal-list");
const mealNewBtn = document.getElementById("meal-new-btn");
const mealEditor = document.getElementById("meal-editor");
const mealNameInput = document.getElementById("meal-name");
const mealKindTemplateBtn = document.getElementById("meal-kind-template");
const mealKindRecipeBtn = document.getElementById("meal-kind-recipe");
const mealKindNote = document.getElementById("meal-kind-note");
const mealServingsRow = document.getElementById("meal-servings-row");
const mealServingsInput = document.getElementById("meal-servings");
const mealItemsEl = document.getElementById("meal-items");
const mealAddItemBtn = document.getElementById("meal-add-item");
const mealCancelBtn = document.getElementById("meal-cancel");
const mealSaveBtn = document.getElementById("meal-save");
const mealEditorError = document.getElementById("meal-editor-error");

// null while creating, the meal's id while editing an existing one.
let editingMealId = null;
let editorKind = "template";

async function loadMeals() {
  try {
    const res = await fetch("/api/meals");
    if (!res.ok) throw new Error();
    renderMeals(await res.json());
  } catch {
    mealListEl.innerHTML = '<p class="empty-state">Couldn’t load your meals.</p>';
  }
}

function renderMeals(meals) {
  mealListEl.innerHTML = "";
  if (meals.length === 0) {
    mealListEl.innerHTML =
      '<p class="empty-state">No saved meals yet — save one to log it in a single tap.</p>';
    return;
  }
  for (const meal of meals) mealListEl.appendChild(renderMealRow(meal));
}

function renderMealRow(meal) {
  const row = document.createElement("div");
  row.className = "meal-row";

  const info = document.createElement("div");
  info.className = "meal-info";

  const name = document.createElement("div");
  name.className = "meal-name";
  name.textContent = meal.name;
  const kindPill = document.createElement("span");
  kindPill.className = `meal-kind-pill meal-kind-pill--${meal.kind}`;
  kindPill.textContent = meal.kind === "recipe" ? "Recipe" : "Meal";
  name.appendChild(kindPill);

  const meta = document.createElement("div");
  meta.className = "meal-meta";
  const itemLabel = meal.items.length === 1 ? "1 item" : `${meal.items.length} items`;
  const kcalLabel =
    meal.kind === "recipe"
      ? meal.kcalPerServing !== null
        ? ` · ${meal.kcalPerServing} kcal per portion · makes ${meal.servings}`
        : ` · makes ${meal.servings}`
      : meal.totalKcal !== null
        ? ` · ${meal.totalKcal} kcal`
        : "";
  meta.textContent = itemLabel + kcalLabel;

  const itemsLine = document.createElement("div");
  itemsLine.className = "meal-items-line";
  itemsLine.textContent = meal.items.map((i) => i.label).join(", ");

  info.append(name, meta, itemsLine);

  const actions = document.createElement("div");
  actions.className = "meal-actions";
  const logBtn = document.createElement("button");
  logBtn.type = "button";
  logBtn.textContent = "+Today";
  logBtn.addEventListener("click", async () => {
    logBtn.disabled = true;
    try {
      const ids = await logSavedMeal(meal);
      if (ids) {
        haptic();
        flashSaved(logBtn);
        showToast(`${meal.name} logged`, { actionLabel: "Undo", onAction: () => undoEntries(ids) });
        await refreshCurrentView();
      }
    } catch {
      foodLibraryError.textContent = `Couldn't log ${meal.name} — please try again.`;
      foodLibraryError.hidden = false;
    } finally {
      logBtn.disabled = false;
    }
  });
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openMealEditor(meal));
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.innerHTML = ICONS.x;
  delBtn.setAttribute("aria-label", `Delete ${meal.name}`);
  delBtn.addEventListener("click", () => deleteMeal(meal));
  actions.append(logBtn, editBtn, delBtn);

  row.append(info, actions);
  return row;
}

async function deleteMeal(meal) {
  if (!window.confirm(`Delete "${meal.name}"? Entries already logged from it stay in your diary.`)) return;
  try {
    const res = await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    await loadMeals();
  } catch {
    mealEditorError.textContent = "Couldn't delete that meal.";
    mealEditorError.hidden = false;
  }
}

function setEditorKind(kind) {
  editorKind = kind;
  const isRecipe = kind === "recipe";
  mealKindRecipeBtn.classList.toggle("meal-kind-btn--active", isRecipe);
  mealKindTemplateBtn.classList.toggle("meal-kind-btn--active", !isRecipe);
  mealServingsRow.hidden = !isRecipe;
  mealKindNote.textContent = isRecipe
    ? "A recipe is cooked once and eaten over several portions — log just the portion you ate."
    : "A meal is eaten in one go and logs each item separately.";
}

function addMealItemRow(item = { label: "", kcal: null }) {
  const row = document.createElement("div");
  row.className = "meal-item-row";

  const label = document.createElement("input");
  label.type = "text";
  label.className = "meal-item-label";
  label.placeholder = "e.g. Porridge with banana";
  label.maxLength = 200;
  label.value = item.label;

  const kcal = document.createElement("input");
  kcal.type = "number";
  kcal.className = "meal-item-kcal";
  kcal.placeholder = "kcal";
  kcal.min = "0";
  kcal.value = item.kcal ?? "";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "meal-item-remove";
  remove.innerHTML = ICONS.x;
  remove.setAttribute("aria-label", "Remove item");
  remove.addEventListener("click", () => {
    row.remove();
    // Always leave one row so the editor never looks broken.
    if (mealItemsEl.childElementCount === 0) addMealItemRow();
  });

  row.append(label, kcal, remove);
  mealItemsEl.appendChild(row);
  return label;
}

function openMealEditor(meal = null) {
  editingMealId = meal?.id ?? null;
  mealEditor.hidden = false;
  mealEditorError.hidden = true;
  mealNameInput.value = meal?.name ?? "";
  mealServingsInput.value = meal?.servings ?? 4;
  setEditorKind(meal?.kind ?? "template");

  mealItemsEl.innerHTML = "";
  const items = meal?.items?.length ? meal.items : [{ label: "", kcal: null }];
  for (const item of items) addMealItemRow(item);

  mealSaveBtn.textContent = meal ? "Save changes" : "Save meal";
  mealNameInput.focus();
  mealEditor.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeMealEditor() {
  mealEditor.hidden = true;
  editingMealId = null;
  mealEditorError.hidden = true;
}

mealNewBtn.addEventListener("click", () => {
  if (mealEditor.hidden) openMealEditor();
  else closeMealEditor();
});
mealCancelBtn.addEventListener("click", closeMealEditor);
mealAddItemBtn.addEventListener("click", () => addMealItemRow().focus());
mealKindTemplateBtn.addEventListener("click", () => setEditorKind("template"));
mealKindRecipeBtn.addEventListener("click", () => setEditorKind("recipe"));

mealEditor.addEventListener("submit", async (event) => {
  event.preventDefault();
  mealEditorError.hidden = true;

  const name = mealNameInput.value.trim();
  if (!name) {
    mealEditorError.textContent = "Give the meal a name.";
    mealEditorError.hidden = false;
    return;
  }

  const items = [];
  for (const row of mealItemsEl.querySelectorAll(".meal-item-row")) {
    const label = row.querySelector(".meal-item-label").value.trim();
    if (!label) continue;
    const raw = row.querySelector(".meal-item-kcal").value.trim();
    items.push({ label, kcal: raw === "" ? null : Math.round(Number(raw)) });
  }
  if (items.length === 0) {
    mealEditorError.textContent = "Add at least one item.";
    mealEditorError.hidden = false;
    return;
  }
  if (items.some((i) => i.kcal !== null && (!Number.isFinite(i.kcal) || i.kcal < 0))) {
    mealEditorError.textContent = "Calories must be a positive number, or left blank.";
    mealEditorError.hidden = false;
    return;
  }

  const servings = editorKind === "recipe" ? Number(mealServingsInput.value) : 1;
  if (editorKind === "recipe" && (!Number.isFinite(servings) || servings <= 0)) {
    mealEditorError.textContent = "A recipe has to make at least one portion.";
    mealEditorError.hidden = false;
    return;
  }

  const payload = { name, kind: editorKind, servings, items };
  mealSaveBtn.disabled = true;
  try {
    const res = await fetch(editingMealId ? `/api/meals/${editingMealId}` : "/api/meals", {
      method: editingMealId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save that meal.");
    }
    closeMealEditor();
    await loadMeals();
  } catch (error) {
    mealEditorError.textContent = error.message;
    mealEditorError.hidden = false;
  } finally {
    mealSaveBtn.disabled = false;
  }
});

// ── Open Food Facts text search ─────────────────────────────────────────────
// Runs in the browser, like the barcode lookup above it, so it goes straight
// to Open Food Facts rather than through this app's server.
const foodSearchBtn = document.getElementById("food-search-btn");
const foodSearchCard = document.getElementById("food-search-card");
const foodSearchClose = document.getElementById("food-search-close");
const foodSearchQuery = document.getElementById("food-search-query");
const foodSearchStatus = document.getElementById("food-search-status");
const foodSearchResults = document.getElementById("food-search-results");

let offSearchTimer = null;
// Bumped on every keystroke so a slow earlier response can't overwrite the
// results for what's actually in the box now.
let offSearchSeq = 0;

foodSearchBtn.addEventListener("click", () => {
  const opening = foodSearchCard.hidden;
  foodSearchCard.hidden = !opening;
  if (opening) {
    foodSearchQuery.value = textInput.value.trim();
    foodSearchResults.innerHTML = "";
    foodSearchStatus.hidden = true;
    foodSearchQuery.focus();
    if (foodSearchQuery.value) runOffSearch(foodSearchQuery.value);
  }
});

foodSearchClose.addEventListener("click", () => {
  foodSearchCard.hidden = true;
});

foodSearchQuery.addEventListener("input", () => {
  clearTimeout(offSearchTimer);
  const q = foodSearchQuery.value.trim();
  if (q.length < 3) {
    foodSearchResults.innerHTML = "";
    foodSearchStatus.hidden = true;
    return;
  }
  // Open Food Facts asks callers not to hammer its search endpoint, so this
  // waits for a pause in typing rather than firing per keystroke.
  offSearchTimer = setTimeout(() => runOffSearch(q), 400);
});

async function runOffSearch(query) {
  const seq = ++offSearchSeq;
  foodSearchStatus.textContent = "Searching…";
  foodSearchStatus.hidden = false;
  try {
    const url =
      "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=15" +
      `&fields=code,product_name,brands,nutriments,serving_quantity&search_terms=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (seq !== offSearchSeq) return;

    const products = (data.products ?? [])
      .map((p) => ({
        barcode: p.code ?? null,
        name: p.product_name || null,
        brand: p.brands || null,
        kcalPer100g:
          p.nutriments?.["energy-kcal_100g"] !== undefined
            ? Number(p.nutriments["energy-kcal_100g"])
            : null,
        defaultServing: p.serving_quantity ? Math.round(Number(p.serving_quantity)) : null,
      }))
      // A result with no name or no calories can't be logged, so showing it
      // would only waste a tap.
      .filter((p) => p.name && p.kcalPer100g !== null && Number.isFinite(p.kcalPer100g));

    renderOffResults(products, query);
  } catch {
    if (seq !== offSearchSeq) return;
    foodSearchStatus.textContent = "Couldn't reach the food database — describe it instead and it'll be estimated.";
    foodSearchStatus.hidden = false;
    foodSearchResults.innerHTML = "";
  }
}

function renderOffResults(products, query) {
  foodSearchResults.innerHTML = "";
  if (products.length === 0) {
    foodSearchStatus.textContent = `Nothing found for "${query}" — describe it instead and it'll be estimated.`;
    foodSearchStatus.hidden = false;
    return;
  }
  foodSearchStatus.hidden = true;

  for (const product of products) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "food-search-result";

    const info = document.createElement("span");
    info.className = "food-search-result-info";
    const name = document.createElement("span");
    name.className = "food-search-result-name";
    name.textContent = product.name;
    const meta = document.createElement("span");
    meta.className = "food-search-result-meta";
    meta.textContent = [product.brand, `${Math.round(product.kcalPer100g)} kcal / 100g`]
      .filter(Boolean)
      .join(" · ");
    info.append(name, meta);
    row.appendChild(info);

    // Hands off to the same product card the barcode scanner uses, so a
    // searched item and a scanned one are logged through one path.
    // A searched item and a scanned one go through exactly the same sheet,
    // so they behave identically from here on.
    row.addEventListener("click", () => {
      foodSearchCard.hidden = true;
      openProductSheet(product);
    });

    foodSearchResults.appendChild(row);
  }
}

// ── Voice capture ───────────────────────────────────────────────────────────
// Web Speech dictation straight into the description box. Chrome/Edge/Safari
// only; the button stays hidden where the API doesn't exist rather than
// offering something that would do nothing.
const voiceBtn = document.getElementById("voice-btn");
const voiceBtnLabel = document.getElementById("voice-btn-label");
const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognitionCtor) {
  voiceBtn.hidden = false;
  voiceBtn.addEventListener("click", () => {
    if (recognition) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-GB";
    recognition.interimResults = true;
    recognition.continuous = false;

    // Dictation appends rather than replaces, so speaking twice adds to what's
    // already there instead of wiping it.
    const base = textInput.value.trim();

    recognition.addEventListener("start", () => {
      voiceBtn.classList.add("capture-btn--listening");
      voiceBtnLabel.textContent = "Listening";
    });
    recognition.addEventListener("result", (event) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        heard += event.results[i][0].transcript;
      }
      textInput.value = base ? `${base} ${heard.trim()}` : heard.trim();
    });
    recognition.addEventListener("error", () => {
      formError.textContent = "Couldn't hear that — try again, or type it instead.";
      formError.hidden = false;
    });
    recognition.addEventListener("end", () => {
      voiceBtn.classList.remove("capture-btn--listening");
      voiceBtnLabel.textContent = "Speak";
      recognition = null;
    });

    recognition.start();
  });
}

// ── Launch parameters ───────────────────────────────────────────────────────
// Home-screen shortcuts (manifest "shortcuts") arrive as ?action=…, and text
// shared into the app from elsewhere (manifest "share_target") as ?text=… /
// ?title=…. Both are consumed once and stripped, so a refresh doesn't repeat
// them.
function handleLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  const shared = [params.get("title"), params.get("text"), params.get("url")]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!action && !shared) return;

  if (shared) {
    textInput.value = shared;
    textInput.focus();
  }

  if (action === "scan") openScanner();
  else if (action === "weigh") {
    navTo("stats");
    document.getElementById("weighin-weight")?.focus();
  } else if (action === "log" || shared) {
    textInput.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!shared) textInput.focus();
  }

  for (const key of ["action", "title", "text", "url"]) params.delete(key);
  const query = params.toString();
  window.history.replaceState({}, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

// ── Offline ─────────────────────────────────────────────────────────────────
// Logging happens in kitchens, gyms and pub gardens, which is exactly where
// signal isn't. Anything the user writes while offline goes into IndexedDB
// and is replayed when the connection comes back, so nothing typed is ever
// lost to a spinner.
//
// This lives in the page rather than the service worker on purpose:
// Background Sync is Chrome-only, and half the point is that it works on an
// iPhone.
const DB_NAME = "food-diary-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "pending";

let dbPromise = null;

function openQueueDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function queueTx(mode) {
  return openQueueDb().then((db) => db.transaction(QUEUE_STORE, mode).objectStore(QUEUE_STORE));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueue(item) {
  const store = await queueTx("readwrite");
  await requestToPromise(store.add({ ...item, queuedAt: Date.now() }));
  await refreshOfflineBanner();
}

async function queuedItems() {
  try {
    const store = await queueTx("readonly");
    return await requestToPromise(store.getAll());
  } catch {
    // A browser with IndexedDB blocked (private mode on some platforms) just
    // doesn't get the queue — better than the app refusing to start.
    return [];
  }
}

async function dequeue(id) {
  const store = await queueTx("readwrite");
  await requestToPromise(store.delete(id));
}

/** True when a fetch failed because the network is gone, rather than because
 *  the server said no — only the former is worth queuing. */
function isNetworkFailure(error) {
  return error instanceof TypeError || !navigator.onLine;
}

const offlineBanners = [
  { banner: document.getElementById("offline-banner"), text: document.getElementById("offline-banner-text") },
  { banner: document.getElementById("today-offline-banner"), text: document.getElementById("today-offline-text") },
];

async function refreshOfflineBanner() {
  const items = await queuedItems();
  const offline = !navigator.onLine;
  const waiting = items.length > 0;

  let message = "";
  if (waiting) {
    const noun = items.length === 1 ? "entry" : "entries";
    message = offline
      ? `Offline — ${items.length} ${noun} saved on this device, and will sync when you're back.`
      : `Syncing ${items.length} ${noun} saved while you were offline…`;
  } else if (offline) {
    message = "Offline — anything you log now is saved here and synced later.";
  }

  // Both Today and the week carry one, and you can be on either when the
  // connection drops — so the state goes to both rather than to whichever
  // happens to be in front.
  for (const { banner, text } of offlineBanners) {
    if (!banner || !text) continue;
    banner.hidden = !offline && !waiting;
    banner.classList.toggle("offline-banner--waiting", waiting);
    text.textContent = message;
  }
}

let flushing = false;

/** Replays everything queued, oldest first, stopping at the first item that
 *  fails for a network reason so the order is preserved. */
async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = (await queuedItems()).sort((a, b) => a.queuedAt - b.queuedAt);
    if (items.length === 0) return;
    await refreshOfflineBanner();

    let sent = 0;
    for (const item of items) {
      try {
        const ok = await replayQueued(item);
        // A request the server rejected outright (a 400 on malformed data)
        // will never succeed on a retry, so it's dropped rather than left to
        // block everything behind it forever.
        await dequeue(item.id);
        if (ok) sent += 1;
      } catch (error) {
        if (isNetworkFailure(error)) break;
        await dequeue(item.id);
      }
    }

    await refreshOfflineBanner();
    if (sent > 0) {
      await refreshCurrentView();
      if (!statsScreen.hidden) await loadWeighIns();
    }
  } finally {
    flushing = false;
  }
}

async function replayQueued(item) {
  if (item.kind === "weighIn") {
    const res = await fetch("/api/weigh-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    return res.ok;
  }

  // Queued entries are the one thing that still goes through the old
  // estimate-and-save endpoint rather than preview-then-confirm: they flush
  // when the network returns, which may be minutes later with the app in a
  // pocket. There is nobody there to confirm a sheet, and holding food
  // hostage until someone reopens the app would be worse than saving an
  // estimate they can edit in the diary.
  // Entries carry an optional photo Blob, so they go back out as FormData.
  const body = new FormData();
  if (item.payload.text) body.append("text", item.payload.text);
  if (item.payload.photo) body.append("photo", item.payload.photo, item.payload.photoName || "photo.jpg");
  if (item.payload.lastWeek) body.append("lastWeek", "true");
  const res = await fetch("/api/entries", { method: "POST", body });
  return res.ok;
}

window.addEventListener("online", () => {
  refreshOfflineBanner();
  flushQueue();
  loadWater();
});
window.addEventListener("offline", refreshOfflineBanner);

// ── Service worker ──────────────────────────────────────────────────────────
// The worker caches a new deploy correctly, but that only changes what the
// NEXT page load gets. An app added to the home screen is resumed rather than
// reloaded, so without the code below it can sit on a months-old shell
// indefinitely — which is exactly what happened: three deploys shipped and the
// phone still showed the version from before the first of them.

let swUpdateHandled = false;

// Whether a worker was already in charge when this page loaded. On a first
// ever visit there isn't one, and the worker that installs then claims the
// page — which fires controllerchange for a version that is already the one
// running. Reloading on that would bounce every new user for nothing.
const hadServiceWorker = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(watchForUpdates)
      .catch((error) => {
        // Not fatal: without a worker the app simply needs a connection.
        console.warn("Service worker registration failed:", error);
      });
  });

  // A new worker taking over means the cache now holds a newer build than the
  // page currently running.
  navigator.serviceWorker.addEventListener("controllerchange", onNewVersionReady);
}

function watchForUpdates(registration) {
  // Resuming the app is the moment worth checking on: a home-screen app may go
  // days between cold starts, and nothing else would ask. Throttled so
  // flicking in and out doesn't hammer it.
  let lastCheck = 0;
  const check = () => {
    if (document.hidden) return;
    if (Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    registration.update().catch(() => {});
  };
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);

  // Already waiting when the page loaded — an update that arrived and had
  // nowhere to announce itself.
  if (registration.waiting && navigator.serviceWorker.controller) onNewVersionReady();
}

function onNewVersionReady() {
  if (!hadServiceWorker || swUpdateHandled) return;
  swUpdateHandled = true;

  // Reloading under someone's fingers would throw away what they were typing,
  // so anything in progress gets asked rather than interrupted.
  const busy =
    (typeof confirmSheet !== "undefined" && confirmSheet && !confirmSheet.hidden)
    || (typeof textInput !== "undefined" && textInput && textInput.value.trim() !== "")
    || document.activeElement?.tagName === "INPUT"
    || document.activeElement?.tagName === "TEXTAREA";

  if (!busy) {
    window.location.reload();
    return;
  }

  showToast("A new version is ready", {
    actionLabel: "Reload",
    onAction: () => window.location.reload(),
    duration: 30_000,
  });
}

// ── Reminders (web push) ────────────────────────────────────────────────────
const pushControls = document.getElementById("push-controls");
const pushUnsupported = document.getElementById("push-unsupported");
const pushStatusEl = document.getElementById("push-status");
const pushEnableBtn = document.getElementById("push-enable-btn");
const pushTestBtn = document.getElementById("push-test-btn");
const pushErrorEl = document.getElementById("push-error");
const settingsReminderHour = document.getElementById("settings-reminder-hour");

const pushSupported =
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Populated once; the hour a reminder fires is whole-hour by design, matching
// the scheduler's hourly tick.
for (let hour = 0; hour < 24; hour++) {
  const option = document.createElement("option");
  option.value = String(hour);
  option.textContent = `${String(hour).padStart(2, "0")}:00`;
  settingsReminderHour.appendChild(option);
}

function showPushError(message) {
  pushErrorEl.textContent = message;
  pushErrorEl.hidden = false;
}

/** The VAPID public key arrives base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function currentPushSubscription() {
  if (!pushSupported) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function refreshPushUi() {
  pushUnsupported.hidden = pushSupported;
  pushControls.hidden = !pushSupported;
  if (!pushSupported) return;

  pushErrorEl.hidden = true;
  const subscription = await currentPushSubscription();
  const subscribedHere = subscription !== null;

  pushEnableBtn.hidden = subscribedHere;
  pushTestBtn.hidden = !subscribedHere;

  if (Notification.permission === "denied") {
    pushStatusEl.textContent =
      "Notifications are blocked for this site — you'll need to allow them in your browser settings.";
    pushEnableBtn.hidden = true;
    return;
  }

  try {
    const res = await fetch("/api/push/status");
    if (!res.ok) throw new Error();
    const { deviceCount } = await res.json();
    if (subscribedHere) {
      const others = deviceCount - 1;
      pushStatusEl.textContent =
        others > 0
          ? `On for this device, and ${others} other${others === 1 ? "" : "s"}.`
          : "On for this device.";
    } else {
      pushStatusEl.textContent =
        deviceCount > 0
          ? `Not on for this device (on for ${deviceCount} other${deviceCount === 1 ? "" : "s"}).`
          : "Not on yet.";
    }
  } catch {
    pushStatusEl.textContent = subscribedHere ? "On for this device." : "Not on yet.";
  }
}

pushEnableBtn.addEventListener("click", async () => {
  pushErrorEl.hidden = true;
  pushEnableBtn.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showPushError("Notifications need permission — nothing was changed.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/push/public-key");
    if (!keyRes.ok) throw new Error("Couldn't fetch the notification key.");
    const { publicKey } = await keyRes.json();

    const subscription = await registration.pushManager.subscribe({
      // Web push requires this to be true: every message must be shown to the
      // user, no silent background pings.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) throw new Error("Couldn't register this device.");

    await refreshPushUi();
  } catch (error) {
    showPushError(error.message || "Couldn't turn notifications on.");
  } finally {
    pushEnableBtn.disabled = false;
  }
});

pushTestBtn.addEventListener("click", async () => {
  pushErrorEl.hidden = true;
  pushTestBtn.disabled = true;
  try {
    const res = await fetch("/api/push/test", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't send a test.");
    }
    pushStatusEl.textContent = "Test sent — it should arrive in a moment.";
  } catch (error) {
    showPushError(error.message);
  } finally {
    pushTestBtn.disabled = false;
  }
});

// ── First-run wizard ────────────────────────────────────────────────────────
// Shown once, after the first sign-up. It only collects what materially
// changes the app's output: units (everything is displayed in them), the week
// boundary (the whole app is organised around it), and body stats (they feed
// the fallback burn estimate). Everything else waits until it's needed.
const ONBOARDED_KEY = "onboarded";
const onboardingScreen = document.getElementById("onboarding-screen");
const onboardingNext = document.getElementById("onboarding-next");
const onboardingSkip = document.getElementById("onboarding-skip");
const onboardingError = document.getElementById("onboarding-error");
const onboardingWeekday = document.getElementById("onboarding-weekday");
const onboardingWeight = document.getElementById("onboarding-weight");
const onboardingGoalWeight = document.getElementById("onboarding-goal-weight");
const onboardingHeight = document.getElementById("onboarding-height");
const onboardingAge = document.getElementById("onboarding-age");
const onboardingUnitsMetric = document.getElementById("onboarding-units-metric");
const onboardingUnitsImperial = document.getElementById("onboarding-units-imperial");
const onboardingWeightLabel = document.getElementById("onboarding-weight-label");
const onboardingGoalWeightLabel = document.getElementById("onboarding-goal-weight-label");

const ONBOARDING_LAST_STEP = 2;
let onboardingStep = 0;

function applyOnboardingUnits() {
  onboardingUnitsMetric.classList.toggle("meal-kind-btn--active", !useImperial);
  onboardingUnitsImperial.classList.toggle("meal-kind-btn--active", useImperial);
  onboardingWeightLabel.textContent = useImperial ? "Current weight (lbs)" : "Current weight (kg)";
  onboardingGoalWeightLabel.textContent = useImperial ? "Goal weight (lbs)" : "Goal weight (kg)";
  onboardingWeight.placeholder = useImperial ? "e.g. 210" : "e.g. 95";
  onboardingGoalWeight.placeholder = useImperial ? "e.g. 187" : "e.g. 85";
}

function setOnboardingUnits(imperial) {
  useImperial = imperial;
  localStorage.setItem("units", imperial ? "imperial" : "metric");
  applyUnitPreference();
  applyOnboardingUnits();
}

onboardingUnitsMetric.addEventListener("click", () => setOnboardingUnits(false));
onboardingUnitsImperial.addEventListener("click", () => setOnboardingUnits(true));

function showOnboardingStep(step) {
  onboardingStep = step;
  for (const section of onboardingScreen.querySelectorAll(".onboarding-step")) {
    section.hidden = Number(section.dataset.step) !== step;
  }
  for (const dot of onboardingScreen.querySelectorAll(".onboarding-dot")) {
    dot.classList.toggle("onboarding-dot--active", Number(dot.dataset.step) <= step);
  }
  onboardingNext.textContent = step === ONBOARDING_LAST_STEP ? "Start logging" : "Next";
  onboardingSkip.hidden = step === ONBOARDING_LAST_STEP;
}

function openOnboarding() {
  tabBar.hidden = true;
  authScreen.hidden = true;
  appShell.hidden = true;
  onboardingScreen.hidden = false;
  onboardingError.hidden = true;
  applyOnboardingUnits();
  showOnboardingStep(0);
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDED_KEY, "1");
  onboardingScreen.hidden = true;
  navTo("today");
}

/** Sends only the fields the user actually filled in, so a skipped question
 *  stays unset rather than being written as a zero. */
async function saveOnboarding() {
  const lbsToKg = (v) => +(v / 2.20462).toFixed(2);
  const payload = { weekStartWeekday: Number(onboardingWeekday.value) };

  const weight = onboardingWeight.value ? Number(onboardingWeight.value) : null;
  if (weight) payload.weightKg = useImperial ? lbsToKg(weight) : weight;
  const goalWeight = onboardingGoalWeight.value ? Number(onboardingGoalWeight.value) : null;
  if (goalWeight) payload.goalWeightKg = useImperial ? lbsToKg(goalWeight) : goalWeight;
  const height = onboardingHeight.value ? Number(onboardingHeight.value) : null;
  if (height) payload.heightCm = height;
  const age = onboardingAge.value ? Number(onboardingAge.value) : null;
  if (age) payload.ageYears = age;

  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Couldn't save that — you can set it in Settings instead.");
  populateSettings(await res.json());
}

onboardingNext.addEventListener("click", async () => {
  onboardingError.hidden = true;

  // Everything collected is saved at the end of the stats step, so closing
  // the app on the last screen doesn't lose it.
  if (onboardingStep === 1) {
    onboardingNext.disabled = true;
    try {
      await saveOnboarding();
    } catch (error) {
      onboardingError.textContent = error.message;
      onboardingError.hidden = false;
      return;
    } finally {
      onboardingNext.disabled = false;
    }
  }

  if (onboardingStep === ONBOARDING_LAST_STEP) {
    finishOnboarding();
    await loadWeek();
    return;
  }
  showOnboardingStep(onboardingStep + 1);
});

onboardingSkip.addEventListener("click", () => {
  finishOnboarding();
  loadWeek();
});

// ── Weekly review ───────────────────────────────────────────────────────────
// The same four-section review the PDF carries, readable without downloading
// a file, plus the week's own shape and how it compares to the last one.
const reviewScreen = document.getElementById("review-screen");
const reviewBack = document.getElementById("review-back");
const openReviewBtn = document.getElementById("open-review-btn");
const reviewRange = document.getElementById("review-range");
const reviewTotal = document.getElementById("review-total");
const reviewAverage = document.getElementById("review-average");
const reviewDays = document.getElementById("review-days");
const reviewExercise = document.getElementById("review-exercise");
const reviewComparison = document.getElementById("review-comparison");
const reviewHighlightsCard = document.getElementById("review-highlights-card");
const reviewHighlights = document.getElementById("review-highlights");
const reviewInsightsCard = document.getElementById("review-insights-card");
const reviewInsights = document.getElementById("review-insights");
const reviewGenerateCard = document.getElementById("review-generate-card");
const reviewGenerateNote = document.getElementById("review-generate-note");
const reviewGenerateBtn = document.getElementById("review-generate-btn");
const reviewError = document.getElementById("review-error");
const reviewPdfLink = document.getElementById("review-pdf-link");

const INSIGHT_SECTIONS = [
  { key: "wentWell", title: "Went well", cls: "review-section--good" },
  { key: "couldImprove", title: "Could have gone better", cls: "review-section--warn" },
  { key: "noticed", title: "Things you might not have noticed", cls: "review-section--note" },
  { key: "easyWins", title: "Easy wins", cls: "review-section--win" },
];

function openReview() {
  appShell.hidden = true;
  reviewScreen.hidden = false;
  loadReview();
}

function closeReview() {
  reviewScreen.hidden = true;
  appShell.hidden = false;
}

openReviewBtn.addEventListener("click", openReview);
reviewBack.addEventListener("click", closeReview);

async function loadReview({ refresh = false } = {}) {
  reviewError.hidden = true;
  const query = `weeksAgo=${weeksAgo}${refresh ? "&refresh=1" : ""}`;
  reviewPdfLink.href = `/api/match-weeks/current/report.pdf?weeksAgo=${weeksAgo}`;

  try {
    const res = await fetch(`/api/match-weeks/current/review?${query}`);
    if (!res.ok) throw new Error("Couldn't load this week's review.");
    renderReview(await res.json());
  } catch (error) {
    reviewError.textContent = error.message;
    reviewError.hidden = false;
  }
}

function renderReview(data) {
  reviewRange.textContent = `${dateFmt.format(new Date(data.startsAt))} – ${dateFmt.format(
    new Date(new Date(data.endsAt).getTime() - 1000),
  )}`;

  reviewTotal.textContent = data.totalKcal.toLocaleString();
  reviewAverage.textContent = data.dailyAverage.toLocaleString();
  reviewDays.textContent = data.daysLogged;
  reviewExercise.textContent = data.exerciseTotalKcal.toLocaleString();

  renderReviewComparison(data.previousWeek, data.dailyAverage);
  renderReviewHighlights(data);
  renderReviewInsights(data);
}

function renderReviewComparison(previous, dailyAverage) {
  if (!previous || previous.dailyAverage === null || dailyAverage === 0) {
    reviewComparison.hidden = true;
    return;
  }
  const delta = dailyAverage - previous.dailyAverage;
  // Within 25 kcal/day is noise, not a change worth reporting as one.
  if (Math.abs(delta) < 25) {
    reviewComparison.textContent = `About the same daily average as last week (${previous.dailyAverage.toLocaleString()} kcal/day).`;
  } else {
    const direction = delta < 0 ? "below" : "above";
    reviewComparison.textContent = `${Math.abs(delta).toLocaleString()} kcal/day ${direction} last week's average of ${previous.dailyAverage.toLocaleString()}.`;
  }
  reviewComparison.hidden = false;
}

function renderReviewHighlights(data) {
  reviewHighlights.innerHTML = "";
  const rows = [];

  if (data.busiestDay) {
    const date = new Date(`${data.busiestDay.date}T12:00:00`);
    rows.push({
      label: "Heaviest day",
      value: `${dayFmt.format(date)} · ${data.busiestDay.kcal.toLocaleString()} kcal`,
    });
  }
  for (const food of data.topFoods ?? []) {
    rows.push({
      label: food.count === 1 ? "Logged once" : `Logged ${food.count}×`,
      value: food.totalKcal > 0 ? `${food.label} · ${food.totalKcal.toLocaleString()} kcal` : food.label,
    });
  }

  if (rows.length === 0) {
    reviewHighlightsCard.hidden = true;
    return;
  }
  for (const row of rows) {
    const el = document.createElement("div");
    el.className = "review-highlight";
    const label = document.createElement("span");
    label.className = "review-highlight-label";
    label.textContent = row.label;
    const value = document.createElement("span");
    value.className = "review-highlight-value";
    value.textContent = row.value;
    el.append(label, value);
    reviewHighlights.appendChild(el);
  }
  reviewHighlightsCard.hidden = false;
}

function renderReviewInsights(data) {
  reviewInsights.innerHTML = "";
  const insights = data.insights;
  const hasAny =
    insights && INSIGHT_SECTIONS.some(({ key }) => (insights[key] ?? []).length > 0);

  if (!hasAny) {
    reviewInsightsCard.hidden = true;
    reviewGenerateCard.hidden = false;
    reviewGenerateNote.textContent =
      data.daysLogged === 0
        ? "Log a few meals and there'll be something here to review."
        : "A written review of the week — what went well, what slipped, and what you probably didn't notice — read from what you actually logged.";
    reviewGenerateBtn.hidden = data.daysLogged === 0;
    reviewGenerateBtn.textContent = "Write my review";
    return;
  }

  for (const { key, title, cls } of INSIGHT_SECTIONS) {
    const points = insights[key] ?? [];
    if (points.length === 0) continue;

    const section = document.createElement("div");
    section.className = `review-section ${cls}`;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const list = document.createElement("ul");
    for (const point of points) {
      const li = document.createElement("li");
      li.textContent = point;
      list.appendChild(li);
    }
    section.append(heading, list);
    reviewInsights.appendChild(section);
  }
  reviewInsightsCard.hidden = false;

  // A finished week can't change, so there's nothing to refresh; one still
  // running can be re-read once more has been logged.
  reviewGenerateCard.hidden = data.weekIsOver;
  reviewGenerateNote.textContent = "Logged more since? Read the week again.";
  reviewGenerateBtn.textContent = "Refresh the review";
  reviewGenerateBtn.hidden = false;
}

reviewGenerateBtn.addEventListener("click", async () => {
  reviewGenerateBtn.disabled = true;
  const original = reviewGenerateBtn.textContent;
  reviewGenerateBtn.textContent = "Reading your week…";
  try {
    await loadReview({ refresh: true });
    // The endpoint answers 200 with insights: null when the model call
    // failed. Without this the button would just settle back and look like
    // nothing had been asked of it.
    if (reviewInsightsCard.hidden && reviewError.hidden) {
      reviewError.textContent = "Couldn't write the review just now — try again in a moment.";
      reviewError.hidden = false;
    }
  } finally {
    reviewGenerateBtn.disabled = false;
    if (reviewGenerateBtn.textContent === "Reading your week…") reviewGenerateBtn.textContent = original;
  }
});

// ── Theme ───────────────────────────────────────────────────────────────────
// Three states, not two: "system" follows the device, which is what most
// people actually want, and is the default.
const THEME_KEY = "theme";
const themeButtons = {
  system: document.getElementById("theme-system"),
  light: document.getElementById("theme-light"),
  dark: document.getElementById("theme-dark"),
};

function applyTheme(theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  for (const [name, button] of Object.entries(themeButtons)) {
    button.classList.toggle("meal-kind-btn--active", name === theme);
  }
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

for (const [name, button] of Object.entries(themeButtons)) {
  button.addEventListener("click", () => setTheme(name));
}

applyTheme(localStorage.getItem(THEME_KEY) ?? "system");

// ── Haptics ─────────────────────────────────────────────────────────────────
// A short buzz to confirm something landed, on the handful of actions where
// the user is looking away from the screen. Android only in practice — iOS
// Safari has no Vibration API — and silently absent everywhere else.
function haptic(pattern = 12) {
  if (typeof navigator.vibrate !== "function") return;
  // Respect a system-level preference for less motion/feedback.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if the page hasn't been interacted with yet.
  }
}

// ── Weight history from a phone's health app ────────────────────────────────
// No web API exists for HealthKit or Health Connect, so this reads the export
// file instead — see the note in src/healthImport.ts.
const healthFileInput = document.getElementById("health-file");
const healthStatus = document.getElementById("health-status");

healthFileInput.addEventListener("change", async () => {
  const file = healthFileInput.files?.[0];
  if (!file) return;

  healthStatus.hidden = false;
  healthStatus.classList.remove("error");
  // An Apple export is big enough that the upload alone takes a while, so it
  // says what it's doing rather than sitting silent.
  healthStatus.textContent =
    file.size > 20 * 1024 * 1024 ? "Uploading — a big export can take a minute…" : "Reading…";

  try {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/data/import/health", { method: "POST", body });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "Couldn't read that file.");
    }

    const range =
      result.firstDate && result.lastDate && result.firstDate !== result.lastDate
        ? ` (${result.firstDate} to ${result.lastDate})`
        : "";
    const ignored = result.skipped > 0 ? ` ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.` : "";
    healthStatus.textContent = `Imported ${result.imported} weigh-in${result.imported === 1 ? "" : "s"}${range}.${ignored}`;

    await loadWeighIns();
    await loadStatsSummary();
  } catch (error) {
    healthStatus.textContent = error.message;
    healthStatus.classList.add("error");
  } finally {
    healthFileInput.value = "";
  }
});

// ── Info buttons ────────────────────────────────────────────────────────────
// The screen carries a few figures that aren't self-explanatory — an adaptive
// TDEE, a weighted day count, a recovery score. Rather than crowd every card
// with a paragraph, each gets an (i) that explains it on demand, through the
// tooltip mechanism already used by the charts and tables.
const INFO_TEXT = {
  tdee:
    "What you actually burn per day, worked backwards from what you ate and how your weight " +
    "moved — not a height-and-age formula. Confidence reflects how many days you logged and " +
    "how long the window is.",
  averages:
    "Trailing averages. Calories in comes from your diary; calories out from your tracker, " +
    "averaged only over days it actually recorded. Today is left out, since it's still going.",
  "weekly-calories":
    "A match week runs Monday evening to Monday evening, so it touches 8 calendar days — the " +
    "first and last count as half each. That's why days logged can be 6.5 rather than a whole " +
    "number. Tap + to see the individual days.",
  "weekly-weight":
    "The change from the previous week's last weigh-in. A week you didn't weigh in during is " +
    "left out entirely rather than shown as no change. Tap + to see each day's reading.",
  streak:
    "Consecutive days you finished under what you burned. A day you didn't log can't be " +
    "claimed, so it breaks the run. The Monday a match week starts and ends on counts once, " +
    "as one day — not as two halves.",
  "weekly-recovery":
    "WHOOP's recovery score is how ready your body is that day, from heart-rate variability " +
    "and resting heart rate. Sleep is time actually asleep, not time in bed. Tap + for the days.",
  recovery:
    "Recovery is WHOOP's 0–100% readiness score for today, from your overnight heart-rate " +
    "variability and resting heart rate. Green is rested, red means take it easy.",
};

for (const button of document.querySelectorAll(".info-btn")) {
  button.innerHTML = ICONS.info;
  const text = INFO_TEXT[button.dataset.info];
  if (!text) continue;
  button.dataset.tooltip = text;
  button.classList.add("has-tooltip");
}


// ── Body stats, once a tracker is doing the measuring ───────────────────────
// Height, age and activity exist only to feed the Mifflin-St Jeor fallback
// used on days with no tracker data. With WHOOP connected that's a rare
// backstop rather than the main event, so the fields fold away instead of
// sitting at the top of Settings implying they still drive the numbers.
const bodyStatsNote = document.getElementById("body-stats-note");
const estimateFields = document.getElementById("estimate-fields");
const estimateFieldsSummary = document.getElementById("estimate-fields-summary");
const estimateFieldsNote = document.getElementById("estimate-fields-note");

function applyTrackerAwareSettings(trackerConnected) {
  if (trackerConnected) {
    bodyStatsNote.textContent =
      "Your goal weight drives the projection on the Stats screen. With WHOOP connected, your " +
      "burn is measured rather than estimated, so the rest is only a fallback.";
    estimateFieldsSummary.textContent = "Burn estimate fallback";
    estimateFieldsNote.textContent =
      "Only used on days WHOOP has no data for. Everything else comes from the watch.";
    // Left closed: it's a backstop, not something to maintain.
    estimateFields.open = false;
  } else {
    bodyStatsNote.textContent =
      "Your goal weight drives the projection on the Stats screen. Height, age and activity " +
      "estimate what you burn until a tracker can measure it.";
    estimateFieldsSummary.textContent = "Burn estimate details";
    estimateFieldsNote.textContent =
      "Used to estimate what you burn each day. Connect WHOOP in Settings to measure it instead.";
    estimateFields.open = true;
  }
}


// ── Deficit streak ──────────────────────────────────────────────────────────
// Consecutive days finishing under your burn. Counted over calendar days, so
// the Monday a match week opens and closes on is one day, not two halves —
// see src/deficitStreak.ts for why that distinction matters.
const dayRangeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function formatStreakRange(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (startDate === endDate) return dayRangeFmt.format(start);
  return `${dayRangeFmt.format(start)} – ${dayRangeFmt.format(end)}`;
}

function pluralDays(n) {
  return n === 1 ? "1 day" : `${n} days`;
}

async function loadDeficitStreak() {
  try {
    const res = await fetch("/api/stats/deficit-streak");
    if (!res.ok) throw new Error();
    renderDeficitStreak(await res.json());
  } catch {
    streakCard.hidden = true;
  }
}

function renderDeficitStreak(data) {
  // Nothing judgeable yet means nothing worth showing — an empty card of
  // dashes is worse than no card.
  if (!data || data.judgedDays === 0) {
    streakCard.hidden = true;
    return;
  }
  streakCard.hidden = false;

  streakCurrent.textContent = String(data.current);
  streakCurrent.classList.toggle("streak-number--live", data.current > 0);
  streakCurrentCaption.textContent =
    data.current === 0
      ? "current — no run going"
      : `current, since ${formatStreakRange(data.currentStartDate, data.currentStartDate)}`;

  if (!data.best) {
    streakBest.textContent = "—";
    streakBestCaption.textContent = "best";
  } else {
    streakBest.textContent = String(data.best.days);
    streakBestCaption.textContent = `best (${formatStreakRange(data.best.startDate, data.best.endDate)})`;
  }

  // Say plainly why today isn't in the number, so a good day in progress
  // doesn't look like it's been ignored.
  streakNote.textContent = `Counted over ${pluralDays(data.judgedDays)} with enough data to judge. Today joins once it's finished.`;
  streakNote.hidden = false;
}


// ── Photo lightbox ─────────────────────────────────────────────────────────
// Meal photos were stored but never rendered. A thumbnail in the row plus a
// full-size view is the whole feature — no gallery, no editing.
const photoModal = document.getElementById("photo-modal");
const photoModalImg = document.getElementById("photo-modal-img");
const photoModalCaption = document.getElementById("photo-modal-caption");
const photoModalClose = document.getElementById("photo-modal-close");

function openPhotoModal(url, caption) {
  photoModalImg.src = url;
  photoModalImg.alt = caption ?? "";
  photoModalCaption.textContent = caption ?? "";
  photoModal.hidden = false;
  photoModalClose.focus();
}

function closePhotoModal() {
  photoModal.hidden = true;
  // Dropped so a large photo isn't held in memory behind a hidden dialog.
  photoModalImg.src = "";
}

photoModalClose.addEventListener("click", closePhotoModal);
photoModal.addEventListener("click", (event) => {
  if (event.target === photoModal) closePhotoModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoModal.hidden) closePhotoModal();
});

function hasMacros(entry) {
  return entry.proteinG !== null || entry.carbsG !== null || entry.fatG !== null;
}

function gramsOrDash(value) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}g`;
}

function macroLine(entry) {
  return `P ${gramsOrDash(entry.proteinG)} · C ${gramsOrDash(entry.carbsG)} · F ${gramsOrDash(entry.fatG)}`;
}

function formatQuantity(quantity) {
  // 2 rather than 2.0, but 1.5 keeps its half.
  return Number.isInteger(quantity) ? String(quantity) : String(+quantity.toFixed(2));
}


// ── Exercise editing ───────────────────────────────────────────────────────
// Food entries have always been editable; exercise wasn't, so a typo meant
// deleting and re-logging — which for a WHOOP-imported workout also broke the
// link back to that workout.
function enterExerciseEditMode(row, exercise) {
  row.innerHTML = "";
  const editRow = document.createElement("div");
  editRow.className = "entry-edit-row";

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.value = exercise.description;
  descInput.setAttribute("aria-label", "What you did");

  const kcalInput = document.createElement("input");
  kcalInput.type = "number";
  kcalInput.min = "0";
  kcalInput.value = exercise.kcalBurned ?? "";
  kcalInput.placeholder = "kcal";
  kcalInput.setAttribute("aria-label", "Calories burned");

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = toDateInputValue(exercise.timestamp);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.style.width = "auto";
  saveBtn.addEventListener("click", async () => {
    await fetch(`/api/exercises/${exercise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: descInput.value.trim(),
        kcalBurned: kcalInput.value === "" ? null : Number(kcalInput.value),
        date: dateInput.value,
      }),
    });
    loadWeek();
  });

  editRow.append(descInput, kcalInput, dateInput, saveBtn);
  row.appendChild(editRow);
}


// ── Daily calorie target ───────────────────────────────────────────────────
// The diary could say what you ate but never what you were aiming at. The
// target is the user's own number rather than a derived one: the adaptive
// TDEE can propose it, but it doesn't move on its own when a wearable syncs.
const targetCard = document.getElementById("target-card");
const targetToday = document.getElementById("target-today");
const targetCalories = document.getElementById("target-calories");
const targetTodayFigures = document.getElementById("target-today-figures");
const targetTodayNote = document.getElementById("target-today-note");
const targetFill = document.getElementById("target-fill");
const settingsCalorieTarget = document.getElementById("settings-calorie-target");
const suggestTargetBtn = document.getElementById("suggest-target-btn");
const suggestTargetNote = document.getElementById("suggest-target-note");

function renderTargetToday(today) {
  const calorieTarget = currentUser?.dailyCalorieTarget ?? null;
  const macroTargets = currentUser?.macroTargets ?? null;

  // The two halves are independent. Someone tracking "at least 180g of
  // protein" and nothing else has no reason to have set a calorie target,
  // and gating the whole card on one hid their macros completely.
  if (!today || (!calorieTarget && !macroTargets)) {
    targetToday.hidden = true;
    targetCard.hidden = true;
    return;
  }

  targetCard.hidden = false;
  targetToday.hidden = false;
  targetCalories.hidden = !calorieTarget;

  if (calorieTarget) {
    const logged = today.kcal ?? 0;
    const left = calorieTarget - logged;
    targetTodayFigures.textContent = `${logged.toLocaleString()} / ${calorieTarget.toLocaleString()} kcal`;

    const pct = Math.max(0, Math.min(100, (logged / calorieTarget) * 100));
    targetFill.style.width = `${pct}%`;
    targetFill.classList.toggle("target-fill--over", logged > calorieTarget);

    targetTodayNote.textContent =
      left >= 0 ? `${left.toLocaleString()} kcal left today` : `${Math.abs(left).toLocaleString()} kcal over`;
  }

  renderMacroToday(today, { standalone: !calorieTarget });
}

// ── Macros: today's remaining ──────────────────────────────────────────────
// Deliberately on the diary screen rather than a tab of their own: "how much
// protein have I got left?" is a question asked while deciding what to eat,
// and a separate tab would only ever be seen afterwards.
const macroToday = document.getElementById("macro-today");
const macroTodayNote = document.getElementById("macro-today-note");
const macroTodayHeading = document.getElementById("macro-today-heading");

const MACRO_LABELS = { protein: "Protein", carbs: "Carbs", fat: "Fat" };
const MACRO_OP_WORDS = { min: "at least", max: "at most", eq: "about" };

// Mirrors macroProgress() in src/macros.ts so the Today card can render
// without a round trip. If the rules there change, change them here too —
// that file is the source of truth and carries the reasoning.
const EQ_TOLERANCE = 0.05;

function macroProgress(target, eaten) {
  const remaining = Math.round((target.grams - eaten) * 10) / 10;
  const percentOfTarget = target.grams === 0 ? 0 : Math.max(0, Math.min(100, (eaten / target.grams) * 100));

  let verdict;
  let isGood;
  if (target.op === "min") {
    verdict = eaten >= target.grams ? "met" : "under";
    isGood = verdict === "met";
  } else if (target.op === "max") {
    verdict = eaten > target.grams ? "over" : "under";
    isGood = verdict === "under";
  } else {
    const margin = target.grams * EQ_TOLERANCE;
    if (eaten > target.grams + margin) verdict = "over";
    else if (eaten < target.grams - margin) verdict = "under";
    else verdict = "met";
    isGood = verdict === "met";
  }

  return { verdict, isGood, remaining, percentOfTarget };
}

/**
 * The gap between where the day is and where the target is, as a short
 * phrase. Shown in brackets under the running total, so it answers "how far
 * off am I" without having to subtract two numbers in your head.
 */
function macroDeltaText(progress, op) {
  const short = Math.abs(Math.round(progress.remaining));
  if (progress.verdict === "met") {
    // A cleared floor says so rather than counting up past it — the number
    // stops being the point once you're over the line.
    return progress.remaining <= 0 ? "hit" : `${short}g to go`;
  }
  if (progress.verdict === "over") return `${short}g over`;
  // Headroom under a ceiling is not a thing you still have to eat: "to go"
  // on a carb limit reads as an instruction to go and eat 116g of carbs.
  return op === "max" ? `${short}g left` : `${short}g to go`;
}

/** Where the day stands, in the same eaten/target shape as the calorie row. */
function macroTotalText(eaten, target) {
  return `${Math.round(eaten)} / ${target.grams}g`;
}

function describeTarget(key, target) {
  return `${MACRO_OP_WORDS[target.op] ?? "about"} ${target.grams}g`;
}

function renderMacroToday(today, { standalone = false } = {}) {
  const targets = currentUser?.macroTargets ?? null;
  if (!targets || !today) {
    macroToday.hidden = true;
    return;
  }
  macroToday.hidden = false;
  // With no calorie bar above it the macro block is the whole card, so it
  // needs the "Today" heading and loses the divider that separated the two.
  macroToday.classList.toggle("macro-today--standalone", standalone);
  macroTodayHeading.hidden = !standalone;

  const eaten = today.macros ?? { protein: 0, carbs: 0, fat: 0, unknownEntries: 0 };

  for (const key of ["protein", "carbs", "fat"]) {
    const row = macroToday.querySelector(`[data-macro="${key}"]`);
    if (!row) continue;

    const target = targets.targets?.[key] ?? null;
    const fill = row.querySelector(".macro-fill");
    const figures = row.querySelector(".macro-figures");
    const totalEl = row.querySelector(".macro-total");
    const deltaEl = row.querySelector(".macro-delta");

    // A blank target isn't tracked, so its row doesn't appear at all.
    row.hidden = target === null;
    if (target === null) continue;

    const value = eaten[key] ?? 0;
    const progress = macroProgress(target, value);

    fill.style.width = `${progress.percentOfTarget}%`;
    // The colour says whether the day is on the right side of the target,
    // which is not the same as whether the bar is full: clearing a floor is
    // good, passing a ceiling is not.
    fill.classList.toggle("macro-fill--good", progress.isGood);
    fill.classList.toggle("macro-fill--over", progress.verdict === "over");

    // The running total leads, because "how much have I had" is the question
    // being asked most of the time; the gap to the target follows it in
    // brackets rather than replacing it.
    totalEl.textContent = macroTotalText(value, target);
    deltaEl.textContent = `(${macroDeltaText(progress, target.op)})`;
    deltaEl.classList.toggle("macro-delta--good", progress.isGood);
    deltaEl.classList.toggle("macro-delta--over", progress.verdict === "over");
    figures.title = `${Math.round(value)}g eaten · target ${describeTarget(key, target)}`;
  }

  // The honest caveat: entries logged before macros existed have none, so a
  // day mixing old and new rows can't claim a complete total.
  if (eaten.unknownEntries > 0) {
    const n = eaten.unknownEntries;
    macroTodayNote.textContent = `${n} ${n === 1 ? "entry has" : "entries have"} no macro breakdown, so these totals are short by whatever was in ${n === 1 ? "it" : "them"}.`;
    macroTodayNote.hidden = false;
  } else {
    macroTodayNote.hidden = true;
  }
}

suggestTargetBtn.addEventListener("click", async () => {
  suggestTargetNote.hidden = true;
  try {
    const res = await fetch("/api/stats/tdee");
    const data = await res.json();
    if (!data?.available) {
      suggestTargetNote.textContent =
        "Not enough weigh-ins and logged days yet to work one out — keep logging for a couple of weeks.";
      suggestTargetNote.hidden = false;
      return;
    }
    // A target is a burn figure minus a deficit: the weekly goal in kg
    // converted to a daily kcal gap at 7,700 kcal per kg.
    const weeklyGoalKg = currentUser?.weeklyGoalKg ?? 0.5;
    const dailyDeficit = Math.round((weeklyGoalKg * 7700) / 7);
    const suggestion = Math.max(1200, Math.round((data.tdee - dailyDeficit) / 10) * 10);
    settingsCalorieTarget.value = suggestion;
    suggestTargetNote.textContent = `${suggestion.toLocaleString()} kcal — your measured burn of ${Math.round(
      data.tdee,
    ).toLocaleString()} less the ${dailyDeficit.toLocaleString()} a day that ${weeklyGoalKg}kg a week needs. Save to keep it.`;
    suggestTargetNote.hidden = false;
  } catch {
    suggestTargetNote.textContent = "Couldn't work one out just now — try again in a moment.";
    suggestTargetNote.hidden = false;
  }
});


// ── Water ──────────────────────────────────────────────────────────────────
// One running total per day rather than a row per glass: the only question
// anyone asks of this data is "how much today".
const waterCard = document.getElementById("water-card");
const waterTotalEl = document.getElementById("water-total");

function renderWater(ml) {
  const litres = ml / 1000;
  waterTotalEl.textContent = ml >= 1000 ? `${litres.toFixed(litres >= 10 ? 0 : 1)} L` : `${ml} ml`;
}

async function loadWater() {
  try {
    const res = await fetch("/api/days/water");
    if (!res.ok) throw new Error();
    const logs = await res.json();
    const todayIso = toDateInputValue(new Date());
    renderWater(logs.find((log) => log.date === todayIso)?.ml ?? 0);
  } catch {
    renderWater(0);
  }
}

for (const button of document.querySelectorAll(".water-btn")) {
  button.addEventListener("click", async () => {
    haptic();
    try {
      const res = await fetch("/api/days/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltaMl: Number(button.dataset.water) }),
      });
      if (!res.ok) throw new Error();
      renderWater((await res.json()).ml);
    } catch {
      // Water is the lowest-stakes thing in the app; a failed tap just
      // doesn't move the number rather than raising an error banner.
    }
  });
}


// ── Day notes ──────────────────────────────────────────────────────────────
// "Food poisoning", "stag do", "first week back running" — the context that
// explains an odd week, which the weekly review could previously only guess at.
let dayNotes = new Map();

async function loadDayNotes() {
  try {
    const res = await fetch("/api/days/notes");
    if (!res.ok) throw new Error();
    dayNotes = new Map((await res.json()).map((note) => [note.date, note.note]));
  } catch {
    dayNotes = new Map();
  }
  for (const el of document.querySelectorAll("[data-day-note]")) {
    applyDayNote(el.parentElement, el.dataset.dayNote);
  }
}

function applyDayNote(group, dayIso) {
  if (!group) return;
  const el = group.querySelector(`[data-day-note="${dayIso}"]`);
  if (!el) return;
  const note = dayNotes.get(dayIso);
  el.textContent = note ?? "";
  el.hidden = !note;
  const button = group.querySelector(".day-note-btn");
  if (button) button.classList.toggle("day-note-btn--set", Boolean(note));
}

function toggleDayNoteEditor(group, dayIso, button) {
  const existing = group.querySelector(".day-note-editor");
  if (existing) {
    existing.remove();
    return;
  }

  const editor = document.createElement("div");
  editor.className = "day-note-editor";

  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.maxLength = 500;
  textarea.placeholder = "What was going on? e.g. away with work, first week back running";
  textarea.value = dayNotes.get(dayIso) ?? "";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ghost-sm";
  saveBtn.textContent = "Save note";
  saveBtn.addEventListener("click", async () => {
    const note = textarea.value.trim();
    await fetch("/api/days/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dayIso, note }),
    });
    if (note) dayNotes.set(dayIso, note);
    else dayNotes.delete(dayIso);
    editor.remove();
    applyDayNote(group, dayIso);
    button.focus();
  });

  editor.append(textarea, saveBtn);
  group.appendChild(editor);
  textarea.focus();
}


// ── Copy a day ─────────────────────────────────────────────────────────────
const copyDayToggle = document.getElementById("copy-day-toggle");
const copyDayForm = document.getElementById("copy-day-form");
const copyDayFrom = document.getElementById("copy-day-from");
const copyDayTo = document.getElementById("copy-day-to");
const copyDayCancel = document.getElementById("copy-day-cancel");
const copyDayError = document.getElementById("copy-day-error");

copyDayToggle.addEventListener("click", () => {
  copyDayForm.hidden = !copyDayForm.hidden;
  if (copyDayForm.hidden) return;
  copyDayError.hidden = true;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  // Defaults to the overwhelmingly common case, so the usual action is
  // "open, Copy" rather than two date pickers.
  copyDayFrom.value = toDateInputValue(yesterday);
  copyDayTo.value = toDateInputValue(today);
  copyDayFrom.max = toDateInputValue(today);
});

copyDayCancel.addEventListener("click", () => {
  copyDayForm.hidden = true;
});

copyDayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  copyDayError.hidden = true;
  try {
    const res = await fetch("/api/entries/copy-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: copyDayFrom.value, to: copyDayTo.value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't copy that day.");
    }
    copyDayForm.hidden = true;
    haptic();
    weeksAgo = 0;
    loadWeek();
  } catch (error) {
    copyDayError.textContent = error.message ?? "Couldn't copy that day.";
    copyDayError.hidden = false;
  }
});


// ── Body measurements ──────────────────────────────────────────────────────
// Weight stalls for weeks on a training programme while the waist keeps
// moving, so this is the measurement the card leads with; the rest are
// optional and folded away.
const measurementsCard = document.getElementById("measurements-card");
const measurementToggle = document.getElementById("measurement-toggle");
const measurementForm = document.getElementById("measurement-form");
const measurementCancel = document.getElementById("measurement-cancel");
const measurementDate = document.getElementById("measurement-date");
const measurementError = document.getElementById("measurement-error");
const measurementSummary = document.getElementById("measurement-summary");
const measurementList = document.getElementById("measurement-list");

const MEASUREMENT_FIELDS = [
  { key: "waistCm", id: "measurement-waist", label: "Waist" },
  { key: "chestCm", id: "measurement-chest", label: "Chest" },
  { key: "hipsCm", id: "measurement-hips", label: "Hips" },
  { key: "thighCm", id: "measurement-thigh", label: "Thigh" },
  { key: "armCm", id: "measurement-arm", label: "Arm" },
];

let measurements = [];

// Imperial users measure a waist in inches, so the same unit switch that
// governs weight governs this too rather than mixing systems on one screen.
function cmToDisplay(cm) {
  return useImperial ? +(cm / 2.54).toFixed(1) : +cm.toFixed(1);
}

function displayToCm(value) {
  return useImperial ? value * 2.54 : value;
}

function lengthUnit() {
  return useImperial ? "in" : "cm";
}

function applyMeasurementUnits() {
  for (const field of MEASUREMENT_FIELDS) {
    const label = document.getElementById(`${field.id}-label`);
    if (label) label.textContent = `${field.label} (${lengthUnit()})`;
  }
}

async function loadMeasurements() {
  try {
    const res = await fetch("/api/body/measurements");
    if (!res.ok) throw new Error();
    measurements = await res.json();
  } catch {
    measurements = [];
  }
  renderMeasurements();
}

function renderMeasurements() {
  applyMeasurementUnits();
  measurementList.innerHTML = "";

  const withWaist = measurements.filter((row) => row.waistCm !== null);
  if (withWaist.length >= 2) {
    const first = withWaist[0];
    const last = withWaist[withWaist.length - 1];
    const change = last.waistCm - first.waistCm;
    const direction = change <= 0 ? "off" : "on";
    measurementSummary.textContent = `${Math.abs(cmToDisplay(Math.abs(change))).toFixed(1)}${lengthUnit()} ${direction} the waist since ${formatStreakRange(first.date, first.date)}.`;
    measurementSummary.hidden = false;
  } else {
    measurementSummary.hidden = true;
  }

  for (const row of [...measurements].reverse()) {
    const item = document.createElement("div");
    item.className = "measurement-row";

    const date = document.createElement("span");
    date.className = "measurement-date";
    date.textContent = formatStreakRange(row.date, row.date);

    const values = document.createElement("span");
    values.className = "measurement-values";
    values.textContent = MEASUREMENT_FIELDS.filter((field) => row[field.key] !== null)
      .map((field) => `${field.label} ${cmToDisplay(row[field.key])}${lengthUnit()}`)
      .join(" · ");

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    // Its own class rather than .entry-action-icon: that one is only styled
    // under .entry-actions, so borrowing it here gave a full-width green
    // button where a 32px icon was wanted.
    delBtn.className = "measurement-del";
    delBtn.innerHTML = ICONS.x;
    delBtn.title = "Delete";
    delBtn.setAttribute("aria-label", `Delete measurements for ${row.date}`);
    delBtn.addEventListener("click", async () => {
      await fetch(`/api/body/measurements/${row.date}`, { method: "DELETE" });
      loadMeasurements();
    });

    item.append(date, values, delBtn);
    measurementList.appendChild(item);
  }
}

measurementToggle.addEventListener("click", () => {
  measurementForm.hidden = !measurementForm.hidden;
  if (measurementForm.hidden) return;
  measurementError.hidden = true;
  measurementDate.max = todayDateValue();
  measurementDate.value = todayDateValue();
  applyMeasurementUnits();
});

measurementCancel.addEventListener("click", () => {
  measurementForm.hidden = true;
});

measurementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  measurementError.hidden = true;

  const body = { date: measurementDate.value };
  let any = false;
  for (const field of MEASUREMENT_FIELDS) {
    const input = document.getElementById(field.id);
    if (input.value === "") continue;
    body[field.key] = displayToCm(Number(input.value));
    any = true;
  }

  if (!any) {
    measurementError.textContent = "Enter at least one measurement.";
    measurementError.hidden = false;
    return;
  }

  try {
    const res = await fetch("/api/body/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Couldn't save that.");
    }
    for (const field of MEASUREMENT_FIELDS) document.getElementById(field.id).value = "";
    measurementForm.hidden = true;
    loadMeasurements();
  } catch (error) {
    measurementError.textContent = error.message ?? "Couldn't save that.";
    measurementError.hidden = false;
  }
});


// ── Progress photos ────────────────────────────────────────────────────────
const progressPhotoInput = document.getElementById("progress-photo-input");
const progressPhotoStatus = document.getElementById("progress-photo-status");
const progressPhotoError = document.getElementById("progress-photo-error");
const progressPhotoGrid = document.getElementById("progress-photo-grid");

async function loadProgressPhotos() {
  try {
    const res = await fetch("/api/body/photos");
    if (!res.ok) throw new Error();
    renderProgressPhotos(await res.json());
  } catch {
    renderProgressPhotos([]);
  }
}

function renderProgressPhotos(photos) {
  progressPhotoGrid.innerHTML = "";
  for (const photo of photos) {
    const figure = document.createElement("figure");
    figure.className = "progress-photo";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "progress-photo-btn";
    button.setAttribute("aria-label", `View photo from ${photo.date}`);
    const img = document.createElement("img");
    img.src = photo.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    button.appendChild(img);
    button.addEventListener("click", () => openPhotoModal(photo.imageUrl, formatStreakRange(photo.date, photo.date)));

    const caption = document.createElement("figcaption");
    caption.textContent = formatStreakRange(photo.date, photo.date);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "progress-photo-del";
    delBtn.innerHTML = ICONS.x;
    delBtn.title = "Delete";
    delBtn.setAttribute("aria-label", `Delete photo from ${photo.date}`);
    delBtn.addEventListener("click", async () => {
      await fetch(`/api/body/photos/${photo.id}`, { method: "DELETE" });
      loadProgressPhotos();
    });

    figure.append(button, caption, delBtn);
    progressPhotoGrid.appendChild(figure);
  }
}

progressPhotoInput.addEventListener("change", async () => {
  const file = progressPhotoInput.files?.[0];
  if (!file) return;
  progressPhotoError.hidden = true;
  progressPhotoStatus.textContent = "Uploading…";

  const data = new FormData();
  data.append("photo", file);
  data.append("date", todayDateValue());

  try {
    const res = await fetch("/api/body/photos", { method: "POST", body: data });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't save that photo.");
    }
    loadProgressPhotos();
  } catch (error) {
    progressPhotoError.textContent = error.message ?? "Couldn't save that photo.";
    progressPhotoError.hidden = false;
  } finally {
    progressPhotoInput.value = "";
    progressPhotoStatus.textContent = "Add a photo";
  }
});


// ── Eating window ──────────────────────────────────────────────────────────
// First meal to last meal. Every entry already carried a timestamp, so this
// needs nothing extra logged — it's a different reading of what's there.
const eatingWindowCard = document.getElementById("eating-window-card");
const windowAverage = document.getElementById("window-average");
const windowFirst = document.getElementById("window-first");
const windowLast = document.getElementById("window-last");
const windowNote = document.getElementById("window-note");

function minutesToClock(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.round(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function minutesToDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

async function loadEatingWindow() {
  try {
    const res = await fetch("/api/stats/eating-window?days=30");
    if (!res.ok) throw new Error();
    renderEatingWindow(await res.json());
  } catch {
    eatingWindowCard.hidden = true;
  }
}

function renderEatingWindow(data) {
  // A window needs two meals to span; days with one entry are excluded
  // server-side, so a low count here means there's nothing to average yet.
  if (!data || data.daysMeasured < 3) {
    eatingWindowCard.hidden = true;
    return;
  }
  eatingWindowCard.hidden = false;
  windowAverage.textContent = minutesToDuration(data.avgWindowMin);
  windowFirst.textContent = minutesToClock(data.avgFirstMealMin);
  windowLast.textContent = minutesToClock(data.avgLastMealMin);
  windowNote.textContent = `Averaged over the ${pluralDays(data.daysMeasured)} in the last 30 with more than one entry.`;
}


// ── Sign-in & security ─────────────────────────────────────────────────────
// Everything here exists to answer one question the app previously couldn't:
// what do you do when you're locked out, or when a device with a live session
// is no longer yours?
const settingsEmail = document.getElementById("settings-email");
const settingsEmailNote = document.getElementById("settings-email-note");
const settingsEmailSave = document.getElementById("settings-email-save");
const settingsCurrentPassword = document.getElementById("settings-current-password");
const currentPasswordWrap = document.getElementById("current-password-wrap");
const settingsNewPassword = document.getElementById("settings-new-password");
const settingsPasswordSave = document.getElementById("settings-password-save");
const passwordSummary = document.getElementById("password-summary");
const googleLinkStatus = document.getElementById("google-link-status");
const googleLinkBtn = document.getElementById("google-link-btn");
const logoutEverywhereBtn = document.getElementById("logout-everywhere-btn");
const securityStatus = document.getElementById("security-status");
const securityError = document.getElementById("security-error");

let recoveryOptions = { email: false, google: false };

function showSecurityMessage(text, isError = false) {
  const target = isError ? securityError : securityStatus;
  const other = isError ? securityStatus : securityError;
  other.hidden = true;
  target.textContent = text;
  target.hidden = false;
}

function renderSecuritySection(user) {
  // A Google-only account has no current password to prove, so the field is
  // hidden and the action reads "Set a password" rather than "Change".
  currentPasswordWrap.hidden = !user.hasPassword;
  passwordSummary.textContent = user.hasPassword ? "Change password" : "Set a password";
  settingsPasswordSave.textContent = user.hasPassword ? "Update password" : "Set password";

  if (user.hasGoogle) {
    googleLinkStatus.textContent = "Google is linked to this account — you can always sign in that way.";
    googleLinkBtn.hidden = true;
  } else if (recoveryOptions.google) {
    googleLinkStatus.textContent = "Link a Google account so you can still get in without your password.";
    googleLinkBtn.hidden = false;
  } else {
    googleLinkStatus.textContent = "Google sign-in isn't set up on this server.";
    googleLinkBtn.hidden = true;
  }

  settingsEmailNote.textContent = recoveryOptions.email
    ? "Used only to send you a reset link if you forget your password."
    : "Email reset isn't set up on this server yet, so an address here is stored but unused.";
}

async function loadRecoveryOptions() {
  try {
    const res = await fetch("/api/auth/recovery-options");
    if (res.ok) recoveryOptions = await res.json();
  } catch {
    // Leave the defaults: both off, which reads as "no recovery configured"
    // — the honest answer when the server can't be reached.
  }
  if (currentUser) renderSecuritySection(currentUser);
}

settingsEmailSave.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: settingsEmail.value.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't save that address.");
    currentUser = data;
    showSecurityMessage(settingsEmail.value.trim() ? "Recovery email saved." : "Recovery email removed.");
  } catch (error) {
    showSecurityMessage(error.message ?? "Couldn't save that address.", true);
  }
});

settingsPasswordSave.addEventListener("click", async () => {
  const newPassword = settingsNewPassword.value;
  if (newPassword.length < 8) {
    showSecurityMessage("Choose a password of at least 8 characters.", true);
    return;
  }
  try {
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: settingsCurrentPassword.value || undefined,
        newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't change your password.");
    settingsCurrentPassword.value = "";
    settingsNewPassword.value = "";
    // Changing a password signs every other device out, which is the point —
    // say so rather than letting it be a surprise.
    showSecurityMessage("Password updated. Any other device is now signed out.");
    if (currentUser) {
      currentUser = { ...currentUser, hasPassword: true };
      renderSecuritySection(currentUser);
    }
  } catch (error) {
    showSecurityMessage(error.message ?? "Couldn't change your password.", true);
  }
});

logoutEverywhereBtn.addEventListener("click", async () => {
  if (!window.confirm("Sign out on every device, including this one?")) return;
  await fetch("/api/auth/logout-everywhere", { method: "POST" });
  window.location.reload();
});


// ── Delete account ─────────────────────────────────────────────────────────
const deleteConfirmInput = document.getElementById("delete-confirm");
const deletePasswordWrap = document.getElementById("delete-password-wrap");
const deletePassword = document.getElementById("delete-password");
const deleteAccountBtn = document.getElementById("delete-account-btn");
const deleteError = document.getElementById("delete-error");

deleteAccountBtn.addEventListener("click", async () => {
  deleteError.hidden = true;
  if (deleteConfirmInput.value !== currentUser?.username) {
    deleteError.textContent = "Type your username exactly to confirm.";
    deleteError.hidden = false;
    return;
  }
  if (!window.confirm("This deletes every entry, weigh-in, measurement and photo. There is no undo. Continue?")) {
    return;
  }

  try {
    const res = await fetch("/api/auth/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: deleteConfirmInput.value, password: deletePassword.value || undefined }),
    });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Couldn't delete the account.");
    }
    window.location.href = "/";
  } catch (error) {
    deleteError.textContent = error.message ?? "Couldn't delete the account.";
    deleteError.hidden = false;
  }
});


// ── Diagnostics ────────────────────────────────────────────────────────────
// Errors used to go to stdout only, which on Fly rolls away — a WHOOP sync
// that started failing overnight left nothing to find in the morning.
const diagnosticsBackup = document.getElementById("diagnostics-backup");
const diagnosticsBackupBtn = document.getElementById("diagnostics-backup-btn");
const diagnosticsClearBtn = document.getElementById("diagnostics-clear-btn");
const diagnosticsErrors = document.getElementById("diagnostics-errors");
const diagnosticsError = document.getElementById("diagnostics-error");

const diagnosticsTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

async function loadDiagnostics() {
  diagnosticsError.hidden = true;
  try {
    const res = await fetch("/api/diagnostics");
    if (!res.ok) throw new Error();
    renderDiagnostics(await res.json());
  } catch {
    diagnosticsBackup.textContent = "Couldn't read the diagnostics just now.";
    diagnosticsErrors.innerHTML = "";
  }
}

function renderDiagnostics(data) {
  const backup = data.backup ?? {};
  if (!backup.latest) {
    diagnosticsBackup.textContent = "No backup has run yet. One runs nightly at 03:30.";
  } else {
    const when = backup.latestAt ? diagnosticsTimeFmt.format(new Date(backup.latestAt)) : "an unknown time";
    const offsite = backup.offsite ? "copied to Google Drive" : "on this machine only — connect Drive for an off-box copy";
    diagnosticsBackup.textContent = `Last backup ${when} · ${backup.count} kept · ${offsite}.`;
  }

  diagnosticsErrors.innerHTML = "";
  if (!data.errors || data.errors.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No errors recorded.";
    diagnosticsErrors.appendChild(empty);
    return;
  }

  const heading = document.createElement("p");
  heading.className = "muted";
  heading.textContent = `${data.errorCount} recorded, most recent first:`;
  diagnosticsErrors.appendChild(heading);

  for (const error of data.errors) {
    const row = document.createElement("div");
    row.className = "diagnostics-row";

    const when = document.createElement("span");
    when.className = "diagnostics-when";
    when.textContent = diagnosticsTimeFmt.format(new Date(error.createdAt));

    const context = document.createElement("span");
    context.className = "diagnostics-context";
    context.textContent = error.context;

    const message = document.createElement("span");
    message.className = "diagnostics-message";
    message.textContent = error.message;

    row.append(when, context, message);
    diagnosticsErrors.appendChild(row);
  }
}

diagnosticsBackupBtn.addEventListener("click", async () => {
  diagnosticsError.hidden = true;
  diagnosticsBackupBtn.disabled = true;
  diagnosticsBackupBtn.textContent = "Backing up…";
  try {
    const res = await fetch("/api/diagnostics/backup", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "The backup failed.");
    }
    await loadDiagnostics();
  } catch (error) {
    diagnosticsError.textContent = error.message ?? "The backup failed.";
    diagnosticsError.hidden = false;
  } finally {
    diagnosticsBackupBtn.disabled = false;
    diagnosticsBackupBtn.textContent = "Back up now";
  }
});

diagnosticsClearBtn.addEventListener("click", async () => {
  await fetch("/api/diagnostics/errors", { method: "DELETE" });
  loadDiagnostics();
});


// ── Forgotten password ─────────────────────────────────────────────────────
const authForgotBtn = document.getElementById("auth-forgot-btn");
const forgotForm = document.getElementById("forgot-form");
const forgotUsername = document.getElementById("forgot-username");
const forgotStatus = document.getElementById("forgot-status");
const forgotError = document.getElementById("forgot-error");
const forgotCancel = document.getElementById("forgot-cancel");
const resetForm = document.getElementById("reset-form");
const resetPassword = document.getElementById("reset-password");
const resetError = document.getElementById("reset-error");

function showForgotForm(show) {
  forgotForm.hidden = !show;
  authForm.hidden = show;
  authForgotBtn.parentElement.hidden = show;
  authToggleBtn.parentElement.hidden = show;
  googleSigninBtn.hidden = show || !googleSigninBtn.dataset.ready;
  authDivider.hidden = show || !googleSigninBtn.dataset.ready;
  forgotStatus.hidden = true;
  forgotError.hidden = true;
}

authForgotBtn.addEventListener("click", () => showForgotForm(true));
forgotCancel.addEventListener("click", () => showForgotForm(false));

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  forgotError.hidden = true;
  forgotStatus.hidden = true;

  try {
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: forgotUsername.value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Couldn't send a reset link.");
    // Deliberately non-committal: the server answers the same way whether or
    // not the account exists, so the page mustn't claim more than it knows.
    forgotStatus.textContent =
      "If that account has a recovery email on file, a reset link is on its way. It's good for an hour.";
    forgotStatus.hidden = false;
  } catch (error) {
    forgotError.textContent = error.message ?? "Couldn't send a reset link.";
    forgotError.hidden = false;
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetError.hidden = true;

  const token = new URLSearchParams(window.location.search).get("reset");
  try {
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: resetPassword.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "That reset link didn't work.");
    window.history.replaceState({}, "", "/");
    resetForm.hidden = true;
    showApp(data);
  } catch (error) {
    resetError.textContent = error.message ?? "That reset link didn't work.";
    resetError.hidden = false;
  }
});


// ── Bootstrap ──────────────────────────────────────────────────────────────
// Last, so every const above it is initialised before anything runs.
checkAuth();
loadGoogleConfig();


// ── Week style ─────────────────────────────────────────────────────────────
// A whole-day week and a mid-day one are the same stored setting — the
// rollover time — so this is a presentation choice over one field rather than
// a second source of truth that could contradict the first.
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function setWeekStyle(style) {
  weekStyle = style;
  weekStyleWhole.classList.toggle("meal-kind-btn--active", style === "whole");
  weekStyleTime.classList.toggle("meal-kind-btn--active", style === "time");
  weekTimeRow.hidden = style === "whole";
  refreshWeekStyleNote();
}

function refreshWeekStyleNote() {
  const startDay = WEEKDAY_NAMES[Number(settingsWeekday.value) || 0] ?? "Monday";
  const endDay = WEEKDAY_NAMES[(Number(settingsWeekday.value) + 6) % 7] ?? "Sunday";

  if (weekStyle === "whole") {
    weekStyleNote.textContent =
      `Your week runs ${startDay} to ${endDay} — seven whole days, and every day counts once.`;
    return;
  }
  const time = settingsTime.value || "17:00";
  weekStyleNote.textContent =
    `Your week runs ${startDay} ${time} to the following ${startDay} ${time}. It touches eight dates, `
    + `so both ${startDay}s count as half a day and a full week still totals seven.`;
}

weekStyleWhole.addEventListener("click", () => setWeekStyle("whole"));
weekStyleTime.addEventListener("click", () => {
  setWeekStyle("time");
  // Midnight in the time field would silently be a whole-day week, which is
  // the other option — nudge it to the original default instead.
  if (settingsTime.value === "00:00" || !settingsTime.value) settingsTime.value = "17:00";
  refreshWeekStyleNote();
});
settingsWeekday.addEventListener("change", refreshWeekStyleNote);
settingsTime.addEventListener("input", refreshWeekStyleNote);

/** The rollover time to save, which is what encodes the choice. */
function weekStartTimePayload() {
  if (weekStyle === "whole") return { weekStartHour: 0, weekStartMinute: 0 };
  const [hour, minute] = (settingsTime.value || "17:00").split(":").map(Number);
  return { weekStartHour: hour, weekStartMinute: minute };
}


// ── Macro target settings ──────────────────────────────────────────────────
// Two ways of expressing the same thing, because people genuinely think both
// ways: "180g of protein" is a fixed figure whatever the day looks like,
// while "30% protein" moves with the calorie target. Both are stored as
// given rather than converted to one canonical form — see src/macros.ts.
const macroModeOff = document.getElementById("macro-mode-off");
const macroModeGrams = document.getElementById("macro-mode-grams");
const macroModePercent = document.getElementById("macro-mode-percent");
const macroTargetsGrams = document.getElementById("macro-targets-grams");
const macroTargetsPercent = document.getElementById("macro-targets-percent");
const macroSummary = document.getElementById("macro-summary");
const macroWarning = document.getElementById("macro-warning");

const macroGramInputs = {
  protein: document.getElementById("macro-protein-g"),
  carbs: document.getElementById("macro-carbs-g"),
  fat: document.getElementById("macro-fat-g"),
};
const macroOpInputs = {
  protein: document.getElementById("macro-protein-op"),
  carbs: document.getElementById("macro-carbs-op"),
  fat: document.getElementById("macro-fat-op"),
};
const macroPctInputs = {
  protein: document.getElementById("macro-protein-pct"),
  carbs: document.getElementById("macro-carbs-pct"),
  fat: document.getElementById("macro-fat-pct"),
};

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

let macroMode = null;

function setMacroMode(mode) {
  macroMode = mode;
  macroModeOff.classList.toggle("meal-kind-btn--active", mode === null);
  macroModeGrams.classList.toggle("meal-kind-btn--active", mode === "grams");
  macroModePercent.classList.toggle("meal-kind-btn--active", mode === "percent");
  macroTargetsGrams.hidden = mode !== "grams";
  macroTargetsPercent.hidden = mode !== "percent";
  refreshMacroSummary();
}

function readMacroInputs(inputs) {
  const out = {};
  for (const key of ["protein", "carbs", "fat"]) {
    out[key] = inputs[key].value === "" ? null : Number(inputs[key].value);
  }
  return out;
}

/**
 * Live arithmetic under the fields, so you can see what a split actually
 * comes to before saving rather than finding out on the diary screen.
 */
function refreshMacroSummary() {
  macroWarning.hidden = true;

  if (macroMode === null) {
    macroSummary.textContent = "Macros are off — the diary tracks calories only.";
    macroSummary.hidden = false;
    return;
  }

  if (macroMode === "percent") {
    const pct = readMacroInputs(macroPctInputs);
    const total = (pct.protein ?? 0) + (pct.carbs ?? 0) + (pct.fat ?? 0);
    const calorieTarget = settingsCalorieTarget.value === "" ? null : Number(settingsCalorieTarget.value);

    if (!calorieTarget) {
      macroWarning.textContent = "Percentages need a daily calorie target to divide up — set one above first.";
      macroWarning.hidden = false;
      macroSummary.hidden = true;
      return;
    }
    if (total !== 100) {
      macroWarning.textContent = `Your percentages add up to ${total}%. They need to make 100%.`;
      macroWarning.hidden = false;
      macroSummary.hidden = true;
      return;
    }

    const grams = {
      protein: Math.round((calorieTarget * (pct.protein ?? 0)) / 100 / KCAL_PER_GRAM.protein),
      carbs: Math.round((calorieTarget * (pct.carbs ?? 0)) / 100 / KCAL_PER_GRAM.carbs),
      fat: Math.round((calorieTarget * (pct.fat ?? 0)) / 100 / KCAL_PER_GRAM.fat),
    };
    macroSummary.textContent = `That's ${grams.protein}g protein, ${grams.carbs}g carbs and ${grams.fat}g fat a day.`;
    macroSummary.hidden = false;
    return;
  }

  const grams = readMacroInputs(macroGramInputs);
  const tracked = ["protein", "carbs", "fat"].filter((key) => (grams[key] ?? 0) > 0);

  if (tracked.length === 0) {
    macroWarning.textContent = "Set at least one macro target, or switch macros off.";
    macroWarning.hidden = false;
    macroSummary.hidden = true;
    return;
  }

  // Read back as a sentence rather than as a kcal total: once the three can
  // be floors and ceilings, "these come to 2,060 kcal" describes a day that
  // may not exist. "Protein at least 180g, carbs at most 200g" is both true
  // and the thing worth checking before saving.
  const phrases = tracked.map(
    (key) => `${MACRO_LABELS[key].toLowerCase()} ${MACRO_OP_WORDS[macroOpInputs[key].value]} ${grams[key]}g`,
  );
  let text = `Tracking ${listToSentence(phrases)}.`;

  const untracked = ["protein", "carbs", "fat"].filter((key) => !tracked.includes(key));
  if (untracked.length > 0) {
    text += ` ${listToSentence(untracked.map((key) => MACRO_LABELS[key]))} won't be tracked.`;
  }

  // The kcal figure is only a real total when every target is an "about"
  // figure — a floor plus a ceiling doesn't describe one.
  const allAbout = tracked.every((key) => macroOpInputs[key].value === "eq");
  if (allAbout && untracked.length === 0) {
    const kcal = tracked.reduce((sum, key) => sum + (grams[key] ?? 0) * KCAL_PER_GRAM[key], 0);
    text += ` That's ${kcal.toLocaleString()} kcal.`;
    const calorieTarget = settingsCalorieTarget.value === "" ? null : Number(settingsCalorieTarget.value);
    if (calorieTarget && Math.abs(kcal - calorieTarget) >= 100) {
      const diff = kcal - calorieTarget;
      // Not an error — plenty of people set targets that don't reconcile with
      // their calorie goal on purpose. Worth pointing out, not blocking.
      text += diff > 0
        ? ` ${diff.toLocaleString()} more than your calorie target.`
        : ` ${Math.abs(diff).toLocaleString()} kcal of your target left unallocated.`;
    }
  }

  macroSummary.textContent = text;
  macroSummary.hidden = false;
}

function listToSentence(items) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

macroModeOff.addEventListener("click", () => setMacroMode(null));
macroModeGrams.addEventListener("click", () => setMacroMode("grams"));
macroModePercent.addEventListener("click", () => setMacroMode("percent"));

for (const input of [...Object.values(macroGramInputs), ...Object.values(macroPctInputs)]) {
  input.addEventListener("input", refreshMacroSummary);
}
for (const select of Object.values(macroOpInputs)) {
  select.addEventListener("change", refreshMacroSummary);
}
settingsCalorieTarget.addEventListener("input", refreshMacroSummary);

document.getElementById("macro-preset-balanced").addEventListener("click", () => {
  macroPctInputs.protein.value = 30;
  macroPctInputs.carbs.value = 40;
  macroPctInputs.fat.value = 30;
  refreshMacroSummary();
});
document.getElementById("macro-preset-high-protein").addEventListener("click", () => {
  macroPctInputs.protein.value = 40;
  macroPctInputs.carbs.value = 35;
  macroPctInputs.fat.value = 25;
  refreshMacroSummary();
});

function populateMacroSettings(user) {
  // A stored 0 means the same as blank — untracked — so it shows as blank
  // rather than as a target of nothing.
  macroGramInputs.protein.value = user.proteinTargetG || "";
  macroGramInputs.carbs.value = user.carbsTargetG || "";
  macroGramInputs.fat.value = user.fatTargetG || "";
  // Sensible defaults for anyone who had targets before operators existed,
  // and for a first visit: protein is nearly always a floor, fat a ceiling.
  macroOpInputs.protein.value = user.proteinOp ?? "min";
  macroOpInputs.carbs.value = user.carbsOp ?? "max";
  macroOpInputs.fat.value = user.fatOp ?? "max";
  macroPctInputs.protein.value = user.proteinPct ?? "";
  macroPctInputs.carbs.value = user.carbsPct ?? "";
  macroPctInputs.fat.value = user.fatPct ?? "";
  setMacroMode(user.macroMode ?? null);
}

/** The macro fields of the settings PATCH body. */
function macroSettingsPayload() {
  if (macroMode === null) return { macroMode: null };
  if (macroMode === "percent") {
    const pct = readMacroInputs(macroPctInputs);
    return {
      macroMode: "percent",
      proteinPct: pct.protein ?? 0,
      carbsPct: pct.carbs ?? 0,
      fatPct: pct.fat ?? 0,
    };
  }
  const grams = readMacroInputs(macroGramInputs);
  return {
    macroMode: "grams",
    // Null, not 0: a blank field means "don't track this one", and the diary
    // leaves it off entirely rather than showing a target of nothing.
    proteinTargetG: grams.protein || null,
    carbsTargetG: grams.carbs || null,
    fatTargetG: grams.fat || null,
    proteinOp: macroOpInputs.protein.value,
    carbsOp: macroOpInputs.carbs.value,
    fatOp: macroOpInputs.fat.value,
  };
}


// ── Macro averages on the Stats screen ─────────────────────────────────────
const macroStatsCard = document.getElementById("macro-stats-card");
const macroStatsWindow = document.getElementById("macro-stats-window");
const macroStatsNote = document.getElementById("macro-stats-note");
const macroAvgProtein = document.getElementById("macro-avg-protein");
const macroAvgCarbs = document.getElementById("macro-avg-carbs");
const macroAvgFat = document.getElementById("macro-avg-fat");

async function loadMacroStats() {
  try {
    const res = await fetch("/api/stats/macros?days=7");
    if (!res.ok) throw new Error();
    renderMacroStats(await res.json());
  } catch {
    macroStatsCard.hidden = true;
  }
}

function renderMacroStats(data) {
  if (!data?.targets || data.daysComplete === 0) {
    macroStatsCard.hidden = true;
    return;
  }
  macroStatsCard.hidden = false;
  macroStatsWindow.textContent = "last 7 days";

  macroAvgProtein.textContent = data.averages.protein === null ? "—" : `${Math.round(data.averages.protein)}g`;
  macroAvgCarbs.textContent = data.averages.carbs === null ? "—" : `${Math.round(data.averages.carbs)}g`;
  macroAvgFat.textContent = data.averages.fat === null ? "—" : `${Math.round(data.averages.fat)}g`;

  const described = ["protein", "carbs", "fat"]
    .map((key) => (data.targets.targets?.[key] ? `${MACRO_LABELS[key].toLowerCase()} ${MACRO_OP_WORDS[data.targets.targets[key].op]} ${data.targets.targets[key].grams}g` : null))
    .filter(Boolean);
  const parts = described.length > 0 ? [`Against ${listToSentence(described)}.`] : [];
  // Says which days the average is actually over, since days with a
  // pre-macro entry on them are excluded rather than counted as low.
  parts.push(
    data.daysComplete === data.daysLogged
      ? `Averaged over ${pluralDays(data.daysComplete)}.`
      : `Averaged over the ${pluralDays(data.daysComplete)} where every entry had a breakdown, of ${data.daysLogged} logged.`,
  );
  macroStatsNote.textContent = parts.join(" ");
}


// ── Today ──────────────────────────────────────────────────────────────────
// The screen the app opens on: what today looks like so far, and the fastest
// route to adding to it. Everything here comes from one call — this is the
// first thing anyone sees, and five round trips means five chances to render
// half a page.
const todayDateEl = document.getElementById("today-date");
const todayKcalEl = document.getElementById("today-kcal");
const todayRingFill = document.getElementById("today-ring-fill");
const todayRemaining = document.getElementById("today-remaining");
const todayRemainingCaption = document.getElementById("today-remaining-caption");
const todayBurn = document.getElementById("today-burn");
const todayBurnCaption = document.getElementById("today-burn-caption");
const todayNet = document.getElementById("today-net");
const todayNetCaption = document.getElementById("today-net-caption");
const todayPending = document.getElementById("today-pending");
const todayInsightsCard = document.getElementById("today-insights-card");
const todayInsightsList = document.getElementById("today-insights");
const todayBodyCard = document.getElementById("today-body-card");
const todayRecoveryCell = document.getElementById("today-recovery-cell");
const todayRecovery = document.getElementById("today-recovery");
const todaySleepCell = document.getElementById("today-sleep-cell");
const todaySleep = document.getElementById("today-sleep");
const todayEntryList = document.getElementById("today-entry-list");
const todayEntryCount = document.getElementById("today-entry-count");

// Circumference of the r=52 ring in the markup. Kept as a constant rather
// than measured, because getTotalLength() on a hidden SVG returns 0 and the
// ring is hidden until its tab is opened.
const TODAY_RING_CIRCUMFERENCE = 2 * Math.PI * 52;

async function loadToday() {
  try {
    const query = todayViewDate ? `?date=${encodeURIComponent(todayViewDate)}` : "";
    const res = await fetch(`/api/stats/today${query}`);
    if (!res.ok) throw new Error();
    renderToday(await res.json());
  } catch {
    // Offline or a failed call: the banner already says so, and blanking the
    // screen would throw away the last good numbers for no gain.
  }
  loadQuickAdd();
}

function renderToday(data) {
  todayDateEl.textContent = data.label;
  currentTodayDate = data.date;
  viewingToday = data.isToday !== false;
  renderDayNav(data);

  todayEntriesHeading.textContent = viewingToday ? "Logged today" : "Logged that day";

  const eaten = data.kcal.eaten ?? 0;
  todayKcalEl.textContent = eaten.toLocaleString();

  // The ring fills against whatever today is being measured by — the target
  // if there is one, otherwise measured burn. With neither there's nothing
  // for a proportion to be *of*, so it sits empty rather than inventing a
  // denominator.
  const ringBasis = data.kcal.target ?? data.kcal.measuredBurn ?? data.kcal.reference ?? null;
  const pct = ringBasis ? Math.max(0, Math.min(1, eaten / ringBasis)) : 0;
  todayRingFill.style.strokeDasharray = `${TODAY_RING_CIRCUMFERENCE}`;
  todayRingFill.style.strokeDashoffset = `${TODAY_RING_CIRCUMFERENCE * (1 - pct)}`;
  todayRingFill.classList.toggle("today-ring-fill--over", Boolean(ringBasis) && eaten > ringBasis);

  if (data.kcal.target !== null) {
    const left = data.kcal.remaining ?? 0;
    todayRemaining.textContent = Math.abs(left).toLocaleString();
    todayRemainingCaption.textContent = left >= 0 ? "kcal left" : "kcal over";
  } else {
    todayRemaining.textContent = eaten.toLocaleString();
    todayRemainingCaption.textContent = viewingToday ? "logged today" : "logged";
  }

  // Only a measured burn goes in the burn tile. An estimate or a target
  // isn't a burn, and labelling it as one would be a lie about where the
  // number came from.
  const burn = data.kcal.measuredBurn;
  todayBurn.textContent = burn === null ? "—" : burn.toLocaleString();
  todayBurnCaption.textContent = burn === null ? "burn (no tracker)" : "burned so far";

  const netBasis = burn ?? data.kcal.reference ?? null;
  if (netBasis === null) {
    todayNet.textContent = "—";
    todayNetCaption.textContent = "net";
  } else {
    const net = eaten - netBasis;
    todayNet.textContent = `${net > 0 ? "+" : net < 0 ? "−" : ""}${Math.abs(Math.round(net)).toLocaleString()}`;
    todayNetCaption.textContent = burn !== null
      ? "net so far"
      : data.kcal.referenceSource === "target" ? "vs target" : "vs estimate";
  }
  todayNet.className = netBasis !== null && eaten > netBasis ? "today-stat-value today-stat-value--over" : "today-stat-value today-stat-value--under";

  if (data.kcal.pendingEntries > 0) {
    const n = data.kcal.pendingEntries;
    todayPending.textContent = `${n} ${n === 1 ? "entry" : "entries"} couldn't be estimated and isn't counted — tap Edit to add kcal.`;
    todayPending.hidden = false;
  } else {
    todayPending.hidden = true;
  }

  // The target bar and macro rows are the same component the week summary
  // used to carry; they live here now, where today's numbers belong.
  renderTargetToday({ kcal: eaten, macros: data.macros.eaten });

  renderTodayBody(data.whoop);
  renderTodayInsights(data.insights);
  renderTodayEntries(data.entries);
  renderWater(data.waterMl ?? 0);
}

let currentTodayDate = null;

// ── Stepping through days ───────────────────────────────────────────────────
// Null means today. Set to a YYYY-MM-DD key while looking back at an earlier
// day; the arrows mirror the week nav on the diary so the two read the same.
let todayViewDate = null;
// Whether the screen is showing today, which several captions depend on.
let viewingToday = true;

const todayEntriesHeading = document.getElementById("today-entries-heading");

const dayPrevBtn = document.getElementById("day-prev");
const dayNextBtn = document.getElementById("day-next");
const dayPastNote = document.getElementById("day-past-note");
const dayBackToTodayBtn = document.getElementById("day-back-to-today");

function renderDayNav(data) {
  // The server decides how far forward you can go, so the day can never be
  // stepped into the future even if the device clock disagrees.
  dayNextBtn.disabled = !data.nextDate;
  dayPrevBtn.dataset.date = data.previousDate ?? "";
  dayNextBtn.dataset.date = data.nextDate ?? "";

  // Logging always writes to now, so on an earlier day the form would say one
  // thing and do another. It comes off the screen entirely, with a way back.
  const past = !data.isToday;
  dayPastNote.hidden = !past;
  form.hidden = past;
  waterCard.hidden = past;
}

function goToDay(key) {
  if (!key) return;
  todayViewDate = key;
  haptic();
  loadToday();
}

dayPrevBtn.addEventListener("click", () => goToDay(dayPrevBtn.dataset.date));
dayNextBtn.addEventListener("click", () => goToDay(dayNextBtn.dataset.date));
dayBackToTodayBtn.addEventListener("click", () => {
  todayViewDate = null;
  haptic();
  loadToday();
});

function renderTodayBody(whoop) {
  const hasRecovery = whoop?.recoveryScore != null;
  const hasSleep = whoop?.sleepMinutes != null;
  todayBodyCard.hidden = !hasRecovery && !hasSleep;

  todayRecoveryCell.hidden = !hasRecovery;
  if (hasRecovery) {
    todayRecovery.textContent = `${whoop.recoveryScore}%`;
    // WHOOP's own bands, so the colour means the same here as it does in
    // their app rather than being a second opinion.
    todayRecovery.className =
      whoop.recoveryScore >= 67 ? "balance-number recovery--high"
      : whoop.recoveryScore >= 34 ? "balance-number recovery--mid"
      : "balance-number recovery--low";
  }

  todaySleepCell.hidden = !hasSleep;
  if (hasSleep) todaySleep.textContent = formatSleepDuration(whoop.sleepMinutes);
}

function renderTodayInsights(insights) {
  todayInsightsList.innerHTML = "";
  if (!insights || insights.length === 0) {
    todayInsightsCard.hidden = true;
    return;
  }
  todayInsightsCard.hidden = false;
  for (const insight of insights) {
    const li = document.createElement("li");
    li.textContent = insight.text;
    todayInsightsList.appendChild(li);
  }
}

function renderTodayEntries(entries) {
  todayEntryList.innerHTML = "";
  todayEntryCount.textContent = entries.length === 0
    ? ""
    : `${entries.length} ${entries.length === 1 ? "item" : "items"}`;

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted today-empty";
    empty.textContent = viewingToday ? "Nothing logged yet today." : "Nothing was logged that day.";
    todayEntryList.appendChild(empty);
    return;
  }
  // Reuses the diary's own row, so editing, repeating, deleting and the
  // photo thumbnail all behave identically in both places.
  for (const entry of entries) todayEntryList.appendChild(renderEntryRow(entry));
}
