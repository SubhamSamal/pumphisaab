import { useState } from "react";
import { View } from "react-native";
import { Button, Chip, ChipGroup, FieldError, FieldHint, TextField } from "@/components/ui";
import { useAddCustomer, type Customer } from "./queries";

/**
 * Company box for credit slips and customer payments (PRD F7 "searchable + add new", D50):
 * type a few letters, tap the company; a name that isn't there yet can be added on the spot.
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
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const add = useAddCustomer(pumpId);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(!value);
  const chosen = customers.find((c) => c.id === value);

  if (chosen && !open) {
    return (
      <View className="gap-4">
        <ChipGroup>
          <Chip label={chosen.name} selected onPress={disabled ? undefined : () => setOpen(true)} />
        </ChipGroup>
        {!disabled ? <FieldHint>Tap the name to change it.</FieldHint> : null}
      </View>
    );
  }

  const term = search.trim().toLowerCase();
  const matches = customers.filter((c) => c.isActive && (!term || c.name.toLowerCase().includes(term))).slice(0, 8);
  const exact = customers.some((c) => c.name.trim().toLowerCase() === term);

  return (
    <View className="gap-8">
      <TextField label="Company" value={search} onChangeText={setSearch} placeholder="Type to search" capitalize="words" disabled={disabled} />
      {matches.length > 0 ? (
        <ChipGroup>
          {matches.map((c) => (
            <Chip
              key={c.id}
              small
              label={c.name}
              selected={c.id === value}
              onPress={() => {
                onChange(c.id);
                setSearch("");
                setOpen(false);
              }}
            />
          ))}
        </ChipGroup>
      ) : term ? (
        <FieldHint>No company with that name yet.</FieldHint>
      ) : null}
      {term && !exact ? (
        <Button
          label={`Add “${search.trim()}” as a new company`}
          icon="plus"
          size="M"
          variant="secondary"
          loading={add.isPending}
          onPress={() =>
            add.mutate(search.trim(), {
              onSuccess: (id) => {
                onChange(id);
                setSearch("");
                setOpen(false);
              },
            })
          }
        />
      ) : null}
      {add.error ? <FieldError message={add.error.message} /> : error ? <FieldError message={error} /> : null}
    </View>
  );
}
