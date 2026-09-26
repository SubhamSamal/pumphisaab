import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

const tile: Record<"neutral" | "danger" | "warning", { box: string; color: ColorName }> = {
  neutral: { box: "bg-surface", color: "text-secondary" },
  danger: { box: "bg-danger-subtle", color: "danger" },
  warning: { box: "bg-warning-subtle", color: "warning" },
};

/** List row: optional icon tile, title + detail, value on the right, chevron if tappable. No card per row. */
export function ListItem({
  title,
  detail,
  icon,
  iconTone = "neutral",
  right,
  onPress,
  slashedZeroDetail,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  iconTone?: keyof typeof tile;
  right?: ReactNode;
  onPress?: () => void;
  slashedZeroDetail?: boolean;
}) {
  const t = tile[iconTone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className="min-h-[64px] flex-row items-center gap-12 border-b border-border py-[10px]"
    >
      {icon ? (
        <View className={`h-40 w-40 items-center justify-center rounded-sm ${t.box}`}>
          <Icon name={icon} color={t.color} />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text variant="body" weight="600">
          {title}
        </Text>
        {detail ? (
          <Text variant="label" weight="400" tone="secondary" slashedZero={slashedZeroDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {typeof right === "string" ? <Text variant="heading">{right}</Text> : right}
      {onPress ? <Icon name="chevronRight" color="text-secondary" /> : null}
    </Pressable>
  );
}
