import { View } from "react-native";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

export type PillStatus = "draft" | "submitted" | "locked" | "matched" | "notMatched" | "flag";

const spec: Record<PillStatus, { box: string; tone: TextTone; icon?: IconName; iconColor: ColorName; label: string }> = {
  draft: { box: "bg-surface border-border-strong", tone: "secondary", iconColor: "text-secondary", label: "Not submitted" },
  submitted: { box: "bg-primary-subtle border-primary", tone: "accentStrong", icon: "send", iconColor: "primary-hover", label: "Submitted" },
  locked: { box: "bg-text-primary border-text-primary", tone: "inverse", icon: "lock", iconColor: "bg", label: "Locked" },
  matched: { box: "bg-success-subtle border-success", tone: "success", icon: "check", iconColor: "success", label: "Matched" },
  notMatched: { box: "bg-danger-subtle border-danger", tone: "danger", icon: "close", iconColor: "danger", label: "Not matched" },
  flag: { box: "bg-warning-subtle border-warning", tone: "warning", icon: "flag", iconColor: "warning", label: "Flag" },
};

/** 28 px pill. Always icon or word plus outline, so colour is never the only cue. */
export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  const s = spec[status];
  return (
    <View className={`h-[28px] flex-row items-center gap-4 self-start rounded-full border px-[10px] ${s.box}`}>
      {s.icon ? <Icon name={s.icon} size="small" color={s.iconColor} /> : null}
      <Text variant="label" tone={s.tone}>
        {label ?? s.label}
      </Text>
    </View>
  );
}
