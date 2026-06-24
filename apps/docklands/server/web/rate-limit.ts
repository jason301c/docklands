// In-memory fixed-window rate limiter for the unauthenticated HTTP surfaces
// (the deploy webhooks). Process-global and resets on restart, which is fine for
// the single-process control plane — Better Auth handles /api/auth/* separately.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

const prune = (now: number) => {
	for (const [key, bucket] of buckets) {
		if (now >= bucket.resetAt) buckets.delete(key);
	}
};

/**
 * Returns true if the call is within the limit, false if it should be rejected.
 * `key` is typically the caller's IP. Counts every call against a fixed window.
 */
export const checkRateLimit = (
	key: string,
	limit: number,
	windowMs: number,
): boolean => {
	const now = Date.now();
	if (buckets.size > MAX_BUCKETS) prune(now);

	const bucket = buckets.get(key);
	if (!bucket || now >= bucket.resetAt) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	if (bucket.count >= limit) return false;
	bucket.count += 1;
	return true;
};

/** Best-effort client IP from common proxy headers, falling back to a constant. */
export const clientIpFromHeaders = (headers: Headers): string => {
	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return headers.get("x-real-ip")?.trim() || "unknown";
};
