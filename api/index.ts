import type { IncomingMessage, ServerResponse } from "node:http";

let appPromise: Promise<any> | null = null;
let initError: unknown = null;

async function loadApp(): Promise<any> {
  const mod = await import("../server/app");
  return mod.createApp();
}

function getApp(): Promise<any> {
  if (!appPromise) {
    appPromise = loadApp().catch((err) => {
      initError = err;
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

function sanitizeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const trimmed = raw.length > 500 ? raw.slice(0, 500) : raw;
  return trimmed
    .replace(/eyJ[A-Za-z0-9_\-\.]+/g, "[redacted-jwt]")
    .replace(/https?:\/\/[^\s]+\.supabase\.co/gi, "[redacted-supabase-url]");
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  try {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch {
    try {
      res.end();
    } catch {
      // ignore
    }
  }
}

function handleHealth(req: IncomingMessage, res: ServerResponse): void {
  writeJson(res, 200, {
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
}

function urlPath(req: IncomingMessage): string {
  const raw = req.url ?? "/";
  const qIndex = raw.indexOf("?");
  return qIndex === -1 ? raw : raw.slice(0, qIndex);
}

async function dispatchToApp(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let app: any;
  try {
    app = await getApp();
  } catch (err) {
    console.error("api/index: failed to initialize app", err);
    writeJson(res, 500, {
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
            writeJson(res, 500, {
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
        writeJson(res, 500, {
          error: "dispatch_failed",
          message: sanitizeMessage(err),
        });
      }
      done();
    }
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const path = urlPath(req);

    // Always-on health endpoint: no imports, no Supabase, no Express.
    if (
      path === "/api/health" ||
      path === "/api/health/" ||
      path === "/health"
    ) {
      handleHealth(req, res);
      return;
    }

    await dispatchToApp(req, res);
  } catch (err) {
    console.error("api/index: unhandled top-level error", err);
    if (!res.headersSent) {
      writeJson(res, 500, {
        error: "unhandled_exception",
        message: sanitizeMessage(err),
      });
      return;
    }
    try {
      res.end();
    } catch {
      // ignore
    }
  }
}
