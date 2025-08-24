import React, { useEffect, useState } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import { Building, Room, RouteSegment } from "./types/Building";
import { dummyRooms } from "./dummyBuildings"; // adjust the path as needed
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Snackbar } from "@mui/material";
import { Alert } from "@mui/material";

// const [allBuildings, setAllBuildings] = useState<Building[]>(dummyRooms);
// const [filteredBuildings, setFilteredBuildings] = useState<Building[]>(dummyRooms);

const theme = createTheme({
	palette: {
		mode: "dark",
	},
	shape: { borderRadius: 12 },
});

const App: React.FC = () => {
	const [rooms, setRooms] = useState<Room[]>(dummyRooms);
	const [buildings, setBuildings] = useState<Building[]>([]);
	const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
	const [selected, setSelected] = useState<Room[]>([]);
	const [center, setCenter] = useState<[number, number]>([-123.246, 49.2606]); // Default center for UBC
	const [segments, setSegments] = useState<RouteSegment[]>([]);
	const [limitOpen, setLimitOpen] = useState(false);

	const [searchQuery, setSearchQuery] = useState("");

	const handleViewRoute = async (rooms: Room[]) => {
		if (rooms.length > 1) {
			const avgLat = rooms.reduce((sum, b) => sum + b.rooms_lat, 0) / rooms.length;
			const avgLon = rooms.reduce((sum, b) => sum + b.rooms_lon, 0) / rooms.length;
			setCenter([avgLon, avgLat]);
		}
		const routeFeatures: GeoJSON.Feature[] = [];
		const segments: RouteSegment[] = [];
		for (let i = 0; i < rooms.length - 1; i++) {
			const from = rooms[i];
			const to = rooms[i + 1];
			const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${from.rooms_lon},${from.rooms_lat};${to.rooms_lon},${to.rooms_lat}?geometries=geojson&access_token=pk.eyJ1IjoiYXRhbzIwNCIsImEiOiJjbWRtYzM1ajYwMzBkMnFweWtwZTJ5dXUxIn0.4t4PyIRApEZFaojfIb61Fw`;
			const res = await fetch(url);
			const data = await res.json();
			if (data.routes?.length > 0) {
				const route = data.routes[0];
				routeFeatures.push({
					type: "Feature",
					geometry: data.routes[0].geometry,
					properties: {},
				});
				segments.push({
					from,
					to,
					duration: route.duration,
					distance: route.distance,
					geometry: route.geometry,
				});
			}
		}

		setRouteGeoJson({
			type: "FeatureCollection",
			features: routeFeatures,
		});
		setSegments(segments);
	};
	// Fetch building data
	useEffect(() => {
		fetch(`${process.env.REACT_APP_BACKEND_URL}/query`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				WHERE: {},
				OPTIONS: {
					COLUMNS: [
						"rooms_fullname",
						"rooms_shortname",
						"rooms_number",
						"rooms_name",
						"rooms_address",
						"rooms_lat",
						"rooms_lon",
						"rooms_seats",
						"rooms_type",
					],
					ORDER: "rooms_fullname",
				},
			}),
		})
			.then((res) => res.json())
			.then((json) => setRooms(json.result));
	}, []);

	const handleToggle = (b: any) => {
		if (selected.includes(b)) {
			setSelected(selected.filter((r) => r !== b));
			return;
		}
		if (selected.length >= 5) {
			setLimitOpen(true); // show alert
			return;
		}
		setSelected([...selected, b]);
	};

	return (
		<ThemeProvider theme={theme}>
			<div style={{ height: "100vh", width: "100vw", position: "relative" }}>
				<MapView
					routeGeoJson={routeGeoJson}
					selected={selected}
					center={center}
					segments={segments}
					setBuildings={setBuildings}
				/>
				<Sidebar
					rooms={rooms}
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					onViewRoute={handleViewRoute}
					selected={selected}
					setSelected={setSelected}
					handleToggle={handleToggle}
					buildings={buildings}
				/>
				<Snackbar
					open={limitOpen}
					autoHideDuration={3000}
					onClose={() => setLimitOpen(false)}
					anchorOrigin={{ vertical: "top", horizontal: "center" }}
				>
					<Alert severity="info">You can select up to 5 rooms.</Alert>
				</Snackbar>
			</div>
		</ThemeProvider>
	);
};

export default App;
