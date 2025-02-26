import { CourtSlots } from "../lib/types/court";

interface CourtListProps {
    courts: CourtSlots[];
}

export default function CourtList({ courts }: CourtListProps) {
    return (
        <div>
            {courts.length === 0 ? <p>Loading...</p> : (
                courts.map((court, index) => (
                    <div key={index}>
                        <h2>{court.url}</h2>
                        <ul>
                            {court.slots.map((slot, i) => (
                                <li key={i}>{slot.time} - {slot.label}</li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </div>
    );
}