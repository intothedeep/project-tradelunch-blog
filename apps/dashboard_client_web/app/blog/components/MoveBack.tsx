'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TProps = {
    className?: any;
};

export const MoveBack: React.FC<TProps> = ({ className }) => {
    const router = useRouter();

    return (
        <Button
            variant="secondary"
            size="icon"
            className={cn(
                // 'flex items-center justify-center',
                'h-7',
                'rounded-none',
                'text-xs font-semibold',
                'transition-colors border border-primary bg-primary-foreground',
                'hover:bg-primary hover:border-primary hover:text-primary-foreground'
            )}
            onClick={() => router.back()}
        >
            <ArrowLeft
                size={16}
                className={cn('font-bold')}
            />
        </Button>
    );
};
