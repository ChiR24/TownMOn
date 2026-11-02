import { describe, expect, it } from "vitest";
import { classifyByRules, responseDue, safetyReason } from "./complaints";

describe("safety escalation (always on, whatever the AI says)", () => {
  it("catches safety words in English, Marathi and Hindi", () => {
    expect(safetyReason("There is a smell of gas near the meter room")).toBeTruthy();
    expect(safetyReason("Fire in the T09 electrical duct")).toBeTruthy();
    expect(safetyReason("Got a shock from the switch board")).toBeTruthy();
    expect(safetyReason("Lift stuck between 7th and 8th floor, my father is inside")).toBeTruthy();
    expect(safetyReason("लिफ्टमध्ये आजोबा अडकले आहेत")).toBeTruthy(); // Marathi: grandfather is stuck in the lift
    expect(safetyReason("मीटर के पास से धुआं निकल रहा है")).toBeTruthy(); // Hindi: smoke near the meter
    expect(safetyReason("aag lagi hai parking mein")).toBeTruthy(); // Hinglish
  });

  it("does not escalate ordinary complaints", () => {
    expect(safetyReason("Lift not working since morning")).toBeNull();
    expect(safetyReason("नळ अडकला आहे")).toBeNull(); // "the tap is stuck": stuck, but not a lift
    expect(safetyReason("Water leaking from the bathroom ceiling")).toBeNull();
  });
});

describe("keyword triage", () => {
  it("reads a sample complaint", () => {
    expect(classifyByRules("Water leaking from the bathroom ceiling, coming from the flat above")).toMatchObject({ category: "Plumbing", urgency: "MEDIUM", safety: null });
  });

  it("reads Marathi and Hindi", () => {
    expect(classifyByRules("आमच्या मजल्यावर पाणी नाही").category).toBe("Water supply");
    expect(classifyByRules("सीढ़ियों पर बहुत कचरा पड़ा है").category).toBe("Cleaning");
  });

  it("makes lift, water and security complaints high, and safety an emergency", () => {
    expect(classifyByRules("Lift in T14 not working").urgency).toBe("HIGH");
    expect(classifyByRules("Sparking from the main switch").urgency).toBe("EMERGENCY");
    expect(classifyByRules("Request to trim the garden hedge when possible").urgency).toBe("LOW");
  });

  it("says when it is unsure, so the help desk triages it", () => {
    expect(classifyByRules("Please look into this issue").confident).toBe(false);
    expect(classifyByRules("Please look into this issue").category).toBe("Other");
  });
});

describe("response times", () => {
  it("gives emergencies 15 minutes", () => {
    const t = new Date("2026-11-02T10:00:00Z");
    expect(responseDue("EMERGENCY", t).toISOString()).toBe("2026-11-02T10:15:00.000Z");
  });
});
