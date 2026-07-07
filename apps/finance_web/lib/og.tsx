// lib/og.tsx
// Purpose: Shared constants and pure-presentation card for OG image routes.
// Invariant: NO I/O — renderOgCard is a pure function returning JSX.
//   Callers (opengraph-image.tsx files) handle ImageResponse construction.
//   Inline styles required: Next.js ImageResponse (Satori) does not support
//   Tailwind class names — only a subset of CSS via inline style objects.

import type { ReactElement } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png' as const;

interface OgCardProps {
    title: string;
    subtitle?: string;
    badge?: string;
}

/**
 * Pure branded 1200×630 card for OG images.
 * Uses inline styles — Satori/ImageResponse requires them (no Tailwind).
 */
export function renderOgCard({
    title,
    subtitle,
    badge,
}: OgCardProps): ReactElement {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                width: '1200px',
                height: '630px',
                background: '#0a0a0a',
                padding: '72px 80px',
                fontFamily: 'sans-serif',
            }}
        >
            {/* Accent bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '6px',
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
            />

            {/* Badge / site name */}
            {badge && (
                <div
                    style={{
                        display: 'flex',
                        marginBottom: '24px',
                        fontSize: '14px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#6366f1',
                        fontWeight: 600,
                    }}
                >
                    {badge}
                </div>
            )}

            {/* Title */}
            <div
                style={{
                    fontSize: title.length > 60 ? '40px' : '52px',
                    fontWeight: 700,
                    color: '#f4f4f5',
                    lineHeight: 1.15,
                    marginBottom: subtitle ? '20px' : '0',
                    maxWidth: '980px',
                }}
            >
                {title}
            </div>

            {/* Subtitle */}
            {subtitle && (
                <div
                    style={{
                        fontSize: '24px',
                        color: '#71717a',
                        fontWeight: 400,
                        lineHeight: 1.4,
                    }}
                >
                    {subtitle}
                </div>
            )}
        </div>
    );
}
