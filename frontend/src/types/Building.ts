// src/types/Building.ts
export interface Room {
	rooms_lat: number;
	rooms_lon: number;
	rooms_fullname: string;
	rooms_shortname: string;
	rooms_number: string;
	rooms_name: string;
	rooms_address: string;
	rooms_seats: number;
	rooms_type: string;
	rooms_furniture: string;
	rooms_href: string;
}

export interface Building {
	rooms_lat: number;
	rooms_lon: number;
	rooms_fullname: string;
	rooms_shortname: string;
	rooms_address: string;
	numRooms: number;
}

export type RouteSegment = {
	from: Room;
	to: Room;
	duration: number; // seconds
	distance: number; // meters
	geometry: GeoJSON.LineString;
};
