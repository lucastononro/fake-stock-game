import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { ApiError } from "./util.js";

const encoder = new TextEncoder();
const appSecret = (env) => encoder.encode(env.SECRET_KEY || "dev-secret-change-me-in-production");

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function createToken(env, userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setExpirationTime("30d")
    .sign(appSecret(env));
}

export async function verifyGoogleCredential(env, credential) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "Google sign-in is not configured — set GOOGLE_CLIENT_ID");
  }
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    return payload;
  } catch {
    throw new ApiError(401, "Invalid Google credential");
  }
}

/** Hono middleware: validates the Bearer token and sets c.var.user. */
export async function requireUser(c, next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Not authenticated");
  let payload;
  try {
    ({ payload } = await jwtVerify(header.slice(7), appSecret(c.env)));
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(Number(payload.sub))
    .first();
  if (!user) throw new ApiError(401, "User no longer exists");
  c.set("user", user);
  await next();
}

// ---- Group join passwords (PBKDF2 via WebCrypto — no native deps) ----

const PBKDF2_ITERATIONS = 100_000;

async function deriveBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256
  );
  return new Uint8Array(bits);
}

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, saltB64, hashB64] = (stored || "").split("$");
  if (scheme !== "pbkdf2") return false;
  const expected = fromB64(hashB64);
  const actual = await deriveBits(password, fromB64(saltB64), Number(iterations));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
  return mismatch === 0;
}

export const serializeUser = (row) => ({
  id: row.id,
  username: row.username,
  display_name: row.display_name,
  email: row.email,
  picture: row.picture,
  created_at: new Date(row.created_at).toISOString(),
});
