import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'taxipro_theme';

function applyTheme(light: boolean) {
    const html = document.documentElement;
    html.classList.toggle('theme-light', light);
    html.classList.toggle('admin-light', light); // compat with existing admin CSS
    html.dataset.theme = light ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, light ? 'light' : 'dark');
    // legacy key for older admin toggle
    localStorage.setItem('admin_theme', light ? 'light' : 'dark');
}

/**
 * App-wide theme toggle — Dark (GitHub) default / Light (Amazon day).
 * Sets `theme-light` + `admin-light` on <html>.
 */
export const ThemeToggle: React.FC = () => {
    const [isLight, setIsLight] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('admin_theme');
        return saved === 'light';
    });

    useEffect(() => {
        applyTheme(isLight);
    }, [isLight]);

    return (
        <button
            id="theme-toggle"
            type="button"
            onClick={() => setIsLight((prev) => !prev)}
            aria-label={isLight ? 'מעבר למצב כהה' : 'מעבר למצב בהיר'}
            title={isLight ? 'מעבר למצב כהה' : 'מעבר למצב בהיר'}
            style={{
                backgroundColor: 'var(--tp-bg-subtle, var(--admin-panel))',
                border: '1px solid var(--tp-border, var(--admin-card-border))',
                color: 'var(--tp-text-secondary, var(--admin-text-secondary))',
            }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
                       hover:scale-105 active:scale-95 transition-all duration-200
                       focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
        >
            {isLight ? (
                <Moon className="w-4 h-4 relative z-10" />
            ) : (
                <Sun className="w-4 h-4 relative z-10 text-primary-400" />
            )}
        </button>
    );
};
