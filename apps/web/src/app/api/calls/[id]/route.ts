import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/server/session';
import { getAuthHeaders } from '../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getServerSession();
    
    if (!session.tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const callId = params.id;

    // Forward request to FastAPI backend
    const authHeaders = getAuthHeaders(request);
    const response = await fetch(`${VOICE_CORE_URL}/api/calls/${callId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        ...body,
        tenant_id: session.tenantId,
      }),
    });

    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating call:', error);
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    );
  }
}
