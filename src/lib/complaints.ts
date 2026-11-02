// Complaint rules that never depend on the AI: categories, safety escalation, urgency and response times.

export const CATEGORIES = ["Plumbing", "Electrical", "Lift", "Water supply", "Cleaning", "Security", "Parking", "Noise", "Pest control", "Civil", "Garden", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const URGENCIES = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"] as const;
export type Urgency = (typeof URGENCIES)[number];

// Minutes the help desk has to respond (assumption, labelled in the TDD).
const RESPONSE_MINUTES: Record<Urgency, number> = { EMERGENCY: 15, HIGH: 60, MEDIUM: 240, LOW: 1440 };
export const responseDue = (u: Urgency, from = new Date()) => new Date(from.getTime() + RESPONSE_MINUTES[u] * 60_000);

// Latin words use word boundaries. Devanagari (Marathi/Hindi) is matched as substrings: JS \b doesn't know Devanagari.
type Rule = { re: RegExp; deva: string[] };
const hits = (text: string, rule: Rule) => (text.match(new RegExp(rule.re, "gi"))?.length ?? 0) + rule.deva.filter((w) => text.includes(w)).length;

// Two kinds of danger, so the category follows the danger: fire and gas go to security, sparks and shocks to electrical.
const FIRE: Rule = { re: /\b(fire|smoke|burning|gas|aag|dhua+n?)\b/i, deva: ["आग", "धूर", "धुआं", "धुआँ", "गॅस", "गैस"] };
const SHOCK: Rule = { re: /\b(sparks?|sparking|shock|electrocut\w*|current lag\w*)\b/i, deva: ["शॉक", "करंट", "ठिणगी", "चिंगारी"] };
const STUCK: Rule = { re: /\b(stuck|trapped|fas\w*|phas\w*)\b/i, deva: ["अडक", "फंस", "फँस"] };
const LIFT: Rule = { re: /\b(lift|elevator)s?\b/i, deva: ["लिफ्ट"] };

/** Safety words escalate to the duty manager by rule, whatever the AI says. Returns why, or null. */
export function safetyReason(text: string): string | null {
  for (const rule of [FIRE, SHOCK]) {
    const word = text.match(rule.re)?.[0] ?? rule.deva.find((w) => text.includes(w));
    if (word) return `mentions "${word}"`;
  }
  if (hits(text, LIFT) && hits(text, STUCK)) return "someone may be stuck in a lift";
  return null;
}

// Order matters for ties: "water leaking" is plumbing, not water supply.
const RULES: [Category, Rule][] = [
  ["Lift", LIFT],
  ["Plumbing", { re: /\b(leak\w*|tap|pipe|drain\w*|choke?d?|block(ed|age)|flush|toilet|commode|basin|sink|overflow\w*|seepage|geyser|tapak\w*)\b/i, deva: ["गळती", "गळत", "नळ", "पाईप", "पाइप", "नल", "रिसाव", "टपक", "लीक", "ड्रेनेज"] }],
  ["Electrical", { re: /\b(lights?|switch\w*|power|electric\w*|socket|fan|wiring|mcb|trip\w*|bulb|meter|voltage|inverter|bijli)\b/i, deva: ["वीज", "बिजली", "लाइट", "लाईट", "पंखा", "स्विच", "वायरिंग"] }],
  ["Water supply", { re: /\b(no water|water supply|water pressure|low pressure|tank|paani|pani|water)\b/i, deva: ["पाणी", "पानी", "टाकी", "टंकी"] }],
  ["Cleaning", { re: /\b(garbage|trash|dirty|clean\w*|sweep\w*|waste|kachra|stink\w*|smell\w*)\b/i, deva: ["कचरा", "सफाई", "स्वच्छता", "घाण", "गंदगी", "दुर्गंध"] }],
  ["Security", { re: /\b(security|guard|theft|stolen|thief|stranger|suspicious|intruder|chori)\b/i, deva: ["चोरी", "सुरक्षा", "अनोळखी", "अजनबी"] }],
  ["Parking", { re: /\b(parking|parked|car|bike|scooter|vehicle)\b/i, deva: ["पार्किंग", "गाडी", "गाड़ी"] }],
  ["Noise", { re: /\b(noise|noisy|loud|music|speaker|party|barking)\b/i, deva: ["आवाज", "गोंगाट", "शोर"] }],
  ["Pest control", { re: /\b(pest|cockroach\w*|rats?|mice|mouse|mosquito\w*|termite\w*|bed ?bugs?|lizard)\b/i, deva: ["उंदीर", "चूहे", "चूहा", "डास", "मच्छर", "झुरळ", "कॉकरोच", "दीमक", "वाळवी"] }],
  ["Civil", { re: /\b(crack\w*|wall|plaster|ceiling|damp\w*|tiles?|door|window|grill|paint\w*|roof|terrace)\b/i, deva: ["भिंत", "तडा", "भेग", "सीलन", "दीवार", "छत", "खिडकी", "खिड़की", "दरवाजा", "दरवाज़"] }],
  ["Garden", { re: /\b(garden|trees?|plants?|grass|lawn|hedge|branch)\b/i, deva: ["बाग", "झाड", "पेड़", "गवत"] }],
];

const HIGH: Rule = { re: /\b(no water|no power|power cut|outage|overflow\w*|flood\w*|burst|urgent\w*|immediately|asap|since morning|whole floor|not working)\b/i, deva: ["पाणी नाही", "पानी नहीं", "बंद", "तातडीने", "तुरंत", "जल्दी"] };
const LOW: Rule = { re: /\b(request|suggest\w*|whenever|not urgent|minor|when possible)\b/i, deva: ["विनंती", "सुझाव"] };

export type RuleResult = { category: Category; urgency: Urgency; safety: string | null; confident: boolean };

/** Keyword triage: instant, works offline, and the fallback whenever the AI is down or unsure. */
export function classifyByRules(text: string): RuleResult {
  const scored = RULES.map(([category, rule]) => ({ category, n: hits(text, rule) })).filter((s) => s.n > 0);
  const best = scored.reduce<(typeof scored)[number] | undefined>((a, s) => (!a || s.n > a.n ? s : a), undefined);
  const safety = safetyReason(text);
  // A gas smell is a security emergency, not cleaning, whatever else the words say; a spark is electrical.
  const danger: Category | null = hits(text, FIRE) ? "Security" : hits(text, SHOCK) ? "Electrical" : null;
  const category: Category = danger ?? best?.category ?? "Other";
  let urgency: Urgency = hits(text, LOW) ? "LOW" : "MEDIUM";
  if (hits(text, HIGH) || ["Lift", "Water supply", "Security"].includes(category)) urgency = "HIGH";
  if (safety) urgency = "EMERGENCY";
  const runnerUp = scored.filter((s) => s !== best).some((s) => s.n === best?.n);
  return { category, urgency, safety, confident: !!danger || (!!best && !runnerUp) };
}

/** Which technician team takes a category. Parking and noise go to security; "Other" waits for the help desk. */
export const teamFor = (c: Category): Category | null => (c === "Parking" || c === "Noise" ? "Security" : c === "Other" ? null : c);

export const URGENCY_LABEL: Record<Urgency, string> = { EMERGENCY: "Emergency", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
