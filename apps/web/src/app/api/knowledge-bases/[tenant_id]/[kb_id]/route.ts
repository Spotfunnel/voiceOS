import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: { tenant_id: string; kb_id: string } }
) {
  try {
    const body = await request.json();

    const authHeaders = getAuthHeaders(request);
    const response = await fetch(
      `${VOICE_CORE_URL}/api/knowledge-bases/${params.tenant_id}/${params.kb_id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to update knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge base' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenant_id: string; kb_id: string } }
) {
  try {
    const authHeaders = getAuthHeaders(request);
    const response = await fetch(
      `${VOICE_CORE_URL}/api/knowledge-bases/${params.tenant_id}/${params.kb_id}`,
      {
        method: 'DELETE',
        headers: { ...authHeaders },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to delete knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge base' },
      { status: 500 }
    );
  }
}
