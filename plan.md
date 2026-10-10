# AntillesX implementation plan

## Product direction

AntillesX is positioned as a Caribbean-native learning and rewards network for island communities and the diaspora. The interface uses a **raw editorial / digital-island** aesthetic: oversized black typography, fog-white canvas, acid-lime signal color, rounded media frame, and direct microcopy.

- **Design movement:** contemporary editorial brutalism softened by premium product UI.
- **Core principles:** high contrast, regional confidence, motion as proof of life, utility before decoration.
- **Layout:** asymmetric editorial split between a dense copy column and a tall media stage rather than a centered marketing grid.
- **Signature elements:** compressed ANTILLESX wordmark, acid-lime signal color, rounded black video stage.
- **Interaction:** concise controls, passkey-first sign-in, visible status feedback, no password forms.
- **Animation:** landing video autoplays muted and loops; other motion should remain subtle and respect reduced-motion preferences.
- **Typography:** heavy system sans for headlines and compact uppercase labels for navigation and metadata.
- **Brand essence:** practical digital momentum for the islands — confident, useful, connected.
- **Voice:** direct and optimistic. Examples: “Build your next chapter.” and “Your island. Your signal.”
- **Wordmark:** tight tracking, X highlighted in the ownable signal color.

## Implementation

The App Router keeps public landing UI in `app/page.tsx`, isolates privileged backend access in server-only helpers, and uses Supabase service role only inside server code. Postgres RLS remains enabled for every requested table. A fourth challenge table supports one-time WebAuthn challenges without putting challenge state in a client-readable cookie. The media manager writes to Supabase Storage and stores only the current public URL in `media_assets`.

## Project structure

See `README.md` for the complete tree. The SQL migration is the source of truth for tables, enum constraints, profile role override, RLS, and Storage bucket policies.
