import { useState } from "react";
import PulseActionDrawer from "../components/pulse/PulseActionDrawer";
import MissionControlHeader from "../components/missioncontrol/MissionControlHeader";
import OperationsConsole from "../components/operations/OperationsConsole";

type Home = any;
type Reservation = any;
type WorkOrder = any;
type Cleaner = any;

type GuestReadyPageProps = {
  reservations: Reservation[];
  homes: Home[];
  updateReservation: (
    id: string,
    updates: Partial<Reservation>,
  ) => Promise<void>;
  cleaners: Cleaner[];
  workOrders: WorkOrder[];
  calendarSyncIssues: any[];
  selectedPropertyId: string;
  formatDate: (dateString: string) => string;
  needsCleanerAssignment: (reservation: Reservation) => boolean;
  renderScrollableCalendarStack: (options?: {
    homeFilter?: string;
    anchorDate?: Date;
    monthCount?: number;
    compact?: boolean;
  }) => React.ReactNode;
  setActivePage: (page: string) => void;
  setSelectedCalendarItem: (item: any) => void;
};

export default function GuestReadyPage({
  reservations,
  homes,
  cleaners,
  workOrders,
  calendarSyncIssues,
  selectedPropertyId,
  updateReservation,
  formatDate,
  renderScrollableCalendarStack,
  setActivePage,
  setSelectedCalendarItem,
}: GuestReadyPageProps) {
  const [activePulseAction, setActivePulseAction] = useState<
    | "calendar-protection"
    | "needs-cleaner"
    | "awaiting-acceptance"
    | "maintenance"
    | "arrival-readiness"
    | null
  >(null);
  const today = new Date().toISOString().slice(0, 10);
  const selectedHome = homes.find((home) => home.id === selectedPropertyId);

  const getPropertyId = (item: any) =>
    item.homeId ?? item.propertyId ?? item.property_id;

  const getDateValue = (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isBlockedStatus = (reservation?: Reservation) => {
    const statusText = String(reservation?.status ?? "").toLowerCase();
    const typeText = String(reservation?.type ?? "").toLowerCase();
    return statusText === "blocked" || typeText === "block";
  };

 

 const getNormalizedStatus = (reservation?: Reservation) => {
  if (!reservation) return "unassigned";

  const status = String(reservation.status ?? "").toLowerCase();

  if (status === "completed") {
    return "completed";
  }

  if (status === "in process") {
    return "in-progress";
  }

  if (status === "accepted") {
    return "accepted";
  }

  if (status === "assigned") {
    return "assigned";
  }

  if (status === "blocked" || status === "no clean needed") {
    return "blocked";
  }

  if (!reservation.cleanerId) {
    return "unassigned";
  }

  return "unassigned";
};

  const operationalReservations = reservations.filter((reservation) => {
    const checkoutDate = getDateValue(
      reservation.checkOut ?? reservation.departure,
    );

    return (
      getPropertyId(reservation) === selectedPropertyId &&
      !isBlockedStatus(reservation) &&
      Boolean(checkoutDate) &&
      checkoutDate! >= new Date()
    );
  });

  const upcomingReservations = reservations
    .filter((reservation) => {
      return (
        getPropertyId(reservation) === selectedPropertyId &&
        reservation.arrival >= today &&
        !isBlockedStatus(reservation)
      );
    })
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .slice(0, 3);

  const propertyWorkOrders = workOrders.filter((order) => {
    return (
      getPropertyId(order) === selectedPropertyId &&
      order.status !== "Completed" &&
      order.status !== "Archived"
    );
  });

  const urgentMaintenance = propertyWorkOrders.filter(
    (order) => order.urgency === "High" || order.urgency === "After Hours",
  );

  const ownerReviewMaintenance = propertyWorkOrders.filter(
    (order) => order.status === "Owner Review",
  );

  const todaysCleans = reservations.filter(
    (reservation) =>
      getPropertyId(reservation) === selectedPropertyId &&
      reservation.departure === today &&
      !isBlockedStatus(reservation),
  );

  const todaysCheckIns = reservations.filter(
    (reservation) =>
      getPropertyId(reservation) === selectedPropertyId &&
      reservation.arrival === today &&
      !isBlockedStatus(reservation),
  );

  function getGuestName(reservation?: Reservation) {
    if (!reservation) return "No guest scheduled";
    return (
      reservation.guestName ??
      reservation.guest_name ??
      reservation.title ??
      "Reserved"
    );
  }

  function getCleaner(reservation?: Reservation) {
    if (!reservation) return undefined;
    const cleanerId = reservation.cleanerId ?? reservation.cleaner_id;
    return cleaners.find((cleaner) => cleaner.id === cleanerId);
  }

  function getReservationChecks(reservation?: Reservation) {
    if (!reservation) {
      return [
        {
          label: "Next arrival found",
          passed: false,
          action: "Open Calendar",
          page: "Calendar",
        },
      ];
    }

    const status = getNormalizedStatus(reservation);
    const cleanerAssigned = status !== "unassigned";
    const cleanerAccepted =
      status === "accepted" ||
      status === "in-progress" ||
      status === "completed";
    const noOpenMaintenance = propertyWorkOrders.length === 0;

    const cleanerLifecycleLabel =
      status === "completed"
        ? "Cleaner Completed"
        : status === "in-progress"
          ? "Cleaning In Process"
          : status === "accepted"
            ? "Cleaner Accepted"
            : status === "assigned"
              ? "Cleaner Assigned"
              : "Needs Cleaner";

    const cleanerLifecycleAction =
      status === "completed"
        ? "View Details"
        : status === "accepted" || status === "in-progress"
          ? "View Cleaner Portal"
          : status === "assigned"
            ? "Send Reminder"
            : "Assign Cleaner";

    return [
      {
        label: "Calendar Protected",
        passed: true,
        action: "View Calendar",
        page: "Calendar",
      },
      {
        label: "Cleaner Assigned",
        passed: cleanerAssigned,
        action: "Assign Cleaner",
        page: "Reservations",
      },
      {
        label: cleanerLifecycleLabel,
        passed: cleanerAccepted,
        action: cleanerLifecycleAction,
        page: status === "completed" ? "Reservations" : "Cleaner Portal",
      },
      {
        label: "No Maintenance Issues",
        passed: noOpenMaintenance,
        action: "Open Maintenance",
        page: "Maintenance",
      },
    ];
  }

  function getReadinessScore(reservation?: Reservation) {
    const checks = getReservationChecks(reservation);
    const passed = checks.filter((check) => check.passed).length;
    return Math.round((passed / checks.length) * 100);
  }

  function getScoreClass(score: number) {
    if (score >= 90) return "ready";
    if (score >= 70) return "review";
    return "danger";
  }

  function getLifecycleClass(reservation?: Reservation) {
    const status = getNormalizedStatus(reservation);

    if (status === "completed") return "lifecycle-completed";
    if (status === "in-progress") return "lifecycle-in-progress";
    if (status === "accepted") return "lifecycle-accepted";
    if (status === "assigned") return "lifecycle-assigned";

    return "lifecycle-unassigned";
  }

  const missingCalendarProtection = calendarSyncIssues.filter((issue) => {
    const issueId = String(issue.id ?? "").toLowerCase();

    const reservation =
      issue.primaryReservation ?? issue.overlappingReservation;

    const issuePropertyId =
      reservation?.homeId ??
      reservation?.propertyId ??
      reservation?.property_id;

    return (
      issueId.startsWith("calendar-coverage") &&
      issuePropertyId === selectedPropertyId &&
      issue.status !== "Dismissed"
    );
  }).length;
  const cleanerAssignmentsNeeded = operationalReservations.filter(
    (reservation) => getNormalizedStatus(reservation) === "unassigned",
  ).length;

  const cleanerAcceptancesPending = operationalReservations.filter(
    (reservation) => getNormalizedStatus(reservation) === "assigned",
  ).length;

  const openMaintenance =
    urgentMaintenance.length + ownerReviewMaintenance.length;
  const guestReadyCount = upcomingReservations.filter(
    (reservation) => getNormalizedStatus(reservation) === "completed",
  ).length;
  const nextArrivalCount = upcomingReservations.length;

  const totalOperationsChecks = Math.max(nextArrivalCount * 4, 1);
  const completedOperationsChecks = upcomingReservations.reduce(
    (total, reservation) => {
      return (
        total +
        getReservationChecks(reservation).filter((check) => check.passed).length
      );
    },
    0,
  );
  const operationsScore = Math.round(
    (completedOperationsChecks / totalOperationsChecks) * 100,
  );

  return (
    <div className="guestReadyMockupPage">
      <MissionControlHeader
        propertyName={selectedHome?.name ?? "Active Property"}
        bannerImage={selectedHome?.heroImage ?? selectedHome?.imageUrl}
        weather="72°"
        notifications={2}
        arrivalsToday={todaysCheckIns.length}
        cleansToday={todaysCleans.length}
        onNotificationClick={() => setActivePage("Notification Center")}
      />

      <OperationsConsole
        operationsScore={operationsScore}
        missingCalendarProtection={missingCalendarProtection}
        cleanerAssignmentsNeeded={cleanerAssignmentsNeeded}
        cleanerAcceptancesPending={cleanerAcceptancesPending}
        openMaintenance={openMaintenance}
        guestReadyCount={guestReadyCount}
        nextArrivalCount={nextArrivalCount}
        onOpenCalendarHealth={() => setActivePulseAction("calendar-protection")}
        onAssignCleaners={() => setActivePulseAction("needs-cleaner")}
        onSendReminders={() => setActivePulseAction("awaiting-acceptance")}
        onOpenMaintenance={() => setActivePulseAction("maintenance")}
        onOpenGuestReady={() => setActivePulseAction("arrival-readiness")}
      />
      <section className="guestReadyMockupPanel">
        <div className="guestReadySectionHeader">
          <div>
            <h3>Upcoming Guests</h3>
            <p>Next 3 arrivals</p>
          </div>
        </div>

        <div className="guestReadyGuestCards">
          {upcomingReservations.map((reservation) => {
            const score = getReadinessScore(reservation);
            const checks = getReservationChecks(reservation);
            const cleaner = getCleaner(reservation);
            const lifecycleClass = getLifecycleClass(reservation);

            return (
              <button
                className={`guestReadyGuestCard ${getScoreClass(score)} ${lifecycleClass}`}
                key={reservation.id}
                type="button"
                onClick={() => {
                  setSelectedCalendarItem(reservation);
                  setActivePage("Reservation Detail");
                }}
              >
                <h4>{getGuestName(reservation)}</h4>
                <p>{formatDate(reservation.arrival)}</p>
                <small>{cleaner?.name ?? "Cleaner needed"}</small>

                <div className="guestReadyMiniChecks compact">
                  {checks.map((check) => {
                    const isCleanerLifecycleCheck =
                      check.label.includes("Cleaner Completed") ||
                      check.label.includes("Cleaning In Process") ||
                      check.label.includes("Cleaner Accepted") ||
                      check.label.includes("Cleaner Assigned") ||
                      check.label.includes("Needs Cleaner");

                    const icon = check.label.includes("Calendar")
                      ? "🛡️"
                      : check.label.includes("Cleaner Assigned")
                        ? "🧹"
                        : check.label.includes("Cleaner Completed")
                          ? "✅"
                          : check.label.includes("Cleaning In Process")
                            ? "🔵"
                            : check.label.includes("Cleaner Accepted")
                              ? "👍"
                              : check.label.includes("Needs Cleaner")
                                ? "⚠️"
                                : "🔧";

                    const shortLabel = check.label.includes("Calendar")
                      ? "Calendar"
                      : isCleanerLifecycleCheck
                        ? check.label.replace("Cleaner ", "")
                        : "Maintenance";

                    return (
                      <span
                        className={
                          check.passed
                            ? "miniCheckPill passed"
                            : "miniCheckPill failed"
                        }
                        key={check.label}
                      >
                        {icon} {shortLabel}
                      </span>
                    );
                  })}
                </div>

                <div className="guestReadyMiniMeter">
                  <div className="guestReadyMiniTrack">
                    <div
                      className={`guestReadyMiniFill ${lifecycleClass}`}
                      style={{ height: `${score}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="guestReadyMockupPanel guestReadyCalendarMockupPanel">
        <div className="guestReadySectionHeader">
          <div>
            <h3>Operations Calendar</h3>
            <p>Your property timeline at a glance</p>
          </div>

          <button
            className="secondaryButton"
            type="button"
            onClick={() => setActivePage("Calendar")}
          >
            Open Full Calendar
          </button>
        </div>

        {renderScrollableCalendarStack({
          homeFilter: selectedPropertyId,
          monthCount: 4,
          compact: false,
        })}
      </section>

      <style>{`
        .guestReadyGuestCard.lifecycle-unassigned {
          border-left-color: #dc2626 !important;
          box-shadow: inset 5px 0 0 #dc2626, 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .guestReadyGuestCard.lifecycle-assigned {
          border-left-color: #f97316 !important;
          box-shadow: inset 5px 0 0 #f97316, 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .guestReadyGuestCard.lifecycle-accepted {
          border-left-color: #f97316 !important;
          box-shadow: inset 5px 0 0 #f97316, 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .guestReadyGuestCard.lifecycle-in-progress {
          border-left-color: #2563eb !important;
          box-shadow: inset 5px 0 0 #2563eb, 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .guestReadyGuestCard.lifecycle-completed {
          border-left-color: #16a34a !important;
          box-shadow: inset 5px 0 0 #16a34a, 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .guestReadyMiniFill.lifecycle-unassigned {
          background: linear-gradient(180deg, #16a34a, #facc15, #f97316, #dc2626) !important;
        }

        .guestReadyMiniFill.lifecycle-assigned {
          background: linear-gradient(180deg, #f97316, #fb923c) !important;
        }

        .guestReadyMiniFill.lifecycle-accepted {
          background: linear-gradient(180deg, #f97316, #fb923c) !important;
        }

        .guestReadyMiniFill.lifecycle-in-progress {
          background: linear-gradient(180deg, #2563eb, #60a5fa) !important;
        }

        .guestReadyMiniFill.lifecycle-completed {
          background: linear-gradient(180deg, #16a34a, #4ade80) !important;
        }
      `}</style>
      <PulseActionDrawer
        open={Boolean(activePulseAction)}
        actionType={activePulseAction}
        reservations={reservations}
        calendarSyncIssues={calendarSyncIssues}
        workOrders={workOrders}
        homes={homes}
        cleaners={cleaners}
        selectedPropertyId={selectedPropertyId}
        formatDate={formatDate}
        onClose={() => setActivePulseAction(null)}
        onOpenReservation={(reservation: Reservation) => {
          setSelectedCalendarItem(reservation);
          setActivePage("Reservation Detail");
        }}
        onOpenMaintenance={() => {
          setActivePage("Maintenance");
        }}
        onAssignCleaner={async (reservationId: string, cleanerId: string) => {
          await updateReservation(reservationId, {
            cleanerId,
            status: "Assigned",
          });
        }}
        onSendReminder={(reservationId: string) => {
          console.log("Send reminder from Pulse:", reservationId);
        }}
      />
    </div>
  );
}
