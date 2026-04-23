import type { VercelRequest, VercelResponse } from "@vercel/node";

let appPromise: Promise<any> | null = null;
let initError: unknown = null;

function sanitizeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const trimmed = raw.length > 500 ? raw.slice(0, 500) : raw;
  return trimmed
    .replace(/eyJ[A-Za-z0-9_\-\.]+/g, "[redacted-jwt]")
    .replace(/https?:\/\/[^\s]+\.supabase\.co/gi, "[redacted-supabase-url]");
}

function getApp(): Promise<any> {
  if (!appPromise) {
    appPromise = (async () => {
      const mod = await import("../server/app.js");
      return mod.createApp();
    })().catch((err) => {
      initError = err;
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

function urlPath(req: VercelRequest): string {
  const raw = req.url ?? "/";
  const qIndex = raw.indexOf("?");
  return qIndex === -1 ? raw : raw.slice(0, qIndex);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    const path = urlPath(req);

    if (path === "/api/health" || path === "/api/health/" || path === "/health") {
      res.status(200).json({
        ok: true,
        runtime: "vercel",
        method: req.method ?? "GET",
        env: {
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          NODE_ENV: process.env.NODE_ENV ?? null,
          VERCEL: Boolean(process.env.VERCEL),
          VERCEL_REGION: process.env.VERCEL_REGION ?? null,
        },
        appInitialized: appPromise !== null && initError === null,
        initError: initError ? sanitizeMessage(initError) : null,
        now: new Date().toISOString(),
      });
      return;
    }

    let app: any;
    try {
      app = await getApp();
    } catch (err) {
      console.error("api/index: failed to initialize app", err);
      res.status(500).json({
        error: "initialization_failed",
        message: sanitizeMessage(err),
      });
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      res.on("finish", done);
      res.on("close", done);
      try {
        app(req, res, (err?: unknown) => {
          if (err) {
            console.error("api/index: express next(err)", err);
            if (!res.headersSent) {
              res.status(500).json({
                error: "request_failed",
                message: sanitizeMessage(err),
              });
            }
          }
          done();
        });
      } catch (err) {
        console.error("api/index: synchronous dispatch error", err);
        if (!res.headersSent) {
          res.status(500).json({
            error: "dispatch_failed",
            message: sanitizeMessage(err),
          });
        }
        done();
      }
    });
  } catch (err) {
    console.error("api/index: unhandled top-level error", err);
    if (!res.headersSent) {
      try {
        res.status(500).json({
          error: "unhandled_exception",
          message: sanitizeMessage(err),
        });
      } catch {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  }
}
