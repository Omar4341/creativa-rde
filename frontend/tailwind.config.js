/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#081C33',
        primary: {
          DEFAULT: '#005A9C',
          dark: '#004A82',
          light: '#1976B8',
        },
        accent: {
          purple: '#7B2C83',
          orange: '#F2A93B',
        },
        surface: '#F4F7FA',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
