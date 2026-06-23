const form = document.getElementById("entry-form");
const textInput = document.getElementById("text");
const photoInput = document.getElementById("photo");
const photoStatus = document.getElementById("photo-status");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

const resultCard = document.getElementById("result-card");
const resultRows = document.getElementById("result-rows");
const resultSave = document.getElementById("result-save");
const resultDismiss = document.getElementById("result-dismiss");

const weekRangeEl = document.getElementById("week-range");
const weekTotalEl = document.getElementById("week-total");
const weekAvgEl = document.getElementById("week-avg");
const daysLoggedEl = document.getElementById("days-logged");
const entryListEl = document.getElementById("entry-list");

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

async function loadWeek() {
  const res = await fetch("/api/match-weeks/current");
  const week = await res.json();

  weekRangeEl.textContent = `${dateFmt.format(new Date(week.startsAt))} – ${dateFmt.format(
    new Date(new Date(week.endsAt).getTime() - 1000),
  )}`;
  weekTotalEl.textContent = week.totalKcal;
  weekAvgEl.textContent = week.dailyAverage;
  daysLoggedEl.textContent = week.daysLogged;

  renderEntries(week.entries);
}

function renderEntries(entries) {
  entryListEl.innerHTML = "";

  if (entries.length === 0) {
    entryListEl.innerHTML = '<p class="empty-state">Nothing logged yet this week.</p>';
    return;
  }

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

  for (const { date, meals } of dayGroups.values()) {
    const group = document.createElement("div");
    group.className = "day-group";

    const heading = document.createElement("div");
    heading.className = "day-heading";
    heading.textContent = dayFmt.format(date);
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
  kcal.textContent = entry.kcal === null ? "—" : `${entry.kcal} kcal`;

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

loadWeek();
