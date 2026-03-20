export type FontKey =
  | 'playfair'
  | 'cormorant'
  | 'cinzel'
  | 'dancing'
  | 'great_vibes'
  | 'raleway'
  | 'lora'
  | 'josefin';

export type FontDefinition = { regular: string; bold: string };

export const FONT_MAP: Record<FontKey, FontDefinition> = {
  playfair:    { regular: 'PlayfairDisplay_400Regular',    bold: 'PlayfairDisplay_700Bold' },
  cormorant:   { regular: 'CormorantGaramond_400Regular',  bold: 'CormorantGaramond_700Bold' },
  cinzel:      { regular: 'Cinzel_400Regular',             bold: 'Cinzel_700Bold' },
  dancing:     { regular: 'DancingScript_400Regular',      bold: 'DancingScript_700Bold' },
  great_vibes: { regular: 'GreatVibes_400Regular',         bold: 'GreatVibes_400Regular' },
  raleway:     { regular: 'Raleway_400Regular',            bold: 'Raleway_700Bold' },
  lora:        { regular: 'Lora_400Regular',               bold: 'Lora_700Bold' },
  josefin:     { regular: 'JosefinSans_400Regular',        bold: 'JosefinSans_700Bold' },
};
