const supabaseUrl = "TU_URL";
const supabaseKey = "TU_ANON_KEY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let people = [];
let meetings = [];
let todayMeetingId = null;

async function init() {
  await loadPeople();
  await ensureTodayMeeting();
  await loadRanking();
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

document.getElementById("saveBtn").addEventListener("click", async () => {
  const checked = document.querySelectorAll("input[type='checkbox']:checked");

  for (let box of checked) {
    await supabase.from("attendance").upsert({
      person_id: box.value,
      meeting_id: todayMeetingId
    });
  }

  alert("Asistencia guardada");
  loadRanking();
});

async function loadRanking() {
  const { data: allMeetings } = await supabase
    .from("meetings")
    .select("*")
    .order("date", { ascending: false });

  const { data: allAttendance } = await supabase
    .from("attendance")
    .select("*");

  meetings = allMeetings;

  const rankingDiv = document.getElementById("ranking");
  rankingDiv.innerHTML = "";

  people.forEach(p => {
    const personAttendance = allAttendance.filter(a => a.person_id === p.id);
    const total = personAttendance.length;

    const streak = calculateStreak(p.id, allMeetings, allAttendance);
    const cold = calculateCold(p.id, allMeetings, allAttendance);
    const perfect = total === allMeetings.length && total > 0;

    let badges = "";

    if (streak >= 3) badges += "🔥";
    if (cold >= 2) badges += "🧊";
    if (perfect) badges += "👑";

    rankingDiv.innerHTML += `
      <div class="person">
        ${p.name} - ${total} ${badges}
      </div>
    `;
  });
}

function calculateStreak(personId, meetings, attendance) {
  let streak = 0;

  for (let m of meetings) {
    const attended = attendance.find(
      a => a.person_id === personId && a.meeting_id === m.id
    );

    if (attended) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateCold(personId, meetings, attendance) {
  let cold = 0;

  for (let m of meetings) {
    const attended = attendance.find(
      a => a.person_id === personId && a.meeting_id === m.id
    );

    if (!attended) {
      cold++;
    } else {
      break;
    }
  }

  return cold;
}

init();
