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

export interface Query {
	WHERE: any;
	OPTIONS: Options;
}

export interface Options {
	COLUMNS: string[];
	ORDER?: string;
}
