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
  /** The first card not done (D104): teal "Next" tag and a thicker teal border, so a new manager knows where to start. */
  next?: boolean;
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

/**
 * One card per day section on Today. Done cards fold to one line (D104), so the ones still to do
 * stand out; the first one not done carries a "Next" tag.
 */
export function SectionCard({ title, subtitle, status, errors = 0, flags = 0, onPress, next }: SectionCardProps) {
  const locked = status === "locked";
  const folded = status === "done" && !next && errors === 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${next ? "Next: " : ""}${title}. ${subtitle}`}
      className={`flex-row items-center gap-12 rounded-md px-16 ${folded ? "min-h-tap py-8" : "min-h-[64px] py-[10px]"} ${
        next ? "border-2 border-primary" : "border border-border"
      } ${locked ? "bg-surface" : "bg-bg"}`}
    >
      <View className="h-24 w-24 items-center justify-center">
        {locked ? <Icon name="lock" color="text-muted" /> : <StatusMarker status={status} />}
      </View>
      {folded ? (
        <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-x-8">
          <Text variant="body" weight="600">
            {title}
          </Text>
          <Text variant="label" weight="400" tone="secondary">
            {subtitle}
          </Text>
        </View>
      ) : (
        <View className="min-w-0 flex-1 gap-[2px]">
          {next ? (
            <View className="self-start rounded-full bg-primary px-8">
              <Text variant="label" weight="600" tone="onPrimary">
                Next
              </Text>
            </View>
          ) : null}
          <Text variant="heading" tone={locked ? "secondary" : "primary"}>
            {title}
          </Text>
          <Text variant="label" weight="400" tone="secondary">
            {subtitle}
          </Text>
        </View>
      )}
      {errors > 0 ? <CountBadge count={errors} tone="danger" /> : null}
      {flags > 0 ? <CountBadge count={flags} tone="warning" /> : null}
      <Icon name="chevronRight" color="text-secondary" />
    </Pressable>
  );
}
