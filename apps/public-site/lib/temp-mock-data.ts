import { Call } from '@/contexts/DataContext';

export const MOCK_CALLS: Call[] = [
    {
        id: 'stress-test-1',
        created_at: new Date().toISOString(),
        customer_phone: '+1 (555) 999-0000',
        call_id: 'stress-call-1',
        caller_name: 'Professor Long Transcript',
        intent: 'Support',
        booking_status: 'Callback Required',
        status: 'completed',
        summary: 'A very rigorous stress test of the transcript container with multiple turns and long-winded explanations about quantum solar thermodynamics.',
        transcript: 'AI: Hello, how can I assist you with your advanced solar array today?\nUser: I am having a very specific issue where the photovoltaic efficiency drops by 0.005% every time a cloud with exactly 45% opacity passes over my sector 7G. Can you explain the thermal dynamics involved in the heat dissipation of the silicon substrate during these specific atmospheric conditions?\nAI: That is an excellent and highly specific question. The thermal gradients within the silicon substrate are governed by the Fourier heat conduction equation, which in your case must be solved with time-varying boundary conditions. When a cloud of 45% opacity intervenes, the solar irradiance decreases, causing a rapid shift in the carrier concentration and a subsequent alteration in the non-radiative recombination rates.\nUser: Fascinating. And how does this affect the shunt resistance of the individual cells in the series string?\nAI: The shunt resistance is influenced by the local temperature variations. As the irradiance fluctuates, the localized heating effects known as "hot spots" can become more pronounced if there are any micro-cracks in the crystal structure. This leads to a non-linear voltage drop across the string, which the MPPT algorithm in your inverter must constantly compensate for.\nUser: What about the impact of ambient humidity on the spectral response of the anti-reflective coating?\nAI: Humidity levels can indeed affect the refractive index of certain porous anti-reflective coatings. If moisture is absorbed into the nano-pores, it can increase the reflection losses at the shorter wavelengths, particularly in the blue-violet spectrum. This is often overlooked in standard efficiency calculations but is critical for high-fidelity performance monitoring in your specific climate zone.\nUser: I see. I will monitor the humidity sensors and the MPPT logs more closely then.\nAI: Excellent. I would also recommend checking the bypass diodes in the affected modules, as they might be triggered prematurely during these brief shading events, leading to a stepwise reduction in power output rather than a smooth decline.',
        resolution_status: 'Open',
        verified: 'Verified',
        date: new Date().toLocaleDateString(),
        called_at: '11:45 AM',
        squad_id: 's1',
        customer_address: '123 Quantum Drive, Research Triangle, NC 27709',
        transfer_status: 'Transferred Success'
    },
    {
        id: 'mock-1',
        created_at: new Date().toISOString(),
        customer_phone: '+1 (555) 010-1001',
        call_id: 'mock-call-1',
        caller_name: 'Alice Johnson',
        intent: 'New Lead',
        booking_status: 'Callback Required',
        status: 'completed',
        summary: 'Interested in solar panels for a 4-bedroom house. Needs a quote.',
        transcript: 'User: Hi, I want solar. AI: Sure, tell me more.',
        resolution_status: 'Open',
        verified: 'Verified',
        date: new Date().toLocaleDateString(),
        called_at: '09:15 AM',
        squad_id: 's1'
    },
    {
        id: 'mock-2',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        customer_phone: '+1 (555) 010-1002',
        call_id: 'mock-call-2',
        caller_name: 'Bob Smith',
        intent: 'Complaint',
        booking_status: 'Follow Up Required',
        status: 'completed',
        summary: 'Customer complained about installation delay. Very angry.',
        transcript: 'User: Where is my installer? AI: Checking now.',
        resolution_status: 'Action Required',
        verified: 'Verified',
        date: new Date().toLocaleDateString(),
        called_at: '10:30 AM',
        squad_id: 's1'
    },
    {
        id: 'mock-3',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        customer_phone: '+1 (555) 010-1003',
        call_id: 'mock-call-3',
        caller_name: 'Charlie Davis',
        intent: 'Support',
        booking_status: 'Resolved',
        status: 'completed',
        summary: 'Inverter showing red light. Troubleshooting steps provided.',
        transcript: 'User: Red light on box. AI: Try resetting.',
        resolution_status: 'Closed',
        verified: 'Verified',
        date: new Date().toLocaleDateString(),
        called_at: '08:45 AM',
        squad_id: 's1'
    },
    {
        id: 'mock-4',
        created_at: new Date(Date.now() - 14400000).toISOString(),
        customer_phone: '+1 (555) 010-1004',
        call_id: 'mock-call-4',
        caller_name: 'Diana Evans',
        intent: 'Upgrade Request',
        booking_status: 'Booked',
        status: 'booked',
        summary: 'Wants to add battery storage to existing system.',
        transcript: 'User: Add battery? AI: Yes provided...',
        resolution_status: 'Booked',
        verified: 'Verified',
        date: new Date().toLocaleDateString(),
        called_at: '12:00 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-5',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        customer_phone: '+1 (555) 010-1005',
        call_id: 'mock-call-5',
        caller_name: 'Evan Wright',
        intent: 'Old Quote',
        booking_status: 'Callback Required',
        status: 'completed',
        summary: 'Calling about quote from last year. Price check.',
        transcript: 'User: Price still good? AI: Let me check.',
        resolution_status: 'Pending',
        verified: 'Verified',
        date: new Date(Date.now() - 86400000).toLocaleDateString(),
        called_at: '02:15 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-6',
        created_at: new Date(Date.now() - 90000000).toISOString(),
        customer_phone: '+1 (555) 010-1006',
        call_id: 'mock-call-6',
        caller_name: 'Fiona Green',
        intent: 'Reschedule',
        booking_status: 'Rescheduled',
        status: 'booked',
        summary: 'Needs to move installation date.',
        transcript: 'User: Move date. AI: Ok.',
        resolution_status: 'Closed',
        verified: 'Verified',
        date: new Date(Date.now() - 86400000).toLocaleDateString(),
        called_at: '04:30 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-7',
        created_at: new Date(Date.now() - 100000000).toISOString(),
        customer_phone: '+1 (555) 010-1007',
        call_id: 'mock-call-7',
        caller_name: 'George Hill',
        intent: 'Off Topic',
        booking_status: 'Cancelled',
        status: 'completed',
        summary: 'Wrong number / Sales call.',
        transcript: 'User: Pizza? AI: No solar.',
        resolution_status: 'Closed',
        verified: 'Invalid',
        date: new Date(Date.now() - 86400000).toLocaleDateString(),
        called_at: '05:00 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-8',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        customer_phone: '+1 (555) 010-1008',
        call_id: 'mock-call-8',
        caller_name: 'Hannah Lee',
        intent: 'Commercial Lead',
        booking_status: 'Booked',
        status: 'booked',
        summary: 'Factory roof installation. 100kW system.',
        transcript: 'User: Factory. AI: Big job.',
        resolution_status: 'Open',
        verified: 'Verified',
        date: new Date(Date.now() - 172800000).toLocaleDateString(),
        called_at: '11:00 AM',
        squad_id: 's1'
    },
    {
        id: 'mock-9',
        created_at: new Date(Date.now() - 180000000).toISOString(),
        customer_phone: '+1 (555) 010-1009',
        call_id: 'mock-call-9',
        caller_name: 'Ian Scott',
        intent: 'General Enquiry',
        booking_status: 'Callback Required',
        status: 'completed',
        summary: 'Questions about government rebates.',
        transcript: 'User: Rebates? AI: Yes.',
        resolution_status: 'Action Required',
        verified: 'Verified',
        date: new Date(Date.now() - 172800000).toLocaleDateString(),
        called_at: '01:00 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-10',
        created_at: new Date(Date.now() - 190000000).toISOString(),
        customer_phone: '+1 (555) 010-1010',
        call_id: 'mock-call-10',
        caller_name: 'Jane Doe',
        intent: 'Callback Request',
        booking_status: 'Callback Required',
        status: 'completed',
        summary: 'Requesting call back after 5pm.',
        transcript: 'User: Call me back. AI: Defined.',
        resolution_status: 'Open',
        verified: 'Verified',
        date: new Date(Date.now() - 172800000).toLocaleDateString(),
        called_at: '03:30 PM',
        squad_id: 's1'
    },
    {
        id: 'mock-11', created_at: new Date(Date.now() - 200000000).toISOString(), customer_phone: '+1 (555) 010-1011', call_id: 'mock-call-11', caller_name: 'Kevin Hart', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Interested in 10kW system.', transcript: 'User: 10kW. AI: Yes.', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-15', called_at: '09:00 AM', squad_id: 's1'
    },
    {
        id: 'mock-12', created_at: new Date(Date.now() - 210000000).toISOString(), customer_phone: '+1 (555) 010-1012', call_id: 'mock-call-12', caller_name: 'Laura Croft', intent: 'Support', booking_status: 'Callback Required', status: 'completed', summary: 'App not working.', transcript: 'User: App broken. AI: Reset.', resolution_status: 'Open', verified: 'Verified', date: '2025-05-14', called_at: '10:15 AM', squad_id: 's1'
    },
    {
        id: 'mock-13', created_at: new Date(Date.now() - 220000000).toISOString(), customer_phone: '+1 (555) 010-1013', call_id: 'mock-call-13', caller_name: 'Mike Tyson', intent: 'Complaint', booking_status: 'Resolved', status: 'completed', summary: 'Panel cracked.', transcript: 'User: Cracked. AI: Warranty.', resolution_status: 'Escalated', verified: 'Verified', date: '2025-05-14', called_at: '11:45 AM', squad_id: 's1'
    },
    {
        id: 'mock-14', created_at: new Date(Date.now() - 230000000).toISOString(), customer_phone: '+1 (555) 010-1014', call_id: 'mock-call-14', caller_name: 'Nina Simone', intent: 'General Enquiry', booking_status: 'No Action', status: 'completed', summary: 'Asking about battery life.', transcript: 'User: Battery life? AI: 10 years.', resolution_status: 'Closed', verified: 'Verified', date: '2025-05-13', called_at: '02:00 PM', squad_id: 's1'
    },
    {
        id: 'mock-15', created_at: new Date(Date.now() - 240000000).toISOString(), customer_phone: '+1 (555) 010-1015', call_id: 'mock-call-15', caller_name: 'Oscar Wilde', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Roof quote.', transcript: 'User: Quote. AI: Address?', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-13', called_at: '04:30 PM', squad_id: 's1'
    },
    {
        id: 'mock-16', created_at: new Date(Date.now() - 250000000).toISOString(), customer_phone: '+1 (555) 010-1016', call_id: 'mock-call-16', caller_name: 'Paul Rudd', intent: 'Reschedule', booking_status: 'Rescheduled', status: 'booked', summary: 'Move install to next week.', transcript: 'User: Move it. AI: Done.', resolution_status: 'Closed', verified: 'Verified', date: '2025-05-12', called_at: '08:15 AM', squad_id: 's1'
    },
    {
        id: 'mock-17', created_at: new Date(Date.now() - 260000000).toISOString(), customer_phone: '+1 (555) 010-1017', call_id: 'mock-call-17', caller_name: 'Quincy Jones', intent: 'Off Topic', booking_status: 'Cancelled', status: 'completed', summary: 'Asking for pizza.', transcript: 'User: Pizza. AI: Solar only.', resolution_status: 'Closed', verified: 'Invalid', date: '2025-05-12', called_at: '09:30 AM', squad_id: 's1'
    },
    {
        id: 'mock-18', created_at: new Date(Date.now() - 270000000).toISOString(), customer_phone: '+1 (555) 010-1018', call_id: 'mock-call-18', caller_name: 'Rachel Green', intent: 'Upgrade Request', booking_status: 'Callback Required', status: 'completed', summary: 'More panels.', transcript: 'User: More. AI: Space?', resolution_status: 'Open', verified: 'Verified', date: '2025-05-11', called_at: '11:00 AM', squad_id: 's1'
    },
    {
        id: 'mock-19', created_at: new Date(Date.now() - 280000000).toISOString(), customer_phone: '+1 (555) 010-1019', call_id: 'mock-call-19', caller_name: 'Steve Jobs', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Premium system.', transcript: 'User: Best one. AI: 20kW.', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-11', called_at: '01:30 PM', squad_id: 's1'
    },
    {
        id: 'mock-20', created_at: new Date(Date.now() - 290000000).toISOString(), customer_phone: '+1 (555) 010-1020', call_id: 'mock-call-20', caller_name: 'Tina Fey', intent: 'Complaint', booking_status: 'Follow Up Required', status: 'completed', summary: 'Rude installer.', transcript: 'User: Rude. AI: Sorry.', resolution_status: 'Escalated', verified: 'Verified', date: '2025-05-10', called_at: '03:45 PM', squad_id: 's1'
    },
    {
        id: 'mock-21', created_at: new Date(Date.now() - 300000000).toISOString(), customer_phone: '+1 (555) 010-1021', call_id: 'mock-call-21', caller_name: 'Uma Thurman', intent: 'Support', booking_status: 'Resolved', status: 'completed', summary: 'Login issue.', transcript: 'User: Login. AI: Reset.', resolution_status: 'Closed', verified: 'Verified', date: '2025-05-10', called_at: '05:00 PM', squad_id: 's1'
    },
    {
        id: 'mock-22', created_at: new Date(Date.now() - 310000000).toISOString(), customer_phone: '+1 (555) 010-1022', call_id: 'mock-call-22', caller_name: 'Vin Diesel', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Garage roof.', transcript: 'User: Garage. AI: Size?', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-09', called_at: '08:45 AM', squad_id: 's1'
    },
    {
        id: 'mock-23', created_at: new Date(Date.now() - 320000000).toISOString(), customer_phone: '+1 (555) 010-1023', call_id: 'mock-call-23', caller_name: 'Will Smith', intent: 'Old Quote', booking_status: 'Callback Required', status: 'completed', summary: 'Renew quote.', transcript: 'User: Renew. AI: Ok.', resolution_status: 'Pending', verified: 'Verified', date: '2025-05-09', called_at: '10:30 AM', squad_id: 's1'
    },
    {
        id: 'mock-24', created_at: new Date(Date.now() - 330000000).toISOString(), customer_phone: '+1 (555) 010-1024', call_id: 'mock-call-24', caller_name: 'Xena Warrior', intent: 'Commercial Lead', booking_status: 'Booked', status: 'booked', summary: 'Warehouse.', transcript: 'User: Big roof. AI: Quote.', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-08', called_at: '12:15 PM', squad_id: 's1'
    },
    {
        id: 'mock-25', created_at: new Date(Date.now() - 340000000).toISOString(), customer_phone: '+1 (555) 010-1025', call_id: 'mock-call-25', caller_name: 'Yoda', intent: 'General Enquiry', booking_status: 'No Action', status: 'completed', summary: 'Solar power good.', transcript: 'User: Good? AI: Yes.', resolution_status: 'Closed', verified: 'Verified', date: '2025-05-08', called_at: '02:45 PM', squad_id: 's1'
    },
    {
        id: 'mock-26', created_at: new Date(Date.now() - 350000000).toISOString(), customer_phone: '+1 (555) 010-1026', call_id: 'mock-call-26', caller_name: 'Zack Snyder', intent: 'Callback Request', booking_status: 'Callback Required', status: 'completed', summary: 'Call me tomorrow.', transcript: 'User: Tomorrow. AI: Ok.', resolution_status: 'Open', verified: 'Verified', date: '2025-05-07', called_at: '04:00 PM', squad_id: 's1'
    },
    {
        id: 'mock-27', created_at: new Date(Date.now() - 360000000).toISOString(), customer_phone: '+1 (555) 010-1027', call_id: 'mock-call-27', caller_name: 'Adam Sandler', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Pool heating.', transcript: 'User: Pool. AI: Thermal.', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-07', called_at: '05:30 PM', squad_id: 's1'
    },
    {
        id: 'mock-28', created_at: new Date(Date.now() - 370000000).toISOString(), customer_phone: '+1 (555) 010-1028', call_id: 'mock-call-28', caller_name: 'Betty White', intent: 'Support', booking_status: 'Resolved', status: 'completed', summary: 'How to use app.', transcript: 'User: How? AI: Guide.', resolution_status: 'Closed', verified: 'Verified', date: '2025-05-06', called_at: '10:00 AM', squad_id: 's1'
    },
    {
        id: 'mock-29', created_at: new Date(Date.now() - 380000000).toISOString(), customer_phone: '+1 (555) 010-1029', call_id: 'mock-call-29', caller_name: 'Chris Pratt', intent: 'Complaint', booking_status: 'Follow Up Required', status: 'completed', summary: 'Bill too high.', transcript: 'User: Bill high. AI: Check usage.', resolution_status: 'Escalated', verified: 'Verified', date: '2025-05-06', called_at: '01:00 PM', squad_id: 's1'
    },
    {
        id: 'mock-30', created_at: new Date(Date.now() - 390000000).toISOString(), customer_phone: '+1 (555) 010-1030', call_id: 'mock-call-30', caller_name: 'David Guetta', intent: 'New Lead', booking_status: 'Booked', status: 'booked', summary: 'Sound studio roof.', transcript: 'User: Sound. AI: Quote.', resolution_status: 'Booked', verified: 'Verified', date: '2025-05-05', called_at: '03:15 PM', squad_id: 's1'
    }
];
