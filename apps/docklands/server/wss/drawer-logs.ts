import type http from "node:http";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { validateRequest } from "@/server/core/lib/auth";
import { createLogger } from "@/server/core/lib/logger";
import { appRouter } from "../api/root";
import { createWebSocketTRPCContext, logTRPCError } from "../api/trpc";

const logger = createLogger("wss-drawer-logs");

export const setupDrawerLogsWebSocketServer = (
	runtimeWorker: http.Server<
		typeof http.IncomingMessage,
		typeof http.ServerResponse
	>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/drawer-logs",
	});

	// Set up tRPC WebSocket handler
	applyWSSHandler({
		wss: wssTerm,
		router: appRouter,
		createContext: createWebSocketTRPCContext,
		onError: ({ error, path, type }) => logTRPCError({ error, path, type }),
	});

	runtimeWorker.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/drawer-logs") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	wssTerm.on("connection", async (ws, req) => {
		const _url = new URL(req.url || "", `http://${req.headers.host}`);
		const { user, session } = await validateRequest(req);

		if (!user || !session) {
			logger.warn("drawer-logs ws rejected: no session");
			ws.close();
			return;
		}
	});
};
