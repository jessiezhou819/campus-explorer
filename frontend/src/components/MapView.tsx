// src/components/MapView.tsx
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapView.css"; // add styles for .map-container
import { Room, RouteSegment } from "../types/Building";

// ✅ Use your token directly here
mapboxgl.accessToken = "pk.eyJ1IjoiYXRhbzIwNCIsImEiOiJjbWRtYzM1ajYwMzBkMnFweWtwZTJ5dXUxIn0.4t4PyIRApEZFaojfIb61Fw"; // <- your token

interface MapViewProps {
	routeGeoJson: GeoJSON.FeatureCollection | null;
	selected: Room[];
	center: [number, number];
	segments: RouteSegment[];
	setBuildings: (buildings: any[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ routeGeoJson, selected, center, segments, setBuildings }) => {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const mapInstance = useRef<mapboxgl.Map | null>(null);

	// https://docs.mapbox.com/mapbox-gl-js/example/add-image-animated/
	const markersRef = useRef<mapboxgl.Marker[]>([]);

	useEffect(() => {
		if (!mapInstance.current) return;

		// Remove existing markers
		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current = [];

		const map = mapInstance.current;

		selected.forEach((building) => {
			const marker = new mapboxgl.Marker()
				.setLngLat([building.rooms_lon, building.rooms_lat])
				// .setPopup(new mapboxgl.Popup().setText(building.rooms_number))
				.addTo(map);
			markersRef.current.push(marker);
		});
	}, [selected]);

	useEffect(() => {
		const map = mapInstance.current;
		if (!map || !map.isStyleLoaded() || !routeGeoJson) return;

		clearRouteGraphics(map);

		if (center) {
			mapInstance.current?.setCenter(center);
			mapInstance.current?.setZoom(16);
		}

		segments.forEach((segment, index) => {
			const sourceId = `route-segment-${index}`;
			const layerId = `route-layer-${index}`; //#00a6ff
			const color = ["#00a6ff ", "#a5d7f7", "#2447d2", "#42fdfd", "#0A3D62"][index % 5];

			// Remove existing
			if (map.getLayer(layerId)) map.removeLayer(layerId);
			if (map.getSource(sourceId)) map.removeSource(sourceId);

			// Add source
			map.addSource(sourceId, {
				type: "geojson",
				data: {
					type: "Feature",
					geometry: segment.geometry,
					properties: {
						duration: segment.duration,
					},
				},
			});

			// Add layer
			map.addLayer({
				id: layerId,
				type: "line",
				source: sourceId,
				layout: {
					"line-join": "round",
					"line-cap": "round",
				},
				paint: {
					"line-color": color,
					"line-width": 6,
					"line-blur": 1.4, // subtle glow
					"line-opacity": 0.95, // slightly transparent for blending
				},
			});

			// Tooltip on hover
			const popup = new mapboxgl.Popup({
				closeButton: false,
				closeOnClick: false,
			});

			map.on("mouseenter", layerId, (e) => {
				map.getCanvas().style.cursor = "pointer";

				const duration = e.features?.[0]?.properties?.duration;
				const minutes = Math.floor(duration / 60);
				const seconds = Math.round(duration % 60);
				const formatted = `${minutes} min ${seconds} sec`;

				if (e.lngLat) {
					popup.setLngLat(e.lngLat).setText(`Duration: ${formatted}`).addTo(map);
				}
			});

			map.on("mouseleave", layerId, () => {
				map.getCanvas().style.cursor = "";
				popup.remove();
			});
		});
	}, [routeGeoJson, segments]);

	useEffect(() => {
		const map = new mapboxgl.Map({
			container: mapRef.current!,
			style: "mapbox://styles/mapbox/dark-v11", // or light-v11, streets-v12
			center: [-123.246, 49.2606],
			zoom: 16,
			pitch: 60,
			bearing: -20,
			antialias: true,
		});
		mapInstance.current = map;

		map.on("load", () => {
			map.addSource("mapbox-dem", {
				type: "raster-dem",
				url: "mapbox://mapbox.mapbox-terrain-dem-v1",
				tileSize: 512,
				maxzoom: 14,
			});
			map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

			map.addLayer({
				id: "sky",
				type: "sky",
				paint: {
					"sky-type": "atmosphere",
					"sky-atmosphere-sun": [0.0, 0.0],
					"sky-atmosphere-sun-intensity": 15,
				},
			});

			map.addLayer(
				{
					id: "3d-buildings",
					source: "composite",
					"source-layer": "building",
					filter: ["==", "extrude", "true"],
					type: "fill-extrusion",
					minzoom: 15,
					paint: {
						"fill-extrusion-color": "#2b3750",
						"fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]],
						"fill-extrusion-base": ["get", "min_height"],
						"fill-extrusion-opacity": 0.7,
						"fill-extrusion-vertical-gradient": true,
					},
				},
				"waterway-label" // ensures buildings appear below labels
			);

			const size = 70;

			// (Optional) pull MUI primary; fallback to a nice blue
			const primary =
				getComputedStyle(document.documentElement).getPropertyValue("--mui-palette-primary-main").trim() || "#1976d2";

			const hexToRgb = (hex: string): [number, number, number] => {
				const h = hex.replace("#", "");
				const full =
					h.length === 3
						? h
								.split("")
								.map((c) => c + c)
								.join("")
						: h;
				const n = parseInt(full, 16);
				return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
			};
			const [br, bg, bb] = hexToRgb(primary);

			const pulsingDot: mapboxgl.StyleImageInterface & {
				context?: CanvasRenderingContext2D | null;
			} = {
				width: size,
				height: size,
				data: new Uint8Array(size * size * 4),
				onAdd() {
					const canvas = document.createElement("canvas");
					canvas.width = this.width;
					canvas.height = this.height;
					this.context = canvas.getContext("2d");
				},
				render() {
					const duration = 1500; // change for speed
					const t = (performance.now() % duration) / duration;

					const radius = (size / 2) * 0.3;
					const outerRadius = (size / 2) * 0.6 * t + radius; // change radius
					const ctx = this.context!;
					ctx.clearRect(0, 0, this.width, this.height);

					// --- Outer pulse: BLUE ---
					ctx.beginPath();
					ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${1 * (1 - t)})`; // adjust 0.28 for strength
					ctx.fill();

					// optional glow
					// ctx.shadowColor = `rgba(${br}, ${bg}, ${bb}, ${0.35 * (1 - t)})`;
					// ctx.shadowBlur = 8;

					// --- Inner dot: WHITE with BLUE stroke ---
					ctx.beginPath();
					ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
					ctx.fillStyle = "#ffffff";
					ctx.strokeStyle = `rgb(${br}, ${bg}, ${bb})`;
					ctx.lineWidth = 2 + 3 * (1 - t);
					ctx.fill();
					ctx.stroke();

					// reset shadow
					ctx.shadowBlur = 0;

					this.data = ctx.getImageData(0, 0, this.width, this.height).data;
					map.triggerRepaint();
					return true;
				},
			};

			const IMAGE_ID = "pulsing-dot";
			const SOURCE_ID = "all-buildings";
			const LAYER_ID = "all-buildings-layer";

			if (!map.hasImage(IMAGE_ID)) {
				map.addImage(IMAGE_ID, pulsingDot, { pixelRatio: 2 });
			}
			if (!map.getSource(SOURCE_ID)) {
				map.addSource(SOURCE_ID, {
					type: "geojson",
					data: { type: "FeatureCollection", features: [] },
				});
			}
			if (!map.getLayer(LAYER_ID)) {
				map.addLayer({
					id: LAYER_ID,
					type: "symbol",
					source: SOURCE_ID,
					layout: {
						"icon-image": IMAGE_ID,
						"icon-allow-overlap": true,
					},
				});
			}

			// Markers for your custom building data
			fetch(`${process.env.REACT_APP_BACKEND_URL}/query`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["rooms_lat", "rooms_lon", "rooms_fullname", "numRooms", "rooms_shortname", "rooms_address"],
					},
					TRANSFORMATIONS: {
						GROUP: ["rooms_lat", "rooms_lon", "rooms_fullname", "rooms_shortname", "rooms_address"],
						APPLY: [
							{
								numRooms: {
									COUNT: "rooms_name",
								},
							},
						],
					},
				}),
			})
				.then((res) => res.json())
				.then((json) => {
					setBuildings(json.result);
					const features = (json.result as any[]).reduce<GeoJSON.Feature<GeoJSON.Point>[]>((acc, b) => {
						const lon = Number(b.rooms_lon);
						const lat = Number(b.rooms_lat);
						if (!Number.isFinite(lon) || !Number.isFinite(lat)) return acc;
						acc.push({
							type: "Feature",
							geometry: { type: "Point", coordinates: [lon, lat] },
							properties: { fullname: b.rooms_fullname, numRooms: b.numRooms },
						});
						return acc;
					}, []);

					const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
					src.setData({ type: "FeatureCollection", features });
				});

			map.on("click", LAYER_ID, (e) => {
				const f = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] })?.[0];
				if (!f) return;
				const [lng, lat] = (f.geometry as any).coordinates as [number, number];
				new mapboxgl.Popup({ closeButton: false })
					.setLngLat([lng, lat])
					.setText(f.properties?.fullname) //  + ` - ${f.properties?.numRooms} rooms`
					.addTo(map);
			});
		});

		return () => map.remove();
	}, []);

	const LAYER_PREFIX = "route-layer-";
	const SOURCE_PREFIX = "route-segment-";

	function clearRouteGraphics(map: mapboxgl.Map) {
		const style = map.getStyle?.();
		if (!style) return;

		// 1) Remove layers first (they depend on sources)
		(style.layers ?? [])
			.filter((l) => l.id.startsWith(LAYER_PREFIX))
			.forEach((l) => {
				if (map.getLayer(l.id)) map.removeLayer(l.id);
			});

		// 2) Then remove sources
		Object.keys(style.sources ?? {})
			.filter((id) => id.startsWith(SOURCE_PREFIX))
			.forEach((id) => {
				if (map.getSource(id)) map.removeSource(id);
			});
	}

	return <div ref={mapRef} className="map-container" />;
};
export default MapView;
