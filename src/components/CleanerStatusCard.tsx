type ReservationStatus =
  | "Unassigned"
  | "Assigned"
  | "Accepted"
  | "In Process"
  | "Completed"
  | "Blocked"
  | "No Clean Needed";

type Reservation = {
  id: string;
  cleanerId?: string;
  status: ReservationStatus;
};

type Cleaner = {
  id: string;
  name: string;
  status: string;
};

type CleanerStatusCardProps = {
  reservation: Reservation;
  cleaners: Cleaner[];
  cleaner?: Cleaner;
  canAssignCleaner: boolean;
  updateReservation: (id: string, updates: any) => void;
};

const statusOptions: ReservationStatus[] = [
  "Unassigned",
  "Assigned",
  "Accepted",
  "In Process",
  "Completed",
  "No Clean Needed",
];

export default function CleanerStatusCard({
  reservation,
  cleaners,
  cleaner,
  canAssignCleaner,
  updateReservation,
}: CleanerStatusCardProps) {
  return (
    <article className="reservationWorkspaceCard cleanerStatusCard">
      <div className="operationsCardHeader">
        <div>
          <p className="eyebrow">Assignment</p>
          <h3>Status & Cleaner</h3>
        </div>
        <span className={`operationsMiniPill status${reservation.status.replace(/\s/g, "")}`}>
          {reservation.status}
        </span>
      </div>

      <div className="cleanerStatusHero">
        <div className="cleanerInitialBadge">
          {cleaner?.name
            ?.split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "—"}
        </div>
        <div>
          <strong>{cleaner?.name ?? "No cleaner assigned"}</strong>
          <span>{cleaner?.status ?? "Needs assignment"}</span>
        </div>
      </div>

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
  );
}
