import { InsightError } from "./IInsightFacade";

function validateNumericComparator(type: string, suffix: string, value: any): void {
	const numericSuffixes = [
	"avg", "pass", "fail", "audit", "year", // Sections fields
	"lat", "lon", "seats"                   // Rooms fields
    ];
	if (!numericSuffixes.includes(suffix)) {
		throw new InsightError(`${type} comparator must be used with a numeric field`);
	}
	if (typeof value !== "number") {
		throw new InsightError(`${type} value must be a number`);
	}
}

//(written using ChatGPT)
export function validateWildcardPattern(pattern: string): void {
	if (/\*(?!$)/.test(pattern.slice(1, -1))) {
		throw new InsightError("wildcard '*' is only allowed at the beginning or end");
	}
	// const matches = [...pattern.matchAll(/\*/g)];
	// if (matches.length > 2 || (matches.length === 2 && !(pattern.startsWith("*") && pattern.endsWith("*")))) {
	// 	throw new InsightError("invalid use of multiple wildcards");
	// }
}
//(written using ChatGPT)

function validateStringComparator(suffix: string, value: any): void {
	const stringSuffixes = [
    "dept", "id", "instructor", "title", "uuid", // Sections fields

    "fullname", "shortname", "number", "name", "address",
    "type", "furniture", "href"                  // Rooms fields
	];
	if (!stringSuffixes.includes(suffix)) {
		throw new InsightError(`IS comparator must be used with a string field`);
	}
	if (typeof value !== "string") {
		throw new InsightError("IS value must be a string");
	}
}
export function isValidColumn(column: string): boolean {
	const validFieldSuffixes = [
		"_fullname", "_shortname", "_number", "_name", "_address",	// room
        "_lat", "_lon", "_seats", "_type", "_furniture", "_href", // room
		"_dept", // rest r sections
		"_id",
		"_avg",
		"_instructor",
		"_title",
		"_uuid",
		"_year",
		"_audit",
		"_pass",
		"_fail",
	];
	if (!column.includes("_")) {
        return true;
    }
	return validFieldSuffixes.some((suffix) => column.endsWith(suffix));
}
export function validateComparators(type: string, comparator: any, data: any[]): void {
	if (comparator === null || typeof comparator !== "object" || Array.isArray(comparator)) {
		throw new InsightError(`${type} must be a non null object`);
	}
	// if (!type || typeof type !== "string") { // "IS" ID
	// 	throw new InsightError("Type must be a non null string");
	// }
	const keys = Object.keys(comparator);
	if (keys.length !== 1) {
		throw new InsightError(`Invalid comparator format: expected one key, got ${keys.length}`);
	}

	const key = keys[0];
	const value = comparator[key];
	const parts = key.split("_");
	if (parts.length !== 2) {
		throw new InsightError("Key must be of form dataset_field");
	}
	const suffix = parts[1];

	if (!suffix) {
		throw new InsightError("Key must contain a datasetId and a field separated by '_'");
	}

	if (["GT", "LT", "EQ"].includes(type)) {
		validateNumericComparator(type, suffix, value);
	}

	if (type === "IS") {
		validateStringComparator(suffix, value);
	}
}

export function logicValidator(logic: any): void {
	if (!logic || !Array.isArray(logic) || logic.length === 0) {
		throw new InsightError("Logic must be a non null array");
	}
}

export function negationValidator(negation: any): void {
	if (!negation || typeof negation !== "object" || Array.isArray(negation)) {
		throw new InsightError("Negation must be a non null object");
	}
	if (Object.keys(negation).length === 0) {
		throw new InsightError("NOT filter must contain a valid sub-filter");
	}
}

export function optionsValidator(options: any, columns: any): void {
	if (options.ORDER) {
		if (typeof options.ORDER === "string") {
			if (!columns.includes(options.ORDER)) {
				throw new InsightError(`ORDER key "${options.ORDER}" must be in COLUMNS`);
			}
		} else if (typeof options.ORDER === "object") {
			// here
			if (!Array.isArray(options.ORDER.keys)) {
				throw new InsightError("ORDER.keys must be an array");
			}
			for (const key of options.ORDER.keys) {
				if (!columns.includes(key)) {
					throw new InsightError(`ORDER key "${key}" must be in COLUMNS`); // to here
				}
			}
		}
	}
}
