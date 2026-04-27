const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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
