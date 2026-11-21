// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpotSelector } from "./SpotSelector";

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>
      <option value="">選擇</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

afterEach(cleanup);

function SessionForm({ savedSpot = "都蘭", onSave = vi.fn() }) {
  const [spot, setSpot] = useState(savedSpot);
  const [rating, setRating] = useState("3");
  return (
    <form onSubmit={event => { event.preventDefault(); onSave({ spot, rating }); }}>
      <SpotSelector value={spot} onChange={setSpot} />
      <input aria-label="rating" value={rating} onChange={event => setRating(event.target.value)} />
      <button type="submit">Save</button>
    </form>
  );
}

describe("SpotSelector", () => {
  it("preserves a saved spot when only the rating changes and the form is saved", () => {
    const onSave = vi.fn();
    render(<SessionForm onSave={onSave} />);
    const [region, spot] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(region.value).toBe("東部");
    expect(spot.value).toBe("都蘭");
    fireEvent.change(screen.getByLabelText("rating"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith({ spot: "都蘭", rating: "5" });
  });

  it("initializes from asynchronously loaded saved data without clearing it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SpotSelector value="" onChange={onChange} />);
    expect((screen.getAllByRole("combobox")[1] as HTMLSelectElement).disabled).toBe(true);
    rerender(<SpotSelector value="都蘭" onChange={onChange} />);
    expect((screen.getAllByRole("combobox")[1] as HTMLSelectElement).value).toBe("都蘭");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the saved spot on a user region change and allows a new spot", () => {
    render(<SessionForm />);
    const [region, spot] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    fireEvent.change(region, { target: { value: "北部" } });
    expect(spot.value).toBe("");
    expect(spot.querySelector('option[value="都蘭"]')).toBeNull();
    fireEvent.change(spot, { target: { value: "金山" } });
    expect(spot.value).toBe("金山");
  });

  it("does not erase an unrecognized saved spot", () => {
    const onChange = vi.fn();
    render(<SpotSelector value="舊浪點" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
