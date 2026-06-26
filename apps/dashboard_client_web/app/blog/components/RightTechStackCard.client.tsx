// ============================================================================
// Tech Stack Card Component

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
export const RightTechStackCard: React.FC = () => {
    const techStack = [
        'React 19',
        'Next.js 15',
        'Turborepo',
        'Node.js',
        'Express',
        'PostgreSQL',
        'Synology NAS',
        'Oracle Cloud',
        'Cloudflare',
    ];

    return (
        <Card className="bg-card border-primary hidden lg:block">
            {/* <CardHeader className="p-3 sm:p-4 border-b border-primary/30">
                <CardTitle className="text-primary flex items-center gap-2 text-sm sm:text-base font-mono">
                    <span>&gt;</span> TECH_STACK.info
                </CardTitle>
            </CardHeader> */}
            <CardContent className="p-3 sm:p-4 space-y-3">
                {/* Creator */}
                <div className="text-xs text-muted-foreground">
                    <span className="text-primary font-mono">&gt;</span> Created
                    by{' '}
                    <span className="text-foreground font-semibold">
                        Taek Lim
                    </span>
                </div>

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-1.5">
                    {techStack.map((tech, idx) => (
                        <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs px-2 py-0.5"
                        >
                            {tech.toLocaleUpperCase()}
                        </Badge>
                    ))}
                </div>

                {/* Copyright */}
                <div className="text-xs text-muted-foreground">
                    <span className="text-primary">&copy;</span>{' '}
                    {new Date().getFullYear()} All rights reserved
                </div>
            </CardContent>
        </Card>
    );
};
