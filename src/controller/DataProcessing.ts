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

export async function handleSections(zip: JSZip): Promise<Section[]> {
	await validateZipStructure(zip, "courses");
	const coursesFolder = zip.folder("courses");
	const sections: Section[] = await processSections(coursesFolder);
	return sections;
}

export async function handleRooms(zip: JSZip): Promise<Room[]> {
	if (!zip.file("index.htm")) {
		throw new InsightError("index.htm not found in zip");
	}
	if (!zip.folder("campus/discover/buildings-and-classrooms/")) {
		throw new InsightError("No campus/discover/buildings-and-classrooms folder");
	}

	const indexFile = zip.file("index.htm");
	const textContent = await indexFile?.async("text");
	if (typeof textContent !== "string") throw new InsightError("index.htm could not be read");

	const html = parse5.parse(textContent);
	const validTable = findValidTable(html);
	if (!validTable) throw new InsightError("Buildings table not found");
	const buildings = await constructBuildingsList(validTable);
	if (buildings.length === 0) throw new InsightError("No valid buildings found");

	const rooms: Room[] = [];
	await Promise.all(
		buildings.map(async (building) => {
			const buildingFile = zip.file(building.href.replace("./", "")); // href: './campus/discover/buildings-and-classrooms/ACU.htm'
			if (!buildingFile) {
				throw new InsightError(`Building file ${building.href} not found in zip`);
			}
			const buildingHTML = await buildingFile.async("text");
			if (typeof buildingHTML !== "string") throw new InsightError("building.html could not be read");

			const parsedBuilding = parse5.parse(buildingHTML);
			rooms.push(...(await parseBuildingRooms(building, parsedBuilding))); // github copilot
		})
	);

	return rooms;

	// parse the index.htm file using parse5
	// Inside index.htm find the valid building file link based on the class name
	// Inside building.htm find the room table and validate the rooms before adding them to the result
	// if result is empty, throw an InsightError
}

function findValidTable(node: any): any | null {
	if (node.tagName !== undefined && node.tagName === "table") {
		if (tableContainsFieldinTd(node)) {
			return node;
		}
	}
	if ("childNodes" in node) {
		for (const child of node.childNodes) {
			const foundTable = findValidTable(child);
			if (foundTable) {
				return foundTable;
			}
		}
	}
	return null;
}

function tableContainsFieldinTd(tableNode: any): boolean {
	// go to tbody -> check each tr -> check each td to to see if .attr .class contains views-field
	const stack = [...tableNode.childNodes];
	while (stack.length > 0) {
		const currNode = stack.pop(); // might be tbody, tr, td, etc.
		if (currNode.tagName !== "undefined" && currNode.tagName === "td") {
			const classAttr = currNode.attrs.find((attr: any) => attr.name === "class");
			if (classAttr?.value.includes("views-field")) {
				return true;
			}
		}
		if ("childNodes" in currNode) {
			stack.push(...currNode.childNodes);
		}
	}
	return false;
}

// use promise all to speed up?
async function constructBuildingsList(tableNode: any): Promise<any[]> {
	const buildings: any[] = [];

	for (const child of tableNode.childNodes) {
		if (child.tagName === "tbody") {
			for (const row of child.childNodes) {
				if (row.tagName !== "tr") continue;

				let link = "";
				let fullname = "";
				let shortname = "";
				let address = "";

				for (const cell of row.childNodes) {
					if (cell.tagName !== "td") continue;

					const classAttr = cell.attrs?.find((attr: any) => attr.name === "class")?.value || "";

					if (classAttr.includes("views-field-title")) {
						const aTag = cell.childNodes?.find((c: any) => c.tagName === "a");
						if (aTag) {
							link = aTag.attrs?.find((attr: any) => attr.name === "href")?.value || "";
							fullname = extractText(aTag).trim();
						}
					}

					if (classAttr.includes("views-field-field-building-address")) {
						address = extractText(cell).trim();
					}

					if (classAttr.includes("views-field-field-building-code")) {
						shortname = extractText(cell).trim();
					}
				}

				if (link && fullname && shortname && address) {
					buildings.push({ href: link, fullname, shortname, address });
				}
			}
		}
	}
	return buildings;
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
	const encodedAddress = encodeURIComponent(address);
	const geolocation = await fetch(`http://cs310.students.cs.ubc.ca:11316/api/v1/project_team051/${encodedAddress}`);
	return geolocation.json();
}

async function parseBuildingRooms(building: any, buildingHTML: any): Promise<Room[]> {
	const rooms: Room[] = [];
	const roomsTable = findValidTable(buildingHTML);

	if (!roomsTable) return rooms;

	const geolocation: GeoResponse = await getBuildingGeolocation(building.address);
	if (geolocation.error || !geolocation.lat || !geolocation.lon) return rooms;

	const tbodyNode = roomsTable.childNodes.find((node: any) => node.tagName === "tbody");
	if (!tbodyNode) return rooms;

	for (const row of tbodyNode.childNodes) {
		if (row.tagName !== "tr") continue;

		const room: Room = {
			fullname: building.fullname,
			shortname: building.shortname,
			number: "",
			name: "", // You might need to populate this elsewhere
			address: building.address,
			lat: geolocation.lat,
			lon: geolocation.lon,
			seats: 0,
			type: "",
			furniture: "",
			href: building.href,
		};
		populateRoomDetails(row, room);
		if (room.number && room.type && room.seats > 0 && room.furniture) {
			room.name = `${building.shortname}_${room.number}`;
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
		else if (classAttr.includes("views-field-field-room-capacity")) room.seats = parseInt(text, 10);
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
