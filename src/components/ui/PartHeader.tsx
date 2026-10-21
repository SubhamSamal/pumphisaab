import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * A numbered part of a long form (D105: "1 Cash · 2 Paytm, cards… · 3 Credit slips · 4 Customer
 * payments"), so a manager never loses their place. The number turns into a green tick when done.
 */
export function PartHeader({ number, title, done, right }: { number: number; title: string; done?: boolean; right?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-8">
      <View className={`h-24 w-24 items-center justify-center rounded-full ${done ? "bg-success" : "bg-primary-subtle"}`}>
        {done ? (
          <Icon name="check" size="small" color="on-success" />
        ) : (
          <Text variant="label" weight="600" tone="accent">
            {String(number)}
          </Text>
        )}
      </View>
      <Text variant="heading" className="min-w-0 flex-1">
        {title}
      </Text>
      {right}
    </View>
  );
}
