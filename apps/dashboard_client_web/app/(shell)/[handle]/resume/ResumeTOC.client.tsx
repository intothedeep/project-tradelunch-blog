'use client';

import React from 'react';
import clsx from 'clsx';
import Link from 'next/link';

export const ResumeTOC = () => {
    const navItems = [
        { label: 'LINKEDIN', href: 'https://www.linkedin.com/in/tiotaeklim/' },
        { label: 'GITHUB', href: 'https://github.com/tradelunch' },
        { label: 'ALGORITHMS', href: 'https://algorithm.prettylog.com/' },
        { label: 'PORTFOLIO', href: 'https://my.prettylog.com/' },
        { label: 'EMAIL', href: 'mailto:tio.taek.lim@gmail.com' },
        // { label: '-', href: '', active: false },
        // {
        //     label: 'Download PDF',
        //     href: '/v1/pdf/resume.pdf',
        //     download: 'Taek_Lim__Software_Engineer_Resume.pdf',
        // },
    ];

    return (
        <div
            className={clsx(
                'sticky top-4 z-10 bg-background/95 backdrop-blur',
                'mb-6 p-6',
                'border border-primary rounded-md'
            )}
        >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {navItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        // download={item.download}
                        className={clsx(
                            'px-4 py-2 text-sm font-mono text-center transition-colors',
                            // 'bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md',
                            'bg-primary text-primary-foreground px-4 py-2  hover:opacity-80 transition-opacity'
                        )}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ResumeTOC;
