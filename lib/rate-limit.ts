type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

export function rateLimitResponse(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Response | null {
  const bucketKey = `${scope}:${getClientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    return new Response("Rate limit exceeded. Try again later.", {
      status: 429,
      headers: { "Content-Type": "text/plain" },
    });
  }

  bucket.count += 1;
  return null;
}
