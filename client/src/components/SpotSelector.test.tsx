// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpotSelector } from "./SpotSelector";

afterEach(cleanup);

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

function SessionForm({ savedSpot = "", onSave = vi.fn(), onChange = vi.fn() }) {
  const [spot, setSpot] = useState("");
  const [rating, setRating] = useState("3");
  useEffect(() => setSpot(savedSpot), [savedSpot]);
  return (
    <form onSubmit={event => { event.preventDefault(); onSave({ spot, rating }); }}>
      <SpotSelector value={spot} onChange={value => { onChange(value); setSpot(value); }} />
      <input aria-label="rating" value={rating} onChange={event => setRating(event.target.value)} />
      <button type="submit">Save</button>
    </form>
  );
}

describe("SpotSelector with real Radix selects", () => {
  it("preserves asynchronously loaded saved data and a rating-only save", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const { rerender } = render(<SessionForm onChange={onChange} onSave={onSave} />);
    expect(screen.getByRole("combobox", { name: "浪點" }).hasAttribute("disabled")).toBe(true);
    rerender(<SessionForm savedSpot="都蘭" onChange={onChange} onSave={onSave} />);
    expect(onChange).not.toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox", { name: "地區" }).textContent).toBe("東部");
    expect(screen.getByRole("combobox", { name: "浪點" }).textContent).toBe("都蘭");
    fireEvent.change(screen.getByLabelText("rating"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith({ spot: "都蘭", rating: "5" });
  });

  it("clears a spot on a user region change and allows picking a replacement", () => {
    render(<SessionForm savedSpot="都蘭" />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "地區" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "北部" }));
    expect(screen.getByRole("combobox", { name: "地區" }).textContent).toBe("北部");
    expect(screen.getByRole("combobox", { name: "浪點" }).textContent).toBe("選擇浪點");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "浪點" }), { key: "Enter" });
    expect(screen.queryByRole("option", { name: "都蘭" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "金山" }));
    expect(screen.getByRole("combobox", { name: "浪點" }).textContent).toBe("金山");
  });

  it("ignores empty native-select changes without losing the saved selection", () => {
    const onChange = vi.fn();
    const { container } = render(<SessionForm savedSpot="都蘭" onChange={onChange} />);
    container.querySelectorAll("select").forEach(select => {
      fireEvent.change(select, { target: { value: "" } });
    });
    expect(onChange).not.toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox", { name: "地區" }).textContent).toBe("東部");
    expect(screen.getByRole("combobox", { name: "浪點" }).textContent).toBe("都蘭");
  });

  it("leaves empty and unrecognized saved values untouched", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SessionForm onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: "浪點" }).textContent).toBe("請先選擇地區");
    rerender(<SessionForm savedSpot="舊浪點" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
