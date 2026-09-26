import { View } from "react-native";
import { AutoValueRow, FieldHint, NumericInput } from "./Field";

export type DipInputProps = {
  label?: string;
  cm: string;
  onChangeCm?: (v: string) => void;
  onBlur?: () => void;
  /** Litres from the tank chart, formatted, or undefined when cm isn't valid (shows "—"). */
  litres?: string;
  /** e.g. "Last night's closing dip: 128.5 cm" */
  reference?: string;
  error?: string;
};

/** Manager types cm (1 decimal); the app shows litres from the tank chart right below. */
export function DipInput({ label = "Dip reading", cm, onChangeCm, onBlur, litres, reference, error }: DipInputProps) {
  return (
    <View className="gap-12">
      <NumericInput label={label} value={cm} onChangeText={onChangeCm} onBlur={onBlur} unit="cm" error={error} />
      {reference && !error ? <FieldHint>{reference}</FieldHint> : null}
      <AutoValueRow label="Dip in litres" value={litres ?? "—"} />
    </View>
  );
}
