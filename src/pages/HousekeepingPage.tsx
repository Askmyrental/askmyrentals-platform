import { useMemo, useState } from "react";

type HousekeepingPageProps = {
  reservations?: any[];
  homes?: any[];
  cleaners?: any[];
  selectedPropertyId?: string;
  updateReservation?: (id: string, updates: any) => void;
  needsCleanerAssignment?: (reservation: any) => boolean;
  formatDate?: (date: string) => string;
};

type HousekeepingFilter =
  | "all"
  | "needs-cleaner"
  | "assigned"
  | "accepted"
  | "in-process"
  | "completed";

type BulkAction = "assign" | "unassign";

function fallbackFormatDate(dateString: string) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getReservationCleanerId(reservation: any) {
  return reservation.cleanerId ?? reservation.cleaner_id ?? "";
}

function getReservationHomeId(reservation: any) {
  return reservation.homeId ?? reservation.propertyId ?? reservation.property_id ?? "";
}

function isCleaningReservation(reservation: any) {
  return (
    reservation.source === "VRBO" ||
    reservation.source === "Airbnb" ||
    reservation.source === "Guest Reservation" ||
    reservation.source === "Owner Block" ||
    reservation.source === "Cleaning"
  );
}


function getReservationTitle(reservation: any) {
  if (reservation.source === "Owner Block") return reservation.guestName || "Owner Block";
  if (reservation.source === "Cleaning") return reservation.guestName || "Cleaning";
  return reservation.guestName || "Reservation";
}

export default function HousekeepingPage({
  reservations = [],
  homes = [],
  cleaners = [],
  selectedPropertyId = "",
  updateReservation,
  needsCleanerAssignment,
  formatDate = fallbackFormatDate,
}: HousekeepingPageProps) {
  const [housekeepingFilter, setHousekeepingFilter] = useState<HousekeepingFilter>("all");
  const [search, setSearch] = useState("");
  const [showBulkCleanerModal, setShowBulkCleanerModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>("assign");
  const [bulkCleanerId, setBulkCleanerId] = useState("");

  const today = todayIsoDate();

  const selectedHome = homes.find((home) => home.id === selectedPropertyId);

  const getNeedsCleaner = (reservation: any) => {
    if (needsCleanerAssignment) return needsCleanerAssignment(reservation);

    return (
      isCleaningReservation(reservation) &&
      reservation.status !== "Completed" &&
      reservation.status !== "No Clean Needed" &&
      !getReservationCleanerId(reservation)
    );
  };

  const housekeepingReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => isCleaningReservation(reservation))
        .filter((reservation) => String(reservation.departure ?? reservation.arrival ?? "") >= today)
        .sort((a, b) => String(a.arrival ?? "").localeCompare(String(b.arrival ?? ""))),
    [reservations, today]
  );

  const needsCleanerItems = housekeepingReservations.filter((reservation) => getNeedsCleaner(reservation));
  const assignedItems = housekeepingReservations.filter((reservation) => reservation.status === "Assigned");
  const acceptedItems = housekeepingReservations.filter((reservation) => reservation.status === "Accepted");
  const inProcessItems = housekeepingReservations.filter((reservation) => reservation.status === "In Process");



  const activeCleaners = cleaners.filter((cleaner) => cleaner.status !== "Offline");

  const filteredReservations = housekeepingReservations.filter((reservation) => {
    if (housekeepingFilter === "needs-cleaner" && !getNeedsCleaner(reservation)) return false;
    if (housekeepingFilter === "assigned" && reservation.status !== "Assigned") return false;
    if (housekeepingFilter === "accepted" && reservation.status !== "Accepted") return false;
    if (housekeepingFilter === "in-process" && reservation.status !== "In Process") return false;
    if (housekeepingFilter === "completed" && reservation.status !== "Completed") return false;

    const home = homes.find((item) => item.id === getReservationHomeId(reservation));
    const cleaner = cleaners.find((item) => item.id === getReservationCleanerId(reservation));
    const searchText = search.trim().toLowerCase();

    if (!searchText) return true;

    const searchableText = [
      reservation.guestName,
      reservation.source,
      reservation.status,
      reservation.arrival,
      reservation.departure,
      home?.name,
      cleaner?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchText);
  });

  const bulkTargets = housekeepingReservations.filter((reservation) => {
    if (bulkAction === "assign") return getNeedsCleaner(reservation);
    return Boolean(getReservationCleanerId(reservation)) && reservation.status !== "Completed";
  });

  function handleCleanerChange(reservation: any, cleanerId: string) {
    updateReservation?.(reservation.id, {
      cleanerId: cleanerId || undefined,
      cleaner_id: cleanerId || null,
      status: cleanerId ? "Assigned" : "Unassigned",
    });
  }

  function handleStatusChange(reservation: any, status: string) {
    updateReservation?.(reservation.id, { status });
  }

  function handleBulkCleanerAction() {
    if (bulkAction === "assign" && !bulkCleanerId) {
      window.alert("Please select a cleaner.");
      return;
    }

    bulkTargets.forEach((reservation) => {
      if (bulkAction === "assign") {
        updateReservation?.(reservation.id, {
          cleanerId: bulkCleanerId,
          cleaner_id: bulkCleanerId,
          status: "Assigned",
        });
      } else {
        updateReservation?.(reservation.id, {
          cleanerId: undefined,
          cleaner_id: null,
          status: "Unassigned",
        });
      }
    });

    setShowBulkCleanerModal(false);
    setBulkAction("assign");
    setBulkCleanerId("");
  }

  return (
    <>
      <header className="pageHeader dashboardHeader">
        <div>
          <p className="eyebrow">Housekeeping</p>
          <h2>Housekeeping Operations</h2>
          <p className="headerSubtext">
            {selectedHome?.name ?? "Selected Property"} cleaning assignments and turnover status.
          </p>
        </div>

        <button className="primaryButton" type="button" onClick={() => setShowBulkCleanerModal(true)}>
          Bulk Cleaner Actions
        </button>
      </header>

      <section className="statsGrid">
        <button
          type="button"
          className={`statCard ${housekeepingFilter === "all" ? "selected" : ""}`}
          onClick={() => setHousekeepingFilter("all")}
        >
          <span>Upcoming cleans</span>
          <strong>{housekeepingReservations.length}</strong>
        </button>

        <button
          type="button"
          className={`statCard warning ${housekeepingFilter === "needs-cleaner" ? "selected" : ""}`}
          onClick={() => setHousekeepingFilter("needs-cleaner")}
        >
          <span>Need cleaner</span>
          <strong>{needsCleanerItems.length}</strong>
        </button>

        <button
          type="button"
          className={`statCard ${housekeepingFilter === "assigned" ? "selected" : ""}`}
          onClick={() => setHousekeepingFilter("assigned")}
        >
          <span>Assigned</span>
          <strong>{assignedItems.length}</strong>
        </button>

        <button
          type="button"
          className={`statCard ${housekeepingFilter === "accepted" ? "selected" : ""}`}
          onClick={() => setHousekeepingFilter("accepted")}
        >
          <span>Accepted</span>
          <strong>{acceptedItems.length}</strong>
        </button>

        <button
          type="button"
          className={`statCard ${housekeepingFilter === "in-process" ? "selected" : ""}`}
          onClick={() => setHousekeepingFilter("in-process")}
        >
          <span>In process</span>
          <strong>{inProcessItems.length}</strong>
        </button>
      </section>

      <section className="filtersPanel maintenanceFilters">
        <input
          type="search"
          placeholder="Search by guest name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="calendarHeaderActions">
          <select
            className="filterSelect"
            value={housekeepingFilter}
            onChange={(event) => setHousekeepingFilter(event.target.value as HousekeepingFilter)}
          >
            <option value="all">All upcoming cleans</option>
            <option value="needs-cleaner">Needs cleaner</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="in-process">In process</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </section>

      <section className="dashboardReservationsSection">
        <div className="panelHeader compact">
          <div>
            <p className="eyebrow">Team</p>
            <h3>Active Cleaners</h3>
          </div>
        </div>

        <div className="taskSummaryStrip">
          {activeCleaners.length > 0 ? (
            activeCleaners.map((cleaner) => (
              <span key={cleaner.id}>
                {cleaner.name} · {cleaner.status ?? "Available"}
              </span>
            ))
          ) : (
            <span>No active cleaners</span>
          )}
        </div>
      </section>

      <section className="dashboardReservationCards">
        {filteredReservations.map((reservation) => {
          const home = homes.find((item) => item.id === getReservationHomeId(reservation));
          const cleaner = cleaners.find((item) => item.id === getReservationCleanerId(reservation));
          const needsCleaner = getNeedsCleaner(reservation);

          return (
            <article
              className={`dashboardReservationCard ${needsCleaner ? "needsCleanerCard" : ""}`}
              key={reservation.id}
            >
              <div className="cardTopLine">
                <span className={`platformBadge platform${String(reservation.source).replace(/\s/g, "")}`}>
                  {reservation.source === "Guest Reservation"
                    ? "GUEST"
                    : reservation.source === "Owner Block"
                    ? "OWNER"
                    : reservation.source === "Airbnb"
                    ? "AIRBNB"
                    : reservation.source}
                </span>

                {needsCleaner && <span className="conflictWarningPill">Needs cleaner</span>}
              </div>

              <h3>{getReservationTitle(reservation)}</h3>
              <p>{home?.name ?? "Unknown property"}</p>

              <div className="reservationPreviewMeta">
                <div>
                  <span>Arrival</span>
                  <strong>{formatDate(reservation.arrival)}</strong>
                </div>

                <div>
                  <span>Departure</span>
                  <strong>{formatDate(reservation.departure)}</strong>
                </div>
              </div>

              <div className="reservationQuickMeta">
                <span>
                  Cleaner: <strong>{cleaner?.name ?? "Unassigned"}</strong>
                </span>
                <span>
                  Status: <strong>{reservation.status}</strong>
                </span>
              </div>

              <div className="cardActions">
                <select
                  className="filterSelect"
                  value={getReservationCleanerId(reservation)}
                  onChange={(event) => handleCleanerChange(reservation, event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {cleaners.map((cleanerOption) => (
                    <option key={cleanerOption.id} value={cleanerOption.id}>
                      {cleanerOption.name}
                    </option>
                  ))}
                </select>

                <select
                  className="filterSelect"
                  value={reservation.status ?? "Unassigned"}
                  onChange={(event) => handleStatusChange(reservation, event.target.value)}
                >
                  <option value="Unassigned">Unassigned</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Accepted">Accepted</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                  <option value="No Clean Needed">No Clean Needed</option>
                </select>
              </div>
            </article>
          );
        })}

        {filteredReservations.length === 0 && (
          <section className="emptyState">
            <h3>No housekeeping items found</h3>
            <p className="mutedText">Adjust your search or filter.</p>
          </section>
        )}
      </section>

      {showBulkCleanerModal && (
        <div className="modalOverlay">
          <div className="modalCard bulkCleanModal">
            <h2>Bulk Cleaner Actions</h2>
            <p className="mutedText">Assign or unassign cleaners for upcoming housekeeping items.</p>

            <label className="formLabel">Action</label>
            <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction)}>
              <option value="assign">Assign cleaner to all unassigned upcoming cleans</option>
              <option value="unassign">Unassign cleaner from all assigned upcoming cleans</option>
            </select>

            {bulkAction === "assign" && (
              <>
                <label className="formLabel">Cleaner</label>
                <select value={bulkCleanerId} onChange={(event) => setBulkCleanerId(event.target.value)}>
                  <option value="">Select cleaner</option>
                  {cleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="bulkConfirmBox">
              <strong>{bulkTargets.length}</strong> upcoming cleans will be updated.
            </div>

            <div className="modalActions">
              <button className="ghostButton" type="button" onClick={() => setShowBulkCleanerModal(false)}>
                Cancel
              </button>
              <button className="primaryButton" type="button" onClick={handleBulkCleanerAction}>
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
