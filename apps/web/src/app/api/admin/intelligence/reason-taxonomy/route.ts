import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const authHeaders = getAuthHeaders(request);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'last-30-days';
    const response = await fetch(`${VOICE_CORE_URL}/api/admin/intelligence/reason-taxonomy?period=${period}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Failed to fetch reason taxonomy:', error);
    return NextResponse.json({ error: 'Failed to fetch reasons' }, { status: 500 });
  }
}
