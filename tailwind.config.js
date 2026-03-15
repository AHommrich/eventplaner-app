/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1a1a1a',      // Placeholder — austauschbar
        secondary: '#ffffff',
        accent: '#c9a96e',       // Placeholder — austauschbar
        background: '#f9f9f9',
        surface: '#ffffff',
        muted: '#6b7280',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['System'],        // Placeholder — austauschbar
      },
    },
  },
  plugins: [],
};
