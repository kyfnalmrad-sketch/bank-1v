import type { Express, Response } from "express";
import { ENV } from "./env";

const WEB_STATIC_ASSET_ORIGIN = "https://bankkarimi-m62zu5vg.manus.space";
const WEB_STATIC_ASSET_KEYS = new Set([
  "kuraimi-logo-reference_17f98fb5.png",
  "kuraimi-statement-page-background_e5a7a2d4.png",
  "kuraimi-central-logo-reference_d0d5afe2.jpeg",
  "kuraimi-header-strip_ff07f269.png",
  "kuraimi-footer-strip_74a0236b.png",
  "kuraimi-qr-logo-reference_e6a47e2c.png",
]);
const webStaticAssetCache = new Map<string, { body: Buffer; contentType: string }>();

export function isWebStaticAssetKey(key: string) {
  return WEB_STATIC_ASSET_KEYS.has(key);
}

export function getWebStaticAssetUrl(key: string) {
  return `${WEB_STATIC_ASSET_ORIGIN}/manus-storage/${encodeURIComponent(key)}`;
}

async function proxyWebStaticAsset(key: string, res: Response) {
  const cached = webStaticAssetCache.get(key);
  if (cached) {
    res.set("Content-Type", cached.contentType);
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("X-Bank-Asset-Cache", "HIT");
    res.status(200).send(cached.body);
    return;
  }

  const upstream = await fetch(getWebStaticAssetUrl(key));
  if (!upstream.ok) {
    res.status(502).send("Static asset backend error");
    return;
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const body = Buffer.from(await upstream.arrayBuffer());
  webStaticAssetCache.set(key, { body, contentType });
  res.set("Content-Type", contentType);
  res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("X-Bank-Asset-Cache", "MISS");
  res.status(200).send(body);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      if (isWebStaticAssetKey(key)) {
        await proxyWebStaticAsset(key, res);
        return;
      }

      if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
        res.status(500).send("Storage proxy not configured");
        return;
      }

      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
