/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcf7',
          100: '#d6f5ea',
          200: '#b0e9d6',
          300: '#82d9be',
          400: '#4abf9c',
          500: '#26a380',
          600: '#1a8165',
          700: '#176553',
          800: '#144f43',
          900: '#0f3f37'
        }
      }
    }
  },
  plugins: []
};
