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
import { handleRooms, handleSections, loadZipFromBase64, validateId } from "./DataProcessing";
import { handleTransformations } from "./QueryAggregation";
import { performQueryValidator, transformationValidator } from "./QueryValidation";

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
					this.datasetMap.set(datasetId, ds); // Restore metadata
					this.datasetDataMap.set(datasetId, data); // Restore dataset rows
				} else {
					// optional: warn or clean up if data file is missing
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
		let result: Section[] | Room[] = [];

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
		performQueryValidator(query);

		const ids = getAllDatasetIds(query);
		const datasetId = [...ids][0];
		const datasetRows = this.datasetDataMap.get(datasetId);
		if (!datasetRows) throw new InsightError(`Dataset ${datasetId} not loaded`);

		let filtered = handleWhere(query.WHERE, datasetRows);
		if (!Array.isArray(filtered)) throw new InsightError("handleWhere() did not return an array");

		const applyKeys: string[] = []; // array of columns if transformation is present
		const transformation = "TRANSFORMATIONS" in query;

		if (transformation) {
			transformationValidator(query.TRANSFORMATIONS);
			const { GROUP, APPLY } = query.TRANSFORMATIONS;
			if (!Array.isArray(GROUP) || !Array.isArray(APPLY)) throw new InsightError("GROUP and APPLY must both be arrays");
			applyKeys.push(...GROUP); // keys included in GROUP

			for (const applyRule of APPLY) {
				if (!applyRule || typeof applyRule !== "object" || Array.isArray(applyRule))
					throw new InsightError("Each APPLY rule must be a non-null object");
				const keys = Object.keys(applyRule);
				if (keys.length !== 1) throw new InsightError("Each APPLY rule must have exactly one key");
				const key = keys[0];
				if (!key || key.trim() === "" || key.includes("_")) throw new InsightError("Invalid apply key");
				applyKeys.push(keys[0]); // customized keys in APPLY
			}

			const results = handleTransformations(filtered, GROUP, APPLY);
			filtered = results;
		}

		const result = handleOptions(query.OPTIONS, filtered, transformation, applyKeys);
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
