import { describe, expect, it } from "vitest";
import { bookingError, canCancel, fmtMinute, slotsFor, weekOf } from "./amenities";

const tennis = { slotMinutes: 60, openMinute: 360, closeMinute: 1320, maxPerWeek: 3, advanceDays: 7 };
const ok = { date: "2026-11-04", startMinute: 420, today: "2026-11-02", nowMinute: 600, bookedThisWeek: 0, daysOverdue: 0 };

describe("amenity booking rules", () => {
  it("offers hourly slots from 6 am to 10 pm", () => {
    expect(slotsFor(tennis)).toHaveLength(16);
    expect(fmtMinute(360)).toBe("6 am");
    expect(fmtMinute(1290)).toBe("9:30 pm");
  });

  it("accepts a normal booking", () => expect(bookingError(tennis, ok)).toBeNull());

  it("refuses past slots, slots outside the window, odd start times", () => {
    expect(bookingError(tennis, { ...ok, date: "2026-11-02", startMinute: 540 })).toBe("past");
    expect(bookingError(tennis, { ...ok, date: "2026-11-10" })).toBe("window");
    expect(bookingError(tennis, { ...ok, startMinute: 450 })).toBe("slot");
  });

  it("enforces the weekly limit and the dues rule", () => {
    expect(bookingError(tennis, { ...ok, bookedThisWeek: 3 })).toBe("limit");
    expect(bookingError(tennis, { ...ok, daysOverdue: 61 })).toBe("dues");
    expect(bookingError(tennis, { ...ok, daysOverdue: 60 })).toBeNull();
  });

  it("counts weeks Monday to Sunday", () => {
    expect(weekOf("2026-11-04")).toEqual(["2026-11-02", "2026-11-08"]);
    expect(weekOf("2026-11-08")).toEqual(["2026-11-02", "2026-11-08"]);
  });

  it("allows cancelling only 24 hours ahead", () => {
    const now = new Date("2026-11-03T07:00:00+05:30");
    expect(canCancel("2026-11-04", 420, now)).toBe(true);
    expect(canCancel("2026-11-04", 360, now)).toBe(false);
  });
});
