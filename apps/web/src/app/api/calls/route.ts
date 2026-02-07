import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from '@/server/session';
import { getAuthHeaders } from '../_utils/auth';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

// Mock data for demo purposes
const MOCK_CALLS = [
  {
    id: '1',
    created_at: new Date().toISOString(),
    tenant_id: 'demo',
    customer_phone: '+1(555) 099-0000',
    caller_name: 'Professor Long Transcript',
    booking_status: 'Callback Required',
    summary: 'Customer inquiring about solar panel installation for their home',
    transcript: 'AI: Good morning! Thank you for calling ABC Plumbing. How can I help you today? User: I have a leaking pipe...',
    intent: 'Support',
    resolution_status: 'Action Required',
    date: new Date().toISOString().split('T')[0],
    called_at: '9:45 AM',
    duration: 180,
  },
  {
    id: '2',
    created_at: new Date().toISOString(),
    tenant_id: 'demo',
    customer_phone: '+1(555) 030-1001',
    caller_name: 'Alice Johnson',
    booking_status: 'Booked',
    summary: 'New lead for residential service',
    transcript: 'AI: Hello, thank you for calling. User: I need to schedule a service call.',
    intent: 'New Lead',
    resolution_status: 'Resolved',
    date: new Date().toISOString().split('T')[0],
    called_at: '9:15 AM',
    duration: 120,
  },
  {
    id: '3',
    created_at: new Date().toISOString(),
    tenant_id: 'demo',
    customer_phone: '+1(555) 030-1002',
    caller_name: 'Bob Smith',
    booking_status: 'Follow Up Required',
    summary: 'Customer complaint about service quality',
    transcript: 'AI: Good afternoon. User: I want to complain about the service I received.',
    intent: 'Complaint',
    resolution_status: 'Action Required',
    date: new Date().toISOString().split('T')[0],
    called_at: '10:30 AM',
    duration: 240,
  },
  {
    id: '4',
    created_at: new Date().toISOString(),
    tenant_id: 'demo',
    customer_phone: '+1(555) 030-1003',
    caller_name: 'Charlie Davis',
    booking_status: 'Booked',
    summary: 'Support inquiry resolved',
    transcript: 'AI: Thank you for calling. User: I have a question about my account.',
    intent: 'Support',
    resolution_status: 'Resolved',
    date: new Date().toISOString().split('T')[0],
    called_at: '11:00 AM',
    duration: 90,
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = getServerSession();
    const cookieStore = cookies();
    const mockEnabled = cookieStore.get('sf_mock_data')?.value === '1';
    
    if (!session.tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    if (mockEnabled) {
      return NextResponse.json({ calls: MOCK_CALLS });
    }

    // Try to fetch from FastAPI backend
    try {
      const authHeaders = getAuthHeaders(request);
      const response = await fetch(`${VOICE_CORE_URL}/api/dashboard/calls?tenant_id=${session.tenantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const calls = (data.calls || []).map((call: any) => ({
          id: call.id,
          created_at: call.start_time || call.created_at,
          tenant_id: call.tenant_id,
          customer_phone: call.caller_phone,
          caller_name: call.captured_data?.name || null,
          booking_status: call.outcome,
          summary: call.summary || call.captured_data?.summary || '',
          transcript: call.transcript || '',
          intent: call.reason_for_calling || call.captured_data?.reason_for_calling || '',
          resolution_status: call.outcome,
          date: call.start_time ? new Date(call.start_time).toISOString().split('T')[0] : '',
          called_at: call.start_time ? new Date(call.start_time).toLocaleTimeString() : '',
          duration: call.duration_seconds || 0,
        }));
        return NextResponse.json({ calls, metrics: data.metrics });
      }
    } catch (backendError) {
      console.log('FastAPI backend not available, using mock data');
    }

    // Fallback to mock data if backend is not available
    return NextResponse.json({ calls: MOCK_CALLS });
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { calls: MOCK_CALLS },
      { status: 200 }
    );
  }
}
