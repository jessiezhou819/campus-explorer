// components/RoomSelector.tsx
import React, { useEffect, useState } from "react";

interface Room {
  rooms_shortname: string;
  rooms_number: string;
  rooms_fullname: string;
  rooms_address: string;
  rooms_seats: number;
}

interface RoomSelectorProps {
  onSelect: (selectedRooms: Room[]) => void;
}

const RoomSelector: React.FC<RoomSelectorProps> = ({ onSelect }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  useEffect(() => {
	console.log(rooms)
  }, [rooms])

  useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        WHERE: {},
        OPTIONS: {
          COLUMNS: [
            "rooms_shortname",
            "rooms_number",
            "rooms_fullname",
            "rooms_address",
            "rooms_seats"
          ]
        }
      })
    })
      .then((res) => res.json())
      .then((json) => setRooms(json.result));
  }, []);

  const handleChange = (index: number) => {
    let newSelection: number[];
    if (selectedIndices.includes(index)) {
      newSelection = selectedIndices.filter((i) => i !== index);
    } else {
      if (selectedIndices.length >= 5) return;
      newSelection = [...selectedIndices, index];
    }
    setSelectedIndices(newSelection);
    onSelect(newSelection.map((i) => rooms[i]));
  };

  return (
    <div>
      <h2>Select up to 5 rooms:</h2>
      <ul>
        {rooms.map((room, idx) => (
          <li key={idx}>
            <label>
              <input
                type="checkbox"
                checked={selectedIndices.includes(idx)}
                onChange={() => handleChange(idx)}
                disabled={!selectedIndices.includes(idx) && selectedIndices.length >= 5}
              />
              {`${room.rooms_fullname} (${room.rooms_shortname} ${room.rooms_number}) - ${room.rooms_seats} seats`}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RoomSelector;
