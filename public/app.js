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
const settingsSave = document.getElementById("settings-save");
const settingsError = document.getElementById("settings-error");
const logoutBtn = document.getElementById("logout-btn");

let authMode = "login";
let googleClientId = null;
let gsiLoaded = false;

const form = document.getElementById("entry-form");
const textInput = document.getElementById("text");
const photoInput = document.getElementById("photo");
const photoStatus = document.getElementById("photo-status");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

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

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

function toDateInputValue(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMonday(dateInputValue) {
  if (!dateInputValue) return false;
  const [year, month, day] = dateInputValue.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() === 1;
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

  if (week.pendingEstimates > 0) {
    const plural = week.pendingEstimates > 1 ? "entries" : "entry";
    pendingNoteEl.textContent = `${week.pendingEstimates} ${plural} couldn't be estimated and isn't counted yet — tap Edit to add kcal.`;
    pendingNoteEl.hidden = false;
  } else {
    pendingNoteEl.hidden = true;
  }

  renderDailyTotals(week.dailyTotals ?? []);
  renderEntries(week.entries);
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
    if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, { date: d, meals: new Map() });
    const meals = dayGroups.get(dayKey).meals;
    const mealType = entry.mealType ?? "snack";
    if (!meals.has(mealType)) meals.set(mealType, []);
    meals.get(mealType).push(entry);
  }

  for (const [dayKey, { date, meals }] of dayGroups.entries()) {
    const group = document.createElement("div");
    group.className = "day-group";

    const isToday = dayKey === todayKey;
    const dayEntries = [...meals.values()].flat();
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

    for (const mealType of MEAL_ORDER) {
      const mealEntries = meals.get(mealType);
      if (!mealEntries) continue;

      const mealHeading = document.createElement("div");
      mealHeading.className = "meal-heading";
      mealHeading.textContent = MEAL_LABELS[mealType];
      group.appendChild(mealHeading);

      for (const entry of mealEntries) {
        group.appendChild(renderEntryRow(entry));
      }
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
  const delBtn = document.createElement("button");
  delBtn.textContent = "✕";
  delBtn.type = "button";
  delBtn.addEventListener("click", () => deleteEntry(entry.id));
  actions.append(editBtn, delBtn);

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

  const mealSelect = document.createElement("select");
  for (const mealType of MEAL_ORDER) {
    const option = document.createElement("option");
    option.value = mealType;
    option.textContent = MEAL_LABELS[mealType];
    if (mealType === entry.mealType) option.selected = true;
    mealSelect.appendChild(option);
  }

  // Monday snacks straddle the 17:00 match-week boundary, so a meal type alone
  // can't say which week they belong to — this lets the user disambiguate.
  const snackTimeSelect = document.createElement("select");
  const daySnackOption = document.createElement("option");
  daySnackOption.value = "day";
  daySnackOption.textContent = "Snack (day)";
  const eveningSnackOption = document.createElement("option");
  eveningSnackOption.value = "evening";
  eveningSnackOption.textContent = "Snack (evening)";
  snackTimeSelect.append(daySnackOption, eveningSnackOption);
  snackTimeSelect.value = new Date(entry.timestamp).getHours() < 17 ? "day" : "evening";

  function updateSnackTimeVisibility() {
    snackTimeSelect.hidden = !(mealSelect.value === "snack" && isMonday(dateInput.value));
  }
  updateSnackTimeVisibility();
  dateInput.addEventListener("input", updateSnackTimeVisibility);
  mealSelect.addEventListener("change", updateSnackTimeVisibility);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.style.width = "auto";
  saveBtn.addEventListener("click", async () => {
    const body = {
      label: labelInput.value.trim(),
      kcal: kcalInput.value === "" ? null : Number(kcalInput.value),
      mealType: mealSelect.value,
      date: dateInput.value,
    };
    if (mealSelect.value === "snack" && isMonday(dateInput.value)) {
      body.hour = snackTimeSelect.value === "day" ? 14 : 20;
    }
    await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    loadWeek();
  });

  editRow.append(labelInput, kcalInput, dateInput, mealSelect, snackTimeSelect, saveBtn);
  row.appendChild(editRow);
}

async function deleteEntry(id) {
  await fetch(`/api/entries/${id}`, { method: "DELETE" });
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
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStartWeekday: Number(settingsWeekday.value),
        weekStartHour: hour,
        weekStartMinute: minute,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Couldn't save settings.");
    }
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
  settingsUsername.textContent = user.username;
  settingsWeekday.value = String(user.weekStartWeekday);
  settingsTime.value = `${String(user.weekStartHour).padStart(2, "0")}:${String(user.weekStartMinute).padStart(2, "0")}`;
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
