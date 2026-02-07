import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const authHeaders = getAuthHeaders(request);
    const response = await fetch(`${VOICE_CORE_URL}/api/admin/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error inviting user:', error);
    return NextResponse.json(
      { detail: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
