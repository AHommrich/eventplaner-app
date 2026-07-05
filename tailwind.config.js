/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#7B1E1E', // Dunkelbordeaux — Haupttext, Headings
        secondary: '#FFFFFF', // Weiß — Text auf dunklem Hintergrund
        accent: '#C47B20', // Warmes Amber — Buttons, FAB, Highlights
        terracotta: '#C4421A', // Terrakotta — sekundäre Buttons, Borders, Divider
        sage: '#5A7A4A', // Salbeigrün — Success-States, sekundäre Elemente
        background: '#EAE5DC', // Leinenweiß — App-Hintergrund
        surface: '#F5F2EC', // Warmweiß — Karten, Tab-Bar
        muted: '#7A6A5A', // Warmes Braungrau — Sekundärtext
        error: '#BF4020', // Terrakotta-Rot — Fehlermeldungen
      },
      fontFamily: {
        sans: ['System'], // Placeholder — austauschbar
      },
    },
  },
  plugins: [],
};
