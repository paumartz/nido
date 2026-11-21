// Corre cada 5 minutos y manda los avisos que tocan en la hora local del nido.
import { admin, initPush, pushTo } from "../lib/push.mjs";

export const config = { schedule: "*/5 * * * *" };
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function localParts(tz, date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { dow: DOW[p.weekday], ymd: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}

export function isDue(rem, L) {
  if (!rem?.active || !/^\d{2}:\d{2}$/.test(rem.time || "")) return false;
  if (!(rem.days || []).includes(L.dow)) return false;
  const [h, m] = rem.time.split(":").map(Number), t = h * 60 + m;
  return t <= L.min && t > L.min - 6; // ventana de 6 min: el cron corre cada 5
}

const addD = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const between = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

// Avisos de los animales para un nido: cuidados que tocan hoy o mañana e insumos con 3 o 1 días.
export function petAlerts(rows, today) {
  const out = [];
  for (const r of rows) {
    const d = r.data || {};
    if (r.col === "petcare") {
      const next = d.next || (d.last ? addD(d.last, d.every || 30) : null);
      if (!next) continue;
      const n = between(today, next);
      if (n === 0) out.push(`Hoy le toca a ${d.petName || "una mascota"}: ${d.label}`);
      if (n === 1) out.push(`Mañana le toca a ${d.petName || "una mascota"}: ${d.label}`);
    }
    if (r.col === "petsupply" && d.openedAt) {
      const left = (d.lasts || 30) - between(d.openedAt, today);
      if (left === 3 || left === 1) out.push(`${d.name}: quedan ~${left} ${left === 1 ? "día" : "días"}${d.autoList === false ? "" : " (ya está en el súper)"}`);
    }
  }
  return out;
}

export default async () => {
  initPush();
  const sb = admin();
  const { data: rows, error } = await sb.from("docs").select("household_id,col,id,data").in("col", ["reminders", "home", "petcare", "petsupply"]);
  if (error) return new Response("db error", { status: 500 });
  const tzOf = {};
  rows.filter(r => r.col === "home" && r.id === "main").forEach(r => { tzOf[r.household_id] = r.data?.tz; });
  const now = new Date();
  let sent = 0;
  for (const r of rows.filter(r => r.col === "reminders")) {
    const tz = tzOf[r.household_id] || "America/Argentina/Buenos_Aires";
    const L = localParts(tz, now);
    if (!isDue(r.data, L)) continue;
    const { error: dup } = await sb.from("push_log").insert({ key: `${r.household_id}|${r.id}|${L.ymd}|${r.data.time}` });
    if (dup) continue; // ya se mandó
    sent += await pushTo(sb, r.household_id, r.data.who || [], { title: "Nido", body: r.data.text, tag: r.id });
  }
  // Una vez por día, a las 10 de la mañana del nido, el resumen de los animales
  const byHH = {};
  rows.filter(r => r.col === "petcare" || r.col === "petsupply").forEach(r => { (byHH[r.household_id] ||= []).push(r); });
  for (const [hh, list] of Object.entries(byHH)) {
    const L = localParts(tzOf[hh] || "America/Argentina/Buenos_Aires", now);
    if (!isDue({ active: true, time: "10:00", days: [0, 1, 2, 3, 4, 5, 6] }, L)) continue;
    const msgs = petAlerts(list, L.ymd);
    if (!msgs.length) continue;
    const { error: dup } = await sb.from("push_log").insert({ key: `${hh}|pets|${L.ymd}` });
    if (dup) continue;
    sent += await pushTo(sb, hh, ["pau", "fede"], { title: "Nido · los animales", body: msgs.slice(0, 3).join(" · "), tag: "pets" });
  }
  return new Response(`ok ${sent}`);
};
