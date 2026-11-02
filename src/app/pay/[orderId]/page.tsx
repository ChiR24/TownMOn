import { eq } from "drizzle-orm";
import { CreditCard, Landmark, LockKeyhole, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { btn, cx } from "@/components/ui";
import { db } from "@/db";
import { gatewayOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { TOWNSHIP } from "@/lib/config";
import { rupees } from "@/lib/money";

export const metadata: Metadata = { title: "TestPay checkout" };

const METHODS = [
  { value: "UPI", label: "UPI", detail: "Google Pay, PhonePe, Paytm, BHIM", icon: Smartphone },
  { value: "CARD", label: "Debit or credit card", detail: "Visa, Mastercard, RuPay", icon: CreditCard },
  { value: "NETBANKING", label: "Net banking", detail: "All major banks", icon: Landmark },
];

// A stand-in for a real gateway's hosted checkout page (test mode). A plain HTML form, so the browser does
// real page redirects back to us, as it would with a real gateway.
export default async function GatewayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser(["RESIDENT"]);
  const { orderId } = await params;
  const [o] = await db.select().from(gatewayOrders).where(eq(gatewayOrders.id, orderId));
  if (!o || o.createdBy !== user.id) notFound();
  if (o.status === "PAID") redirect(`/receipts/${o.paymentId}`);
  if (o.status === "FAILED") redirect("/bills/pay?failed=1");

  return (
    // A third-party gateway's page: its own fixed light look, whatever the device's mode (see .theme-light).
    <main className="theme-light min-h-dvh bg-slate-100">
      <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">TestPay sandbox · test mode, no real money moves</div>
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-slate-900 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-wide text-slate-400">Paying</p>
            <p className="text-[15px] font-medium">{TOWNSHIP} Residents&apos; Federation</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{rupees(o.amount)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Maintenance for {o.flatId} · {o.id}
            </p>
          </div>
          <form method="post" action={`/api/gateway/${o.id}`} className="space-y-3 p-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-slate-700">Pay with</legend>
              {METHODS.map(({ value, label, detail, icon: Icon }, i) => (
                <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 has-[:checked]:ring-2 has-[:checked]:ring-slate-900">
                  <input type="radio" name="method" value={value} defaultChecked={i === 0} className="size-4 accent-slate-900" />
                  <Icon className="size-5 text-slate-500" aria-hidden />
                  <span>
                    <span className="block text-[15px] font-medium text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">{detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" name="outcome" value="ok" className={cx(btn({ size: "lg" }), "w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950")}>
              Pay {rupees(o.amount)}
            </button>
            <button type="submit" name="outcome" value="fail" className={cx(btn({ variant: "ghost", size: "sm" }), "w-full text-slate-500")}>
              Simulate a failed payment
            </button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-400">
              <LockKeyhole className="size-3.5" aria-hidden /> Secured by TestPay
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
