'use client';

import { map } from 'rxjs';

export const validateTouchSupport = () => {
    return typeof window !== 'undefined' && 'ontouchstart' in window;
};

const isWindowAvailable = typeof window !== 'undefined';
const isTouchSupport = validateTouchSupport();
const isDocumentReady = typeof document !== 'undefined';

export const MOUSE_MOVE_EVENTS = {
    start: isTouchSupport ? 'touchstart' : 'mousedown',
    move: isTouchSupport ? 'touchmove' : 'mousemove',
    end: isTouchSupport ? 'touchend' : 'mouseup',
};

export const toPos = (obs$: any) => {
    return obs$.pipe(
        map((e: any) => {
            const isTouchSupport = validateTouchSupport();
            if (isTouchSupport) {
                return [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
            }

            return [e.pageX, e.pageY];
        })
    );
};

const initialDotSize = 12; // Starting size in pixels

export function createTrailDot(x: number, y: number) {
    // Create dot element
    const dot = document.createElement('div');
    dot.className = 'trail-dot';
    document.body.appendChild(dot);

    // Set initial position
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    // Set initial size (all dots start with same size)
    dot.style.width = `${initialDotSize}px`;
    dot.style.height = `${initialDotSize}px`;

    // Start animation
    let opacity = 0.7;
    let scale = 1;
    const lifespan = 100; // milliseconds before complete fade
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / lifespan, 1);

        // Decrease opacity over time
        opacity = 0.7 * (1 - progress);

        // Decrease size significantly as it fades
        scale = 1 - progress * 0.8; // More dramatic shrinking (80% reduction)

        // Apply changes
        dot.style.opacity = `opacity`;
        dot.style.transform = `translate(-50%, -50%) scale(${scale})`;

        // Continue animation or remove element
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            dot.remove();
        }
    }

    // Start animation
    requestAnimationFrame(animate);
}
