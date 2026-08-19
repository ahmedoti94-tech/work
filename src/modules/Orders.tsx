import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fmtDateShort, fmtMoney, waLink } from "../lib/payroll";
import { PAY_AR, STATUS_AR, useStore } from "../lib/store";
import type { Order, OrderStatus } from "../lib/types";
import { Badge, Btn, Icon, SectionHead, type BadgeTone } from "../components/ui";

const STAGES: OrderStatus[] = ["pending", "baking", "shipped", "delivered"];
const STAGE_LABEL: Record<OrderStatus, string> = {
  pending: "قيد المراجعة", baking: "الخبز والتعبئة", shipped: "تم الشحن", delivered: "تم التسليم",
};

function StageSteps({ order }: { order: Order }) {
  const idx = STAGES.indexOf(order.status);
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => (
        <div key={s} className={`flex items-center ${i < STAGES.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
              i < idx ? "border-sage bg-sage text-cream" : i === idx ? "border-brand bg-brand text-cream" : "border-line bg-raise text-mute"
            }`}>
              {i < idx ? <Icon name="check" size={14} /> : <Icon name={s === "pending" ? "clock" : s === "baking" ? "oven" : s === "shipped" ? "truck" : "pin"} size={14} />}
            </span>
            <span className={`whitespace-nowrap text-[10px] font-bold ${i <= idx ? "text-ink" : "text-mute"}`}>{STAGE_LABEL[s]}</span>
          </div>
          {i < STAGES.length - 1 && (
            <div className="relative mx-1 mb-4 h-0.5 flex-1 overflow-hidden rounded bg-line">
              {i < idx && <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.5 }} className="absolute inset-y-0 start-0 bg-sage" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Orders() {
  const { orders, products, advanceOrder, user } = useStore();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [open, setOpen] = useState<string | null>(orders[0]?.id ?? null);
  const canManage = user.role === "sales" || user.role === "super" || user.role === "production";

  const list = orders.filter((o) => filter === "all" || o.status === filter);

  const notifyClient = (o: Order) => {
    const text =
      `تحديث طلبكم ${o.id} — مصنع أوفنرايت\n\n` +
      `الحالة الحالية: ${STATUS_AR[o.status]}\n` +
      (o.status === "delivered"
        ? "تم تسليم الطلب — نتمنى أن تنال منتجاتنا رضاكم"
        : `التوصيل المجدول: ${fmtDateShort(o.deliverOn)} (${o.window})`) +
      `\nالإجمالي: ${fmtMoney(o.total, 0)} (${PAY_AR[o.payment]})\n\nلأي استفسار فريق المبيعات في خدمتكم`;
    window.open(waLink(o.customerPhone, text), "_blank");
  };

  return (
    <div>
      <SectionHead
        title="تتبع الطلبات"
        desc="حالة كل طلب لحظة بلحظة: مراجعة ← خبز وتعبئة ← شحن ← تسليم"
        actions={
          <div className="flex flex-wrap gap-1.5">
            {([["all", "الكل"], ...STAGES.map((s) => [s, STAGE_LABEL[s]])] as ["all" | OrderStatus, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`btn-press rounded-full border px-3.5 py-1.5 text-[12px] font-bold ${filter === k ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-3">
        {list.map((o) => {
          const tone: BadgeTone = o.status === "delivered" ? "sage" : o.status === "shipped" ? "brand" : o.status === "baking" ? "butter" : "mute";
          const isOpen = open === o.id;
          return (
            <div key={o.id} className="card overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : o.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-start">
                <span className="num rounded-lg border border-line bg-raise px-2.5 py-1 text-[12.5px] font-bold text-brand">{o.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{o.customer}</span>
                  <span className="block text-[11px] font-semibold text-mute">
                    {fmtDateShort(o.placedAt)} · {o.lines.reduce((s, l) => s + l.qty, 0)} وحدة · توصيل {fmtDateShort(o.deliverOn)}
                  </span>
                </span>
                {o.status === "baking" && <span className="hidden items-center gap-1.5 text-[11px] font-bold text-butter sm:flex"><Icon name="oven" size={14} className="oven-flame" /> في الأفران الآن</span>}
                <span className="num text-[15px] font-extrabold">{fmtMoney(o.total, 0)}</span>
                <Badge tone={tone}>{STAGE_LABEL[o.status]}</Badge>
                <Icon name="chevron" size={15} className={`text-mute transition-transform ${isOpen ? "-rotate-90" : "rotate-90"}`} />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
                    <div className="border-t border-line px-4 py-4">
                      <div className="mx-auto max-w-xl"><StageSteps order={o} /></div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-xl border border-line bg-raise p-3.5">
                          <p className="label-xs mb-2">بنود الطلب</p>
                          {o.lines.map((l, i) => {
                            const p = products.find((x) => x.id === l.productId)!;
                            return (
                              <div key={i} className="flex items-center justify-between py-1.5 text-[12.5px] font-semibold">
                                <span>{p.name} <span className="text-mute">× {l.qty} {l.tier === "box" ? "علب" : l.tier === "carton" ? "كراتين" : "طبالي"}</span></span>
                                <span className="num text-mute">{fmtMoney(p.packs.find((k) => k.tier === l.tier)!.price * p.packs.find((k) => k.tier === l.tier)!.units * l.qty, 0)}</span>
                              </div>
                            );
                          })}
                          <div className="mt-2 space-y-1 border-t border-dashed border-line pt-2 text-[12px] font-semibold">
                            <p className="flex justify-between text-mute"><span>المجموع</span><span className="num">{fmtMoney(o.subtotal, 0)}</span></p>
                            {o.discount > 0 && <p className="flex justify-between text-sage"><span>خصم الكميات</span><span className="num">−{fmtMoney(o.discount, 0)}</span></p>}
                            <p className="flex justify-between text-mute"><span>التوصيل</span><span className="num">{o.deliveryFee === 0 ? "مجاني" : fmtMoney(o.deliveryFee, 0)}</span></p>
                            <p className="flex justify-between text-[13.5px] font-extrabold text-ink"><span>الإجمالي</span><span className="num text-brand">{fmtMoney(o.total, 0)}</span></p>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <div className="rounded-xl border border-line bg-raise p-3.5 text-[12.5px] font-semibold">
                            <p className="flex items-center gap-2 py-1"><Icon name="pin" size={14} className="text-brand" /> التوصيل: {fmtDateShort(o.deliverOn)} — {o.window}</p>
                            <p className="flex items-center gap-2 py-1"><Icon name="payroll" size={14} className="text-brand" /> الدفع: {PAY_AR[o.payment]}</p>
                            <p className="flex items-center gap-2 py-1"><Icon name="phone" size={14} className="text-brand" /> <span className="num" dir="ltr">+{o.customerPhone}</span></p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Btn variant="whatsapp" size="sm" onClick={() => notifyClient(o)}>
                              <Icon name="whatsapp" size={14} /> إشعار العميل بالحالة
                            </Btn>
                            {canManage && o.status !== "delivered" && (
                              <Btn size="sm" onClick={() => advanceOrder(o.id)}>
                                <Icon name="check" size={14} />
                                {o.status === "pending" ? "بدء الخبز والتعبئة" : o.status === "baking" ? "تأكيد الشحن" : "تأكيد التسليم"}
                              </Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {list.length === 0 && <div className="card p-10 text-center text-[13px] font-semibold text-mute">لا توجد طلبات بهذه الحالة</div>}
      </div>
    </div>
  );
}
