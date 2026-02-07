import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const authHeaders = getAuthHeaders(request);
  const response = await fetch(`${VOICE_CORE_URL}/api/onboarding/validate-knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
