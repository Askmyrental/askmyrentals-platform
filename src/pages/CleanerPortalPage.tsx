import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import CleanerPortalCalendar from "./CleanerPortalCalendar";

type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";

type CleanerPortalPageProps = {
  cleaners: any[];
  homes: any[];
  reservations: any[];
  cleanerPortalId: string;
  setCleanerPortalId: (value: string) => void;
  cleanerIssueForm: any;
  setCleanerIssueForm: Dispatch<SetStateAction<any>>;
  updateReservation: (id: string, updates: any) => void;
  updateReservationFromCleaner: (id: string, status: any, note: string) => void;
  submitCleanerMaintenanceIssue: (event: FormEvent<HTMLFormElement>) => void;
  isImportedReservation: (reservation: any) => boolean;
  getUrgency: (date: string) => any;
  formatDate: (date: string) => string;
  toInputDate: (date: Date) => string;
};

export default function CleanerPortalPage({
  cleaners,
  homes,
  reservations,
  cleanerPortalId,
  setCleanerPortalId,
  cleanerIssueForm,
  setCleanerIssueForm,
  updateReservation,
  updateReservationFromCleaner,
  submitCleanerMaintenanceIssue,
  isImportedReservation,
  getUrgency,
  formatDate,
  toInputDate,
}: CleanerPortalPageProps) {
  const [showCleanerIssueModal, setShowCleanerIssueModal] = useState(false);
  const [showCleanerCalendar, setShowCleanerCalendar] = useState(false);

  const activeCleaner = cleaners.find((cleaner) => cleaner.id === cleanerPortalId) ?? cleaners[0];

const today = new Date();
today.setHours(0, 0, 0, 0);

const cleanerTasks = reservations
  .filter((reservation) => {
    const departureDate = new Date(reservation.departure);
    departureDate.setHours(0, 0, 0, 0);

    return (
      reservation.cleanerId === activeCleaner?.id &&
     (isImportedReservation(reservation) ||
  reservation.source === "Guest Reservation" ||
  reservation.source === "Owner Block" ||
  reservation.source === "Cleaning") &&
      departureDate >= today
    );
  });

  const isNeedsAcceptance = (reservation: any) =>
    reservation.status !== "Accepted" &&
    reservation.status !== "In Process" &&
    reservation.status !== "Completed";

  const needsAcceptanceCount = cleanerTasks.filter(isNeedsAcceptance).length;

  const sortedCleanerTasks = [...cleanerTasks].sort((a, b) => {
    const aNeedsAcceptance = isNeedsAcceptance(a);
    const bNeedsAcceptance = isNeedsAcceptance(b);

    if (aNeedsAcceptance !== bNeedsAcceptance) {
      return aNeedsAcceptance ? -1 : 1;
    }

    return new Date(a.departure).getTime() - new Date(b.departure).getTime();
  });

  const urgentTasks = cleanerTasks.filter((reservation) => {
    const urgency = getUrgency(reservation.arrival);
    return urgency.label === "Today" || urgency.label === "Tomorrow" || urgency.className === "watch";
  });

  const openIssueModal = () => setShowCleanerIssueModal(true);
  const closeIssueModal = () => setShowCleanerIssueModal(false);

  return (
    <>
      <header className="pageHeader cleanerPortalHero">
        <div>
          <p className="eyebrow">Welcome to your cleaner portal</p>
<h2></h2>
<p className="headerSubtext">
  View assigned cleanings, check your calendar, and report issues.
</p>
        </div>

        <div className="cardActions">
          <button className="primaryButton" type="button" onClick={() => setShowCleanerCalendar(true)}>
            My Calendar
          </button>

          <button className="warningAction" type="button" onClick={openIssueModal}>
            Report Issue
          </button>
        </div>
      </header>

      <section className="cleanerPortalShell">
        <div className="cleanerPhonePanel">
          <div className="cleanerPortalTop">
            <div className="cleanerAvatar large">{activeCleaner?.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <p className="eyebrow">Signed in as</p>
              <h3>{activeCleaner?.name}</h3>
              <span>
                {activeCleaner?.serviceArea} · {activeCleaner?.status}
              </span>
            </div>
          </div>

          <label className="cleanerSwitcher">
            Test cleaner view
            <select value={cleanerPortalId} onChange={(event) => setCleanerPortalId(event.target.value)}>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.name}
                </option>
              ))}
            </select>
          </label>

          <div className="cleanerQuickStats">
            <div className="cardActions" style={{ marginTop: "12px" }}>
  <button
    type="button"
    className="primaryButton"
    onClick={() => {
      cleanerTasks
        .filter(isNeedsAcceptance)
        .forEach((task) => {
          updateReservationFromCleaner(
            task.id,
            "Accepted",
            "Cleaner accepted all assignments"
          );
        });
    }}
    disabled={needsAcceptanceCount === 0}
  >
    Accept All New Cleans
  </button>
</div>
            <div>
              <span>Assigned</span>
              <strong>{cleanerTasks.length}</strong>
            </div>
            <div>
              <span>Needs Acceptance</span>
              <strong>{needsAcceptanceCount}</strong>
            </div>
            <div>
              <span>Urgent</span>
              <strong>{urgentTasks.length}</strong>
            </div>
            <div>
              <span>In Process</span>
              <strong>{cleanerTasks.filter((task) => task.status === "In Process").length}</strong>
            </div>
          </div>

          <div className="cleanerTaskStack">
            <h4>My assigned cleanings</h4>

            {cleanerTasks.length === 0 ? (
              <p className="mutedText">No assigned cleanings yet.</p>
            ) : (
              sortedCleanerTasks.map((reservation) => {
                const home = homes.find((item) => item.id === reservation.homeId);
                const urgency = getUrgency(reservation.arrival);
                const needsAcceptance = isNeedsAcceptance(reservation);

                return (
                  <article key={reservation.id} className="cleanerTaskCard">
                    <div className="cleanerTaskHeader">
                      <div>
                        <h3>{home?.name ?? "Unknown home"}</h3>
                        <p>{reservation.guestName}</p>
                      </div>
                      <span className={`urgencyBadge ${urgency.className}`}>{urgency.label}</span>
                    </div>

                    {needsAcceptance && (
                      <div className="warningBadge">⚠ Needs Acceptance</div>
                    )}

                    <div className="cleanerTaskDetails">
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
                    </div>

                    {reservation.notes && <p className="notesBox">{reservation.notes}</p>}

                    <div className="cleanerActionGrid">
                      {reservation.status === "Accepted" ? (
                        <button
                          type="button"
                          className="warningAction"
                          onClick={() =>
                            updateReservation(reservation.id, {
                              cleanerId: undefined,
                              status: "Unassigned",
                            })
                          }
                        >
                          Release Assignment
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateReservationFromCleaner(
                              reservation.id,
                              "Accepted",
                              "Cleaner accepted the assignment"
                            )
                          }
                        >
                          Accept
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={toInputDate(new Date()) < reservation.departure}
                        onClick={() =>
                          updateReservationFromCleaner(reservation.id, "In Process", "Cleaner started cleaning")
                        }
                      >
                        Start
                      </button>

                      <button
                        type="button"
                        disabled={reservation.status !== "In Process" || toInputDate(new Date()) < reservation.departure}
                        onClick={() =>
                          updateReservationFromCleaner(reservation.id, "Completed", "Cleaner completed the reservation")
                        }
                      >
                        Complete
                      </button>

                      <button
                        type="button"
                        className="warningAction"
                        onClick={() => {
                          setCleanerIssueForm((current: any) => ({
                            ...current,
                            reservationId: reservation.id,
                            homeId: reservation.homeId,
                          }));
                          openIssueModal();
                        }}
                      >
                        Report Issue
                      </button>
                    </div>

                    <div className="etaRow">
                      <button
                        type="button"
                        onClick={() =>
                          updateReservationFromCleaner(reservation.id, "Accepted", "Cleaner ETA: on time")
                        }
                      >
                        ETA On Time
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateReservationFromCleaner(
                            reservation.id,
                            "In Process",
                            "Cleaner running late; owner review recommended"
                          )
                        }
                      >
                        Running Late
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateReservationFromCleaner(reservation.id, "In Process", "Cleaner requested owner message")
                        }
                      >
                        Message Owner
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          
        </div>

        {showCleanerCalendar && (
          <div className="modalOverlay" onClick={() => setShowCleanerCalendar(false)}>
            <div className="modalCard cleanerCalendarModal" onClick={(event) => event.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <p className="eyebrow">Cleaner schedule</p>
                  <h3>My Calendar</h3>
                </div>

                <button type="button" className="secondaryButton" onClick={() => setShowCleanerCalendar(false)}>
                  Close
                </button>
              </div>

              <CleanerPortalCalendar
                cleanerTasks={cleanerTasks}
                homes={homes}
                getUrgency={getUrgency}
              />
            </div>
          </div>
        )}

        {showCleanerIssueModal && (
          <div className="modalOverlay" onClick={closeIssueModal}>
            <div className="modalCard cleanerIssueModal" onClick={(event) => event.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <p className="eyebrow">Maintenance reporting</p>
                  <h3>Report an Issue</h3>
                </div>

                <button type="button" className="secondaryButton" onClick={closeIssueModal}>
                  Close
                </button>
              </div>

              <p className="mutedText">
                This creates an owner notification and a maintenance work order automatically.
              </p>

              <form className="cleanerIssueForm" onSubmit={submitCleanerMaintenanceIssue}>
                <label>
                  Property
                  <select
                    value={cleanerIssueForm.homeId}
                    onChange={(event) =>
                      setCleanerIssueForm({
                        ...cleanerIssueForm,
                        homeId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select property</option>
                    {homes.map((home) => (
                      <option key={home.id} value={home.id}>
                        {home.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Issue title
                  <input
                    value={cleanerIssueForm.title}
                    onChange={(event) => setCleanerIssueForm({ ...cleanerIssueForm, title: event.target.value })}
                    placeholder="Example: Loose railing, leak under sink"
                  />
                </label>

                <label>
                  Category
                  <select
                    value={cleanerIssueForm.category}
                    onChange={(event) => setCleanerIssueForm({ ...cleanerIssueForm, category: event.target.value })}
                  >
                    <option value="General">General</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Appliance">Appliance</option>
                    <option value="Supplies">Supplies</option>
                  </select>
                </label>

                <label>
                  Urgency
                  <select
                    value={cleanerIssueForm.urgency}
                    onChange={(event) =>
                      setCleanerIssueForm({
                        ...cleanerIssueForm,
                        urgency: event.target.value as WorkOrderUrgency,
                      })
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="After Hours">After Hours</option>
                  </select>
                </label>

                <label>
                  Photo upload placeholder
                  <input type="file" accept="image/*" />
                </label>

                <label>
                  Notes
                  <textarea
                    value={cleanerIssueForm.notes}
                    onChange={(event) => setCleanerIssueForm({ ...cleanerIssueForm, notes: event.target.value })}
                    placeholder="What happened? Where is it? Does it impact the next guest?"
                  />
                </label>

                <button className="primaryButton" type="submit">
                  Send to Owner + Create Work Order
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      <nav className="cleanerMobileNav" aria-label="Cleaner mobile navigation">
        <button
          type="button"
          onClick={() =>
            document.querySelector(".cleanerTaskStack")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <span>✓</span>
          Tasks
        </button>

        <button type="button" onClick={() => setShowCleanerCalendar(true)}>
          <span>▦</span>
          Calendar
        </button>

        <button type="button" onClick={openIssueModal}>
          <span>⚠</span>
          Issues
        </button>

        <button type="button" onClick={() => window.alert("Cleaner messaging is the next build step.")}>
          <span>✉</span>
          Messages
        </button>

        <button
          type="button"
          onClick={() =>
            document.querySelector(".cleanerPortalTop")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <span>●</span>
          Profile
        </button>
      </nav>
    </>
  );
}