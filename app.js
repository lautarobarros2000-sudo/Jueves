const supabaseUrl = "https://jvefzcnujhpqgyedmmxp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s"; // deja tu key

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
        <div class="meeting-header">
          <strong>Juntada #${meetingNumber}</strong>
          <div class="meeting-actions">
            <button onclick="toggleDetails(${meeting.id})">Ver</button>
            <button onclick="editMeeting(${meeting.id})">Editar</button>
            <button onclick="deleteMeeting(${meeting.id})">Eliminar</button>
          </div>
        </div>
        <div id="details-${meeting.id}" class="meeting-details">
          ${attendees.join(", ") || "Sin asistentes"}
        </div>
      </div>
    `;
  });
}

function toggleDetails(id) {
  const el = document.getElementById(`details-${id}`);
  el.style.display = el.style.display === "block" ? "none" : "block";
}

async function deleteMeeting(id) {
  if (!confirm("¿Eliminar esta juntada?")) return;

  await supabaseClient.from("attendance").delete().eq("meeting_id", id);
  await supabaseClient.from("meetings").delete().eq("id", id);

  await loadAllData();
  renderAll();
}

async function editMeeting(id) {
  const newDate = prompt("Nueva fecha (YYYY-MM-DD):");
  if (!newDate) return;

  await supabaseClient
    .from("meetings")
    .update({ date: newDate })
    .eq("id", id);

  await loadAllData();
  renderAll();
}

init();
