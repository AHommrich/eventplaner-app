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
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '../../components/ThemedText';
import { isHandledApiError } from '../../lib/api';
import { theme } from '../../constants/theme';
import { useLanguage } from '../../lib/LanguageContext';
import { queryClient } from '../../lib/queryClient';
import { qk } from '../../lib/queryKeys';
import { useSessionScope } from '../../lib/SessionContext';
import { useRefetchOnFocus } from '../../lib/useRefetchOnFocus';
import { useOrganizerStyles } from '../../lib/organizerStyles';
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
  const eventStyles = useOrganizerStyles();
  const scope = useSessionScope();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ManagementNoteType>('todo');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);

  // Notes are a cache-backed query (CP5); CRUD ops re-sync via `load`.
  const notesQuery = useQuery(
    {
      queryKey: qk.notes(scope),
      queryFn: ({ signal }) => fetchManagementNotes(signal),
      enabled: scope?.actor === 'management',
    },
    queryClient
  );
  const notes = notesQuery.data ?? EMPTY_NOTES;
  const loading = notesQuery.isLoading;
  const refreshing = notesQuery.isRefetching;
  const failed = notesQuery.isError;
  const openedNote = [...notes.assigned_to_me, ...notes.personal, ...notes.assigned_team].find(
    (note) => note.id === Number(noteId)
  );

  /** Re-sync the notes query after a create/toggle/delete. */
  const load = useCallback(async () => {
    await notesQuery.refetch();
  }, [notesQuery]);

  // No bound event → this organizer session has no notes context; go home.
  useFocusEffect(
    useCallback(() => {
      if (scope?.actor !== 'management') router.replace('/organizer');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope])
  );
  // Revalidate on focus only when stale, and only while the query is enabled
  // (a non-management scope redirects above — do not fire a notes fetch there).
  useRefetchOnFocus(notesQuery, scope?.actor === 'management');

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
    } catch (e) {
      if (isHandledApiError(e)) return;
      Alert.alert(t('common.error'), t('organizer.notes.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(note: ManagementNote) {
    try {
      await setManagementNoteDone(note.id, !note.is_done);
      await load();
    } catch (e) {
      if (isHandledApiError(e)) return;
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
          } catch (e) {
            if (isHandledApiError(e)) return;
            Alert.alert(t('common.error'), t('organizer.notes.deleteFailed'));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.screen, eventStyles.screen]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void notesQuery.refetch()} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel={t('a11y.back')} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={eventStyles.colors.cardText} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, eventStyles.title]}>
          {t('organizer.notes.title')}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {openedNote && (
        <View style={[styles.notificationCard, eventStyles.button]}>
          <Ionicons name="notifications" size={22} color={eventStyles.colors.cardButtonText} />
          <View style={styles.notificationText}>
            <ThemedText style={[styles.notificationLabel, eventStyles.buttonText]}>
              {t('organizer.notes.openedFromPush')}
            </ThemedText>
            <ThemedText style={[styles.notificationTitle, eventStyles.buttonText]}>
              {openedNote.title}
            </ThemedText>
          </View>
        </View>
      )}

      <View style={[styles.card, eventStyles.card]}>
        <ThemedText style={[styles.cardTitle, eventStyles.title]}>
          {t('organizer.notes.create')}
        </ThemedText>
        <View style={styles.typeRow}>
          {(['todo', 'note'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.typeButton,
                eventStyles.outline,
                type === option && eventStyles.button,
              ]}
              onPress={() => {
                setType(option);
                if (option === 'note') setAssigneeId(null);
              }}
            >
              <ThemedText
                style={[
                  styles.typeButtonText,
                  eventStyles.text,
                  type === option && eventStyles.buttonText,
                ]}
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
          placeholderTextColor={eventStyles.colors.mutedOnCard}
          style={[styles.input, eventStyles.input]}
          maxLength={255}
        />
        <TextInput
          accessibilityLabel={t('organizer.notes.body')}
          value={body}
          onChangeText={setBody}
          placeholder={t('organizer.notes.body')}
          placeholderTextColor={eventStyles.colors.mutedOnCard}
          style={[styles.input, eventStyles.input, styles.bodyInput]}
          multiline
          maxLength={5000}
        />

        {notes.can_assign && type === 'todo' && notes.managers.length > 0 && (
          <View style={styles.assigneeBlock}>
            <ThemedText style={[styles.fieldLabel, eventStyles.text]}>
              {t('organizer.notes.assignTo')}
            </ThemedText>
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

        <TouchableOpacity
          style={[styles.saveButton, eventStyles.button]}
          onPress={create}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={eventStyles.colors.cardButtonText} />
          ) : (
            <ThemedText style={[styles.saveButtonText, eventStyles.buttonText]}>
              {t('organizer.notes.save')}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={eventStyles.colors.cardText} />
      ) : failed ? (
        <TouchableOpacity style={[styles.card, eventStyles.card]} onPress={() => void load()}>
          <ThemedText style={styles.error}>{t('common.loadFailed')}</ThemedText>
          <ThemedText style={[styles.retry, eventStyles.muted]}>{t('common.retry')}</ThemedText>
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
  const eventStyles = useOrganizerStyles();

  return (
    <TouchableOpacity
      style={[styles.chip, eventStyles.outline, active && eventStyles.button]}
      onPress={onPress}
    >
      <ThemedText style={[styles.chipText, eventStyles.text, active && eventStyles.buttonText]}>
        {label}
      </ThemedText>
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
  const eventStyles = useOrganizerStyles();

  return (
    <View style={[styles.card, eventStyles.card]}>
      <ThemedText style={[styles.cardTitle, eventStyles.title]}>{title}</ThemedText>
      {notes.length === 0 ? (
        <ThemedText style={[styles.empty, eventStyles.muted]}>{emptyLabel}</ThemedText>
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
                  color={note.is_done ? theme.colors.sage : eventStyles.colors.cardText}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons name="document-text-outline" size={23} color={eventStyles.colors.tabTint} />
            )}
            <View style={styles.noteText}>
              <ThemedText
                style={[
                  styles.noteTitle,
                  note.is_done ? eventStyles.muted : eventStyles.text,
                  note.is_done && styles.noteDone,
                ]}
              >
                {note.title}
              </ThemedText>
              {!!note.body && (
                <ThemedText style={[styles.noteBody, eventStyles.muted]}>{note.body}</ThemedText>
              )}
              {!!note.assignee_name && (
                <ThemedText style={[styles.meta, eventStyles.muted]}>
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
  screen: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  headerSpacer: { width: 26 },
  title: { fontSize: 24, fontWeight: '700' },
  card: {
    padding: 0,
  },
  notificationCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  notificationText: { flex: 1 },
  notificationLabel: { fontSize: 12, opacity: 0.8 },
  notificationTitle: { fontWeight: '700', marginTop: 2 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  typeRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  typeButtonText: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    marginBottom: theme.spacing.sm,
  },
  bodyInput: { minHeight: 82, textAlignVertical: 'top' },
  assigneeBlock: { marginVertical: theme.spacing.sm },
  fieldLabel: { fontWeight: '600', marginBottom: theme.spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13 },
  saveButton: {
    minHeight: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  saveButtonText: { fontWeight: '700' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.muted,
  },
  noteText: { flex: 1 },
  noteTitle: { fontWeight: '600' },
  noteDone: { textDecorationLine: 'line-through' },
  noteBody: { color: theme.colors.muted, fontSize: 13, marginTop: 2 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: theme.spacing.xs },
  empty: { color: theme.colors.muted },
  error: { color: theme.colors.error },
  retry: {
    color: theme.colors.muted,
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },
});
