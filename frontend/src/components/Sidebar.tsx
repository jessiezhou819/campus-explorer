import React, { useState } from "react";
import { Building, Room } from "../types/Building";
import { alpha, TextField } from "@mui/material";
import AnnaTab from "./AnnaTab";
import SelectedRooms from "./SelectedRooms";
import { Card, CardContent, Chip, Typography, Stack } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface Props {
	rooms: Room[];
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onViewRoute?: (rooms: Room[]) => void;
	selected: Room[];
	setSelected: (rooms: Room[]) => void;
	handleToggle: (building: Room) => void;
	buildings: Building[];
}

const Sidebar: React.FC<Props> = ({
	rooms,
	searchQuery,
	onSearchChange,
	onViewRoute,
	selected,
	setSelected,
	handleToggle,
	buildings,
}) => {
	const [tab, setTab] = useState<"buildings" | "rooms">("buildings");

	const filteredRoom = () => {
		const query = searchQuery.trim().toLowerCase();

		return rooms.filter(
			(b) =>
				b.rooms_shortname.toLowerCase().includes(query) ||
				b.rooms_address.toLowerCase().includes(query) ||
				b.rooms_name.toLowerCase().includes(query)
		);
	};

	const filteredBuildings = () => {
		const query = searchQuery.trim().toLowerCase();
		return buildings.filter(
			(b) =>
				b.rooms_fullname.toLowerCase().includes(query) ||
				b.rooms_shortname.toLowerCase().includes(query) ||
				b.rooms_address.toLowerCase().includes(query)
		);
	};

	return (
		<div className="border border-[rgba(255,255,255,0.12)] w-1/4 max-h-screen min-h-screen p-6 pb-0 bg-[#1e1e1e]/50 backdrop-blur text-[rgba(255,255,255,0.87)] shadow-lg overflow-hidden flex flex-col z-50">
			<h2 className="text-xl font-semibold mb-4">Campus Explorer</h2>
			{/* <input
				type="text"
				placeholder="Search rooms..."
				value={searchQuery}
				onChange={(e) => onSearchChange(e.target.value)}
				className="w-[100%] px-3 py-2 rounded-md text-sm bg-white/10 text-white placeholder-white focus:outline-none mb-3"
			/> */}

			<TextField
				id="outlined-basic"
				label={`${tab === "buildings" ? "Search Buildings" : "Search Rooms"}`}
				variant="outlined"
				fullWidth
				value={searchQuery}
				onChange={(e) => onSearchChange(e.target.value)}
			/>

			{/* Selected Rooms */}
			{selected.length > 0 && <SelectedRooms rooms={selected} setSelected={setSelected} onViewRoute={onViewRoute} />}

			{/* Tabs for Buildings and Rooms */}
			<div className="mb-4">
				<AnnaTab onTabChange={setTab} />
			</div>

			<div className="flex-1 overflow-y-auto">
				{tab === "buildings" ? (
					<div className="flex flex-col gap-2">
						{filteredBuildings().map((b, i) => (
							<div key={i}>
								<Card
									variant="outlined"
									sx={(theme) => ({
										position: "relative",
										// borderColor: selected.includes(b) ? "primary.main" : "",
										backgroundColor: alpha(theme.palette.primary.main, 0.1),
									})}
								>
									<CardContent sx={{ pl: 2.5, pt: 2.5, pb: 0 }}>
										<Typography gutterBottom sx={{ fontSize: 14, fontWeight: "bold" }}>
											{`${b.rooms_fullname}`}
										</Typography>
										<Typography sx={{ color: "text.secondary", mb: 1.5, fontSize: 12 }}>{b.rooms_address}</Typography>
										<Stack direction="row" spacing={1}>
											<Chip color="primary" label={`${b.rooms_shortname}`} sx={{ height: 22, fontSize: 12 }} />
											<Chip label={`${b.numRooms} rooms`} sx={{ height: 22, fontSize: 12, color: "text.secondary" }} />
										</Stack>
									</CardContent>
								</Card>
							</div>
						))}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{filteredRoom().map((b, i) => (
							<div key={i} onClick={() => handleToggle(b)}>
								<Card
									variant="outlined"
									sx={(theme) => ({
										position: "relative",
										borderColor: selected.includes(b) ? "primary.main" : "",
										backgroundColor: alpha(theme.palette.primary.main, selected.includes(b) ? 0.2 : 0.1),
										transition: "background-color .2s, box-shadow .2s, transform .15s, border-color .2s",
										"&:hover": {
											backgroundColor: alpha(theme.palette.primary.main, 0.2),
											borderColor: "primary.main",
											boxShadow: 3,
										},
									})}
								>
									{selected.includes(b) && (
										<CheckCircleIcon
											color="primary"
											fontSize="small"
											sx={{ position: "absolute", top: 21, right: 21 }}
											aria-label="selected"
										/>
									)}
									<CardContent sx={{ pl: 2.5, pt: 2.5, pb: 0 }}>
										<Typography gutterBottom sx={{ fontSize: 14, fontWeight: "bold" }}>
											{`${b.rooms_shortname} ${b.rooms_number}`}
										</Typography>
										<Typography sx={{ color: "text.secondary", mb: 1.5, fontSize: 12 }}>{b.rooms_address}</Typography>
										<Stack direction="row" spacing={1}>
											<Chip color="primary" label={`${b.rooms_seats} seats`} sx={{ height: 22, fontSize: 12 }} />
											<Chip label={b.rooms_type} sx={{ height: 22, fontSize: 12, color: "text.secondary" }} />
										</Stack>
									</CardContent>
								</Card>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Sidebar;
