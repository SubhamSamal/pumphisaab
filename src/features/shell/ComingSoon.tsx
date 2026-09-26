import { View } from "react-native";
import { Icon, Text, type IconName } from "@/components/ui";

/** Phase 1 placeholder for a tab (decision D9): one line, no fake numbers. */
export function ComingSoon({ icon, line }: { icon: IconName; line: string }) {
  return (
    <View className="items-center gap-16 px-16 py-40">
      <Icon name={icon} size="large" color="text-secondary" />
      <Text variant="body" tone="secondary" className="text-center">
        {line}
      </Text>
    </View>
  );
}
