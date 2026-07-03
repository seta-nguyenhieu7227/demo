const API = (window.API_BASE || "").replace(/\/$/, "");

const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("new-title");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", isError);
}

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function loadTodos() {
  setStatus("Đang tải...");
  try {
    const todos = await api("/api/todos");
    render(todos);
    setStatus("");
  } catch (err) {
    setStatus("Không kết nối được backend: " + err.message, true);
  }
}

function render(todos) {
  listEl.innerHTML = "";
  if (!todos.length) {
    setStatus("Chưa có việc nào. Thêm việc đầu tiên nhé!");
    return;
  }
  for (const t of todos) {
    const li = document.createElement("li");
    li.className = "item" + (t.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = t.done;
    checkbox.addEventListener("change", () => toggleDone(t, checkbox.checked));

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = t.title;

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.addEventListener("click", () => removeTodo(t.id));

    li.append(checkbox, span, del);
    listEl.append(li);
  }
}

async function addTodo(title) {
  await api("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  await loadTodos();
}

async function toggleDone(todo, done) {
  try {
    await api(`/api/todos/${todo.id}`, {
      method: "PUT",
      body: JSON.stringify({ done }),
    });
    await loadTodos();
  } catch (err) {
    setStatus("Lỗi cập nhật: " + err.message, true);
  }
}

async function removeTodo(id) {
  try {
    await api(`/api/todos/${id}`, { method: "DELETE" });
    await loadTodos();
  } catch (err) {
    setStatus("Lỗi xoá: " + err.message, true);
  }
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = inputEl.value.trim();
  if (!title) return;
  inputEl.value = "";
  try {
    await addTodo(title);
  } catch (err) {
    setStatus("Lỗi thêm: " + err.message, true);
  }
});

loadTodos();
