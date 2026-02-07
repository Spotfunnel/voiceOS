import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenant_id: string } }
) {
  try {
    const authHeaders = getAuthHeaders(request);
    const response = await fetch(
      `${VOICE_CORE_URL}/api/knowledge-bases/${params.tenant_id}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch knowledge bases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge bases' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tenant_id: string } }
) {
  try {
    const body = await request.json();

    const authHeaders = getAuthHeaders(request);
    const response = await fetch(
      `${VOICE_CORE_URL}/api/knowledge-bases/${params.tenant_id}`,
      {
        method: 'POST',
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
    console.error('Failed to create knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base' },
      { status: 500 }
    );
  }
}
