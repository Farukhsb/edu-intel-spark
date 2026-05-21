import express from "express";
import { timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(moduleDir, ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;

    process.env[key] = value;
  }
}

loadDotEnv();

function getEnv(name, fallback = "") {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

const port = Number(getEnv("PORT", "8790"));
const ollamaBaseUrl = getEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").replace(/\/+$/, "");
const defaultModel = getEnv("OLLAMA_DEFAULT_MODEL", "qwen2.5:3b");
const requestTimeoutMs = Number(getEnv("OLLAMA_REQUEST_TIMEOUT_MS", "180000"));
const maxBodyMb = Number(getEnv("OLLAMA_BRIDGE_MAX_BODY_MB", "10"));

function getConfiguredApiSecret() {
  return getEnv("GRADEAI_API_SECRET");
}

function timingSafeMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function requireApiKey(req, res, next) {
  const configuredSecret = getConfiguredApiSecret();
  if (!configuredSecret) {
    next();
    return;
  }

  const incomingApiKey = String(req.header("x-api-key") || "");
  if (!incomingApiKey || !timingSafeMatch(incomingApiKey, configuredSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: typeof message.role === "string" ? message.role : "user",
      content: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""),
    }));
}

app.disable("x-powered-by");
app.use(express.json({ limit: `${maxBodyMb}mb` }));

app.get("/health", async (_req, res) => {
  try {
    const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/tags`);
    if (!response.ok) {
      res.status(502).json({
        ok: false,
        service: "gradeai-ollama-bridge",
        upstream: "ollama",
        status: response.status,
      });
      return;
    }

    const data = await response.json();
    const models = Array.isArray(data?.models)
      ? data.models.map((model) => model?.name).filter((name) => typeof name === "string")
      : [];

    res.json({
      ok: true,
      service: "gradeai-ollama-bridge",
      upstream: "ollama",
      defaultModel,
      modelCount: models.length,
      models,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      service: "gradeai-ollama-bridge",
      upstream: "ollama",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/models", requireApiKey, async (_req, res) => {
  try {
    const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/tags`);
    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load Ollama models",
    });
  }
});

app.post("/chat", requireApiKey, async (req, res) => {
  const messages = normalizeMessages(req.body?.messages);
  if (messages.length === 0) {
    res.status(400).json({ error: "messages are required" });
    return;
  }

  const payload = {
    model: typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : defaultModel,
    messages,
    stream: false,
    temperature: typeof req.body?.temperature === "number" ? req.body.temperature : 0,
    top_p: typeof req.body?.top_p === "number" ? req.body.top_p : 1,
    format: req.body?.format,
  };

  try {
    const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ollama bridge request failed";
    const isAbort = error instanceof Error && error.name === "AbortError";

    res.status(isAbort ? 504 : 502).json({
      error: isAbort ? `Ollama request timed out after ${requestTimeoutMs}ms` : message,
    });
  }
});

app.listen(port, () => {
  console.log(`Ollama bridge listening on http://0.0.0.0:${port}`);
});
