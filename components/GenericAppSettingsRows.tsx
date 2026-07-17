import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { useEventTheme } from '../lib/EventThemeContext';
import { Language, useLanguage } from '../lib/LanguageContext';
import { GradientFill } from './GradientFill';
import { ThemedText } from './ThemedText';

/** App-wide settings shared by Guest and Organizer without account-specific rows. */
export function GenericAppSettingsRows({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { colors, variant } = useEventTheme();
  const isSoft = variant.key === 'soft-luxury';
  const rowBorder = colors.border + '30';

  return (
    <>
      <View
        style={{
          padding: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: rowBorder,
        }}
      >
        <ThemedText
          style={{ fontSize: 12, color: colors.cardText + 'aa', marginBottom: theme.spacing.sm }}
        >
          {t('settings.language')}
        </ThemedText>
        <View
          style={{
            flexDirection: 'row',
            borderRadius: isSoft ? variant.radius.button : theme.borderRadius.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border + '55',
          }}
        >
          {(['de', 'en'] as Language[]).map((candidate, index) => (
            <TouchableOpacity
              key={candidate}
              onPress={() => setLanguage(candidate)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: language === candidate ? colors.cardButton : 'transparent',
                borderRightWidth: index === 0 ? 1 : 0,
                borderRightColor: colors.border + '55',
              }}
            >
              <ThemedText
                style={{
                  fontWeight: '600',
                  color: language === candidate ? colors.cardButtonText : colors.cardText,
                }}
              >
                {candidate === 'de' ? t('settings.german') : t('settings.english')}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => void onLogout()}
        style={{
          margin: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: isSoft ? variant.radius.button : theme.borderRadius.md,
          alignItems: 'center',
          backgroundColor: colors.cardButton,
          overflow: 'hidden',
        }}
      >
        {isSoft && <GradientFill color={colors.cardButton} radius={999} />}
        <ThemedText style={{ color: colors.cardButtonText, fontWeight: '600', fontSize: 14 }}>
          {t('settings.logout')}
        </ThemedText>
      </TouchableOpacity>

      <SettingsLegalRow
        label={t('settings.imprint')}
        onPress={() => router.push('/legal/imprint')}
        borderColor={rowBorder}
        textColor={colors.cardText}
      />
      <SettingsLegalRow
        label={t('settings.privacy')}
        onPress={() => router.push('/legal/privacy')}
        borderColor={rowBorder}
        textColor={colors.cardText}
      />
    </>
  );
}

function SettingsLegalRow({
  label,
  onPress,
  borderColor,
  textColor,
}: {
  label: string;
  onPress: () => void;
  borderColor: string;
  textColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: borderColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <ThemedText style={{ color: textColor, fontSize: 15 }}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={16} color={textColor + 'aa'} />
    </TouchableOpacity>
  );
}
