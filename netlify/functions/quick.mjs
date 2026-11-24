// Carga rápida desde Atajos (iPhone) u otras apps: /api/quick?k=CLAVE&tipo=super|tarea|hice&texto=...
import { admin } from "../lib/push.mjs";

export const config = { path: "/api/quick" };

const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ckey = s => norm(s).replace(/\b(el|la|los|las|un|una|unos|unas|de|del|a|al|y)\b/g, " ").split(/[^a-z0-9]+/).filter(Boolean).map(w => w.length > 3 ? w.replace(/s$/, "") : w).join("-") || "x";
const splitList = t => String(t || "").split(/\r?\n|,|;| y /).map(x => x.replace(/^[\s•\-*·–]+|^\d+[.)]\s*/g, "").trim()).filter(Boolean).slice(0, 30);
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function localNow(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, stamp: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` };
}

const reply = (text, status = 200) => new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export default async (req) => {
  const url = new URL(req.url);
  let body = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const token = String(body.k || url.searchParams.get("k") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")).trim();
  const tipo = String(body.tipo || url.searchParams.get("tipo") || "super").toLowerCase();
  const texto = String(body.texto ?? url.searchParams.get("texto") ?? "").trim().slice(0, 500);
  if (!/^[a-f0-9]{32,64}$/.test(token)) return reply("Falta la clave de carga rápida.", 401);
  if (!texto) return reply("No escribiste nada.", 400);

  const sb = admin();
  const { data: tk, error: tkErr } = await sb.from("docs").select("household_id,data").eq("col", "quicktokens").eq("id", token).maybeSingle();
  if (tkErr) return reply("El servidor no pudo leer la base: " + tkErr.message, 500);
  if (!tk) return reply("Esa clave no existe o fue anulada. Generá una nueva en Nido › La casa. (Si recién la creaste, abrí /api/status para revisar la configuración.)", 401);
  const hh = tk.household_id, who = tk.data?.profile || "pau";
  const { data: rows } = await sb.from("docs").select("col,id,data").eq("household_id", hh).in("col", ["home", "shopping", "catalog"]);
  const tz = rows?.find(r => r.col === "home" && r.id === "main")?.data?.tz || "America/Argentina/Buenos_Aires";
  const now = localNow(tz), t = Date.now();
  const save = (col, id, data) => sb.from("docs").upsert({ household_id: hh, col, id, data: { ...data, _t: t }, updated_at: new Date().toISOString() });

  if (tipo === "super") {
    const shop = rows.filter(r => r.col === "shopping");
    const added = [], skipped = [];
    for (const name of splitList(texto).map(cap)) {
      const prev = shop.find(r => norm(r.data?.name) === norm(name));
      if (prev && !prev.data.archived) { skipped.push(name); continue; }
      if (prev) await save("shopping", prev.id, { ...prev.data, archived: false, got: false, boughtBy: null, addedBy: who, createdAt: now.stamp });
      else await save("shopping", rid(), { name, addedBy: who, got: false, archived: false, createdAt: now.stamp, times: 0 });
      added.push(name);
    }
    return reply(added.length ? `🛒 Anotado: ${added.join(", ")}${skipped.length ? ` (ya estaba: ${skipped.join(", ")})` : ""}` : `Ya estaba todo en la lista: ${skipped.join(", ")}`);
  }

  const title = cap(texto.slice(0, 80));
  const cat = rows.find(r => r.col === "catalog" && r.id === ckey(title))?.data || {};
  const base = { title: cat.title || title, kind: cat.kind || "hogar", points: cat.points || (tipo === "hice" ? 1 : 2), repeat: "none", time: null, createdAt: now.stamp, createdBy: who, ...(cat.cal ? { cal: true } : {}) };
  if (tipo === "tarea") {
    await save("tasks", rid(), { ...base, assignees: [who], day: null, status: "todo" });
    return reply(`📋 “${base.title}” quedó en la cola`);
  }
  if (tipo === "hice") {
    await save("tasks", rid(), { ...base, assignees: [who], day: now.day, status: "done", doneBy: [who], doneAt: now.stamp, spontaneous: true });
    return reply(`⭐ +${base.points} por “${base.title}”`);
  }
  return reply("Tipo desconocido. Usá super, tarea o hice.", 400);
};
