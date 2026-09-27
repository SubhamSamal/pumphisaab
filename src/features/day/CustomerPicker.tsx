import { useState } from "react";
import { View } from "react-native";
import { FieldError, Icon, SuggestList, TextField } from "@/components/ui";
import { matchCustomers, normName as norm } from "./customers";
import { useAddCustomer, type Customer } from "./queries";

/**
 * Company box for credit slips and customer payments (PRD F7 "searchable + add new", D50, D68):
 * type a few letters and the list under the box shows the companies that match; tap one. If no
 * company has exactly that name, the last row adds it.
 */
export function CustomerPicker({
  pumpId,
  customers,
  value,
  onChange,
  error,
  disabled,
}: {
  pumpId: string;
  customers: Customer[];
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  disabled?: boolean;
}) {
  const add = useAddCustomer(pumpId);
  const chosen = customers.find((c) => c.id === value);
  const [text, setText] = useState(chosen?.name ?? "");
  // The form set or cleared the company itself (e.g. the payment sheet opened for another row).
  const [last, setLast] = useState({ value, name: chosen?.name ?? "" });
  if (value !== last.value || (chosen && chosen.name !== last.name)) {
    setLast({ value, name: chosen?.name ?? "" });
    if (chosen && norm(text) !== norm(chosen.name)) setText(chosen.name);
    if (!value && last.value && norm(text) === norm(last.name)) setText("");
  }
  // The list shows while picking: nothing chosen yet, or the name was changed.
  const picking = !disabled && (!chosen || norm(text) !== norm(chosen.name));
  const matches = matchCustomers(customers, text);
  const exact = customers.some((c) => norm(c.name) === norm(text));
  const typed = text.trim().replace(/\s+/g, " ");

  const pick = (id: string, name: string) => {
    onChange(id);
    setText(name);
  };

  return (
    <View className="gap-8">
      <TextField
        label="Company"
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (chosen && norm(v) !== norm(chosen.name)) onChange(null);
        }}
        placeholder="Type the company name"
        capitalize="words"
        disabled={disabled}
        right={chosen && !picking ? <Icon name="check" color="primary" /> : undefined}
      />
      {picking ? (
        <SuggestList
          items={matches.map((c) => ({ id: c.id, label: c.name, selected: c.id === value }))}
          onPick={(id) => pick(id, customers.find((c) => c.id === id)?.name ?? "")}
          addLabel={`Add “${typed}” as a new company`}
          onAdd={typed && !exact ? () => add.mutate(typed, { onSuccess: (id) => pick(id, typed) }) : undefined}
          adding={add.isPending}
        />
      ) : null}
      {add.error ? <FieldError message={add.error.message} /> : error ? <FieldError message={error} /> : null}
    </View>
  );
}
