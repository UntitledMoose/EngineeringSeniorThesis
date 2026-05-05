import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/auth';

export default function Index() {
  const { session, profile } = useAuthStore();

  // Not authenticated -> login
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but no profile (not in organization) -> waiting screen
  if (!profile) {
    return <Redirect href="/(auth)/pending" />;
  }

  // Authenticated with profile -> main app
  return <Redirect href="/(app)" />;
}
