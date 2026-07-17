import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { getActiveManagementEventId } from '../../lib/management';
import {
  createManagementNote,
  deleteManagementNote,
  fetchManagementNotes,
  ManagementNote,
  ManagementNotesPayload,
  ManagementNoteType,
  setManagementNoteDone,
} from '../../lib/managementNotes';

const EMPTY_NOTES: ManagementNotesPayload = {
  personal: [],
  assigned_to_me: [],
  assigned_team: [],
  can_assign: false,
  managers: [],
};

export default function OrganizerNotesScreen() {
  const router = useRouter();
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [notes, setNotes] = useState<ManagementNotesPayload>(EMPTY_NOTES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<ManagementNoteType>('todo');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const openedNote = [...notes.assigned_to_me, ...notes.personal, ...notes.assigned_team].find(
    (note) => note.id === Number(noteId)
  );

  const load = useCallback(async () => {
    if (!(await getActiveManagementEventId())) {
      router.replace('/organizer');
      return;
    }

    try {
      setNotes(await fetchManagementNotes());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function create() {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('organizer.notes.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      await createManagementNote({
        type,
        title: title.trim(),
        body: body.trim() || null,
        assignee_user_id: type === 'todo' ? assigneeId : null,
      });
      setTitle('');
      setBody('');
      setAssigneeId(null);
      await load();
    } catch {
      Alert.alert(t('common.error'), t('organizer.notes.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(note: ManagementNote) {
    try {
      await setManagementNoteDone(note.id, !note.is_done);
      await load();
    } catch {
      Alert.alert(t('common.error'), t('organizer.notes.saveFailed'));
    }
  }

  function remove(note: ManagementNote) {
    Alert.alert(t('organizer.notes.deleteTitle'), note.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteManagementNote(note.id);
            await load();
          } catch {
            Alert.alert(t('common.error'), t('organizer.notes.deleteFailed'));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel={t('a11y.back')} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>{t('organizer.notes.title')}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {openedNote && (
        <View style={styles.notificationCard}>
          <Ionicons name="notifications" size={22} color={theme.colors.secondary} />
          <View style={styles.notificationText}>
            <ThemedText style={styles.notificationLabel}>
              {t('organizer.notes.openedFromPush')}
            </ThemedText>
            <ThemedText style={styles.notificationTitle}>{openedNote.title}</ThemedText>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>{t('organizer.notes.create')}</ThemedText>
        <View style={styles.typeRow}>
          {(['todo', 'note'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.typeButton, type === option && styles.typeButtonActive]}
              onPress={() => {
                setType(option);
                if (option === 'note') setAssigneeId(null);
              }}
            >
              <ThemedText
                style={[styles.typeButtonText, type === option && styles.typeButtonTextActive]}
              >
                {t(`organizer.notes.types.${option}`)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          accessibilityLabel={t('organizer.notes.noteTitle')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('organizer.notes.noteTitle')}
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          maxLength={255}
        />
        <TextInput
          accessibilityLabel={t('organizer.notes.body')}
          value={body}
          onChangeText={setBody}
          placeholder={t('organizer.notes.body')}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, styles.bodyInput]}
          multiline
          maxLength={5000}
        />

        {notes.can_assign && type === 'todo' && notes.managers.length > 0 && (
          <View style={styles.assigneeBlock}>
            <ThemedText style={styles.fieldLabel}>{t('organizer.notes.assignTo')}</ThemedText>
            <View style={styles.chipRow}>
              <AssigneeChip
                label={t('organizer.notes.personal')}
                active={assigneeId === null}
                onPress={() => setAssigneeId(null)}
              />
              {notes.managers.map((manager) => (
                <AssigneeChip
                  key={manager.id}
                  label={manager.name}
                  active={assigneeId === manager.id}
                  onPress={() => setAssigneeId(manager.id)}
                />
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={create} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.colors.secondary} />
          ) : (
            <ThemedText style={styles.saveButtonText}>{t('organizer.notes.save')}</ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : failed ? (
        <TouchableOpacity style={styles.card} onPress={() => void load()}>
          <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
          <ThemedText style={styles.retry}>{t('common.retry')}</ThemedText>
        </TouchableOpacity>
      ) : (
        <>
          <NoteSection
            title={t('organizer.notes.personal')}
            notes={notes.personal}
            emptyLabel={t('organizer.notes.emptyPersonal')}
            onToggle={toggle}
            onDelete={remove}
          />
          <NoteSection
            title={t('organizer.notes.assignedToMe')}
            notes={notes.assigned_to_me}
            emptyLabel={t('organizer.notes.emptyAssigned')}
            onToggle={toggle}
          />
          {notes.can_assign && (
            <NoteSection
              title={t('organizer.notes.assignedTeam')}
              notes={notes.assigned_team}
              emptyLabel={t('organizer.notes.emptyTeam')}
              onToggle={toggle}
              onDelete={remove}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function AssigneeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

function NoteSection({
  title,
  notes,
  emptyLabel,
  onToggle,
  onDelete,
}: {
  title: string;
  notes: ManagementNote[];
  emptyLabel: string;
  onToggle: (note: ManagementNote) => void;
  onDelete?: (note: ManagementNote) => void;
}) {
  const { t } = useLanguage();

  return (
    <View style={styles.card}>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      {notes.length === 0 ? (
        <ThemedText style={styles.empty}>{emptyLabel}</ThemedText>
      ) : (
        notes.map((note) => (
          <View key={note.id} style={styles.noteRow}>
            {note.type === 'todo' ? (
              <TouchableOpacity
                accessibilityLabel={
                  note.is_done ? t('organizer.notes.markOpen') : t('organizer.notes.markDone')
                }
                onPress={() => onToggle(note)}
              >
                <Ionicons
                  name={note.is_done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={note.is_done ? theme.colors.sage : theme.colors.primary}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons name="document-text-outline" size={23} color={theme.colors.accent} />
            )}
            <View style={styles.noteText}>
              <ThemedText style={[styles.noteTitle, note.is_done && styles.noteDone]}>
                {note.title}
              </ThemedText>
              {!!note.body && <ThemedText style={styles.noteBody}>{note.body}</ThemedText>}
              {!!note.assignee_name && (
                <ThemedText style={styles.meta}>
                  {t('organizer.notes.assignee')}: {note.assignee_name}
                </ThemedText>
              )}
            </View>
            {onDelete && (
              <TouchableOpacity
                accessibilityLabel={t('common.delete')}
                onPress={() => onDelete(note)}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  headerSpacer: { width: 26 },
  title: { color: theme.colors.primary, fontSize: 24, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  notificationCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  notificationText: { flex: 1 },
  notificationLabel: { color: theme.colors.secondary, fontSize: 12, opacity: 0.8 },
  notificationTitle: { color: theme.colors.secondary, fontWeight: '700', marginTop: 2 },
  cardTitle: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  typeRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: theme.colors.primary },
  typeButtonText: { color: theme.colors.primary, fontWeight: '600' },
  typeButtonTextActive: { color: theme.colors.secondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    color: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    marginBottom: theme.spacing.sm,
  },
  bodyInput: { minHeight: 82, textAlignVertical: 'top' },
  assigneeBlock: { marginVertical: theme.spacing.sm },
  fieldLabel: { color: theme.colors.primary, fontWeight: '600', marginBottom: theme.spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.primary, fontSize: 13 },
  chipTextActive: { color: theme.colors.secondary },
  saveButton: {
    minHeight: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  saveButtonText: { color: theme.colors.secondary, fontWeight: '700' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.muted,
  },
  noteText: { flex: 1 },
  noteTitle: { color: theme.colors.primary, fontWeight: '600' },
  noteDone: { color: theme.colors.muted, textDecorationLine: 'line-through' },
  noteBody: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  meta: { color: theme.colors.accent, fontSize: 12, marginTop: theme.spacing.xs },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },
});
