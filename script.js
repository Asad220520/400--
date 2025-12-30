// --- STATE ---
let state = {
  sessionQueue: [],
  currentIndex: 0,
  currentMode: "flashcards",
  learnedIds: JSON.parse(localStorage.getItem("german_learned")) || [],
  tempMatch: null,
  matchesCount: 0,
};

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  updateHeaderStats();
  initTopicSelector();
  renderDictionary();

  // Default view
  showView("dashboard");
});

// --- NAVIGATION & UI ---
function showView(viewId) {
  // Hide all
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  // Show target
  const target = document.getElementById(`view-${viewId}`);
  target.classList.add("active");

  // Bottom Nav Active State
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  if (viewId === "dashboard")
    document.querySelectorAll(".nav-btn")[0].classList.add("active");
  if (viewId === "dictionary")
    document.querySelectorAll(".nav-btn")[1].classList.add("active");

  // Scroll to top
  document.getElementById("main-content").scrollTop = 0;
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// --- SETUP ---
function initTopicSelector() {
  const select = document.getElementById("topic-select");
  const topics = [...new Set(phrasesDB.map((p) => p.topic))];
  topics.forEach((t) => {
    let opt = document.createElement("option");
    opt.value = t;
    opt.innerText = t.toUpperCase();
    select.appendChild(opt);
  });
}

// --- SESSION LOGIC ---
function prepareSession(count) {
  vibrate(50); // Haptic feedback
  const topic = document.getElementById("topic-select").value;
  let pool = phrasesDB;

  if (topic !== "all") pool = pool.filter((p) => p.topic === topic);

  if (count === null) {
    // "New Words" mode
    pool = pool.filter((p) => !state.learnedIds.includes(p.id));
    count = 15;
  }

  // Shuffle & Cut
  state.sessionQueue = pool.sort(() => 0.5 - Math.random()).slice(0, count);

  if (state.sessionQueue.length === 0) {
    alert("В этой категории всё выучено!");
    return;
  }

  // Render Preview
  const list = document.getElementById("preview-list");
  list.innerHTML = "";
  state.sessionQueue.forEach((item) => {
    list.innerHTML += `
            <div class="preview-item">
                <span><b>${item.de}</b></span>
                <span style="color:#777">${item.ru}</span>
            </div>
        `;
  });

  showView("preview");
}

function selectMode(mode, btn) {
  state.currentMode = mode;
  document
    .querySelectorAll(".mode-tab")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  vibrate(30);
}

// --- GAMEPLAY ---
function startGame() {
  state.currentIndex = 0;
  showView("game");
  loadCard();
}

function endGame() {
  showView("dashboard");
}

function loadCard() {
  const container = document.getElementById("game-area");
  container.innerHTML = "";

  // Update Progress
  const progress = (state.currentIndex / state.sessionQueue.length) * 100;
  document.getElementById("step-bar").style.width = `${progress}%`;

  // Check Win
  if (state.currentIndex >= state.sessionQueue.length) {
    document.getElementById("step-bar").style.width = "100%";
    container.innerHTML = `
            <div style="text-align:center; padding-top:50px; animation: popIn 0.5s;">
                <i class="ph-fill ph-trophy" style="font-size:5rem; color:#ffd700; margin-bottom:20px;"></i>
                <h1>Отлично!</h1>
                <p>Ты повторил ${state.sessionQueue.length} слов.</p>
                <button class="main-btn" onclick="endGame()">ЗАВЕРШИТЬ</button>
            </div>
        `;
    vibrate([100, 50, 100]); // Victory buzz
    return;
  }

  const item = state.sessionQueue[state.currentIndex];

  // Mode Router
  if (state.currentMode === "flashcards") renderFlashcard(item, container);
  else if (state.currentMode === "quiz") renderQuiz(item, container);
  else if (state.currentMode === "match") renderMatch(item, container);
  else if (state.currentMode === "builder") renderBuilder(item, container);
}

function next() {
  state.currentIndex++;
  loadCard();
}

function speak(txt) {
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = "de-DE";
  window.speechSynthesis.speak(u);
}

// --- FLASHCARDS ---
function renderFlashcard(item, el) {
  el.innerHTML = `
        <div class="fc-scene" onclick="this.querySelector('.fc-card').classList.toggle('flipped'); speak('${
          item.de
        }')">
            <div class="fc-card">
                <div class="fc-face front">
                    <i class="ph-fill ph-speaker-high" style="font-size:1.5rem; color:var(--primary); margin-bottom:15px;"></i>
                    ${item.de}
                </div>
                <div class="fc-face back">
                    <div style="font-size:1.2rem; font-weight:bold">${
                      item.ru
                    }</div>
                    <div style="color:#888; margin-top:10px; font-size:0.9rem">${
                      item.grammar || ""
                    }</div>
                </div>
            </div>
        </div>
        <button class="action-btn" onclick="next()">ПОНЯТНО</button>
    `;
}

// --- QUIZ ---
function renderQuiz(item, el) {
  let opts = [
    item,
    ...phrasesDB
      .filter((p) => p.id !== item.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3),
  ].sort(() => Math.random() - 0.5);

  el.innerHTML = `
        <h2 style="text-align:center; margin-bottom:20px;">${item.ru}</h2>
        <div class="quiz-grid">
            ${opts
              .map(
                (o) =>
                  `<button class="quiz-btn" onclick="checkQuiz(this, ${o.id}, ${item.id})">${o.de}</button>`
              )
              .join("")}
        </div>
        <button class="action-btn" id="next-btn" style="display:none; margin-top:20px;" onclick="next()">ДАЛЕЕ</button>
    `;
  speak(item.de);
}

function checkQuiz(btn, clickId, correctId) {
  if (document.querySelector(".quiz-btn.correct")) return;

  if (clickId === correctId) {
    btn.classList.add("correct");
    vibrate(50); // Success
    // Auto mark learned? Optional
  } else {
    btn.classList.add("wrong");
    vibrate([50, 50, 50]); // Error
    document.querySelectorAll(".quiz-btn").forEach((b) => {
      if (b.innerText === phrasesDB.find((p) => p.id === correctId).de)
        b.classList.add("correct");
    });
  }
  document.getElementById("next-btn").style.display = "flex";
}

// --- MATCH ---
function renderMatch(item, el) {
  let pool = [
    item,
    ...phrasesDB
      .filter((p) => p.id !== item.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3),
  ];
  let cards = [];
  pool.forEach((p) => {
    cards.push({ id: p.id, txt: p.de, type: "de" });
    cards.push({ id: p.id, txt: p.ru, type: "ru" });
  });
  cards.sort(() => Math.random() - 0.5);
  state.matchesCount = 0;

  el.innerHTML = `
        <h3 style="text-align:center; margin-bottom:15px;">Найди пары</h3>
        <div class="match-grid">
            ${cards
              .map(
                (c) =>
                  `<div class="match-card" data-id="${c.id}" onclick="handleMatch(this, '${c.txt}')">${c.txt}</div>`
              )
              .join("")}
        </div>
        <button class="action-btn" id="match-next" style="display:none; margin-top:20px;" onclick="next()">ОТЛИЧНО</button>
    `;
}

function handleMatch(el, txt) {
  if (el.classList.contains("matched") || el.classList.contains("selected"))
    return;
  vibrate(20);

  // Speak German
  if (phrasesDB.some((p) => p.de === txt)) speak(txt);

  el.classList.add("selected");

  if (!state.tempMatch) {
    state.tempMatch = el;
  } else {
    let id1 = state.tempMatch.dataset.id;
    let id2 = el.dataset.id;

    if (id1 === id2) {
      // Success
      el.classList.remove("selected");
      state.tempMatch.classList.remove("selected");
      el.classList.add("matched");
      state.tempMatch.classList.add("matched");
      state.tempMatch = null;
      state.matchesCount++;
      vibrate(50);
      if (state.matchesCount === 4)
        document.getElementById("match-next").style.display = "flex";
    } else {
      // Fail
      vibrate([30, 30]);
      setTimeout(() => {
        el.classList.remove("selected");
        state.tempMatch.classList.remove("selected");
        state.tempMatch = null;
      }, 400);
    }
  }
}

// --- BUILDER ---
function renderBuilder(item, el) {
  let parts = item.de.split(" ").sort(() => Math.random() - 0.5);
  el.innerHTML = `
        <h3 style="text-align:center; margin-bottom:20px;">${item.ru}</h3>
        <div class="builder-area" id="drop-zone"></div>
        <div class="word-bank">
            ${parts
              .map(
                (w) =>
                  `<div class="word-chip" onclick="moveWord(this)">${w}</div>`
              )
              .join("")}
        </div>
        <div id="build-msg" style="text-align:center; height:20px; margin:10px 0; font-weight:bold"></div>
        <button class="action-btn" onclick="checkBuilder('${
          item.de
        }')">ПРОВЕРИТЬ</button>
        <button class="action-btn" id="b-next" style="display:none; background:var(--secondary); margin-top:10px" onclick="next()">ДАЛЕЕ</button>
    `;
}

function moveWord(el) {
  vibrate(10);
  const zone = document.getElementById("drop-zone");
  const bank = el.parentElement.classList.contains("word-bank")
    ? el.parentElement
    : document.querySelector(".word-bank");

  if (el.parentElement === zone) {
    document.querySelector(".word-bank").appendChild(el);
  } else {
    zone.appendChild(el);
    speak(el.innerText);
  }
}

function checkBuilder(correct) {
  const user = Array.from(document.getElementById("drop-zone").children)
    .map((c) => c.innerText)
    .join(" ");
  const cleanUser = user.replace(/[.,?!]/g, "").toLowerCase();
  const cleanCorrect = correct.replace(/[.,?!]/g, "").toLowerCase();

  const msg = document.getElementById("build-msg");
  if (cleanUser === cleanCorrect) {
    msg.innerText = "Правильно!";
    msg.style.color = "var(--primary)";
    document.getElementById("b-next").style.display = "flex";
    vibrate(50);
  } else {
    msg.innerText = "Ошибка";
    msg.style.color = "red";
    vibrate([50, 50]);
  }
}

// --- DICTIONARY ---
function renderDictionary() {
  const list = document.getElementById("dict-list");
  const filter = document.getElementById("search-input").value.toLowerCase();
  list.innerHTML = "";

  phrasesDB.forEach((p) => {
    if (
      p.de.toLowerCase().includes(filter) ||
      p.ru.toLowerCase().includes(filter)
    ) {
      const isLearned = state.learnedIds.includes(p.id);
      const div = document.createElement("div");
      div.className = `dict-item ${isLearned ? "learned" : ""}`;
      div.innerHTML = `
                <div class="check-circle ${
                  isLearned ? "checked" : ""
                }" onclick="toggleLearned(${p.id})">
                    <i class="ph-bold ph-check"></i>
                </div>
                <div class="dict-text" onclick="speak('${p.de}')">
                    <b>${p.de}</b>
                    <span>${p.ru}</span>
                </div>
            `;
      list.appendChild(div);
    }
  });
  updateHeaderStats();
}

function toggleLearned(id) {
  vibrate(20);
  if (state.learnedIds.includes(id))
    state.learnedIds = state.learnedIds.filter((i) => i !== id);
  else state.learnedIds.push(id);
  localStorage.setItem("german_learned", JSON.stringify(state.learnedIds));
  renderDictionary();
}

function updateHeaderStats() {
  const count = state.learnedIds.length;
  document.getElementById("header-learned").innerText = count;

  const percent = Math.round((count / phrasesDB.length) * 100);
  document.getElementById("global-progress").style.width = `${percent}%`;
}

function resetProgress() {
  if (confirm("Сбросить весь прогресс?")) {
    localStorage.clear();
    location.reload();
  }
}
