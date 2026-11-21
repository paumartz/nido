// Netlify corre esto en cada deploy: escribe la config pública (sin secretos) que usa la app.
import { writeFileSync } from "node:fs";
const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
};
writeFileSync("web/config.js", "window.NIDO_CONFIG = " + JSON.stringify(cfg) + ";\n");
console.log("config.js listo", cfg.supabaseUrl ? "(conectado)" : "(modo demo)");
