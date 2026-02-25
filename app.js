const supabaseUrl =
  "https://jvefzcnujhpqgyedmmxp.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabaseClient = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

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


/* ========================= EMOJIS RACHAS ========================= */

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


/* ========================= FUNCION EMOJI ========================= */

function getStreakEmoji(personId) {
  const result = calculateCurrentStreak(personId);
  if (!result) return "";
  const dictionary =
    result.type === "present"
      ? STREAK_EMOJIS.positive
      : STREAK_EMOJIS.negative;
  for (let rule of dictionary) {
    if (result.streak >= rule.value) return rule.emoji;
  }
  return "";
}


let people = [];
let meetings = [];
let attendance = [];


/* ========================= TABS ========================= */

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});


/* ========================= MODAL NUEVA JUNTADA ========================= */

const newMeetingOverlay = document.getElementById("newMeetingOverlay");
const meetingDateInput  = document.getElementById("meetingDateInput");

document.getElementById("openNewMeetingBtn").addEventListener("click", () => {
  // Setear fecha de hoy como valor por defecto
  meetingDateInput.value = new Date().toISOString().split("T")[0];
  // Desmarcar todos los checkboxes
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
}

function renderAll() {
  renderRanking();
  renderStreaks();
  renderBestHistoricalStreaks();
  renderMeetingsLog();
  renderStreakDictionary();
}


/* ========================= CARGA ========================= */

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


/* ========================= GUARDAR JUNTADA ========================= */

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!requirePassword()) return;

  const selectedDate = meetingDateInput.value;
  if (!selectedDate) {
    alert("Por favor seleccioná una fecha.");
    return;
  }

  // Verificar si ya existe una juntada en esa fecha
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

  await supabaseClient
    .from("attendance")
    .delete()
    .eq("meeting_id", meetingId);

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


/* ========================= RANKING GENERAL ========================= */

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  const rankingData = people.map(p => {
    const total = attendance.filter(a => a.person_id == p.id).length;
    const percentage =
      meetings.length > 0
        ? ((total / meetings.length) * 100).toFixed(0)
        : 0;
    return { name: p.name, total, percentage, emoji: getStreakEmoji(p.id) };
  });

  rankingData.sort((a, b) => b.total - a.total);

  rankingData.forEach((p, index) => {
    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" : "";

    div.innerHTML += `
      <div class="person">
        ${p.name} ${p.emoji || ""}
        <span>${p.total} (${p.percentage}%) ${medal}</span>
      </div>
    `;
  });
}


/* ========================= 🔥 RACHAS ACTUALES ========================= */

function calculateCurrentStreak(personId) {
  if (meetings.length === 0) return null;

  const ordered = [...meetings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  let streak = 0;
  let type = null;

  for (let i = 0; i < ordered.length; i++) {
    const meeting = ordered[i];
    const present = attendance.some(
      a => a.person_id == personId && a.meeting_id === meeting.id
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
        <div class="person">
          ${p.name}
          <span>🔥 ${p.streak} asistiendo</span>
        </div>
      `;
    });
  }

  if (negatives.length) {
    div.innerHTML += `<div class="card-section-title" style="margin-top:12px;">❌ Sin asistir</div>`;
    negatives.forEach(p => {
      div.innerHTML += `
        <div class="person">
          ${p.name}
          <span>❄️ ${p.streak} sin asistir</span>
        </div>
      `;
    });
  }
}


/* ========================= 🏆 MEJORES RACHAS HISTÓRICAS ========================= */

function calculateBestStreak(personId) {
  if (meetings.length === 0) return 0;

  const ordered = [...meetings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  let best = 0;
  let current = 0;

  for (let meeting of ordered) {
    const present = attendance.some(
      a => a.person_id == personId && a.meeting_id === meeting.id
    );
    if (present) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  return best;
}

function renderBestHistoricalStreaks() {
  const div = document.getElementById("bestStreaks");
  if (!div) return;
  div.innerHTML = "";

  let data = people.map(p => ({
    name: p.name,
    best: calculateBestStreak(p.id)
  }));

  data.sort((a, b) => b.best - a.best);

  data.forEach((p, index) => {
    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" : "";

    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>${p.best} seguidas ${medal}</span>
      </div>
    `;
  });
}


/* ========================= HISTORIAL ========================= */

function renderMeetingsLog() {
  const div = document.getElementById("meetingsLog");
  div.innerHTML = "";

  const sorted = [...meetings].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((meeting, index) => {
    const meetingNumber = meetings.indexOf(meeting) + 1;

    const attendees = attendance
      .filter(a => a.meeting_id === meeting.id)
      .map(a => {
        const person = people.find(p => p.id == a.person_id);
        return person ? person.name : "";
      });

    const card    = document.createElement("div");
    const header  = document.createElement("div");
    const title   = document.createElement("strong");
    const btnView   = document.createElement("button");
    const btnEdit   = document.createElement("button");
    const btnDelete = document.createElement("button");
    const details   = document.createElement("div");

    title.textContent = `Juntada #${meetingNumber} — ${meeting.date}`;
    btnView.textContent   = "Ver";
    btnEdit.textContent   = "Editar";
    btnDelete.textContent = "Eliminar";

    details.style.display = "none";
    details.textContent   = attendees.join(", ") || "Sin asistentes";

    btnView.onclick = () => {
      details.style.display = details.style.display === "none" ? "block" : "none";
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

    header.appendChild(title);
    header.appendChild(btnView);
    header.appendChild(btnEdit);
    header.appendChild(btnDelete);
    card.appendChild(header);
    card.appendChild(details);
    div.appendChild(card);
  });
}


/* ========================= MODAL EDITAR ========================= */

function openEditModal(meeting) {
  const current = attendance
    .filter(a => a.meeting_id === meeting.id)
    .map(a => Number(a.person_id));

  const overlay = document.createElement("div");
  overlay.style =
    "position:fixed;top:0;left:0;width:100%;height:100%;" +
    "background:rgba(0,0,0,0.75);" +
    "display:flex;align-items:flex-end;justify-content:center;z-index:200;";

  const box = document.createElement("div");
  box.style =
    "background:#161b22;padding:24px 20px 32px;border-radius:18px 18px 0 0;" +
    "width:100%;max-width:480px;max-height:85vh;overflow:auto;" +
    "font-family:'DM Sans',sans-serif;border:1px solid #30363d;";

  box.innerHTML = `
    <h3 style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#f0a500;margin-bottom:16px;">Editar Asistentes</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${people.map(p => `
        <label style="display:flex;align-items:center;gap:8px;background:#21262d;border:1px solid #30363d;border-radius:8px;padding:10px 12px;cursor:pointer;font-size:0.88rem;font-weight:500;">
          <input type="checkbox" value="${p.id}" ${current.includes(p.id) ? "checked" : ""} style="accent-color:#f0a500;width:16px;height:16px;">
          ${p.name}
        </label>
      `).join("")}
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button id="cancelEdit" style="flex:1;background:#21262d;border:1px solid #30363d;color:#8b949e;font-family:'DM Sans',sans-serif;font-size:0.95rem;padding:12px;border-radius:8px;cursor:pointer;">Cancelar</button>
      <button id="saveEdit" style="flex:2;background:#f0a500;border:none;color:#000;font-family:'DM Sans',sans-serif;font-weight:700;font-size:0.95rem;padding:12px;border-radius:8px;cursor:pointer;">Guardar</button>
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


/* ========================= DICCIONARIO EMOJIS ========================= */

function renderStreakDictionary() {
  const el = document.getElementById("streakDictionary");
  if (!el) return;

  el.innerHTML = `
    <b>🔥 Racha positiva</b>
    🔥 3 — 🚀 5 — 💎 10 — ⚡ 20 — 🌟 30 — 👑 40 — 🏆 50+
    <br><br>
    <b>❄️ Racha negativa</b>
    🧊 3 — 🌧️ 5 — 🌪️ 10 — 💀 20 — ☠️ 30 — 🪦 40 — ⚰️ 50+
  `;
}


/* ========================= SMALL UI HELPERS ========================= */

// Add section title style dynamically
const style = document.createElement("style");
style.textContent = `.card-section-title { font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#8b949e;margin-bottom:8px; }`;
document.head.appendChild(style);


init();
