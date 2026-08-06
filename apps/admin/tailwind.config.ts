import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0F5D52',
          50:  '#E6F2F0',
          100: '#C0DDD9',
          200: '#96C7C1',
          300: '#6BB1A9',
          400: '#3C9A91',
          500: '#0F5D52',
          600: '#0D5149',
          700: '#0B463F',
          800: '#093A35',
          900: '#072F2A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      fontVariantNumeric: {
        'tabular': 'tabular-nums',
      },
    },
  },
  plugins: [],
};

export default config;
