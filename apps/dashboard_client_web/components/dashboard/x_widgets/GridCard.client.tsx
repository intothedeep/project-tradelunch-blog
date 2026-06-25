"use client";

import { ReactNode } from "react";
import { clsx } from "clsx";
import { LayoutGrid as GridCardIcon } from 'lucide-react';

interface GridCardProps {
    title: string;
    children: ReactNode;
    className?: string;
    icon?: ReactNode;
}

export function GridCard({ title, children, className, icon }: GridCardProps) {
    return (
        <div className={clsx("flex flex-col h-full w-full min-w-0 bg-card text-card-foreground border rounded-lg shadow-sm overflow-hidden", className)}>
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20 drag-handle cursor-move min-w-0">
                {icon ? icon : <GridCardIcon className="w-4 h-4 text-muted-foreground shrink-0" />}
                <h3 className="text-sm font-semibold leading-none tracking-tight truncate">{title}</h3>
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
                {children}
            </div>
        </div>
    );
}
