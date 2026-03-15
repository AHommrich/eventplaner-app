/**
 * Zentrales Theme — alle Design-Tokens hier ändern.
 * Farben spiegeln tailwind.config.js wider.
 */
export const theme = {
  colors: {
    primary: '#7B1E1E',    // Dunkelbordeaux — Haupttext, Headings
    secondary: '#FFFFFF',  // Weiß — Text auf dunklem Hintergrund
    accent: '#C47B20',     // Warmes Amber — Buttons, FAB, Highlights
    terracotta: '#C4421A', // Terrakotta — sekundäre Buttons, Borders, Divider
    sage: '#5A7A4A',       // Salbeigrün — Success-States, sekundäre Elemente
    background: '#EAE5DC', // Leinenweiß — App-Hintergrund
    surface: '#F5F2EC',    // Warmweiß — Karten, Tab-Bar
    muted: '#7A6A5A',      // Warmes Braungrau — Sekundärtext
    error: '#BF4020',      // Terrakotta-Rot — Fehlermeldungen
  },
  fontFamily: {
    sans: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
} as const;
