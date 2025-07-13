import Decimal from "decimal.js";
import { InsightError } from "./IInsightFacade";
import { validateNumericComparator } from "./QueryValidation";

export function handleTransformations(filtered: any[], group: string[], apply: any[]): any[] {
	const groupby = groupBy(filtered, group);
	const results: any[] = [];
	for (const [key, rows] of groupby.entries()) {
		const groupObj = applyRulesToGroup(rows, group, key, apply);
		results.push(groupObj);
	}

	return results;
}

function groupBy(filtered: any[], GROUP: string[]): Map<string, any[]> {
	const groupMap = new Map<string, any[]>();

	for (const item of filtered) {
		const groupValues = GROUP.map((key) => {
			const field = key.split("_")[1]; // strip dataset prefix
			if (!(field in item)) {
				throw new InsightError(`Field ${field} not found in row`);
			}
			return String(item[field]);
		});
		//written by ChatGPT
		const groupKey = groupValues.join("|"); // unique identifier for this group

		if (!groupMap.has(groupKey)) {
			groupMap.set(groupKey, []);
		}
		groupMap.get(groupKey)?.push(item);
	}
	// end of written by ChatGPT
	return groupMap;
}

function applyRulesToGroup(rows: any[], group: string[], groupKey: string, apply: any[]): any {
	const groupObj: any = {};
	group.forEach((key) => {
		const split = key.split("_");
		if (split.length === 2) {
			const field = split[1]; // shortname
			groupObj[field] = rows[0][field]; // first row's value for this group key
		}
	});
	for (const applyRule of apply) {
		const key = Object.keys(applyRule)[0];
		const tokenObj = applyRule[key]; // { MAX: "field", MIN: "field", AVG: "field", SUM: "field", COUNT: "field" }
		const token = Object.keys(tokenObj)[0]; // MAX, MIN, AVG, SUM, COUNT
		const applyField = tokenObj[token];
		const field = applyField.split("_")[1];
		if (!(field in rows[0])) {
			throw new InsightError(`Field ${field} not found in row`);
		}
		groupObj[key] = applyAggregation(token, rows, field);
	}
	return groupObj;
}

function applyAggregation(token: string, rows: any[], key: string): any {
	switch (token) {
		case "MAX":
			return calculateMax(rows, key);
		case "MIN":
			return calculateMin(rows, key);
		case "AVG":
			return calculateAvg(rows, key);
		case "SUM":
			return calculateSum(rows, key);
		case "COUNT":
			return calculateCount(rows, key);
		default:
			throw new InsightError(`Invalid APPLY token: ${token}`);
	}
}

function calculateCount(rows: any[], key: string): number {
	const seen: { [value: string]: boolean } = {};
	let uniqueOccurances = 0;

	for (const row of rows) {
		const value = row[key];
		if (!seen[value]) {
			seen[value] = true;
			uniqueOccurances += 1;
		}
	}

	return uniqueOccurances;
}

function calculateSum(rows: any[], key: string): number {
	validateNumericComparator("SUM", key, 1);
	let sum = 0;

	for (const row of rows) {
		sum += row[key];
	}

	return Number(sum.toFixed(2));
}

function calculateAvg(rows: any[], key: string): number {
	validateNumericComparator("AVG", key, 1);
	if (rows.length === 0) throw new InsightError("No rows to calculate AVG");

	let sum = new Decimal(0);
	let numItems = 0;

	for (const row of rows) {
		sum = sum.add(new Decimal(row[key]));
		numItems += 1;
	}

	const avg = sum.toNumber() / numItems;
	return Number(avg.toFixed(2));
}

function calculateMax(rows: any[], key: string): number {
	validateNumericComparator("MAX", key, 1);
	if (rows.length === 0) throw new InsightError("No rows to calculate MAX");
	let resultSoFar = rows[0][key];
	for (const row of rows) {
		if (row[key] > resultSoFar) {
			resultSoFar = row[key];
		}
	}
	return resultSoFar;
}

function calculateMin(rows: any[], key: string): number {
	validateNumericComparator("MIN", key, 1);
	if (rows.length === 0) throw new InsightError("No rows to calculate MIN");
	let minValue = rows[0][key];
	for (const row of rows) {
		if (row[key] < minValue) {
			minValue = row[key];
		}
	}
	return minValue;
}
