const supabaseUrl =
  "https://jvefzcnujhpqgyedmmxp.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const ADMIN_PASSWORD = "Faro";


/* ========================= PASSWORD ========================= */

function requirePassword() {
  const input = prompt("Ingresá la contraseña");
  if (input !== ADMIN_PASSWORD) {
    alert("Contraseña incorrecta");
    return false;
  }
  return true;
}


/* ========================= EMOJIS ========================= */

const STREAK_EMOJIS = {
  positive: [
    { value: 50, emoji: "🏆" },
    { value: 40, emoji: "👑" },
    { value: 30, emoji: "🌟" },
    { value: 20, emoji: "⚡" },
    { value: 10, emoji: "💎" },
    { value: 5,  emoji: "🚀" },
    { value: 3,  emoji: "🔥" }
  ],
  negative: [
    { value: 50, emoji: "⚰️" },
    { value: 40, emoji: "🪦" },
    { value: 30, emoji: "☠️" },
    { value: 20, emoji: "💀" },
    { value: 10, emoji: "🌪️" },
    { value: 5,  emoji: "🌧️" },
    { value: 3,  emoji: "🧊" }
  ]
};

function getStreakEmoji(personId) {
  const result = calculateCurrentStreak(personId);
  if (!result) return "";
  const dict = result.type === "present" ? STREAK_EMOJIS.positive : STREAK_EMOJIS.negative;
  for (let rule of dict) {
    if (result.streak >= rule.value) return rule.emoji;
  }
  return "";
}

let people = [];
let meetings = [];
let attendance = [];


/* ========================= RESPONSIVE: TABS vs DESKTOP ========================= */

function isMobile() {
  return window.innerWidth <= 768;
}

// On desktop: all sections always visible, ignore tabs
// On mobile: only active tab section visible
function applyLayout() {
  const wrappers = [
    document.getElementById("tab-ranking-wrapper"),
    document.getElementById("tab-rachas-wrapper"),
    document.getElementById("tab-historial-wrapper"),
  ];
  const mobileDictCard = document.getElementById("mobile-dict-card");

  if (!isMobile()) {
    // Desktop: show all, ignore tab state
    wrappers.forEach(w => { w.style.display = "contents"; });
    // Move ranking + beststreaks into 2-col grid properly
    const rankingCard   = document.getElementById("ranking-card");
    const bestStreaksCard = document.getElementById("beststreaks-card");
    if (rankingCard) rankingCard.classList.remove("card-full");
    if (bestStreaksCard) bestStreaksCard.classList.remove("card-full");
    if (mobileDictCard) mobileDictCard.style.display = "none";
  } else {
    // Mobile: use tab visibility
    updateMobileTabs();
    const rankingCard   = document.getElementById("ranking-card");
    const bestStreaksCard = document.getElementById("beststreaks-card");
    if (rankingCard) rankingCard.classList.add("card-full");
    if (bestStreaksCard) bestStreaksCard.classList.add("card-full");
    // Show mobile dict inside ranking tab
    if (mobileDictCard) mobileDictCard.style.display = "block";
  }
}

function updateMobileTabs() {
  const activeTab = document.querySelector(".tab.active");
  if (!activeTab) return;
  const activeKey = activeTab.dataset.tab;

  const map = {
    ranking:  "tab-ranking-wrapper",
    rachas:   "tab-rachas-wrapper",
    historial:"tab-historial-wrapper",
  };

  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (key === activeKey) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if (isMobile()) updateMobileTabs();
  });
});

window.addEventListener("resize", applyLayout);


/* ========================= MODAL ========================= */

const newMeetingOverlay = document.getElementById("newMeetingOverlay");
const meetingDateInput  = document.getElementById("meetingDateInput");

document.getElementById("openNewMeetingBtn").addEventListener("click", () => {
  meetingDateInput.value = new Date().toISOString().split("T")[0];
  document.querySelectorAll("#people-list input[type='checkbox']").forEach(c => c.checked = false);
  newMeetingOverlay.classList.add("open");
});

document.getElementById("cancelNewMeeting").addEventListener("click", () => {
  newMeetingOverlay.classList.remove("open");
});

newMeetingOverlay.addEventListener("click", e => {
  if (e.target === newMeetingOverlay) newMeetingOverlay.classList.remove("open");
});


/* ========================= INIT ========================= */

async function init() {
  await loadPeople();
  await loadAllData();
  renderAll();
  applyLayout();
}

function renderAll() {
  renderRanking();
  renderStreaks();
  renderBestHistoricalStreaks();
  renderMeetingsLog();
  renderStreakDictionary();
}


/* ========================= LOAD ========================= */

async function loadPeople() {
  const { data } = await supabaseClient
    .from("people")
    .select("*")
    .order("name");

  people = data || [];

  const container = document.getElementById("people-list");
  container.innerHTML = "";

  people.forEach(p => {
    container.innerHTML += `
      <label class="person-check">
        <input type="checkbox" value="${p.id}" />
        ${p.name}
      </label>
    `;
  });
}

async function loadAllData() {
  const { data: m } = await supabaseClient
    .from("meetings")
    .select("*")
    .order("date", { ascending: true });

  const { data: a } = await supabaseClient
    .from("attendance")
    .select("*");

  meetings = m || [];
  attendance = a || [];
}


/* ========================= GUARDAR ========================= */

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!requirePassword()) return;

  const selectedDate = meetingDateInput.value;
  if (!selectedDate) {
    alert("Por favor seleccioná una fecha.");
    return;
  }

  const existing = meetings.find(m => m.date === selectedDate);
  let meetingId;

  if (existing) {
    if (!confirm(`Ya existe una juntada el ${selectedDate}. ¿Querés sobrescribir la asistencia?`)) return;
    meetingId = existing.id;
  } else {
    const { data: newMeeting } = await supabaseClient
      .from("meetings")
      .insert({ date: selectedDate })
      .select();
    meetingId = newMeeting?.[0]?.id;
  }

  const checked = document.querySelectorAll("#people-list input[type='checkbox']:checked");

  await supabaseClient.from("attendance").delete().eq("meeting_id", meetingId);

  for (let box of checked) {
    await supabaseClient.from("attendance").insert({
      person_id: box.value,
      meeting_id: meetingId
    });
  }

  newMeetingOverlay.classList.remove("open");
  await loadAllData();
  renderAll();
});


/* ========================= RANKING ========================= */

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  const rankingData = people.map(p => {
    const total = attendance.filter(a => a.person_id == p.id).length;
    const percentage = meetings.length > 0
      ? ((total / meetings.length) * 100).toFixed(0)
      : 0;
    return { name: p.name, total, percentage, emoji: getStreakEmoji(p.id) };
     // AGREGÁ ESTO:
    if (p.name === "Pancho") {
      console.log("Pancho total:", total);
      console.log("meetings.length:", meetings.length);
      console.log("attendance de Pancho:", attendance.filter(a => a.person_id == p.id));
    }

    return { name: p.name, total, percentage, emoji: getStreakEmoji(p.id) };
  
  });

  rankingData.sort((a, b) => b.total - a.total);

  rankingData.forEach((p, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
    div.innerHTML += `
      <div class="person">
        ${p.name} ${p.emoji || ""}
        <span>${p.total} (${p.percentage}%) ${medal}</span>
      </div>
    `;
  });
}


/* ========================= RACHAS ========================= */

function calculateCurrentStreak(personId) {
  if (meetings.length === 0) return null;

  const ordered = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));

  let streak = 0;
  let type = null;

  for (let i = 0; i < ordered.length; i++) {
    const present = attendance.some(
      a => a.person_id == personId && a.meeting_id === ordered[i].id
    );
    if (i === 0) {
      type = present ? "present" : "absent";
      streak = 1;
    } else {
      if ((present && type === "present") || (!present && type === "absent")) {
        streak++;
      } else {
        break;
      }
    }
  }

  return { type, streak };
}

function renderStreaks() {
  const div = document.getElementById("streaks");
  div.innerHTML = "";

  let positives = [];
  let negatives = [];

  people.forEach(p => {
    const result = calculateCurrentStreak(p.id);
    if (!result) return;
    const data = { name: p.name, ...result };
    if (result.type === "present") positives.push(data);
    else negatives.push(data);
  });

  positives.sort((a, b) => b.streak - a.streak);
  negatives.sort((a, b) => b.streak - a.streak);

  if (positives.length) {
    div.innerHTML += `<div class="card-section-title">✅ Asistiendo seguido</div>`;
    positives.forEach(p => {
      div.innerHTML += `
        <div class="person">${p.name}<span>🔥 ${p.streak} seguidas</span></div>
      `;
    });
  }

  if (negatives.length) {
    div.innerHTML += `<div class="card-section-title" style="margin-top:12px;">❌ Sin asistir</div>`;
    negatives.forEach(p => {
      div.innerHTML += `
        <div class="person">${p.name}<span>❄️ ${p.streak} ausencias</span></div>
      `;
    });
  }
}


/* ========================= BEST STREAKS ========================= */

function calculateBestStreak(personId) {
  if (meetings.length === 0) return 0;
  const ordered = [...meetings].sort((a, b) => new Date(a.date) - new Date(b.date));
  let best = 0;
  let current = 0;
  for (let meeting of ordered) {
    const present = attendance.some(
      a => a.person_id == personId && a.meeting_id === meeting.id
    );
    if (present) { current++; if (current > best) best = current; }
    else { current = 0; }
  }
  return best;
}

function renderBestHistoricalStreaks() {
  const div = document.getElementById("bestStreaks");
  if (!div) return;
  div.innerHTML = "";

  let data = people.map(p => ({ name: p.name, best: calculateBestStreak(p.id) }));
  data.sort((a, b) => b.best - a.best);

  data.forEach((p, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
    div.innerHTML += `
      <div class="person">${p.name}<span>${p.best} seguidas ${medal}</span></div>
    `;
  });
}


/* ========================= HISTORIAL ========================= */

function renderMeetingsLog() {
  const div = document.getElementById("meetingsLog");
  div.innerHTML = "";

  const sorted = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(meeting => {
    const meetingNumber = meetings.indexOf(meeting) + 1;

    const attendees = attendance
      .filter(a => a.meeting_id === meeting.id)
      .map(a => {
        const person = people.find(p => p.id == a.person_id);
        return person ? person.name : "";
      });

    const entry   = document.createElement("div");
    entry.className = "meeting-entry";

    const headerRow = document.createElement("div");
    headerRow.className = "meeting-header-row";

    const title = document.createElement("strong");
    title.textContent = `Juntada #${meetingNumber} — ${meeting.date}`;

    const btnView   = document.createElement("button");
    const btnEdit   = document.createElement("button");
    const btnDelete = document.createElement("button");

    btnView.className   = "meeting-action-btn";
    btnEdit.className   = "meeting-action-btn";
    btnDelete.className = "meeting-action-btn delete";

    btnView.textContent   = "Ver";
    btnEdit.textContent   = "Editar";
    btnDelete.textContent = "Eliminar";

    const detailsRow = document.createElement("div");
    detailsRow.className = "meeting-details-row";
    detailsRow.style.display = "none";
    detailsRow.textContent = attendees.join(", ") || "Sin asistentes";

    btnView.onclick = () => {
      detailsRow.style.display = detailsRow.style.display === "none" ? "block" : "none";
    };

    btnEdit.onclick = () => {
      if (!requirePassword()) return;
      openEditModal(meeting);
    };

    btnDelete.onclick = async () => {
      if (!requirePassword()) return;
      if (!confirm("¿Eliminar esta juntada?")) return;
      await supabaseClient.from("attendance").delete().eq("meeting_id", meeting.id);
      await supabaseClient.from("meetings").delete().eq("id", meeting.id);
      await loadAllData();
      renderAll();
    };

    headerRow.append(title, btnView, btnEdit, btnDelete);
    entry.append(headerRow, detailsRow);
    div.appendChild(entry);
  });
}


/* ========================= EDIT MODAL ========================= */

function openEditModal(meeting) {
const current = attendance
  .filter(a => a.meeting_id === meeting.id)
  .map(a => String(a.person_id));  // ← string, no número

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";

  const box = document.createElement("div");
  box.className = "modal-box";

  box.innerHTML = `
    <h3>✏️ Editar Asistentes</h3>
    <div class="field-label">Juntada ${meeting.date}</div>
    <div style="margin-top:12px;" class="people-grid">
      ${people.map(p => `
        <label class="person-check">
          <input type="checkbox" value="${p.id}" ${current.includes(p.id) ? "checked" : ""}>
          ${p.name}
        </label>
      `).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" id="cancelEdit">Cancelar</button>
      <button class="btn-save" id="saveEdit">Guardar</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector("#cancelEdit").onclick = () => document.body.removeChild(overlay);

  box.querySelector("#saveEdit").onclick = async () => {
    const checked = box.querySelectorAll("input:checked");
    await supabaseClient.from("attendance").delete().eq("meeting_id", meeting.id);
    for (let c of checked) {
      await supabaseClient.from("attendance").insert({
        meeting_id: meeting.id,
        person_id: c.value
      });
    }
    document.body.removeChild(overlay);
    await loadAllData();
    renderAll();
  };

  overlay.onclick = e => {
    if (e.target === overlay) document.body.removeChild(overlay);
  };
}


/* ========================= DICCIONARIO ========================= */

const DICT_HTML = `
  <b>🔥 Racha positiva</b>
  🔥 3 — 🚀 5 — 💎 10 — ⚡ 20 — 🌟 30 — 👑 40 — 🏆 50+
  <br><br>
  <b>❄️ Racha negativa</b>
  🧊 3 — 🌧️ 5 — 🌪️ 10 — 💀 20 — ☠️ 30 — 🪦 40 — ⚰️ 50+
`;

function renderStreakDictionary() {
  const el = document.getElementById("streakDictionary");
  if (el) el.innerHTML = DICT_HTML;

  const el2 = document.getElementById("streakDictionaryMobile");
  if (el2) el2.innerHTML = DICT_HTML;
}


/* ========================= GO ========================= */
init();
