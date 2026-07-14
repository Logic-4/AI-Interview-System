/** @type {import('tailwindcss').Config} */
const withOpacity = (variableName) => {
    return ({ opacityValue }) => {
        if (opacityValue !== undefined) {
            return `oklch(var(${variableName}) / ${opacityValue})`;
        }
        return `oklch(var(${variableName}))`;
    };
};

module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        container: {
            center: true,
        },
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#EE4264',
                    hover: '#E13458',
                    light: '#FFF1F4',
                    'dark-light': 'rgba(238,66,100,.15)',
                    foreground: withOpacity('--primary-foreground'),
                    glow: withOpacity('--primary-glow'),
                },
                secondary: {
                    DEFAULT: '#2F3446',
                    light: '#EFF1F5',
                    'dark-light': 'rgba(47,52,70,.15)',
                },
                success: {
                    DEFAULT: '#22C55E',
                    light: '#E8FDF0',
                    'dark-light': 'rgba(34,197,94,.15)',
                },
                danger: {
                    DEFAULT: '#EF4444',
                    light: '#FEE2E2',
                    'dark-light': 'rgba(239,68,68,.15)',
                },
                warning: {
                    DEFAULT: '#F59E0B',
                    light: '#FEF3C7',
                    'dark-light': 'rgba(245,158,11,.15)',
                },
                info: {
                    DEFAULT: '#3B82F6',
                    light: '#EFF6FF',
                    'dark-light': 'rgba(59,130,246,.15)',
                },
                dark: {
                    DEFAULT: '#3b3f5c',
                    light: '#eaeaec',
                    'dark-light': 'rgba(59,63,92,.15)',
                },
                black: {
                    DEFAULT: '#0e1726',
                    light: '#e3e4eb',
                    'dark-light': 'rgba(14,23,38,.15)',
                },
                white: {
                    DEFAULT: '#ffffff',
                    light: '#e0e6ed',
                    dark: '#888ea8',
                },
                background: withOpacity('--background'),
                foreground: withOpacity('--foreground'),
                card: {
                    DEFAULT: withOpacity('--card'),
                    foreground: withOpacity('--card-foreground'),
                },
                popover: {
                    DEFAULT: withOpacity('--popover'),
                    foreground: withOpacity('--popover-foreground'),
                },
                muted: {
                    DEFAULT: withOpacity('--muted'),
                    foreground: withOpacity('--muted-foreground'),
                },
                accent: {
                    DEFAULT: withOpacity('--accent'),
                    foreground: withOpacity('--accent-foreground'),
                },
                destructive: {
                    DEFAULT: withOpacity('--destructive'),
                    foreground: withOpacity('--destructive-foreground'),
                },
                border: withOpacity('--border'),
                input: withOpacity('--input'),
                ring: withOpacity('--ring'),
                surface: withOpacity('--surface'),
                'surface-elevated': withOpacity('--surface-elevated'),
            },
            fontFamily: {
                nunito: ['Outfit', 'sans-serif'],
                sans: ['Inter', 'Outfit', 'sans-serif'],
                display: ['Sora', 'Outfit', 'sans-serif'],
            },
            spacing: {
                4.5: '18px',
            },
            borderRadius: {
                'xl': '12px',
                '2xl': '16px',
                '3xl': '20px',
            },
            boxShadow: {
                card: '0 8px 30px rgba(15, 23, 42, 0.05)',
                dropdown: '0 20px 40px rgba(15, 23, 42, 0.08)',
                modal: '0 30px 80px rgba(15, 23, 42, 0.12)',
                '3xl': '0 2px 2px rgb(224 230 237 / 46%), 1px 6px 7px rgb(224 230 237 / 46%)',
            },
            typography: ({ theme }) => ({
                DEFAULT: {
                    css: {
                        '--tw-prose-invert-headings': theme('colors.white.dark'),
                        '--tw-prose-invert-links': theme('colors.white.dark'),
                        h1: { fontSize: '40px', marginBottom: '0.5rem', marginTop: 0 },
                        h2: { fontSize: '32px', marginBottom: '0.5rem', marginTop: 0 },
                        h3: { fontSize: '28px', marginBottom: '0.5rem', marginTop: 0 },
                        h4: { fontSize: '24px', marginBottom: '0.5rem', marginTop: 0 },
                        h5: { fontSize: '20px', marginBottom: '0.5rem', marginTop: 0 },
                        h6: { fontSize: '16px', marginBottom: '0.5rem', marginTop: 0 },
                        p: { marginBottom: '0.5rem' },
                        li: { margin: 0 },
                        img: { margin: 0 },
                    },
                },
            }),
        },
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
        require('@tailwindcss/typography'),
    ],
};
