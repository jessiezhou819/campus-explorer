import express, { Application, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Log } from "@ubccpsc310/project-support";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind, NotFoundError } from "../controller/IInsightFacade";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;
	private insightFacade: any;

	constructor(port: number) {
		Log.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();
		this.insightFacade = new InsightFacade();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		this.express.use(express.static("./frontend/public"));
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			Log.info("Server::start() - start");
			if (this.server !== undefined) {
				Log.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express
					.listen(this.port, () => {
						Log.info(`Server::start() - server listening on port: ${this.port}`);
						resolve();
					})
					.on("error", (err: Error) => {
						// catches errors in server start
						Log.error(`Server::start() - server ERROR: ${err.message}`);
						reject(err);
					});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public async stop(): Promise<void> {
		Log.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				Log.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					Log.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware(): void {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({ type: "application/*", limit: "10mb" }));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes(): void {
		// Example endpoint
		this.express.get("/echo/:msg", Server.echo);

		// Dataset endpoints
		this.express.put("/dataset/:id/:kind", this.handleAddDataset.bind(this));
		this.express.delete("/dataset/:id", this.handleRemoveDataset.bind(this));
		this.express.post("/query", this.handlePerformQuery.bind(this));
		this.express.get("/datasets", this.handleListDatasets.bind(this));
	}

	private async handleAddDataset(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;
			const kind = req.params.kind as InsightDatasetKind;
			const base64Content = req.body.toString("base64");

			const result = await this.insightFacade.addDataset(id, base64Content, kind);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err instanceof Error ? err.message : String(err) });
		}
	}

	private async handleRemoveDataset(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;
			const result = await this.insightFacade.removeDataset(id);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			if (err instanceof NotFoundError) {
				// i think this is the right error type to check
				res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
			} else {
				res.status(StatusCodes.BAD_REQUEST).json({ error: err instanceof Error ? err.message : String(err) });
			}
		}
	}

	private async handlePerformQuery(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.insightFacade.performQuery(req.body);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err instanceof Error ? err.message : String(err) });
		}
	}

	private async handleListDatasets(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.insightFacade.listDatasets();
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err instanceof Error ? err.message : String(err) });
		}
	}
	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response): void {
		try {
			Log.info(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(StatusCodes.OK).json({ result: response });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err });
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}
}
