/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f9e8',
          100: '#e6f2cf',
          500: '#6ea733',
          600: '#5b8a2a',
          700: '#4a7023',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(20, 24, 30, 0.08)',
      },
    },
  },
  plugins: [],
};
