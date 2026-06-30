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
    // chart.remove() during React strict-mode unmount cycles. The thrown
    // "Object is disposed" comes from fancy-canvas reading sizes on a
    // disposed canvas binding — there's no API to cancel that rAF from
    // outside. Suppress at the window level for the lifetime of this panel.
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            const msg = event.message ?? '';
            const src = event.filename ?? '';
            if (
                msg.includes('Object is disposed') &&
                (src.includes('fancy-canvas') ||
                    src.includes('lightweight-charts'))
            ) {
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
