import { useState } from "react";
import { motion } from "framer-motion";
import { addDays, dateKey, fmtDateShort } from "../lib/payroll";
import { useStore } from "../lib/store";
import type { RawMaterial } from "../lib/types";
import { Badge, Btn, Field, Icon, Modal, SectionHead, inputCls } from "../components/ui";

function daysLeft(producedAt: string, expiryDays: number) {
  const [y, m, d] = producedAt.split("-").map(Number);
  const exp = addDays(new Date(y, m - 1, d), expiryDays);
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

export default function Inventory() {
  const { raw, batches, products, receiveStock } = useStore();
  const [receive, setReceive] = useState<RawMaterial | null>(null);
  const [qty, setQty] = useState("50");

  const lowCount = raw.filter((r) => r.qty < r.reorderPoint).length;
  const expiring = batches.filter((b) => {
    const left = daysLeft(b.producedAt, b.expiryDays);
    return left <= 21;
  }).length;

  return (
    <div>
      <SectionHead
        title="إدارة المخزون"
        desc="المواد الخام ودفعات الإنتاج الجاهز مع تنبيهات حد الطلب وتواريخ الصلاحية"
        actions={
          <div className="flex gap-2">
            <Badge tone={lowCount ? "berry" : "sage"}>{lowCount ? `${lowCount} مادة تحت حد الطلب` : "المخزون فوق الحدود"}</Badge>
            <Badge tone={expiring ? "butter" : "sage"}>{expiring ? `${expiring} دفعة قريبة الانتهاء` : "الصلاحية سليمة"}</Badge>
          </div>
        }
      />

      {/* المواد الخام */}
      <h3 className="mb-3 flex items-center gap-2 font-display text-[16px] font-bold"><Icon name="wheat" size={18} className="text-brand" /> المواد الخام</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {raw.map((m, i) => {
          const pct = Math.min(100, Math.round((m.qty / m.capacity) * 100));
          const low = m.qty < m.reorderPoint;
          const reorderPct = (m.reorderPoint / m.capacity) * 100;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-bold">{m.name}</p>
                  <p className="text-[10.5px] font-semibold text-mute">{m.supplier} · {m.unit}</p>
                </div>
                {low && <Badge tone="berry"><Icon name="alert" size={11} /> اطلب الآن</Badge>}
              </div>
              <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-sunken">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.05 }}
                  className={`h-full rounded-full ${low ? "bg-berry" : pct < 45 ? "bg-butter" : "bg-sage"}`} />
                <span className="absolute inset-y-0 w-0.5 bg-linestrong" style={{ insetInlineStart: `${reorderPct}%` }} title="حد إعادة الطلب" />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] font-semibold">
                <span className="num">{m.qty} <span className="text-mute">من {m.capacity}</span></span>
                <Btn size="sm" variant={low ? "primary" : "outline"} onClick={() => { setReceive(m); setQty(String(Math.min(m.capacity - m.qty, 100))); }}>
                  <Icon name="plus" size={13} /> استلام
                </Btn>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* دفعات الإنتاج */}
      <h3 className="mb-3 mt-7 flex items-center gap-2 font-display text-[16px] font-bold"><Icon name="boxes" size={18} className="text-brand" /> دفعات الإنتاج الجاهز</h3>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold text-mute">
                <th className="px-4 py-2.5 text-start">الدفعة</th>
                <th className="px-3 py-2.5 text-start">المنتج</th>
                <th className="px-3 py-2.5 text-start">تاريخ الإنتاج</th>
                <th className="px-3 py-2.5 text-start">تاريخ الانتهاء</th>
                <th className="px-3 py-2.5 text-start">الكمية</th>
                <th className="px-4 py-2.5 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {[...batches].sort((a, b) => daysLeft(a.producedAt, a.expiryDays) - daysLeft(b.producedAt, b.expiryDays)).map((b) => {
                const p = products.find((x) => x.id === b.productId)!;
                const left = daysLeft(b.producedAt, b.expiryDays);
                const [y, m, d] = b.producedAt.split("-").map(Number);
                const expKey = dateKey(addDays(new Date(y, m - 1, d), b.expiryDays));
                return (
                  <tr key={b.id} className="border-b border-line/60 last:border-0 hover:bg-raise/60">
                    <td className="num px-4 py-2.5 font-bold text-brand">{b.lot}</td>
                    <td className="px-3 py-2.5 font-semibold">{p.name}</td>
                    <td className="px-3 py-2.5 text-mute">{fmtDateShort(b.producedAt)}</td>
                    <td className="px-3 py-2.5 text-mute">{fmtDateShort(expKey)}</td>
                    <td className="num px-3 py-2.5">{b.qty} كرتونة</td>
                    <td className="px-4 py-2.5">
                      {left < 0 ? <Badge tone="berry">منتهية — تُتلف</Badge>
                        : left <= 7 ? <Badge tone="berry"><Icon name="alert" size={11} /> باقي {left} أيام</Badge>
                        : left <= 21 ? <Badge tone="butter">باقي {left} يومًا</Badge>
                        : <Badge tone="sage">سليمة · {left} يوم</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* استلام */}
      <Modal open={!!receive} onClose={() => setReceive(null)} title={`استلام ${receive?.name ?? ""}`}>
        {receive && (
          <div className="space-y-3">
            <p className="rounded-lg border border-line bg-raise px-3 py-2.5 text-[12.5px] font-semibold text-mute">
              المتوفر حاليًا: <b className="num text-ink">{receive.qty} {receive.unit}</b> · السعة القصوى: <b className="num text-ink">{receive.capacity}</b> · المورّد: {receive.supplier}
            </p>
            <Field label={`الكمية المستلمة (${receive.unit})`}>
              <input type="number" min={1} max={receive.capacity - receive.qty} className={`${inputCls} num`} value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Btn className="w-full" onClick={() => {
              const v = Number(qty);
              if (!v || v < 1) return;
              receiveStock(receive.id, v);
              setReceive(null);
            }}>
              <Icon name="check" size={15} /> تأكيد الاستلام في المستودع
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
