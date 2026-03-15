/**
 * Zentrales Theme — alle Design-Tokens hier ändern.
 * Farben spiegeln tailwind.config.js wider.
 */
export const theme = {
  colors: {
    primary: '#1a1a1a',
    secondary: '#ffffff',
    accent: '#c9a96e',
    background: '#f9f9f9',
    surface: '#ffffff',
    muted: '#6b7280',
    error: '#ef4444',
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
