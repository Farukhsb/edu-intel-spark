const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_EDGE_RATE_LIMIT_SCOPE = "edge-sensitive-global";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  userId?: string | null;
  now?: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  identifierType: "user" | "ip" | "anonymous";
};

type SharedRateLimitAdminClient = {
  schema: (schema: string) => {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{
        allowed: boolean;
        retry_after_seconds: number;
      }> | null;
      error: { message?: string } | null;
    }>;
  };
};

type SharedRateLimitOptions = RateLimitOptions & {
  globalLimit?: number;
  globalWindowMs?: number;
};

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return req.headers.get("cf-connecting-ip")?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || null;
}

export function getRateLimitIdentity(req: Request, userId?: string | null) {
  if (userId && userId.trim()) {
    return {
      key: `user:${userId.trim()}`,
      identifierType: "user" as const,
    };
  }

  const requestIp = getRequestIp(req);
  if (requestIp) {
    return {
      key: `ip:${requestIp}`,
      identifierType: "ip" as const,
    };
  }

  return {
    key: "anonymous",
    identifierType: "anonymous" as const,
  };
}

export function applyRateLimit(req: Request, options: RateLimitOptions): RateLimitResult {
  const currentTime = options.now ?? Date.now();
  const identity = getRateLimitIdentity(req, options.userId);
  const storeKey = `${options.scope}:${identity.key}`;
  const currentWindow = rateLimitStore.get(storeKey);

  if (!currentWindow || currentWindow.resetAt <= currentTime) {
    rateLimitStore.set(storeKey, {
      count: 1,
      resetAt: currentTime + options.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
      identifierType: identity.identifierType,
    };
  }

  if (currentWindow.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((currentWindow.resetAt - currentTime) / 1000)),
      identifierType: identity.identifierType,
    };
  }

  currentWindow.count += 1;
  rateLimitStore.set(storeKey, currentWindow);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    identifierType: identity.identifierType,
  };
}

export function createRateLimitResponse(corsHeaders: Record<string, string>, retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

export function resetRateLimitStore() {
  rateLimitStore.clear();
}

async function applySharedScopeRateLimit(
  adminClient: SharedRateLimitAdminClient,
  identityKey: string,
  identifierType: RateLimitResult["identifierType"],
  scope: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const { data, error } = await adminClient
    .schema("private")
    .rpc("consume_edge_rate_limit", {
      p_scope: scope,
      p_identifier: identityKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });

  if (error) {
    throw new Error(error.message || "Shared rate limit check failed");
  }

  const result = data?.[0];
  if (!result) {
    throw new Error("Shared rate limit check returned no result");
  }

  return {
    allowed: result.allowed,
    retryAfterSeconds: result.retry_after_seconds,
    identifierType,
  };
}

export async function applySharedRateLimit(
  adminClient: SharedRateLimitAdminClient,
  req: Request,
  options: SharedRateLimitOptions,
): Promise<RateLimitResult> {
  if (typeof adminClient.schema !== "function") {
    const globalResult = applyRateLimit(req, {
      scope: GLOBAL_EDGE_RATE_LIMIT_SCOPE,
      limit: options.globalLimit ?? 20,
      windowMs: options.globalWindowMs ?? 60_000,
      userId: options.userId,
      now: options.now,
    });

    if (!globalResult.allowed) {
      return globalResult;
    }

    return applyRateLimit(req, options);
  }

  const identity = getRateLimitIdentity(req, options.userId);
  const globalLimit = options.globalLimit ?? 20;
  const globalWindowMs = options.globalWindowMs ?? 60_000;

  const globalResult = await applySharedScopeRateLimit(
    adminClient,
    identity.key,
    identity.identifierType,
    GLOBAL_EDGE_RATE_LIMIT_SCOPE,
    globalLimit,
    globalWindowMs,
  );

  if (!globalResult.allowed) {
    return globalResult;
  }

  return applySharedScopeRateLimit(
    adminClient,
    identity.key,
    identity.identifierType,
    options.scope,
    options.limit,
    options.windowMs,
  );
}
