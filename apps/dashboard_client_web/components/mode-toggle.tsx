'use client';

import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeToggle } from '@/hooks/useThemeToggle.hook';

export function ModeToggle() {
    const { mounted, currentTheme, toggleTheme } = useThemeToggle();

    if (!mounted) return null;

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
        >
            {currentTheme === 'dark' ? (
                <Moon className="h-[1.2rem] w-[1.2rem]" />
            ) : (
                <Sun className="h-[1.2rem] w-[1.2rem]" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
