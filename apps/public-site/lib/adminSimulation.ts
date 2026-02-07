// Admin simulation data generator for 100 home service businesses

export interface BusinessAccount {
    id: string;
    name: string;
    type: string;
    minutes_used: number;
    minutes_limit: number;
    total_calls: number;
    successful_calls: number;
    success_rate: number;
    total_cost: number;
    status: 'active' | 'warning' | 'critical';
    call_reasons: { [reason: string]: number };
    avg_call_duration: number;
}

export interface SystemMetrics {
    total_minutes_used: number;
    total_minutes_limit: number;
    total_calls_today: number;
    overall_success_rate: number;
    total_cost_today: number;
    active_users: number;
    avg_call_duration: number;
    peak_hour: string;
    cost_by_model: { [model: string]: number };
}

export interface FailedCall {
    id: string;
    business_id: string;
    business_name: string;
    timestamp: Date;
    duration: number;
    issue_type: 'timeout' | 'info_missing' | 'frustrated' | 'system_error';
    recording_url?: string;
    transcript?: string;
    frustration_indicators?: string[];
    missing_fields?: string[];
}

export interface ErrorLog {
    id: string;
    timestamp: Date;
    level: 'error' | 'warning' | 'info';
    source: string;
    message: string;
    business_id?: string;
    stack_trace?: string;
}

export interface ActivityEvent {
    id: string;
    timestamp: Date;
    type: 'completed' | 'incomplete' | 'failed';
    business_name: string;
    message: string;
}

const BUSINESS_TYPES = [
    'Plumber', 'Electrician', 'HVAC', 'Landscaper', 'Cleaner',
    'Handyman', 'Painter', 'Roofer', 'Locksmith', 'Carpenter',
    'Pest Control', 'Pool Service', 'Garage Door', 'Window Cleaning',
    'Carpet Cleaning', 'Appliance Repair', 'Fence Installation'
];

const BUSINESS_NAMES = [
    'Pro', 'Elite', 'Expert', 'Premium', 'Quality', 'Best', 'Prime',
    'Superior', 'Ace', 'Master', 'Top', 'First Rate', 'A+', 'Five Star'
];

const CALL_REASONS = {
    'Booking': 0.38,
    'General Inquiry': 0.27,
    'Quote Request': 0.18,
    'Support/Complaint': 0.12,
    'Other': 0.05
};

const MODELS = {
    'GPT-4': { percentage: 0.50, cost_per_min: 0.12 },
    'Claude': { percentage: 0.35, cost_per_min: 0.10 },
    'Gemini': { percentage: 0.10, cost_per_min: 0.08 },
    'Whisper': { percentage: 0.05, cost_per_min: 0.06 }
};

const FRUSTRATION_PHRASES = [
    'I already told you that',
    'Can I speak to a real person?',
    'This is frustrating',
    'You\'re not listening',
    'I\'m getting annoyed',
    'This isn\'t working'
];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateBusinessName(): string {
    const type = randomChoice(BUSINESS_TYPES);
    const name = randomChoice(BUSINESS_NAMES);
    const suffix = Math.random() > 0.5 ? ' Services' : '';
    return `${name} ${type}${suffix}`;
}

function generateCallReasons(): { [reason: string]: number } {
    const total = randomInt(50, 500);
    const reasons: { [reason: string]: number } = {};

    let remaining = total;
    Object.entries(CALL_REASONS).forEach(([reason, percentage], index) => {
        if (index === Object.keys(CALL_REASONS).length - 1) {
            reasons[reason] = remaining;
        } else {
            const count = Math.floor(total * percentage);
            reasons[reason] = count;
            remaining -= count;
        }
    });

    return reasons;
}

// Generate 100 business accounts
export function generateBusinessAccounts(): BusinessAccount[] {
    const businesses: BusinessAccount[] = [];

    for (let i = 0; i < 100; i++) {
        const performanceCategory = Math.random();
        let successRate: number;
        let status: 'active' | 'warning' | 'critical';

        // 60% good, 25% moderate, 15% issues
        if (performanceCategory < 0.60) {
            successRate = randomInt(90, 98) / 100;
            status = 'active';
        } else if (performanceCategory < 0.85) {
            successRate = randomInt(80, 89) / 100;
            status = 'warning';
        } else {
            successRate = randomInt(65, 79) / 100;
            status = 'critical';
        }

        const minutesLimit = randomChoice([500, 1000, 2000, 3000, 5000]);
        const usagePercentage = status === 'active'
            ? randomInt(30, 70) / 100
            : status === 'warning'
                ? randomInt(70, 90) / 100
                : randomInt(85, 99) / 100;

        const minutesUsed = Math.floor(minutesLimit * usagePercentage);
        const totalCalls = randomInt(50, 500);
        const successfulCalls = Math.floor(totalCalls * successRate);

        // Calculate cost based on minutes and model distribution
        let totalCost = 0;
        Object.values(MODELS).forEach(model => {
            totalCost += minutesUsed * model.percentage * model.cost_per_min;
        });

        businesses.push({
            id: `BIZ-${String(i + 1).padStart(4, '0')}`,
            name: generateBusinessName(),
            type: randomChoice(BUSINESS_TYPES),
            minutes_used: minutesUsed,
            minutes_limit: minutesLimit,
            total_calls: totalCalls,
            successful_calls: successfulCalls,
            success_rate: successRate * 100,
            total_cost: Math.round(totalCost * 100) / 100,
            status,
            call_reasons: generateCallReasons(),
            avg_call_duration: randomInt(120, 300) // seconds
        });
    }

    return businesses;
}

// Calculate system-wide metrics
export function calculateSystemMetrics(businesses: BusinessAccount[]): SystemMetrics {
    const totalMinutes = businesses.reduce((sum, b) => sum + b.minutes_used, 0);
    const totalLimit = businesses.reduce((sum, b) => sum + b.minutes_limit, 0);
    const totalCalls = businesses.reduce((sum, b) => sum + b.total_calls, 0);
    const totalSuccessful = businesses.reduce((sum, b) => sum + b.successful_calls, 0);
    const totalCost = businesses.reduce((sum, b) => sum + b.total_cost, 0);

    // Model cost breakdown
    const costByModel: { [model: string]: number } = {};
    Object.entries(MODELS).forEach(([model, config]) => {
        costByModel[model] = Math.round(totalMinutes * config.percentage * config.cost_per_min * 100) / 100;
    });

    return {
        total_minutes_used: totalMinutes,
        total_minutes_limit: totalLimit,
        total_calls_today: totalCalls,
        overall_success_rate: (totalSuccessful / totalCalls) * 100,
        total_cost_today: totalCost,
        active_users: businesses.filter(b => b.status === 'active').length,
        avg_call_duration: Math.round(
            businesses.reduce((sum, b) => sum + b.avg_call_duration, 0) / businesses.length
        ),
        peak_hour: '2-4 PM',
        cost_by_model: costByModel
    };
}

// Generate failed/problematic calls
export function generateFailedCalls(businesses: BusinessAccount[]): FailedCall[] {
    const failedCalls: FailedCall[] = [];
    const now = new Date();

    businesses.forEach(business => {
        const failedCount = business.total_calls - business.successful_calls;

        for (let i = 0; i < Math.min(failedCount, 5); i++) {
            const issueType = randomChoice(['timeout', 'info_missing', 'frustrated', 'system_error'] as const);
            const timestamp = new Date(now.getTime() - randomInt(0, 24 * 60 * 60 * 1000));

            const call: FailedCall = {
                id: `CALL-${business.id}-${i}`,
                business_id: business.id,
                business_name: business.name,
                timestamp,
                duration: issueType === 'timeout' ? randomInt(10, 30) : randomInt(60, 300),
                issue_type: issueType,
            };

            if (issueType === 'frustrated') {
                call.frustration_indicators = [
                    randomChoice(FRUSTRATION_PHRASES),
                    'Repeated information 3 times',
                    'Negative sentiment detected'
                ];
                call.transcript = `[0:23] Caller: "I need to book a service..."
[0:45] AI: "I'd be happy to help. What service do you need?"
[1:12] Caller: "${randomChoice(FRUSTRATION_PHRASES)}"
[1:35] AI: "I apologize for the confusion..."`;
            } else if (issueType === 'info_missing') {
                call.missing_fields = randomChoice([
                    ['phone_number', 'appointment_time'],
                    ['customer_name', 'service_type'],
                    ['address', 'preferred_date']
                ]);
            }

            call.recording_url = `/recordings/${call.id}.mp3`;

            failedCalls.push(call);
        }
    });

    return failedCalls.slice(0, 50); // Limit to 50 for display
}

// Generate error logs
export function generateErrorLogs(): ErrorLog[] {
    const logs: ErrorLog[] = [];
    const now = new Date();
    const sources = ['API/GPT-4', 'API/Claude', 'DB/Connection', 'Call/Timeout', 'Transcription', 'Auth'];
    const messages = {
        'API/GPT-4': 'Rate limit exceeded',
        'API/Claude': 'API timeout',
        'DB/Connection': 'Slow query (3.2s)',
        'Call/Timeout': 'Call timeout (30s)',
        'Transcription': 'Low confidence (62%)',
        'Auth': 'Invalid token'
    };

    for (let i = 0; i < 100; i++) {
        const level = Math.random() < 0.3 ? 'error' : Math.random() < 0.6 ? 'warning' : 'info';
        const source = randomChoice(sources);
        const timestamp = new Date(now.getTime() - randomInt(0, 24 * 60 * 60 * 1000));

        logs.push({
            id: `LOG-${i}`,
            timestamp,
            level,
            source,
            message: messages[source as keyof typeof messages] || 'System event',
            stack_trace: level === 'error' ? 'at makeAPICall (api.ts:127)\nat processCall (handler.ts:45)' : undefined
        });
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Generate activity stream
export function generateActivityStream(businesses: BusinessAccount[]): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    const now = new Date();

    for (let i = 0; i < 20; i++) {
        const business = randomChoice(businesses);
        const type = Math.random() < business.success_rate / 100
            ? 'completed'
            : Math.random() < 0.5
                ? 'incomplete'
                : 'failed';

        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // Every 5 minutes

        const messages = {
            completed: `Call completed (${business.name})`,
            incomplete: `Call ended incomplete (${business.name})`,
            failed: `Call failed: ${randomChoice(['Timeout', 'System Error', 'API Error'])} (${business.name})`
        };

        events.push({
            id: `EVENT-${i}`,
            timestamp,
            type,
            business_name: business.name,
            message: messages[type]
        });
    }

    return events;
}
