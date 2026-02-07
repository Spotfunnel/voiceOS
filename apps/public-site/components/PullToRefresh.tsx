import React, { useState, useEffect, useRef } from 'react';
import { RefreshCcw } from 'lucide-react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showIndicator, setShowIndicator] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const threshold = 80;
    const maxPull = 120;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isRefreshing) return;
        const container = containerRef.current;
        if (container && container.scrollTop === 0) {
            startY.current = e.touches[0].pageY;
            setShowIndicator(true);
        } else {
            startY.current = 0;
            setShowIndicator(false);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isRefreshing || startY.current === 0) return;

        const currentY = e.touches[0].pageY;
        const distance = currentY - startY.current;

        if (distance > 0) {
            // Apply resistance
            const dampenedDistance = Math.min(distance * 0.4, maxPull);
            setPullDistance(dampenedDistance);

            // Prevent scrolling while pulling
            if (distance > 10 && e.cancelable) {
                // e.preventDefault(); // Can't always prevent default on passive listeners, but we'll try
            }
        } else {
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (isRefreshing || startY.current === 0) return;

        if (pullDistance >= threshold) {
            setIsRefreshing(true);
            setPullDistance(threshold); // Hold at threshold while refreshing

            try {
                await onRefresh();
            } finally {
                // Ease back
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                    setTimeout(() => setShowIndicator(false), 300);
                }, 500);
            }
        } else {
            setPullDistance(0);
            setTimeout(() => setShowIndicator(false), 300);
        }
        startY.current = 0;
    };

    return (
        <div
            className="relative w-full h-full flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull Indicator */}
            <div
                className="absolute left-0 right-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-[60]"
                style={{
                    height: threshold,
                    top: -threshold + pullDistance,
                    opacity: showIndicator ? Math.min(pullDistance / threshold, 1) : 0,
                }}
            >
                <div className="bg-white rounded-full p-2 shadow-xl border border-primary/20 flex items-center justify-center">
                    <RefreshCcw
                        className={`w-5 h-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{
                            transform: !isRefreshing ? `rotate(${pullDistance * 3}deg)` : undefined,
                            transition: isRefreshing ? 'none' : 'transform 0.1s linear'
                        }}
                    />
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-auto transition-transform duration-300 ease-out"
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
};
