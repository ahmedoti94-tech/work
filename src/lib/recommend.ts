/* ─────────────────────────────────────────────────────────────────────────────
 * محرك التوصيات الذكي — "مقترحات مخصصة لك"
 * يمزج ثلاثة إشارات: سلوك التصفح، تاريخ الشراء (مرجّحًا بحجم الجملة)،
 * والموسمية. في الإنتاج يُنفَّذ كـ Aggregation Pipeline في MongoDB + Redis
 * cache بمفتاح customerId وتنتهي صلاحيته عند كل طلب جديد.
 * ──────────────────────────────────────────────────────────────────────────── */
import type { Order, Product } from "./types";
import { cartonsOf } from "./payroll";

export interface Reco {
  product: Product;
  score: number;
  reasons: string[];
}

export function recommend(
  products: Product[],
  views: Record<string, number>,
  orders: Order[],
  limit = 4
): Reco[] {
  const familyScore: Record<string, number> = {};
  const noteScore: Record<string, number> = {};

  // 1) إشارة التصفح (أوزان خفيفة)
  for (const p of products) {
    const v = views[p.id] ?? 0;
    if (!v) continue;
    familyScore[p.family] = (familyScore[p.family] ?? 0) + v * 2;
    for (const n of p.notes) noteScore[n] = (noteScore[n] ?? 0) + v;
  }

  // 2) إشارة الشراء (أوزان ثقيلة + حساسية حجم الجملة)
  let bulkCartons = 0;
  for (const o of orders) {
    for (const l of o.lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p) continue;
      const c = cartonsOf(l.tier, l.qty);
      bulkCartons += c;
      familyScore[p.family] = (familyScore[p.family] ?? 0) + 6 + c / 15;
      for (const n of p.notes) noteScore[n] = (noteScore[n] ?? 0) + 2;
    }
  }
  const isBulk = bulkCartons >= 60;

  // 3) التقييم النهائي لكل منتج
  const scored: Reco[] = products.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    const f = familyScore[p.family] ?? 0;
    if (f >= 4) {
      score += Math.min(42, f * 2.2);
      reasons.push(`لأنك مهتم بفئة «${p.flavor}»`);
    }
    const noteHit = p.notes.reduce((s, n) => s + (noteScore[n] ?? 0), 0);
    if (noteHit >= 3) {
      score += Math.min(22, noteHit * 1.6);
      reasons.push("يناسب مذاقك المفضل");
    }
    if (p.seasonal) {
      score += 16;
      reasons.push(`مطلوب الآن — موسم ${p.seasonal}`);
    }
    if (isBulk && p.packs[2].price * 60 <= 900) {
      score += 12;
      reasons.push("اقتصادي لطلبات البالات");
    }
    score += p.rating * 2.5;
    if (p.stock < 80) score -= 12;

    return { product: p, score: Math.round(score), reasons: reasons.slice(0, 2) };
  });

  return scored
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
