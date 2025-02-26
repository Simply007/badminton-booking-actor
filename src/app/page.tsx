"use client"

import { useState, useEffect } from "react";
import CourtList from "@/app/components/CourtList";import { CourtSlots } from "./lib/types/court";


type EmptySlot = {
  url: string;
  date: string;
  hour: string;
  label?: string;
};

export default function Home() {
  const [courts, setCourts] = useState<CourtSlots[]>([]);

  useEffect(() => {
    fetch('/api/fetch-courts')
      .then(res => res.json())
      .then((data: EmptySlot[]) => {
        const courts = data.reduce((acc, slot) => {
          const court = acc.find(c => c.url === slot.url);
          if (court) {
            court.slots.push({ time: slot.hour, label: slot.label ?? 'N/A' });
          } else {
            acc.push({ url: slot.url, slots: [{ time: slot.hour, label: slot.label ?? 'N/A'}] });
          }
          return acc;
        }, [] as CourtSlots[]);
        return courts;
      })
      .then(data => setCourts(data))
      .catch(err => console.error("Error fetching data:", err));
  }, []);

  return (
    <div>
      <h1>Badminton Court Availability</h1>
      <CourtList courts={courts} />
    </div>
  );
}