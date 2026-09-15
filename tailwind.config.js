import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        path.join(__dirname, "./index.html"),
        path.join(__dirname, "./apps/**/*.html"),
        path.join(__dirname, "./src/**/*.{js,ts,jsx,tsx}"),
        path.join(__dirname, "./pages/**/*.{js,ts,jsx,tsx}"),
        path.join(__dirname, "./components/**/*.{js,ts,jsx,tsx}"),
        path.join(__dirname, "./entries/**/*.{js,ts,jsx,tsx}"),
        path.join(__dirname, "./App.tsx"),
        path.join(__dirname, "./index.tsx")
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Heebo', 'Rubik', 'Assistant', 'system-ui', 'sans-serif'],
                display: ['Heebo', 'Rubik', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#FFF8EB',
                    100: '#FFEFCC',
                    200: '#FFDC99',
                    300: '#FFC857',
                    400: '#F5B33A',
                    500: '#F5A524',
                    600: '#D4890F',
                    700: '#A86B0C',
                    800: '#7A4E09',
                    900: '#4D3106',
                },
                accent: {
                    50: '#ECFEFF',
                    100: '#CFFAFE',
                    200: '#A5F3FC',
                    300: '#67E8F9',
                    400: '#22D3EE',
                    500: '#06B6D4',
                    600: '#0891B2',
                    700: '#0E7490',
                    800: '#155E75',
                    900: '#164E63',
                },
                success: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#22C55E',
                    600: '#16A34A',
                    700: '#15803D',
                    800: '#166534',
                    900: '#14532D',
                },
                warning: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    400: '#fbbf24',
                    500: '#F59E0B',
                },
                danger: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    400: '#f87171',
                    500: '#EF4444',
                    600: '#dc2626',
                },
                surface: {
                    50: '#F3F4F6',
                    100: '#E5E7EB',
                    200: '#2A3441',
                    300: '#1C2430',
                    400: '#141A22',
                    500: '#0B0F14',
                    bg: '#0B0F14',
                    card: '#141A22',
                    elevated: '#1C2430',
                    border: '#2A3441',
                },
                taxi: {
                    yellow: '#F5A524',
                    gold: '#FFC857',
                    black: '#0B0F14',
                    dark: '#141A22',
                }
            },
            boxShadow: {
                'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                'card': '0 8px 30px rgba(0,0,0,0.35)',
                'card-hover': '0 10px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
                'card-lg': '0 20px 40px -12px rgb(0 0 0 / 0.12)',
                'glow-primary': '0 0 24px rgba(245,165,36,0.35)',
                'glow-accent': '0 0 24px rgba(34,211,238,0.3)',
                'glow-success': '0 0 20px rgb(16 185 129 / 0.25)',
                'inner-soft': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.03)',
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-mesh': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'gradient-sunny': 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                'gradient-ocean': 'linear-gradient(135deg, #667eea 0%, #48c6ef 100%)',
                'gradient-fresh': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                'gradient-warm': 'linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)',
                'hero-pattern': 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'bounce-soft': 'bounceSoft 0.6s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'float': 'float 6s ease-in-out infinite',
                'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                bounceSoft: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                shake: {
                    '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
                    '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
                    '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
                    '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
                },
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            screens: {
                'xs': '475px',
                '3xl': '1920px',
            },
        },
    },
    plugins: [],
}
