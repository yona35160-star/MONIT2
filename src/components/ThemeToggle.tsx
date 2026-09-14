import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * AdminThemeToggle
 * Toggles 'admin-light' class on <html> element.
 * Dark is the default; light adds the class.
 * Persists choice in localStorage under 'admin_theme'.
 */
export const ThemeToggle: React.FC = () => {
    const [isLight, setIsLight] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('admin_theme') === 'light';
        }
        return false;
    });

    // Apply class and persist on every change
    useEffect(() => {
        const html = document.documentElement;
        if (isLight) {
            html.classList.add('admin-light');
            localStorage.setItem('admin_theme', 'light');
        } else {
            html.classList.remove('admin-light');
            localStorage.setItem('admin_theme', 'dark');
        }
    }, [isLight]);

    // Restore saved preference on first render (before React hydration)
    useEffect(() => {
        const saved = localStorage.getItem('admin_theme');
        if (saved === 'light') {
            document.documentElement.classList.add('admin-light');
            setIsLight(true);
        }
    }, []);

    return (
        <button
            id="admin-theme-toggle"
            onClick={() => setIsLight(prev => !prev)}
            aria-label={isLight ? 'מעבר למצב כהה' : 'מעבר למצב בהיר'}
            title={isLight ? 'מעבר למצב כהה' : 'מעבר למצב בהיר'}
            style={{
                backgroundColor: 'var(--admin-panel)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text-secondary)',
            }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
                       hover:scale-105 active:scale-95 transition-all duration-200
                       focus-visible:ring-2 focus-visible:ring-offset-1"
        >
            <span
                className="absolute inset-0 rounded-xl transition-opacity duration-300"
                style={{ opacity: isLight ? 1 : 0, background: 'rgba(251,191,36,0.08)' }}
            />
            {isLight ? (
                <Moon className="w-4 h-4 relative z-10" style={{ color: 'var(--admin-text-secondary)' }} />
            ) : (
                <Sun className="w-4 h-4 relative z-10 text-amber-400" />
            )}
        </button>
    );
};
