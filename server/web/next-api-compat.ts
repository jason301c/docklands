import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

type RouteParams = Record<string, string | string[] | undefined>;
type QueryValue = string | string[];

type CompatRequest = NextApiRequest & {
	body: unknown;
	query: Record<string, QueryValue | undefined>;
};

type CompatResponse = NextApiResponse & {
	getCollectedResponse: () => Response;
};

const parseBody = async (request: Request) => {
	if (request.method === "GET" || request.method === "HEAD") {
		return undefined;
	}

	const text = await request.text();
	if (!text) {
		return undefined;
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		return JSON.parse(text);
	}

	if (contentType.includes("application/x-www-form-urlencoded")) {
		return Object.fromEntries(new URLSearchParams(text));
	}

	return text;
};

const requestHeadersToObject = (headers: Headers) => {
	const output: Record<string, string | string[] | undefined> = {};
	headers.forEach((value, key) => {
		output[key.toLowerCase()] = value;
	});
	return output;
};

const requestQueryToObject = (url: URL, params: RouteParams) => {
	const query: Record<string, QueryValue | undefined> = {};
	url.searchParams.forEach((value, key) => {
		const existing = query[key];
		if (!existing) {
			query[key] = value;
			return;
		}
		query[key] = Array.isArray(existing)
			? [...existing, value]
			: [existing, value];
	});
	return { ...query, ...params };
};

const setResponseHeader = (
	headers: Headers,
	name: string,
	value: number | string | readonly string[],
) => {
	const normalizedName = name.toLowerCase();
	if (Array.isArray(value)) {
		headers.delete(name);
		for (const item of value) {
			if (normalizedName === "set-cookie") {
				headers.append(name, item);
			} else {
				headers.append(name, item);
			}
		}
		return;
	}
	headers.set(name, String(value));
};

const serializeBody = (body: unknown): BodyInit | null => {
	if (body === undefined || body === null) {
		return null;
	}
	if (
		typeof body === "string" ||
		body instanceof ArrayBuffer ||
		body instanceof Blob ||
		body instanceof FormData ||
		body instanceof URLSearchParams
	) {
		return body;
	}
	if (ArrayBuffer.isView(body)) {
		return body as BodyInit;
	}
	return JSON.stringify(body);
};

const createCompatResponse = () => {
	const headers = new Headers();
	let statusCode = 200;
	let responseBody: BodyInit | null = null;

	const response = {
		status(code: number) {
			statusCode = code;
			return response;
		},
		json(body: unknown) {
			if (!headers.has("content-type")) {
				headers.set("content-type", "application/json; charset=utf-8");
			}
			responseBody = JSON.stringify(body);
			return response;
		},
		send(body: unknown) {
			responseBody = serializeBody(body);
			return response;
		},
		end(body?: unknown) {
			responseBody = serializeBody(body);
			return response;
		},
		redirect(statusOrUrl: number | string, url?: string) {
			const redirectStatus =
				typeof statusOrUrl === "number" ? statusOrUrl : 307;
			const location = typeof statusOrUrl === "string" ? statusOrUrl : url;

			if (!location) {
				throw new Error("Redirect location is required");
			}

			statusCode = redirectStatus;
			headers.set("location", location);
			responseBody = null;
			return response;
		},
		setHeader(name: string, value: number | string | readonly string[]) {
			setResponseHeader(headers, name, value);
			return response;
		},
		getHeader(name: string) {
			return headers.get(name) ?? undefined;
		},
		removeHeader(name: string) {
			headers.delete(name);
			return response;
		},
		getCollectedResponse() {
			return new Response(responseBody, {
				status: statusCode,
				headers,
			});
		},
	} as unknown as CompatResponse;

	return response;
};

export const runNextApiHandler = async (
	request: Request,
	handler: NextApiHandler,
	params: RouteParams = {},
) => {
	const url = new URL(request.url);
	const req = {
		body: await parseBody(request),
		headers: requestHeadersToObject(request.headers),
		method: request.method,
		query: requestQueryToObject(url, params),
		url: `${url.pathname}${url.search}`,
	} as CompatRequest;
	const res = createCompatResponse();

	await handler(req, res);

	return res.getCollectedResponse();
};
