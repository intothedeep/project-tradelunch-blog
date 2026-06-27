'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

type ThemeToggle = {
    mounted: boolean;
    currentTheme: string | undefined;
    toggleTheme: () => void;
};

// Wrap next-themes with a mount guard so consumers can render
// hydration-safe theme controls. No hidden state beyond next-themes.
export function useThemeToggle(): ThemeToggle {
    const { theme, systemTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // system 설정 시 OS 테마를 따라가도록 실제 적용 중인 테마를 감지
    const currentTheme = theme === 'system' ? systemTheme : theme;

    const toggleTheme = () => {
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };

    return { mounted, currentTheme, toggleTheme };
}
