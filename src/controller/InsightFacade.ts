import JSZip from "jszip";
import fs from "fs-extra";
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "./IInsightFacade";
import { Section } from "./Interface";
import { getAllDatasetIds, handleWhere, handleOptions } from "./QueryHandling";
import { handleSections, loadZipFromBase64, validateId } from "./DataProcessing";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private static readonly MAX_RESULT_ROWS: number = 5000;
	private dataDir: string;
	private datasetMap: Map<string, InsightDataset>;
	private datasetDataMap: Map<string, Section[]>;
	private isInitialized = false;

	constructor() {
		this.datasetMap = new Map<string, InsightDataset>();
		this.datasetDataMap = new Map<string, Section[]>(); // actually store sections
		this.dataDir = "data/datasets.json";
	}

	private async ensureInitialized(): Promise<void> {
		if (this.isInitialized) return;

		if (await fs.pathExists(this.dataDir)) {
			const saved: InsightDataset[] = await fs.readJSON(this.dataDir);

			const dataReadPromises = saved.map(async (ds) => {
				const datasetId: string = ds.id;
				const dataPath = `data/${datasetId}.json`;

				if (await fs.pathExists(dataPath)) {
					const sections: Section[] = await fs.readJSON(dataPath);
					this.datasetDataMap.set(datasetId, sections);
					this.datasetMap.set(datasetId, ds);
				}
			});

			await Promise.all(dataReadPromises);
		}
		this.isInitialized = true;
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		validateId(id);
		await this.ensureInitialized();

		if (this.datasetMap.has(id)) throw new InsightError("duplicate dataset");

		const zip: JSZip = await loadZipFromBase64(content);
		let result: any[] = []; // For C1 only: Section[]

		if (kind === InsightDatasetKind.Sections) {
			result = await handleSections(zip);
		} else if (kind === InsightDatasetKind.Rooms) {
			throw new InsightError("Rooms dataset not implemented yet");
		}

		if (result.length === 0) throw new InsightError("No valid sections found");

		this.datasetMap.set(id, { id: id, kind: kind, numRows: result.length }); // Store dataset metadata
		this.datasetDataMap.set(id, result); // Store all sections data based on dataset id

		await fs.outputJSON(this.dataDir, Array.from(this.datasetMap.values()));
		await fs.outputJSON(`data/${id}.json`, result);

		return Array.from(this.datasetMap.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		validateId(id);
		await this.ensureInitialized();

		if (!this.datasetMap.has(id)) throw new NotFoundError("dataset not found");

		try {
			this.datasetMap.delete(id);
			await fs.outputJSON(this.dataDir, Array.from(this.datasetMap.values()));
		} catch (error) {
			throw new InsightError(`Failed to remove dataset: ${error}`);
		}

		return id;
	}

	public async performQuery(query: any): Promise<InsightResult[]> {
		await this.ensureInitialized();
		if (!query || typeof query !== "object") {
			throw new InsightError("Query must be an object");
		}
		if (!("WHERE" in query) || !("OPTIONS" in query) || !("COLUMNS" in query.OPTIONS)) {
			throw new InsightError("Missing WHERE or OPTIONS");
		}
		if (!Array.isArray(query.OPTIONS.COLUMNS) || query.OPTIONS.COLUMNS.length === 0) {
			throw new InsightError("COLUMNS invalid format");
		}

		const ids = getAllDatasetIds(query);
		if (ids.size > 1) {
			throw new InsightError("too many datasets in query");
		}
		const col = query.OPTIONS.COLUMNS[0];
		const datasetId = col.split("_")[0];
		const sections = this.datasetDataMap.get(datasetId);
		if (!sections) {
			throw new InsightError("Dataset data not loaded");
		}

		const filtered = handleWhere(query.WHERE, sections);
		if (!Array.isArray(filtered)) {
			throw new InsightError("handleWhere() did not return an array");
		}
		const result = handleOptions(query.OPTIONS, filtered);
		if (result.length > InsightFacade.MAX_RESULT_ROWS) {
			throw new ResultTooLargeError(`Query result exceeds ${InsightFacade.MAX_RESULT_ROWS} rows`);
		}
		return result;
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.ensureInitialized();
		return Array.from(this.datasetMap.values());
	}
}
