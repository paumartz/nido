# Nido

App del hogar de Pau y Fede: tareas con estrellitas, semana compartida, súper, hábitos de a dos, avisos con notificaciones y álbum de estampitas.

- **Web / app instalable:** `web/` (se publica en Netlify)
- **Servidor:** `netlify/functions/` (avisos programados, notificación de gracias y calendario para Google Calendar)
- **Base de datos y login:** Supabase (`supabase/schema.sql`)

Sin configurar, la app abre en **modo demo** con datos de ejemplo.

## Puesta en marcha (una sola vez, ~15 minutos)

### 1. Supabase (base de datos y login)
1. Creá una cuenta en https://supabase.com y un proyecto nuevo (región: São Paulo).
2. **SQL Editor › New query**: pegá todo `supabase/schema.sql` y tocá **Run**.
3. **Authentication › Sign In / Providers › Email**: dejalo activado. Si querés evitar el mail de confirmación, apagá **Confirm email**.
4. **Project Settings › API**: vas a necesitar el **Project URL**, la **anon public key** y la **service_role key** (esta última es secreta: va solo en Netlify).

### 2. Netlify (la app y el servidor)
1. Creá una cuenta en https://netlify.com con tu GitHub.
2. **Add new site › Import an existing project › GitHub** y elegí este repositorio. La configuración de build ya está en `netlify.toml`.
3. En **Site configuration › Environment variables** cargá:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secreta) |
| `VAPID_PUBLIC_KEY` | de `.secrets/vapid.txt` |
| `VAPID_PRIVATE_KEY` | de `.secrets/vapid.txt` (secreta) |
| `VAPID_SUBJECT` | `mailto:` + tu mail |

4. **Deploys › Trigger deploy**. Anotá la dirección del sitio (por ejemplo `https://nido-xyz.netlify.app`).

### 3. Conectar las dos cosas
En Supabase › **Authentication › URL Configuration**: poné la dirección de Netlify en **Site URL** y agregala también en **Redirect URLs** como `https://TU-SITIO.netlify.app/**`.

### 4. Primer uso
1. **Pau** abre el sitio, toca **Crear cuenta**, entra y toca **Crear nuestro nido**. Elige su perfil.
2. En Supabase › SQL Editor, corré `supabase/migrate.sql` (trae lo que ya cargaron en la versión de claude.ai) y recargá la app.
3. En **Nosotros › Invitar a Fede**, copiá el link y mandáselo. Fede crea su cuenta desde ese link y elige su perfil.
4. **En cada celu:** abrí el sitio, **Compartir › Agregar a pantalla de inicio** (iPhone) o **Instalar app** (Android), abrila desde el ícono y en **Avisos** tocá **Activar en este dispositivo**.
5. **Google Calendar:** en **Semana › Google Calendar** copiá el link y agregalo en Google Calendar › Agregar calendario › Desde URL.

## Notas
- Los avisos se revisan cada 5 minutos, así que pueden llegar hasta 5 minutos tarde.
- Google Calendar actualiza los calendarios suscriptos cada algunas horas.
- Supabase pausa los proyectos gratis que no se usan durante una semana. Con uso diario no pasa; si pasa, se reactiva desde su panel.
