// app/blog/ErrorBoundary.client.tsx
'use client';

import { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class CategoryErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <Card className="bg-card border-destructive">
                        <CardHeader className="p-3 sm:p-4 border-b border-destructive/30">
                            <CardTitle className="text-destructive text-sm sm:text-base font-mono">
                                <span>&gt;</span> ERROR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">
                                Failed to load categories
                            </p>
                        </CardContent>
                    </Card>
                )
            );
        }

        return this.props.children;
    }
}
