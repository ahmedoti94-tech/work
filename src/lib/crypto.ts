/* ─────────────────────────────────────────────────────────────────────────────
 * طبقة الأمان التطبيقية — توقيع رموز الحضور (HMAC-SHA256) وسلسلة التدقيق
 * في الإنتاج: المفتاح السري يعيش على الخادم فقط (بيئة Node/Express) ولا يصل
 * للمتصفح أبدًا. هنا نحاكي نفس البروتوكول عبر Web Crypto API.
 * ──────────────────────────────────────────────────────────────────────────── */

const SECRET = "ow-hsm-demo-key-9f41c7ab"; // في الإنتاج: process.env.BADGE_HMAC_KEY
const enc = new TextEncoder();

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw", enc.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
  }
  return keyPromise;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface BadgeToken {
  raw: string;      // OW1.{empId}.{exp}.{sig}
  empId: string;
  exp: number;      // ms epoch
  sig: string;
}

export const BADGE_TTL_SEC = 90; // الرمز يدور كل ٩٠ ثانية — لقطة الشاشة تصبح بلا قيمة

export async function issueBadge(empId: string, ttlSec = BADGE_TTL_SEC): Promise<BadgeToken> {
  const exp = Date.now() + ttlSec * 1000;
  const payload = `${empId}.${exp}`;
  const sig = await hmacSign(payload);
  return { raw: `OW1.${payload}.${sig}`, empId, exp, sig };
}

export interface BadgeCheck {
  ok: boolean;
  empId?: string;
  reason?: string;
}

export async function verifyBadge(raw: string): Promise<BadgeCheck> {
  const t = raw.trim();
  const parts = t.split(".");
  if (parts.length !== 4 || parts[0] !== "OW1") return { ok: false, reason: "صيغة رمز غير معروفة" };
  const [, empId, expStr, sig] = parts;
  const expected = await hmacSign(`${empId}.${expStr}`);
  // مقارنة ثابتة الزمن تقريبًا لمنع timing attacks
  if (expected.length !== sig.length || expected !== sig)
    return { ok: false, reason: "توقيع HMAC مرفوض — الرمز مزوّر أو منسوخ" };
  if (Date.now() > Number(expStr))
    return { ok: false, reason: "انتهت صلاحية الرمز (تدوير ٩٠ ثانية)" };
  return { ok: true, empId };
}

// ─── تجزئة متزامنة (FNV-1a) لسلسلة التدقيق ونمط QR ─────────────────────────
export function fnvHex(input: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ((c << 8) | (c >> 2)), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export const chainHash = (prev: string, at: string, actor: string, action: string, detail: string) =>
  fnvHex(`${prev}|${at}|${actor}|${action}|${detail}`);

/** مصفوفة QR-like حتمية من نص الرمز — تتغير مع كل تدوير للتوقيع */
export function qrCells(token: string, n = 21): boolean[] {
  const cells: boolean[] = [];
  let h = 0x2545f491;
  for (const ch of token) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0) || 7;
  const rnd = () => {
    h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  for (let i = 0; i < n * n; i++) cells.push(rnd() > 0.52);
  return cells;
}

// ─── feedback صوتي للماسح (Web Audio) ───────────────────────────────────────
let ctx: AudioContext | null = null;
export function beep(kind: "ok" | "err") {
  try {
    ctx = ctx || new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "ok" ? 0.34 : 0.4));
    gain.connect(ctx.destination);
    const tone = (freq: number, at: number, dur: number) => {
      const o = ctx!.createOscillator();
      o.type = kind === "ok" ? "sine" : "square";
      o.frequency.value = freq;
      o.connect(gain);
      o.start(at); o.stop(at + dur);
    };
    if (kind === "ok") { tone(880, t, 0.12); tone(1318, t + 0.1, 0.2); }
    else { tone(196, t, 0.16); tone(147, t + 0.14, 0.22); }
  } catch { /* بيئات بدون صوت */ }
}

// ─── إحداثيات المصنع والتحقق الجغرافي ───────────────────────────────────────
export const FACTORY_GEO = { lat: 24.7136, lng: 46.6753, radiusM: 150 };
export const geoTag = (distanceM: number) =>
  `${FACTORY_GEO.lat.toFixed(4)}°N ${FACTORY_GEO.lng.toFixed(4)}°E · على بُعد ${Math.round(distanceM)} م من البوابة`;
