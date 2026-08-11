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
const settingsCard = document.getElementById("settings-card");
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

const budgetWidget = document.getElementById("budget-widget");
const budgetWeeklyLabel = document.getElementById("budget-weekly-label");
const budgetTodayTarget = document.getElementById("budget-today-target");
const budgetBarFill = document.getElementById("budget-bar-fill");
const budgetTodayConsumed = document.getElementById("budget-today-consumed");
const budgetTodayRemaining = document.getElementById("budget-today-remaining");
const budgetWeekDetail = document.getElementById("budget-week-detail");

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
  photoStatus.textContent = photoInput.files?.[0] ? `📷 ${photoInput.files[0].name}` : "📷 Add a photo (optional)";
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
  if (weeksAgo !== 0) { exerciseForm.hidden = true; exerciseToggle.textContent = "+ Log exercise"; }
  const todayJsDay = new Date().getDay();
  logWeekRow.hidden = weeksAgo !== 0 || todayJsDay !== (userWeekStartWeekday + 1) % 7;

  if (week.pendingEstimates > 0) {
    const plural = week.pendingEstimates > 1 ? "entries" : "entry";
    pendingNoteEl.textContent = `${week.pendingEstimates} ${plural} couldn't be estimated and isn't counted yet — tap Edit to add kcal.`;
    pendingNoteEl.hidden = false;
  } else {
    pendingNoteEl.hidden = true;
  }

  renderDailyTotals(week.dailyTotals ?? []);
  renderEntries(week.entries);
  renderExercises(week.exercises ?? []);
  renderBudgetWidget(week);
}

function renderDailyTotals(days) {
  dailyTotalsEl.innerHTML = "";
  for (const day of days) {
    const row = document.createElement("div");
    row.className = day.isToday ? "day-total-row day-total-row--today" : "day-total-row";

    const label = document.createElement("span");
    label.className = "day-total-label";
    label.textContent = day.isToday ? `Today · ${day.label}` : day.label;

    const kcal = document.createElement("span");
    kcal.className = "day-total-kcal";
    kcal.textContent = day.pending ? `${day.kcal} kcal + pending` : `${day.kcal} kcal`;

    row.append(label, kcal);
    dailyTotalsEl.appendChild(row);
  }
}

function renderEntries(entries) {
  entryListEl.innerHTML = "";

  if (entries.length === 0) {
    entryListEl.innerHTML = '<p class="empty-state">Nothing logged yet this week.</p>';
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
  delBtn.textContent = "✕";
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
    photoStatus.textContent = "📷 Add a photo (optional)";
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

settingsToggle.addEventListener("click", () => {
  settingsCard.hidden = !settingsCard.hidden;
});

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
    settingsCard.hidden = true;
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

function showApp(user) {
  populateSettings(user);
  settingsCard.hidden = true;
  authScreen.hidden = true;
  appShell.hidden = false;
  loadWeek();
}

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
    ? `📷 ${exercisePhotoInput.files[0].name}`
    : "📷 Add a screenshot (optional)";
});

// ── Exercise form toggle ───────────────────────────────────────────────────
exerciseToggle.addEventListener("click", () => {
  const hidden = exerciseForm.hidden;
  exerciseForm.hidden = !hidden;
  exerciseToggle.textContent = hidden ? "✕ Cancel" : "+ Log exercise";
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
    exercisePhotoStatus.textContent = "📷 Add a screenshot (optional)";
    exerciseForm.hidden = true;
    exerciseToggle.textContent = "+ Log exercise";
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
    icon.textContent = "🏃";

    const label = document.createElement("span");
    label.className = "exercise-label";
    label.textContent = ex.description;

    const kcal = document.createElement("span");
    kcal.className = "exercise-kcal";
    kcal.textContent = ex.kcalBurned !== null ? `−${ex.kcalBurned} kcal` : "kcal unknown";

    const delBtn = document.createElement("button");
    delBtn.className = "exercise-del";
    delBtn.textContent = "✕";
    delBtn.type = "button";
    delBtn.addEventListener("click", () => deleteExercise(ex.id));

    row.append(icon, label, kcal, delBtn);
    exerciseListEl.appendChild(row);
  }
}

async function deleteExercise(id) {
  await fetch(`/api/exercises/${id}`, { method: "DELETE" });
  loadWeek();
}

// ── Calorie budget widget ──────────────────────────────────────────────────
function calculateDailyTarget(user) {
  const { weightKg, heightCm, ageYears, activityLevel, weeklyGoalKg } = user ?? {};
  if (!weightKg || !heightCm || !ageYears || !activityLevel || !weeklyGoalKg) return null;
  // Mifflin-St Jeor (male formula — MAN v FAT is specifically for men)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const tdee = bmr * (multipliers[activityLevel] ?? 1.2);
  const dailyDeficit = (weeklyGoalKg * 7700) / 7;
  return Math.round(tdee - dailyDeficit);
}

// Round fractional days to nearest 0.5 and express as "3 days", "3½ days", etc.
// Boundary days (e.g. the rollover Monday at 17:00) naturally land near 0.5
// and are shown as "half days" rather than a precise decimal.
function formatDays(fractional) {
  const rounded = Math.round(fractional * 2) / 2;
  const whole = Math.floor(rounded);
  const half = rounded % 1 !== 0;
  if (whole === 0) return "half a day";
  return half ? `${whole}½ days` : `${whole} day${whole === 1 ? "" : "s"}`;
}

function renderBudgetWidget(week) {
  const dailyTarget = calculateDailyTarget(currentUser);
  if (!dailyTarget || dailyTarget <= 0) {
    budgetWidget.hidden = true;
    return;
  }
  budgetWidget.hidden = false;

  const weeklyBudget = dailyTarget * 7;
  const foodConsumed = week.totalKcal ?? 0;
  const exerciseBurned = week.exerciseTotalKcal ?? 0;
  const netConsumed = foodConsumed - exerciseBurned;
  const weekRemaining = weeklyBudget - netConsumed;

  // Weighted remaining days: first and last entry in the week are half-days
  // (the rollover Monday is cut mid-afternoon on both ends). Using calendar-day
  // weights rather than live hours means today's allowance stays fixed all day.
  const dailyTots = week.dailyTotals ?? [];
  const todayIdx = dailyTots.findIndex((d) => d.isToday);
  // todayWeight is 0.5 on boundary Mondays (first or last slot in the week), 1.0 otherwise
  const todayWeight = todayIdx < 0 ? 1.0
    : (todayIdx === 0 || todayIdx === dailyTots.length - 1) ? 0.5 : 1.0;
  let totalWeightedDays = 0;
  let weightedDaysRemaining = 0;
  for (let i = 0; i < dailyTots.length; i++) {
    const w = (i === 0 || i === dailyTots.length - 1) ? 0.5 : 1.0;
    totalWeightedDays += w;
    if (todayIdx >= 0 && i >= todayIdx) weightedDaysRemaining += w;
  }
  if (todayIdx < 0) weightedDaysRemaining = 0.5;
  // adjustedDailyTarget is the per-full-day redistribution rate.
  // actualTodayAllowance scales it down for half-days (boundary Mondays get ×0.5).
  const adjustedDailyTarget = Math.round(weekRemaining / Math.max(weightedDaysRemaining, 0.5));
  const actualTodayAllowance = Math.round(adjustedDailyTarget * todayWeight);

  // Hours remaining used only for the detail-text display
  const weekStart = new Date(week.startsAt);
  const weekEnd = new Date(week.endsAt);
  const now = new Date();
  const weekMs = weekEnd - weekStart;
  const elapsedMs = Math.max(0, Math.min(weekMs, now - weekStart));
  const remainingHours = (weekMs - elapsedMs) / (1000 * 3600);
  const fractionalDaysRemaining = Math.max(remainingHours / 24, 0.5);

  // Today's food consumed from dailyTotals
  const todayKcal = todayIdx >= 0 ? (dailyTots[todayIdx]?.kcal ?? 0) : 0;

  // Bar and labels use actualTodayAllowance so boundary Mondays show the correct cap
  const pct = actualTodayAllowance > 0 ? Math.min(todayKcal / actualTodayAllowance, 1) : 1;
  const overBudget = todayKcal > actualTodayAllowance;
  const approaching = !overBudget && pct >= 0.85;

  budgetWeeklyLabel.textContent = `${weeklyBudget.toLocaleString()} kcal/week`;
  budgetTodayTarget.textContent = `${actualTodayAllowance.toLocaleString()} kcal`;

  budgetBarFill.style.width = `${Math.round(pct * 100)}%`;
  budgetBarFill.className = "budget-bar-fill";
  if (overBudget) budgetBarFill.classList.add("budget-bar-fill--over");
  else if (approaching) budgetBarFill.classList.add("budget-bar-fill--warn");

  budgetTodayConsumed.textContent = `Eaten today: ${todayKcal.toLocaleString()} kcal`;

  if (overBudget) {
    const over = todayKcal - actualTodayAllowance;
    budgetTodayRemaining.className = "over";
    budgetTodayRemaining.textContent = `${over.toLocaleString()} kcal over`;
  } else {
    budgetTodayRemaining.className = "";
    budgetTodayRemaining.textContent = `${(actualTodayAllowance - todayKcal).toLocaleString()} kcal left`;
  }

  // Projection at current daily net rate: will the week end over or under total budget?
  // daysAfterToday uses todayWeight so Monday is counted as 0.5, not a full day.
  let projectedVsBudget = null;
  let predictedLossKg = null;
  if (todayIdx >= 0 && netConsumed > 0) {
    const elapsedDays = Math.max(totalWeightedDays - weightedDaysRemaining + todayWeight, 0.5);
    const dailyNetAvg = netConsumed / elapsedDays;
    const daysAfterToday = Math.max(weightedDaysRemaining - todayWeight, 0);
    const projectedTotal = netConsumed + dailyNetAvg * daysAfterToday;
    projectedVsBudget = weeklyBudget - projectedTotal; // positive = under budget
    if (currentUser?.weeklyGoalKg) {
      predictedLossKg = currentUser.weeklyGoalKg + projectedVsBudget / 7700;
    }
  }

  const lines = [
    `Week budget: ${weeklyBudget.toLocaleString()} kcal total`,
    `Eaten so far: ${foodConsumed.toLocaleString()} kcal`,
  ];
  if (exerciseBurned > 0) lines.push(`Exercise burned: ${exerciseBurned.toLocaleString()} kcal`);
  lines.push(`Remaining: ${weekRemaining.toLocaleString()} kcal over ${formatDays(fractionalDaysRemaining)}`);

  if (projectedVsBudget !== null) {
    const kcalDiff = Math.round(Math.abs(projectedVsBudget));
    let posLabel, posStyle;
    if (kcalDiff <= 50) {
      posLabel = "On track for the week";
      posStyle = "";
    } else if (projectedVsBudget > 0) {
      posLabel = `${kcalDiff.toLocaleString()} kcal under budget this week`;
      posStyle = "color:var(--pitch-dark);font-weight:600";
    } else {
      posLabel = `${kcalDiff.toLocaleString()} kcal over budget this week`;
      posStyle = "color:#dc2626;font-weight:600";
    }
    lines.push(`<span${posStyle ? ` style="${posStyle}"` : ""}>${posLabel}</span>`);

    if (predictedLossKg !== null) {
      lines.push(predictedLossKg >= 0
        ? `Predicted: ~${predictedLossKg.toFixed(1)} kg loss this week`
        : `Predicted: ~${Math.abs(predictedLossKg).toFixed(1)} kg gain this week`);
    }
  }

  budgetWeekDetail.innerHTML = lines.join("<br>");
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

productRescanBtn.addEventListener("click", () => {
  productCard.hidden = true;
  currentProduct = null;
  openScanner();
});

scanBarcodeBtn.addEventListener("click", openScanner);
scanCloseBtn.addEventListener("click", stopScanner);
