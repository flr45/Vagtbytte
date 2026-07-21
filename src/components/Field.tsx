export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
  autoComplete
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      <input
        autoComplete={autoComplete}
        className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked = false
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 text-sm font-semibold text-zinc-800">
      <input
        className="h-5 w-5 accent-brand-red"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}
