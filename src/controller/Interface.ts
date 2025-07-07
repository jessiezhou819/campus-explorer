export interface Section {
	uuid: string;
	id: string;
	title: string;
	instructor: string;
	dept: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface Room {
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

export interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}

export interface Query {
	WHERE: any;
	OPTIONS: Options;
}

export interface Options {
	COLUMNS: string[];
	ORDER?: string;
}
