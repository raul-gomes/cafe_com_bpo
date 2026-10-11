// Tokens são cores completas vindas do kit V4 (ver src/styles/globals.css);
// color-mix permite os modificadores de opacidade do Tailwind (bg-primary/10).
const token = (name) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`

/** @type {import('tailwindcss').Config} */
export default {
  // Variantes dark: seguem a luminosidade escolhida no kit (data-cafe-mode no <html>).
  darkMode: ['selector', '[data-cafe-mode="dark"]'],
  content: [
    './src/**/*.{ts,tsx}',
    './.storybook/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Segoe UI', 'Arial', 'sans-serif'],
        editorial: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
      },
      spacing: {
        '0.5': '3px',
        '1': '6px',
        '2': '12px',
        '3': '20px',
        '4': '28px',
        '5': '36px',
        '6': '44px',
        '7': '52px',
        '8': '60px',
        '9': '68px',
        '10': '76px',
        '11': '84px',
        '12': '96px',
        '14': '112px',
        '16': '128px',
        '20': '160px',
        '24': '192px',
        '28': '224px',
        '32': '256px',
        '36': '288px',
        '40': '320px',
        '44': '352px',
        '48': '384px',
        '52': '416px',
        '56': '448px',
        '60': '480px',
        '64': '512px',
        '72': '576px',
        '80': '640px',
        '96': '768px',
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
      },
      colors: {
        border: token('--border'),
        input: token('--input'),
        ring: token('--ring'),
        background: token('--background'),
        foreground: token('--foreground'),
        primary: {
          DEFAULT: token('--primary'),
          foreground: token('--primary-foreground'),
          strong: token('--primary-strong'),
          dark: token('--primary-dark'),
        },
        secondary: {
          DEFAULT: token('--secondary'),
          foreground: token('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: token('--destructive'),
          foreground: token('--destructive-foreground'),
        },
        success: token('--success'),
        warning: token('--warning'),
        muted: {
          DEFAULT: token('--muted'),
          foreground: token('--muted-foreground'),
        },
        accent: {
          DEFAULT: token('--accent'),
          foreground: token('--accent-foreground'),
        },
        popover: {
          DEFAULT: token('--popover'),
          foreground: token('--popover-foreground'),
        },
        card: {
          DEFAULT: token('--card'),
          foreground: token('--card-foreground'),
        },
        // Cor do módulo atual (data-cafe-module): orientação, não tema.
        module: {
          DEFAULT: token('--cafe-module'),
          bg: token('--cafe-module-bg'),
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
}
