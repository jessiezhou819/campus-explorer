import Decimal from "decimal.js";
import { InsightError } from "./IInsightFacade";

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
		//  Build group keys
		const groupValues: string[] = [];
		for (const key of GROUP) {
			groupValues.push(String(item[key])); // Make sure it's a string
		}
		const groupKey = groupValues.join("|"); // e.g. "HEBB|Lecture"

		//  If group not in map, create it
		if (!groupMap.has(groupKey)) {
			groupMap.set(groupKey, []);
		}

		//  Add item to the group
		const group = groupMap.get(groupKey);
		if (group) {
			group.push(item);
		}
	}

	return groupMap;
}

function applyRulesToGroup(rows: any[], GROUP: string[], groupKey: string, APPLY: any[]): any {
	const groupObj: any = {};
	const groupValues = JSON.parse(groupKey);
	GROUP.forEach((key, idx) => {
		groupObj[key] = groupValues[idx];
	});
	for (const applyRule of APPLY) {
		const applyKey = Object.keys(applyRule)[0];
		const applyTokenObj = applyRule[applyKey]; // { MAX: "field", MIN: "field", AVG: "field", SUM: "field", COUNT: "field" }
		const applyToken = Object.keys(applyTokenObj)[0]; // MAX, MIN, AVG, SUM, COUNT
		const applyField = applyTokenObj[applyToken]; // The field to apply the aggregation on ex: "avgYear", "maxSeats", etc.
		groupObj[applyKey] = applyAggregation(applyToken, rows, applyField);
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
	let sum = 0;

	for (const row of rows) {
		sum += row[key]; // field is a number -> might need to implement a check here !!!
	}

	return Number(sum.toFixed(2));
}

function calculateAvg(rows: any[], key: string): number {
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
	if (rows.length === 0) throw new InsightError("No rows to calculate MIN");
	let minValue = rows[0][key];
	for (const row of rows) {
		if (row[key] < minValue) {
			minValue = row[key];
		}
	}
	return minValue;
}
