const supabaseUrl = "https://jvefzcnujhpqgyedmmxp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2ZWZ6Y251amhwcWd5ZWRtbXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDAwODYsImV4cCI6MjA4NjMxNjA4Nn0.uA4GjxOThyoEbps9W2zcZfhHY6DNCS-QE_SgtpeDB5s";

const supabaseClient = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

let people = [];
let meetings = [];
let attendance = [];
let chartInstance = null;

async function init() {
  await loadPeople();
  await loadAllData();
  renderAll();
}

function renderAll() {
  renderRanking();
  renderMonthlyRanking();
  renderChart();
}

async function loadPeople() {
  const { data, error } = await supabaseClient
    .from("people")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  people = data || [];

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

async function loadAllData() {
  const { data: m } = await supabaseClient
    .from("meetings")
    .select("*")
    .order("date", { ascending: false });

  const { data: a } = await supabaseClient
    .from("attendance")
    .select("*");

  meetings = m || [];
  attendance = a || [];
}

document.getElementById("saveBtn").addEventListener("click", async () => {

  const today = new Date().toISOString().split("T")[0];

  // 🔥 Siempre crea una reunión nueva (modo test)
  const { data: newMeeting, error: meetingError } =
    await supabaseClient
      .from("meetings")
      .insert({ date: today })
      .select();

  if (meetingError) {
    console.error(meetingError);
    alert("Error creando reunión");
    return;
  }

  const meetingId = newMeeting[0].id;

  const checked = document.querySelectorAll(
    "input[type='checkbox']:checked"
  );

  for (let box of checked) {
    await supabaseClient.from("attendance").insert({
      person_id: box.value,
      meeting_id: meetingId
    });
  }

  alert("🔥 Reunión creada y asistencia guardada");

  await loadAllData();
  renderAll();
});

function calculateStreak(personId) {
  let streak = 0;

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  for (let meeting of sortedMeetings) {
    const attended = attendance.some(
      a =>
        Number(a.person_id) === Number(personId) &&
        a.meeting_id === meeting.id
    );

    if (attended) streak++;
    else break;
  }

  return streak;
}

function calculateCold(personId) {
  let cold = 0;

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  for (let meeting of sortedMeetings) {
    const attended = attendance.some(
      a =>
        Number(a.person_id) === Number(personId) &&
        a.meeting_id === meeting.id
    );

    if (!attended) cold++;
    else break;
  }

  return cold;
}

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "";

  const rankingData = people.map(p => {
    const total = attendance.filter(
      a => a.person_id === p.id
    ).length;

    const percentage =
      meetings.length > 0
        ? ((total / meetings.length) * 100).toFixed(0)
        : 0;

    const streak = calculateStreak(p.id);
    const cold = calculateCold(p.id);
    const perfect =
      total === meetings.length && total > 0;

    return {
      name: p.name,
      total,
      percentage,
      streak,
      cold,
      perfect
    };
  });

  rankingData.sort((a, b) => b.total - a.total);

  rankingData.forEach((p, index) => {
    let badges = "";

    if (index === 0) badges += " 🥇";
    if (index === 1) badges += " 🥈";
    if (index === 2) badges += " 🥉";

    if (p.streak >= 3) badges += " 🔥";
    if (p.cold >= 2) badges += " 🧊";
    if (p.perfect) badges += " 👑";

    div.innerHTML += `
      <div class="person">
        ${p.name} - ${p.total} (${p.percentage}%) ${badges}
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
    return (
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    );
  });

  const monthlyData = people.map(p => {
    const count = attendance.filter(a =>
      a.person_id === p.id &&
      monthlyMeetings.find(
        m => m.id === a.meeting_id
      )
    ).length;

    return { name: p.name, count };
  });

  monthlyData.sort((a, b) => b.count - a.count);

  monthlyData.forEach((p, index) => {
    let medal = "";
    if (index === 0) medal = " 🥇";
    if (index === 1) medal = " 🥈";
    if (index === 2) medal = " 🥉";

    div.innerHTML += `
      <div class="person">
        ${p.name} - ${p.count}${medal}
      </div>
    `;
  });
}

function renderChart() {
  const ctx = document
    .getElementById("attendanceChart")
    .getContext("2d");

  const chartData = people.map(p => ({
    name: p.name,
    total: attendance.filter(
      a => a.person_id === p.id
    ).length
  }));

  chartData.sort((a, b) => b.total - a.total);

  const labels = chartData.map(p => p.name);
  const dataValues = chartData.map(p => p.total);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Asistencias Totales",
        data: dataValues
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

init();
