import { Minus, Plus } from "lucide-react";

export function QuantityControl({
  label,
  max,
  min = 1,
  value,
  onChange
}: {
  label: string;
  max: number;
  min?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="customer-quantity" aria-label={label} role="group">
      <button
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        type="button"
      >
        <Minus aria-hidden="true" size={15} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? Math.min(max, Math.max(min, nextValue)) : min);
        }}
        type="number"
        value={value}
      />
      <button
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        type="button"
      >
        <Plus aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
