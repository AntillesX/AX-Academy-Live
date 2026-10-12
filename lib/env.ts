import { z } from 'zod';

// Build-safe placeholders let static Next.js collection complete without secrets.
// Deployments must provide the real values through environment variables.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_WEBAUTHN_RP_ID: z.string().default('localhost'),
  NEXT_PUBLIC_WEBAUTHN_ORIGIN: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32),
  PASSKEY_ENROLLMENT_SECRET: z.string().min(16).optional(),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-placeholder-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-service-key',
  NEXT_PUBLIC_WEBAUTHN_RP_ID: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID,
  NEXT_PUBLIC_WEBAUTHN_ORIGIN: process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN,
  SESSION_SECRET: process.env.SESSION_SECRET || 'build-only-session-secret-change-in-production',
  PASSKEY_ENROLLMENT_SECRET: process.env.PASSKEY_ENROLLMENT_SECRET,
});
