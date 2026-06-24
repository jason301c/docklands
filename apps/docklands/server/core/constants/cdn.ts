import {
	ARVANCLOUD_IP_RANGES,
	BUNNY_CDN_IPS,
	CLOUDFLARE_IP_RANGES,
	FASTLY_IP_RANGES,
} from "@/server/core/constants/cdn-ranges";

// CDN Provider Interface
export interface CDNProvider {
	name: string;
	displayName: string;
	checkIp: (ip: string) => boolean;
	warningMessage: string;
}

const isIPInCIDR = (ip: string, cidr: string): boolean => {
	const [network, prefixLength] = cidr.split("/");
	if (!network || !prefixLength) return false;
	const prefix = Number.parseInt(prefixLength, 10);

	// Convert IP addresses to 32-bit integers
	const ipToInt = (ipStr: string): number => {
		return (
			ipStr
				.split(".")
				.reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>>
			0
		);
	};

	const ipInt = ipToInt(ip);
	const networkInt = ipToInt(network);
	const mask = (0xffffffff << (32 - prefix)) >>> 0;

	return (ipInt & mask) === (networkInt & mask);
};

const CDN_PROVIDERS: CDNProvider[] = [
	{
		name: "cloudflare",
		displayName: "Cloudflare",
		checkIp: (ip: string) =>
			CLOUDFLARE_IP_RANGES.some((range) => isIPInCIDR(ip, range)),
		warningMessage:
			"Domain is behind Cloudflare - actual IP is masked by Cloudflare proxy",
	},
	{
		name: "bunnycdn",
		displayName: "Bunny CDN",
		checkIp: (ip: string) => BUNNY_CDN_IPS.has(ip),
		warningMessage:
			"Domain is behind Bunny CDN - actual IP is masked by CDN proxy",
	},
	{
		name: "fastly",
		displayName: "Fastly",
		checkIp: (ip: string) =>
			FASTLY_IP_RANGES.some((range) => isIPInCIDR(ip, range)),
		warningMessage:
			"Domain is behind Fastly - actual IP is masked by CDN proxy",
	},
	{
		name: "arvancloud",
		displayName: "Arvancloud",
		checkIp: (ip: string) =>
			ARVANCLOUD_IP_RANGES.some((range) => isIPInCIDR(ip, range)),
		warningMessage:
			"Domain is behind Arvancloud - actual IP is masked by CDN proxy",
	},
];

export const detectCDNProvider = (ip: string): CDNProvider | null => {
	return CDN_PROVIDERS.find((provider) => provider.checkIp(ip)) || null;
};
