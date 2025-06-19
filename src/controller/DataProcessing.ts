import JSZip from "jszip";
import { InsightError } from "./IInsightFacade";
import { Section } from "./Interface";

const OVERALL_YEAR: number = 1900;

export function validateId(id: string): void {
	if (!id || id.trim() === "" || id.includes("_")) {
		throw new InsightError("invalid id");
	}
}

export async function loadZipFromBase64(content: string): Promise<JSZip> {
	if (!content || typeof content !== "string") {
		throw new InsightError("Empty content");
	}

	try {
		const courses = await JSZip.loadAsync(content, { base64: true });
		return courses;
	} catch (_err) {
		throw new InsightError("Invalid content");
	}
}

export async function handleSections(zip: JSZip): Promise<Section[]> {
	await validateZipStructure(zip, "courses");
	const coursesFolder = zip.folder("courses");
	const sections: Section[] = await processSections(coursesFolder);
	return sections;
}

export async function validateZipStructure(courses: JSZip, folderExpected: string): Promise<void> {
	const hasCoursesFolderAtRoot: boolean = Object.keys(courses.files).some((filePath) =>
		filePath.startsWith(`${folderExpected}/`)
	);
	if (!hasCoursesFolderAtRoot) {
		throw new InsightError(`Invalid dataset structure: '${folderExpected}/' folder not found at root`);
	}
}

export async function processSections(courses: JSZip | null): Promise<Section[]> {
	if (!courses) throw new InsightError("courses folder null");
	const results: Section[] = [];

	// Partially written using ChatGPT (Promise.all logic)
	const sectionPromises = Object.values(courses.files).map(async (file) => {
		if (file.dir) return;

		try {
			const content = await file.async("text");
			const parsedCourse = JSON.parse(content);

			if (!parsedCourse.hasOwnProperty("result") || !Array.isArray(parsedCourse.result)) {
				throw new InsightError(`Invalid course structure in file: ${file.name}`);
			}

			for (const section of parsedCourse.result) {
				const parsedSection: Section = parseSection(section);
				results.push(parsedSection);
			}
		} catch (_err) {
			// skip files that cannot be parsed
		}
	});
	await Promise.all(sectionPromises);
	return results;
}
// Partially written using ChatGPT

export function parseSection(section: any): Section {
	if (!isValidSection(section)) {
		throw new InsightError(`Invalid section structure`);
	}
	try {
		const sectionInterface: Section = {
			uuid: String(section.id),
			id: String(section.Course),
			title: String(section.Title),
			instructor: String(section.Professor),
			dept: String(section.Subject),
			year: section.Section === "overall" ? OVERALL_YEAR : Number(section.Year),
			avg: Number(section.Avg),
			pass: Number(section.Pass),
			fail: Number(section.Fail),
			audit: Number(section.Audit),
		};
		return sectionInterface;
	} catch (error) {
		throw new InsightError(`Error parsing section: ${error}`);
	}
}

export function isValidSection(section: any): boolean {
	const requiredFields = ["id", "Course", "Title", "Professor", "Subject", "Year", "Avg", "Pass", "Fail", "Audit"];

	return (
		requiredFields.every((key) => key in section && section[key] !== undefined && section[key] !== null) &&
		!isNaN(Number(section.Avg)) &&
		!isNaN(Number(section.Pass)) &&
		!isNaN(Number(section.Fail)) &&
		!isNaN(Number(section.Audit)) &&
		!isNaN(Number(section.Year))
	);
}
