import { describe, expect, it } from "vitest";
import {
	classifyServerIp,
	isPubliclyRoutableIp,
} from "@/shared/validation/server-ip";

describe("classifyServerIp", () => {
	it("flags missing/empty addresses", () => {
		expect(classifyServerIp(undefined)).toBe("missing");
		expect(classifyServerIp(null)).toBe("missing");
		expect(classifyServerIp("")).toBe("missing");
		expect(classifyServerIp("   ")).toBe("missing");
		expect(classifyServerIp("0.0.0.0")).toBe("missing");
	});

	it("flags loopback", () => {
		expect(classifyServerIp("127.0.0.1")).toBe("loopback");
		expect(classifyServerIp("127.5.5.5")).toBe("loopback");
		expect(classifyServerIp("::1")).toBe("loopback");
	});

	it("flags private / LAN / CGNAT / link-local ranges", () => {
		expect(classifyServerIp("10.0.0.5")).toBe("private");
		expect(classifyServerIp("172.16.0.1")).toBe("private");
		expect(classifyServerIp("172.31.255.255")).toBe("private");
		expect(classifyServerIp("192.168.1.10")).toBe("private");
		expect(classifyServerIp("169.254.1.1")).toBe("private");
		expect(classifyServerIp("100.64.0.1")).toBe("private");
		expect(classifyServerIp("fd00::1")).toBe("private");
		expect(classifyServerIp("fe80::1")).toBe("private");
	});

	it("treats public IPv4/IPv6 (and just-outside-private ranges) as public", () => {
		expect(classifyServerIp("203.0.113.10")).toBe("public");
		expect(classifyServerIp("8.8.8.8")).toBe("public");
		expect(classifyServerIp("172.32.0.1")).toBe("public"); // just outside 172.16/12
		expect(classifyServerIp("172.15.0.1")).toBe("public");
		expect(classifyServerIp("2606:4700:4700::1111")).toBe("public");
	});

	it("treats a hostname (non-IP literal) as public — can't prove unroutable", () => {
		expect(classifyServerIp("example.com")).toBe("public");
	});

	it("isPubliclyRoutableIp is true only for public", () => {
		expect(isPubliclyRoutableIp("203.0.113.10")).toBe(true);
		expect(isPubliclyRoutableIp("192.168.1.1")).toBe(false);
		expect(isPubliclyRoutableIp("")).toBe(false);
		expect(isPubliclyRoutableIp("127.0.0.1")).toBe(false);
	});
});
