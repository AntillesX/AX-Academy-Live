# AntillesX

Production-oriented Next.js 14 App Router starter for a Caribbean-first learning and rewards platform.

## Stack

- Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- Supabase Postgres, Storage, and service-role server client
- WebAuthn/passkeys via `@simplewebauthn/server` and `@simplewebauthn/browser`
- Signed, HTTP-only session cookie (`antillesx_session`) after biometric verification

## Project structure

```text
app/
  api/passkey/{register-options,register-verify,auth-options,auth-verify}/route.ts
  api/admin/media/route.ts
  admin/actions.ts                 # server action for MP4 replacement
  admin/page.tsx                    # admin-only media manager
  page.tsx                          # dynamic intro video landing page
components/
  media-manager.tsx
  passkey-login.tsx
lib/
  admin.ts, env.ts, passkey.ts, session.ts, supabase-admin.ts
supabase/migrations/20261010182921_initial_schema.sql
public/manus-routes.json
```

## Local setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_WEBAUTHN_RP_ID=localhost`, `NEXT_PUBLIC_WEBAUTHN_ORIGIN=http://localhost:3000`, and a random `SESSION_SECRET` of 32+ characters.
3. Apply `supabase/migrations/20261010182921_initial_schema.sql` in the Supabase SQL editor or with the Supabase CLI.
4. Set `PASSKEY_ENROLLMENT_SECRET` to a long, one-time bootstrap secret. This is required to enroll the first passkey because no password session exists yet. Remove or rotate it after bootstrap.
5. Run `npm run dev`.

## Passkey flow

- `POST /api/passkey/register-options` — requires the current AntillesX session for that email or the enrollment header `x-passkey-enrollment-secret`; provisions a Supabase Auth user if needed and persists a short-lived challenge.
- `POST /api/passkey/register-verify` — verifies the hardware-backed credential with `userVerification: required` and stores the credential public key/counter/transports.
- `POST /api/passkey/auth-options` — returns options only when the profile has at least one registered credential.
- `POST /api/passkey/auth-verify` — validates the assertion, advances the replay counter, and sets a signed HTTP-only seven-day session cookie. Behind HTTPS the cookie uses `Secure; SameSite=None` for embedded preview compatibility; local HTTP uses `SameSite=Lax`.

Example bootstrap request to obtain registration options:

```bash
curl -X POST http://localhost:3000/api/passkey/register-options \
  -H 'content-type: application/json' \
  -H "x-passkey-enrollment-secret: $PASSKEY_ENROLLMENT_SECRET" \
  -d '{"email":"AntillesAcademy@protonmail.com"}'
```

A browser enrollment page can pass that JSON to `startRegistration()` from `@simplewebauthn/browser`, then POST the returned credential to `/api/passkey/register-verify` with the same header and email. The included landing page implements the authentication half; enrollment is intentionally bootstrap-gated rather than publicly exposed.

## Admin media flow

`POST /api/admin/media` accepts `multipart/form-data` field `file`, validates MP4 and a 100MB limit, uploads to the public `platform-media` bucket, deletes the previous `intro_video` row, and inserts the replacement URL. The home page queries the latest `intro_video` row with `force-dynamic` rendering and plays it immediately.

The server action is `uploadIntroVideo()` in `app/admin/actions.ts`; the route delegates to it so both server-action and HTTP callers share the same admin authorization.

## Verification

```bash
npm run typecheck
npm run build
```

After starting the app:

```bash
curl -i http://localhost:3000/manus-routes.json
curl -i -X POST http://localhost:3000/api/passkey/auth-options \
  -H 'content-type: application/json' \
  -d '{"email":"AntillesAcademy@protonmail.com"}'
# Before enrollment, this should be a controlled 404: No passkey enrolled for this account.

curl -i -X POST http://localhost:3000/api/admin/media
# This should be a controlled 403: Admin access required.
```

For a real-device check, run the app on HTTPS or a trusted HTTPS preview origin: WebAuthn will reject an insecure non-localhost origin by design. Confirm that Touch ID/Face ID enrollment succeeds, the authentication response sets `antillesx_session` with `HttpOnly`, and `/admin` redirects unauthenticated users to `/`.
