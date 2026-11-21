// Calendario para suscribir desde Google Calendar: /cal/<token>.ics
import { admin } from "../lib/push.mjs";

export const config = { path: "/cal/*" };
const pad = n => String(n).padStart(2, "0");
const icsEsc = s => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
const fold = line => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };

export function buildIcs(rows, now = new Date()) {
  const names = { pau: "Pau", fede: "Fede" };
  rows.filter(r => r.col === "profiles").forEach(r => { if (r.data?.name) names[r.id] = r.data.name; });
  const tz = rows.find(r => r.col === "home" && r.id === "main")?.data?.tz || "America/Argentina/Buenos_Aires";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nido//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Nido", "X-WR-TIMEZONE:" + tz, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const r of rows.filter(r => r.col === "tasks")) {
    const t = r.data;
    if (!t?.day || !/^\d{4}-\d{2}-\d{2}$/.test(t.day) || !t.cal) continue;
    const who = (t.assignees || []).map(k => names[k] || k).join(" y ");
    const title = `${t.status === "done" ? "✓ " : ""}${t.title}${who ? " · " + who : ""}`;
    const d = t.day.replace(/-/g, "");
    L.push("BEGIN:VEVENT", `UID:${r.id}@nido`, `DTSTAMP:${stamp}`);
    if (t.time && /^\d{2}:\d{2}$/.test(t.time)) {
      const [h, m] = t.time.split(":").map(Number), end = Math.min(h * 60 + m + 30, 23 * 60 + 59);
      L.push(`DTSTART;TZID=${tz}:${d}T${pad(h)}${pad(m)}00`, `DTEND;TZID=${tz}:${d}T${pad(Math.floor(end / 60))}${pad(end % 60)}00`);
    } else {
      const nd = new Date(Date.UTC(+t.day.slice(0, 4), +t.day.slice(5, 7) - 1, +t.day.slice(8, 10) + 1));
      L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nd.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    L.push(fold("SUMMARY:" + icsEsc(title)), fold("DESCRIPTION:" + icsEsc(`Tarea de Nido · ${"★".repeat(t.points || 1)}`)), "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

export default async (req) => {
  const token = new URL(req.url).pathname.split("/").pop().replace(/\.ics$/, "");
  if (!/^[a-f0-9]{16,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const sb = admin();
  const { data: hh } = await sb.from("households").select("id").eq("cal_token", token).maybeSingle();
  if (!hh) return new Response("Not found", { status: 404 });
  const { data: rows } = await sb.from("docs").select("col,id,data").eq("household_id", hh.id).in("col", ["tasks", "profiles", "home"]);
  return new Response(buildIcs(rows || []), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=900" } });
};
