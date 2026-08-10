import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../src/utils';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

function RootGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="campaign/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="campaign/[id]/progress" options={{ headerShown: false }} />
        <Stack.Screen name="my-campaigns" options={{ headerShown: false }} />
        <Stack.Screen name="redeem" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </AuthProvider>
  );
}
