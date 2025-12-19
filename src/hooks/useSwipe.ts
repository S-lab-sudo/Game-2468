'use client';

import { useRef, useCallback } from 'react';
import { Direction } from '@/types/game';
import { perfEvent, perfStart, perfEnd } from '@/lib/perfLogger';

interface UseSwipeProps {
    onSwipe: (direction: Direction) => void;
    threshold?: number;
}

interface UseSwipeReturn {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipe({ onSwipe, threshold = 50 }: UseSwipeProps): UseSwipeReturn {
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        perfStart('swipe');
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: performance.now(),
        };
    }, []);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const duration = performance.now() - touchStartRef.current.time;

        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Check if swipe exceeds threshold
        if (Math.max(absDeltaX, absDeltaY) < threshold) {
            perfEnd('swipe');
            perfEvent('swipe', `cancelled (below threshold: ${Math.max(absDeltaX, absDeltaY).toFixed(0)}px)`);
            touchStartRef.current = null;
            return;
        }

        // Determine swipe direction
        let direction: Direction;
        if (absDeltaX > absDeltaY) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }

        perfEnd('swipe');
        perfEvent('swipe', `${direction} (${duration.toFixed(0)}ms, ${Math.max(absDeltaX, absDeltaY).toFixed(0)}px)`);

        onSwipe(direction);
        touchStartRef.current = null;
    }, [onSwipe, threshold]);

    return { onTouchStart, onTouchEnd };
}
