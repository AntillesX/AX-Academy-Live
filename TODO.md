# AntillesX delivery outcomes

- [x] Next.js 14+ App Router project uses Tailwind CSS and TypeScript.
- [x] Supabase SQL migration creates `profiles`, `passkeys`, and `media_assets` with the requested fields, role/balance constraints, admin email override, RLS, and `platform-media` Storage policies.
- [x] Passkey API handlers exist at `/api/passkey/register-options`, `/api/passkey/register-verify`, `/api/passkey/auth-options`, and `/api/passkey/auth-verify` using required user verification and replay counters.
- [x] Successful biometric verification creates a signed seven-day HTTP-only session cookie.
- [x] Admin-restricted MP4 media upload validates file type/size, uploads/replaces the intro asset in Supabase Storage, and records the URL in `media_assets`.
- [x] The landing page dynamically reads and plays the newest `intro_video` URL.
- [x] README documents environment setup, bootstrap enrollment, project structure, and test verification commands.
