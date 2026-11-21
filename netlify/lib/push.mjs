import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
