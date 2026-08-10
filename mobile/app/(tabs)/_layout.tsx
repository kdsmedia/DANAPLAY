import { Tabs } from 'expo-router';
import { theme } from '../../src/utils';

function TabIcon({ icon, color, label }: { icon: string; color: string; label: string }) {
  return null; // expo-router uses tabBarIcon, placeholder unused
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'HOME', tabBarIcon: ({ color }) => <TabIconNative icon="🏠" color={color} /> }} />
      <Tabs.Screen name="campaigns" options={{ title: 'CAMPAIGN', tabBarIcon: ({ color }) => <TabIconNative icon="🎯" color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'RIWAYAT', tabBarIcon: ({ color }) => <TabIconNative icon="📋" color={color} /> }} />
      <Tabs.Screen name="referral" options={{ title: 'REFERRAL', tabBarIcon: ({ color }) => <TabIconNative icon="🎁" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFIL', tabBarIcon: ({ color }) => <TabIconNative icon="👤" color={color} /> }} />
    </Tabs>
  );
}

import { Text } from 'react-native';
function TabIconNative({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
