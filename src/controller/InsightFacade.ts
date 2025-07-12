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
import { Room, Section } from "./Interface";
import { getAllDatasetIds, handleWhere, handleOptions } from "./QueryHandling";
import { getDatasetId, handleRooms, handleSections, loadZipFromBase64, validateId } from "./DataProcessing";
import { handleTransformations } from "./QueryAggregation";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private static readonly MAX_RESULT_ROWS: number = 5000;
	private dataDir: string;
	private datasetMap: Map<string, InsightDataset>;
	private datasetDataMap: Map<string, any[]>; // stores Section[] | Room[]
	private isInitialized = false;

	constructor() {
		this.datasetMap = new Map<string, InsightDataset>();
		this.datasetDataMap = new Map<string, any[]>(); // actually store sections
		this.dataDir = "data/datasets.json";
	}

private async ensureInitialized(): Promise<void> {
	if (this.isInitialized) return;

	const metaPath = `${this.dataDir}/index.json`;
	if (await fs.pathExists(metaPath)) {
		const saved: InsightDataset[] = await fs.readJSON(metaPath);

		const dataReadPromises = saved.map(async (ds) => {
			const datasetId = ds.id;
			const dataPath = `${this.dataDir}/${datasetId}.json`;

			if (await fs.pathExists(dataPath)) {
				const data = await fs.readJSON(dataPath);
				this.datasetMap.set(datasetId, ds);           // Restore metadata
				this.datasetDataMap.set(datasetId, data);     // Restore dataset rows
			} else {
				// Optional: warn or clean up if data file is missing
				console.warn(`Warning: Data file missing for ${datasetId}`);
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
		let result: Section[] | Room[] = []; // For C1 only: Section[]

		if (kind === InsightDatasetKind.Sections) {
			result = await handleSections(zip);
		} else if (kind === InsightDatasetKind.Rooms) {
			result = await handleRooms(zip);
		}

		if (result.length === 0) throw new InsightError("No valid sections or rooms found");

		this.datasetMap.set(id, { id: id, kind: kind, numRows: result.length }); // Store dataset metadata
		this.datasetDataMap.set(id, result); // Store all sections data based on dataset id

		await fs.outputJSON(`${this.dataDir}/index.json`, Array.from(this.datasetMap.values()));
		await fs.outputJSON(`${this.dataDir}/${id}.json`, result);
		//console.log([...this.datasetDataMap.keys()]);

		return Array.from(this.datasetMap.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		validateId(id);
		await this.ensureInitialized();

		if (!this.datasetMap.has(id)) throw new NotFoundError("dataset not found");

		try {
			this.datasetMap.delete(id);
			this.datasetDataMap.delete(id);
			await fs.outputJSON(`${this.dataDir}/index.json`, Array.from(this.datasetMap.values()));
			const dataPath = `${this.dataDir}/${id}.json`;
			if (await fs.pathExists(dataPath)) {
				await fs.remove(dataPath);
			}
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
		// console.log("DEBUG: Starting performQuery");
    	// console.log("DEBUG: Full Query =", JSON.stringify(query, null, 2));

		const ids = getAllDatasetIds(query);
		if (ids.size !== 1) {
			throw new InsightError("too many datasets in query");
		}
		// console.log("DEBUG: Dataset IDs found in query =", ids);

		const datasetId = [...ids][0];
		const datasetRows = this.datasetDataMap.get(datasetId);
		if (!datasetRows) {
			throw new InsightError(`Dataset ${datasetId} not loaded`);
		}
		// console.log(`DEBUG: Loaded dataset '${datasetId}' with ${datasetRows.length} rows`);

		let filtered = handleWhere(query.WHERE, datasetRows);
		if (!Array.isArray(filtered)) {
			throw new InsightError("handleWhere() did not return an array");
		}
		// console.log("DEBUG: Rows after WHERE filter =", filtered.length);

		if ("TRANSFORMATIONS" in query) {
			// console.log("DEBUG: Entering handleTransformations");
			// console.log("DEBUG: TRANSFORMATIONS =", JSON.stringify(query.TRANSFORMATIONS, null, 2));
			const results = handleTransformations(filtered, query.TRANSFORMATIONS.GROUP, query.TRANSFORMATIONS.APPLY);
			// console.log("DEBUG: Final transformed results =", JSON.stringify(results, null, 2));
			filtered = results;

		}
		const result = handleOptions(query.OPTIONS, filtered);
		// console.log("DEBUG: Rows after handleOptions =", result.length);
		if (result.length > InsightFacade.MAX_RESULT_ROWS) {
			throw new ResultTooLargeError(`Query result exceeds ${InsightFacade.MAX_RESULT_ROWS} rows`);
		}
		// console.log("DEBUG: Final Query Result =", JSON.stringify(result, null, 2));
		return result;
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.ensureInitialized();
		return Array.from(this.datasetMap.values());
	}
}
