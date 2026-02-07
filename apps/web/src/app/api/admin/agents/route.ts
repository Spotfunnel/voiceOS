import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '../../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    console.log(`[Admin Agents API] Fetching from: ${VOICE_CORE_URL}/api/admin/agents`);
    
    // Fetch agents with user status from FastAPI backend
    const authHeaders = getAuthHeaders(request);
    const response = await fetch(`${VOICE_CORE_URL}/api/admin/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      // Add cache control for real-time data
      cache: 'no-store',
    });

    console.log(`[Admin Agents API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Admin Agents API] Error response: ${errorText}`);
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Admin Agents API] Successfully fetched ${data.length} agents`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Agents API] Error:', error.message);
    console.error('[Admin Agents API] Full error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', agents: [] },
      { status: 500 }
    );
  }
}
