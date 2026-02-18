// ==============================
// 🔐 SUPABASE CONFIG (IronKey)
// ==============================

const SUPABASE_URL = "https://jvefzcnujhpqgyedmmxp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==============================
// 📦 VARIABLES GLOBALES
// ==============================

let people = [];
let meetings = [];
let attendance = [];
let todayMeetingId = null;

// ==============================
// 🚀 INIT
// ==============================

init();

async function init() {
  await loadPeople();
  await ensureTodayMeeting();
  await loadAllData();
  renderAll();
}

// ==============================
// 📥 LOAD DATA
// ==============================

async function loadPeople() {
  const { data } = await supabaseClient.from("people").select("*");
  people = data || [];
}

async function loadAllData() {
  const { data: meetingsData } = await supabaseClient
    .from("meetings")
    .select("*");

  const { data: attendanceData } = await supabaseClient
    .from("attendance")
    .select("*");

  meetings = meetingsData || [];
  attendance = attendanceData || [];
}

async function ensureTodayMeeting() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabaseClient
    .from("meetings")
    .select("*")
    .eq("date", today);

  if (data && data.length > 0) {
    todayMeetingId = data[0].id;
  } else {
    todayMeetingId = null; // 🔥 NO crear automáticamente
  }
}

// ==============================
// 💾 SAVE BUTTON
// ==============================

document.getElementById("saveBtn").addEventListener("click", async () => {
  const today = new Date().toISOString().split("T")[0];

  if (!todayMeetingId) {
    const { data: newMeeting } = await supabaseClient
      .from("meetings")
      .insert({ date: today })
      .select();

    todayMeetingId = newMeeting?.[0]?.id;
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

// ==============================
// 🏆 RANKING TOTAL
// ==============================

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  let data = people.map(p => {
    const total = attendance.filter(a => a.person_id == p.id).length;
    return { name: p.name, total };
  });

  data.sort((a, b) => b.total - a.total);

  data.forEach(p => {
    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>${p.total}</span>
      </div>
    `;
  });
}

// ==============================
// 🔥❄️ RACHAS CONSECUTIVAS
// ==============================

function calculateCurrentStreak(personId) {
  if (meetings.length === 0) return 0;

  const ordered = [...meetings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  let streak = 0;

  for (let i = ordered.length - 1; i >= 0; i--) {
    const meeting = ordered[i];

    const present = attendance.some(
      a => a.person_id == personId && a.meeting_id === meeting.id
    );

    if (present) {
      if (streak >= 0) {
        streak++;
      } else {
        break;
      }
    } else {
      if (streak === 0) {
        streak = -1;
      } else if (streak < 0) {
        streak--;
      } else {
        break;
      }
    }
  }

  return streak;
}

function renderStreaks() {
  const div = document.getElementById("streaks");
  div.innerHTML = "";

  let positives = [];
  let negatives = [];

  people.forEach(p => {
    const streak = calculateCurrentStreak(p.id);

    if (streak > 0) {
      positives.push({ name: p.name, streak });
    } else {
      negatives.push({ name: p.name, streak });
    }
  });

  positives.sort((a, b) => b.streak - a.streak);
  negatives.sort((a, b) => a.streak - b.streak);

  // 🔥 POSITIVAS ARRIBA
  positives.forEach(p => {
    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>🔥 ${p.streak} seguidas asistiendo</span>
      </div>
    `;
  });

  // ❄️ NEGATIVAS ABAJO
  negatives.forEach(p => {
    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>❄️ ${Math.abs(p.streak)} sin asistir</span>
      </div>
    `;
  });
}

// ==============================
// 📜 HISTORIAL
// ==============================

function renderMeetingsLog() {
  const div = document.getElementById("meetingsLog");
  div.innerHTML = "";

  const ordered = [...meetings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  ordered.forEach(m => {
    const attendees = attendance
      .filter(a => a.meeting_id === m.id)
      .map(a => people.find(p => p.id == a.person_id)?.name)
      .filter(Boolean);

    div.innerHTML += `
      <div class="meeting">
        <strong>${m.date}</strong>
        <p>${attendees.length ? attendees.join(", ") : "Sin asistentes"}</p>
        <button onclick="deleteMeeting(${m.id})">Eliminar</button>
      </div>
    `;
  });
}

async function deleteMeeting(id) {
  await supabaseClient.from("attendance").delete().eq("meeting_id", id);
  await supabaseClient.from("meetings").delete().eq("id", id);

  await loadAllData();
  renderAll();
}

// ==============================
// 🔁 RENDER ALL
// ==============================

function renderAll() {
  renderRanking();
  renderStreaks();
  renderMeetingsLog();
}
