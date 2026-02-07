import { NextRequest, NextResponse } from 'next/server';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${VOICE_CORE_URL}/api/auth/accept-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { detail: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
