import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";

/** White card, 1 px border, 16 px padding. */
export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "summary" }) {
  return (
    <View className={`gap-12 rounded-md border border-border p-16 ${tone === "summary" ? "bg-surface" : "bg-bg"}`}>
      {children}
    </View>
  );
}

/** "Should have ₹4,02,350" row. `big` for totals. The value can be any node (e.g. a DifferenceValue). */
export function KeyValueRow({ label, value, big, indent }: { label: string; value: ReactNode; big?: boolean; indent?: boolean }) {
  return (
    <View className={`flex-row items-baseline justify-between gap-12 ${indent ? "pl-12" : ""}`}>
      <Text variant="body" weight={big ? "600" : "400"} tone={big ? "primary" : "secondary"} className="flex-1">
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text variant={big ? "number-input" : "number-inline"}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Hairline divider. */
export function Divider() {
  return <View className="h-px bg-border" />;
}
