// Purpose: Jotai atoms for chart drawing tools. Drawings persist per
// (label, interval) namespace because daily date strings and intraday
// timestamps cannot be safely shared across intervals.

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { Drawing, DrawingKind, DrawingPoint } from '@/lib/drawings/types';

export type ActiveDrawTool = DrawingKind | null;
export type MagnetMode = 'off' | 'loose' | 'strong';

export const activeDrawToolAtom = atom<ActiveDrawTool>(null);

export interface InProgressDrawing {
    kind: DrawingKind;
    points: DrawingPoint[];
}
export const inProgressDrawingAtom = atom<InProgressDrawing | null>(null);

export const cursorPreviewAtom = atom<DrawingPoint | null>(null);

export const selectedDrawingIdAtom = atom<string | null>(null);

export const magnetModeAtom = atom<MagnetMode>('off');

export const drawingsAtom = atomWithStorage<Record<string, Drawing[]>>(
    'dashboard.drawings',
    {}
);

export function drawingsKey(label: string, interval: string): string {
    return `${label}::${interval}`;
}
