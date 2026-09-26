import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type SectionStatus = "todo" | "inProgress" | "done" | "locked";

export type SectionCardProps = {
  title: string;
  /** Always says the next step or the one number that matters ("Done · 3,979 L sold"). */
  subtitle: string;
  status: SectionStatus;
  /** Hard errors (red count). */
  errors?: number;
  /** Flags the owner will see (amber count). */
  flags?: number;
  onPress?: () => void;
};

function StatusMarker({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return (
      <View className="h-24 w-24 items-center justify-center rounded-full bg-success">
        <Icon name="check" size="small" color="on-success" />
      </View>
    );
  }
  if (status === "inProgress") return <View className="h-12 w-12 rounded-full bg-warning" />;
  // Not started is a grey outline circle, not red, so a new day doesn't look like 8 errors.
  return <View className="h-[18px] w-[18px] rounded-full border-2 border-border-strong" />;
}

function CountBadge({ count, tone }: { count: number; tone: "danger" | "warning" }) {
  return (
    <View className={`h-24 min-w-[24px] items-center justify-center rounded-full px-[6px] ${tone === "danger" ? "bg-danger" : "bg-warning"}`}>
      <Text variant="label" weight="600" tone={tone === "danger" ? "onDanger" : "inverse"}>
        {count}
      </Text>
    </View>
  );
}

/** One card per day section on Today. */
export function SectionCard({ title, subtitle, status, errors = 0, flags = 0, onPress }: SectionCardProps) {
  const locked = status === "locked";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className={`min-h-[64px] flex-row items-center gap-12 rounded-md border border-border px-16 py-[10px] ${locked ? "bg-surface" : "bg-bg"}`}
    >
      <View className="h-24 w-24 items-center justify-center">
        {locked ? <Icon name="lock" color="text-muted" /> : <StatusMarker status={status} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="heading" tone={locked ? "secondary" : "primary"}>
          {title}
        </Text>
        <Text variant="label" weight="400" tone="secondary">
          {subtitle}
        </Text>
      </View>
      {errors > 0 ? <CountBadge count={errors} tone="danger" /> : null}
      {flags > 0 ? <CountBadge count={flags} tone="warning" /> : null}
      <Icon name="chevronRight" color="text-secondary" />
    </Pressable>
  );
}
