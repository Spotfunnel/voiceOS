import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenant_id: string } }
) {
  const authHeaders = getAuthHeaders(request);
  const response = await fetch(
    `${VOICE_CORE_URL}/api/tenants/${params.tenant_id}/onboarding-settings`,
    {
      headers: {
        ...authHeaders,
      },
    }
  );
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenant_id: string } }
) {
  const body = await request.json();
  const authHeaders = getAuthHeaders(request);
  const response = await fetch(
    `${VOICE_CORE_URL}/api/tenants/${params.tenant_id}/onboarding-settings`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
