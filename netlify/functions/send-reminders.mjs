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

export default async () => {
  initPush();
  const sb = admin();
  const { data: rows, error } = await sb.from("docs").select("household_id,col,id,data").in("col", ["reminders", "home"]);
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
  return new Response(`ok ${sent}`);
};
