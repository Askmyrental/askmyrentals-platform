import type { ReactNode } from "react";

type PulseActionType =
  | "calendar-protection"
  | "needs-cleaner"
  | "awaiting-acceptance"
  | "maintenance"
  | "arrival-readiness";

type PulseActionDrawerProps = {
  open: boolean;
  actionType: PulseActionType | null;
  reservations: any[];
  calendarSyncIssues: any[];
  workOrders: any[];
  homes: any[];
  cleaners: any[];
  selectedPropertyId: string;
  formatDate: (dateString: string) => string;
  onClose: () => void;
  onOpenReservation: (reservation: any) => void;
  onOpenMaintenance: (workOrder: any) => void;
  onAssignCleaner: (reservationId: string, cleanerId: string) => void;
  onSendReminder: (reservationId: string) => void;
};

function getPropertyId(item: any) {
  return item?.homeId ?? item?.propertyId ?? item?.property_id ?? "";
}

function getReservationPropertyId(reservation: any) {
  return reservation?.homeId ?? reservation?.propertyId ?? reservation?.property_id ?? "";
}

function getReservationDate(reservation: any, key: "arrival" | "departure") {
  return reservation?.[key] ?? reservation?.[key === "arrival" ? "checkIn" : "checkOut"] ?? "";
}

function hasCleaner(reservation: any) {
  return Boolean(
    reservation?.cleanerId ??
      reservation?.cleaner_id ??
      reservation?.assignedCleanerId ??
      reservation?.assignedCleaner
  );
}

function normalizeStatus(reservation: any) {
  const status = String(reservation?.status ?? "").toLowerCase();

  if (!hasCleaner(reservation)) return "unassigned";
  if (status.includes("complete") || status.includes("no clean")) return "completed";
  if (status.includes("progress") || status.includes("process")) return "in-progress";
  if (status.includes("accept")) return "accepted";
  return "assigned";
}

function getCleanerName(reservation: any, cleaners: any[]) {
  const cleanerId = reservation?.cleanerId ?? reservation?.cleaner_id;
  return cleaners.find((cleaner) => cleaner.id === cleanerId)?.name ?? "Cleaner needed";
}

function getHomeName(homeId: string, homes: any[]) {
  return homes.find((home) => home.id === homeId)?.name ?? "Property";
}

function getIssueReservation(issue: any) {
  return issue?.primaryReservation ?? issue?.reservation ?? issue?.overlappingReservation;
}


function getActionCopy(actionType: PulseActionType | null) {
  switch (actionType) {
    case "calendar-protection":
      return {
        title: "Calendar Protection Issues",
        subtitle: "Reservations that need mirrored protection.",
        empty: "No calendar protection issues found.",
      };
    case "needs-cleaner":
      return {
        title: "Cleaner Assignment",
        subtitle: "Reservations that still need a cleaner.",
        empty: "No reservations need cleaner assignment.",
      };
    case "awaiting-acceptance":
      return {
        title: "Awaiting Cleaner Acceptance",
        subtitle: "Assigned cleans waiting for cleaner confirmation.",
        empty: "No cleaner acceptances are pending.",
      };
    case "maintenance":
      return {
        title: "Maintenance Issues",
        subtitle: "Open maintenance that may affect readiness.",
        empty: "No open maintenance issues.",
      };
    case "arrival-readiness":
      return {
        title: "Arrival Readiness",
        subtitle: "Upcoming stays that are not fully resolved.",
        empty: "All upcoming stays look ready.",
      };
    default:
      return {
        title: "Pulse Action Center",
        subtitle: "Issues that need attention.",
        empty: "No issues found.",
      };
  }
}

function statusLabel(status: string) {
  if (status === "unassigned") return "Unassigned";
  if (status === "assigned") return "Assigned";
  if (status === "accepted") return "Accepted";
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  return "Review Needed";
}

function StatusPill({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`pulseActionPill ${tone}`}>{children}</span>;
}

export default function PulseActionDrawer({
  open,
  actionType,
  reservations,
  calendarSyncIssues,
  workOrders,
  homes,
  cleaners,
  selectedPropertyId,
  formatDate,
  onClose,
  onOpenReservation,
  onOpenMaintenance,
  onAssignCleaner,
  onSendReminder,
}: PulseActionDrawerProps) {

  if (!open || !actionType) return null;

  const todayKey = new Date().toISOString().slice(0, 10);
  const copy = getActionCopy(actionType);

  const propertyReservations = reservations.filter(
    (reservation) =>
      getReservationPropertyId(reservation) === selectedPropertyId &&
      getReservationDate(reservation, "departure") >= todayKey &&
      String(reservation.status ?? "").toLowerCase() !== "blocked"
  );

const calendarIssues = calendarSyncIssues.filter((issue) => {
  const reservation =
    issue.primaryReservation ??
    issue.overlappingReservation;

  const issuePropertyId =
    reservation?.homeId ??
    reservation?.propertyId ??
    reservation?.property_id;

  const issueId = String(issue.id ?? "").toLowerCase();

  return (
    issuePropertyId === selectedPropertyId &&
    issue.status !== "Dismissed" &&
    issueId.startsWith("calendar-coverage")
  );
});

  const needsCleaner = propertyReservations.filter(
    (reservation) => normalizeStatus(reservation) === "unassigned"
  );

  const awaitingAcceptance = propertyReservations.filter(
    (reservation) => normalizeStatus(reservation) === "assigned"
  );

 const arrivalReadiness = propertyReservations.filter((reservation) => {
  const status = normalizeStatus(reservation);

  return (
    status === "unassigned" ||
    status === "assigned" ||
    status === "accepted" ||
    status === "in-progress"
  );
});

  const maintenanceIssues = workOrders.filter((order) => {
    const propertyId = getPropertyId(order);
    const status = String(order.status ?? "").toLowerCase();

    return (
      propertyId === selectedPropertyId &&
      status !== "completed" &&
      status !== "archived"
    );
  });

  const itemCount =
    actionType === "calendar-protection"
      ? calendarIssues.length
      : actionType === "needs-cleaner"
        ? needsCleaner.length
        : actionType === "awaiting-acceptance"
          ? awaitingAcceptance.length
          : actionType === "maintenance"
            ? maintenanceIssues.length
            : arrivalReadiness.length;

  return (
    <div className="pulseActionOverlay" onClick={onClose}>
      <section className="pulseActionDrawer" onClick={(event) => event.stopPropagation()}>
        <div className="pulseActionHeader">
          <div>
            <p className="eyebrow">Pulse Action Center</p>
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>

          <button className="ghostButton" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="pulseActionSummary">
          <strong>{itemCount}</strong>
          <span>{itemCount === 1 ? "item needs attention" : "items need attention"}</span>
        </div>

        <div className="pulseActionCardGrid">
          {itemCount === 0 && <div className="pulseActionEmpty">{copy.empty}</div>}

          {actionType === "calendar-protection" &&
            calendarIssues.map((issue) => {
              const reservation = getIssueReservation(issue);
              const homeId = getReservationPropertyId(reservation);

              return (
                <button
                  key={issue.id}
                  type="button"
                  className="pulseActionCard danger"
                  onClick={() => reservation && onOpenReservation(reservation)}
                >
                  <div className="pulseActionCardTop">
                    <span className="pulseActionIcon">🛡️</span>
                    <StatusPill tone="danger">Protection Needed</StatusPill>
                  </div>

                  <h3>{reservation?.guestName ?? "Calendar issue"}</h3>
                  <p>{getHomeName(homeId, homes)}</p>
                  <strong>{issue.dateRange}</strong>

               <div className="pulseActionDetails">
  <span>🔴 No cleaner assigned</span>

  <select
    value=""
    onClick={(event) => event.stopPropagation()}
    onChange={(event) => {
      event.stopPropagation();
      onAssignCleaner(
        String(reservation.id),
        event.target.value
      );
    }}
  >
    <option value="">Assign cleaner</option>

    {cleaners.map((cleaner) => (
      <option key={cleaner.id} value={cleaner.id}>
        {cleaner.name}
      </option>
    ))}
  </select>
</div>

                  <small>{issue.message}</small>
                </button>
              );
            })}

          {actionType === "needs-cleaner" &&
            needsCleaner.map((reservation) => (
              <button
                key={reservation.id}
                type="button"
                className="pulseActionCard danger"
                onClick={() => onOpenReservation(reservation)}
              >
                <div className="pulseActionCardTop">
                  <span className="pulseActionIcon">🧹</span>
                  <StatusPill tone="danger">Needs Cleaner</StatusPill>
                </div>

                <h3>{reservation.guestName ?? "Reservation"}</h3>
                <p>{getHomeName(getReservationPropertyId(reservation), homes)}</p>
                <strong>{formatDate(getReservationDate(reservation, "arrival"))}</strong>

              <div className="pulseActionDetails">
  <span>🔴 No cleaner assigned</span>

  <select
    className="pulseAssignSelect"
    value=""
    onClick={(event) => event.stopPropagation()}
    onChange={(event) => {
      event.stopPropagation();

      onAssignCleaner(
        String(reservation.id),
        event.target.value
      );
    }}
  >
    <option value="">Assign cleaner</option>

    {cleaners.map((cleaner) => (
      <option key={cleaner.id} value={cleaner.id}>
        {cleaner.name}
      </option>
    ))}
  </select>
</div>
              </button>
            ))}

          {actionType === "awaiting-acceptance" &&
            awaitingAcceptance.map((reservation) => (
              <button
                key={reservation.id}
                type="button"
                className="pulseActionCard assigned"
                onClick={() => onOpenReservation(reservation)}
              >
                <div className="pulseActionCardTop">
                  <span className="pulseActionIcon">⏳</span>
                  <StatusPill tone="assigned">Awaiting Acceptance</StatusPill>
                </div>

                <h3>{reservation.guestName ?? "Reservation"}</h3>
                <p>{getHomeName(getReservationPropertyId(reservation), homes)}</p>
                <strong>{formatDate(getReservationDate(reservation, "arrival"))}</strong>

               <div className="pulseActionDetails">
  <span>
    🟠 Assigned to {getCleanerName(reservation, cleaners)}
  </span>

  <span>
    ⚠️ Cleaner has not accepted yet
  </span>

  <button
    className="pulseReminderButton"
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onSendReminder(String(reservation.id));
    }}
  >
    🔔 Send Reminder
  </button>
</div>
              </button>
            ))}

          {actionType === "maintenance" &&
            maintenanceIssues.map((order) => (
              <button
                key={order.id}
                type="button"
                className="pulseActionCard danger"
                onClick={() => onOpenMaintenance(order)}
              >
                <div className="pulseActionCardTop">
                  <span className="pulseActionIcon">🔧</span>
                  <StatusPill tone="danger">{order.urgency ?? "Maintenance"}</StatusPill>
                </div>

                <h3>{order.title}</h3>
                <p>{getHomeName(getPropertyId(order), homes)}</p>
                <strong>{order.status}</strong>

                <div className="pulseActionDetails">
                  <span>⚠️ {order.category ?? "General"}</span>
                  <span>➡️ Review or schedule repair</span>
                </div>
              </button>
            ))}

          {actionType === "arrival-readiness" &&
            arrivalReadiness.map((reservation) => {
              const status = normalizeStatus(reservation);

              return (
                <button
                  key={reservation.id}
                  type="button"
                  className={`pulseActionCard ${status}`}
                  onClick={() => onOpenReservation(reservation)}
                >
                  <div className="pulseActionCardTop">
                    <span className="pulseActionIcon">🏠</span>
                    <StatusPill tone={status}>{statusLabel(status)}</StatusPill>
                  </div>

                  <h3>{reservation.guestName ?? "Reservation"}</h3>
                  <p>{getHomeName(getReservationPropertyId(reservation), homes)}</p>
                  <strong>{formatDate(getReservationDate(reservation, "arrival"))}</strong>

                  <div className="pulseActionDetails">
                    <span>Cleaner: {getCleanerName(reservation, cleaners)}</span>
                    <span>Status: {statusLabel(status)}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>
    </div>
  );
}