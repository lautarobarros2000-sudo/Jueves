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

/* =========================
   CARGA DE DATOS
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

    todayMeetingId = newMeeting?.[0]?.id;
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

/* =========================
   GUARDAR ASISTENCIA
========================= */

document.getElementById("saveBtn").addEventListener("click", async () => {
  const checked = document.querySelectorAll("input[type='checkbox']:checked");

  // primero borramos registros previos de hoy
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

  alert("Asistencia guardada 🔥");

  await loadAllData();
  renderAll();
});

/* =========================
   RANKING
========================= */

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

/* =========================
   🔥 RACHAS
========================= */

function renderStreaks() {
  const div = document.getElementById("streaks");
  div.innerHTML = "";

  if (meetings.length === 0) {
    div.innerHTML = "Sin datos aún";
    return;
  }

  // ignorar la juntada de hoy si todavía no tiene asistentes
  const validMeetings = meetings.filter(m => {
    const attendeesCount = attendance.filter(a => a.meeting_id === m.id).length;
    return attendeesCount > 0;
  });

  people.forEach(person => {
    let streak = 0;
    let lastType = null;

    for (let i = validMeetings.length - 1; i >= 0; i--) {
      const meeting = validMeetings[i];

      const wasPresent = attendance.some(
        a => a.person_id === person.id && a.meeting_id === meeting.id
      );

      if (i === validMeetings.length - 1) {
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

/* =========================
   HISTORIAL CON VER/EDITAR/ELIMINAR
========================= */

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

    const card = document.createElement("div");
    card.className = "meeting-card";

    const header = document.createElement("div");
    header.className = "meeting-header";

    const title = document.createElement("strong");
    title.textContent = `Juntada #${meetingNumber} - ${meeting.date}`;

    const actions = document.createElement("div");

    const btnView = document.createElement("button");
    btnView.textContent = "Ver";

    const btnEdit.addEventListener("click", async () => {
  // Obtener asistentes actuales
  const currentAttendees = attendance
    .filter(a => a.meeting_id === meeting.id)
    .map(a => Number(a.person_id));

  // Crear contenido del modal simple
  let checklistHTML = people.map(p => {
    const checked = currentAttendees.includes(p.id) ? "checked" : "";
    return `
      <label style="display:block;margin-bottom:5px;">
        <input type="checkbox" value="${p.id}" ${checked} />
        ${p.name}
      </label>
    `;
  }).join("");

  const container = document.createElement("div");
  container.innerHTML = `
    <div style="background:#1e293b;padding:20px;border-radius:10px;max-height:400px;overflow:auto;">
      <h3>Editar asistentes</h3>
      ${checklistHTML}
      <button id="saveEditBtn" style="margin-top:15px;">Guardar Cambios</button>
    </div>
  `;

  // Crear overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.7)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.appendChild(container);

  document.body.appendChild(overlay);

  document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const checkedBoxes = container.querySelectorAll("input[type='checkbox']:checked");

    // 1️⃣ borrar asistencias actuales
    await supabaseClient
      .from("attendance")
      .delete()
      .eq("meeting_id", meeting.id);

    // 2️⃣ insertar nuevas
    for (let box of checkedBoxes) {
      await supabaseClient.from("attendance").insert({
        meeting_id: meeting.id,
        person_id: box.value
      });
    }

    document.body.removeChild(overlay);

    await loadAllData();
    renderAll();
  });

  // cerrar si clickean afuera
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
});

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "Eliminar";

    const details = document.createElement("div");
    details.style.display = "none";
    details.textContent = attendees.join(", ") || "Sin asistentes";

    btnView.onclick = () => {
      details.style.display =
        details.style.display === "none" ? "block" : "none";
    };

    btnEdit.onclick = async () => {
      const newDate = prompt("Nueva fecha (YYYY-MM-DD):", meeting.date);
      if (!newDate) return;

      await supabaseClient
        .from("meetings")
        .update({ date: newDate })
        .eq("id", meeting.id);

      await loadAllData();
      renderAll();
    };

    btnDelete.onclick = async () => {
      if (!confirm("¿Eliminar esta juntada?")) return;

      await supabaseClient.from("attendance").delete().eq("meeting_id", meeting.id);
      await supabaseClient.from("meetings").delete().eq("id", meeting.id);

      await loadAllData();
      renderAll();
    };

    actions.appendChild(btnView);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    header.appendChild(title);
    header.appendChild(actions);

    card.appendChild(header);
    card.appendChild(details);

    div.appendChild(card);
  });
}

init();
