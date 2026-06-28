import { useEffect, useState } from "react";

type ReservationStatus =
  | "Unassigned"
  | "Assigned"
  | "Accepted"
  | "In Process"
  | "Completed"
  | "Blocked"
  | "No Clean Needed";

type ReservationSource =
  | "VRBO"
  | "Airbnb"
  | "Guest Reservation"
  | "Owner Block"
  | "Cleaning"
  | "Maintenance"
  | "Vendor Visit"
  | "Inspection";

type Home = {
  id: string;
  name: string;
};

type Cleaner = {
  id: string;
  name: string;
  status: string;
};

type Reservation = {
  id: string;
  guestName: string;
  homeId: string;
  cleanerId?: string;
  source: ReservationSource;
  arrival: string;
  departure: string;
  status: ReservationStatus;
  notes?: string;
};

type ReservationDetailPageProps = {
  selectedCalendarItem: any;
  selectedCalendarDateKey: string | null;
  reservationDetailReturnPage: string;
  homes: Home[];
  cleaners: Cleaner[];
  setActivePage: (page: string) => void;
  setSelectedCalendarItem: any;
  setSelectedCalendarDateKey: (dateKey: string | null) => void;
  isImportedReservation: (reservation: any) => boolean;
  isTaskSource: (source: ReservationSource) => boolean;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  deleteReservation: (id: string) => void;
  formatDate: (date: string) => string;
  getSourceControlledMessage: (source: ReservationSource) => string;
};

export default function ReservationDetailPage({
  selectedCalendarItem,
  reservationDetailReturnPage,
  homes,
  cleaners,
  setActivePage,
  setSelectedCalendarItem,
  setSelectedCalendarDateKey,
  isImportedReservation,
  isTaskSource,
  updateReservation,
  deleteReservation,
  formatDate,
  getSourceControlledMessage,
}: ReservationDetailPageProps) {
  const reservation: Reservation | null =
    selectedCalendarItem && "guestName" in selectedCalendarItem
      ? selectedCalendarItem
      : null;

  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    setNotesDraft(reservation?.notes ?? "");
  }, [reservation?.id, reservation?.notes]);

  if (!reservation) {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Reservation Detail</p>
        <h2>No reservation selected</h2>
        <p>Select a reservation from the Dashboard, Calendar, or Reservations page.</p>
        <button className="primaryButton" type="button" onClick={() => setActivePage("Dashboard")}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  const home = homes.find((item) => item.id === reservation.homeId);
  const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
  const imported = isImportedReservation(reservation);
  const isTask = isTaskSource(reservation.source);
  const isOwnerBlock = reservation.source === "Owner Block";
  const canAssignCleaner =
    reservation.source === "VRBO" ||
    reservation.source === "Airbnb" ||
    reservation.source === "Guest Reservation" ||
    reservation.source === "Cleaning" ||
    reservation.source === "Owner Block";

  const statusOptions: ReservationStatus[] = [
    "Unassigned",
    "Assigned",
    "Accepted",
    "In Process",
    "Completed",
    "No Clean Needed",
  ];

  const closeDetail = () => {
    setSelectedCalendarItem(null);
    setSelectedCalendarDateKey(null);
    setActivePage(reservationDetailReturnPage || "Reservations");
  };

  const updateNotesWithLabel = (label: string, value: string) => {
    const existingNotes = notesDraft || reservation.notes || "";
    const lines = existingNotes
      .split("\n")
      .filter((line: string) => !line.startsWith(`${label}:`));

    const nextNotes = [`${label}: ${value}`, ...lines].filter(Boolean).join("\n");
    setNotesDraft(nextNotes);
    updateReservation(reservation.id, { notes: nextNotes });
  };

  return (
    <>
      <header className="pageHeader reservationDetailHeader">
        <div>
          <span className={`platformBadge platform${reservation.source.replace(/\s/g, "")}`}>
            {reservation.source.toUpperCase()}
          </span>
          <h2>{reservation.guestName || home?.name || "Reservation"}</h2>
          <p className="headerSubtext">
            {imported
              ? "Imported reservation. Edit cleaner assignment, status, and internal notes in AMR."
              : "Owner-created item. Edit details, assignment, status, and notes here."}
          </p>
        </div>

        <button className="ghostButton" type="button" onClick={closeDetail}>
          ← Back
        </button>
      </header>

      <section className="reservationWorkspace">
        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Reservation</p>
          <h3>{isOwnerBlock ? "Owner Block Details" : isTask ? `${reservation.source} Details` : "Booking Details"}</h3>

          <div className="detailStack">
            <div>
              <span>Property</span>
              <strong>{home?.name ?? "Unknown property"}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{reservation.source}</strong>
            </div>
            <div>
              <span>{isTask ? "Task" : "Guest / Title"}</span>
              <strong>{reservation.guestName || "Not provided"}</strong>
            </div>
            <div>
              <span>{isTask ? "Task Date" : "Arrival"}</span>
              <strong>{formatDate(reservation.arrival)}</strong>
            </div>
            <div>
              <span>{isTask ? "End" : "Departure"}</span>
              <strong>{formatDate(reservation.departure)}</strong>
            </div>
            <div>
              <span>Cleaner</span>
              <strong>{cleaner?.name ?? "Unassigned"}</strong>
            </div>
          </div>

          {imported && (
            <p className="sourceControlledNotice">
              {getSourceControlledMessage(reservation.source)}
            </p>
          )}

          {!imported && (
            <div className="manualForm fullWidth">
              <label>
                {isOwnerBlock ? "Block Name" : isTask ? "Task Name" : "Guest Name"}
                <input
                  value={reservation.guestName}
                  onChange={(event) =>
                    updateReservation(reservation.id, {
                      guestName: event.target.value,
                    })
                  }
                  placeholder="Guest name, owner block, or task title"
                />
              </label>

              <label>
                Property
                <select
                  value={reservation.homeId}
                  onChange={(event) =>
                    updateReservation(reservation.id, {
                      homeId: event.target.value,
                    })
                  }
                >
                  {homes.map((homeOption) => (
                    <option key={homeOption.id} value={homeOption.id}>
                      {homeOption.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {isTask ? "Task Date" : "Arrival"}
                <input
                  type="date"
                  value={reservation.arrival}
                  onChange={(event) =>
                    updateReservation(reservation.id, {
                      arrival: event.target.value,
                      departure:
                        reservation.departure && event.target.value > reservation.departure
                          ? event.target.value
                          : reservation.departure,
                    })
                  }
                />
              </label>

              <label>
                {isTask ? "End Date" : "Departure"}
                <input
                  type="date"
                  value={reservation.departure}
                  min={reservation.arrival || undefined}
                  onChange={(event) =>
                    updateReservation(reservation.id, {
                      departure: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          )}
        </article>

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Assignment</p>
          <h3>Status & Cleaner</h3>

          {canAssignCleaner && (
            <label>
              Assigned Cleaner
              <select
                value={reservation.cleanerId ?? ""}
                onChange={(event) =>
                  updateReservation(reservation.id, {
                    cleanerId: event.target.value || undefined,
                    status: event.target.value ? "Assigned" : "Unassigned",
                  })
                }
              >
                <option value="">Unassigned</option>
                {cleaners.map((cleanerOption) => (
                  <option key={cleanerOption.id} value={cleanerOption.id}>
                    {cleanerOption.name} — {cleanerOption.status}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Status
            <select
              value={reservation.status}
              onChange={(event) =>
                updateReservation(reservation.id, {
                  status: event.target.value as ReservationStatus,
                })
              }
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          {canAssignCleaner && reservation.cleanerId && (
            <div className="cardActions">
              <button
                type="button"
                onClick={() =>
                  updateReservation(reservation.id, {
                    cleanerId: undefined,
                    status: "Unassigned",
                  })
                }
              >
                Unassign Cleaner
              </button>
            </div>
          )}
        </article>

        {reservation.source === "Cleaning" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Cleaning</p>
            <h3>Cleaning Details</h3>
            <label>
              Cleaning Type
              <select defaultValue="" onChange={(event) => updateNotesWithLabel("Cleaning Type", event.target.value)}>
                <option value="" disabled>Select cleaning type</option>
                <option value="Standard Cleaning">Standard Cleaning</option>
                <option value="Mid-Stay Cleaning">Mid-Stay Cleaning</option>
                <option value="Deep Clean">Deep Clean</option>
                <option value="Touch-Up Clean">Touch-Up Clean</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </article>
        )}

        {reservation.source === "Maintenance" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Maintenance</p>
            <h3>Maintenance Details</h3>
            <label>
              Priority
              <select defaultValue="" onChange={(event) => updateNotesWithLabel("Maintenance Priority", event.target.value)}>
                <option value="" disabled>Select priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
            <label>
              Issue Category
              <select defaultValue="" onChange={(event) => updateNotesWithLabel("Maintenance Category", event.target.value)}>
                <option value="" disabled>Select category</option>
                <option value="General">General</option>
                <option value="Plumbing">Plumbing</option>
                <option value="HVAC">HVAC</option>
                <option value="Electrical">Electrical</option>
                <option value="Appliance">Appliance</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </article>
        )}

        {reservation.source === "Vendor Visit" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Vendor</p>
            <h3>Vendor Visit Details</h3>
            <label>
              Vendor Type
              <select defaultValue="" onChange={(event) => updateNotesWithLabel("Vendor Type", event.target.value)}>
                <option value="" disabled>Select vendor type</option>
                <option value="HVAC">HVAC</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="Pest Control">Pest Control</option>
                <option value="Landscaping">Landscaping</option>
                <option value="Pool / Hot Tub">Pool / Hot Tub</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              Vendor Name / Company
              <input
                placeholder="Example: Summit HVAC"
                onBlur={(event) => {
                  if (event.target.value.trim()) updateNotesWithLabel("Vendor", event.target.value.trim());
                }}
              />
            </label>
          </article>
        )}

        {reservation.source === "Inspection" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Inspection</p>
            <h3>Inspection Details</h3>
            <label>
              Inspection Type
              <select defaultValue="" onChange={(event) => updateNotesWithLabel("Inspection Type", event.target.value)}>
                <option value="" disabled>Select inspection type</option>
                <option value="Arrival Inspection">Arrival Inspection</option>
                <option value="Departure Inspection">Departure Inspection</option>
                <option value="Seasonal Inspection">Seasonal Inspection</option>
                <option value="Damage Inspection">Damage Inspection</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </article>
        )}

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Notes</p>
          <h3>{isTask ? "Task Notes" : "Operations Notes"}</h3>

          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Add cleaner instructions, gate codes, vendor notes, maintenance reminders, supplies, or anything the operations team should know."
          />

          <div className="reservationActionRow">
            <button
              type="button"
              className="primaryButton"
              onClick={() =>
                updateReservation(reservation.id, {
                  notes: notesDraft,
                })
              }
            >
              Save Notes
            </button>

            {!imported && (
              <button
                type="button"
                className="primaryButton dangerButton"
                onClick={() => deleteReservation(reservation.id)}
              >
                Delete Reservation
              </button>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
