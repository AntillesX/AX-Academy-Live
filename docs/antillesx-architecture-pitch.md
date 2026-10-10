# AntillesX Architecture & Supabase RLS — Stakeholder Presentation Script

## Slide 1 — AntillesX: a trusted platform for island-scale momentum

**On screen:** AntillesX wordmark, learning, games, world, rewards, and community loop.

**Speaker:** “AntillesX is designed as one connected platform rather than a collection of disconnected features. Learners can move from courses to games, practice markets in a safe simulator, explore the islands, and use earned XP and ANTX in the store. The architecture keeps that experience fast at the edge while keeping identity, balances, credentials, and media governed by Supabase.”

## Slide 2 — The architecture at a glance

**On screen:** Browser → Next.js App Router → server utilities → Supabase Auth/Postgres/Storage.

**Speaker:** “The browser talks to a Next.js 14 App Router application. Public pages are responsive server-rendered shells with client components only where interaction is needed. Server-only utilities handle Supabase service-role operations, session signing, passkey verification, and media upload. Supabase provides the durable system of record: Auth for identities, Postgres for profiles and balances, and Storage for platform media.”

## Slide 3 — Passwordless identity with hardware-backed passkeys

**On screen:** Register options → Touch ID/Face ID → verify → HTTP-only session.

**Speaker:** “Authentication is passkey-first. The server issues a short-lived challenge, the user completes Touch ID or Face ID, and the server verifies the origin, relying-party ID, user verification, and credential counter. We never store a password. After verification, AntillesX issues a signed, HTTP-only session cookie. The browser receives a session, not a reusable credential.”

## Slide 4 — Why Row-Level Security is the security boundary

**On screen:** `profiles`, `passkeys`, `media_assets`, `passkey_challenges` with lock icons.

**Speaker:** “RLS is enabled on every core table. The policy model is deny-by-default unless a user’s authenticated identity satisfies an explicit rule. A profile is readable and editable only by its owner. Passkeys are managed only by the owning user. Media is public to read but writable only by an admin. Challenge rows are intentionally server-only and accessed through the service-role client.”

## Slide 5 — Admin role enforcement and media governance

**On screen:** `AntillesAcademy@protonmail.com` → admin; all other users → student.

**Speaker:** “The admin override is enforced in the database trigger, not only in the UI. The reserved academy email is promoted to admin on profile creation or update. The admin media workflow validates MP4 type and file size, uploads to the `platform-media` bucket, replaces the active intro-video record, and exposes the latest URL to the landing page. This gives stakeholders a visible control point without weakening the database boundary.”

## Slide 6 — The user experience is a connected shell

**On screen:** fixed Navbar with Home, Games, Simulators, Courses, World, Store, Community, ANTX, XP, and audio controls.

**Speaker:** “Phase 2 introduces a universal shell so every hub feels like the same product. The fixed header keeps navigation, balances, and background audio one click away. The audio player starts muted to respect browser autoplay rules, then un-mutes only after interaction. The hub shells are responsive and ready for deeper game, course, WebGL, and commerce modules.”

## Slide 7 — Data flows that stakeholders can trust

**On screen:** three flows: sign-in, balance display, intro media.

**Speaker:** “The balance counters are sourced from the authenticated profile record. Passkey challenges expire and are consumed after use. Credential counters advance after successful authentication to protect against replay. The landing video is dynamically selected from the latest media asset, while the admin write path remains protected by the signed session and server-side role check.”

## Slide 8 — Close: safe to scale, clear to operate

**On screen:** “One platform. Explicit policies. Room to grow.”

**Speaker:** “The key design decision is separation of concerns with a hard security boundary. Next.js owns the experience, WebAuthn owns passwordless identity, and Supabase RLS owns data authorization. That gives AntillesX a foundation stakeholders can review, operators can manage, and product teams can extend without turning every new feature into a new security model.”

## Q&A prompts

- “Which future roles should become first-class beyond student and admin?”
- “Should ANTX and XP remain separate ledgers with separate policy paths?”
- “Which hub should receive the first production-grade interactive module: games, courses, or the island world?”
