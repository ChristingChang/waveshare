// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionConditions } from "./SessionConditions";
import { SurfHourSelect } from "./SurfHourSelect";
import type { ConditionsSnapshot } from "@shared/surfConditions";

afterEach(cleanup);
const snapshot: ConditionsSnapshot = {
  v: 1,
  mode: "daytime",
  hour: null,
  waveHeight: { min: 1, max: 2, source: "中央氣象署" },
  wavePeriod: null,
  swellDirection: { degrees: 45, source: "Open-Meteo" },
  windSpeed: null,
  windDirection: null,
  tides: [{ time: "03:12", type: "high", source: "中央氣象署" }],
  fetchedAt: "2026-11-22T01:00:00Z",
};
describe("condition row", () => {
  it("rounds legacy fractional degrees to integer bearings", () => {
    render(<SessionConditions conditions={JSON.stringify({...snapshot, swellDirection: {degrees: 36.4, source: "Open-Meteo"}})} />);
    expect(screen.getByText("湧浪 東北 36°")).toBeTruthy();
    expect(screen.queryByText(/36\.4°/)).toBeNull();
  });
  it("supports readable inverse colors and full-width grid placement", () => {
    const { container } = render(<SessionConditions conditions={JSON.stringify(snapshot)} className="col-span-2 text-primary-foreground/90" />);
    expect(container.firstElementChild?.classList.contains("text-muted-foreground")).toBe(false);
    expect(container.firstElementChild?.classList.contains("text-primary-foreground/90")).toBe(true);
    expect(container.firstElementChild?.classList.contains("col-span-2")).toBe(true);
  });
  it("renders compact values, source titles, tide times and daytime mode", () => {
    render(<SessionConditions conditions={JSON.stringify(snapshot)} />);
    expect(screen.getByText("浪高 1–2 m").title).toBe("中央氣象署");
    expect(screen.getByText("湧浪 東北 45°").title).toBe("Open-Meteo");
    expect(screen.getByText("滿潮 03:12")).toBeTruthy();
    expect(screen.getByText(/06:00–18:00/)).toBeTruthy();
    expect(screen.queryByText(/週期/)).toBeNull();
    expect(screen.queryByText(/風速/)).toBeNull();
  });
  it("shows selected hour and omits empty, corrupt and unsupported snapshots", () => {
    const { rerender, container } = render(
      <SessionConditions
        conditions={JSON.stringify({ ...snapshot, mode: "hour", hour: 7 })}
      />
    );
    expect(screen.getByText(/07:00/)).toBeTruthy();
    for (const conditions of [
      null,
      "not JSON",
      JSON.stringify({ v: 2 }),
      JSON.stringify({
        ...snapshot,
        waveHeight: null,
        swellDirection: null,
        tides: [],
      }),
    ]) {
      rerender(<SessionConditions conditions={conditions} />);
      expect(container.innerHTML).toBe("");
    }
  });
});
it("lets users choose any local hour or clear it", () => {
  const change = vi.fn();
  render(<SurfHourSelect value={null} onChange={change} />);
  expect(screen.getAllByRole("option")).toHaveLength(25);
  const select = screen.getByLabelText("幾點下水（選填）");
  fireEvent.change(select, { target: { value: "0" } });
  expect(change).toHaveBeenLastCalledWith(0);
  fireEvent.change(select, { target: { value: "23" } });
  expect(change).toHaveBeenLastCalledWith(23);
  fireEvent.change(select, { target: { value: "" } });
  expect(change).toHaveBeenLastCalledWith(null);
});
