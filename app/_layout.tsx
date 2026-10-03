import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { OutboxProvider } from "@/features/day/Outbox";
import { startCrashReports, withCrashReports } from "@/lib/crashReports";
import { SelectedDayProvider } from "@/features/day/SelectedDay";
import { SessionProvider, useSession } from "@/features/session/SessionProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});
startCrashReports();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <OutboxProvider>
            <SelectedDayProvider>
              <Screens />
            </SelectedDayProvider>
          </OutboxProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default withCrashReports(RootLayout);

/**
 * Which screens exist depends on the sign-in state:
 *   signed in and linked to a pump → the app
 *   signed out                     → the sign-in screen
 *   anything in between            → the "starting" screen (loading, no pump yet, error)
 */
function Screens() {
  const { status } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "ready"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="day/opening-dip" />
        <Stack.Screen name="day/shift" />
        <Stack.Screen name="day/tanker" />
        <Stack.Screen name="day/sales" />
        <Stack.Screen name="day/credit-slip" />
        <Stack.Screen name="day/expenses" />
        <Stack.Screen name="day/expense" />
        <Stack.Screen name="day/closing-dip" />
        <Stack.Screen name="day/review" />
        <Stack.Screen name="profile/logins" />
        <Stack.Screen name="profile/add-manager" />
        <Stack.Screen name="profile/staff" />
        <Stack.Screen name="profile/nozzles" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="starting" />
      <Stack.Screen name="gallery" />
    </Stack>
  );
}
