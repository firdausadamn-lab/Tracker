import crypto from "crypto";

const COOKIE_NAME = "proof_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET environment variable.");
  return s;
}

// Signed token: base64(expiry) + "." + hmac(expiry). No session store needed --
// anyone holding a validly-signed token created by *this* passphrase check is
// treated as admin until it expires.
export function makeSessionToken(): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expires);
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  return Number(payload) > Date.now();
}

export function checkPasscode(input: string): boolean {
  const real = process.env.ADMIN_PASSCODE;
  if (!real) throw new Error("Missing ADMIN_PASSCODE environment variable.");
  const a = Buffer.from(input);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
