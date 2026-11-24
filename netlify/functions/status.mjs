// Diagnóstico de la configuración: /api/status (no muestra ninguna clave)
import { admin } from "../lib/push.mjs";

export const config = { path: "/api/status" };

function keyRole(k) {
  if (!k) return "falta";
  if (k.startsWith("sb_secret_")) return "secret (nueva)";
  if (k.startsWith("sb_publishable_")) return "publishable (incorrecta: es la pública)";
  try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role || "desconocido"; } catch { return "no es una clave válida"; }
}

export default async () => {
  const out = {
    SUPABASE_URL: process.env.SUPABASE_URL ? "ok" : "falta",
    SUPABASE_SERVICE_ROLE_KEY: keyRole(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_ANON_KEY: keyRole(process.env.SUPABASE_ANON_KEY),
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ? "ok" : "falta",
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? "ok" : "falta",
  };
  try {
    const sb = admin();
    const { count: hh, error } = await sb.from("households").select("id", { count: "exact", head: true });
    const { count: qt } = await sb.from("docs").select("id", { count: "exact", head: true }).eq("col", "quicktokens");
    out.base_de_datos = error ? `error: ${error.message}` : `ok · nidos: ${hh} · claves de carga rápida: ${qt}`;
  } catch (e) { out.base_de_datos = "error: " + e.message; }
  const ok = out.SUPABASE_SERVICE_ROLE_KEY === "service_role" || out.SUPABASE_SERVICE_ROLE_KEY.startsWith("secret");
  out.resumen = ok && out.base_de_datos.startsWith("ok · nidos: 1") ? "Todo bien" : "Hay algo para corregir (mirá arriba)";
  return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
};
