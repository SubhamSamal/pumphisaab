import { NamePicker } from "./NamePicker";
import { useAddCustomer, type Customer } from "./queries";

/**
 * Company box for credit slips and customer payments (PRD F7 "searchable + add new", D50, D68):
 * type a letter to see the matching companies; a new company can be added from the last row.
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
  return (
    <NamePicker
      label="Company"
      placeholder="Type the company name"
      addWord="company"
      // Companies: nothing until a letter is typed (owner, 09 Oct: two names shown at once confused managers).
      byDefault={0}
      items={customers}
      value={value}
      onChange={onChange}
      onAdd={(name) => add.mutateAsync(name)}
      adding={add.isPending}
      addError={add.error?.message}
      error={error}
      disabled={disabled}
    />
  );
}
