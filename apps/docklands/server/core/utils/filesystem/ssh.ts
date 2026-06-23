import * as ssh2 from "ssh2";

export const generateSSHKey = async (type: "rsa" | "ed25519" = "rsa") => {
	if (type === "rsa") {
		const keys = ssh2.utils.generateKeyPairSync("rsa", {
			bits: 4096,
			comment: "docklands",
		});
		return {
			privateKey: keys.private,
			publicKey: keys.public,
		};
	}
	const keys = ssh2.utils.generateKeyPairSync("ed25519", {
		comment: "docklands",
	});

	return {
		privateKey: keys.private,
		publicKey: keys.public,
	};
};
