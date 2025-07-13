import JSZip from "jszip";
import { InsightError } from "./IInsightFacade";
import { GeoResponse, Room, Section } from "./Interface";
import * as parse5 from "parse5";

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
export function getDatasetId(columns: string[]): string {
    for (const col of columns) {
        if (col.includes("_")) {
            return col.split("_")[0];
        }
    }
    throw new InsightError("No dataset ID found in COLUMNS");
}

export async function handleSections(zip: JSZip): Promise<Section[]> {
	await validateZipStructure(zip, "courses");
	const coursesFolder = zip.folder("courses");
	const sections: Section[] = await processSections(coursesFolder);
	return sections;
}

export async function handleRooms(zip: JSZip): Promise<Room[]> {
	const indexFile = zip.file("index.htm");
	if (!indexFile) throw new InsightError("index.htm not found in zip");

	if (!zip.folder("campus/discover/buildings-and-classrooms/")) {
		throw new InsightError("Expected folder not found: campus/discover/buildings-and-classrooms/");
	}

	const rawHtml = await indexFile.async("text");
	if (typeof rawHtml !== "string") {
		throw new InsightError("index.htm could not be read as text");
	}

	const parsedIndex = parse5.parse(rawHtml);
	const buildingsTable = findValidTable(parsedIndex);
	if (!buildingsTable) {
		throw new InsightError("Valid building table not found in index.htm");
	}

	const buildings = await constructBuildingsList(buildingsTable);
	if (buildings.length === 0) {
		throw new InsightError("No valid buildings found in index.htm");
	}

	const roomResults: Room[] = [];

	await Promise.all(
		buildings.map(async (building) => {
			const buildingPath = building.href.replace("./", "");
			const buildingFile = zip.file(buildingPath);

			if (!buildingFile) return;

			const buildingText = await buildingFile.async("text");
			if (typeof buildingText !== "string") return;

			const buildingHtml = parse5.parse(buildingText);
			const parsedRooms = await parseBuildingRooms(building, buildingHtml);
			roomResults.push(...parsedRooms);
		})
	);

	return roomResults;
}

function findValidTable(node: any): any | null {
	if (node?.tagName === "table" && tableContainsFieldInTd(node)) {
		return node;
	}

	if (node?.childNodes) {
		for (const child of node.childNodes) {
			const found = findValidTable(child);
			if (found) return found;
		}
	}

	return null;
}

function tableContainsFieldInTd(tableNode: any): boolean {
	const stack = [...(tableNode.childNodes || [])];

	while (stack.length > 0) {
		const node = stack.pop();
		if (node?.tagName === "td") {
			const classAttr = node.attrs?.find((attr: any) => attr.name === "class")?.value;
			if (classAttr?.includes("views-field")) {
				return true;
			}
		}
		if (node?.childNodes) {
			stack.push(...node.childNodes);
		}
	}

	return false;
}

async function constructBuildingsList(tableNode: any): Promise<any[]> {
	const buildings: any[] = [];

	const tbody = tableNode.childNodes?.find((child: any) => child.tagName === "tbody");
	if (!tbody) return buildings;

	for (const row of tbody.childNodes || []) {
		if (row.tagName !== "tr") continue;
		const building = parseBuildingRow(row);
		if (building) buildings.push(building);
	}

	return buildings;
}

function parseBuildingRow(row: any): any | null {
	let link = "",
		fullname = "",
		shortname = "",
		address = "";

	for (const cell of row.childNodes || []) {
		if (cell.tagName !== "td") continue;
		const classAttr = cell.attrs?.find((attr: any) => attr.name === "class")?.value || "";

		if (classAttr.includes("views-field-title")) {
			const aTag = cell.childNodes?.find((c: any) => c.tagName === "a");
			if (aTag) {
				link = aTag.attrs?.find((attr: any) => attr.name === "href")?.value || "";
				fullname = extractText(aTag).trim();
			}
		} else if (classAttr.includes("views-field-field-building-address")) {
			address = extractText(cell).trim();
		} else if (classAttr.includes("views-field-field-building-code")) {
			shortname = extractText(cell).trim();
		}
	}

	return link && fullname && shortname && address ? { href: link, fullname, shortname, address } : null;
}

function extractText(node: any): string {
	if (node.nodeName === "#text") {
		return node.value || "";
	}
	if (!node.childNodes) {
		return "";
	}
	return node.childNodes.map(extractText).join("");
}

async function getBuildingGeolocation(address: string): Promise<GeoResponse> {
	try {
		const encodedAddress = encodeURIComponent(address);
		const response = await fetch(`http://cs310.students.cs.ubc.ca:11316/api/v1/project_team051/${encodedAddress}`);

		if (!response.ok) {
			return { error: `Geolocation fetch failed with status ${response.status}` };
		}

		const geolocation = await response.json();
		return geolocation;
	} catch (_err) {
		return { error: "Geolocation fetch failed" };
	}
}

async function parseBuildingRooms(building: any, buildingHTML: any): Promise<Room[]> {
	const rooms: Room[] = [];

	const table = findValidTable(buildingHTML);
	if (!table) return rooms;

	const tbody = table.childNodes?.find((n: any) => n.tagName === "tbody");
	if (!tbody) return rooms;

	const geo = await getBuildingGeolocation(building.address);
	if (geo.error || !geo.lat || !geo.lon) return rooms;

	for (const row of tbody.childNodes || []) {
		if (row.tagName !== "tr") continue;

		const room: Room = {
			fullname: building.fullname,
			shortname: building.shortname,
			number: "",
			name: "",
			address: building.address,
			lat: geo.lat,
			lon: geo.lon,
			seats: 0,
			type: "",
			furniture: "",
			href: building.href,
		};

		populateRoomDetails(row, room);

		if (room.number && room.type && room.furniture && room.seats > 0) {
			room.name = `${room.shortname}_${room.number}`;
			rooms.push(room);
		}
	}

	return rooms;
}

function populateRoomDetails(row: any, room: Room): void {
	for (const cell of row.childNodes) {
		if (cell.tagName !== "td") continue;

		const classAttr = cell.attrs?.find((attr: any) => attr.name === "class")?.value;
		const text = extractText(cell).trim();

		if (classAttr.includes("views-field-field-room-number")) room.number = text;
		else if (classAttr.includes("views-field-field-room-capacity")) room.seats = Number(text);
		else if (classAttr.includes("views-field-field-room-furniture")) room.furniture = text;
		else if (classAttr.includes("views-field-field-room-type")) room.type = text;
	}
}

export async function validateZipStructure(zip: JSZip, folderExpected: string): Promise<void> {
	const hasCoursesFolderAtRoot: boolean = Object.keys(zip.files).some((filePath) =>
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
