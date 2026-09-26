import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { BottomNav, SideRail, useIsWide, type NavItem } from "@/components/ui";
import { useSession } from "@/features/session/SessionProvider";
import { tabsFor, type TabKey } from "@/features/shell/tabs";

export default function TabsLayout() {
  const { role } = useSession();
  const wide = useIsWide() && Platform.OS === "web";
  const visible = tabsFor(role);

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom" }}
      tabBar={({ state, navigation }) => {
        const current = state.routes[state.index]?.name as TabKey;
        const items: NavItem[] = visible.map((t) => ({
          key: t.key,
          label: t.label,
          icon: t.icon,
          active: current === t.key,
          onPress: () => navigation.navigate(t.key),
        }));
        return wide ? <SideRail items={items} /> : <BottomNav items={items} />;
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="sales" options={{ title: "Sales" }} />
      <Tabs.Screen name="tanker" options={{ title: "Tanker" }} />
      {/* Owner only: hidden from managers and not reachable by URL. */}
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", href: role === "owner" ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
