/* ─────────────────────────────────────────────────────────────────────────────
 * محرك التوصيات الذكي — «مقترح خصيصًا لك»
 * الإشارات: سجل المشتريات (الطلبات) · مرات تصفح المنتج · حجم طلبات الجملة ·
 * الموسم الحالي · نية إعادة الطلب · توفر المخزون. كل توصية تحمل سببًا مفسَّرًا
 * بالعربية (Explainable AI) بدل صندوق أسود.
 * ──────────────────────────────────────────────────────────────────────────── */
import { cartonsOf } from "./payroll";
import type { CartLine, Order, Product } from "./types";

export interface Recommendation {
  product: Product;
  score: number;
  reasons: string[];
}

/** الطلب الموسمي: عائلات نكهات ترتفع في أشهر محددة (تقويم الميلادي) */
const SEASONAL: Record<string, number[]> = {
  "تمر": [2, 3, 4, 9, 10],        // رمضان ومواسم الضيافة
  "شوكولاتة": [10, 11, 0, 1],     // الشتاء والعودة للمدارس
  "جوز هند": [5, 6, 7, 8],        // الصيف
  "حمضيات": [11, 0, 1, 2],        // الشتاء
  "شوفان": [8, 9, 0],             // قرارات بداية السنة
};

export function recommendFor(
  products: Product[],
  orders: Order[],
  cart: CartLine[],
  views: Record<string, number>,
  take = 4
): Recommendation[] {
  const month = new Date().getMonth();
  const inCart = new Set(cart.map((l) => l.productId));

  // ١) تفضيل العائلة من المشتريات الفعلية (أقوى إشارة — حجم الكراتين مرجِّح)
  const familyWeight = new Map<string, number>();
  const purchased = new Map<string, number>(); // productId -> كراتين مشتراه
  for (const o of orders) {
    for (const l of o.lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p) continue;
      const c = cartonsOf(l.tier, l.qty);
      purchased.set(l.productId, (purchased.get(l.productId) ?? 0) + c);
      familyWeight.set(p.family, (familyWeight.get(p.family) ?? 0) + c);
    }
  }
  const maxFamily = Math.max(1, ...familyWeight.values());

  return products
    .filter((p) => !inCart.has(p.id))
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];

      // تفضيل العائلة
      const fw = (familyWeight.get(p.family) ?? 0) / maxFamily;
      if (fw > 0) {
        score += fw * 34;
        if (fw > 0.45) reasons.push(`من مشترياتك في عائلة «${p.family}»`);
      }

      // نية إعادة الطلب — مشتري الجملة يعيدون شراء نفس الصنف دوريًا
      const bought = purchased.get(p.id) ?? 0;
      if (bought > 0) {
        score += Math.min(26, bought / 4);
        reasons.push(bought >= 30 ? `عميل جملة لهذا الصنف (${Math.round(bought)} كرتونة سابقًا)` : "سبق أن طلبته — موعد إعادة التعبئة؟");
      }

      // سلوك التصفح (مؤشر اهتمام لحظي)
      const v = views[p.id] ?? 0;
      if (v > 0) {
        score += Math.min(14, v * 4);
        reasons.push("اطلعت عليه مؤخرًا");
      }

      // الموسم
      if ((SEASONAL[p.family] ?? []).includes(month)) {
        score += 12;
        reasons.push("طلب موسمي مرتفع الآن");
      }

      // جودة المنتج الأساسية: التقييم + ندرة المخزون تدفع القرار السريع
      score += (p.rating - 3.5) * 6;
      if (p.stock > 0 && p.stock < 120) {
        score += 4;
        reasons.push(`مخزون محدود (${p.stock} كرتونة)`);
      }

      // خصم الشرائح: المنتجات الرخيصة نسبيًا تستفيد أكثر من دفعها فوق عتبة ١٠ كراتين
      if (p.packs[2] && p.moqCartons >= 5) score += 3;

      return { product: p, score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 2) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map((r) => ({
      ...r,
      reasons: r.reasons.length ? r.reasons : ["من الأصناف الأعلى مبيعًا هذا الشهر"],
    }));
}
