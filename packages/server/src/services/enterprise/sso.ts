export const getSSOProviders = async () => {
	return [];
};

export const requestToHeaders = (req: {
	headers?: Record<string, string | string[] | undefined>;
}): Headers => {
	const headers = new Headers();
	if (req?.headers) {
		for (const [key, value] of Object.entries(req.headers)) {
			if (value !== undefined && key.toLowerCase() !== "host") {
				headers.set(key, Array.isArray(value) ? value.join(", ") : value);
			}
		}
	}
	return headers;
};

export const normalizeTrustedOrigin = (value: string): string => {
	return value.trim().replace(/\/+$/, "");
};

export const getOrganizationOwnerId = async (_organizationId: string) => {
	return null;
};
