/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#f97316', dark: '#ea580c' },
        background: '#0a0a0a',
        surface: '#111111',
        border: '#1e1e1e',
      },
    },
  },
  plugins: [],
};
