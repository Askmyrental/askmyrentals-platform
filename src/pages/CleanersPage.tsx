import { useState } from "react";

type CleanersPageProps = {
  cleaners: any[];
  reservations: any[];
  homes: any[];
  selectedCleanerId: string;
  setSelectedCleanerId: (value: string) => void;
  setActivePage: (page: string) => void;
  updateCleaner: (id: string, updates: any) => void;
  deleteCleaner: (id: string) => void;
  addCleaner: (cleaner: any) => void;
};

export default function CleanersPage({
  cleaners,
  reservations,
  homes,
  selectedCleanerId,
  setSelectedCleanerId,
  setActivePage,
  updateCleaner,
  deleteCleaner,
  addCleaner,
}: CleanersPageProps) {
  const [showCleanerForm, setShowCleanerForm] = useState(false);
  const [cleanerForm, setCleanerForm] = useState({
    name: "",
    phone: "",
    email: "",
    serviceArea: "",
    notes: "",
  });
  const [showCleanerDetail, setShowCleanerDetail] = useState(false);

  const selectedCleaner =
    cleaners.find((cleaner) => cleaner.id === selectedCleanerId) ?? null;

  const todayKey = new Date().toISOString().slice(0, 10);

  const getReservationStart = (reservation: any) =>
    reservation.arrival ?? reservation.start ?? reservation.startDate ?? reservation.checkIn ?? "";

  const getReservationEnd = (reservation: any) =>
    reservation.departure ?? reservation.end ?? reservation.endDate ?? reservation.checkOut ?? "";

  const getHomeName = (homeId: string) =>
    homes.find((home) => home.id === homeId)?.name ?? "Property";

  const getReservationHomeName = (reservation: any) =>
    reservation.homeName ??
    reservation.propertyName ??
    getHomeName(reservation.homeId ?? reservation.propertyId);

  const getReservationGuestName = (reservation: any) =>
    reservation.guestName ??
    reservation.guest ??
    reservation.name ??
    reservation.title ??
    reservation.summary ??
    "Turnover";

  const formatDate = (dateKey: string) => {
    if (!dateKey) return "Date TBD";

    const date = new Date(`${dateKey}T12:00:00`);

    if (Number.isNaN(date.getTime())) return dateKey;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const requiresTurnover = (reservation: any) => {
    const arrival = getReservationStart(reservation);
    const departure = getReservationEnd(reservation);

    if (!arrival || !departure) return false;
    if (departure < todayKey) return false;
    if (reservation.type === "Mirror Block") return false;
    if (reservation.status === "Blocked") return false;
    if (reservation.status === "Completed") return false;
    if (reservation.status === "No Clean Needed") return false;

    return (
      reservation.type === "Reservation" ||
      reservation.type === "Owner Block" ||
      reservation.source === "Guest Reservation" ||
      reservation.source === "Owner Block" ||
      reservation.source === "Airbnb" ||
      reservation.source === "VRBO"
    );
  };

  const isAcceptedClean = (reservation: any) =>
    reservation.cleanerStatus === "Accepted" ||
    reservation.cleanStatus === "Accepted" ||
    reservation.cleaningStatus === "Accepted" ||
    reservation.status === "Accepted" ||
    reservation.accepted === true ||
    reservation.cleanerAccepted === true;

  const isAwaitingCleanerAcceptance = (reservation: any) =>
    reservation.cleanerStatus === "Awaiting Acceptance" ||
    reservation.cleanStatus === "Awaiting Acceptance" ||
    reservation.cleaningStatus === "Awaiting Acceptance" ||
    reservation.status === "Awaiting Acceptance" ||
    reservation.accepted === false ||
    reservation.cleanerAccepted === false ||
    !isAcceptedClean(reservation);

  const getCleanerReservations = (cleanerId: string) =>
    reservations
      .filter(
        (reservation) =>
          reservation.cleanerId === cleanerId &&
          requiresTurnover(reservation)
      )
      .sort((a, b) => getReservationEnd(a).localeCompare(getReservationEnd(b)));

  const getCleanerAcceptedCount = (cleanerId: string) =>
    getCleanerReservations(cleanerId).filter(isAcceptedClean).length;

  const getCleanerAwaitingCount = (cleanerId: string) =>
    getCleanerReservations(cleanerId).filter(isAwaitingCleanerAcceptance).length;

  const getCleanerDefaultHomes = (cleanerId: string) =>
    homes.filter(
      (home) =>
        home.defaultCleanerId === cleanerId ||
        home.default_cleaner_id === cleanerId ||
        home.cleanerId === cleanerId
    );

  const cleanerReservations = selectedCleaner
    ? getCleanerReservations(selectedCleaner.id)
    : [];

  const upcomingCleanerReservations = cleanerReservations.slice(0, 8);

  const defaultHomes = selectedCleaner
    ? getCleanerDefaultHomes(selectedCleaner.id)
    : [];

  const unassignedTurnovers = reservations.filter(
    (reservation) => requiresTurnover(reservation) && !reservation.cleanerId
  );

  const totalActiveCleans = cleaners.reduce(
    (total, cleaner) => total + getCleanerReservations(cleaner.id).length,
    0
  );

  const totalAcceptedCleans = cleaners.reduce(
    (total, cleaner) => total + getCleanerAcceptedCount(cleaner.id),
    0
  );

  const totalAwaitingCleans = cleaners.reduce(
    (total, cleaner) => total + getCleanerAwaitingCount(cleaner.id),
    0
  );

  return (
    <>
      {showCleanerForm && (
        <div className="modalOverlay" onClick={() => setShowCleanerForm(false)}>
          <div className="modalCard maintenanceModal" onClick={(event) => event.stopPropagation()}>
            <div className="panelHeader modalHeader">
              <div>
                <p className="eyebrow">Cleaner setup</p>
                <h3>Add Cleaner</h3>
                <p className="mutedText">Create a cleaner profile before sending an invite.</p>
              </div>

              <button className="ghostButton" type="button" onClick={() => setShowCleanerForm(false)}>
                Close
              </button>
            </div>

            <form
              className="manualForm workOrderModalForm"
              onSubmit={(event) => {
                event.preventDefault();

                addCleaner({
                  id: `cleaner-${Date.now()}`,
                  name: cleanerForm.name,
                  phone: cleanerForm.phone,
                  email: cleanerForm.email,
                  serviceArea: cleanerForm.serviceArea,
                  notes: cleanerForm.notes,
                  status: "Available",
                  rating: 5,
                  activeJobs: 0,
                });

                setCleanerForm({
                  name: "",
                  phone: "",
                  email: "",
                  serviceArea: "",
                  notes: "",
                });

                setShowCleanerForm(false);
              }}
            >
              <label>
                Cleaner name
                <input
                  value={cleanerForm.name}
                  onChange={(event) => setCleanerForm({ ...cleanerForm, name: event.target.value })}
                  placeholder="Example: Allen Cleaning"
                  required
                />
              </label>

              <label>
                Phone
                <input
                  value={cleanerForm.phone}
                  onChange={(event) => setCleanerForm({ ...cleanerForm, phone: event.target.value })}
                  placeholder="843-555-1234"
                />
              </label>

              <label>
                Email
                <input
                  value={cleanerForm.email}
                  onChange={(event) => setCleanerForm({ ...cleanerForm, email: event.target.value })}
                  placeholder="cleaner@example.com"
                />
              </label>

              <label>
                Service area
                <input
                  value={cleanerForm.serviceArea}
                  onChange={(event) => setCleanerForm({ ...cleanerForm, serviceArea: event.target.value })}
                  placeholder="Myrtle Beach, North Myrtle, Surfside"
                />
              </label>

              <label className="fullWidth">
                Notes
                <textarea
                  value={cleanerForm.notes}
                  onChange={(event) => setCleanerForm({ ...cleanerForm, notes: event.target.value })}
                  placeholder="Availability, preferred properties, gate access notes..."
                />
              </label>

              <div className="fullWidth formActions">
                <button className="ghostButton" type="button" onClick={() => setShowCleanerForm(false)}>
                  Cancel
                </button>

                <button className="primaryButton" type="submit">
                  Save Cleaner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="pageHeader">
        <div>
          <p className="eyebrow">Cleaner operations</p>
          <h2>Cleaners</h2>
          <p className="headerSubtext">
            Manage cleaner assignments, acceptance status, default properties, and upcoming turnovers.
          </p>
        </div>

        <div className="calendarHeaderActions">
          <button className="primaryButton" type="button" onClick={() => setShowCleanerForm(true)}>
            + Add Cleaner
          </button>

          <button className="ghostButton" onClick={() => setActivePage("Reservations")} type="button">
            Assign Turnovers
          </button>
        </div>
      </header>

      <section className="statsGrid">
        <div className="statCard">
          <span>Total cleaners</span>
          <strong>{cleaners.length}</strong>
        </div>
        <div className="statCard">
          <span>Active cleans</span>
          <strong>{totalActiveCleans}</strong>
        </div>
        <div className="statCard">
          <span>Accepted</span>
          <strong>{totalAcceptedCleans}</strong>
        </div>
        <div className="statCard warning">
          <span>Awaiting</span>
          <strong>{totalAwaitingCleans}</strong>
        </div>
        <div className="statCard warning">
          <span>Unassigned stays</span>
          <strong>{unassignedTurnovers.length}</strong>
        </div>
      </section>

      <section className="cleanersLayout">
        <div className="cleanerCardGrid">
          {cleaners.map((cleaner) => {
            const activeCount = getCleanerReservations(cleaner.id).length;
            const acceptedCount = getCleanerAcceptedCount(cleaner.id);
            const awaitingCount = getCleanerAwaitingCount(cleaner.id);
            const defaultHomeCount = getCleanerDefaultHomes(cleaner.id).length;
            const nextClean = getCleanerReservations(cleaner.id)[0];

return (
  <div
    key={cleaner.id}
    className={`cleanerCard ${selectedCleaner?.id === cleaner.id ? "selected" : ""}`}
    onClick={() => {
      setSelectedCleanerId(cleaner.id);
      setShowCleanerDetail(true);
    }}
    
  >
    <div className="cleanerIdentity">
      <div className="cleanerAvatar">{cleaner.name.slice(0, 2).toUpperCase()}</div>

      <div>
        <div className="cleanerCardTitleRow">
          <h3>{cleaner.name}</h3>
          <span className={`statusPill ${cleaner.status === "Available" ? "healthy" : ""}`}>
            {cleaner.status}
          </span>
        </div>

        <p>{cleaner.serviceArea || cleaner.email || "No service area added"}</p>

 <button
  type="button"
  className="inviteCleanerButton"
  onClick={(event) => {
    event.stopPropagation();
    alert(`Invite sent to ${cleaner.name}`);
  }}
>
  Invite Cleaner
</button>
      </div>
    </div>

    <div className="cleanerStats">
      <div className="cleanerStatCard">
        <span className="statNumber">{activeCount}</span>
        <span className="statLabel">Active</span>
      </div>

      <div className="cleanerStatCard">
        <span className="statNumber">{acceptedCount}</span>
        <span className="statLabel">Accepted</span>
      </div>

      <div className="cleanerStatCard">
        <span className="statNumber">{awaitingCount}</span>
        <span className="statLabel">Awaiting</span>
      </div>

      <div className="cleanerStatCard">
        <span className="statNumber">{defaultHomeCount}</span>
        <span className="statLabel">Default</span>
      </div>
    </div>

    <div className="nextCleanPanel">
      <strong>Next clean</strong>
      <p>
        {nextClean
          ? `${formatDate(getReservationEnd(nextClean))} · ${getReservationHomeName(nextClean)}`
          : "No upcoming cleans"}
      </p>
    </div>
  </div>
);
          })}
        </div>

        {showCleanerDetail && selectedCleaner && (
          <div className="modalOverlay" onClick={() => setShowCleanerDetail(false)}>
            <div
              className="modalCard maintenanceModal"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="panelHeader modalHeader">
                <div>
                  <p className="eyebrow">Cleaner detail</p>
                  <h3>{selectedCleaner.name}</h3>
                  <p className="mutedText">
                    {[selectedCleaner.phone, selectedCleaner.email, selectedCleaner.serviceArea]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <button className="ghostButton" type="button" onClick={() => setShowCleanerDetail(false)}>
                  Save & Exit
                </button>
              </div>

              <div className="cleanerDetailHeader">
                <div className="cleanerAvatar large">{selectedCleaner.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3>{selectedCleaner.name}</h3>
                  <p>{selectedCleaner.serviceArea || "Service area not added yet"}</p>
                </div>
              </div>

              <div className="detailStack">
                <div>
                  <span>Status</span>
                  <select
                    value={selectedCleaner.status}
                    onChange={(event) => updateCleaner(selectedCleaner.id, { status: event.target.value })}
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="cleanerDetailStats">
                <div>
                  <span>Upcoming</span>
                  <strong>{cleanerReservations.length}</strong>
                </div>
                <div>
                  <span>Accepted</span>
                  <strong>{getCleanerAcceptedCount(selectedCleaner.id)}</strong>
                </div>
                <div>
                  <span>Awaiting</span>
                  <strong>{getCleanerAwaitingCount(selectedCleaner.id)}</strong>
                </div>
                <div>
                  <span>Defaults</span>
                  <strong>{defaultHomes.length}</strong>
                </div>
              </div>

              <div className="detailSection">
                <div className="sectionTitleRow">
                  <div>
                    <p className="eyebrow">Assigned schedule</p>
                    <h4>Upcoming Assigned Cleans</h4>
                  </div>
                  <button className="ghostButton" type="button" onClick={() => setActivePage("Reservations")}>
                    Manage assignments
                  </button>
                </div>

                {upcomingCleanerReservations.length > 0 ? (
                  <div className="cleanerAssignedList">
                    {upcomingCleanerReservations.map((reservation) => {
                      const checkoutDate = getReservationEnd(reservation);
                      const accepted = isAcceptedClean(reservation);

                      return (
                        <div className="cleanerAssignedCard" key={reservation.id}>
                          <div>
                            <span className="cleanerAssignedProperty">
                              {getReservationHomeName(reservation)}
                            </span>
                            <strong>{formatDate(checkoutDate)}</strong>
                            <p>{getReservationGuestName(reservation)}</p>
                          </div>

                          <span className={`statusPill ${accepted ? "healthy" : "warning"}`}>
                            {accepted ? "Accepted" : "Awaiting"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="emptyStateCard">
                    <strong>No upcoming assigned cleans</strong>
                    <p>Assign this cleaner to future reservations to build their schedule.</p>
                  </div>
                )}
              </div>

              <div className="detailSection">
                <p className="eyebrow">Default properties</p>

                {defaultHomes.length > 0 ? (
                  <div className="propertyMiniStats">
                    {defaultHomes.map((home) => (
                      <span key={home.id}>{home.name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mutedText">No default properties assigned yet.</p>
                )}
              </div>

              {selectedCleaner.notes && <p className="notesBox">{selectedCleaner.notes}</p>}

              <div className="cardActions">
                <button className="dangerButton" onClick={() => deleteCleaner(selectedCleaner.id)} type="button">
                  Delete Cleaner
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
