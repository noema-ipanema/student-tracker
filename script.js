// The app stores everything in one localStorage key so it is easy to read and update.
const STORAGE_KEY = "studentTrackerData";

const sectionLabels = {
  assignments: "Assignments",
  calendar: "Monthly Calendar",
  exams: "Exams",
  clubMeetings: "Club Meetings",
  volunteering: "Volunteering Shifts",
  work: "Work Shifts",
};

const categoryTagLabels = {
  assignments: "Assignment",
  exams: "Exam",
  clubMeetings: "Club Meeting",
  volunteering: "Volunteer",
  work: "Work",
};

const state = {
  currentSection: "assignments",
  filter: "all",
  search: "",
  sortNearest: true,
  calendarDate: createMonthDate(new Date().getFullYear(), new Date().getMonth()),
  editingItemId: null,
  items: loadItems(),
};

const tabs = document.querySelectorAll(".tab-button");
const form = document.getElementById("itemForm");
const titleInput = document.getElementById("titleInput");
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const notesInput = document.getElementById("notesInput");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const sortNearestButton = document.getElementById("sortNearestButton");
const itemsContainer = document.getElementById("itemsContainer");
const emptyState = document.getElementById("emptyState");
const itemCount = document.getElementById("itemCount");
const listTitle = document.getElementById("listTitle");
const listDescription = document.getElementById("listDescription");
const formTitle = document.getElementById("formTitle");
const submitButton = form.querySelector('button[type="submit"]');
const controlsDescription = document.querySelector(".controls-panel .section-heading p");
const formPanel = document.querySelector(".form-panel");
const listPanel = document.querySelector(".list-panel");
const calendarPanel = document.getElementById("calendarPanel");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const prevMonthButton = document.getElementById("prevMonthButton");
const nextMonthButton = document.getElementById("nextMonthButton");

const summaryElements = {
  assignments: document.getElementById("upcomingAssignments"),
  exams: document.getElementById("nextExam"),
  clubMeetings: document.getElementById("nextClubMeeting"),
  volunteering: document.getElementById("nextVolunteer"),
  work: document.getElementById("nextWork"),
};

initializeApp();

function initializeApp() {
  attachEvents();
  updateSectionCopy();
  render();
}

function attachEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (state.currentSection !== tab.dataset.section && state.editingItemId) {
        resetFormState();
        form.reset();
      }

      state.currentSection = tab.dataset.section;
      tabs.forEach((button) => button.classList.remove("active"));
      tab.classList.add("active");
      updateSectionCopy();
      render();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const itemData = {
      title: titleInput.value.trim(),
      date: dateInput.value,
      time: timeInput.value,
      notes: notesInput.value.trim(),
    };

    if (!itemData.title || !itemData.date) {
      return;
    }

    if (state.editingItemId) {
      state.items = state.items.map((item) => {
        if (item.id === state.editingItemId) {
          return { ...item, ...itemData };
        }

        return item;
      });
    } else {
      state.items.push({
        id: createItemId(),
        section: state.currentSection,
        completed: false,
        createdAt: Date.now(),
        ...itemData,
      });
    }

    saveItems();
    resetFormState();
    form.reset();
    render();
  });

  filterSelect.addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  sortNearestButton.addEventListener("click", () => {
    state.sortNearest = !state.sortNearest;
    sortNearestButton.textContent = state.sortNearest ? "Sorted by Nearest Date" : "Sort by Nearest Date";
    render();
  });

  prevMonthButton.addEventListener("click", () => {
    state.calendarDate = createMonthDate(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthButton.addEventListener("click", () => {
    state.calendarDate = createMonthDate(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1);
    renderCalendar();
  });
}

function render() {
  updateViewState();
  renderItems();
  renderCalendar();
  renderSummary();
}

function renderItems() {
  if (state.currentSection === "calendar") {
    return;
  }

  const visibleItems = getVisibleItems();
  itemsContainer.innerHTML = "";

  listTitle.textContent = sectionLabels[state.currentSection];
  listDescription.textContent = `Track everything scheduled in ${sectionLabels[state.currentSection].toLowerCase()}.`;
  itemCount.textContent = `${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`;

  if (visibleItems.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  visibleItems.forEach((item) => {
    const itemCard = document.createElement("article");
    const status = getItemStatus(item);

    itemCard.className = `item-card ${item.completed ? "completed" : ""} ${status}`;
    itemCard.innerHTML = `
      <div class="item-card-header">
        <div>
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
        </div>
        <span class="status-chip ${status}">${formatStatusLabel(status)}</span>
      </div>
      <div class="item-meta">
        <span>${formatDate(item.date)}</span>
        <span>${item.time ? formatTime(item.time) : "No time set"}</span>
      </div>
      <p class="item-notes">${item.notes ? escapeHtml(item.notes) : "No notes added."}</p>
      <div class="item-actions">
        <button class="action-button edit" data-action="edit" data-id="${item.id}">
          Edit
        </button>
        <button class="action-button complete" data-action="toggle" data-id="${item.id}">
          ${item.completed ? "Mark Incomplete" : "Mark Completed"}
        </button>
        <button class="action-button delete" data-action="delete" data-id="${item.id}">
          Delete
        </button>
      </div>
    `;

    itemsContainer.appendChild(itemCard);
  });

  itemsContainer.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, id } = button.dataset;

      if (action === "toggle") {
        toggleItem(id);
      }

      if (action === "delete") {
        deleteItem(id);
      }

      if (action === "edit") {
        startEditingItem(id);
      }
    });
  });
}

function renderSummary() {
  const assignments = state.items.filter((item) => item.section === "assignments" && !item.completed && !isOverdue(item));
  const exams = getNextItem("exams");
  const clubMeetings = getNextItem("clubMeetings");
  const volunteering = getNextItem("volunteering");
  const work = getNextItem("work");

  summaryElements.assignments.textContent = String(assignments.length);
  summaryElements.exams.textContent = exams ? formatSummaryDate(exams) : "No exams scheduled";
  summaryElements.clubMeetings.textContent = clubMeetings ? formatSummaryDate(clubMeetings) : "No meetings scheduled";
  summaryElements.volunteering.textContent = volunteering ? formatSummaryDate(volunteering) : "No shifts scheduled";
  summaryElements.work.textContent = work ? formatSummaryDate(work) : "No shifts scheduled";
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const monthStart = createMonthDate(year, month);
  const startDay = monthStart.getDay();
  const totalCells = 42;

  calendarMonthLabel.textContent = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(monthStart);

  for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
    const cellDate = createMonthDate(year, month, cellIndex - startDay + 1);
    const dayItems = getItemsForDate(cellDate);
    const dayElement = document.createElement("article");
    const dayClasses = ["calendar-day"];

    if (cellDate.getMonth() !== month) {
      dayClasses.push("other-month");
    }

    if (getLocalDateString(cellDate) === getLocalDateString(new Date())) {
      dayClasses.push("today");
    }

    dayElement.className = dayClasses.join(" ");
    dayElement.innerHTML = `
      <div class="calendar-day-header">
        <span class="calendar-day-number">${cellDate.getDate()}</span>
      </div>
      <div class="calendar-day-items">
        ${dayItems.length > 0 ? dayItems.map((item) => createCalendarItemMarkup(item)).join("") : '<span class="calendar-empty">No items</span>'}
      </div>
    `;

    calendarGrid.appendChild(dayElement);
  }
}

function getVisibleItems() {
  const itemsForSection = state.items.filter((item) => item.section === state.currentSection);

  const filteredItems = itemsForSection.filter((item) => {
    const status = getItemStatus(item);
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "upcoming" && (status === "upcoming" || status === "today")) ||
      status === state.filter;
    const matchesSearch =
      item.title.toLowerCase().includes(state.search) ||
      item.notes.toLowerCase().includes(state.search);

    return matchesFilter && matchesSearch;
  });

  if (state.sortNearest) {
    return filteredItems.sort((firstItem, secondItem) => getItemDate(firstItem) - getItemDate(secondItem));
  }

  return filteredItems.sort((firstItem, secondItem) => secondItem.createdAt - firstItem.createdAt);
}

function getItemStatus(item) {
  if (item.completed) {
    return "completed";
  }

  if (isToday(item)) {
    return "today";
  }

  if (isOverdue(item)) {
    return "overdue";
  }

  return "upcoming";
}

function getItemsForDate(date) {
  const dateKey = getLocalDateString(date);

  return state.items
    .filter((item) => item.date === dateKey)
    .sort((firstItem, secondItem) => getItemDate(firstItem) - getItemDate(secondItem));
}

function toggleItem(id) {
  state.items = state.items.map((item) => {
    if (item.id === id) {
      return { ...item, completed: !item.completed };
    }

    return item;
  });

  saveItems();
  render();
}

function deleteItem(id) {
  state.items = state.items.filter((item) => item.id !== id);

  if (state.editingItemId === id) {
    resetFormState();
    form.reset();
  }

  saveItems();
  render();
}

function getNextItem(section) {
  return state.items
    .filter((item) => item.section === section && !item.completed && !isOverdue(item))
    .sort((firstItem, secondItem) => getItemDate(firstItem) - getItemDate(secondItem))[0];
}

function getItemDate(item) {
  const dateTimeString = item.time ? `${item.date}T${item.time}` : `${item.date}T23:59`;
  return new Date(dateTimeString).getTime();
}

function isToday(item) {
  const today = getLocalDateString(new Date());
  return item.date === today;
}

function isOverdue(item) {
  if (item.completed) {
    return false;
  }

  return getItemDate(item) < Date.now() && !isToday(item);
}

function formatStatusLabel(status) {
  if (status === "today") {
    return "Due Today";
  }

  if (status === "overdue") {
    return "Overdue";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "Upcoming";
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(timeString) {
  const date = new Date(`2000-01-01T${timeString}`);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatSummaryDate(item) {
  const label = item.time ? `${formatDate(item.date)} at ${formatTime(item.time)}` : formatDate(item.date);
  return `${item.title} • ${label}`;
}

function updateSectionCopy() {
  if (state.currentSection === "calendar") {
    formTitle.textContent = "Add Item";
    submitButton.textContent = "Add Item";
    return;
  }

  const currentLabel = sectionLabels[state.currentSection];
  const singularLabel = categoryTagLabels[state.currentSection] || currentLabel.slice(0, -1);
  formTitle.textContent = state.editingItemId ? `Edit ${singularLabel}` : `Add ${singularLabel}`;
  submitButton.textContent = state.editingItemId ? "Save Changes" : "Add Item";
}

function updateViewState() {
  const isCalendarView = state.currentSection === "calendar";

  filterSelect.disabled = isCalendarView;
  searchInput.disabled = isCalendarView;
  sortNearestButton.disabled = isCalendarView;
  formPanel.classList.toggle("hidden", isCalendarView);
  listPanel.classList.toggle("hidden", isCalendarView);
  calendarPanel.classList.toggle("hidden", !isCalendarView);
  controlsDescription.textContent = isCalendarView
    ? "Switch between planner categories or review the full monthly schedule."
    : "Switch categories, search tasks, and organize your list.";
}

function startEditingItem(id) {
  const itemToEdit = state.items.find((item) => item.id === id);

  if (!itemToEdit) {
    return;
  }

  state.editingItemId = id;
  titleInput.value = itemToEdit.title;
  dateInput.value = itemToEdit.date;
  timeInput.value = itemToEdit.time;
  notesInput.value = itemToEdit.notes;
  updateSectionCopy();
  window.scrollTo({ top: form.offsetTop - 40, behavior: "smooth" });
}

function resetFormState() {
  state.editingItemId = null;
  updateSectionCopy();
}

function loadItems() {
  const savedItems = localStorage.getItem(STORAGE_KEY);

  if (!savedItems) {
    return [];
  }

  try {
    return JSON.parse(savedItems);
  } catch (error) {
    console.error("Could not parse saved tracker data.", error);
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function createItemId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createCalendarItemMarkup(item) {
  const status = getItemStatus(item);
  const itemClasses = ["calendar-item", item.section];

  if (item.completed) {
    itemClasses.push("completed");
  }

  if (status === "overdue") {
    itemClasses.push("overdue");
  }

  return `
    <article class="${itemClasses.join(" ")}">
      <span class="calendar-item-label">${categoryTagLabels[item.section]}</span>
      <span class="calendar-item-title">${escapeHtml(item.title)}</span>
      <span class="calendar-item-meta">${item.time ? formatTime(item.time) : "No time set"}${item.completed ? " • Completed" : ""}</span>
    </article>
  `;
}

function createMonthDate(year, month, day = 1) {
  return new Date(year, month, day);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
