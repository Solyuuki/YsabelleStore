import { Minus, Plus } from "lucide-react";

export function QuantityControl({
  label,
  max,
  value,
  onChange
}: {
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="customer-quantity" aria-label={label} role="group">
      <button
        aria-label={`Decrease ${label}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        <Minus aria-hidden="true" size={15} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        max={max}
        min={1}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
        type="number"
        value={value}
      />
      <button
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        <Plus aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
