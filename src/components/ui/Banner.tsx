import type { ReactNode } from "react";
import { View } from "react-native";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

export type BannerTone = "warning" | "danger" | "success" | "info";

const spec: Record<BannerTone, { box: string; tone: TextTone; color: ColorName; icon: IconName }> = {
  warning: { box: "bg-warning-subtle border-warning", tone: "warning", color: "warning", icon: "warning" },
  danger: { box: "bg-danger-subtle border-danger", tone: "danger", color: "danger", icon: "error" },
  success: { box: "bg-success-subtle border-success", tone: "success", color: "success", icon: "check" },
  info: { box: "bg-primary-subtle border-primary", tone: "accentStrong", color: "primary-hover", icon: "info" },
};

/** Says what happened (bold) and what to do next. Red only for things that block. */
export function Banner({
  tone,
  title,
  children,
  icon,
  action,
}: {
  tone: BannerTone;
  title?: string;
  children?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  const s = spec[tone];
  return (
    <View className={`flex-row items-start gap-12 rounded-md border p-12 ${s.box}`} accessibilityRole="alert">
      <View className="mt-[2px]">
        <Icon name={icon ?? s.icon} color={s.color} />
      </View>
      <View className="min-w-0 flex-1 gap-8">
        <View>
          {title ? (
            <Text variant="body" weight="600" tone={s.tone}>
              {title}
            </Text>
          ) : null}
          {children ? (
            <Text variant="body" tone={s.tone}>
              {children}
            </Text>
          ) : null}
        </View>
        {/* Buttons sit at the text's left edge and take only their own width. */}
        {action ? <View className="flex-row flex-wrap items-center gap-8">{action}</View> : null}
      </View>
    </View>
  );
}

/**
 * Amber note for a soft check: what's off, what to check, and that the owner will see it.
 * Never asks the manager for a reason (CLAUDE.md hard rule 7).
 */
export function FlagNote({ children, emphasis }: { children: string; emphasis?: string }) {
  return (
    <View className="flex-row items-start gap-8 rounded-md border border-warning bg-warning-subtle px-12 py-[10px]">
      <View className="mt-[2px]">
        <Icon name="flag" color="warning" />
      </View>
      <Text variant="body" tone="warning" className="flex-1">
        {children}
        {emphasis ? (
          <Text variant="body" weight="600" tone="warning">
            {` ${emphasis}`}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}
