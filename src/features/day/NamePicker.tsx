import { useState } from "react";
import { View } from "react-native";
import { FieldError, Icon, SuggestList, TextField } from "@/components/ui";
import { matchNamed, normName as norm, type Named } from "./customers";

/**
 * Pick one name from a list that keeps growing (companies, expense types; D68, owner 29 Sep):
 * the 2 most used show under the box; typing shows the matches; a name that isn't there yet can
 * be added from the last row. Changing the name after picking un-picks it.
 */
export function NamePicker({
  label,
  placeholder,
  addWord,
  items,
  value,
  onChange,
  onAdd,
  adding,
  addError,
  error,
  disabled,
}: {
  label: string;
  placeholder: string;
  /** "company" → `Add “ABCD” as a new company`. */
  addWord: string;
  items: Named[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Adds the name and gives back its id; left out = can't add here. */
  onAdd?: (name: string) => Promise<string>;
  adding?: boolean;
  addError?: string;
  error?: string;
  disabled?: boolean;
}) {
  const chosen = items.find((c) => c.id === value);
  const [text, setText] = useState(chosen?.name ?? "");
  // The form set or cleared the value itself (e.g. a sheet opened for another row).
  const [last, setLast] = useState({ value, name: chosen?.name ?? "" });
  if (value !== last.value || (chosen && chosen.name !== last.name)) {
    setLast({ value, name: chosen?.name ?? "" });
    if (chosen && norm(text) !== norm(chosen.name)) setText(chosen.name);
    if (!value && last.value && norm(text) === norm(last.name)) setText("");
  }
  const picking = !disabled && (!chosen || norm(text) !== norm(chosen.name));
  const matches = matchNamed(items, text);
  const exact = items.some((c) => norm(c.name) === norm(text));
  const typed = text.trim().replace(/\s+/g, " ");

  const pick = (id: string, name: string) => {
    onChange(id);
    setText(name);
  };

  return (
    <View className="gap-8">
      <TextField
        label={label}
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (chosen && norm(v) !== norm(chosen.name)) onChange(null);
        }}
        placeholder={placeholder}
        capitalize="words"
        disabled={disabled}
        right={chosen && !picking ? <Icon name="check" color="primary" /> : undefined}
      />
      {picking ? (
        <SuggestList
          items={matches.map((c) => ({ id: c.id, label: c.name, selected: c.id === value }))}
          onPick={(id) => pick(id, items.find((c) => c.id === id)?.name ?? "")}
          addLabel={`Add “${typed}” as a new ${addWord}`}
          onAdd={onAdd && typed && !exact ? () => onAdd(typed).then((id) => pick(id, typed)).catch(() => {}) : undefined}
          adding={adding}
        />
      ) : null}
      {addError ? <FieldError message={addError} /> : error ? <FieldError message={error} /> : null}
    </View>
  );
}
