const supabaseUrl = "https://jvefzcnujhpqgyedmmxp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let people = [];
let meetings = [];
let attendance = [];
let todayMeetingId = null;

async function init() {
  await loadPeople();
  await ensureTodayMeeting();
  await loadAllData();
  renderRanking();
  renderMonthlyRanking();
  renderChart();
}

async function loadPeople() {
  const { data } = await supabase.from("people").select("*");
  people = data;

  const container = document.getElementById("people-list");
  container.innerHTML = "";

  people.forEach(p => {
    container.innerHTML += `
      <div class="person">
        ${p.name}
        <input type="checkbox" value="${p.id}" />
      </div>
    `;
  });
}

async function ensureTodayMeeting() {
  const today = new Date().toISOString().split("T")[0];

  let { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("date", today);

  if (data.length === 0) {
    const { data: newMeeting } = await supabase
      .from("meetings")
      .insert({ date: today })
      .select();

    todayMeetingId = newMeeting[0].id;
  } else {
    todayMeetingId = data[0].id;
  }
}

async function loadAllData() {
  const { data: m } = await supabase.from("meetings").select("*").order("date", { ascending: false });
  const { data: a } = await supabase.from("attendance").select("*");

  meetings = m;
  attendance = a;
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const checked = document.querySelectorAll("input[type='checkbox']:checked");

  for (let box of checked) {
    await supabase.from("attendance").upsert({
      person_id: box.value,
      meeting_id: todayMeetingId
    });
  }

  alert("🔥 Asistencia guardada");
  await loadAllData();
  renderRanking();
  renderMonthlyRanking();
  renderChart();
});

function calculateStreak(personId) {
  let streak = 0;
  for (let m of meetings) {
    const attended = attendance.find(a => a.person_id === personId && a.meeting_id === m.id);
    if (attended) streak++;
    else break;
  }
  return streak;
}

function calculateCold(personId) {
  let cold = 0;
  for (let m of meetings) {
    const attended = attendance.find(a => a.person_id === personId && a.meeting_id === m.id);
    if (!attended) cold++;
    else break;
  }
  return cold;
}

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  people.forEach(p => {
    const total = attendance.filter(a => a.person_id === p.id).length;
    const percentage = meetings.length > 0 ? ((total / meetings.length) * 100).toFixed(0) : 0;
    const streak = calculateStreak(p.id);
    const cold = calculateCold(p.id);
    const perfect = total === meetings.length && total > 0;

    let badges = "";
    if (streak >= 3) badges += "🔥";
    if (cold >= 2) badges += "🧊";
    if (perfect) badges += "👑";

    div.innerHTML += `
      <div class="person">
        ${p.name} - ${total} (${percentage}%) ${badges}
      </div>
    `;
  });
}

function renderMonthlyRanking() {
  const div = document.getElementById("monthlyRanking");
  div.innerHTML = "";

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyMeetings = meetings.filter(m => {
    const d = new Date(m.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  people.forEach(p => {
    const count = attendance.filter(a =>
      a.person_id === p.id &&
      monthlyMeetings.find(m => m.id === a.meeting_id)
    ).length;

    div.innerHTML += `
      <div class="person">
        ${p.name} - ${count}
      </div>
    `;
  });
}

function renderChart() {
  const ctx = document.getElementById("attendanceChart");

  const labels = people.map(p => p.name);
  const dataValues = people.map(p =>
    attendance.filter(a => a.person_id === p.id).length
  );

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Asistencias Totales",
        data: dataValues
      }]
    }
  });
}

init();
