import { Text, View } from "react-native";

// Temporary check screen for the theme. Replaced by the tabs later in Phase 1.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-8 bg-bg">
      <Text className="font-semibold text-title text-text-primary">PumpHisaab</Text>
      <Text className="font-sans text-body text-text-secondary">₹1,50,490 · 48,210.50 L</Text>
      <View className="rounded-md bg-primary px-16 py-12">
        <Text className="font-semibold text-body text-on-primary">Theme works</Text>
      </View>
    </View>
  );
}
