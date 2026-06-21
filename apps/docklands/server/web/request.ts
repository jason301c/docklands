export type HeaderMap = Record<string, string | string[] | undefined>;

export const requestHeadersToObject = (headers: Headers): HeaderMap => {
	const result: HeaderMap = {};

	headers.forEach((value, key) => {
		result[key.toLowerCase()] = value;
	});

	return result;
};

export const parseRequestBody = async (request: Request) => {
	if (request.method === "GET" || request.method === "HEAD") {
		return undefined;
	}

	const contentType = request.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		const text = await request.text();
		return text ? JSON.parse(text) : undefined;
	}

	if (contentType.includes("application/x-www-form-urlencoded")) {
		return Object.fromEntries(new URLSearchParams(await request.text()));
	}

	if (contentType.includes("multipart/form-data")) {
		return Object.fromEntries(await request.formData());
	}

	const text = await request.text();
	return text || undefined;
};

export const jsonResponse = (body: unknown, status = 200) =>
	Response.json(body, { status });

export const redirectResponse = (
	request: Request,
	location: string | URL,
	status = 307,
) => Response.redirect(new URL(location.toString(), request.url), status);

export const getQueryParam = (url: URL, key: string) => {
	const value = url.searchParams.get(key);
	return value || undefined;
};
