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
// import { isValidColumn, logicValidator, negationValidator, optionsValidator, validateComparators, validateWildcardPattern } from "./QueryValidation";
import { getAllDatasetIds, handleWhere, handleOptions } from "./QueryHandling";
//import { optionsValidator, validateComparators } from "./QueryValidation";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private OVERALL_YEAR: number = 1900;
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
			this.datasetMap = new Map(saved.map((ds) => [ds.id, ds]));

			const dataReadPromises = saved.map(async (ds) => {
				const dataPath = `data/${ds.id}.json`;
				if (await fs.pathExists(dataPath)) {
					const sections: Section[] = await fs.readJSON(dataPath);
					this.datasetDataMap.set(ds.id, sections);
				}
			});

			await Promise.all(dataReadPromises);
		}

		this.isInitialized = true;
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.ensureInitialized();
		this.validateId(id);
		if (this.datasetMap.has(id)) {
			throw new InsightError("duplicate dataset");
		}

		if (!content || typeof content !== "string") {
			throw new InsightError("Empty content");
		}

		let courses: JSZip;
		try {
			courses = await JSZip.loadAsync(content, { base64: true });
		} catch (_err) {
			throw new InsightError("Invalid content");
		}

		const hasCoursesFolderAtRoot: boolean = Object.keys(courses.files).some((filePath) =>
			filePath.startsWith("courses/")
		);
		if (!hasCoursesFolderAtRoot) {
			throw new InsightError("Invalid dataset structure: 'courses/' folder not found at root");
		}

		const coursesFolder = courses.folder("courses");
		const sections = await this.processSections(coursesFolder);

		if (sections.length === 0) {
			throw new InsightError("No valid sections found");
		}

		this.datasetMap.set(id, { id: id, kind: kind, numRows: sections.length });
		await fs.outputJSON(this.dataDir, Array.from(this.datasetMap.values()));

		await fs.outputJSON(`data/${id}.json`, sections); // save data rows
		this.datasetDataMap.set(id, sections);
		return Array.from(this.datasetMap.keys());
	}

	private validateId(id: string): void {
		if (!id || id.trim() === "" || id.includes("_")) {
			throw new InsightError("invalid id");
		}
	}

	private async processSections(courses: JSZip | null): Promise<Section[]> {
		if (!courses) throw new InsightError("courses folder null");
		const results: Section[] = [];

		const filePromises = Object.values(courses.files).map(async (file) => {
			if (file.dir) return;

			try {
				const content = await file.async("text");
				const parsedCourse = JSON.parse(content);

				if (!parsedCourse.hasOwnProperty("result") || !Array.isArray(parsedCourse.result)) {
					throw new InsightError(`Invalid course structure in file: ${file.name}`);
				}

				for (const section of parsedCourse.result) {
					const parsedSection: Section = this.parseSection(section);
					results.push(parsedSection);
				}
			} catch (_err) {
				// skip files that cannot be parsed
			}
		});
		await Promise.all(filePromises);
		return results;
	}

	private parseSection(section: any): Section {
		if (!this.isValidSection(section)) {
			throw new InsightError(`Invalid section structure`);
		}
		try {
			const sectionInterface: Section = {
				uuid: section.id as string, // Use section.id if uuid is not present
				id: section.Course as string,
				title: section.Title as string,
				instructor: section.Professor as string,
				dept: section.Subject as string,
				year: section.Section === "overall" ? this.OVERALL_YEAR : Number(section.Year),
				avg: parseFloat(section.Avg),
				pass: parseInt(section.Pass),
				fail: parseInt(section.Fail),
				audit: parseInt(section.Audit),
			};
			return sectionInterface;
		} catch (error) {
			throw new InsightError(`Error parsing section: ${error}`);
		}
	}

	private isValidSection(section: any): boolean {
		const requiredFields = ["id", "Course", "Title", "Professor", "Subject", "Year", "Avg", "Pass", "Fail", "Audit"];
		return requiredFields.every((key) => key in section && section[key] !== undefined && section[key] !== null);
	}

	public async removeDataset(id: string): Promise<string> {
		await this.ensureInitialized();
		this.validateId(id);
		if (!this.datasetMap.has(id)) {
			throw new NotFoundError("dataset not found");
		}

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
			throw new InsightError("handleWhere() did not retrn an array");
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
