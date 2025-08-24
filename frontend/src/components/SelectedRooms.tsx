import * as React from "react";
import { alpha, styled } from "@mui/material/styles";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionSummary, { AccordionSummaryProps, accordionSummaryClasses } from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import DirectionsIcon from "@mui/icons-material/Directions";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import { Room } from "../types/Building";

interface SelectedRoomsProps {
	rooms: Room[];
	setSelected: (rooms: Room[]) => void;
	onViewRoute?: (rooms: Room[]) => void;
}

const Accordion = styled((props: AccordionProps) => <MuiAccordion disableGutters elevation={0} square {...props} />)(
	({ theme }) => ({
		border: `1px solid ${theme.palette.primary.main}`, // primary outline
		borderRadius: theme.shape.borderRadius,
		transition: "background-color .2s, border-color .2s, box-shadow .2s",
		"&::before": { display: "none" },
		"&:hover": {
			backgroundColor: alpha(theme.palette.primary.main, 0.12),
			boxShadow: theme.shadows[3],
		},
		// Optional: adjust for dark mode
		...theme.applyStyles?.("dark", {
			backgroundColor: alpha(theme.palette.primary.main, 0.1),
			"&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.16) },
		}),
	})
);

const AccordionSummary = styled((props: AccordionSummaryProps) => (
	<MuiAccordionSummary expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "1rem" }} />} {...props} />
))(({ theme }) => ({
	flexDirection: "row-reverse",
	alignItems: "center",
	minHeight: 48,
	paddingRight: theme.spacing(1),
	[`&.Mui-expanded`]: {
		minHeight: 48,
	},

	// keep chevron centered and rotate when expanded
	[`& .${accordionSummaryClasses.expandIconWrapper}`]: {
		alignSelf: "center",
		transition: "transform .2s",
	},
	[`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
		transform: "rotate(90deg)",
	},

	// make the content a flex row and remove default margins
	[`& .${accordionSummaryClasses.content}`]: {
		margin: 0,
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		paddingLeft: theme.spacing(1),
	},
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
	padding: theme.spacing(2),
	borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`, // subtle divider in primary hue
}));

/* -------------------------------- Component ------------------------------- */
const SelectedRooms: React.FC<SelectedRoomsProps> = ({ rooms, setSelected, onViewRoute }) => {
	const [expanded, setExpanded] = React.useState<string | false>(false);

	// Generate a stable id for each panel
	const panelId = (i: number) => `panel-${i}`;

	const handleChange = (panel: string) => (_e: React.SyntheticEvent, newExpanded: boolean) => {
		setExpanded(newExpanded ? panel : false);
	};

	const handleRemove = (b: Room) => {
		const newSelected = rooms.filter((r) => r !== b);
		setSelected(newSelected);
		onViewRoute?.(newSelected);
	};

	// If current expanded panel disappears after removal, collapse it
	React.useEffect(() => {
		if (!expanded) return;
		const idx = Number(String(expanded).split("-")[1]);
		if (Number.isNaN(idx) || idx >= rooms.length) {
			setExpanded(false);
		}
	}, [rooms, expanded]);

	return (
		<>
			<div className="mt-4">
				{rooms.map((b, i) => {
					const id = panelId(i);
					return (
						<Accordion key={id} expanded={expanded === id} onChange={handleChange(id)} sx={{ mb: 1 }}>
							<AccordionSummary aria-controls={`${id}-content`} id={`${id}-header`}>
								<Typography component="span" sx={{ fontWeight: 600 }}>
									{b.rooms_name}
								</Typography>

								{/* Remove button on the right; stop propagation so it doesn't toggle */}
								<IconButton
									size="small"
									sx={{ ml: "auto" }}
									onClick={(e) => {
										e.stopPropagation();
										handleRemove(b);
									}}
									onFocus={(e) => e.stopPropagation()}
									aria-label={`remove ${b.rooms_name}`}
								>
									<CloseIcon fontSize="small" />
								</IconButton>
							</AccordionSummary>

							<AccordionDetails>
								<div className="space-y-1">
									<Typography variant="body2">
										<strong>Full Name:</strong> {b.rooms_fullname}
									</Typography>
									<Typography variant="body2">
										<strong>Short Name:</strong> {b.rooms_shortname}
									</Typography>
									<Typography variant="body2">
										<strong>Number:</strong> {b.rooms_number}
									</Typography>
									<Typography variant="body2">
										<strong>Address:</strong> {b.rooms_address}
									</Typography>
									<Typography variant="body2">
										<strong>Seats:</strong> {b.rooms_seats}
									</Typography>
								</div>
							</AccordionDetails>
						</Accordion>
					);
				})}

				{rooms.length === 0 && (
					<Typography variant="body2" sx={{ p: 2, opacity: 0.7 }}>
						No rooms selected.
					</Typography>
				)}
			</div>

			{/* Actions */}
			<div className="mt-2 flex gap-4">
				<Button
					variant="outlined"
					startIcon={<DeleteIcon />}
					fullWidth
					className="w-1/2"
					onClick={() => {
						setSelected([]);
						onViewRoute?.([]);
					}}
				>
					Clear
				</Button>

				{rooms?.length > 1 && (
					<Button
						variant="contained"
						endIcon={<DirectionsIcon />}
						fullWidth
						className="w-1/2"
						onClick={() => onViewRoute?.(rooms)}
					>
						View Route
					</Button>
				)}
			</div>
		</>
	);
};

export default SelectedRooms;
