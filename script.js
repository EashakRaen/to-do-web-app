// ---------- 1. Data ----------
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let lists = JSON.parse(localStorage.getItem("lists")) || ["Personal", "Work", "Study"];
let activeList = "All";
let editingId = null;     // null = naya task, warna edit
let lastDeleted = null;   // Undo ke liye
let toastTimer;

const $ = (id) => document.getElementById(id);
const save = () => {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("lists", JSON.stringify(lists));
};
// Text ko safe banata hai (koi code inject na kar sake)
const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };

// Aaj ki date "YYYY-MM-DD" format mein (apne local time ke hisaab se)
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// ---------- 2. Popup form (add / edit) ----------
function openForm(task) {
  editingId = task ? task.id : null;
  $("formTitle").textContent = task ? "Edit task" : "New task";
  $("saveBtn").textContent = task ? "Save changes" : "Add task";
  $("title").value = task ? task.title : "";
  $("date").value = task ? task.date : "";
  $("time").value = task ? task.time : "";
  $("priority").value = task ? task.priority : "medium";
  $("listSelect").value = task ? task.list : (activeList === "All" ? lists[0] : activeList);
  $("dlg").showModal();
  $("title").focus();
}
$("openForm").onclick = () => openForm(null);
$("cancelBtn").onclick = () => $("dlg").close();

$("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    title: $("title").value.trim(),
    date: $("date").value,
    time: $("time").value,
    priority: $("priority").value,
    list: $("listSelect").value,
  };
  if (!data.title) return;
  if (editingId) tasks = tasks.map((t) => (t.id === editingId ? { ...t, ...data } : t));
  else tasks.unshift({ id: Date.now(), done: false, ...data });
  $("dlg").close();
  save();
  render();
});

// ---------- 3. Task actions: complete, edit, delete ----------
$("groups").addEventListener("click", (e) => {
  const li = e.target.closest("[data-id]");
  if (!li) return;
  const id = Number(li.dataset.id);
  const index = tasks.findIndex((t) => t.id === id);
  const task = tasks[index];

  if (e.target.matches(".check")) {
    task.done = e.target.checked;
  } else if (e.target.dataset.action === "edit") {
    return openForm(task);
  } else if (e.target.dataset.action === "delete") {
    lastDeleted = { task, index };            // Undo ke liye yaad rakho
    tasks.splice(index, 1);
    showToast();
  } else return;
  save();
  render();
});

// Undo message 5 second dikhta hai
function showToast() {
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
}
$("undoBtn").onclick = () => {
  if (!lastDeleted) return;
  tasks.splice(lastDeleted.index, 0, lastDeleted.task);   // wapas usi jagah
  lastDeleted = null;
  $("toast").hidden = true;
  save();
  render();
};

// ---------- 4. Lists ----------
$("listNav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-list]");
  if (btn) { activeList = btn.dataset.list; render(); }
});
$("newListBtn").onclick = () => {
  const name = (prompt("New list name?") || "").trim();
  if (name && !lists.includes(name)) { lists.push(name); activeList = name; save(); render(); }
};
$("search").addEventListener("input", render);

// ---------- 5. Task ko group mein daalna ----------
function groupOf(t) {
  if (t.done) return "Completed";
  if (!t.date) return "No date";
  const today = todayStr();
  if (t.date < today || (t.date === today && t.time && t.time < nowTime())) return "Overdue";
  return t.date === today ? "Today" : "Upcoming";
}

function taskHTML(t) {
  const when = t.date ? t.date + (t.time ? " · " + t.time : "") : "";
  return `
    <div class="task ${t.done ? "done" : ""}" data-id="${t.id}">
      <input type="checkbox" class="check" ${t.done ? "checked" : ""} aria-label="Mark complete">
      <div class="info">
        <p class="name">${esc(t.title)}</p>
        <div class="meta">
          <span class="pill ${t.priority}">${t.priority}</span>
          <span class="chip">${esc(t.list)}</span>
          ${when ? `<span class="chip">${when}</span>` : ""}
        </div>
      </div>
      <div class="acts">
        <button data-action="edit">Edit</button>
        <button data-action="delete">Delete</button>
      </div>
    </div>`;
}

// ---------- 6. Poora screen banana ----------
function render() {
  // Side menu: har list ke saath pending tasks ka count
  const count = (l) => tasks.filter((t) => !t.done && (l === "All" || t.list === l)).length;
  $("listNav").innerHTML = ["All", ...lists]
    .map((l) => `<button data-list="${esc(l)}" class="${l === activeList ? "active" : ""}">${esc(l === "All" ? "All tasks" : l)}<small>${count(l)}</small></button>`)
    .join("");
  $("heading").textContent = activeList === "All" ? "All tasks" : activeList;
  $("today").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  $("listSelect").innerHTML = lists.map((l) => `<option>${esc(l)}</option>`).join("");

  // Stats (saare tasks par)
  const done = tasks.filter((t) => t.done).length;
  $("sPending").textContent = tasks.length - done;
  $("sDone").textContent = done;
  $("sLate").textContent = tasks.filter((t) => groupOf(t) === "Overdue").length;
  $("progressText").textContent = `${done} of ${tasks.length} tasks complete`;
  $("barFill").style.width = tasks.length ? (done / tasks.length) * 100 + "%" : "0%";

  // List + search ke hisaab se filter
  const q = $("search").value.toLowerCase();
  const shown = tasks.filter((t) => (activeList === "All" || t.list === activeList) && t.title.toLowerCase().includes(q));

  // Sections: har group ke tasks alag
  const order = ["Overdue", "Today", "Upcoming", "No date", "Completed"];
  const html = order
    .map((g) => {
      const items = shown.filter((t) => groupOf(t) === g);
      if (!items.length) return "";
      return `<section class="group ${g === "Overdue" ? "overdue" : ""}"><h3>${g}<small>${items.length}</small></h3>${items.map(taskHTML).join("")}</section>`;
    })
    .join("");
  $("groups").innerHTML = html || `<p class="empty">Nothing here yet.<br>Click "+ New task" to add your first one.</p>`;
}

// ---------- 7. Light / Dark mode ----------
function setTheme(mode) {
  document.documentElement.dataset.theme = mode;
  $("themeBtn").textContent = mode === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", mode);
}
$("themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
setTheme(localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

render();