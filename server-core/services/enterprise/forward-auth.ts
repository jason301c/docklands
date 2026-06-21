export const listSsoProvidersForOrg = async (_organizationId: string) => {
	return [];
};

export const getDomainSsoStatus = async (
	_ctx: { session: { activeOrganizationId: string } },
	_domainId: string,
) => {
	return { enabled: false };
};

export const getForwardAuthSettings = async (_serverId: string | null) => {
	return null;
};

export const setForwardAuthSettings = async (_input: {
	organizationId: string;
	serverId?: string | null;
	authDomain: string;
	https: boolean;
	certificateType?: string | null;
	customCertResolver?: string | null;
}) => {
	return null;
};

export const removeForwardAuthSettings = async (_serverId: string | null) => {
	return;
};

export const deployForwardAuthOnServer = async (_input: {
	serverId?: string;
	providerId: string;
	organizationId: string;
}) => {
	return null;
};

export const getForwardAuthServerStatus = async (_organizationId: string) => {
	return [];
};

export const removeForwardAuthProxy = async (_serverId: string | null) => {
	return;
};

export const assertApplicationDomainAccess = async (
	_ctx: { session: { activeOrganizationId: string } },
	_domainId: string,
) => {
	return;
};

export const enableForwardAuthOnDomain = async (_input: {
	ctx: { session: { activeOrganizationId: string } };
	domainId: string;
}) => {
	return { enabled: false };
};

export const disableForwardAuthOnDomain = async (_input: {
	ctx: { session: { activeOrganizationId: string } };
	domainId: string;
}) => {
	return { enabled: false };
};
