import { useMemo, useState } from "react";

type RecordsPageProps = {
  reservations: any[];
  workOrders: any[];
  homes: any[];
};

type RecordItem = {
  id: string;
  label: string;
  detail: string;
  type: "Reservation" | "Maintenance";
  homeId?: string;
  date?: string;
  searchText: string;
};

export default function RecordsPage({
  reservations,
  workOrders,
  homes,
}: RecordsPageProps) {
  const [recordSearch, setRecordSearch] = useState("");
  const [recordType, setRecordType] = useState("All");
  const [recordHomeId, setRecordHomeId] = useState("All");
  const [recordStartDate, setRecordStartDate] = useState("");
  const [recordEndDate, setRecordEndDate] = useState("");

  const recordItems = useMemo<RecordItem[]>(() => {
    const reservationEvents = reservations.flatMap((reservation) =>
      (reservation.timeline ?? []).map((item: string, index: number) => {
        const homeName = homes.find((home) => home.id === reservation.homeId)?.name ?? "Unknown home";

        return {
          id: `${reservation.id}-${index}-${item}`,
          label: item,
          detail: `${reservation.guestName} · ${homeName} · ${reservation.arrival ?? ""} to ${reservation.departure ?? ""}`,
          type: "Reservation" as const,
          homeId: reservation.homeId,
          date: reservation.arrival,
          searchText: `${item} ${reservation.guestName} ${homeName} ${reservation.arrival ?? ""} ${reservation.departure ?? ""}`,
        };
      })
    );

    const workOrderEvents = workOrders.flatMap((order) =>
      (order.timeline ?? []).map((item: string, index: number) => {
        const homeName = homes.find((home) => home.id === order.homeId)?.name ?? "Unknown home";

        return {
          id: `${order.id}-${index}-${item}`,
          label: item,
          detail: `${order.title} · ${homeName} · ${order.status} · ${order.urgency}`,
          type: "Maintenance" as const,
          homeId: order.homeId,
          date: order.createdDate,
          searchText: `${item} ${order.title} ${homeName} ${order.status} ${order.urgency} ${order.createdDate ?? ""}`,
        };
      })
    );

    return [...reservationEvents, ...workOrderEvents].reverse();
  }, [reservations, workOrders, homes]);

  const filteredRecords = recordItems.filter((item) => {
    const matchesType = recordType === "All" || item.type === recordType;
    const matchesHome = recordHomeId === "All" || item.homeId === recordHomeId;
    const matchesSearch = item.searchText.toLowerCase().includes(recordSearch.toLowerCase());

    const matchesStartDate =
      !recordStartDate || (item.date && item.date >= recordStartDate);

    const matchesEndDate =
      !recordEndDate || (item.date && item.date <= recordEndDate);

    return matchesType && matchesHome && matchesSearch && matchesStartDate && matchesEndDate;
  });

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2>Records</h2>
          <p className="headerSubtext">
            A lightweight history of cleaner updates, reservation changes, maintenance items, and owner decisions.
          </p>
        </div>
      </header>

      <section className="recordsPanel">
        <div className="recordFilters">
          <input
            type="search"
            value={recordSearch}
            onChange={(event) => setRecordSearch(event.target.value)}
            placeholder="Search keyword..."
          />

          <select value={recordType} onChange={(event) => setRecordType(event.target.value)}>
            <option value="All">All record types</option>
            <option value="Reservation">Reservations</option>
            <option value="Maintenance">Maintenance</option>
          </select>

          <select value={recordHomeId} onChange={(event) => setRecordHomeId(event.target.value)}>
            <option value="All">All properties</option>
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={recordStartDate}
            onChange={(event) => setRecordStartDate(event.target.value)}
          />

          <input
            type="date"
            value={recordEndDate}
            onChange={(event) => setRecordEndDate(event.target.value)}
          />

          <button
            type="button"
            onClick={() => {
              setRecordSearch("");
              setRecordType("All");
              setRecordHomeId("All");
              setRecordStartDate("");
              setRecordEndDate("");
            }}
          >
            Clear Filters
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <article className="recordItem">
            <span>Records</span>
            <div>
              <h3>No records found</h3>
              <p>Try a different search, property, type, or date range.</p>
            </div>
          </article>
        ) : (
          filteredRecords.slice(0, 100).map((item) => (
            <article key={item.id} className="recordItem">
              <span>{item.type}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}