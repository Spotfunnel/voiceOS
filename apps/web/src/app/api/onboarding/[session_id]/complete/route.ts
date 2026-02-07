import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const authHeaders = getAuthHeaders(request);
  const response = await fetch(
    `${VOICE_CORE_URL}/api/onboarding/${params.session_id}/complete`,
    { method: 'POST', headers: { ...authHeaders } }
  );
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
