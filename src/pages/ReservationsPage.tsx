import { useMemo, useState } from "react";

type BulkAction = "assign" | "unassign";
type BulkModalStep = "setup" | "confirm";

type ReservationsPageProps = {
  reservations?: any[];
  homes?: any[];
  cleaners?: any[];
  setSelectedItemType?: (value: string) => void;
  selectedHome?: string;
  selectedItemType?: string;
  propertyTaskStats?: any;
  search?: string;
  selectedPropertyId: string;
  setSearch?: (value: string) => void;

  needsCleanerAssignment?: (reservation: any) => boolean;
  isImportedReservation?: (reservation: any) => boolean;
  isTaskSource?: (source: any) => boolean;

  updateReservation?: (id: string, updates: any) => void;
  deleteReservation?: (id: string) => void;
  createManualReservation?: (reservation: any) => void;
  getSourceControlledMessage?: (source: any) => string;
  formatDate?: (date: string) => string;

  setActivePage?: (page: string) => void;
  setSelectedCalendarItem?: (item: any) => void;
  setReservationDetailReturnPage?: (page: string) => void;
};

function fallbackFormatDate(dateString: string) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getNotesValue(notes: string | undefined, label: string) {
  const prefix = `${label}:`;
  const line = (notes ?? "").split("\n").find((item: string) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

function getReservationDisplayTitle(reservation: any) {
  const guest = String(reservation.guestName ?? "");

  if (
    reservation.source === "Airbnb" &&
    guest.toLowerCase().includes("not available")
  ) {
    return "Blocked";
  }

  if (reservation.source === "Cleaning") {
    return getNotesValue(reservation.notes, "Cleaning Type") || reservation.guestName || "Cleaning";
  }

  if (reservation.source === "Maintenance") {
    const category = getNotesValue(reservation.notes, "Maintenance Category");
    return category ? `Maintenance - ${category}` : reservation.guestName || "Maintenance";
  }

  if (reservation.source === "Vendor Visit") {
    const vendorType = getNotesValue(reservation.notes, "Vendor Type");
    return vendorType ? `Vendor Visit - ${vendorType}` : reservation.guestName || "Vendor Visit";
  }

  if (reservation.source === "Inspection") {
    const inspectionType = getNotesValue(reservation.notes, "Inspection Type");
    return inspectionType || reservation.guestName || "Inspection";
  }

  return reservation.guestName || "Reservation";
}

function getReservationCleanerId(reservation: any) {
  return reservation.cleanerId ?? reservation.cleaner_id ?? "";
}

function getReservationHomeId(reservation: any) {
  return reservation.homeId ?? reservation.propertyId ?? reservation.property_id ?? "";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureReservation(reservation: any) {
  return String(reservation.departure ?? reservation.arrival ?? "") >= todayIsoDate();
}

export default function ReservationsPage({
  reservations = [],
  homes = [],
  cleaners = [],
  selectedHome = "all",
  selectedPropertyId = "",
  selectedItemType = "all",
  setSelectedItemType,
  search = "",
  setSearch,

  needsCleanerAssignment,
  isImportedReservation,
  isTaskSource,

  updateReservation,
  createManualReservation,
  formatDate = fallbackFormatDate,
  setActivePage,
  setSelectedCalendarItem,
  setReservationDetailReturnPage,
}: ReservationsPageProps) {
  const [showBulkCleanerModal, setShowBulkCleanerModal] = useState(false);
 const [showManualReservationModal, setShowManualReservationModal] = useState(false);
const [manualReservationForm, setManualReservationForm] = useState({
  homeId: selectedPropertyId,
  source: "Guest Reservation",
  guestName: "",
  guestPhone: "",
  guestEmail: "",
  guestAddress: "",
  guestCount: "",
  arrival: todayIsoDate(),
  departure: todayIsoDate(),
  cleanerId: "",
  notes: "",
});
  const [bulkAction, setBulkAction] = useState<BulkAction>("assign");
  const [bulkModalStep, setBulkModalStep] = useState<BulkModalStep>("setup");
  const [bulkCleanerId, setBulkCleanerId] = useState("");

  const importedCheck =
    isImportedReservation ??
    ((reservation: any) => reservation.source === "VRBO" || reservation.source === "Airbnb");

  const taskCheck =
    isTaskSource ??
    ((source: any) => source === "Cleaning" || source === "Vendor Visit" || source === "Inspection");

  const selectedCleaner = cleaners.find((cleaner) => cleaner.id === bulkCleanerId);
  const selectedBulkHome = homes.find((home) => home.id === selectedPropertyId);
  const propertyLabel = selectedBulkHome?.name ?? "Selected Property";

  const bulkEligibleCheck = (reservation: any) =>
    importedCheck(reservation) ||
    reservation.source === "Guest Reservation" ||
    reservation.source === "Owner Block";

  const getNeedsCleaner = (reservation: any) => {
    if (needsCleanerAssignment) return needsCleanerAssignment(reservation);
    return importedCheck(reservation) && !getReservationCleanerId(reservation);
  };

  const isInBulkProperty = (reservation: any) => {
    return getReservationHomeId(reservation) === selectedPropertyId;
  };

  const bulkAssignReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          bulkEligibleCheck(reservation) &&
          isFutureReservation(reservation) &&
          getNeedsCleaner(reservation) &&
          isInBulkProperty(reservation)
      ),
    [reservations, selectedPropertyId]
  );

  const bulkUnassignReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          bulkEligibleCheck(reservation) &&
          isFutureReservation(reservation) &&
          Boolean(getReservationCleanerId(reservation)) &&
          isInBulkProperty(reservation)
      ),
    [reservations, selectedPropertyId]
  );

  const affectedReservations =
    bulkAction === "assign" ? bulkAssignReservations : bulkUnassignReservations;

const visibleReservations = reservations
  .filter((reservation) => {
    const reservationHomeId = getReservationHomeId(reservation);

    if (selectedPropertyId && reservationHomeId !== selectedPropertyId) {
      return false;
    }

    if (selectedHome !== "all" && reservationHomeId !== selectedHome) {
      return false;
    }

    if (selectedItemType === "needs-cleaner" && !getNeedsCleaner(reservation)) {
      return false;
    }

    const query = search.trim().toLowerCase();

    if (!query) return true;

    const guestName = String(reservation.guestName ?? "").toLowerCase();

    return guestName.includes(query);
  })
  .sort((a, b) => a.arrival.localeCompare(b.arrival));

  const reservationListItems = reservations.filter(
  (item) =>
    importedCheck(item) ||
    item.source === "Owner Block" ||
    item.source === "Guest Reservation"
);

const futureReservations = reservationListItems.filter((item) => isFutureReservation(item));
const reservationsNeedingCleaner = reservationListItems.filter((item) => getNeedsCleaner(item));
const inProcessReservations = reservationListItems.filter((item) => item.status === "In Process");

  function openReservation(reservation: any) {
    setSelectedCalendarItem?.(reservation);
    setReservationDetailReturnPage?.("Reservations");
    setActivePage?.("Reservation Detail");
  }
function closeManualReservationModal() {
  setShowManualReservationModal(false);
  setManualReservationForm({
    homeId: selectedPropertyId,
    source: "Guest Reservation",
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestAddress: "",
    guestCount: "",
    arrival: todayIsoDate(),
    departure: todayIsoDate(),
    cleanerId: "",
    notes: "",
  });
}

function handleCreateManualReservation() {
 const activeReservationHomeId = selectedPropertyId || manualReservationForm.homeId;

if (!activeReservationHomeId) {
  window.alert("Please select a property.");
  return;
}
  if (!manualReservationForm.arrival || !manualReservationForm.departure) {
    window.alert("Please select arrival and departure dates.");
    return;
  }

  const selectedProperty = homes.find((home) => home.id === activeReservationHomeId);
  const defaultCleanerId =
    manualReservationForm.cleanerId ||
    selectedProperty?.defaultCleanerId ||
    selectedProperty?.default_cleaner_id ||
    "";

  const guestInfoNotes = [
    manualReservationForm.guestPhone ? `Guest Phone: ${manualReservationForm.guestPhone}` : "",
    manualReservationForm.guestEmail ? `Guest Email: ${manualReservationForm.guestEmail}` : "",
    manualReservationForm.guestAddress ? `Guest Address: ${manualReservationForm.guestAddress}` : "",
    manualReservationForm.guestCount ? `Guest Count: ${manualReservationForm.guestCount}` : "",
    manualReservationForm.notes ? `Operations Notes: ${manualReservationForm.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  createManualReservation?.({
    ...manualReservationForm,
    homeId: activeReservationHomeId,
    cleanerId: defaultCleanerId || undefined,
    status: defaultCleanerId ? "Assigned" : "Unassigned",
    notes: guestInfoNotes,
  });

  closeManualReservationModal();
}
  function closeBulkCleanerModal() {
    setShowBulkCleanerModal(false);
    setBulkModalStep("setup");
    setBulkAction("assign");
    setBulkCleanerId("");
  }

  function handleBulkCleanerAction() {
    if (bulkAction === "assign") {
      if (!bulkCleanerId) return;

      bulkAssignReservations.forEach((reservation) => {
        updateReservation?.(reservation.id, {
          cleanerId: bulkCleanerId,
          cleaner_id: bulkCleanerId,
          status: "Assigned",
        });
      });
    }

    if (bulkAction === "unassign") {
      bulkUnassignReservations.forEach((reservation) => {
        updateReservation?.(reservation.id, {
          cleanerId: undefined,
          cleaner_id: null,
          status: "Unassigned",
        });
      });
    }

    closeBulkCleanerModal();
  }

  return (
    <>
      <section className="taskSummaryStrip">
       <span>{cleaners.length} active cleaners</span>
        <span>{futureReservations.length} upcoming</span>
        <span>{reservationsNeedingCleaner.length} need cleaner</span>
        <span>{inProcessReservations.length} in process</span>
      </section>

      <section className="filtersPanel maintenanceFilters">
        <input
          type="search"
          placeholder="Search reservations by guest name"
          value={search}
          onChange={(event) => setSearch?.(event.target.value)}
        />

        <div className="calendarHeaderActions">
          <select
  value={selectedItemType}
  onChange={(event) => setSelectedItemType?.(event.target.value)}
  className="filterSelect"
>
  <option value="all">All Reservations</option>
  <option value="needs-cleaner">Needs Cleaner</option>
  <option value="reservations">Guest Reservations</option>
  <option value="owner-blocks">Owner Blocks</option>
</select>
          <button
  className="primaryButton"
  type="button"
  onClick={() => {
    setManualReservationForm({
      ...manualReservationForm,
      homeId: selectedPropertyId,
    });
    setShowManualReservationModal(true);
  }}
>
  + New Reservation
</button>

          <button
  className="primaryButton"
  type="button"
  onClick={() => setShowBulkCleanerModal(true)}
>
  Bulk Cleaner Actions
</button>
        </div>

        
      </section>

      <section className="dashboardReservationCards">
        {visibleReservations.map((reservation) => {
          const home = homes.find((item) => item.id === getReservationHomeId(reservation));
          const cleaner = cleaners.find((item) => item.id === getReservationCleanerId(reservation));
          const isTask = taskCheck(reservation.source);
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

<button
  className="unstyledCardButton"
  type="button"
  onClick={() => openReservation(reservation)}
>
  <h3>{getReservationDisplayTitle(reservation)}</h3>
  <p>{home?.name ?? "Unknown property"}</p>

  <div className="reservationPreviewMeta">
    <div>
      <span>{isTask ? "Task Date" : "Arrival"}</span>
      <strong>{formatDate(reservation.arrival)}</strong>
    </div>

    <div>
      <span>{isTask ? "Type" : "Departure"}</span>
      <strong>{isTask ? reservation.source : formatDate(reservation.departure)}</strong>
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

  {reservation.notes && <p className="mutedText">{reservation.notes}</p>}
</button>
</article>
          );
        })}

        {visibleReservations.length === 0 && (
          <section className="emptyState">
            <h3>No reservations found</h3>
            <p className="mutedText">Adjust your search or filters.</p>
          </section>
        )}
      </section>
{showManualReservationModal && (
  <div className="modalOverlay">
    <div className="modalCard bulkCleanModal">
      <div className="panelHeader compact">
        <div>
          <p className="eyebrow">Create</p>
          <h2>New Reservation</h2>
          <p className="mutedText">
            Add a guest reservation or owner block for the selected property.
          </p>
        </div>
      </div>

      <section className="manualReservationSection">
        <p className="eyebrow">Reservation</p>

        <label className="formLabel">Property</label>
        <div className="readOnlyPropertyField">
          {homes.find((home) => home.id === selectedPropertyId)?.name ?? "Selected property"}
        </div>

        <label className="formLabel">Reservation Type</label>
        <select
          value={manualReservationForm.source}
          onChange={(event) =>
            setManualReservationForm({
              ...manualReservationForm,
              source: event.target.value,
            })
          }
        >
          <option value="Guest Reservation">Guest Reservation</option>
          <option value="Owner Block">Owner Block</option>
        </select>

        <div className="manualReservationDateGrid">
          <label>
            Arrival
            <input
              type="date"
              value={manualReservationForm.arrival}
              onChange={(event) => {
                const nextArrival = event.target.value;
                setManualReservationForm({
                  ...manualReservationForm,
                  arrival: nextArrival,
                  departure:
                    manualReservationForm.departure && nextArrival > manualReservationForm.departure
                      ? nextArrival
                      : manualReservationForm.departure,
                });
              }}
            />
          </label>

          <label>
            Departure
            <input
              type="date"
              value={manualReservationForm.departure}
              min={manualReservationForm.arrival || undefined}
              onChange={(event) =>
                setManualReservationForm({
                  ...manualReservationForm,
                  departure: event.target.value,
                })
              }
            />
          </label>
        </div>
      </section>

      {manualReservationForm.source === "Guest Reservation" && (
        <section className="manualReservationSection">
          <p className="eyebrow">Guest Information</p>

          <label className="formLabel">Guest Name</label>
          <input
            value={manualReservationForm.guestName}
            onChange={(event) =>
              setManualReservationForm({
                ...manualReservationForm,
                guestName: event.target.value,
              })
            }
            placeholder="Guest name"
          />

          <div className="manualReservationDateGrid">
            <label>
              Phone
              <input
                value={manualReservationForm.guestPhone}
                onChange={(event) =>
                  setManualReservationForm({
                    ...manualReservationForm,
                    guestPhone: event.target.value,
                  })
                }
                placeholder="(555) 555-5555"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={manualReservationForm.guestEmail}
                onChange={(event) =>
                  setManualReservationForm({
                    ...manualReservationForm,
                    guestEmail: event.target.value,
                  })
                }
                placeholder="guest@email.com"
              />
            </label>
          </div>

          <label className="formLabel">Guest Address</label>
          <input
            value={manualReservationForm.guestAddress}
            onChange={(event) =>
              setManualReservationForm({
                ...manualReservationForm,
                guestAddress: event.target.value,
              })
            }
            placeholder="Mailing address"
          />

          <label className="formLabel">Number of Guests</label>
          <input
            type="number"
            min="1"
            value={manualReservationForm.guestCount}
            onChange={(event) =>
              setManualReservationForm({
                ...manualReservationForm,
                guestCount: event.target.value,
              })
            }
            placeholder="Example: 4"
          />
        </section>
      )}

      {manualReservationForm.source === "Owner Block" && (
        <section className="manualReservationSection">
          <p className="eyebrow">Block Information</p>

          <label className="formLabel">Block Name</label>
          <input
            value={manualReservationForm.guestName}
            onChange={(event) =>
              setManualReservationForm({
                ...manualReservationForm,
                guestName: event.target.value,
              })
            }
            placeholder="Owner stay, repairs, personal use, etc."
          />
        </section>
      )}

      <section className="manualReservationSection">
        <p className="eyebrow">Operations</p>

        <label className="formLabel">Assign Cleaner</label>
        <select
          value={manualReservationForm.cleanerId}
          onChange={(event) =>
            setManualReservationForm({
              ...manualReservationForm,
              cleanerId: event.target.value,
            })
          }
        >
          <option value="">Use Property Default Cleaner</option>

          {cleaners.map((cleaner) => (
            <option key={cleaner.id} value={cleaner.id}>
              {cleaner.name}
            </option>
          ))}
        </select>

        <label className="formLabel">Operations Notes</label>
        <textarea
          value={manualReservationForm.notes}
          onChange={(event) =>
            setManualReservationForm({
              ...manualReservationForm,
              notes: event.target.value,
            })
          }
          placeholder="Cleaner instructions, gate codes, late arrival notes, supplies, or anything the operations team should know."
        />
      </section>

      <div className="modalActions">
        <button
          className="ghostButton"
          type="button"
          onClick={closeManualReservationModal}
        >
          Cancel
        </button>

        <button
          className="primaryButton"
          type="button"
          onClick={handleCreateManualReservation}
        >
          Create Reservation
        </button>
      </div>
    </div>
  </div>
)}
      {showBulkCleanerModal && (
        <div className="modalOverlay">
          <div className="modalCard bulkCleanModal">
            {bulkModalStep === "setup" ? (
              <>
                <h2>Bulk Cleaner Actions</h2>
                <p className="mutedText">
                  Assign or remove cleaners for future reservations and owner blocks.
                </p>

                <p className="formLabel">Action</p>
                <div className="bulkScopeOptions">
                  <label className="bulkScopeOption">
                    <input
                      type="radio"
                      checked={bulkAction === "assign"}
                      onChange={() => setBulkAction("assign")}
                    />
                    <span>Assign Cleans</span>
                  </label>

                  <label className="bulkScopeOption">
                    <input
                      type="radio"
                      checked={bulkAction === "unassign"}
                      onChange={() => setBulkAction("unassign")}
                    />
                    <span>Unassign Cleans</span>
                  </label>
                </div>

                {bulkAction === "assign" && (
                  <>
                    <label className="formLabel" htmlFor="bulkCleanerSelect">
                      Cleaner
                    </label>
                    <select
                      id="bulkCleanerSelect"
                      value={bulkCleanerId}
                      onChange={(event) => setBulkCleanerId(event.target.value)}
                    >
                      <option value="">Select Cleaner</option>
                      {cleaners.map((cleaner) => (
                        <option key={cleaner.id} value={cleaner.id}>
                          {cleaner.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <label className="formLabel">
  Property
</label>

<div className="readOnlyPropertyField">
  {homes.find((home) => home.id === selectedPropertyId)?.name ??
    "No Property Selected"}
</div>
                <p className="mutedText">
                  {affectedReservations.length} future reservations currently match this action.
                </p>

                <div className="modalActions">
                  <button className="ghostButton" type="button" onClick={closeBulkCleanerModal}>
                    Cancel
                  </button>
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={bulkAction === "assign" && !bulkCleanerId}
                    onClick={() => setBulkModalStep("confirm")}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>
                  {bulkAction === "assign" ? "Confirm Bulk Assign" : "Confirm Bulk Unassign"}
                </h2>

                {bulkAction === "assign" ? (
                  <p>
                    Assign all future unassigned cleans for <strong>{propertyLabel}</strong> to{" "}
                    <strong>{selectedCleaner?.name ?? "this cleaner"}</strong>?
                  </p>
                ) : (
                  <p>
                    Remove cleaner assignments from all future cleans for{" "}
                    <strong>{propertyLabel}</strong>?
                  </p>
                )}

                <p className="mutedText">
                  {affectedReservations.length} reservations will be updated.
                </p>

                <div className="modalActions">
                  <button className="ghostButton" type="button" onClick={() => setBulkModalStep("setup")}>
                    Back
                  </button>
                  <button className="ghostButton" type="button" onClick={closeBulkCleanerModal}>
                    Cancel
                  </button>
                  <button
                    className={bulkAction === "assign" ? "primaryButton" : "primaryButton dangerButton"}
                    type="button"
                    disabled={affectedReservations.length === 0}
                    onClick={handleBulkCleanerAction}
                  >
                    {bulkAction === "assign" ? "Assign All" : "Unassign All"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}