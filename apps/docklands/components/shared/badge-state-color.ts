export const badgeStateColor = (state: string) => {
	switch (state) {
		case "running":
		case "ready":
			return "green";
		case "exited":
		case "shutdown":
			return "red";
		case "accepted":
		case "created":
			return "blue";
		default:
			return "secondary";
	}
};
