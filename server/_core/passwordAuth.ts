import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { SESSION_DURATION_MS } from "@shared/const";
import { parse as parseCookies } from "cookie";

export const PASSWORD_SESSION_COOKIE = "__Host-site_session";
const SESSION_ISSUER = "bank-karimi-site-password";

type PasswordClaims = { kind: "site-password" };

function secretKey() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for password sessions");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function passwordIsConfigured() {
  return ENV.sitePassword.length > 0;
}

export function passwordMatches(candidate: string) {
  if (!passwordIsConfigured()) return false;
  const expected = Buffer.from(ENV.sitePassword);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function createPasswordSession() {
  const now = Date.now();
  return new SignJWT({ kind: "site-password" } satisfies PasswordClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor((now + SESSION_DURATION_MS) / 1000))
    .setIssuer(SESSION_ISSUER)
    .sign(secretKey());
}

export async function hasPasswordSession(req: Request) {
  const token = parseCookies(req.headers.cookie ?? "")[PASSWORD_SESSION_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: SESSION_ISSUER });
    return payload.kind === "site-password";
  } catch {
    return false;
  }
}

export const PASSWORD_COOKIE_MAX_AGE = SESSION_DURATION_MS;
