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
const statStreak = document.getElementById("stat-streak");

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

  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.type = "button";
  editBtn.addEventListener("click", () => enterEditMode(row, entry));
  const repeatBtn = document.createElement("button");
  repeatBtn.textContent = "+Today";
  repeatBtn.type = "button";
  repeatBtn.setAttribute("aria-label", "Add to today");
  repeatBtn.addEventListener("click", () => repeatEntry(entry.id));
  const delBtn = document.createElement("button");
  delBtn.innerHTML = ICONS.x;
  delBtn.type = "button";
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
    const res = await fetch("/api/entries", { method: "POST", body: data });
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
    showApp(body);
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
}

async function showApp(user) {
  populateSettings(user);
  settingsScreen.hidden = true;
  authScreen.hidden = true;
  appShell.hidden = false;
  loadWeek();
  // Awaited so a redirect error set below isn't silently overwritten by the
  // status fetch's own (less specific) message resolving afterward.
  await loadWhoopStatus();
  handleWhoopRedirect();
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
  loadFoods("");
}

function closeFoodLibrary() {
  foodLibraryScreen.hidden = true;
  appShell.hidden = false;
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

function openStats() {
  appShell.hidden = true;
  statsScreen.hidden = false;
  weighinError.hidden = true;
  weighinDate.max = todayDateValue();
  weighinDate.value = todayDateValue();
  weighinWeight.value = "";
  applyWeighinUnitFields();
  loadWeighIns();
  loadWhoopRecent();
  loadStatsSummary();
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
    statStreak.textContent = "—";
    weighinPaceCell.hidden = true;
  }
}

function renderStatsSummary(data) {
  statAvgKcal.textContent = data.avgKcalPerDay !== null && data.avgKcalPerDay !== undefined ? String(data.avgKcalPerDay) : "—";
  statStreak.textContent = String(data.loggingStreakDays ?? 0);

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
}

function renderWeighinChart() {
  if (weighIns.length < 2) {
    weighinChartCard.hidden = true;
    weighinChart.innerHTML = "";
    return;
  }
  weighinChartCard.hidden = false;

  const weights = weighIns.map((w) => w.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const padLeft = 38; // room for the min/max value labels
  const padRight = 8;
  const padY = 16;
  const w = 300;
  const h = 120;

  const yFor = (kg) => h - padY - ((kg - min) / range) * (h - padY * 2);

  const points = weighIns.map((entry, i) => ({
    x: padLeft + (i / (weighIns.length - 1)) * (w - padLeft - padRight),
    y: yFor(entry.weightKg),
  }));

  const linePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const circles = points
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" class="weighin-chart-point" />`)
    .join("");

  const maxY = yFor(max);
  const minY = yFor(min);
  const gridlines =
    `<line x1="${padLeft}" y1="${maxY.toFixed(1)}" x2="${w - padRight}" y2="${maxY.toFixed(1)}" class="weighin-chart-grid" />` +
    `<line x1="${padLeft}" y1="${minY.toFixed(1)}" x2="${w - padRight}" y2="${minY.toFixed(1)}" class="weighin-chart-grid" />`;
  const labels =
    `<text x="0" y="${(maxY + 3).toFixed(1)}" class="weighin-chart-label">${kgToDisplay(max)}${weightUnit()}</text>` +
    `<text x="0" y="${(minY + 3).toFixed(1)}" class="weighin-chart-label">${kgToDisplay(min)}${weightUnit()}</text>`;

  weighinChart.innerHTML = `${gridlines}${labels}<polyline points="${linePoints}" class="weighin-chart-line" />${circles}`;
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
    const res = await fetch("/api/weigh-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, weightKg: displayToKg(rawWeight) }),
    });
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
