// Demo helpers (OTP on screen, one-tap logins, sample bank statement) are on by default locally, off in
// production unless DEMO_MODE=true is set explicitly.
export const DEMO_MODE = process.env.DEMO_MODE ? process.env.DEMO_MODE === "true" : process.env.NODE_ENV !== "production";

export const TOWNSHIP = "Company A Township";

// Which seeded people the sign-in screen offers as one-tap demo logins. Their names, flats and dues are read
// from the database, so the list can never disagree with the data.
export const DEMO_PHONES = ["9800000001", "9800000002", "9800000003", "9800000010", "9800000011", "9800000012", "9800000013", "9800000014"];
