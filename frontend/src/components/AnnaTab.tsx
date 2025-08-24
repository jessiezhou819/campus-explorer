import React from "react";
import { Tabs, Tab, Box } from "@mui/material";

type TabKey = "buildings" | "rooms";

interface Props {
	onTabChange: (tab: TabKey) => void;
}

const AnnaTab: React.FC<Props> = ({ onTabChange }) => {
	const [value, setValue] = React.useState<TabKey>("buildings");

	const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
		setValue(newValue as TabKey);
		onTabChange(newValue as TabKey);
	};

	return (
		<Box sx={{ width: "100%", mt: 2, borderBottom: 1, borderColor: "divider" }}>
			<Tabs
				value={value}
				onChange={handleChange}
				aria-label="Sidebar Tabs"
				textColor="primary"
				indicatorColor="primary"
				variant="fullWidth"
			>
				<Tab label="Buildings" value="buildings" />
				<Tab label="Rooms" value="rooms" />
			</Tabs>
		</Box>
	);
};

export default AnnaTab;
