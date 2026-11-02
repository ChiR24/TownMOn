// Demo helpers (OTP on screen, one-tap logins, sample bank statement) are on by default locally, off in
// production unless DEMO_MODE=true is set explicitly.
export const DEMO_MODE = process.env.DEMO_MODE ? process.env.DEMO_MODE === "true" : process.env.NODE_ENV !== "production";

export const TOWNSHIP = "Company A Township";

export const DEMO_ACCOUNTS = [
  { phone: "9800000001", name: "Neeraj Kulkarni", role: "Resident", note: "T07-1203 · all paid" },
  { phone: "9800000002", name: "Swati Joshi", role: "Resident (tenant)", note: "T12-0408 · 47 days overdue" },
  { phone: "9800000003", name: "Aamir Shaikh", role: "Resident", note: "T21-1601 · part paid" },
  { phone: "9800000010", name: "Rohan Patil", role: "Help desk", note: "Complaints queue" },
  { phone: "9800000011", name: "Sunita Deshmukh", role: "Accounts", note: "Bank matching" },
  { phone: "9800000012", name: "Col. Vijay Rao", role: "Committee", note: "Dashboard and report" },
  { phone: "9800000013", name: "Anil Jadhav", role: "Duty manager", note: "Sees every staff area" },
  { phone: "9800000014", name: "Ramesh Pawar", role: "Guard", note: "Gate tablet" },
] as const;
