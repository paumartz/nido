// La app llama acá para avisarle al otro (por ejemplo, cuando le mandás las gracias).
import { admin, initPush, pushTo } from "../lib/push.mjs";

export const config = { path: "/api/notify" };

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const sb = admin();
  const { data: { user } = {}, error } = await sb.auth.getUser(token);
  if (error || !user) return new Response("unauthorized", { status: 401 });
  const { household, to, body } = await req.json().catch(() => ({}));
  const { data: mem } = await sb.from("members").select("household_id").eq("household_id", household).eq("user_id", user.id).maybeSingle();
  if (!mem) return new Response("forbidden", { status: 403 });
  const keys = (Array.isArray(to) ? to : []).filter(k => /^[a-z]{1,20}$/.test(k)).slice(0, 4);
  initPush();
  const sent = await pushTo(sb, household, keys, { title: "Nido", body: String(body || "").slice(0, 180), tag: "nido-" + Date.now() });
  return Response.json({ sent });
};
