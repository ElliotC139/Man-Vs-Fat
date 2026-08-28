function icon(paths, extraClass = "") {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24">${paths}</svg>`;
}
const ICONS = {
  plus: icon('<path d="M5 12h14M12 5v14"/>'),
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
};

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const authForm = document.getElementById("auth-form");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const googleSigninBtn = document.getElementById("google-signin-btn");
const authDivider = document.getElementById("auth-divider");

const settingsToggle = document.getElementById("settings-toggle");
const settingsScreen = document.getElementById("settings-screen");
const settingsBack = document.getElementById("settings-back");
const settingsUsername = document.getElementById("settings-username");
const settingsWeekday = document.getElementById("settings-weekday");
const settingsTime = document.getElementById("settings-time");
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
const balanceDiffCell = document.getElementById("balance-diff-cell");
const balanceDiff = document.getElementById("balance-diff");
const balanceDiffCaption = document.getElementById("balance-diff-caption");
const balanceKgCell = document.getElementById("balance-kg-cell");
const balanceKg = document.getElementById("balance-kg");
const balanceKgCaption = document.getElementById("balance-kg-caption");

const foodLibraryToggle = document.getElementById("food-library-toggle");
const foodLibraryScreen = document.getElementById("food-library-screen");
const foodLibraryBack = document.getElementById("food-library-back");
const foodSearchInput = document.getElementById("food-search");
const foodFavoritesSection = document.getElementById("food-favorites-section");
const foodFavoritesList = document.getElementById("food-favorites-list");
const foodAllList = document.getElementById("food-all-list");
const foodLibraryError = document.getElementById("food-library-error");

const statsToggle = document.getElementById("stats-toggle");
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

const productCard = document.getElementById("product-card");
const productNameEl = document.getElementById("product-name-el");
const productBrandEl = document.getElementById("product-brand-el");
const productServingInput = document.getElementById("product-serving-input");
const productKcalEl = document.getElementById("product-kcal-el");
const productNodataEl = document.getElementById("product-nodata-el");
const productLogBtn = document.getElementById("product-log-btn");
const productRescanBtn = document.getElementById("product-rescan-btn");
const productErrEl = document.getElementById("product-err-el");

const resultCard = document.getElementById("result-card");
const resultWarning = document.getElementById("result-warning");
const resultRows = document.getElementById("result-rows");
const resultSave = document.getElementById("result-save");
const resultDismiss = document.getElementById("result-dismiss");

const weekRangeEl = document.getElementById("week-range");
const weekPrevBtn = document.getElementById("week-prev");
const weekNextBtn = document.getElementById("week-next");
const weekNoteEl = document.getElementById("week-note");
const weekTotalEl = document.getElementById("week-total");
const weekAvgEl = document.getElementById("week-avg");
const daysLoggedEl = document.getElementById("days-logged");
const weekNetSummaryEl = document.getElementById("week-net-summary");
const dailyTotalsEl = document.getElementById("daily-totals");
const entryListEl = document.getElementById("entry-list");
const pendingNoteEl = document.getElementById("pending-note");
const exportPdfEl = document.getElementById("export-pdf");

let weeksAgo = 0;
let userWeekStartWeekday = 0; // 0=Mon … 6=Sun (same encoding as settings select)
let userWeekStartHour = 17;
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
  if (!dateInputValue) return false;
  const [year, month, day] = dateInputValue.split("-").map(Number);
  // App weekday: 0=Mon…6=Sun → JS getDay(): Mon=1…Sun=0, so JS day = (appWeekday+1)%7
  const rolloverJsDay = (userWeekStartWeekday + 1) % 7;
  return new Date(year, month - 1, day).getDay() === rolloverJsDay;
}

function renderResultRows(entries) {
  resultRows.innerHTML = "";
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "result-row";
    row.dataset.id = entry.id;

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = entry.label;
    labelInput.setAttribute("aria-label", "Label");

    const kcalInput = document.createElement("input");
    kcalInput.type = "number";
    kcalInput.min = "0";
    kcalInput.inputMode = "numeric";
    kcalInput.value = entry.kcal ?? "";
    if (entry.kcal === null) kcalInput.placeholder = "kcal?";
    kcalInput.setAttribute("aria-label", "Kcal");

    row.append(labelInput, kcalInput);
    resultRows.appendChild(row);
  }
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
  resultCard.hidden = true;
  loadWeek();
});

weekNextBtn.addEventListener("click", () => {
  if (weeksAgo === 0) return;
  weeksAgo -= 1;
  resultCard.hidden = true;
  loadWeek();
});

async function loadWeek() {
  const res = await fetch(`/api/match-weeks/current?weeksAgo=${weeksAgo}`);
  const week = await res.json();

  // Fire-and-forget: the strip is a convenience, and waiting on it would
  // hold up the week the user actually asked for.
  loadQuickAdd();

  weekRangeEl.textContent = `${dateFmt.format(new Date(week.startsAt))} – ${dateFmt.format(
    new Date(new Date(week.endsAt).getTime() - 1000),
  )}`;
  weekNextBtn.disabled = weeksAgo === 0;
  weekTotalEl.textContent = week.totalKcal;
  weekAvgEl.textContent = week.dailyAverage;
  daysLoggedEl.textContent = week.daysLogged;
  exportPdfEl.href = `/api/match-weeks/current/report.pdf?weeksAgo=${weeksAgo}`;

  form.hidden = weeksAgo !== 0;
  weekNoteEl.hidden = weeksAgo === 0;
  exerciseToggle.hidden = weeksAgo !== 0;
  if (weeksAgo !== 0) { exerciseForm.hidden = true; exerciseToggle.innerHTML = `${ICONS.plus} Log exercise`; }
  const todayJsDay = new Date().getDay();
  logWeekRow.hidden = weeksAgo !== 0 || todayJsDay !== (userWeekStartWeekday + 1) % 7;

  if (week.pendingEstimates > 0) {
    const plural = week.pendingEstimates > 1 ? "entries" : "entry";
    pendingNoteEl.textContent = `${week.pendingEstimates} ${plural} couldn't be estimated and isn't counted yet — tap Edit to add kcal.`;
    pendingNoteEl.hidden = false;
  } else {
    pendingNoteEl.hidden = true;
  }

  renderDailyTotals(week.dailyTotals ?? [], week.whoop?.dailyBurn ?? []);
  renderEntries(week.entries);
  renderExercises(week.exercises ?? []);
  renderBudgetWidget(week);
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
    headingLabel.textContent = isToday ? `Today · ${dayFmt.format(date)}` : dayFmt.format(date);

    const headingKcal = document.createElement("span");
    headingKcal.textContent = dayPending ? `${dayKcal} kcal + pending` : `${dayKcal} kcal`;

    heading.append(headingLabel, headingKcal);
    group.appendChild(heading);

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

  const time = document.createElement("div");
  time.className = "entry-time";
  time.textContent = timeFmt.format(new Date(entry.timestamp));

  const label = document.createElement("div");
  label.className = "entry-label";
  label.textContent = entry.label;

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

  row.append(time, label, kcal, actions);
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
    loadWeek();
  });

  editRow.append(labelInput, kcalInput, dateInput, weekSelect, saveBtn);
  row.appendChild(editRow);
}

async function deleteEntry(id) {
  await fetch(`/api/entries/${id}`, { method: "DELETE" });
  loadWeek();
}

async function repeatEntry(id) {
  await fetch(`/api/entries/${id}/repeat`, { method: "POST" });
  weeksAgo = 0;
  loadWeek();
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
      res = await fetch("/api/entries", { method: "POST", body: data });
    } catch (error) {
      // No connection: keep what was typed rather than losing it to an error
      // message. It goes out as soon as the network is back.
      if (!isNetworkFailure(error)) throw error;
      await enqueue({
        kind: "entry",
        payload: { text, photo: photo ?? null, photoName: photo?.name ?? null, lastWeek: logToLastWeek },
      });
      form.reset();
      photoStatus.textContent = "Add a photo (optional)";
      logToLastWeek = false;
      logWeekCurrentBtn.classList.add("log-week-btn--active");
      logWeekLastBtn.classList.remove("log-week-btn--active");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ? JSON.stringify(body.error) : "Failed to log entry");
    }
    const entries = await res.json();
    renderResultRows(entries);
    if (entries.some((e) => e.kcal === null)) {
      resultWarning.textContent = "Couldn't estimate kcal for this one (the AI service had a hiccup) — enter it below.";
      resultWarning.hidden = false;
    } else {
      resultWarning.hidden = true;
    }
    resultCard.hidden = false;

    form.reset();
    photoStatus.textContent = "Add a photo (optional)";
    logToLastWeek = false;
    logWeekCurrentBtn.classList.add("log-week-btn--active");
    logWeekLastBtn.classList.remove("log-week-btn--active");
    await loadWeek();
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log it";
  }
});

resultSave.addEventListener("click", async () => {
  const rows = resultRows.querySelectorAll(".result-row");
  await Promise.all(
    Array.from(rows).map((row) => {
      const [labelInput, kcalInput] = row.querySelectorAll("input");
      return fetch(`/api/entries/${row.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: labelInput.value.trim(),
          kcal: kcalInput.value === "" ? null : Number(kcalInput.value),
        }),
      });
    }),
  );
  resultCard.hidden = true;
  loadWeek();
});

resultDismiss.addEventListener("click", () => {
  resultCard.hidden = true;
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
  authDivider.hidden = false;
}

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

function openSettings() {
  appShell.hidden = true;
  settingsScreen.hidden = false;
  refreshPushUi();
}

function closeSettings() {
  settingsScreen.hidden = true;
  appShell.hidden = false;
}

settingsToggle.addEventListener("click", openSettings);
settingsBack.addEventListener("click", closeSettings);

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  showAuthScreen();
});

settingsSave.addEventListener("click", async () => {
  settingsError.hidden = true;
  const [hour, minute] = settingsTime.value.split(":").map(Number);

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
        weekStartHour: hour,
        weekStartMinute: minute,
        weightKg: weightVal,
        heightCm: heightVal,
        ageYears: ageVal,
        activityLevel: activityVal,
        weeklyGoalKg: goalVal,
        goalWeightKg: goalWeightVal,
        reminderHour: settingsReminderHour.value === "" ? null : Number(settingsReminderHour.value),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save settings.");
    }
    populateSettings(body);
    closeSettings();
    weeksAgo = 0;
    loadWeek();
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
    appShell.hidden = false;
  }

  loadWeek();
  // Awaited so a redirect error set below isn't silently overwritten by the
  // status fetch's own (less specific) message resolving afterward.
  await loadWhoopStatus();
  handleWhoopRedirect();
  handleLaunchParams();
  refreshOfflineBanner();
  flushQueue();
}

// WHOOP's OAuth callback redirects back to "/" with a query param — surface
// the result once, then strip it so a page refresh doesn't repeat it.
function handleWhoopRedirect() {
  const params = new URLSearchParams(window.location.search);
  const whoopResult = params.get("whoop");
  if (!whoopResult) return;

  if (whoopResult === "connected") {
    openSettings();
  } else if (whoopResult === "error") {
    openSettings();
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
  authScreen.hidden = false;
  setAuthMode("login");
  authForm.reset();
}

async function checkAuth() {
  const res = await fetch("/api/auth/me");
  if (res.ok) {
    showApp(await res.json());
  } else {
    showAuthScreen();
  }
}

checkAuth();
loadGoogleConfig();

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

    const delBtn = document.createElement("button");
    delBtn.className = "exercise-del";
    delBtn.innerHTML = ICONS.x;
    delBtn.type = "button";
    // Auto-imported entries reappear on the next WHOOP sync since they're
    // matched by the workout's own id, not tracked as user-deleted.
    if (ex.fromWhoop) delBtn.title = "Auto-imported from WHOOP — will reappear on next sync";
    delBtn.addEventListener("click", () => deleteExercise(ex.id));

    row.append(icon, label, kcal, delBtn);
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

  if (whoop?.connected && whoop.dailyBurn) {
    caloriesOut = 0;
    for (const d of whoop.dailyBurn) {
      if (d.future || d.kcalWeighted == null) continue;
      caloriesOut += d.kcalWeighted;
    }
    sourceLabel = "WHOOP";
  } else {
    const tdee = calculateTdee(currentUser);
    if (tdee && week.daysLogged > 0) {
      caloriesOut = Math.round(tdee * week.daysLogged);
      sourceLabel = "estimated";
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

  // Direct so-far numbers — no projection to the rest of the week.
  const net = caloriesIn - caloriesOut; // positive = surplus, negative = deficit
  const kgChange = -net / 7700; // positive = lost, negative = gained

  balanceDiffCell.className = "balance-cell";
  balanceKgCell.className = "balance-cell";

  if (net <= 0) {
    balanceDiffCell.classList.add("balance-cell--loss");
    balanceDiff.textContent = `−${Math.abs(net).toLocaleString()}`;
    balanceDiffCaption.textContent = "kcal deficit";
  } else {
    balanceDiffCell.classList.add("balance-cell--gain");
    balanceDiff.textContent = `+${net.toLocaleString()}`;
    balanceDiffCaption.textContent = "kcal surplus";
  }

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
let currentProduct = null; // { name, brand, kcalPer100g, defaultServing }

function openScanner() {
  productCard.hidden = true;
  scanModal.hidden = false;
  scanStatusEl.textContent = "Searching for barcode…";

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      scanStream = stream;
      scanVideo.srcObject = stream;
      scanVideo.play();
      if (typeof BarcodeDetector !== "undefined") {
        runBarcodeDetectorLoop();
      } else {
        loadQuagga2().then(runQuaggaLoop);
      }
    })
    .catch(() => {
      scanStatusEl.textContent = "Camera access denied — please allow camera use and try again.";
    });
}

function stopScanner() {
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  if (scanRafId) {
    cancelAnimationFrame(scanRafId);
    scanRafId = null;
  }
  quaggaLoopActive = false;
  scanVideo.srcObject = null;
  scanModal.hidden = true;
}

// Native BarcodeDetector (Chrome, Edge, Android WebView)
function runBarcodeDetectorLoop() {
  const detector = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
  });

  async function tick() {
    if (!scanStream) return;
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
    if (!quaggaLoopActive || !scanStream) return;
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
  stopScanner();
  scanStatusEl.textContent = "Looking up product…";
  productCard.hidden = false;
  productNameEl.textContent = "Looking up…";
  productBrandEl.textContent = "";
  productKcalEl.textContent = "";
  productNodataEl.hidden = true;
  productErrEl.hidden = true;

  const product = await lookupOpenFoodFacts(code);
  currentProduct = product;
  showProductCard(product, code);
}

async function lookupOpenFoodFacts(barcode) {
  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
      `?fields=product_name,brands,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url);
    if (!res.ok) return { barcode, name: null, brand: null, kcalPer100g: null, defaultServing: null };
    const data = await res.json();
    if (data.status !== 1) return { barcode, name: null, brand: null, kcalPer100g: null, defaultServing: null };
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
      defaultServing,
    };
  } catch {
    return { barcode, name: null, brand: null, kcalPer100g: null, defaultServing: null };
  }
}

function showProductCard(product, barcode) {
  productCard.hidden = false;
  productNameEl.textContent = product.name || `Barcode: ${barcode}`;
  productBrandEl.textContent = product.brand || "";
  productBrandEl.hidden = !product.brand;

  const hasKcal = product.kcalPer100g !== null;
  productNodataEl.hidden = hasKcal;

  if (hasKcal) {
    productServingInput.value = product.defaultServing ?? 100;
    productServingInput.hidden = false;
    updateKcalDisplay();
  } else {
    productServingInput.value = "";
    productServingInput.hidden = true;
    productKcalEl.textContent = "";
  }

  currentProduct = product;
}

function updateKcalDisplay() {
  if (!currentProduct?.kcalPer100g) { productKcalEl.textContent = ""; return; }
  const g = Number(productServingInput.value) || 0;
  const kcal = Math.round((currentProduct.kcalPer100g * g) / 100);
  productKcalEl.textContent = g > 0 ? `${kcal} kcal` : "";
}

productServingInput.addEventListener("input", updateKcalDisplay);

productLogBtn.addEventListener("click", async () => {
  if (!currentProduct) return;

  const g = Number(productServingInput.value) || 0;
  let directKcal = null;
  if (currentProduct.kcalPer100g && g > 0) {
    directKcal = Math.round((currentProduct.kcalPer100g * g) / 100);
  }
  const label = [currentProduct.name, currentProduct.brand].filter(Boolean).join(" – ") || `Barcode: ${currentProduct.barcode}`;

  productLogBtn.disabled = true;
  productErrEl.hidden = true;

  try {
    const body = new FormData();
    body.append("text", label);
    if (directKcal) body.append("directKcal", String(directKcal));

    const res = await fetch("/api/entries", { method: "POST", body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      productErrEl.textContent = err.error || "Failed to log entry.";
      productErrEl.hidden = false;
      return;
    }

    productCard.hidden = true;
    currentProduct = null;
    textInput.value = "";
    await loadWeek();
  } catch {
    productErrEl.textContent = "Network error — please try again.";
    productErrEl.hidden = false;
  } finally {
    productLogBtn.disabled = false;
  }
});

// ── Food library ────────────────────────────────────────────────────────────
let foodSearchTimer = null;

function openFoodLibrary() {
  appShell.hidden = true;
  foodLibraryScreen.hidden = false;
  foodSearchInput.value = "";
  foodLibraryError.hidden = true;
  closeMealEditor();
  loadFoods("");
  loadMeals();
}

function closeFoodLibrary() {
  foodLibraryScreen.hidden = true;
  appShell.hidden = false;
  // Meals and favourites can have changed while the library was open, and
  // the quick-add strip is built from both — without this a meal saved a
  // moment ago wouldn't appear until the next full page load.
  loadQuickAdd();
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
      btn.innerHTML = `Added ${ICONS.check}`;
      await loadWeek();
      setTimeout(() => {
        btn.textContent = "+Today";
        btn.disabled = false;
      }, 1200);
    } else {
      btn.textContent = "+Today";
      btn.disabled = false;
    }
  } catch {
    btn.textContent = "+Today";
    btn.disabled = false;
  }
}

foodLibraryToggle.addEventListener("click", openFoodLibrary);
foodLibraryBack.addEventListener("click", closeFoodLibrary);
foodSearchInput.addEventListener("input", () => {
  clearTimeout(foodSearchTimer);
  foodSearchTimer = setTimeout(() => loadFoods(foodSearchInput.value), 250);
});

productRescanBtn.addEventListener("click", () => {
  productCard.hidden = true;
  currentProduct = null;
  openScanner();
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

function openStats() {
  appShell.hidden = true;
  statsScreen.hidden = false;
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
  loadTdee();
}

function closeStats() {
  statsScreen.hidden = true;
  appShell.hidden = false;
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

function renderStatsSummary(data) {
  statAvgKcal.textContent = data.avgKcalPerDay !== null && data.avgKcalPerDay !== undefined ? String(data.avgKcalPerDay) : "—";

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
  const direction = data.trendChangeKg <= 0 ? "lost" : "gained";
  tdeeExplain.textContent =
    `Worked out from what you actually ate and the ${kgToDisplay(Math.abs(data.trendChangeKg))} ${weightUnit()} you ` +
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

function showTooltip(target) {
  const tip = document.createElement("div");
  tip.className = "app-tooltip";
  tip.textContent = target.dataset.tooltip;
  document.body.appendChild(tip);

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
  tip.classList.add(`app-tooltip--${placement}`);
  tip.style.top = `${top}px`;

  // Keep the box on screen, then slide the caret back the other way by
  // however far the box had to move, so it still points at the point.
  const half = tipRect.width / 2;
  const clampedX = Math.min(Math.max(anchorX, half + 8), window.innerWidth - half - 8);
  tip.style.left = `${clampedX}px`;
  tip.style.setProperty("--caret-offset", `${anchorX - clampedX}px`);

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
window.addEventListener("scroll", hideTooltip, true);

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
  breakdownRecoveryCard.hidden = !hasAny("avgRecovery");

  breakdownWeightBody.innerHTML = "";
  breakdownCaloriesBody.innerHTML = "";
  breakdownRecoveryBody.innerHTML = "";

  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i];

    const weightRow = document.createElement("tr");
    makeRowTappable(weightRow, week);
    weightRow.appendChild(weekOfCell(week));
    const weight = document.createElement("td");
    if (week.weightChangeKg !== null) {
      const sign = week.weightChangeKg <= 0 ? "-" : "+";
      weight.textContent = `${sign}${kgToDisplay(Math.abs(week.weightChangeKg))} ${weightUnit()}`;
      weight.className = week.weightChangeKg <= 0 ? "breakdown-loss" : "breakdown-gain";
    } else {
      weight.textContent = "—";
    }
    weightRow.appendChild(weight);
    breakdownWeightBody.appendChild(weightRow);

    const kcalDetail =
      week.avgKcalPerDay !== null ? `logged ${week.daysWithEntries} of 7 days` : undefined;
    const caloriesRow = document.createElement("tr");
    makeRowTappable(caloriesRow, week, kcalDetail);
    caloriesRow.appendChild(weekOfCell(week));
    const kcal = document.createElement("td");
    kcal.textContent = week.avgKcalPerDay !== null ? week.avgKcalPerDay.toLocaleString() : "—";
    caloriesRow.appendChild(kcal);
    const workouts = document.createElement("td");
    workouts.textContent = String(week.workoutCount);
    caloriesRow.appendChild(workouts);
    breakdownCaloriesBody.appendChild(caloriesRow);

    const recoveryRow = document.createElement("tr");
    makeRowTappable(recoveryRow, week);
    recoveryRow.appendChild(weekOfCell(week));
    const recovery = document.createElement("td");
    recovery.textContent = week.avgRecovery !== null ? `${week.avgRecovery}%` : "—";
    recoveryRow.appendChild(recovery);
    breakdownRecoveryBody.appendChild(recoveryRow);
  }
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

statsToggle.addEventListener("click", openStats);
statsBack.addEventListener("click", closeStats);

// ── Desktop nav ─────────────────────────────────────────────────────────────
// Wide-viewport tab bar (see .desktop-nav in style.css) that replaces the
// mobile corner icons — every screen carries an identical copy of it, wired
// to the same open/close functions the icons already use.
function navTo(target) {
  if (!settingsScreen.hidden && target !== "settings") closeSettings();
  if (!foodLibraryScreen.hidden && target !== "food-library") closeFoodLibrary();
  if (!statsScreen.hidden && target !== "stats") closeStats();

  if (target === "food-library" && foodLibraryScreen.hidden) openFoodLibrary();
  else if (target === "stats" && statsScreen.hidden) openStats();
  else if (target === "settings" && settingsScreen.hidden) openSettings();
}

document.querySelectorAll(".desktop-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => navTo(btn.dataset.nav));
});

// ── Where a calorie figure came from ────────────────────────────────────────
// Entry.source (see prisma/schema.prisma) records whether a number was
// estimated, looked up, or typed. Only the two that change how much to trust
// the figure get a badge — a hand-typed or copied number needs no comment.
const SOURCE_BADGES = {
  ai: { text: "est.", cls: "entry-source--est", title: "Estimated by AI from what you described" },
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

const QUICK_ADD_FOODS = 6;

async function loadQuickAdd() {
  try {
    const [mealsRes, foodsRes] = await Promise.all([fetch("/api/meals"), fetch("/api/foods")]);
    if (!mealsRes.ok || !foodsRes.ok) throw new Error();
    const meals = await mealsRes.json();
    const foods = await foodsRes.json();
    renderQuickAdd(meals, foods);
  } catch {
    // A failed quick-add strip shouldn't shout — the form below still works.
    quickAddCard.hidden = true;
  }
}

function renderQuickAdd(meals, foods) {
  quickAddChips.innerHTML = "";
  quickAddError.hidden = true;

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
        label: meal.name,
        sub: meal.kind === "recipe" ? portionSubtitle(meal) : `${meal.items.length} items`,
        kind: "meal",
        onTap: () => logSavedMeal(meal),
      }),
    );
  }

  for (const food of topFoods) {
    quickAddChips.appendChild(
      quickChip({
        label: food.label,
        sub: food.kcal !== null ? `${food.kcal} kcal` : null,
        kind: "food",
        favorite: food.favorite,
        onTap: () => quickLogFood(food),
      }),
    );
  }

  quickAddCard.hidden = quickAddChips.childElementCount === 0;
}

function portionSubtitle(meal) {
  return meal.kcalPerServing !== null ? `${meal.kcalPerServing} kcal / portion` : "recipe";
}

function quickChip({ label, sub, kind, favorite, onTap }) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `quick-chip quick-chip--${kind}`;

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

  chip.addEventListener("click", async () => {
    if (chip.disabled) return;
    chip.disabled = true;
    chip.classList.add("quick-chip--busy");
    try {
      await onTap();
    } finally {
      chip.disabled = false;
      chip.classList.remove("quick-chip--busy");
    }
  });
  return chip;
}

function showQuickAddError(message) {
  quickAddError.textContent = message;
  quickAddError.hidden = false;
}

async function quickLogFood(food) {
  try {
    const res = await fetch("/api/foods/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelKey: food.labelKey }),
    });
    if (!res.ok) throw new Error();
    quickAddError.hidden = true;
    await loadWeek();
  } catch {
    showQuickAddError(`Couldn't log ${food.label} — please try again.`);
  }
}

// A recipe needs to know how much was eaten before it can be logged; a
// template is the whole thing by definition, so it goes straight in.
async function logSavedMeal(meal) {
  let servings = 1;
  if (meal.kind === "recipe") {
    const answer = window.prompt(`How many portions of ${meal.name}?`, "1");
    if (answer === null) return;
    servings = Number(answer);
    if (!Number.isFinite(servings) || servings <= 0) {
      showQuickAddError("Enter a number of portions greater than zero.");
      return;
    }
  }
  try {
    const res = await fetch(`/api/meals/${meal.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servings }),
    });
    if (!res.ok) throw new Error();
    quickAddError.hidden = true;
    await loadWeek();
  } catch {
    showQuickAddError(`Couldn't log ${meal.name} — please try again.`);
  }
}

quickAddManage.addEventListener("click", () => navTo("food-library"));

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
      await logSavedMeal(meal);
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
    row.addEventListener("click", () => {
      foodSearchCard.hidden = true;
      currentProduct = product;
      showProductCard(product, product.barcode ?? "");
      productCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    openStats();
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

const offlineBanner = document.getElementById("offline-banner");
const offlineBannerText = document.getElementById("offline-banner-text");

async function refreshOfflineBanner() {
  const items = await queuedItems();
  const offline = !navigator.onLine;

  if (!offline && items.length === 0) {
    offlineBanner.hidden = true;
    return;
  }

  offlineBanner.hidden = false;
  offlineBanner.classList.toggle("offline-banner--waiting", items.length > 0);
  if (items.length > 0) {
    const noun = items.length === 1 ? "entry" : "entries";
    offlineBannerText.textContent = offline
      ? `Offline — ${items.length} ${noun} saved on this device, and will sync when you're back.`
      : `Syncing ${items.length} ${noun} saved while you were offline…`;
  } else {
    offlineBannerText.textContent = "Offline — anything you log now is saved here and synced later.";
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
      await loadWeek();
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
});
window.addEventListener("offline", refreshOfflineBanner);

// ── Service worker ──────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // Not fatal: without a worker the app simply needs a connection.
      console.warn("Service worker registration failed:", error);
    });
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
  appShell.hidden = false;
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
