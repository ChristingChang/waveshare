export function SurfHourSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (hour: number | null) => void;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span>幾點下水（選填）</span>
      <select
        aria-label="幾點下水（選填）"
        className="block w-full rounded-md border bg-background px-3 py-2"
        value={value ?? ""}
        onChange={event =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value)
          )
        }
      >
        <option value="">不填</option>
        {Array.from({ length: 24 }, (_, hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}
