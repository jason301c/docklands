// Classify a server IP for ingress viability. Public ("classic") ingress needs a
// publicly-routable address to be reachable from the internet; a missing,
// loopback, or private/LAN address means public domains likely won't resolve for
// outside visitors (the beginner-friendly fix is a Cloudflare Tunnel, which needs
// no public IP). This is a cross-runtime pure helper shared by the server and the
// domain/ingress UI so the guard logic can't drift.

export type ServerIpClass = "missing" | "loopback" | "private" | "public";

const ipv4Parts = (ip: string): number[] | null => {
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	const nums = parts.map((p) => Number(p));
	if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
	return nums;
};

/**
 * Classify an IP (v4 with pragmatic v6 handling) as missing/loopback/private/
 * public. Non-routable for public ingress = anything that is not `public`.
 */
export const classifyServerIp = (ip?: string | null): ServerIpClass => {
	const value = (ip ?? "").trim();
	if (!value) return "missing";

	// Pragmatic IPv6 handling (we don't need full parsing for the guard).
	if (value.includes(":")) {
		const lower = value.toLowerCase();
		if (lower === "::1") return "loopback";
		// Unique-local (fc00::/7) and link-local (fe80::/10).
		if (/^f[cd]/.test(lower) || lower.startsWith("fe80")) return "private";
		if (lower === "::") return "missing";
		return "public";
	}

	const parts = ipv4Parts(value);
	// Not a bare IPv4 literal (e.g. a hostname). Treat as public-ish: we can't
	// prove it's unroutable, and hostnames are a legitimate way to point ingress.
	if (!parts) return "public";

	const [a, b] = parts as [number, number, number, number];
	if (a === 127) return "loopback";
	if (a === 0) return "missing";
	if (a === 10) return "private";
	if (a === 172 && b >= 16 && b <= 31) return "private";
	if (a === 192 && b === 168) return "private";
	if (a === 169 && b === 254) return "private"; // link-local
	if (a === 100 && b >= 64 && b <= 127) return "private"; // CGNAT (RFC6598)
	return "public";
};

/** True when the address can serve public ("classic") ingress from the internet. */
export const isPubliclyRoutableIp = (ip?: string | null): boolean =>
	classifyServerIp(ip) === "public";
