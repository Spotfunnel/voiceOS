import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenant_id: string } }
) {
  try {
    const authHeaders = getAuthHeaders(request);
    const response = await fetch(
      `${VOICE_CORE_URL}/api/admin/resend-invitation/${params.tenant_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { detail: 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
