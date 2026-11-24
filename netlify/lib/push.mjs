import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Las claves nuevas de Supabase (sb_secret_…) van solo en el header "apikey".
// Si además viajan como "Authorization: Bearer", Supabase rechaza el pedido.
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const keyFetch = (url, opts = {}) => {
  const h = new Headers(opts.headers || {});
  if (KEY.startsWith("sb_") && h.get("authorization") === `Bearer ${KEY}`) h.delete("authorization");
  return fetch(url, { ...opts, headers: h });
};
export const admin = () => createClient(process.env.SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: keyFetch } });

let ready = false;
export function initPush() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:nido@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  ready = true;
}

// Manda una notificación a todos los dispositivos de esas personas (claves "pau" / "fede") en ese nido.
export async function pushTo(sb, household, keys, payload) {
  if (!keys?.length) return 0;
  const { data: subs } = await sb.from("push_subs").select("endpoint,sub").eq("household_id", household).in("profile_key", keys);
  let n = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 3600 }); n++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint); }
  }
  return n;
}
