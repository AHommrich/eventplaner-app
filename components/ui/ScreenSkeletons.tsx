/**
 * Screen-shaped skeleton compositions built from `Skeleton` blocks. Each one
 * mirrors a real screen's chrome (grid tile size, card border, row height) so
 * there is no layout shift once the actual data replaces it.
 */
import { Dimensions, View } from 'react-native';
import { useEventTheme } from '../../lib/EventThemeContext';
import { theme } from '../../constants/theme';
import { Skeleton } from './Skeleton';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
// Mirrors the tile-size formula in app/(tabs)/photos.tsx — keep in sync.
const GRID_TILE_SIZE =
  (Dimensions.get('window').width - GRID_GAP * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

export function PhotoGridSkeleton({ rows = 4 }: { rows?: number }) {
  const tiles = Array.from({ length: rows * GRID_COLUMNS });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
      {tiles.map((_, i) => (
        <Skeleton key={i} width={GRID_TILE_SIZE} height={GRID_TILE_SIZE} borderRadius={2} />
      ))}
    </View>
  );
}

export function CardSkeleton({
  lines = 3,
  showButton = false,
}: {
  lines?: number;
  showButton?: boolean;
}) {
  const { colors } = useEventTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border + '33',
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} borderRadius={4} />
      ))}
      {showButton && (
        <Skeleton
          height={44}
          width="100%"
          borderRadius={theme.borderRadius.md}
          style={{ marginTop: theme.spacing.sm }}
        />
      )}
    </View>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <Skeleton height={15} width="70%" borderRadius={4} />
        </View>
      ))}
    </View>
  );
}
