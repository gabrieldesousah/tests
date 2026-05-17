import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const {
  META_APP_ID,
  META_APP_SECRET,
  META_GRAPH_VERSION = "v21.0",
  META_EMBEDDED_SIGNUP_CONFIG_ID,
  PARTNER_BUSINESS_PORTFOLIO_ID,
  PARTNER_SYSTEM_USER_ACCESS_TOKEN,
  WEBHOOK_VERIFY_TOKEN,
  PUBLIC_BASE_URL = "http://localhost:3000",
} = process.env;

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|jpe?g|png)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error("Only PDF, JPEG, JPG, PNG are allowed"));
  },
});

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

async function graphGet(url, token) {
  const u = new URL(url);
  u.searchParams.set("access_token", token);
  const res = await fetch(u.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || res.statusText);
    err.details = json;
    throw err;
  }
  return json;
}

async function graphFormPost(url, token, formData) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || res.statusText);
    err.details = json;
    throw err;
  }
  return json;
}

function extractClientPortfolioId(wabaPayload) {
  const obi = wabaPayload?.owner_business_info;
  if (typeof obi === "string") return obi;
  if (obi?.id) return obi.id;
  if (wabaPayload?.owner_business?.id) return wabaPayload.owner_business.id;
  return null;
}

function verifyMetaSignature(rawBody, signatureHeader) {
  if (!META_APP_SECRET || !signatureHeader) return !META_APP_SECRET;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

const app = express();

app.use("/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.static(path.join(rootDir, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  try {
    requireEnv("META_APP_ID", META_APP_ID);
    requireEnv("META_EMBEDDED_SIGNUP_CONFIG_ID", META_EMBEDDED_SIGNUP_CONFIG_ID);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  res.json({
    appId: META_APP_ID,
    configId: META_EMBEDDED_SIGNUP_CONFIG_ID,
    graphVersion: META_GRAPH_VERSION,
    publicBaseUrl: PUBLIC_BASE_URL,
  });
});

app.post("/api/exchange-code", async (req, res) => {
  try {
    requireEnv("META_APP_ID", META_APP_ID);
    requireEnv("META_APP_SECRET", META_APP_SECRET);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  const code = req.body?.code;
  if (!code) return res.status(400).json({ error: "code is required" });

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    code: String(code),
  });
  if (process.env.META_OAUTH_REDIRECT_URI) {
    params.set("redirect_uri", process.env.META_OAUTH_REDIRECT_URI);
  } else {
    params.set("redirect_uri", "");
  }

  const url = `${GRAPH}/oauth/access_token?${params.toString()}`;
  try {
    const tokenRes = await fetch(url);
    const json = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({
        error: json.error?.message || "Token exchange failed",
        details: json,
      });
    }
    return res.json({
      access_token: json.access_token,
      token_type: json.token_type,
      expires_in: json.expires_in,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/waba/:wabaId", async (req, res) => {
  const auth = req.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization: Bearer <embedded_signup_token> required" });
  }
  const { wabaId } = req.params;
  const fields = req.query.fields || "id,name,owner_business_info,business_verification_status";
  try {
    const data = await graphGet(`${GRAPH}/${wabaId}?fields=${encodeURIComponent(fields)}`, token);
    return res.json({
      ...data,
      client_business_portfolio_id: extractClientPortfolioId(data),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message, details: err.details });
  }
});

app.post(
  "/api/plbv/submit",
  upload.array("business_documents[]", 3),
  async (req, res) => {
    try {
      requireEnv("PARTNER_BUSINESS_PORTFOLIO_ID", PARTNER_BUSINESS_PORTFOLIO_ID);
      requireEnv("PARTNER_SYSTEM_USER_ACCESS_TOKEN", PARTNER_SYSTEM_USER_ACCESS_TOKEN);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    const endBusinessId = req.body?.end_business_id || req.body?.client_business_portfolio_id;
    if (!endBusinessId) {
      return res.status(400).json({
        error: "end_business_id (client business portfolio ID) is required",
      });
    }
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ error: "At least one business_documents file is required (max 3)" });
    }

    const form = new FormData();
    form.set("end_business_id", String(endBusinessId));
    for (const f of files) {
      const blob = new Blob([f.buffer], { type: f.mimetype || "application/octet-stream" });
      form.append("business_documents[]", blob, f.originalname);
    }

    const url = `${GRAPH}/${PARTNER_BUSINESS_PORTFOLIO_ID}/self_certify_whatsapp_business`;
    try {
      const out = await graphFormPost(url, PARTNER_SYSTEM_USER_ACCESS_TOKEN, form);
      return res.json(out);
    } catch (err) {
      return res.status(400).json({ error: err.message, details: err.details });
    }
  },
);

app.get("/api/plbv/submissions", async (req, res) => {
  try {
    requireEnv("PARTNER_BUSINESS_PORTFOLIO_ID", PARTNER_BUSINESS_PORTFOLIO_ID);
    requireEnv("PARTNER_SYSTEM_USER_ACCESS_TOKEN", PARTNER_SYSTEM_USER_ACCESS_TOKEN);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  const endBusinessId = req.query.end_business_id;
  let url = `${GRAPH}/${PARTNER_BUSINESS_PORTFOLIO_ID}/self_certified_whatsapp_business_submissions`;
  if (endBusinessId) {
    url += `?end_business_id=${encodeURIComponent(String(endBusinessId))}`;
  }
  try {
    const data = await graphGet(url, PARTNER_SYSTEM_USER_ACCESS_TOKEN);
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message, details: err.details });
  }
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && WEBHOOK_VERIFY_TOKEN && token === WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  const sig = req.get("X-Hub-Signature-256");
  const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (META_APP_SECRET && !verifyMetaSignature(raw, sig)) {
    return res.sendStatus(403);
  }
  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return res.sendStatus(400);
  }
  const entries = payload.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const v = change.value;
      if (v?.event === "PARTNER_CLIENT_CERTIFICATION_NEEDED") {
        console.log("[webhook] PLBV required:", v.partner_client_certification_needed_info);
      }
      if (v?.event === "PARTNER_CLIENT_CERTIFICATION_STATUS_UPDATE") {
        console.log("[webhook] PLBV status:", v.partner_client_certification_info);
      }
    }
  }
  res.sendStatus(200);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
