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
  const reservation =
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
  const isOwnerBlock = reservation.source === "Owner Block";
  const isTask = isTaskSource(reservation.source);

  const detailEyebrow = imported
    ? "Source controlled reservation"
    : isOwnerBlock
      ? "Owner block"
      : `${reservation.source} task`;

  const detailSubtext = imported
    ? "VRBO/Airbnb controls guest name and dates. AMR controls cleaner assignment, task status, and internal notes."
    : isOwnerBlock
      ? "Use this to track owner, family, or personal use that blocks the property calendar."
      : "Use this as an operational task for the property team. It appears on the calendar but does not count as a guest reservation.";

  const updateNotesWithLabel = (label: string, value: string) => {
    const existingNotes = reservation.notes ?? "";
    const lines = existingNotes
      .split("\n")
    .filter((line: string) => !line.startsWith(`${label}:`));

    updateReservation(reservation.id, {
      notes: [`${label}: ${value}`, ...lines].filter(Boolean).join("\n"),
    });
  };

  const statusOptions: ReservationStatus[] = [
    "Unassigned",
    "Assigned",
    "Accepted",
    "In Process",
    "Completed",
    "No Clean Needed",
  ];

  return (
    <>
      <header className="pageHeader reservationDetailHeader">
        <div>
          <span className={`platformBadge platform${reservation.source.replace(/\s/g, "")}`}>
            {reservation.source.toUpperCase()}
          </span>
          <h2>{imported ? home?.name ?? "Unknown property" : reservation.guestName}</h2>
          <p className="headerSubtext">{detailSubtext}</p>
        </div>

        <button
          className="ghostButton"
          type="button"
          onClick={() => {
            setSelectedCalendarItem(null);
            setSelectedCalendarDateKey(null);
            setActivePage(reservationDetailReturnPage);
          }}
        >
          ← Back
        </button>
      </header>

      <section className="reservationWorkspace">
        {imported && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">{detailEyebrow}</p>
            <h3>Reservation Information</h3>
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
                <span>Guest / Calendar Title</span>
                <strong>{reservation.guestName || "Not provided"}</strong>
              </div>
              <div>
                <span>Arrival</span>
                <strong>{formatDate(reservation.arrival)}</strong>
              </div>
              <div>
                <span>Departure</span>
                <strong>{formatDate(reservation.departure)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{reservation.status}</strong>
              </div>
              <div>
                <span>Assigned Cleaner</span>
                <strong>{cleaner?.name ?? "Unassigned"}</strong>
              </div>
            </div>
            <p className="sourceControlledNotice">
              {getSourceControlledMessage(reservation.source)}
            </p>
          </article>
        )}

        {!imported && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">{detailEyebrow}</p>
            <h3>{isOwnerBlock ? "Owner Block Details" : `${reservation.source} Details`}</h3>

            <label>
              {isOwnerBlock ? "Block Name" : "Task Name"}
              <input
                value={reservation.guestName}
                onChange={(event) =>
                  updateReservation(reservation.id, {
                    guestName: event.target.value,
                  })
                }
                placeholder={isOwnerBlock ? "Owner stay, family use, personal block" : `${reservation.source} task name`}
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
              {isTask ? "Task Date" : "Start Date"}
              <input
                type="date"
                value={reservation.arrival}
                onChange={(event) =>
                  updateReservation(reservation.id, {
                    arrival: event.target.value,
                    departure: isTask
                      ? event.target.value
                      : reservation.departure && event.target.value > reservation.departure
                        ? event.target.value
                        : reservation.departure,
                  })
                }
              />
            </label>

            {isTask ? (
              <label>
                Task Type
                <input value={reservation.source} readOnly />
              </label>
            ) : (
              <label>
                End Date
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
            )}
          </article>
        )}

        {reservation.source === "Cleaning" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Cleaning task</p>
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
            <p className="mutedText">Use this for added cleanings, mid-stay service, deep cleans, or quick touch-ups.</p>
          </article>
        )}

        {reservation.source === "Maintenance" && (
          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Maintenance task</p>
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
            <p className="eyebrow">Vendor task</p>
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
            <p className="eyebrow">Inspection task</p>
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
            <p className="mutedText">Use this for walkthroughs, damage checks, seasonal reviews, or guest-ready verification.</p>
          </article>
        )}

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Assignment</p>
          <h3>{reservation.source === "Cleaning" || isImportedReservation(reservation) ? "Cleaner Assignment" : "Task Status"}</h3>

          {(reservation.source === "Cleaning" || isImportedReservation(reservation)) && (
            <label>
              Assigned cleaner
              <label className="formLabel">Assigned cleaner</label>
<select
  value={selectedCalendarItem.cleanerId ?? ""}
  onChange={(event) =>
    updateReservation(selectedCalendarItem.id, {
      cleanerId: event.target.value || undefined,
      status: event.target.value ? "Assigned" : "Unassigned",
    })
  }
>
  <option value="">Unassigned</option>
  {cleaners.map((cleaner) => (
    <option key={cleaner.id} value={cleaner.id}>
      {cleaner.name}
    </option>
  ))}
</select>
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
    {cleaners.map((cleaner) => (
      <option key={cleaner.id} value={cleaner.id}>
        {cleaner.name}
      </option>
    ))}
  </select>
</label>
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

          {(reservation.source === "Cleaning" || isImportedReservation(reservation)) && (
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
                Unassign
              </button>
            </div>
          )}
        </article>

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Internal Notes</p>
          <h3>{isTask ? "Task Notes" : "Owner Notes"}</h3>

          <textarea
  value={notesDraft}
  onChange={(event) => setNotesDraft(event.target.value)}
  placeholder="Add cleaner instructions, owner notes, vendor notes, access details, supplies, or reminders."
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

  {reservation.source !== "VRBO" &&
    reservation.source !== "Airbnb" && (
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

        {imported && (
          <article className="reservationWorkspaceCard doorCodePreview">
            <p className="eyebrow">Future Integration</p>
            <h3>Door Code</h3>
            <p>Smart lock and guest access codes will live here later.</p>
            <button type="button" className="disabledButton" disabled>
              Door Code Coming Soon
            </button>
          </article>
        )}
      </section>
    </>
  );
}
