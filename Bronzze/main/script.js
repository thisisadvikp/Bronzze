
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORE = "bronzze-final-";

const read = (key, fallback) => {
    try {
        const value = localStorage.getItem(STORE + key);
        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(STORE + key, JSON.stringify(value));
        return true;
    } catch {
        notify("Could not save. Check browser storage.");
        return false;
    }
};

let apps = read("apps", []);
let favorites = read("favorites", []);
let quickTools = read("quick-tools", []).slice(0, 3);
let tasks = read("tasks", []);
let manageFavorites = false;
let toastTimer;
let notesTimer;
let studyRemaining = 25 * 60;
let studyInterval = null;
let studyRunning = false;

function notify(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

function persistCollections() {
    write("apps", apps);
    write("favorites", favorites);
    write("quick-tools", quickTools);
}

function normalizeUrl(value) {
    let address = value.trim();
    if (!address) return null;

    if (!/^[a-z][a-z\d+.-]*:/i.test(address)) {
        address = "https://" + address;
    }

    try {
        const url = new URL(address);
        if (!["https:", "http:"].includes(url.protocol)) return null;
        if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
        return url.href;
    } catch {
        return null;
    }
}

function websiteIcon(address) {
    let host = "";

    try {
        host = new URL(address).hostname.replace(/^www\./, "");
    } catch { }

    const icons = [
        [/youtube\.com$|youtu\.be$/, "fa-brands fa-youtube"],
        [/spotify\.com$/, "fa-brands fa-spotify"],
        [/github\.com$/, "fa-brands fa-github"],
        [/gmail\.com$/, "fa-solid fa-envelope"],
        [/google\.(com|co\.\w+)$/, "fa-brands fa-google"],
        [/reddit\.com$/, "fa-brands fa-reddit-alien"],
        [/wikipedia\.org$/, "fa-brands fa-wikipedia-w"],
        [/chatgpt\.com$/, "fa-solid fa-robot"],
        [/discord\.com$/, "fa-brands fa-discord"],
        [/twitch\.tv$/, "fa-brands fa-twitch"],
        [/classroom\.google\.com$/, "fa-solid fa-graduation-cap"]
    ];

    const found = icons.find(([pattern]) => pattern.test(host));
    return found ? found[1] : "fa-solid fa-globe";
}

function createItem(name, url, type) {
    return {
        id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        name: name.trim(),
        url,
        type,
        icon: websiteIcon(url)
    };
}

function emptyState(title, description, buttonText, callback) {
    const box = document.createElement("div");
    box.className = "empty-state";

    const icon = document.createElement("i");
    icon.className = "fa-regular fa-folder-open";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const descriptionEl = document.createElement("span");
    descriptionEl.textContent = description;

    box.append(icon, heading, descriptionEl);

    if (buttonText && callback) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = buttonText;
        button.addEventListener("click", callback);
        box.append(button);
    }

    return box;
}

function createTile(item, removable = false, onRemove = null) {
    const tile = document.createElement("a");
    tile.className = "tile";
    tile.href = item.url;
    tile.target = "_self";
    tile.rel = "noopener noreferrer";
    tile.title = "Open " + item.name;

    const iconBox = document.createElement("span");
    iconBox.className = "tile-icon";

    const icon = document.createElement("i");
    icon.className = item.icon || websiteIcon(item.url);
    iconBox.append(icon);

    const name = document.createElement("span");
    name.className = "tile-name";
    name.textContent = item.name;

    tile.append(iconBox, name);

    if (removable) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tile-remove";
        button.title = "Remove " + item.name;
        button.setAttribute("aria-label", "Remove " + item.name);
        button.innerHTML = '<i class="fa-solid fa-xmark"></i>';

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(item);
        });

        tile.append(button);
    }

    return tile;
}

function renderFavorites() {
    const grid = $("#favorite-grid");
    grid.replaceChildren();

    if (!favorites.length) {
        grid.append(emptyState(
            "You have no favorites yet",
            "Add websites here for quick access.",
            "Add your first favorite",
            addFavorite
        ));
        return;
    }

    favorites.forEach(item => {
        grid.append(createTile(
            item,
            manageFavorites,
            removeFavorite
        ));
    });
}

function renderApps() {
    const grid = $("#app-grid");
    const query = $("#app-search").value.trim().toLowerCase();
    grid.replaceChildren();

    const filtered = apps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.url.toLowerCase().includes(query)
    );

    if (!filtered.length) {
        grid.append(emptyState(
            query ? "No matching apps" : "Your app collection is empty",
            query ? "Try another search." : "Add a website to build your launcher.",
            query ? null : "Add your first app",
            query ? null : addApp
        ));
        return;
    }

    filtered.forEach(app => {
        grid.append(createTile(app, true, removeApp));
    });
}

function renderQuickTools() {
    const bar = $("#quick-tools-bar");
    bar.replaceChildren();

    quickTools.forEach(item => {
        const link = document.createElement("a");
        link.className = "quick-tool";
        link.href = item.url;
        link.target = "_self";
        link.rel = "noopener noreferrer";
        link.title = item.name;

        const icon = document.createElement("i");
        icon.className = item.icon || websiteIcon(item.url);

        const label = document.createElement("span");
        label.textContent = item.name;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "quick-tool-remove";
        remove.title = "Remove " + item.name;
        remove.setAttribute("aria-label", "Remove " + item.name);
        remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';

        remove.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            removeQuickTool(item);
        });

        link.append(icon, label, remove);
        bar.append(link);
    });

    const addButton = $("#add-tool");
    const full = quickTools.length >= 3;

    addButton.disabled = full;
    addButton.title = full
        ? "Maximum of 3 quick-reach tools"
        : "Add quick-reach tool";

    bar.classList.toggle("manage-quick-tools", manageFavorites);
}

function addWebsiteTo(collection, type) {
    const name = prompt("What should this shortcut be called?");
    if (name === null || !name.trim()) return;

    const address = prompt("Enter the website URL:");
    if (address === null || !address.trim()) return;

    const url = normalizeUrl(address);

    if (!url) {
        notify("Enter a valid website URL, such as example.com");
        return;
    }

    if (collection.some(item => item.url === url)) {
        notify("That website is already in this collection.");
        return;
    }

    collection.push(createItem(name, url, type));
    persistCollections();
    renderFavorites();
    renderApps();
    renderQuickTools();
    notify("Shortcut added.");
}

function addFavorite() {
    addWebsiteTo(favorites, "favorite");
}

function addApp() {
    addWebsiteTo(apps, "app");
}

function addQuickTool() {
    if (quickTools.length >= 3) {
        notify("Ultra Quick Reach is limited to 3 tools.");
        return;
    }

    addWebsiteTo(quickTools, "tool");
}

function removeApp(item) {
    if (!confirm(`Delete "${item.name}" from Apps?`)) return;

    apps = apps.filter(app => app.id !== item.id);
    persistCollections();
    renderApps();
    notify("App deleted.");
}

function removeFavorite(item) {
    favorites = favorites.filter(favorite => favorite.id !== item.id);
    persistCollections();
    renderFavorites();
    notify("Favorite removed.");
}

function removeQuickTool(item) {
    quickTools = quickTools.filter(tool => tool.id !== item.id);
    persistCollections();
    renderQuickTools();
    notify("Tool removed from the taskbar.");
}

function showView(name) {
    const target = $("#" + name + "-view");
    if (!target) return;

    $$(".view").forEach(view => {
        view.classList.toggle("active", view === target);
    });

    $$(".taskbar-button").forEach(button => {
        const active = button.dataset.view === name;
        button.classList.toggle("active", active);

        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });

    $("#tools-menu").hidden = true;
    target.scrollTop = 0;

    if (name === "apps") renderApps();
    if (name === "tasks") renderTasks();
}

$("#menu-button").addEventListener("click", () => {
    $("#tools-menu").hidden = !$("#tools-menu").hidden;
});

$("#tools-menu").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (button) showView(button.dataset.view);
});

document.addEventListener("click", event => {
    if (!event.target.closest(".topbar")) {
        $("#tools-menu").hidden = true;
    }
});

$$(".taskbar-button").forEach(button => {
    button.addEventListener("click", () => showView(button.dataset.view));
});

$("#settings-button").addEventListener("click", () => showView("settings"));
$("#add-favorite").addEventListener("click", addFavorite);
$("#add-app").addEventListener("click", addApp);
$("#add-tool").addEventListener("click", addQuickTool);
$("#app-search").addEventListener("input", renderApps);

$("#manage-favorites").addEventListener("click", () => {
    manageFavorites = !manageFavorites;
    $("#manage-favorites").textContent = manageFavorites ? "Done" : "Manage";
    renderFavorites();
    renderQuickTools();
    notify(manageFavorites
        ? "Use the X buttons to remove favorites and taskbar tools."
        : "Management mode closed.");
});

$("#search-form").addEventListener("submit", event => {
    event.preventDefault();

    const query = $("#search-input").value.trim();
    if (!query) return;

    const looksLikeUrl =
        /^(https?:\/\/|localhost(?::\d+)?(?:\/.*)?$|[\w-]+(?:\.[\w-]+)+(?:\/.*)?$)/i.test(query);

    const url = looksLikeUrl ? normalizeUrl(query) : null;

    if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }

    const engines = {
        google: "https://www.google.com/search?q=",
        bing: "https://www.bing.com/search?q=",
        duckduckgo: "https://duckduckgo.com/?q="
    };

    const engine = $("#search-engine").value;
    window.open(
        (engines[engine] || engines.google) + encodeURIComponent(query),
        "_blank",
        "noopener,noreferrer"
    );
});

function updateClock() {
    const now = new Date();

    $("#clock-text").textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: $("#clock-format").value === "12"
    });

    $("#date-text").textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric"
    });

    const hour = now.getHours();

    $("#greeting").textContent =
        hour < 12 ? "GOOD MORNING" :
            hour < 17 ? "GOOD AFTERNOON" :
                hour < 21 ? "GOOD EVENING" :
                    "NICE TO SEE YOU";
}

$("#task-form").addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#task-input");
    const text = input.value.trim();
    if (!text) return;

    tasks.push({
        id: window.crypto?.randomUUID?.() || String(Date.now()),
        text,
        done: false
    });

    write("tasks", tasks);
    input.value = "";
    renderTasks();
    notify("Task added.");
});

function renderTasks() {
    const list = $("#task-list");
    list.replaceChildren();

    if (!tasks.length) {
        list.append(emptyState(
            "All clear",
            "Add a task when something needs doing."
        ));
        return;
    }

    tasks.forEach(task => {
        const row = document.createElement("div");
        row.className = "list-item" + (task.done ? " done" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.done;
        checkbox.setAttribute("aria-label", "Complete " + task.text);

        checkbox.addEventListener("change", () => {
            task.done = checkbox.checked;
            write("tasks", tasks);
            renderTasks();
        });

        const label = document.createElement("span");
        label.textContent = task.text;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-item";
        remove.setAttribute("aria-label", "Delete task");
        remove.innerHTML = '<i class="fa-solid fa-trash"></i>';

        remove.addEventListener("click", () => {
            tasks = tasks.filter(item => item.id !== task.id);
            write("tasks", tasks);
            renderTasks();
        });

        row.append(checkbox, label, remove);
        list.append(row);
    });
}

$("#notes-editor").value = read("notes", "");

$("#notes-editor").addEventListener("input", () => {
    $("#notes-status").textContent = "Saving...";
    clearTimeout(notesTimer);

    notesTimer = setTimeout(() => {
        const success = write("notes", $("#notes-editor").value);
        $("#notes-status").textContent = success
            ? "Saved on this device"
            : "Could not save notes";
    }, 250);
});

$("#search-engine").value = read("search-engine", "google");
$("#clock-format").value = read("clock-format", "24");
$("#accent-color").value = read("accent-color", "bronze");
$("#compact-mode").checked = read("compact-mode", true);
$("#show-date").checked = read("show-date", true);

function applySettings() {
    document.body.dataset.accent = $("#accent-color").value;
    document.body.classList.toggle("compact", $("#compact-mode").checked);
    document.body.classList.toggle("show-date", $("#show-date").checked);
}

$("#search-engine").addEventListener("change", () => {
    write("search-engine", $("#search-engine").value);
    notify("Search engine updated.");
});

$("#clock-format").addEventListener("change", () => {
    write("clock-format", $("#clock-format").value);
    updateClock();
});

$("#accent-color").addEventListener("change", () => {
    write("accent-color", $("#accent-color").value);
    applySettings();
});

$("#compact-mode").addEventListener("change", () => {
    write("compact-mode", $("#compact-mode").checked);
    applySettings();
});

$("#show-date").addEventListener("change", () => {
    write("show-date", $("#show-date").checked);
    applySettings();
});

$("#clear-favorites").addEventListener("click", () => {
    if (!confirm("Remove all favorite shortcuts?")) return;

    favorites = [];
    persistCollections();
    renderFavorites();
    notify("Favorites cleared.");
});

$("#clear-apps").addEventListener("click", () => {
    if (!confirm("Delete all apps from your collection?")) return;

    apps = [];
    persistCollections();
    renderApps();
    notify("Apps cleared.");
});

$("#reset-all").addEventListener("click", () => {
    if (!confirm("Reset Bronzze settings, favorites, apps, quick tools, tasks and notes?")) return;

    stopStudyTimer();

    [
        "apps", "favorites", "quick-tools", "tasks", "notes",
        "search-engine", "clock-format", "accent-color",
        "compact-mode", "show-date", "study-subject", "study-goal"
    ].forEach(key => localStorage.removeItem(STORE + key));

    location.reload();
});

/* Study timer */

function updateStudyDescription() {
    const subject = $("#study-subject").value.trim();
    const goal = $("#study-goal").value.trim();

    $("#study-current-subject").textContent = subject || "Ready when you are.";
    $("#study-current-goal").textContent = goal || "Choose a goal to guide your session.";
}

$("#study-subject").value = read("study-subject", "");
$("#study-goal").value = read("study-goal", "");

["study-subject", "study-goal"].forEach(id => {
    $("#" + id).addEventListener("input", () => {
        write(id, $("#" + id).value);
        updateStudyDescription();
    });
});

function renderTimer() {
    const minutes = Math.floor(studyRemaining / 60);
    const seconds = studyRemaining % 60;

    $("#study-timer").textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");
}

function stopStudyTimer() {
    clearInterval(studyInterval);
    studyInterval = null;
    studyRunning = false;
    $("#study-start").innerHTML = '<i class="fa-solid fa-play"></i> Start studying';
}

function finishStudyTimer() {
    stopStudyTimer();
    studyRemaining = 0;
    renderTimer();
    $("#study-status").textContent = "Session complete. Great work!";
    notify("Focus session complete!");
}

$("#study-start").addEventListener("click", () => {
    if (studyRunning) {
        stopStudyTimer();
        $("#study-status").textContent = "Timer paused.";
        return;
    }

    if (!$("#study-subject").value.trim() && !$("#study-goal").value.trim()) {
        notify("Enter a subject or goal first.");
        $("#study-subject").focus();
        return;
    }

    if (studyRemaining <= 0) studyRemaining = 25 * 60;

    studyRunning = true;
    $("#study-start").innerHTML = '<i class="fa-solid fa-pause"></i> Pause session';
    $("#study-status").textContent = "Focus on one thing at a time.";

    studyInterval = setInterval(() => {
        studyRemaining = Math.max(0, studyRemaining - 1);
        renderTimer();

        if (studyRemaining === 0) finishStudyTimer();
    }, 1000);
});

$("#study-reset").addEventListener("click", () => {
    stopStudyTimer();
    studyRemaining = 25 * 60;
    renderTimer();
    $("#study-status").textContent = "25-minute focus session";
});

applySettings();
renderFavorites();
renderApps();
renderQuickTools();
renderTasks();
updateClock();
updateStudyDescription();
renderTimer();
setInterval(updateClock, 1000);
