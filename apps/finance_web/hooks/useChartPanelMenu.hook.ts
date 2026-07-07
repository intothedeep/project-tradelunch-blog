'use client';

// Purpose: Manages the chart config menu open/close state, the click-outside
// handler, and the lightweight-charts error suppression effect. Single
// responsibility: panel-level UI interaction state only.

import { useEffect, useRef, useState } from 'react';

interface ChartPanelMenuReturn {
    menuOpen: boolean;
    setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    gearRef: React.RefObject<HTMLButtonElement | null>;
    menuRef: React.RefObject<HTMLDivElement | null>;
}

export function useChartPanelMenu(): ChartPanelMenuReturn {
    const [menuOpen, setMenuOpen] = useState(false);
    const gearRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // lightweight-charts v5 schedules internal rAFs that can fire after
    // chart.remove() (strict-mode unmount, and — since history is fetched
    // lazily — every candles-change teardown+rebuild). The thrown "Object is
    // disposed" comes from fancy-canvas reading sizes on a disposed canvas
    // binding; there's no API to cancel that rAF from outside, so suppress it
    // at the window level for the lifetime of this panel.
    //
    // Match on the message ALONE — NOT on event.filename. In production the
    // library is bundled into a hash-named chunk (e.g. 2cd7avmplo_3k.js), so a
    // filename `.includes('lightweight-charts')` check never matches and the
    // error leaks to the console. "Object is disposed" is specific enough to
    // this library that a message-only match is safe.
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            const msg = event.message || event.error?.message || '';
            if (msg.includes('Object is disposed')) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        window.addEventListener('error', onError);
        return () => window.removeEventListener('error', onError);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                gearRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            )
                return;
            setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return { menuOpen, setMenuOpen, gearRef, menuRef };
}
