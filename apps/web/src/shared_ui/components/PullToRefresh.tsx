
import React from 'react';

// Simplified presentation-only PullToRefresh passthrough
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<any>, children: React.ReactNode }) {
    return <>{children}</>;
}
