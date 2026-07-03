/* Whimsy To-Do — tiny vanilla JS (add / toggle / remove / persist) */
(function () {
  "use strict";

  var STORAGE_KEY = "whimsy-todos";
  var form = document.getElementById("todo-form");
  var input = document.getElementById("todo-input");
  var list = document.getElementById("todo-list");
  var empty = document.getElementById("empty-state");
  var count = document.getElementById("count");
  var clearBtn = document.getElementById("clear-done");

  var todos = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function render() {
    list.innerHTML = "";
    todos.forEach(function (todo, i) {
      var li = document.createElement("li");
      if (todo.done) li.className = "done";

      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = todo.done;
      box.setAttribute("aria-label", "Mark done: " + todo.text);
      box.addEventListener("change", function () {
        todos[i].done = box.checked;
        save();
        render();
      });

      var label = document.createElement("span");
      label.className = "label";
      label.textContent = todo.text;

      var remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", "Remove: " + todo.text);
      remove.addEventListener("click", function () {
        todos.splice(i, 1);
        save();
        render();
      });

      li.appendChild(box);
      li.appendChild(label);
      li.appendChild(remove);
      list.appendChild(li);
    });

    empty.classList.toggle("hidden", todos.length > 0);
    var open = todos.filter(function (t) { return !t.done; }).length;
    count.textContent = todos.length === 0
      ? "0 tasks"
      : open + " of " + todos.length + " to go";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    todos.push({ text: text, done: false });
    input.value = "";
    save();
    render();
    input.focus();
  });

  clearBtn.addEventListener("click", function () {
    todos = todos.filter(function (t) { return !t.done; });
    save();
    render();
  });

  render();
})();
