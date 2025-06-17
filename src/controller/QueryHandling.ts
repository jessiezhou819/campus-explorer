import { InsightError, InsightResult } from "./IInsightFacade";
import {
	logicValidator,
	negationValidator,
	validateComparators,
	validateWildcardPattern,
	isValidColumn,
	optionsValidator,
} from "./QueryValidation";

export function getAllDatasetIds(query: any): Set<string> {
	const ids = new Set<string>();

	const getKey = (key: string): string => {
		if (typeof key === "string" && key.includes("_")) {
			ids.add(key.split("_")[0]);
		}
		return key;
	};

	const checkWhere = (filter: any): void => {
		if (!filter || typeof filter !== "object" || filter === null) return;
		const [type] = Object.keys(filter);
		const value = filter[type];
		if (["AND", "OR"].includes(type)) {
			logicValidator(value);
			value.forEach(checkWhere); // recursively check nested condition
		} else if (type === "NOT") {
			negationValidator(value);
			checkWhere(value);
		} else if (value && typeof value === "object") {
			validateComparators(type, value, []); // validate comparators
			getKey(Object.keys(value)[0]); // check for keys in comparators
		}
	};

	checkWhere(query.WHERE);

	query.OPTIONS?.COLUMNS?.forEach(getKey);

	const order = query.OPTIONS?.ORDER;
	if (typeof order === "string") getKey(order);
	else if (order?.keys) order.keys.forEach(getKey);

	return ids;
}

export function handleWhere(this: any, where: any, data: any): any[] {
	if (!Array.isArray(data)) {
		throw new InsightError("handleWhere() expects data to be an array");
	}
	if (where === null || typeof where !== "object" || Array.isArray(where)) {
		throw new InsightError("WHERE must be an object");
	}

	if (Object.keys(where).length === 0) {
		return data;
	}
	const [comparatorType] = Object.keys(where);
	const comparator = where[comparatorType];

	switch (comparatorType) {
		case "AND":
			return handleAnd(comparator, data);
		case "OR":
			return handleOr(comparator, data);
		case "NOT":
			return handleNot(comparator, data);
		case "GT":
		case "LT":
		case "EQ":
		case "IS":
			return handleComparator(comparatorType, comparator, data);
		default:
			throw new InsightError("Unknown filter type");
	}
}

export function handleAnd(this: any, comparator: any, data: any[]): any[] {
	logicValidator(comparator);
	let andResult = data;
	for (const sub of comparator) {
		andResult = commonToBoth(andResult, handleWhere(sub, data));
	}
	return andResult;
}

export function handleOr(comparator: any, data: any[]): any[] {
	logicValidator(comparator);
	return removeDups(comparator.map((sub: any) => handleWhere(sub, data)));
}

export function handleNot(comparator: any, data: any[]): any[] {
	negationValidator(comparator);
	const negated = handleWhere(comparator, data);
	return data.filter((row: any) => !negated.includes(row));
}

export function handleComparator(comparatorType: string, comparator: any, data: any[]): any[] {
	validateComparators(comparatorType, comparator, data);
	return applyComparator(comparatorType, comparator, data);
}
export function commonToBoth(array1: any[], array2: any[]): any[] {
	const set2 = new Set(array2);
	return array1.filter((item) => set2.has(item));
}

export function applyComparator(type: string, comparator: any, data: any[]): any[] {
	const keys = Object.keys(comparator);

	if (keys.length !== 1) {
		throw new InsightError(`Invalid comparator format: expected one key, got ${keys.length}`);
	}

	const key = keys[0];
	const value = comparator[key];
	const split = key.split("_");
	if (split.length !== 2) {
		throw new InsightError("Invalid key format");
	}
	const field = split[1]; // "year"
	switch (type) {
		case "GT":
			return data.filter((r) => r[field] > value);
		case "LT":
			return data.filter((r) => r[field] < value);
		case "EQ":
			return data.filter((r) => r[field] === value);
		case "IS":
			if (value === "") {
				return data.filter((r) => {
					if (!(field in r)) throw new InsightError(`Field ${field} not present in row`);
					return r[field] === "";
				});
			}
			validateWildcardPattern(value); // ADD THIS LINE
			return data.filter((r) => {
				if (!(field in r)) throw new InsightError(`Field ${field} not present in row`);
				return matchWildcard(r[field], value);
			});
		default:
			throw new InsightError("Invalid mComparator type");
	}
}

export function matchWildcard(actual: string, pattern: any): boolean {
	if (typeof pattern !== "string" || typeof actual !== "string") {
		throw new InsightError("IS comparator must compare strings");
	}

	//(written using ChatGPT)
	const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
	return regex.test(actual);
	//(written using ChatGPT)
}

export function removeDups(arrays: any[][]): any[] {
	const seen = new Set();
	const result: any[] = [];
	for (const arr of arrays) {
		for (const item of arr) {
			if (!seen.has(item)) {
				seen.add(item);
				result.push(item);
			}
		}
	}
	return result;
}

export function handleOptions(options: any, data: any[]): InsightResult[] {
	const columns = options.COLUMNS;
	if (!Array.isArray(data)) {
		throw new InsightError("Data must be an array");
	}
	for (const col of columns) {
		if (typeof col !== "string" || !isValidColumn(col)) {
			throw new InsightError(`Invalid column name: ${col}`);
		}
	}
	let result = data.map((row) =>
		Object.fromEntries(
			columns.map((col: any) => {
				const field = col.split("_")[1];
				return [col, row[field]];
			})
		)
	);
	optionsValidator(options, columns);

	if (options.ORDER) {
		result = sortResults(result, options.ORDER);
	}

	return result;
}

export function sortResults(data: InsightResult[], order: any): InsightResult[] {
	const key = order;
	return data.sort((a, b) => {
		if (a[key] < b[key]) return -1;
		if (a[key] > b[key]) return 1;
		return 0;
	});
}
