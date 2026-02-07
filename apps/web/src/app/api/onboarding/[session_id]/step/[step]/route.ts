import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: { session_id: string; step: string } }
) {
  const body = await request.json();
  const authHeaders = getAuthHeaders(request);
  const response = await fetch(
    `${VOICE_CORE_URL}/api/onboarding/${params.session_id}/step/${params.step}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
