import { View } from "react-native";
import { Text } from "./Text";
import { SaveIndicator, type SaveState } from "./SaveIndicator";

/** "4 of 8 done" + 8 px bar. Always a number, never a bare bar. */
export function ProgressBar({ done, total, left, save }: { done: number; total: number; left?: React.ReactNode; save?: SaveState }) {
  // A sliver shows at 0 so the track reads as a progress bar, like the canvas.
  const pct = Math.max(2, Math.round((done / total) * 100));
  return (
    <View className="gap-8">
      <View className="flex-row items-center justify-between gap-12">
        {left ?? <View />}
        <View className="flex-row items-center gap-8">
          <Text variant="label" tone="secondary">
            {done} of {total} done
          </Text>
          {save ? <SaveIndicator state={save} /> : null}
        </View>
      </View>
      <View
        className="h-8 overflow-hidden rounded-full border border-border bg-auto-field-bg"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
