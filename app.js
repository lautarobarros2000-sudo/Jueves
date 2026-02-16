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

async function init() {
  await loadPeople();
  await ensureTodayMeeting();
  await loadAllData();
  renderAll();
}

function renderAll() {
  renderRanking();
  renderMeetingsLog();
  renderStreaks();
}

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

async function ensureTodayMeeting() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabaseClient
    .from("meetings")
    .select("*")
    .eq("date", today);

  if (!data || data.length === 0) {
    const { data: newMeeting } = await supabaseClient
      .from("meetings")
      .insert({ date: today })
      .select();

    todayMeetingId = newMeeting[0].id;
  } else {
    todayMeetingId = data[0].id;
  }
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

document.getElementById("saveBtn").addEventListener("click", async () => {
  const checked = document.querySelectorAll("input[type='checkbox']:checked");

  for (let box of checked) {
    await supabaseClient.from("attendance").upsert({
      person_id: box.value,
      meeting_id: todayMeetingId
    });
  }

  alert("Asistencia guardada 🔥");

  await loadAllData();
  renderAll();
});

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  const rankingData = people.map(p => {
    const total = attendance.filter(a => a.person_id === p.id).length;

    const percentage =
      meetings.length > 0
        ? ((total / meetings.length) * 100).toFixed(0)
        : 0;

    return { name: p.name, total, percentage };
  });

  rankingData.sort((a, b) => b.total - a.total);

  rankingData.forEach((p, index) => {
    let medal = "";
    if (index === 0) medal = "🥇";
    if (index === 1) medal = "🥈";
    if (index === 2) medal = "🥉";

    div.innerHTML += `
      <div class="person">
        ${p.name}
        <span>${p.total} (${p.percentage}%) ${medal}</span>
      </div>
    `;
  });
}

/* ===============================
   🔥 NUEVA FUNCIÓN DE RACHAS
================================ */

function renderStreaks() {
  const div = document.getElementById("streaks");
  div.innerHTML = "";

  if (meetings.length === 0) {
    div.innerHTML = "Sin datos aún";
    return;
  }

  people.forEach(person => {
    let streak = 0;
    let lastType = null; // "present" o "absent"

    // recorremos desde la última juntada hacia atrás
    for (let i = meetings.length - 1; i >= 0; i--) {
      const meeting = meetings[i];

      const wasPresent = attendance.some(
        a => a.person_id === person.id && a.meeting_id === meeting.id
      );

      if (i === meetings.length - 1) {
        lastType = wasPresent ? "present" : "absent";
        streak = 1;
      } else {
        if (
          (wasPresent && lastType === "present") ||
          (!wasPresent && lastType === "absent")
        ) {
          streak++;
        } else {
          break;
        }
      }
    }

    const emoji = lastType === "present" ? "🔥" : "❄️";
    const text =
      lastType === "present"
        ? `${streak} juntadas asistiendo`
        : `${streak} juntadas sin asistir`;

    div.innerHTML += `
      <div class="person">
        ${person.name}
        <span>${emoji} ${text}</span>
      </div>
    `;
  });
}

/* ===============================
   📅 HISTORIAL
================================ */

function renderMeetingsLog() {
  const div = document.getElementById("meetingsLog");
  div.innerHTML = "";

  meetings.forEach((meeting, index) => {
    const meetingNumber = index + 1;

    const attendees = attendance
      .filter(a => a.meeting_id === meeting.id)
      .map(a => {
        const person = people.find(p => p.id === a.person_id);
        return person ? person.name : "";
      });

    div.innerHTML += `
      <div class="meeting-card">
        <strong>Juntada #${meetingNumber} - ${meeting.date}</strong>
        <div>${attendees.join(", ") || "Sin asistentes"}</div>
      </div>
    `;
  });
}

init();

