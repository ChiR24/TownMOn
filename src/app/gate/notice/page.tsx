import type { Metadata } from "next";
import { PrintButton } from "@/app/receipts/[id]/print-button";
import { Logo } from "@/components/brand";
import { TOWNSHIP } from "@/lib/config";

export const metadata: Metadata = { title: "Notice for visitors" };

const TEXT = [
  {
    lang: "en",
    title: "Notice to visitors",
    body: [
      "For everyone's safety, the guard records your name, the flat you are visiting and a photo, and asks the resident to let you in.",
      "Photos are deleted automatically after 90 days. Only the residents you visit, the guards and the help desk can see them.",
      "To ask about your data, contact the help desk at the clubhouse.",
    ],
  },
  {
    lang: "mr",
    title: "पाहुण्यांसाठी सूचना",
    body: [
      "सर्वांच्या सुरक्षेसाठी गार्ड तुमचे नाव, तुम्ही ज्या फ्लॅटला भेट देत आहात तो फ्लॅट आणि तुमचा फोटो नोंदवतो आणि रहिवाशाची परवानगी घेतो.",
      "फोटो 90 दिवसांनी आपोआप हटवले जातात. ते फक्त तुम्ही भेटत असलेले रहिवासी, गार्ड आणि हेल्प डेस्क पाहू शकतात.",
      "तुमच्या माहितीबद्दल विचारण्यासाठी क्लबहाउसमधील हेल्प डेस्कशी संपर्क करा.",
    ],
  },
  {
    lang: "hi",
    title: "मेहमानों के लिए सूचना",
    body: [
      "सबकी सुरक्षा के लिए गार्ड आपका नाम, जिस फ्लैट में आप जा रहे हैं वह फ्लैट और आपकी फ़ोटो दर्ज करता है और निवासी से अनुमति लेता है।",
      "फ़ोटो 90 दिन बाद अपने-आप हटा दी जाती हैं। इन्हें सिर्फ़ आपके मेज़बान निवासी, गार्ड और हेल्प डेस्क देख सकते हैं।",
      "अपनी जानकारी के बारे में पूछने के लिए क्लबहाउस में हेल्प डेस्क से संपर्क करें।",
    ],
  },
];

/** The DPDP Act 2023 notice for the gates. Print it A4 and put it up at all four. */
export default function GateNoticePage() {
  return (
    <main className="mx-auto max-w-2xl bg-white px-8 py-10 text-zinc-900 print:max-w-none print:p-0">
      <div className="flex items-center gap-3">
        <Logo className="size-12" />
        <p className="text-xl font-semibold">{TOWNSHIP}</p>
      </div>
      {TEXT.map((x) => (
        <section key={x.lang} lang={x.lang} className="mt-8 border-t border-zinc-200 pt-6">
          <h1 className="text-3xl font-bold">{x.title}</h1>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-lg leading-relaxed">
            {x.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      <div className="no-print mt-10">
        <PrintButton />
      </div>
    </main>
  );
}
