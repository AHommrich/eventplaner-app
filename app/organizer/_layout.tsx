import { Tabs } from 'expo-router';
import { EventTabIcon, EventTabIconMap, EventTabShell } from '../../components/EventTabShell';
import { useLanguage } from '../../lib/LanguageContext';
import type { ManagementRole } from '../../lib/management';

export const ORGANIZER_TAB_MANIFEST = ['index', 'schedule', 'photos', 'notes', 'settings'] as const;

/** Navigation deliberately stays identical across all organizer roles. */
export function getOrganizerTabManifest(_role: ManagementRole) {
  return ORGANIZER_TAB_MANIFEST;
}

const ORGANIZER_TAB_ICONS: EventTabIconMap = {
  index: 'grid-outline',
  schedule: 'time-outline',
  photos: 'images-outline',
  notes: 'checkbox-outline',
  settings: 'settings-outline',
};

export default function OrganizerTabLayout() {
  const { t } = useLanguage();

  return (
    <EventTabShell
      icons={ORGANIZER_TAB_ICONS}
      orderedTabNames={ORGANIZER_TAB_MANIFEST}
      tabBasePath="/organizer"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('organizer.tabs.overview'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('organizer.tabs.schedule'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('organizer.tabs.photos'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="images-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: t('organizer.tabs.tasks'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="checkbox-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('organizer.tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <EventTabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </EventTabShell>
  );
}
