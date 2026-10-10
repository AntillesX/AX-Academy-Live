import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ endpoints: ['/api/passkey/register-options', '/api/passkey/register-verify', '/api/passkey/auth-options', '/api/passkey/auth-verify'] });
}
