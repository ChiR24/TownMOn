// Gate tablet words in English, Marathi and Hindi (guards switch from the header). Drafted; to be checked by native speakers.
export const GATE_TEXT = {
  en: {
    gate: "Gate", online: "Online", offline: "Offline: entries are saved on this tablet", toSync: "{n} to sync", newVisitor: "New visitor", guestCode: "Guest code",
    waiting: "Waiting for the resident", inside: "Inside now", letIn: "Let in", doNotLetIn: "Do not let in", left: "Left", noAnswer: "No answer? Call on the intercom",
    approvedCall: "Approved on call", deniedCall: "Denied on call", approved: "Resident approved", denied: "Resident denied", savedHere: "Saved on tablet",
    photo: "Take photo", retake: "Retake", flat: "Flat", flatHint: "e.g. T07-1203", noFlat: "No such flat", name: "Visitor's name", phone: "Phone (optional)",
    ask: "Ask resident", cancel: "Cancel", enterCode: "Enter the guest's 6-digit code", check: "Check code", codeOk: "Valid code: {name} for {flat}. Let them in.",
    codeBad: "Code not valid. Call the resident on the intercom.", codeUsed: "This code has already been used.", codeExpired: "This code has expired.",
    notice: "Visitors are photographed for security. Photos are deleted after 90 days.", nobody: "Nobody waiting.", nobodyInside: "No visitors inside.", min: "{n} min", purposeLabel: "Purpose",
    GUEST: "Guest", DELIVERY: "Delivery", CAB: "Cab", SERVICE: "Service", OTHER: "Other", sent: "Sent to the residents of {flat}", noticeLink: "Gate notice",
  },
  mr: {
    gate: "गेट", online: "ऑनलाइन", offline: "ऑफलाइन: नोंदी या टॅबलेटवर जतन होतात", toSync: "{n} पाठवायच्या बाकी", newVisitor: "नवीन पाहुणा", guestCode: "पाहुणा कोड",
    waiting: "रहिवाशाच्या उत्तराची वाट", inside: "सध्या आत", letIn: "आत सोडा", doNotLetIn: "आत सोडू नका", left: "गेले", noAnswer: "उत्तर नाही? इंटरकॉमवर फोन करा",
    approvedCall: "फोनवर परवानगी", deniedCall: "फोनवर नकार", approved: "रहिवाशाने परवानगी दिली", denied: "रहिवाशाने नकार दिला", savedHere: "टॅबलेटवर जतन",
    photo: "फोटो काढा", retake: "पुन्हा काढा", flat: "फ्लॅट", flatHint: "उदा. T07-1203", noFlat: "असा फ्लॅट नाही", name: "पाहुण्याचे नाव", phone: "फोन (ऐच्छिक)",
    ask: "रहिवाशाला विचारा", cancel: "रद्द", enterCode: "पाहुण्याचा 6 अंकी कोड टाका", check: "कोड तपासा", codeOk: "कोड बरोबर: {flat} साठी {name}. आत सोडा.",
    codeBad: "कोड चुकीचा. रहिवाशाला इंटरकॉमवर फोन करा.", codeUsed: "हा कोड आधीच वापरला आहे.", codeExpired: "या कोडची मुदत संपली आहे.",
    notice: "सुरक्षेसाठी पाहुण्यांचे फोटो घेतले जातात. फोटो 90 दिवसांनी हटवले जातात.", nobody: "कोणी थांबलेले नाही.", nobodyInside: "आत कोणी पाहुणे नाहीत.", min: "{n} मि.", purposeLabel: "कारण",
    GUEST: "पाहुणा", DELIVERY: "डिलिव्हरी", CAB: "कॅब", SERVICE: "सेवा", OTHER: "इतर", sent: "{flat} च्या रहिवाशांना कळवले", noticeLink: "गेट सूचना",
  },
  hi: {
    gate: "गेट", online: "ऑनलाइन", offline: "ऑफलाइन: एंट्री इस टैबलेट पर सेव हो रही हैं", toSync: "{n} भेजनी बाकी", newVisitor: "नया मेहमान", guestCode: "मेहमान कोड",
    waiting: "निवासी के जवाब का इंतज़ार", inside: "अभी अंदर", letIn: "अंदर जाने दें", doNotLetIn: "अंदर न जाने दें", left: "चले गए", noAnswer: "जवाब नहीं? इंटरकॉम पर बात करें",
    approvedCall: "फ़ोन पर मंज़ूरी", deniedCall: "फ़ोन पर मना", approved: "निवासी ने मंज़ूरी दी", denied: "निवासी ने मना किया", savedHere: "टैबलेट पर सेव",
    photo: "फ़ोटो लें", retake: "दोबारा लें", flat: "फ्लैट", flatHint: "जैसे T07-1203", noFlat: "ऐसा कोई फ्लैट नहीं", name: "मेहमान का नाम", phone: "फ़ोन (वैकल्पिक)",
    ask: "निवासी से पूछें", cancel: "रद्द", enterCode: "मेहमान का 6 अंकों का कोड डालें", check: "कोड जाँचें", codeOk: "सही कोड: {flat} के लिए {name}। अंदर जाने दें।",
    codeBad: "कोड सही नहीं। निवासी को इंटरकॉम पर फ़ोन करें।", codeUsed: "यह कोड पहले ही इस्तेमाल हो चुका है।", codeExpired: "इस कोड की समय-सीमा खत्म हो गई है।",
    notice: "सुरक्षा के लिए मेहमानों की फ़ोटो ली जाती है। फ़ोटो 90 दिन बाद हटा दी जाती हैं।", nobody: "कोई इंतज़ार में नहीं।", nobodyInside: "अंदर कोई मेहमान नहीं।", min: "{n} मि.", purposeLabel: "वजह",
    GUEST: "मेहमान", DELIVERY: "डिलीवरी", CAB: "कैब", SERVICE: "सर्विस", OTHER: "अन्य", sent: "{flat} के निवासियों को भेजा गया", noticeLink: "गेट सूचना",
  },
} as const;
export type GateLang = keyof typeof GATE_TEXT;
export type GateKey = keyof (typeof GATE_TEXT)["en"];
