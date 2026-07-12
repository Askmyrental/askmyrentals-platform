import { useEffect, useState } from "react";
import WeatherForecastCard from "../components/WeatherForecastCard";

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
  protectedOn?: string[];
  isUnifiedPlatformStay?: boolean;
  isUnifiedOwnerBlock?: boolean;
  protectionRecords?: any[];
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

function cleanReservationTitle(value: string | undefined) {
  return (
    (value || "Reservation")
      .replace(/^Reserved\s*-\s*/i, "")
      .replace(/^Reservation\s*-\s*/i, "")
      .trim() || "Reservation"
  );
}

function toDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`);
}

function getNightCount(arrival: string, departure: string) {
  if (!arrival || !departure) return 0;
  const nights = Math.round(
    (toDate(departure).getTime() - toDate(arrival).getTime()) / 86400000,
  );
  return Math.max(0, nights);
}

function reservationNeedsCleaner(reservation: Reservation) {
  return (
    reservation.source === "VRBO" ||
    reservation.source === "Airbnb" ||
    reservation.source === "Guest Reservation" ||
    reservation.source === "Cleaning" ||
    reservation.source === "Owner Block"
  );
}
function isProtectedBlock(reservation: Reservation) {
  return (
    reservation.isUnifiedPlatformStay === true ||
    reservation.isUnifiedOwnerBlock === true ||
    (Array.isArray(reservation.protectedOn) &&
      reservation.protectedOn.length > 0)
  );
}

function isUnmatchedPlatformBlock(reservation: Reservation) {
  return reservation.status === "Blocked" && !isProtectedBlock(reservation);
}

function getMissingPlatform(reservation: Reservation) {
  if (reservation.source === "Airbnb") return "VRBO";
  if (reservation.source === "VRBO") return "Airbnb";
  return "the other platform";
}
function getReadinessScore(reservation: Reservation, cleaner?: Cleaner) {
  if (isUnmatchedPlatformBlock(reservation)) return 42;

  if (
    isProtectedBlock(reservation) ||
    reservation.status === "No Clean Needed"
  ) {
    return 100;
  }

  if (reservationNeedsCleaner(reservation) && !cleaner) {
    if (reservation.status === "Completed") return 74;
    if (reservation.status === "In Process") return 62;
    return 34;
  }

}

function getReadinessLabel(
  score: number,
  status: ReservationStatus,
  reservation?: Reservation,
) {
  if (reservation && isUnmatchedPlatformBlock(reservation))
    return "Protection Required";
  if (reservation && isProtectedBlock(reservation)) return "Protected Block";
  if (status === "Blocked") return "Protection Required";
  if (score >= 90) return "Guest Ready";
  if (score >= 60) return "On Track";
  return "Needs Attention";
}


function getLifecycleTone(reservation: Reservation, cleaner?: Cleaner) {
  if (
    reservation.status === "Completed" ||
    reservation.status === "No Clean Needed"
  ) {
    return "ready";
  }

  if (reservation.status === "In Process") {
    return "progress";
  }

  if (reservation.status === "Accepted") {
    return "watch";
  }

  if (cleaner || reservation.status === "Assigned") {
    return "watch";
  }

  return "attention";
}

function getReadinessScoreClassFromTone(tone: string) {
  if (tone === "ready") return "scoreGood";
  if (tone === "progress") return "scoreActive";
  if (tone === "watch") return "scoreWatch";
  return "scoreBad";
}

function getStatusBanner(reservation: Reservation, cleaner?: Cleaner) {
  if (
    reservation.status === "Completed" ||
    reservation.status === "No Clean Needed"
  ) {
    return {
      className: "ready",
      icon: "✅",
      title: "Guest Ready",
      message: "Core reservation operations are complete.",
    };
  }

  if (reservation.status === "In Process") {
    return {
      className: "progress",
      icon: "🔵",
      title: "In Progress",
      message: "The reservation is actively being worked by operations.",
    };
  }

  if (reservation.status === "Accepted" && cleaner) {
    return {
      className: "watch",
      icon: "🟠",
      title: "Cleaner Accepted",
      message: `${cleaner.name} has accepted this reservation.`,
    };
  }

  if (reservation.status === "Assigned" && cleaner) {
    return {
      className: "watch",
      icon: "🟠",
      title: "Cleaner Assigned",
      message: `${cleaner.name} is assigned and awaiting acceptance.`,
    };
  }

  if (isUnmatchedPlatformBlock(reservation)) {
    return {
      className: "attention",
      icon: "⚠️",
      title: "Calendar Protection Missing",
      message: `This ${reservation.source} block is not mirrored on ${getMissingPlatform(reservation)}. Block the same dates on ${getMissingPlatform(reservation)} to prevent an accidental booking.`,
    };
  }

  if (isProtectedBlock(reservation)) {
    return {
      className: "neutral",
      icon: "🛡️",
      title: "Calendar Protected",
      message:
        "This block is mirrored across connected calendars and is helping prevent double-booking.",
    };
  }

  return {
    className: "attention",
    icon: "⚠️",
    title: "Action Needed",
    message:
      "No cleaner is assigned yet. Assign a cleaner to keep this stay on track.",
  };
}

function getNextAction(reservation: Reservation, cleaner?: Cleaner) {
  if (isUnmatchedPlatformBlock(reservation)) {
    return {
      tone: "attention",
      title: `Create matching ${getMissingPlatform(reservation)} block`,
      message: `This ${reservation.source} block only exists on one calendar. Add the same block on ${getMissingPlatform(reservation)} so the property cannot be accidentally booked.`,
    };
  }

  if (isProtectedBlock(reservation)) {
    return {
      tone: "neutral",
      title: "Calendar is protected",
      message:
        "This block is mirrored across connected calendars. No cleaner action is required unless you attach an operational task.",
    };
  }
  if (reservationNeedsCleaner(reservation) && !cleaner) {
    return {
      tone: "attention",
      title: "Assign a cleaner",
      message:
        "No cleaner is assigned yet. Choose a cleaner below so this stay has a clear owner before arrival.",
    };
  }

  if (reservation.status === "Unassigned") {
    return {
      tone: "attention",
      title: "Set reservation status",
      message:
        "This stay is still marked unassigned. Update the status below once operations are moving.",
    };
  }

  if (reservation.status === "Assigned") {
    return {
      tone: "watch",
      title: "Waiting on cleaner acceptance",
      message: `${cleaner?.name ?? "The cleaner"} is assigned. Confirm they have accepted the clean before arrival.`,
    };
  }

  if (reservation.status === "Accepted") {
    return {
      tone: "watch",
      title: "Cleaner accepted",
      message: `${cleaner?.name ?? "The cleaner"} has confirmed this clean. Move to In Process when the turn begins.`,
    };
  }

  if (reservation.status === "In Process") {
    return {
      tone: "progress",
      title: "Turn is in process",
      message:
        "Operations are actively moving. Mark complete once the property is guest ready.",
    };
  }
if (reservation.status === "Completed") {
  return {
    tone: "ready",
    title: "Cleaner completed",
    message:
      "The cleaning is complete and the property is marked guest ready.",
  };
}
  return {
    tone: "ready",
    title: "No urgent action",
    message:
      "Core reservation operations are complete. Review notes or weather if anything changes.",
  };
}

function getCleanerInitials(cleaner?: Cleaner) {
  if (!cleaner?.name) return "—";
  return cleaner.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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
        <p>
          Select a reservation from the Dashboard, Calendar, or Reservations
          page.
        </p>
        <button
          className="primaryButton"
          type="button"
          onClick={() => setActivePage("Dashboard")}
        >
          Back to Dashboard
        </button>
      </section>
    );
  }

  const home = homes.find((item) => item.id === reservation.homeId);
  const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
  const hasAssignedCleaner = Boolean(
    reservation.cleanerId && String(reservation.cleanerId).trim(),
  );
  const imported = isImportedReservation(reservation);
  const isTask = isTaskSource(reservation.source);
  const isOwnerBlock = reservation.source === "Owner Block";
  const canAssignCleaner =
    reservation.source === "VRBO" ||
    reservation.source === "Airbnb" ||
    reservation.source === "Guest Reservation" ||
    reservation.source === "Cleaning" ||
    reservation.source === "Owner Block";

  const displayName = cleanReservationTitle(reservation.guestName);
  const nights = getNightCount(reservation.arrival, reservation.departure);
 const readinessScore = getReadinessScore(reservation, cleaner) ?? 0;
  const readinessLabel = getReadinessLabel(
    readinessScore,
    reservation.status,
    reservation,
  );
  const lifecycleTone = getLifecycleTone(reservation, cleaner);
  const readinessClass = lifecycleTone;
  const readinessScoreClass = getReadinessScoreClassFromTone(lifecycleTone);
  const statusBanner = getStatusBanner(reservation, cleaner);
  const nextAction = getNextAction(reservation, cleaner);

  const sourceBadgeClass = `platformBadge platform${reservation.source.replace(/\s/g, "")}`;

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

    const nextNotes = [`${label}: ${value}`, ...lines]
      .filter(Boolean)
      .join("\n");
    setNotesDraft(nextNotes);
    updateReservation(reservation.id, { notes: nextNotes });
  };

  return (
    <>
      <style>{`
        .reservationDashboardShell {
          display: grid;
          gap: 18px;
        }

        .reservationHeroCard,
        .reservationWorkspaceCard,
        .reservationStatusBanner,
        .reservationReadinessHero {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 16px 42px rgba(15, 23, 42, 0.06);
          border-radius: 28px;
        }

        .reservationHeroCard {
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 18px;
          align-items: start;
        }

        .reservationHeroKicker {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .reservationHeroTitle {
          margin: 0;
          font-size: clamp(34px, 5vw, 54px);
          line-height: 0.95;
          letter-spacing: -0.06em;
          color: #0f172a;
        }

        .reservationHeroMeta {
          margin: 12px 0 0;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          color: #475569;
          font-weight: 900;
        }

        .reservationHeroMeta span {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          padding: 8px 11px;
        }

        .reservationHeroActions {
          display: flex;
          gap: 10px;
        }

        .reservationStatusBanner {
          padding: 18px 20px;
          display: grid;
          grid-template-columns: 46px 1fr;
          gap: 14px;
          align-items: center;
          border-left: 7px solid #94a3b8;
        }

        .reservationStatusBanner.ready { border-left-color: #16a34a; background: linear-gradient(135deg, #ffffff, #f0fdf4); }
        .reservationStatusBanner.watch { border-left-color: #f97316; background: linear-gradient(135deg, #ffffff, #fff7ed); }
        .reservationStatusBanner.attention { border-left-color: #dc2626; background: linear-gradient(135deg, #ffffff, #fef2f2); }
        .reservationStatusBanner.progress { border-left-color: #2563eb; background: linear-gradient(135deg, #ffffff, #eff6ff); }
        .reservationStatusBanner.neutral { border-left-color: #64748b; background: linear-gradient(135deg, #ffffff, #f8fafc); }

        .statusBannerIcon {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.74);
          display: grid;
          place-items: center;
          font-size: 24px;
        }

        .reservationStatusBanner h3 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.03em;
          color: #0f172a;
        }

        .reservationStatusBanner p {
          margin: 4px 0 0;
          color: #475569;
          font-weight: 750;
          line-height: 1.4;
        }

        .reservationReadinessHero {
          padding: 22px;
          display: grid;
          grid-template-columns: minmax(180px, 260px) 1fr;
          gap: 20px;
          align-items: center;
        }

        .reservationReadinessScoreBox {
          min-height: 170px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          text-align: center;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .reservationReadinessScoreBox.ready { background: #dcfce7; color: #166534; }
        .reservationReadinessScoreBox.watch { background: #ffedd5; color: #c2410c; }
        .reservationReadinessScoreBox.progress { background: #dbeafe; color: #1d4ed8; }
        .reservationReadinessScoreBox.attention { background: #fee2e2; color: #991b1b; }

        .reservationReadinessScoreBox strong {
          display: block;
          font-size: 58px;
          line-height: 0.9;
          letter-spacing: -0.08em;
        }

        .reservationReadinessScoreBox span {
          display: block;
          margin-top: 10px;
          font-size: 13px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .reservationReadinessContent h3 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -0.04em;
        }

        .reservationReadinessContent p {
          color: #475569;
          line-height: 1.55;
          font-weight: 700;
        }

        .reservationDashboardRows {
          display: grid;
          gap: 18px;
        }

        .reservationDashboardRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 1fr);
          gap: 18px;
          align-items: stretch;
        }

        .reservationDashboardRow > .reservationWorkspaceCard,
        .reservationDashboardRow > .reservationCardSlot,
        .reservationDashboardRow > .reservationCardSlot > * {
          min-width: 0;
        }

        .reservationDashboardRow > .reservationWorkspaceCard,
        .reservationDashboardRow > .reservationCardSlot > article,
        .reservationDashboardRow > .reservationCardSlot > section,
        .reservationDashboardRow > .reservationCardSlot > div {
          height: 100%;
          box-sizing: border-box;
        }

        .reservationFullWidthCard {
          min-width: 0;
          width: 100%;
        }

        .reservationWorkspaceCard {
          padding: 20px;
        }

        .reservationWorkspaceCard h3 {
          margin: 0 0 14px;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .operationsCardHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .operationsCardHeader h3 {
          margin: 0;
        }

        .operationsMiniPill {
          border-radius: 999px;
          padding: 7px 10px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .detailStack.operationsDetailStack {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .statusUnassigned { background: #fee2e2; color: #991b1b; }
        .statusAssigned { background: #ffedd5; color: #c2410c; }
        .statusAccepted, .statusInProcess { background: #dbeafe; color: #1d4ed8; }
        .statusCompleted, .statusNoCleanNeeded { background: #dcfce7; color: #166534; }

        .cleanerStatusHero {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: #f8fafc;
          margin-bottom: 14px;
        }

        .cleanerStatusHero strong,
        .cleanerStatusHero span {
          display: block;
        }

        .cleanerStatusHero span {
          margin-top: 3px;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .cleanerInitialBadge {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #e0f2fe;
          color: #075985;
          font-weight: 950;
          flex: 0 0 auto;
        }

        .readinessScore {
          width: 66px;
          height: 66px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          font-size: 22px;
          font-weight: 950;
          background: #eff6ff;
          color: #2563eb;
        }

        .scoreGood { background: #dcfce7; color: #166534; }
        .scoreWatch { background: #ffedd5; color: #c2410c; }
        .scoreActive { background: #dbeafe; color: #1d4ed8; }
        .scoreBad { background: #fee2e2; color: #991b1b; }

        .readinessChecklist {
          display: grid;
          gap: 10px;
        }

        .readyCheck small {
          display: block;
          color: #64748b;
          margin-top: 3px;
          font-weight: 700;
        }

        .stayForecastGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(86px, 1fr));
          gap: 10px;
          margin: 16px 0;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .forecastDayCard {
          min-width: 86px;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #f8fafc;
          padding: 12px 10px;
          text-align: center;
          display: grid;
          gap: 4px;
        }

        .forecastDayCard span,
        .forecastDayCard small,
        .forecastDayCard em {
          color: #64748b;
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
        }

        .forecastDayCard strong {
          font-size: 24px;
        }

        .forecastDayCard b {
          color: #0f172a;
          font-size: 20px;
        }

        .operationsInsightBox,
        .aiSummaryBox {
          padding: 14px;
          border-radius: 18px;
          background: #eff6ff;
          color: #1e3a8a;
          border: 1px solid #bfdbfe;
        }

        .operationsInsightBox p,
        .aiSummaryBox p {
          margin: 6px 0 0;
          line-height: 1.45;
        }

        .aiSignalGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        .aiSignalGrid div {
          background: #f8fafc;
          border-radius: 16px;
          padding: 12px;
        }

        .aiSignalGrid span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .aiSignalGrid strong {
          display: block;
          margin-top: 4px;
        }

        .futureChecklistNote {
          margin: 12px 0 0;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.45;
        }


        .actionCenterCard {
          display: grid;
          gap: 16px;
        }

        .nextActionBox {
          border-radius: 20px;
          padding: 16px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1e3a8a;
        }

        .nextActionBox.attention {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .nextActionBox.watch {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .nextActionBox.progress {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .nextActionBox.ready {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .nextActionBox.neutral {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #334155;
        }

        .nextActionBox strong {
          display: block;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .nextActionBox p {
          margin: 6px 0 0;
          line-height: 1.45;
          font-weight: 750;
        }

        .actionControlGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .statusLockedBox {
          border: 1px dashed #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 16px;
          padding: 12px 13px;
          display: grid;
          gap: 4px;
        }

        .statusLockedBox span {
          font-size: 13px;
          font-weight: 800;
          color: #991b1b;
        }

        .statusLockedBox strong {
          font-size: 15px;
          color: #7f1d1d;
        }

        .statusLockedBox small {
          color: #991b1b;
          font-weight: 750;
        }

        .assignmentSnapshot {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .assignmentSnapshot h4 {
          margin: 0;
          font-size: 16px;
        }

        .assignmentSnapshot p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .readinessActionGrid {
          display: grid;
          gap: 10px;
        }

        .readinessActionItem {
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 10px;
          align-items: start;
          padding: 12px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .readinessActionIcon {
          width: 30px;
          height: 30px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-weight: 950;
          background: #e2e8f0;
          color: #334155;
        }

        .readinessActionIcon.good { background: #dcfce7; color: #166534; }
        .readinessActionIcon.warn { background: #fef3c7; color: #92400e; }
        .readinessActionIcon.bad { background: #fee2e2; color: #991b1b; }

        .readinessActionItem strong {
          display: block;
          color: #0f172a;
        }

        .readinessActionItem small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-weight: 750;
        }

        @media (max-width: 1100px) {
          .reservationDashboardRow,
          .reservationReadinessHero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .reservationHeroCard {
            grid-template-columns: 1fr;
            padding: 18px;
            border-radius: 24px;
          }

          .reservationHeroTitle {
            font-size: 38px;
          }

          .reservationHeroActions {
            width: 100%;
          }

          .reservationHeroActions button {
            width: 100%;
          }

          .reservationStatusBanner {
            grid-template-columns: 38px 1fr;
            padding: 14px;
            border-radius: 22px;
          }

          .statusBannerIcon {
            width: 38px;
            height: 38px;
            border-radius: 14px;
            font-size: 20px;
          }

          .reservationReadinessHero {
            padding: 16px;
            border-radius: 24px;
          }

          .reservationReadinessScoreBox {
            min-height: 132px;
          }

          .reservationReadinessScoreBox strong {
            font-size: 48px;
          }

          .reservationDashboardShell {
            gap: 14px;
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
          }

          .reservationDashboardRow {
            grid-template-columns: 1fr;
            gap: 14px;
            width: 100%;
          }

          .reservationWorkspaceCard {
            padding: 16px;
            border-radius: 22px;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
          }

          .detailStack.operationsDetailStack,
          .aiSignalGrid,
          .actionControlGrid {
            grid-template-columns: 1fr;
          }

          .stayForecastGrid {
            grid-template-columns: repeat(7, 86px);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .reservationHeroMeta span {
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>

      <section className="reservationDashboardShell">
        <article className="reservationHeroCard">
          <div>
            <div className="reservationHeroKicker">
              <span className={sourceBadgeClass}>
                {reservation.source.toUpperCase()}
              </span>
              <span className="operationsMiniPill">
                🏡 {home?.name ?? "Unknown property"}
              </span>
              <span
                className={`operationsMiniPill status${reservation.status.replace(/\s/g, "")}`}
              >
                {reservation.status}
              </span>
            </div>

            <h1 className="reservationHeroTitle">
              {isOwnerBlock ? "Owner Block" : displayName}
            </h1>

            <div className="reservationHeroMeta">
              <span>
                📅 {formatDate(reservation.arrival)} →{" "}
                {formatDate(reservation.departure)}
              </span>
              {!isTask && (
                <span>
                  {nights} {nights === 1 ? "Night" : "Nights"}
                </span>
              )}
            </div>
          </div>

          <div className="reservationHeroActions">
            <button className="ghostButton" type="button" onClick={closeDetail}>
              ← Back
            </button>
          </div>
        </article>

        <article
          className={`reservationStatusBanner ${statusBanner.className}`}
        >
          <div className="statusBannerIcon">{statusBanner.icon}</div>
          <div>
            <h3>{statusBanner.title}</h3>
            <p>{statusBanner.message}</p>
          </div>
        </article>

        <article className="reservationReadinessHero">
          <div className={`reservationReadinessScoreBox ${readinessClass}`}>
            <div>
              <strong>{readinessScore}%</strong>
              <span>{readinessLabel}</span>
            </div>
          </div>

          <div className="reservationReadinessContent">
            <p className="eyebrow">Property Readiness</p>
            <h3>{readinessLabel}</h3>
            <p>
              This score summarizes the operational readiness of this stay using
              cleaner assignment, current status, and completion progress. Later
              this will include inspections, invoices, smart lock checks,
              maintenance, and owner-required cleaner tasks.
            </p>
          </div>
        </article>

        <section className="reservationDashboardRows">
          <div className="reservationDashboardRow">
            <div className="reservationCardSlot">
              {!isTask && reservation.status !== "Blocked" ? (
                <WeatherForecastCard
                  reservation={reservation}
                  formatDate={formatDate}
                />
              ) : (
                <article className="reservationWorkspaceCard">
                  <p className="eyebrow">Schedule</p>
                  <h3>
                    {isOwnerBlock
                      ? "Protected Calendar Time"
                      : `${reservation.source} Window`}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontWeight: 750,
                      lineHeight: 1.5,
                    }}
                  >
                    {formatDate(reservation.arrival)} →{" "}
                    {formatDate(reservation.departure)}
                  </p>
                </article>
              )}
            </div>

            <article className="reservationWorkspaceCard actionCenterCard">
              <div className="operationsCardHeader">
                <div>
                  <p className="eyebrow">Action Center</p>
                  <h3>Next Step</h3>
                </div>
                <span
                  className={`operationsMiniPill status${reservation.status.replace(/\s/g, "")}`}
                >
                  {reservation.status}
                </span>
              </div>

              <div className={`nextActionBox ${nextAction.tone}`}>
                <strong>{nextAction.title}</strong>
                <p>{nextAction.message}</p>
              </div>

              <div className="assignmentSnapshot">
                <div className="cleanerInitialBadge">
                  {getCleanerInitials(cleaner)}
                </div>
                <div>
                  <h4>{cleaner?.name ?? "No cleaner assigned"}</h4>
                  <p>
                    {cleaner
                      ? `Cleaner status: ${cleaner.status || "Active"}`
                      : "Choose a cleaner below"}
                  </p>
                </div>
              </div>

              <div className="actionControlGrid">
                <label>
                  Assigned Cleaner
                  <select
                    value={reservation.cleanerId || ""}
                    disabled={!canAssignCleaner}
                    onChange={(event) => {
                      const nextCleanerId = event.target.value || undefined;
                      const workflowStatuses: ReservationStatus[] = [
                        "Accepted",
                        "In Process",
                        "Completed",
                        "No Clean Needed",
                      ];
                      updateReservation(reservation.id, {
                        cleanerId: nextCleanerId,
                        status: nextCleanerId
                          ? workflowStatuses.includes(reservation.status)
                            ? reservation.status
                            : "Assigned"
                          : reservation.status === "No Clean Needed"
                            ? "No Clean Needed"
                            : "Unassigned",
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {cleaners.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                {hasAssignedCleaner ? (
                  <label>
                    Reservation Status
                    <select
                      value={
                        ["Accepted", "In Process", "Completed", "No Clean Needed"].includes(
                          reservation.status,
                        )
                          ? reservation.status
                          : ""
                      }
                      onChange={(event) =>
                        updateReservation(reservation.id, {
                          status: event.target.value as ReservationStatus,
                        })
                      }
                    >
                      <option value="" disabled>
                        Waiting for cleaner response
                      </option>
                      <option value="Accepted">Accepted</option>
                      <option value="In Process">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="No Clean Needed">No Clean Needed</option>
                    </select>
                  </label>
                ) : (
                  <div className="statusLockedBox">
                    <span>Reservation Status</span>
                    <strong>
                      {reservation.status === "No Clean Needed"
                        ? "No Clean Needed"
                        : "No cleaner assigned"}
                    </strong>
                    <small>
                      {reservation.status === "No Clean Needed"
                        ? "This reservation is already resolved."
                        : "Assign a cleaner before setting a status."}
                    </small>
                  </div>
                )}
              </div>
            </article>
          </div>

          <div className="reservationDashboardRow">
            <article className="reservationWorkspaceCard">
              <div className="operationsCardHeader">
                <div>
                  <p className="eyebrow">Property Readiness</p>
                  <h3>{readinessLabel}</h3>
                </div>
                <div
                  className={`readinessScore ${readinessScoreClass}`}
                >
                  {readinessScore}%
                </div>
              </div>

              <div className="readinessActionGrid">
                <div className="readinessActionItem">
                  <span
                    className={`readinessActionIcon ${cleaner ? "good" : "bad"}`}
                  >
                    {cleaner ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>Cleaner Assigned</strong>
                    <small>
                      {cleaner ? cleaner.name : "No cleaner assigned"}
                    </small>
                  </div>
                </div>

                <div className="readinessActionItem">
                  <span
                    className={`readinessActionIcon ${reservation.status === "Completed" || reservation.status === "No Clean Needed" ? "good" : cleaner ? "warn" : "bad"}`}
                  >
                    {reservation.status === "Completed" ||
                    reservation.status === "No Clean Needed"
                      ? "✓"
                      : cleaner
                        ? "…"
                        : "!"}
                  </span>
                  <div>
                    <strong>Cleaning Status</strong>
                    <small>{reservation.status}</small>
                  </div>
                </div>

                <div className="readinessActionItem">
                  <span
                    className={`readinessActionIcon ${notesDraft.trim() ? "good" : "warn"}`}
                  >
                    {notesDraft.trim() ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>Operations Notes</strong>
                    <small>
                      {notesDraft.trim() ? "Notes added" : "No notes yet"}
                    </small>
                  </div>
                </div>

                <div className="readinessActionItem">
                  <span className="readinessActionIcon good">✓</span>
                  <div>
                    <strong>Calendar Health</strong>
                    <small>No linked issue shown</small>
                  </div>
                </div>
              </div>
            </article>

            <article className="reservationWorkspaceCard">
              <p className="eyebrow">Notes</p>
              <h3>{isTask ? "Task Notes" : "Operations Notes"}</h3>

              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Add cleaner instructions, gate codes, vendor notes, maintenance reminders, supplies, or anything the operations team should know."
              />

              <p className="futureChecklistNote">
                Future beta setting: owners will be able to require cleaner
                checklists, supply confirmations, and before/after photos per
                property. For now, notes stay simple and optional.
              </p>

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
          </div>

          {(reservation.source === "Cleaning" ||
            reservation.source === "Maintenance" ||
            reservation.source === "Vendor Visit" ||
            reservation.source === "Inspection") && (
            <div className="reservationDashboardRow">
              {reservation.source === "Cleaning" && (
                <article className="reservationWorkspaceCard reservationFullWidthCard">
                  <p className="eyebrow">Cleaning</p>
                  <h3>Cleaning Details</h3>
                  <label>
                    Cleaning Type
                    <select
                      defaultValue=""
                      onChange={(event) =>
                        updateNotesWithLabel(
                          "Cleaning Type",
                          event.target.value,
                        )
                      }
                    >
                      <option value="" disabled>
                        Select cleaning type
                      </option>
                      <option value="Standard Cleaning">
                        Standard Cleaning
                      </option>
                      <option value="Mid-Stay Cleaning">
                        Mid-Stay Cleaning
                      </option>
                      <option value="Deep Clean">Deep Clean</option>
                      <option value="Touch-Up Clean">Touch-Up Clean</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </article>
              )}

              {reservation.source === "Maintenance" && (
                <article className="reservationWorkspaceCard reservationFullWidthCard">
                  <p className="eyebrow">Maintenance</p>
                  <h3>Maintenance Details</h3>
                  <label>
                    Priority
                    <select
                      defaultValue=""
                      onChange={(event) =>
                        updateNotesWithLabel(
                          "Maintenance Priority",
                          event.target.value,
                        )
                      }
                    >
                      <option value="" disabled>
                        Select priority
                      </option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </label>
                  <label>
                    Issue Category
                    <select
                      defaultValue=""
                      onChange={(event) =>
                        updateNotesWithLabel(
                          "Maintenance Category",
                          event.target.value,
                        )
                      }
                    >
                      <option value="" disabled>
                        Select category
                      </option>
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
                <article className="reservationWorkspaceCard reservationFullWidthCard">
                  <p className="eyebrow">Vendor</p>
                  <h3>Vendor Visit Details</h3>
                  <label>
                    Vendor Type
                    <select
                      defaultValue=""
                      onChange={(event) =>
                        updateNotesWithLabel("Vendor Type", event.target.value)
                      }
                    >
                      <option value="" disabled>
                        Select vendor type
                      </option>
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
                        if (event.target.value.trim())
                          updateNotesWithLabel(
                            "Vendor",
                            event.target.value.trim(),
                          );
                      }}
                    />
                  </label>
                </article>
              )}

              {reservation.source === "Inspection" && (
                <article className="reservationWorkspaceCard reservationFullWidthCard">
                  <p className="eyebrow">Inspection</p>
                  <h3>Inspection Details</h3>
                  <label>
                    Inspection Type
                    <select
                      defaultValue=""
                      onChange={(event) =>
                        updateNotesWithLabel(
                          "Inspection Type",
                          event.target.value,
                        )
                      }
                    >
                      <option value="" disabled>
                        Select inspection type
                      </option>
                      <option value="Arrival Inspection">
                        Arrival Inspection
                      </option>
                      <option value="Departure Inspection">
                        Departure Inspection
                      </option>
                      <option value="Seasonal Inspection">
                        Seasonal Inspection
                      </option>
                      <option value="Damage Inspection">
                        Damage Inspection
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </article>
              )}
            </div>
          )}
        </section>
      </section>
    </>
  );
}
