import { NamePicker } from "./NamePicker";
import { useAddCustomer, type Customer } from "./queries";

/**
 * Company box for credit slips and customer payments (PRD F7 "searchable + add new", D50, D68):
 * the 2 most used show; type to find the rest; a new company can be added from the last row.
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
