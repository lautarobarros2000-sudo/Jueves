const supabaseUrl = "https://jvefzcnujhpqgyedmmxp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabaseClient = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

let people = [];
let meetings = [];
let attendance = [];
let todayMeetingId = null;

/* =========================
   INIT
========================= */

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
}

/* =========================
   CARGA
========================= */

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
      <label class="person">
        ${p.name}
        <input type="checkbox" value="${p.id}" />
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

/* =========================
   GUARDAR HOY (CORREGIDO)
========================= */

document.getElementById("saveBtn").addEventListener("click", async () => {
  const today = new Date().toISOString().split("T")[0];

  // Buscar si ya existe reunión hoy
  const { data: existing } = await supabaseClient
    .from("meetings")
    .select("*")
    .eq("date", today);

  if (!existing || existing.length === 0) {
    const { data: newMeeting } = await supabaseClient
      .from("meetings")
      .insert({ date: today })
      .select();

    todayMeetingId = newMeeting[0].id;
  } else {
    todayMeetingId = existing[0].id;
  }

  const checked = document.querySelectorAll("input[type='checkbox']:checked");

  await supabaseClient
    .from("attendance")
    .delete()
    .eq("meeting_id", todayMeetingId);

  for (let box of checked) {
    await supabaseClient.from("attendance").insert({
      person_id: box.value,
      meeting_id: todayMeetingId
    });
  }

  await loadAllData();
  renderAll();
});

/* =========================
   RANKING GENERAL
========================= */

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  const rankingData = people.map(p => {
    const total = attendance.filter(a => a.person_id == p.id).length;
    const percentage =
      meetings.length > 0
        ? ((total / meetings.length) * 100).toFixed(0)
        : 0;

    return { name: p.name, total, percentage };
  });

  rankingData.sort((a, b) => b.total - a.total);

  rankingData.forEach((p, index) => {
    const medal = index === 0 ? "🥇" :
                  index === 1 ? "🥈" :
                  index === 2 ? "🥉" : "";

    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>${p.total} (${p.percentage}%) ${medal}</span>
      </div>
    `;
  });
}

/* =========================
   🔥 RACHAS ACTUALES
========================= */

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
      if (
        (present && type === "present") ||
        (!present && type === "absent")
      ) {
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

    if (result.type === "present") {
      positives.push(data);
    } else {
      negatives.push(data);
    }
  });

  positives.sort((a, b) => b.streak - a.streak);
  negatives.sort((a, b) => b.streak - a.streak);

  // 🔥 POSITIVAS ARRIBA
  positives.forEach(p => {
    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>🔥 ${p.streak} asistiendo</span>
      </div>
    `;
  });

  // ❄️ NEGATIVAS ABAJO
  negatives.forEach(p => {
    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>❄️ ${p.streak} sin asistir</span>
      </div>
    `;
  });
}

/* =========================
   🏆 MEJORES RACHAS HISTÓRICAS
========================= */

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
    const medal = index === 0 ? "🥇" :
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

/* =========================
   HISTORIAL
========================= */

function renderMeetingsLog() {
  const div = document.getElementById("meetingsLog");
  div.innerHTML = "";

  meetings.forEach((meeting, index) => {
    const meetingNumber = index + 1;

    const attendees = attendance
      .filter(a => a.meeting_id === meeting.id)
      .map(a => {
        const person = people.find(p => p.id == a.person_id);
        return person ? person.name : "";
      });

    div.innerHTML += `
      <div class="person">
        <strong>Juntada #${meetingNumber} - ${meeting.date}</strong>
        <div>${attendees.join(", ") || "Sin asistentes"}</div>
      </div>
    `;
  });
}

init();
