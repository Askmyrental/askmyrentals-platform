import CleanerProfilePage from "./pages/CleanerProfilePage";
import SharedWorkspacesPage from "./pages/SharedWorkspacesPage";
import CleanerJobsPage from "./pages/CleanerJobsPage";
import CleanerClientsPage from "./pages/CleanerClientsPage";
import CleanerPropertiesPage from "./pages/CleanerPropertiesPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportsPage from "./pages/ReportsPage";
import type {
  CleanerClientOption,
  CleanerPropertyFormValues,
} from "./pages/CleanerCreatePropertyPage";
import { OperationTimelineCalendar } from "./components/OperationsTimelineCalendar";
import GuestReadyPage from "./pages/GuestReadyPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import HousekeepingPage from "./pages/HousekeepingPage";
import { parseICalTextToReservations } from "./utils/calendarSync";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getMonthDays, getStackedCalendarMonths } from "./utils/calendarUtils";
import { CalendarPage } from "./pages/CalendarPage";
import ReservationsPage from "./pages/ReservationsPage";

import CleanerPortalPage from "./pages/CleanerPortalPage";
import CleanersPage from "./pages/CleanersPage";
import PropertiesPage from "./pages/PropertiesPage";
import MaintenancePage from "./pages/MaintenancePage";
import NotificationCenterPage from "./pages/NotificationCenterPage";
import OccupancyPage from "./pages/OccupancyPage";
import RecordsPage from "./pages/RecordsPage";
import DashboardPage from "./pages/DashboardPage";
import PropertyOperationsHub from "./components/PropertyOperationsHub";
import { supabase } from "./utils/supabase";

const API_URL = String(import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:4000" : "");
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
type ReservationType =
  "Reservation" | "Mirror Block" | "Owner Block" | "Operational Task";
type BlockType = "Owner Block" | "Maintenance";

type Home = {
  id: string;
  clientId?: string;
  name: string;
  city: string;
  shortName: string;
  address?: string;
  vrboId?: string;
  airbnbUrl?: string;
  iCalUrl?: string;
  setupMode: "Guest Reservation" | "VRBO" | "Airbnb";
  defaultCleanerId?: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  kitchens?: number;
  floors?: number;
  kingBeds?: number;
  queenBeds?: number;
  doubleBeds?: number;
  twinBeds?: number;
  bunkBeds?: number;
  pyramidBunks?: number;
  murphyBeds?: number;
  sofaSleepers?: number;
  status: "Active" | "Setup Needed" | "Paused";
  notes?: string;
  imageUrl?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  cleaningFee?: number;
  calendarFeedUrl?: string;
  calendarSource?: string;
  parkingInstructions?: string;
  supplyLocations?: string;
  operations?: {
    access?: string;
    wifiName?: string;
    wifiPassword?: string;
    trashInstructions?: string;
    cleanerNotes?: string;
  };
};

type Cleaner = {
  id: string;
  name: string;
  phone: string;
  status: "Available" | "Busy" | "Offline";
  serviceArea: string;
  rating: number;
  activeJobs: number;
  specialties: string[];
  notes?: string;
};

type AssignableTeamMember = Cleaner & {
  email?: string;
  role: string;
  groupMemberId: string;
  userId: string;
};

type NotificationPriority = "Critical" | "High" | "Normal" | "Low";
type NotificationType =
  "Reservation" | "Cleaner" | "Maintenance" | "Property" | "System";

type OwnerNotification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  relatedHomeId?: string;
  relatedCleanerId?: string;
  createdAt: string;
  read: boolean;
};

type Reservation = {
  id: string;
  guestName: string;
  homeId: string;
  source: ReservationSource;
  type: ReservationType;
  arrival: string;
  departure: string;
  status: ReservationStatus;
  cleanerId?: string;
  assignedUserId?: string;
  assignedContactId?: string;

  propertyName?: string;
  propertyAddress?: string;

  notes?: string;
  timeline: string[];
};

type CalendarBlock = {
  id: string;
  homeId: string;
  type: BlockType;
  title: string;
  start: string;
  end: string;
  notes?: string;
};

type WorkOrderStatus =
  | "New"
  | "Assigned"
  | "Scheduled"
  | "In Progress"
  | "Owner Review"
  | "Completed";

type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";

type CleanerIssueForm = {
  reservationId: string;
  homeId: string;
  title: string;
  category: string;
  urgency: WorkOrderUrgency;
  notes: string;
};

type Vendor = {
  id: string;
  name: string;
  category: string;
  phone: string;
  rating: number;
  afterHours: boolean;
};

type WorkOrder = {
  id: string;
  homeId: string;
  title: string;
  category: string;
  urgency: WorkOrderUrgency;
  status: WorkOrderStatus;
  vendorId?: string;
  createdDate: string;
  scheduledDate?: string;
  notes: string;
  timeline: string[];
};

const starterCleaners: Cleaner[] = [
  {
    id: "aarthi",
    name: "Aarthi",
    phone: "555-0134",
    status: "Available",
    serviceArea: "Broken Bow",
    rating: 4.9,
    activeJobs: 1,
    specialties: ["B2B turnovers", "Hot tub reset", "Restock"],
    notes: "Strong default cleaner for Coates Cabin.",
  },
  {
    id: "maria",
    name: "Maria",
    phone: "555-0198",
    status: "Busy",
    serviceArea: "Gatlinburg",
    rating: 4.8,
    activeJobs: 2,
    specialties: ["Large cabins", "Inspection photos", "Laundry coordination"],
    notes: "Best for larger homes and detail-heavy resets.",
  },
  {
    id: "jordan",
    name: "Jordan",
    phone: "555-0147",
    status: "Available",
    serviceArea: "Branson",
    rating: 4.7,
    activeJobs: 1,
    specialties: ["Quick turnovers", "Guest-ready checks", "Supply reporting"],
    notes: "Good backup cleaner for urgent same-day needs.",
  },
];

const vendors: Vendor[] = [
  {
    id: "vendor-hvac",
    name: "Summit HVAC",
    category: "HVAC",
    phone: "555-1200",
    rating: 4.9,
    afterHours: true,
  },
  {
    id: "vendor-plumb",
    name: "Rapid Rooter",
    category: "Plumbing",
    phone: "555-4421",
    rating: 4.7,
    afterHours: true,
  },
  {
    id: "vendor-elec",
    name: "BrightLine Electric",
    category: "Electrical",
    phone: "555-3390",
    rating: 4.8,
    afterHours: false,
  },
  {
    id: "vendor-handyman",
    name: "Cabin Care Pros",
    category: "General",
    phone: "555-7731",
    rating: 4.6,
    afterHours: false,
  },
];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(dateString: string) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`);
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateString: string) {
  const today = new Date();
  const target = toDate(dateString);
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getUrgency(arrival: string) {
  const days = daysUntil(arrival);

  if (days < 0) return { label: "Past", className: "neutral" };
  if (days === 0) return { label: "Today", className: "critical" };
  if (days === 1) return { label: "Tomorrow", className: "urgent" };
  if (days <= 3) return { label: `${days} days`, className: "watch" };
  return { label: `${days} days`, className: "normal" };
}

function makeTimelineNote(status: ReservationStatus, cleanerId?: string) {
  const cleaner = starterCleaners.find(
    (item: Cleaner) => item.id === cleanerId,
  );

  if (status === "Assigned" && cleaner) return `Assigned to ${cleaner.name}`;
  if (status === "Accepted" && cleaner)
    return `${cleaner.name} accepted assignment`;
  if (status === "In Process") return "Reservation marked in process";
  if (status === "Completed") return "Reservation completed";

  return "Status updated";
}

function isDateInRange(date: Date, start: string, end: string) {
  const target = toInputDate(date);
  return target >= start && target < end;
}
function isSameDay(date: Date, dateString: string) {
  return toInputDate(date) === dateString;
}

function isImportedReservation(reservation: Reservation) {
  return reservation.source === "VRBO" || reservation.source === "Airbnb";
}

function normalizeReservationSource(source: string): ReservationSource {
  if (source === "Cleaning Block") return "Cleaning";
  if (source === "Maintenance Block") return "Maintenance";
  if (source === "Vendor Block") return "Vendor Visit";

  return source as ReservationSource;
}

function isTaskSource(source: ReservationSource) {
  return (
    source === "Cleaning" ||
    source === "Vendor Visit" ||
    source === "Inspection"
  );
}

function getReservationType(source: ReservationSource): ReservationType {
  if (source === "Owner Block") {
    return "Owner Block";
  }

  if (isTaskSource(source)) {
    return "Operational Task";
  }

  return "Reservation";
}
function getNotesValue(notes: string | undefined, label: string) {
  const prefix = `${label}:`;
  const line = (notes ?? "")
    .split("\n")
    .find((item) => item.startsWith(prefix));

  return line ? line.slice(prefix.length).trim() : "";
}

function getReservationDisplayTitle(reservation: Reservation) {
  if (reservation.source === "Cleaning") {
    return getNotesValue(reservation.notes, "Cleaning Type") || "Cleaning";
  }

  if (reservation.source === "Maintenance") {
    const category = getNotesValue(reservation.notes, "Maintenance Category");
    return category ? `Maintenance - ${category}` : "Maintenance";
  }

  if (reservation.source === "Vendor Visit") {
    const vendorType = getNotesValue(reservation.notes, "Vendor Type");
    return vendorType ? `Vendor Visit - ${vendorType}` : "Vendor Visit";
  }

  if (reservation.source === "Inspection") {
    const inspectionType = getNotesValue(reservation.notes, "Inspection Type");
    return inspectionType || "Inspection";
  }

  return (
    reservation.guestName?.replace(/^Reserved\s*-\s*/i, "") || "Reservation"
  );
}

function needsCleanerAssignment(reservation: Reservation) {
  if (reservation.type === "Mirror Block" || reservation.status === "Blocked") {
    return false;
  }

  const cleanerRequiredSources: ReservationSource[] = [
    "VRBO",
    "Airbnb",
    "Guest Reservation",
    "Owner Block",
    "Cleaning",
  ];

  return (
    cleanerRequiredSources.includes(reservation.source) &&
    reservation.status !== "Completed" &&
    reservation.status !== "No Clean Needed" &&
    !reservation.cleanerId &&
    !reservation.assignedUserId &&
    !reservation.assignedContactId
  );
}

function getReservationDetailLabel(reservation: Reservation) {
  if (isTaskSource(reservation.source)) return `${reservation.source} Task`;
  if (isImportedReservation(reservation)) return "Imported Reservation";
  return reservation.source;
}

function getTaskDayCount(reservations: Reservation[]) {
  return reservations
    .filter((reservation) => isTaskSource(reservation.source))
    .reduce((total, reservation) => {
      const start = toDate(reservation.arrival);
      const end = toDate(reservation.departure || reservation.arrival);
      return (
        total +
        Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      );
    }, 0);
}

function getSyncDateRangeLabel(start: string, end: string) {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} → ${formatDate(end)}`;
}

function getCalendarSyncIssues(
  reservations: Reservation[],
  homes: Home[],
  dismissedIds: string[],
) {
  type CalendarSyncIssue = {
    id: string;
    property: string;
    dateRange: string;
    message: string;
    severity: string;
    status: string;
    primaryReservation: Reservation;
    overlappingReservation: Reservation;
  };

  const todayKey = toInputDate(new Date());

  const addMonths = (date: Date, months: number) => {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  };

  const twentyFourMonthsFromTodayKey = toInputDate(addMonths(new Date(), 24));

  const isCalendarHealthEligible = (reservation: Reservation) => {
    if (!reservation.arrival || !reservation.departure) return false;

    // Ignore reservations that have already checked out.
    if (reservation.departure <= todayKey) return false;

    // Ignore reservations already in progress.
    // Airbnb iCal may not export the past portion of active reservations,
    // so these can create false missing-protection alerts.
    if (reservation.arrival < todayKey && reservation.departure > todayKey)
      return false;

    // Only evaluate today through 24 months ahead.
    if (reservation.arrival < todayKey) return false;
    if (reservation.arrival > twentyFourMonthsFromTodayKey) return false;

    return true;
  };

  const isOperationalReservation = (reservation: Reservation) => {
    if (reservation.type === "Mirror Block") return false;
    if (reservation.status === "Blocked") return false;
    if (isTaskSource(reservation.source)) return false;

    return (
      reservation.type === "Reservation" || reservation.type === "Owner Block"
    );
  };

  const healthReservations = reservations.filter(isCalendarHealthEligible);

  const getNightKeys = (start: string, end: string) => {
    const nights: string[] = [];
    const current = toDate(start);
    const checkout = toDate(end);

    while (current < checkout) {
      nights.push(toInputDate(current));
      current.setDate(current.getDate() + 1);
    }

    return nights;
  };

  const getDateRangesFromNights = (nights: string[]) => {
    if (nights.length === 0) return [];

    const sorted = [...nights].sort();
    const ranges: { start: string; end: string }[] = [];

    let rangeStart = sorted[0];
    let previous = sorted[0];

    sorted.slice(1).forEach((night) => {
      const expectedNext = toDate(previous);
      expectedNext.setDate(expectedNext.getDate() + 1);

      if (night === toInputDate(expectedNext)) {
        previous = night;
        return;
      }

      const rangeEnd = toDate(previous);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      ranges.push({
        start: rangeStart,
        end: toInputDate(rangeEnd),
      });

      rangeStart = night;
      previous = night;
    });

    const finalEnd = toDate(previous);
    finalEnd.setDate(finalEnd.getDate() + 1);

    ranges.push({
      start: rangeStart,
      end: toInputDate(finalEnd),
    });

    return ranges;
  };

  const getDayDifference = (dateA: string, dateB: string) => {
    return Math.abs(
      Math.round(
        (toDate(dateA).getTime() - toDate(dateB).getTime()) / 86400000,
      ),
    );
  };

  const addRangeToSet = (set: Set<string>, start: string, end: string) => {
    getNightKeys(start, end).forEach((night) => set.add(night));
  };

  const issues: CalendarSyncIssue[] = [];

  homes.forEach((home) => {
    const propertyHealthItems = healthReservations.filter(
      (reservation) => reservation.homeId === home.id,
    );

    const platformItems = propertyHealthItems.filter(
      (reservation) =>
        reservation.source === "VRBO" || reservation.source === "Airbnb",
    );

    // Calendar mirror protection checks only run when both platform calendar links exist.
    if (home.iCalUrl?.trim() && home.airbnbUrl?.trim()) {
      const vrboNights = new Set<string>();
      const airbnbNights = new Set<string>();

      const vrboNightSource = new Map<string, Reservation>();
      const airbnbNightSource = new Map<string, Reservation>();

      platformItems.forEach((reservation) => {
        const nights = getNightKeys(reservation.arrival, reservation.departure);

        nights.forEach((night) => {
          if (reservation.source === "VRBO") {
            vrboNights.add(night);
            if (!vrboNightSource.has(night))
              vrboNightSource.set(night, reservation);
          }

          if (reservation.source === "Airbnb") {
            airbnbNights.add(night);
            if (!airbnbNightSource.has(night))
              airbnbNightSource.set(night, reservation);
          }
        });
      });

      const vrboRanges = getDateRangesFromNights([...vrboNights]);
      const airbnbRanges = getDateRangesFromNights([...airbnbNights]);

      vrboRanges.forEach((vrboRange) => {
        airbnbRanges.forEach((airbnbRange) => {
          const startsClose =
            getDayDifference(vrboRange.start, airbnbRange.start) <= 1;
          const endsClose =
            getDayDifference(vrboRange.end, airbnbRange.end) <= 1;

          if (startsClose && endsClose) {
            const mergedStart =
              vrboRange.start < airbnbRange.start
                ? vrboRange.start
                : airbnbRange.start;
            const mergedEnd =
              vrboRange.end > airbnbRange.end ? vrboRange.end : airbnbRange.end;

            addRangeToSet(vrboNights, mergedStart, mergedEnd);
            addRangeToSet(airbnbNights, mergedStart, mergedEnd);
          }
        });
      });

      const createIssue = (
        source: "VRBO" | "Airbnb",
        oppositeSource: "VRBO" | "Airbnb",
        missingNights: string[],
        sourceMap: Map<string, Reservation>,
      ) => {
        if (missingNights.length === 0) return;

        const ranges = getDateRangesFromNights(missingNights);

        ranges.forEach((range) => {
          const dateRange = getSyncDateRangeLabel(range.start, range.end);
          const primaryReservation =
            sourceMap.get(range.start) ||
            missingNights.map((night) => sourceMap.get(night)).find(Boolean);

          if (!primaryReservation) return;

          const overlapsReservationAlreadyInProgress = reservations.some(
            (reservation) => {
              if (reservation.homeId !== home.id) return false;
              if (
                reservation.source !== "VRBO" &&
                reservation.source !== "Airbnb"
              )
                return false;

              return (
                reservation.arrival < todayKey &&
                reservation.departure > todayKey &&
                reservation.arrival < range.end &&
                reservation.departure > range.start
              );
            },
          );

          if (overlapsReservationAlreadyInProgress) return;

          const itemLabel =
            primaryReservation.type === "Mirror Block"
              ? "blocked dates"
              : "reservation";

          const issueId = `calendar-coverage-${home.id}-${source}-${range.start}-${range.end}`;

          issues.push({
            id: issueId,
            property: home.name ?? "Unknown property",
            dateRange,
            message: `${source} ${itemLabel} are not protected on ${oppositeSource}. Missing protection: ${dateRange}.`,
            severity: "High",
            status: dismissedIds.includes(issueId) ? "Dismissed" : "Open",
            primaryReservation,
            overlappingReservation: {
              ...primaryReservation,
              source: oppositeSource,
              guestName: `No ${oppositeSource} protection found`,
            },
          });
        });
      };

      createIssue(
        "VRBO",
        "Airbnb",
        [...vrboNights].filter((night) => !airbnbNights.has(night)),
        vrboNightSource,
      );

      createIssue(
        "Airbnb",
        "VRBO",
        [...airbnbNights].filter((night) => !vrboNights.has(night)),
        airbnbNightSource,
      );
    }

    // Cleaner not assigned checks use all future property reservations, not just platform imports.
    propertyHealthItems.forEach((reservation) => {
      if (!needsCleanerAssignment(reservation)) return;

      const issueId = `cleaner-not-assigned-${reservation.id}`;

      issues.push({
        id: issueId,
        property: home.name ?? "Unknown property",
        dateRange: getSyncDateRangeLabel(
          reservation.arrival,
          reservation.departure,
        ),
        message: `No cleaner has been assigned for ${reservation.guestName}.`,
        severity: "High",
        status: dismissedIds.includes(issueId) ? "Dismissed" : "Open",
        primaryReservation: reservation,
        overlappingReservation: reservation,
      });
    });

    // Cleaner assigned but not accepted for near-term arrivals.
    propertyHealthItems.forEach((reservation) => {
      if (!isOperationalReservation(reservation)) return;
      if (!reservation.cleanerId) return;
      if (reservation.status !== "Assigned") return;

      const daysUntilArrival = daysUntil(reservation.arrival);

      if (daysUntilArrival > 3) return;

      const issueId = `cleaner-not-accepted-${reservation.id}`;

      issues.push({
        id: issueId,
        property: home.name ?? "Unknown property",
        dateRange: getSyncDateRangeLabel(
          reservation.arrival,
          reservation.departure,
        ),
        message: `Cleaner has not accepted the upcoming clean for ${reservation.guestName}.`,
        severity: "High",
        status: dismissedIds.includes(issueId) ? "Dismissed" : "Open",
        primaryReservation: reservation,
        overlappingReservation: reservation,
      });
    });

    // Reservation Conflict Detection.
    const operationalReservations = propertyHealthItems.filter(
      isOperationalReservation,
    );

    for (let i = 0; i < operationalReservations.length; i++) {
      for (let j = i + 1; j < operationalReservations.length; j++) {
        const first = operationalReservations[i];
        const second = operationalReservations[j];

        const overlaps =
          first.arrival < second.departure && first.departure > second.arrival;

        if (!overlaps) continue;

        const issueId = `reservation-conflict-${first.id}-${second.id}`;

        issues.push({
          id: issueId,
          property: home.name ?? "Unknown property",
          dateRange: getSyncDateRangeLabel(
            first.arrival < second.arrival ? first.arrival : second.arrival,
            first.departure > second.departure
              ? first.departure
              : second.departure,
          ),
          message: `${first.guestName} overlaps ${second.guestName}.`,
          severity: "High",
          status: dismissedIds.includes(issueId) ? "Dismissed" : "Open",
          primaryReservation: first,
          overlappingReservation: second,
        });
      }
    }
  });

  const uniqueIssues = new Map<string, CalendarSyncIssue>();
  issues.forEach((issue) => uniqueIssues.set(issue.id, issue));

  return Array.from(uniqueIssues.values());
}
function getSourceControlledMessage(source: ReservationSource) {
  return `Imported from ${source}. To change or remove this reservation, update it in ${source} and re-sync.`;
}
function getReservationHomeId(reservation: any) {
  return (
    reservation.homeId ??
    reservation.propertyId ??
    reservation.property_id ??
    ""
  );
}

const CLEANER_PROPERTY_NOTES_PREFIX = "AMR_CLEANER_PROPERTY:";

function detectCalendarSource(url: string) {
  const normalized = url.trim().toLowerCase();

  if (normalized.includes("airbnb")) return "Airbnb";
  if (
    normalized.includes("vrbo") ||
    normalized.includes("homeaway") ||
    normalized.includes("homelidays")
  ) {
    return "VRBO";
  }
  if (normalized.includes("ownerrez")) return "OwnerRez";
  if (normalized.includes("guesty")) return "Guesty";
  if (normalized.includes("hospitable")) return "Hospitable";
  if (normalized.includes("lodgify")) return "Lodgify";

  return "Other";
}

function encodeCleanerPropertyDetails(values: CleanerPropertyFormValues) {
  return `${CLEANER_PROPERTY_NOTES_PREFIX}${JSON.stringify({
    imageUrl: values.propertyPhotoUrl.trim(),
    address: values.address.trim(),
    bedrooms: Number(values.bedrooms) || 0,
    bathrooms: Number(values.bathrooms) || 0,
    kitchens: Number(values.kitchens) || 0,
    floors: Number(values.floors) || 0,
    kingBeds: Number(values.kingBeds) || 0,
    queenBeds: Number(values.queenBeds) || 0,
    doubleBeds: Number(values.doubleBeds) || 0,
    twinBeds: Number(values.twinBeds) || 0,
    bunkBeds: Number(values.bunkBeds) || 0,
    pyramidBunks: Number(values.pyramidBunks) || 0,
    murphyBeds: Number(values.murphyBeds) || 0,
    sofaSleepers: Number(values.sofaSleepers) || 0,
    cleaningFee:
      values.cleaningFee.trim() === "" ? null : Number(values.cleaningFee),
    ownerName: values.ownerName.trim(),
    ownerEmail: values.ownerEmail.trim(),
    ownerPhone: values.ownerPhone.trim(),
    calendarFeedUrl: "",
    calendarSource: "",
    accessInstructions: values.accessInstructions.trim(),
    wifiName: values.wifiName.trim(),
    wifiPassword: values.wifiPassword.trim(),
    parkingInstructions: values.parkingInstructions.trim(),
    trashInstructions: values.trashInstructions.trim(),
    supplyLocations: values.supplyLocations.trim(),
    privateCleanerNotes: values.privateCleanerNotes.trim(),
  })}`;
}

function decodeCleanerPropertyDetails(notes: unknown) {
  if (
    typeof notes !== "string" ||
    !notes.startsWith(CLEANER_PROPERTY_NOTES_PREFIX)
  ) {
    return null;
  }

  try {
    return JSON.parse(notes.slice(CLEANER_PROPERTY_NOTES_PREFIX.length));
  } catch (error) {
    console.error("Failed to decode cleaner property details", error);
    return null;
  }
}

type AppProps = {
  initialPage?: string;
  userRole?: string | null;
  selectedGroupId: string;
  selectedGroupName: string;
  selectedGroupRole: string;
  canSwitchGroups?: boolean;
  onChangeGroup?: () => void;
  onCreateBusinessWorkspace: (businessName: string) => Promise<void>;
};

export default function App({
  initialPage,
  userRole,
  selectedGroupId,
  selectedGroupName,
  selectedGroupRole,
  canSwitchGroups = false,
  onChangeGroup,
  onCreateBusinessWorkspace,
}: AppProps) {
  const isAuthenticatedCleaner =
    userRole === "cleaner" || userRole === "employee";

  const isEmployeeCleaner =
    selectedGroupRole === "cleaner" ||
    selectedGroupRole === "employee";

  const [activePage, setActivePage] = useState<string>(
    initialPage ?? (isAuthenticatedCleaner ? "Cleaner Portal" : "Pulse"),
  );
  const [cleanerInvoiceInitialFilter, setCleanerInvoiceInitialFilter] =
    useState("all");
  const [selectedCleanerInvoiceId, setSelectedCleanerInvoiceId] = useState<
    string | null
  >(null);

  const [showOwnerMobileMenu, setShowOwnerMobileMenu] = useState(false);
  const [openCleanerScheduleOnLoad, setOpenCleanerScheduleOnLoad] =
    useState(false);
  const cleanerModePages = [
    "Cleaner Portal",
    "Cleaner Schedule",
    "Cleaner Properties",
    "Cleaner Clients",
    "Cleaner Jobs",
    "Cleaner Invoices",
    "Cleaner Reports",
    "Cleaner Profile",
    "Shared Workspaces",
  ];

  const isCleanerMode =
    isAuthenticatedCleaner || cleanerModePages.includes(activePage);
  const [homes, setHomes] = useState<Home[]>([]);
  const [clients, setClients] = useState<CleanerClientOption[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>(starterCleaners);
  const [assignableTeamMembers, setAssignableTeamMembers] = useState<
    AssignableTeamMember[]
  >([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [search, setSearch] = useState("");
  const [selectedHome, setSelectedHome] = useState("all");
  const [, setSelectedStatus] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const today = new Date();

  const [calendarDate, setCalendarDate] = useState(
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
  );
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<
    Reservation | CalendarBlock | null
  >(null);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<
    string | null
  >(null);
  const [calendarCreateDraft, setCalendarCreateDraft] = useState<{
    source: string;
    date: string;
    homeId: string;
  } | null>(null);
  const [reservationDetailReturnPage, setReservationDetailReturnPage] =
    useState<string>("Pulse");

  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(
    null,
  );
  const [workOrderFilter, setWorkOrderFilter] = useState("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null,
  );
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    city: "",
    address: "",
    setupMode: "VRBO" as Home["setupMode"],
    vrboId: "",
    airbnbUrl: "",
    iCalUrl: "",
    defaultCleanerId: "",
    bedrooms: "3",
    bathrooms: "2",
    maxGuests: "8",
    notes: "",
  });

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });

    document.querySelector(".mainContent")?.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, [activePage]);
  const [selectedCleanerId, setSelectedCleanerId] = useState(
    starterCleaners[0]?.id ?? "",
  );
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [dismissedDiscrepancies, setDismissedDiscrepancies] = useState<
    string[]
  >([]);
  const [dataMode, setDataMode] = useState<"Demo" | "Live">("Demo");
  const [sourceForm, setSourceForm] = useState({
    propertyName: "",
    market: "",
    vrboId: "",
    vrboICalUrl: "",
    vrboICalText: "",
    airbnbUrl: "",
    airbnbICalUrl: "",
    airbnbICalText: "",
  });
  const [importMessage, setImportMessage] = useState(
    "Demo data is active. Switch to Live Mode when you are ready to start from real VRBO/iCal sources.",
  );
  const [cleanerPortalId, setCleanerPortalId] = useState(
    starterCleaners[0]?.id ?? "",
  );
  const [invoiceTaskDraft, setInvoiceTaskDraft] = useState<any | null>(null);
  const [readyInvoiceTasks, setReadyInvoiceTasks] = useState<any[]>([]);
  const [invoiceReturnPage, setInvoiceReturnPage] =
    useState("Cleaner Invoices");
  const [cleanerIssueForm, setCleanerIssueForm] = useState<CleanerIssueForm>({
    reservationId: "",
    homeId: "",
    title: "",
    category: "General",
    urgency: "Medium",
    notes: "",
  });

  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [ownerWorkOrderForm, setOwnerWorkOrderForm] = useState({
    homeId: homes[0]?.id ?? "",
    title: "",
    category: "General",
    urgency: "Medium" as WorkOrderUrgency,
    vendorId: "",
    scheduledDate: "",
    notes: "",
  });

  useEffect(() => {
    void Promise.all([
      loadClientsFromSupabase(),
      loadPropertiesFromSupabase(),
      loadReservationsFromSupabase(),
      loadWorkOrdersFromSupabase(),
      loadCleanersFromSupabase(),
    ]);
  }, [selectedGroupId, selectedGroupRole]);

  useEffect(() => {
    void loadAssignableTeamMembers();
  }, [selectedGroupId]);

  const urgentNotificationCount = workOrders.filter(
    (order) =>
      order.homeId === selectedPropertyId &&
      (order.urgency === "High" || order.urgency === "After Hours") &&
      order.status !== "Completed",
  ).length;
  const propertyTaskStats = useMemo(() => {
    const propertyTasks = reservations.filter((item) =>
      isTaskSource(item.source),
    );
    const openTasks = propertyTasks.filter(
      (item) => item.status !== "Completed",
    );
    const cleaningTasksNeedingCleaner = propertyTasks.filter((item) =>
      needsCleanerAssignment(item),
    );
    const upcomingTasks = propertyTasks.filter(
      (item) => item.arrival >= toInputDate(new Date()),
    );

    return {
      total: propertyTasks.length,
      open: openTasks.length,
      needCleaner: cleaningTasksNeedingCleaner.length,
      upcoming: upcomingTasks.length,
    };
  }, [reservations]);
  const calendarSyncIssues = useMemo(() => {
    return getCalendarSyncIssues(reservations, homes, dismissedDiscrepancies);
  }, [reservations, homes, dismissedDiscrepancies]);

  async function createManualReservation(form: any) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      window.alert("You must be logged in to create a reservation.");
      return;
    }

    const manualHomeId = form.homeId || selectedPropertyId;
    const overlapsExistingReservation = reservations.find((reservation) => {
      if (reservation.homeId !== manualHomeId) return false;

      return (
        form.arrival < reservation.departure &&
        form.departure > reservation.arrival
      );
    });

    if (overlapsExistingReservation) {
      const confirmOverride = window.confirm(
        `This date range overlaps an existing item:\n\n${overlapsExistingReservation.guestName}\n${formatDate(
          overlapsExistingReservation.arrival,
        )} → ${formatDate(
          overlapsExistingReservation.departure,
        )}\n\nDo you still want to create it anyway?`,
      );

      if (!confirmOverride) return;
    }
    const selectedProperty = homes.find((home) => home.id === manualHomeId);
    const defaultCleanerId = selectedProperty?.defaultCleanerId ?? "";
    const cleanerId =
      form.cleanerId === "default"
        ? defaultCleanerId || undefined
        : form.cleanerId || defaultCleanerId || undefined;
    const reservationStatus = cleanerId ? "Assigned" : "Unassigned";
    const timeline = [
      "Created manually",
      cleanerId
        ? makeTimelineNote("Assigned", cleanerId)
        : "No cleaner assigned",
    ];

    const { error } = await supabase.from("reservations").insert({
      owner_id: user.id,
      property_id: manualHomeId,
      guest_name: form.guestName || form.source,
      source: form.source,
      arrival: form.arrival,
      departure: form.departure,
      status: reservationStatus,
      cleaner_id: cleanerId ?? null,
      notes: form.notes ?? "",
      timeline,
    });

    if (error) {
      console.error("Manual reservation creation failed", error);
      window.alert(error.message);
      return;
    }

    await loadReservationsFromSupabase();
  }
  async function updateReservation(id: string, updates: Partial<Reservation>) {
    let updatedReservation: Reservation | null = null;

    setReservations((current) =>
      current.map((reservation) => {
        if (reservation.id !== id) return reservation;

        const selectedTeamMember =
          "cleanerId" in updates
            ? assignableTeamMembers.find(
                (member) =>
                  String(member.id) === String(updates.cleanerId ?? ""),
              )
            : undefined;

        const nextCleaner =
          "cleanerId" in updates ? updates.cleanerId : reservation.cleanerId;

        const nextAssignedUser =
          "assignedUserId" in updates
            ? updates.assignedUserId
            : "cleanerId" in updates
              ? selectedTeamMember?.userId ||
                (updates.cleanerId ? reservation.assignedUserId : undefined)
              : reservation.assignedUserId;

        const nextAssignedContact =
          "assignedContactId" in updates
            ? updates.assignedContactId
            : reservation.assignedContactId;

        const assignmentWasCleared =
          ("assignedUserId" in updates &&
            !updates.assignedUserId &&
            !updates.assignedContactId) ||
          ("assignedContactId" in updates &&
            !updates.assignedContactId &&
            !updates.assignedUserId) ||
          ("cleanerId" in updates && !updates.cleanerId);

        const nextStatus = assignmentWasCleared
          ? "Unassigned"
          : (updates.status ?? reservation.status);

        const shouldAddTimeline =
          updates.status !== undefined ||
          "cleanerId" in updates ||
          "assignedUserId" in updates ||
          "assignedContactId" in updates;

        updatedReservation = {
          ...reservation,
          ...updates,
          cleanerId: nextCleaner,
          assignedUserId: nextAssignedUser,
          assignedContactId: nextAssignedContact,
          timeline: shouldAddTimeline
            ? [
                ...reservation.timeline,
                makeTimelineNote(nextStatus, nextCleaner),
              ]
            : reservation.timeline,
        };

        return updatedReservation;
      }),
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const supabaseUpdates: Record<string, any> = {};

      if ("cleanerId" in updates) {
        const selectedTeamMember = assignableTeamMembers.find(
          (member) =>
            String(member.id) === String(updates.cleanerId ?? ""),
        );

        if (selectedTeamMember) {
          // Workspace members are assigned through auth user IDs.
          // Do not place an auth user ID in cleaner_id because cleaner_id
          // references public.cleaners.id.
          supabaseUpdates.cleaner_id = null;
          supabaseUpdates.assigned_user_id = selectedTeamMember.userId;
        } else {
          // Preserve support for legacy cleaner records.
          supabaseUpdates.cleaner_id = updates.cleanerId ?? null;

          if (!updates.cleanerId) {
            supabaseUpdates.assigned_user_id = null;
          }
        }
      }

      if ("assignedUserId" in updates) {
        supabaseUpdates.assigned_user_id = updates.assignedUserId ?? null;

        if (updates.assignedUserId) {
          supabaseUpdates.assigned_contact_id = null;
        }
      }

      if ("assignedContactId" in updates) {
        supabaseUpdates.assigned_contact_id =
          updates.assignedContactId ?? null;

        if (updates.assignedContactId) {
          supabaseUpdates.assigned_user_id = null;
          supabaseUpdates.cleaner_id = null;
        }
      }

      if (updates.status !== undefined) {
        supabaseUpdates.status = updates.status;
      }

      if (updates.notes !== undefined) {
        supabaseUpdates.notes = updates.notes;
      }
      console.log("UPDATE CALLED", {
        id,
        updates,
        supabaseUpdates,
      });
      const { error } = await supabase
        .from("reservations")
        .update(supabaseUpdates)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select();

      console.log("SUPABASE UPDATE RESULT", { error });

      if (error) {
        console.error("Reservation update failed", error);
        window.alert(error.message);
        return;
      }
    }

    if (
      updatedReservation &&
      selectedCalendarItem &&
      "guestName" in selectedCalendarItem &&
      selectedCalendarItem.id === id
    ) {
      setSelectedCalendarItem(updatedReservation);
    }
  }

  async function deleteReservation(id: string) {
    const reservationToDelete = reservations.find(
      (reservation) => reservation.id === id,
    );

    if (!reservationToDelete) return;

    if (
      reservationToDelete.source === "VRBO" ||
      reservationToDelete.source === "Airbnb"
    ) {
      window.alert(getSourceControlledMessage(reservationToDelete.source));
      return;
    }

    const confirmation = window.confirm(
      `Delete ${reservationToDelete.guestName}? This cannot be undone.`,
    );

    if (!confirmation) return;

    const { error } = await supabase.from("reservations").delete().eq("id", id);

    if (error) {
      console.error("Reservation delete failed", error);
      window.alert(error.message);
      return;
    }

    setReservations((current) =>
      current.filter((reservation) => reservation.id !== id),
    );
    setSelectedCalendarItem(null);
    setActivePage("Reservations");
  }
  function openReservationFromCalendar(reservation: Reservation) {
    setSelectedCalendarItem(reservation);
    setReservationDetailReturnPage(activePage);
    setActivePage("Reservation Detail");
  }

  function getCalendarDayData(date: Date, homeFilter: string) {
    const dayReservations = reservations.filter((reservation) => {
      const dateKey = toInputDate(date);

      const includeDepartureDay =
        reservation.type === "Reservation" ||
        (reservation.source === "VRBO" && reservation.status === "Blocked");

      return (
        (homeFilter === "all" || reservation.homeId === homeFilter) &&
        dateKey >= reservation.arrival &&
        (includeDepartureDay
          ? dateKey <= reservation.departure
          : dateKey < reservation.departure)
      );
    });

    const dayBlocks = calendarBlocks.filter(
      (block) =>
        (homeFilter === "all" || block.homeId === homeFilter) &&
        isDateInRange(date, block.start, block.end),
    );

    const importedReservations = dayReservations.filter((reservation) =>
      isImportedReservation(reservation),
    );
    const propertyTasks = dayReservations.filter((reservation) =>
      isTaskSource(reservation.source),
    );
    const arrivals = importedReservations.filter((reservation) =>
      isSameDay(date, reservation.arrival),
    );
    const departures = importedReservations.filter((reservation) =>
      isSameDay(date, reservation.departure),
    );
    const hasTrueBackToBack = arrivals.some((arrival) =>
      departures.some(
        (departure) =>
          departure.id !== arrival.id && departure.homeId === arrival.homeId,
      ),
    );

    return {
      dayReservations,
      dayBlocks,
      propertyTasks,
      isB2B: hasTrueBackToBack,
      hasTasks: propertyTasks.length > 0,
      hasConflict: dayBlocks.some((block) =>
        importedReservations.some(
          (reservation) => reservation.homeId === block.homeId,
        ),
      ),
    };
  }

  function renderScrollableCalendarStack(options?: {
    homeFilter?: string;
    anchorDate?: Date;
    monthCount?: number;
    compact?: boolean;
  }) {
    return (
      <OperationTimelineCalendar
        homeFilter={options?.homeFilter ?? selectedPropertyId}
        anchorDate={options?.anchorDate ?? calendarDate}
        monthCount={options?.monthCount ?? 12}
        compact={options?.compact ?? false}
        getStackedCalendarMonths={getStackedCalendarMonths}
        getMonthDays={getMonthDays}
        getCalendarDayData={getCalendarDayData}
        monthNames={monthNames}
        toInputDate={toInputDate}
        homes={homes}
        cleaners={cleaners}
        needsCleanerAssignment={needsCleanerAssignment}
        getReservationDisplayTitle={getReservationDisplayTitle}
        getReservationDetailLabel={getReservationDetailLabel}
        openReservationFromCalendar={openReservationFromCalendar}
        setSelectedCalendarDateKey={setSelectedCalendarDateKey}
        setSelectedCalendarItem={setSelectedCalendarItem}
      />
    );
  }

  function renderCalendar() {
    return (
      <CalendarPage
        reservations={reservations}
        calendarBlocks={calendarBlocks}
        homes={homes}
        cleaners={cleaners}
        selectedPropertyId={selectedPropertyId}
        calendarDate={calendarDate}
        setCalendarDate={setCalendarDate}
        selectedCalendarDateKey={selectedCalendarDateKey}
        selectedCalendarItem={selectedCalendarItem}
        setSelectedCalendarItem={setSelectedCalendarItem}
        setReservationDetailReturnPage={setReservationDetailReturnPage}
        setActivePage={setActivePage}
        renderScrollableCalendarStack={renderScrollableCalendarStack}
        formatDate={formatDate}
        isTaskSource={isTaskSource}
        getReservationDisplayTitle={getReservationDisplayTitle}
        onCalendarCreate={(payload) => setCalendarCreateDraft(payload)}
      />
    );
  }

  async function updateWorkOrder(id: string, updates: Partial<WorkOrder>) {
    let updatedOrderForSave: WorkOrder | null = null;

    setWorkOrders((current) =>
      current.map((order) => {
        if (order.id !== id) return order;
        const timelineNote = updates.status
          ? `Status changed to ${updates.status}`
          : updates.vendorId
            ? `Vendor assigned: ${vendors.find((vendor) => vendor.id === updates.vendorId)?.name ?? "Vendor"}`
            : "Work order updated";

        const updatedOrder = {
          ...order,
          ...updates,
          timeline: [...order.timeline, timelineNote],
        };

        updatedOrderForSave = updatedOrder;

        if (selectedWorkOrder?.id === id) {
          setSelectedWorkOrder(updatedOrder);
        }

        return updatedOrder;
      }),
    );

    setTimeout(async () => {
      if (!updatedOrderForSave) return;

      const { error } = await supabase
        .from("work_orders")
        .update({
          title: updatedOrderForSave.title,
          category: updatedOrderForSave.category,
          urgency: updatedOrderForSave.urgency,
          status: updatedOrderForSave.status,
          vendor_id: updatedOrderForSave.vendorId ?? null,
          scheduled_date: updatedOrderForSave.scheduledDate ?? null,
          notes: updatedOrderForSave.notes,
          timeline: updatedOrderForSave.timeline,
        })
        .eq("id", id);

      if (error) {
        console.error("Work order update failed", error);
      }
    }, 0);
  }

  function getRecommendedVendors(category: string, urgency: WorkOrderUrgency) {
    return vendors
      .filter(
        (vendor) =>
          vendor.category === category || vendor.category === "General",
      )
      .filter((vendor) => urgency !== "After Hours" || vendor.afterHours)
      .sort((a, b) => b.rating - a.rating);
  }

  async function createOwnerWorkOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedWorkOrderHomeId =
      ownerWorkOrderForm.homeId || selectedPropertyId || homes[0]?.id || "";
    const workOrderTitle = ownerWorkOrderForm.title.trim();

    if (!selectedWorkOrderHomeId) {
      window.alert(
        "Please create or select a property before creating a work order.",
      );
      return;
    }

    if (!workOrderTitle) {
      window.alert("Please enter an issue title before saving the work order.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      window.alert("You must be logged in to create a work order.");
      return;
    }

    const selectedVendor = vendors.find(
      (vendor) => vendor.id === ownerWorkOrderForm.vendorId,
    );
    const timeline = [
      "Owner created work order",
      ownerWorkOrderForm.vendorId
        ? `Vendor assigned: ${selectedVendor?.name ?? "Vendor"}`
        : "No vendor assigned yet",
      ownerWorkOrderForm.scheduledDate
        ? `Scheduled for ${formatDate(ownerWorkOrderForm.scheduledDate)}`
        : "Schedule pending",
    ];

    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        owner_id: user.id,
        property_id: selectedWorkOrderHomeId,
        title: workOrderTitle,
        category: ownerWorkOrderForm.category,
        urgency: ownerWorkOrderForm.urgency,
        status: ownerWorkOrderForm.vendorId ? "Assigned" : "New",
        vendor_id: ownerWorkOrderForm.vendorId || null,
        created_date: toInputDate(new Date()),
        scheduled_date: ownerWorkOrderForm.scheduledDate || null,
        notes:
          ownerWorkOrderForm.notes || "Owner-created maintenance work order.",
        timeline,
      })
      .select()
      .single();

    if (error) {
      console.error("Work order save failed", error);
      window.alert(error.message);
      return;
    }

    const nextWorkOrder: WorkOrder = {
      id: data.id,
      homeId: data.property_id,
      title: data.title,
      category: data.category ?? "General",
      urgency: (data.urgency ?? "Medium") as WorkOrderUrgency,
      status: (data.status ?? "New") as WorkOrderStatus,
      vendorId: data.vendor_id ?? undefined,
      createdDate: data.created_date ?? toInputDate(new Date()),
      scheduledDate: data.scheduled_date ?? undefined,
      notes: data.notes ?? "",
      timeline: Array.isArray(data.timeline) ? data.timeline : timeline,
    };

    await loadWorkOrdersFromSupabase();

    setWorkOrderFilter("all");
    setNotifications((current) => [
      {
        id: `note-${Date.now()}`,
        type: "Maintenance",
        priority:
          ownerWorkOrderForm.urgency === "After Hours" ||
          ownerWorkOrderForm.urgency === "High"
            ? "Critical"
            : "Normal",
        title: "Owner created work order",
        message: `${nextWorkOrder.title} was created from the Maintenance tab.`,
        relatedHomeId: nextWorkOrder.homeId,
        createdAt: new Date().toLocaleString(),
        read: false,
      },
      ...current,
    ]);

    setOwnerWorkOrderForm({
      homeId: homes[0]?.id ?? "",
      title: "",
      category: "General",
      urgency: "Medium",
      vendorId: "",
      scheduledDate: "",
      notes: "",
    });
    setShowWorkOrderForm(false);
  }

  async function loadWorkOrdersFromSupabase() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load work orders", error);
      return;
    }

    const mappedWorkOrders: WorkOrder[] = (data ?? []).map((item: any) => ({
      id: item.id,
      homeId: item.property_id,
      title: item.title,
      category: item.category ?? "General",
      urgency: (item.urgency ?? "Medium") as WorkOrderUrgency,
      status: (item.status ?? "New") as WorkOrderStatus,
      vendorId: item.vendor_id ?? undefined,
      createdDate: item.created_date ?? toInputDate(new Date()),
      scheduledDate: item.scheduled_date ?? undefined,
      notes: item.notes ?? "",
      timeline: Array.isArray(item.timeline) ? item.timeline : [],
    }));

    setWorkOrders(mappedWorkOrders);
  }

  async function loadClientsFromSupabase() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone, preferred_language")
      .eq("owner_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load clients", error);
      return;
    }

    setClients(
      (data ?? []).map((client: any) => ({
        id: String(client.id),
        name: client.name ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        preferredLanguage: client.preferred_language ?? "English",
      })),
    );
  }

  async function loadPropertiesFromSupabase() {
    const { data: userData } = await supabase.auth.getUser();

    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load properties", error);
      return;
    }

    const mappedHomes: Home[] = (data ?? []).map((property: any) => {
      const cleanerDetails = decodeCleanerPropertyDetails(property.notes) ?? {};
      const vrboCalendarUrl = String(
        property.calendar_feed_url ??
          cleanerDetails.vrboCalendarUrl ??
          cleanerDetails.calendarFeedUrl ??
          property.vrbo_ical_url ??
          property.vrbo_calendar_url ??
          property.vrbo_property_id ??
          "",
      ).trim();

      const airbnbCalendarUrl = String(
        cleanerDetails.airbnbCalendarUrl ??
          property.airbnb_ical_url ??
          property.airbnb_calendar_url ??
          property.airbnb_property_id ??
          "",
      ).trim();

      return {
        id: property.id,
        clientId: property.client_id ?? undefined,
        name: property.property_name ?? "Unnamed Property",
        city: property.market ?? "",
        shortName: (property.property_name ?? "HM")
          .split(" ")
          .map((word: string) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        address: cleanerDetails.address ?? property.address ?? "",
        setupMode: "VRBO",
        vrboId: "",
        airbnbUrl: airbnbCalendarUrl,
        iCalUrl: vrboCalendarUrl,
        calendarFeedUrl: vrboCalendarUrl,
        calendarSource:
          cleanerDetails.calendarSource ??
          detectCalendarSource(vrboCalendarUrl || airbnbCalendarUrl),
        defaultCleanerId: property.default_cleaner_id ?? "",
        bedrooms: Number(cleanerDetails.bedrooms ?? property.bedrooms ?? 0),
        bathrooms: Number(cleanerDetails.bathrooms ?? property.bathrooms ?? 0),
        maxGuests: Number(property.max_guests ?? 0),
        kitchens: Number(cleanerDetails.kitchens ?? 0),
        floors: Number(cleanerDetails.floors ?? 0),
        kingBeds: Number(cleanerDetails.kingBeds ?? 0),
        queenBeds: Number(cleanerDetails.queenBeds ?? 0),
        doubleBeds: Number(cleanerDetails.doubleBeds ?? 0),
        twinBeds: Number(cleanerDetails.twinBeds ?? 0),
        bunkBeds: Number(cleanerDetails.bunkBeds ?? 0),
        pyramidBunks: Number(cleanerDetails.pyramidBunks ?? 0),
        murphyBeds: Number(cleanerDetails.murphyBeds ?? 0),
        sofaSleepers: Number(cleanerDetails.sofaSleepers ?? 0),
        status: "Active",
        notes: cleanerDetails.privateCleanerNotes ?? "",
        imageUrl: cleanerDetails.imageUrl ?? property.image_url ?? "",
        ownerName: cleanerDetails.ownerName ?? property.owner_name ?? "",
        ownerEmail: cleanerDetails.ownerEmail ?? property.owner_email ?? "",
        ownerPhone: cleanerDetails.ownerPhone ?? property.owner_phone ?? "",
       cleaningFee:
  property.cleaning_fee ?? cleanerDetails.cleaningFee ?? undefined,
        parkingInstructions:
          cleanerDetails.parkingInstructions ??
          property.parking_instructions ??
          "",
        supplyLocations:
          cleanerDetails.supplyLocations ?? property.supply_locations ?? "",
        operations: {
          access:
            cleanerDetails.accessInstructions ??
            property.access_instructions ??
            "",
          wifiName: cleanerDetails.wifiName ?? property.wifi_name ?? "",
          wifiPassword:
            cleanerDetails.wifiPassword ?? property.wifi_password ?? "",
          trashInstructions:
            cleanerDetails.trashInstructions ??
            property.trash_instructions ??
            "",
          cleanerNotes: cleanerDetails.privateCleanerNotes ?? "",
        },
      };
    });

    setHomes(mappedHomes);

    if (mappedHomes.length > 0) {
      setSelectedPropertyId((currentSelectedPropertyId) => {
        const stillExists = mappedHomes.some(
          (home) => home.id === currentSelectedPropertyId,
        );
        return stillExists ? currentSelectedPropertyId : mappedHomes[0].id;
      });
    }
  }
  async function loadReservationsFromSupabase() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    let reservationQuery = supabase
  .from("reservations")
  .select(`
    *,
    property:properties (
      property_name,
      address,
      market
    )
  `)
  .eq("calendar_event_active", true);

    reservationQuery = isEmployeeCleaner
      ? reservationQuery.eq("assigned_user_id", user.id)
      : reservationQuery.eq("owner_id", user.id);

    const { data, error } = await reservationQuery.order("arrival", {
      ascending: true,
    });

    if (error) {
      console.error("Failed to load reservations", error);
      return;
    }

    const mappedReservations: Reservation[] = (data ?? []).map((item: any) => {
      const source = normalizeReservationSource(item.source);
      const status = (item.status ?? "Unassigned") as ReservationStatus;

    return {
  id: item.id,
  guestName: item.guest_name,
  homeId: item.property_id,
  source,
  type: getReservationType(source),
  arrival: item.arrival,
  departure: item.departure,
  status,

  cleanerId:
    item.assigned_user_id ?? item.cleaner_id ?? undefined,

  assignedUserId:
    item.assigned_user_id ?? undefined,

  assignedContactId:
    item.assigned_contact_id ?? undefined,

  propertyName:
    item.property?.property_name ?? undefined,

  propertyAddress:
    item.property?.address ??
    item.property?.market ??
    undefined,

  notes: item.notes ?? "",

  timeline: Array.isArray(item.timeline)
    ? item.timeline
    : [],
};
    });
    console.table(
      mappedReservations
        .filter(
          (r) =>
            r.arrival.startsWith("2026-08") ||
            r.departure.startsWith("2026-08"),
        )
        .map((r) => ({
          guest: r.guestName,
          source: r.source,
          type: r.type,
          status: r.status,
          arrival: r.arrival,
          departure: r.departure,
          nights: Math.round(
            (new Date(r.departure).getTime() - new Date(r.arrival).getTime()) /
              86400000,
          ),
        })),
    );
    console.table(
      mappedReservations
        .filter((r) => r.arrival <= "2026-07-06" && r.departure >= "2026-06-28")
        .map((r) => ({
          guest: r.guestName,
          source: r.source,
          type: r.type,
          status: r.status,
          arrival: r.arrival,
          departure: r.departure,
          cleaner: r.cleanerId,
        })),
    );
    setReservations(mappedReservations);
  }
  async function loadAssignableTeamMembers() {
    const normalizedGroupId = String(selectedGroupId ?? "").trim();

    if (!normalizedGroupId || normalizedGroupId === "undefined") {
      setAssignableTeamMembers([]);
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      const currentUserId = String(session.user.id);

      const response = await fetch(
        `${API_URL}/api/groups/${encodeURIComponent(normalizedGroupId)}/members`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ??
            `Unable to load team members (${response.status}).`,
        );
      }

      const rawMembers = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.members)
          ? payload.members
          : [];

      const assignableRoles = new Set([
        "cleaner",
        "employee",
        "team_member",
        "member",
      ]);

      const mappedMembers: AssignableTeamMember[] = rawMembers
        .filter((member: any) => {
          const role = String(member?.role ?? "")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");
          const status = String(member?.status ?? "active")
            .trim()
            .toLowerCase();

          const memberUserId = String(
            member?.user_id ??
              member?.profile?.id ??
              member?.profiles?.id ??
              member?.user_profile?.id ??
              "",
          );

          return (
            status !== "removed" &&
            status !== "pending" &&
            assignableRoles.has(role) &&
            Boolean(memberUserId) &&
            memberUserId !== currentUserId
          );
        })
        .map((member: any) => {
          const profile =
            member?.profile ??
            member?.profiles ??
            member?.user_profile ??
            {};
          const userId = String(
            member?.user_id ?? profile?.id ?? profile?.user_id ?? "",
          );
          const name = String(
            profile?.contact_name ??
              profile?.display_name ??
              profile?.full_name ??
              profile?.business_name ??
              member?.display_name ??
              member?.full_name ??
              profile?.email ??
              member?.email ??
              "Team Member",
          ).trim();

          return {
            id: userId,
            userId,
            groupMemberId: String(member?.id ?? userId),
            name,
            email: String(profile?.email ?? member?.email ?? ""),
            role: String(member?.role ?? "team_member"),
            phone: String(profile?.phone ?? member?.phone ?? ""),
            status: "Available" as const,
            serviceArea: "",
            rating: 5,
            activeJobs: 0,
            specialties: [],
            notes: "",
          };
        })
        .filter((member: AssignableTeamMember) => Boolean(member.id))
        .sort((first: AssignableTeamMember, second: AssignableTeamMember) =>
          first.name.localeCompare(second.name),
        );
console.log("TEAM MEMBERS", mappedMembers);
      setAssignableTeamMembers(mappedMembers);

    } catch (error) {
      console.error("Failed to load assignable team members", error);
      setAssignableTeamMembers([]);
    }
  }

  async function loadCleanersFromSupabase() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("cleaners")
      .select("*")
      .eq("owner_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load cleaners", error);
      return;
    }

    const mappedCleaners: Cleaner[] = (data ?? []).map((cleaner: any) => ({
      id: cleaner.id,
      name: cleaner.name ?? "",
      phone: cleaner.phone ?? "",
      status: cleaner.status ?? "Available",
      serviceArea: cleaner.service_area ?? "",
      rating: 5,
      activeJobs: 0,
      specialties: [],
      notes: "",
    }));

    setCleaners(mappedCleaners);

    if (isEmployeeCleaner) {
      // Employee work is connected through reservations.assigned_user_id.
      setCleanerPortalId(user.id);
      return;
    }

    if (mappedCleaners.length > 0) {
      setSelectedCleanerId(mappedCleaners[0].id);
      setCleanerPortalId(mappedCleaners[0].id);
    }
  }

  async function createCleanerClient(values: {
    name: string;
    email: string;
    phone: string;
    preferredLanguage: string;
    notes: string;
  }): Promise<CleanerClientOption> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      throw new Error("You must be logged in to create a client.");
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({
        owner_id: user.id,
        name: values.name.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        preferred_language: values.preferredLanguage || "English",
        notes: values.notes.trim() || null,
      })
      .select("id, name, email, phone, preferred_language")
      .single();

    if (error) {
      console.error("Client creation failed", error);
      throw new Error(error.message);
    }

    const createdClient: CleanerClientOption = {
      id: String(data.id),
      name: data.name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      preferredLanguage: data.preferred_language ?? "English",
    };

    setClients((current) =>
      [...current, createdClient].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return createdClient;
  }

  async function createCleanerProperty(
    values: CleanerPropertyFormValues,
  ): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      throw new Error("You must be logged in to create a property.");
    }

    if (!cleanerPortalId) {
      throw new Error("No cleaner profile is currently selected.");
    }

    const { data: createdProperty, error } = await supabase
      .from("properties")
      .insert({
        owner_id: user.id,
        client_id: values.clientId || null,
        property_name: values.propertyName.trim(),
        market: values.city.trim(),
        default_cleaner_id: cleanerPortalId,
        calendar_feed_url: null,
        calendar_source: null,
        vrbo_property_id: null,
        airbnb_property_id: null,
        address: values.address.trim(),
        image_url: values.propertyPhotoUrl.trim() || null,
        bedrooms: Number(values.bedrooms) || 0,
        bathrooms: Number(values.bathrooms) || 0,
        max_guests: 0,
        
        owner_name: values.ownerName.trim(),
        owner_email: values.ownerEmail.trim() || null,
        owner_phone: values.ownerPhone.trim() || null,
        access_instructions: values.accessInstructions.trim() || null,
        wifi_name: values.wifiName.trim() || null,
        wifi_password: values.wifiPassword.trim() || null,
        parking_instructions: values.parkingInstructions.trim() || null,
        trash_instructions: values.trashInstructions.trim() || null,
        supply_locations: values.supplyLocations.trim() || null,
        notes: encodeCleanerPropertyDetails(values),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Cleaner property save failed", error);
      throw new Error(error.message);
    }

    await loadPropertiesFromSupabase();
    return String(createdProperty.id);
  }

  async function resyncCleanerPropertyCalendar(
    propertyId: string,
  ): Promise<{ importedCount: number }> {
    const existingHome = homes.find(
      (home) => String(home.id) === String(propertyId),
    );

    if (!existingHome) {
      throw new Error("The selected property could not be found.");
    }

    if (!existingHome.iCalUrl && !existingHome.airbnbUrl) {
      throw new Error("This property does not have a connected calendar.");
    }

    const importedCount = await syncReservations(existingHome);
    return { importedCount };
  }

  async function connectCleanerPropertyCalendar(
    propertyId: string,
    calendarUrl: string,
  ): Promise<{ importedCount: number; source: string }> {
    const trimmedUrl = calendarUrl.trim();

    if (!trimmedUrl) {
      throw new Error("Paste the complete Airbnb or VRBO iCal link.");
    }

    const source = detectCalendarSource(trimmedUrl);

    if (source !== "Airbnb" && source !== "VRBO") {
      throw new Error(
        "AMR could not identify this as an Airbnb or VRBO calendar link.",
      );
    }

    const existingHome = homes.find(
      (home) => String(home.id) === String(propertyId),
    );

    if (!existingHome) {
      throw new Error("The newly created property could not be found.");
    }

    const databaseUpdates =
      source === "Airbnb"
        ? {
            airbnb_property_id: trimmedUrl,
            calendar_source: source,
          }
        : {
            calendar_feed_url: trimmedUrl,
            calendar_source: source,
            vrbo_property_id: trimmedUrl,
          };

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      throw new Error("You must be logged in to connect a calendar.");
    }

    const { error } = await supabase
      .from("properties")
      .update(databaseUpdates)
      .eq("id", propertyId)
      .eq("owner_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    const propertyForSync: Home = {
      ...existingHome,
      airbnbUrl: source === "Airbnb" ? trimmedUrl : existingHome.airbnbUrl,
      iCalUrl: source === "VRBO" ? trimmedUrl : existingHome.iCalUrl,
      calendarFeedUrl:
        source === "VRBO" ? trimmedUrl : existingHome.calendarFeedUrl,
      calendarSource: source,
    };

    const importedCount = await syncReservations(propertyForSync);
    await loadPropertiesFromSupabase();

    return { importedCount, source };
  }

  async function updateCleanerProperty(
    propertyId: string,
    values: CleanerPropertyFormValues,
  ) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      throw new Error("You must be logged in to update a property.");
    }

    const existingHome = homes.find(
      (home) => String(home.id) === String(propertyId),
    );

    if (!existingHome) {
      throw new Error("The selected property could not be found.");
    }

    const { error } = await supabase
      .from("properties")
      .update({
        client_id: values.clientId || null,
        property_name: values.propertyName.trim(),
        market: values.city.trim(),
        address: values.address.trim(),
        image_url: values.propertyPhotoUrl.trim() || null,
        bedrooms: Number(values.bedrooms) || 0,
        bathrooms: Number(values.bathrooms) || 0,
        cleaning_fee:
          values.cleaningFee.trim() === "" ? null : Number(values.cleaningFee),
        owner_name: values.ownerName.trim(),
        owner_email: values.ownerEmail.trim() || null,
        owner_phone: values.ownerPhone.trim() || null,
        access_instructions: values.accessInstructions.trim() || null,
        wifi_name: values.wifiName.trim() || null,
        wifi_password: values.wifiPassword.trim() || null,
        parking_instructions: values.parkingInstructions.trim() || null,
        trash_instructions: values.trashInstructions.trim() || null,
        supply_locations: values.supplyLocations.trim() || null,
        notes: encodeCleanerPropertyDetails(values),
      })
      .eq("id", propertyId)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Cleaner property update failed", error);
      throw new Error(error.message);
    }

    await loadPropertiesFromSupabase();
  }

  async function deleteCleanerProperty(propertyId: string) {
    const { error: workOrderDeleteError } = await supabase
      .from("work_orders")
      .delete()
      .eq("property_id", propertyId);

    if (workOrderDeleteError) {
      console.error(
        "Cleaner property work-order delete failed",
        workOrderDeleteError,
      );
      throw new Error(workOrderDeleteError.message);
    }

    const { error: reservationDeleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("property_id", propertyId);

    if (reservationDeleteError) {
      console.error(
        "Cleaner property reservation delete failed",
        reservationDeleteError,
      );
      throw new Error(reservationDeleteError.message);
    }

    const { error: propertyDeleteError } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyId);

    if (propertyDeleteError) {
      console.error("Cleaner property delete failed", propertyDeleteError);
      throw new Error(propertyDeleteError.message);
    }

    await Promise.all([
      loadPropertiesFromSupabase(),
      loadReservationsFromSupabase(),
      loadWorkOrdersFromSupabase(),
    ]);
  }

  async function createProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!propertyForm.name.trim()) {
      alert("Property name is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("You must be logged in to create a property.");
      return;
    }

    const { error } = await supabase.from("properties").insert({
      owner_id: user.id,

      property_name: propertyForm.name.trim(),
      default_cleaner_id: propertyForm.defaultCleanerId || null,
      market: propertyForm.city.trim(),
      calendar_feed_url: propertyForm.iCalUrl.trim() || null,
      calendar_source: propertyForm.iCalUrl.trim()
        ? detectCalendarSource(propertyForm.iCalUrl)
        : propertyForm.airbnbUrl.trim()
          ? detectCalendarSource(propertyForm.airbnbUrl)
          : null,
      vrbo_property_id: propertyForm.iCalUrl.trim() || null,
      airbnb_property_id: propertyForm.airbnbUrl.trim() || null,
    });

    if (error) {
      console.error("Property save failed", error);
      alert(error.message);
      return;
    }

    await loadPropertiesFromSupabase();

    setShowPropertyForm(false);
    setPropertyForm({
      name: "",
      city: "",
      address: "",
      setupMode: "VRBO",
      vrboId: "",
      airbnbUrl: "",
      iCalUrl: "",
      defaultCleanerId: "",
      bedrooms: "3",
      bathrooms: "2",
      maxGuests: "8",
      notes: "",
    });
  }
  async function updateProperty(id: string, updates: Partial<Home>) {
    const existingHome = homes.find((home) => home.id === id);
    const nextHome = {
      ...existingHome,
      ...updates,
    };

    const { error } = await supabase
      .from("properties")
      .update({
        property_name: nextHome.name,
        market: nextHome.city,
        calendar_feed_url: String(nextHome.iCalUrl ?? "").trim() || null,
        calendar_source: String(nextHome.iCalUrl ?? "").trim()
          ? detectCalendarSource(String(nextHome.iCalUrl))
          : String(nextHome.airbnbUrl ?? "").trim()
            ? detectCalendarSource(String(nextHome.airbnbUrl))
            : null,
        vrbo_property_id: String(nextHome.iCalUrl ?? "").trim() || null,
        airbnb_property_id: String(nextHome.airbnbUrl ?? "").trim() || null,
        default_cleaner_id: nextHome.defaultCleanerId || null,
      })
      .eq("id", id);

    if (error) {
      console.error("Property update failed", error);
      alert(error.message);
      return;
    }

    await loadPropertiesFromSupabase();
  }
  function archiveProperty(id: string) {
    updateProperty(id, { status: "Paused" });
    setEditingPropertyId(null);
    setShowPropertyForm(false);
  }
  async function deleteProperty(id: string) {
    const property = homes.find((home) => home.id === id);
    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${property?.name ?? "this property"} and its reservations.`,
    );

    if (confirmation !== "DELETE") return;

    const { error: reservationDeleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("property_id", id);

    if (reservationDeleteError) {
      console.error("Reservation delete failed", reservationDeleteError);
      alert(reservationDeleteError.message);
      return;
    }

    const { error } = await supabase.from("properties").delete().eq("id", id);

    if (error) {
      console.error("Property delete failed", error);
      alert(error.message);
      return;
    }

    await loadPropertiesFromSupabase();
    await loadReservationsFromSupabase();

    setSelectedPropertyId("");
    setEditingPropertyId(null);
    setShowPropertyForm(false);
  }

  async function syncReservations(propertyOverride?: Home): Promise<number> {
    try {
      if (!propertyOverride && !selectedPropertyId) {
        alert("Please select a property first.");
        return 0;
      }

      const selectedProperty =
        propertyOverride ??
        homes.find((home) => home.id === selectedPropertyId);

      if (!selectedProperty) {
        if (!propertyOverride) alert("Selected property not found.");
        return 0;
      }

      const syncedPropertyId = selectedProperty.id;

      if (!selectedProperty.iCalUrl && !selectedProperty.airbnbUrl) {
        if (!propertyOverride) {
          alert("This property does not have any calendar links yet.");
        }
        return 0;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        throw new Error("You must be logged in to sync reservations.");
      }

      let importedReservations: any[] = [];
      const successfullySyncedSources = new Set<string>();

      async function fetchCalendar(url: string, source: "VRBO" | "Airbnb") {
        const response = await fetch(`${API_URL}/api/fetch-ical`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, source }),
        });

        const rawText = await response.text();
        let result: any = {};

        try {
          result = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(
            `${source} calendar fetch returned an invalid server response.`,
          );
        }

        if (!response.ok) {
          throw new Error(result.error || `Failed to fetch ${source} calendar`);
        }

        if (typeof result.icalText !== "string") {
          throw new Error(
            `${source} calendar response did not include iCal data.`,
          );
        }

        const parsed = parseICalTextToReservations(
          result.icalText,
          syncedPropertyId,
          source,
        );

        if (source === "VRBO") {
          successfullySyncedSources.add("VRBO");
          successfullySyncedSources.add("Owner Block");
        } else {
          successfullySyncedSources.add("Airbnb");
        }

        importedReservations = [...importedReservations, ...parsed];
      }

      // Fetch every configured feed before making any database changes. If one
      // feed fails, the sync stops so AMR never mistakes a fetch failure for a
      // cancellation or removed block.
      if (selectedProperty.iCalUrl) {
        await fetchCalendar(selectedProperty.iCalUrl, "VRBO");
      }

      if (selectedProperty.airbnbUrl) {
        await fetchCalendar(selectedProperty.airbnbUrl, "Airbnb");
      }

      const importWindowStart = toInputDate(new Date());
      const importWindowEndDate = new Date();
      importWindowEndDate.setMonth(importWindowEndDate.getMonth() + 12);
      const importWindowEnd = toInputDate(importWindowEndDate);

      importedReservations = importedReservations.filter(
        (reservation: any) =>
          reservation.departure >= importWindowStart &&
          reservation.arrival <= importWindowEnd,
      );

      const { data: existingImportedRows, error: existingImportedError } =
        await supabase
          .from("reservations")
          .select(
            "id, owner_id, property_id, source, ical_uid, guest_name, arrival, departure, cleaner_id, assigned_user_id, assigned_contact_id, status, notes, timeline, calendar_event_active, calendar_removed_at",
          )
          .eq("owner_id", user.id)
          .eq("property_id", selectedProperty.id)
          .not("ical_uid", "is", null);

      if (existingImportedError) {
        throw existingImportedError;
      }

      const existingRowsInWindow = (existingImportedRows ?? []).filter(
        (reservation: any) =>
          successfullySyncedSources.has(String(reservation.source)) &&
          reservation.departure >= importWindowStart &&
          reservation.arrival <= importWindowEnd,
      );

      const makeCalendarKey = (source: unknown, uid: unknown) =>
        `${String(source ?? "")}-${String(uid ?? "")}`;

      const existingReservationMap = new Map(
        existingRowsInWindow.map((reservation: any) => [
          makeCalendarKey(reservation.source, reservation.ical_uid),
          reservation,
        ]),
      );

      const nowIso = new Date().toISOString();
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const daysFromToday = (dateKey: string) => {
        const target = new Date(`${dateKey}T12:00:00`);
        return Math.ceil((target.getTime() - today.getTime()) / 86400000);
      };

      const isBlockRecord = (reservation: any) =>
        String(reservation.source ?? "").toLowerCase() === "owner block" ||
        String(reservation.status ?? "").toLowerCase() === "blocked" ||
        String(reservation.guest_name ?? "")
          .toLowerCase()
          .includes("block") ||
        String(reservation.guest_name ?? "")
          .toLowerCase()
          .includes("owner stay");

      const getAlertSeverity = (
        affectedDate: string,
      ): "high" | "normal" | null => {
        const days = daysFromToday(affectedDate);

        // Immediate Threat alerts only cover changes affecting today
        // through the next 30 days. Calendar data still syncs for 12 months.
        if (days < 0 || days > 30) return null;
        return days <= 7 ? "high" : "normal";
      };

      const alerts: any[] = [];

      const addAlert = (input: {
        reservationId?: string | null;
        icalUid: string;
        source: string;
        alertType: string;
        affectedDate: string;
        title: string;
        message: string;
        oldArrival?: string | null;
        newArrival?: string | null;
        oldDeparture?: string | null;
        newDeparture?: string | null;
        metadata?: Record<string, unknown>;
      }) => {
        const severity = getAlertSeverity(input.affectedDate);
        if (!severity) return;

        const fingerprint = [
          selectedProperty.id,
          input.source,
          input.icalUid,
          input.alertType,
          input.oldArrival ?? "",
          input.newArrival ?? "",
          input.oldDeparture ?? "",
          input.newDeparture ?? "",
        ].join("|");

        alerts.push({
          owner_id: user.id,
          cleaner_id: selectedProperty.defaultCleanerId || null,
          property_id: selectedProperty.id,
          reservation_id: input.reservationId ?? null,
          ical_uid: input.icalUid,
          source: input.source,
          alert_type: input.alertType,
          severity,
          title: input.title,
          message: input.message,
          old_arrival: input.oldArrival ?? null,
          new_arrival: input.newArrival ?? null,
          old_departure: input.oldDeparture ?? null,
          new_departure: input.newDeparture ?? null,
          status: "new",
          fingerprint,
          metadata: input.metadata ?? {},
        });
      };

      for (const importedReservation of importedReservations) {
        const key = makeCalendarKey(
          importedReservation.source,
          importedReservation.ical_uid,
        );
        const existingReservation = existingReservationMap.get(key) as any;
        const block = isBlockRecord(importedReservation);

        if (
          !existingReservation ||
          existingReservation.calendar_event_active === false
        ) {
          const arrivalDays = daysFromToday(importedReservation.arrival);

          if (block) {
            addAlert({
              reservationId: existingReservation?.id ?? null,
              icalUid: importedReservation.ical_uid,
              source: importedReservation.source,
              alertType: "block_added",
              affectedDate: importedReservation.departure,
              title: "New calendar block added",
              message: `${selectedProperty.name}: a new ${importedReservation.source} block was added for ${formatDate(importedReservation.arrival)} to ${formatDate(importedReservation.departure)}.`,
              newArrival: importedReservation.arrival,
              newDeparture: importedReservation.departure,
              metadata: { reactivated: Boolean(existingReservation) },
            });
          } else if (arrivalDays >= 0 && arrivalDays <= 30) {
            addAlert({
              reservationId: existingReservation?.id ?? null,
              icalUid: importedReservation.ical_uid,
              source: importedReservation.source,
              alertType: "last_minute_booking",
              affectedDate: importedReservation.arrival,
              title:
                arrivalDays <= 7 ? "Last-minute booking" : "New booking added",
              message: `${selectedProperty.name}: a new ${importedReservation.source} reservation arrives ${formatDate(importedReservation.arrival)} and departs ${formatDate(importedReservation.departure)}.`,
              newArrival: importedReservation.arrival,
              newDeparture: importedReservation.departure,
              metadata: { reactivated: Boolean(existingReservation) },
            });
          }

          continue;
        }

        const arrivalChanged =
          existingReservation.arrival !== importedReservation.arrival;
        const departureChanged =
          existingReservation.departure !== importedReservation.departure;

        if (block && (arrivalChanged || departureChanged)) {
          addAlert({
            reservationId: existingReservation.id,
            icalUid: importedReservation.ical_uid,
            source: importedReservation.source,
            alertType: "block_changed",
            affectedDate:
              existingReservation.departure < importedReservation.departure
                ? existingReservation.departure
                : importedReservation.departure,
            title: "Calendar block changed",
            message: `${selectedProperty.name}: a ${importedReservation.source} block changed from ${formatDate(existingReservation.arrival)}–${formatDate(existingReservation.departure)} to ${formatDate(importedReservation.arrival)}–${formatDate(importedReservation.departure)}.`,
            oldArrival: existingReservation.arrival,
            newArrival: importedReservation.arrival,
            oldDeparture: existingReservation.departure,
            newDeparture: importedReservation.departure,
          });
          continue;
        }

        if (arrivalChanged) {
          addAlert({
            reservationId: existingReservation.id,
            icalUid: importedReservation.ical_uid,
            source: importedReservation.source,
            alertType: "arrival_changed",
            affectedDate:
              existingReservation.arrival < importedReservation.arrival
                ? existingReservation.arrival
                : importedReservation.arrival,
            title: "Arrival date changed",
            message: `${selectedProperty.name}: arrival moved from ${formatDate(existingReservation.arrival)} to ${formatDate(importedReservation.arrival)}.`,
            oldArrival: existingReservation.arrival,
            newArrival: importedReservation.arrival,
            oldDeparture: existingReservation.departure,
            newDeparture: importedReservation.departure,
          });
        }

        if (departureChanged) {
          const isExtension =
            importedReservation.departure > existingReservation.departure;

          addAlert({
            reservationId: existingReservation.id,
            icalUid: importedReservation.ical_uid,
            source: importedReservation.source,
            alertType: isExtension ? "extension" : "shortened_stay",
            affectedDate: isExtension
              ? existingReservation.departure
              : importedReservation.departure,
            title: isExtension ? "Stay extended" : "Stay shortened",
            message: `${selectedProperty.name}: departure moved from ${formatDate(existingReservation.departure)} to ${formatDate(importedReservation.departure)}.`,
            oldArrival: existingReservation.arrival,
            newArrival: importedReservation.arrival,
            oldDeparture: existingReservation.departure,
            newDeparture: importedReservation.departure,
          });
        }
      }

      const latestImportedKeySet = new Set(
        importedReservations.map((reservation: any) =>
          makeCalendarKey(reservation.source, reservation.ical_uid),
        ),
      );

      const missingActiveRows = existingRowsInWindow.filter(
        (reservation: any) =>
          reservation.calendar_event_active !== false &&
          !latestImportedKeySet.has(
            makeCalendarKey(reservation.source, reservation.ical_uid),
          ),
      );

      for (const missingReservation of missingActiveRows) {
        const block = isBlockRecord(missingReservation);

        addAlert({
          reservationId: missingReservation.id,
          icalUid: missingReservation.ical_uid,
          source: missingReservation.source,
          alertType: block ? "block_removed" : "cancellation",
          affectedDate: missingReservation.departure,
          title: block ? "Calendar block removed" : "Reservation cancelled",
          message: block
            ? `${selectedProperty.name}: the ${missingReservation.source} block for ${formatDate(missingReservation.arrival)} to ${formatDate(missingReservation.departure)} disappeared from the calendar.`
            : `${selectedProperty.name}: the ${missingReservation.source} reservation for ${formatDate(missingReservation.arrival)} to ${formatDate(missingReservation.departure)} disappeared from the calendar.`,
          oldArrival: missingReservation.arrival,
          oldDeparture: missingReservation.departure,
        });
      }

      if (alerts.length > 0) {
        const { error: alertInsertError } = await supabase
          .from("schedule_change_alerts")
          .upsert(alerts, {
            onConflict: "fingerprint",
            ignoreDuplicates: true,
          });

        if (alertInsertError) {
          throw alertInsertError;
        }
      }

      const defaultCleanerId = selectedProperty.defaultCleanerId ?? "";

      const reservationRows = importedReservations.map((reservation: any) => {
        const reservationKey = makeCalendarKey(
          reservation.source,
          reservation.ical_uid,
        );
        const existingReservation = existingReservationMap.get(
          reservationKey,
        ) as any;
        const existingCleanerId = existingReservation?.cleaner_id ?? null;
        const existingAssignedUserId =
          existingReservation?.assigned_user_id ?? null;
        const existingAssignedContactId =
          existingReservation?.assigned_contact_id ?? null;
        const existingStatus = existingReservation?.status ?? null;
        const isImportedBlock = reservation.status === "Blocked";

        const cleanerId = isImportedBlock
          ? null
          : existingCleanerId || defaultCleanerId || null;

        const status = isImportedBlock
          ? "Blocked"
          : existingStatus || (cleanerId ? "Assigned" : "Unassigned");

        return {
          owner_id: user.id,
          property_id: selectedProperty.id,
          ical_uid: reservation.ical_uid,
          guest_name: reservation.guest_name,
          source: reservation.source,
          arrival: reservation.arrival,
          departure: reservation.departure,
          cleaner_id: cleanerId,
          assigned_user_id: existingAssignedUserId,
          assigned_contact_id: existingAssignedContactId,
          status,
          calendar_event_active: true,
          calendar_removed_at: null,
          last_calendar_seen_at: nowIso,
        };
      });

      if (reservationRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("reservations")
          .upsert(reservationRows, {
            onConflict: "property_id,source,ical_uid",
          });

        if (upsertError) {
          throw upsertError;
        }
      }

      if (missingActiveRows.length > 0) {
        const missingIds = missingActiveRows.map(
          (reservation: any) => reservation.id,
        );

        const { error: softRemoveError } = await supabase
          .from("reservations")
          .update({
            calendar_event_active: false,
            calendar_removed_at: nowIso,
          })
          .in("id", missingIds);

        if (softRemoveError) {
          throw softRemoveError;
        }
      }

      await loadReservationsFromSupabase();

      if (!propertyOverride) {
        alert(
          `Calendar sync complete. Imported ${importedReservations.length} current items and created ${alerts.length} schedule change alert${alerts.length === 1 ? "" : "s"}.${
            missingActiveRows.length > 0
              ? ` Preserved ${missingActiveRows.length} removed item${missingActiveRows.length === 1 ? "" : "s"} for cancellation history.`
              : ""
          }`,
        );
      }

      return importedReservations.length;
    } catch (error: any) {
      console.error("Reservation sync failed:", error);

      if (!propertyOverride) {
        alert(error.message || "Failed to sync reservations.");
        return 0;
      }

      throw error;
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }
  function startEditingProperty(home: Home) {
    setEditingPropertyId(home.id);
    setPropertyForm({
      name: home.name,
      city: home.city,
      address: home.address ?? "",
      setupMode: home.setupMode,
      vrboId: home.vrboId ?? "",
      airbnbUrl: home.airbnbUrl ?? "",
      iCalUrl: home.iCalUrl ?? "",
      defaultCleanerId: home.defaultCleanerId ?? "",
      bedrooms: String(home.bedrooms),
      bathrooms: String(home.bathrooms),
      maxGuests: String(home.maxGuests),
      notes: home.notes ?? "",
    });
    setShowPropertyForm(true);
  }

  function startLiveMode() {
    setDataMode("Live");

    setReservations([]);
    setCalendarBlocks([]);
    setWorkOrders([]);
    setNotifications([]);

    setSelectedHome("all");
    setSelectedCalendarItem(null);
    setSelectedCalendarDateKey(null);
    setSelectedWorkOrder(null);
    setEditingPropertyId(null);
    setShowPropertyForm(false);
    setDismissedDiscrepancies([]);
    setImportMessage(
      "Live Mode is active. Add your real property details to begin.",
    );
  }

  async function autoFillListing() {
    alert(
      "Auto Fill Listing is temporarily parked while Supabase property setup is being connected.",
    );
  }

  async function createLivePropertyFromSourceForm(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const propertyName = sourceForm.propertyName.trim();
    const vrboCalendarUrl = sourceForm.vrboICalUrl.trim();
    const airbnbCalendarUrl = (
      sourceForm.airbnbICalUrl || sourceForm.airbnbUrl
    ).trim();

    if (!propertyName) {
      alert("Property name is required.");
      return;
    }

    if (!vrboCalendarUrl && !airbnbCalendarUrl) {
      alert("Add at least one iCal URL before creating the live property.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("You must be logged in to create a property.");
      return;
    }

    const { error } = await supabase.from("properties").insert({
      owner_id: user.id,
      property_name: propertyName,
      market: sourceForm.market.trim(),
      vrbo_property_id: vrboCalendarUrl || null,
      airbnb_property_id: airbnbCalendarUrl || null,
      default_cleaner_id: null,
    });

    if (error) {
      console.error("Live property save failed", error);
      alert(error.message);
      return;
    }

    await loadPropertiesFromSupabase();

    setSourceForm({
      propertyName: "",
      market: "",
      vrboId: "",
      vrboICalUrl: "",
      vrboICalText: "",
      airbnbUrl: "",
      airbnbICalUrl: "",
      airbnbICalText: "",
    });

    setImportMessage(
      "Live property saved. Select it in Property Setup, confirm both calendar links are visible, then run Sync Reservations.",
    );
    setActivePage("Property Setup");
  }

  function renderDataIntegrationPanel() {
    return (
      <section className="dataIntegrationPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Data integration prep</p>
            <h3>{dataMode} Mode</h3>
            <p>
              Use Demo Mode for testing the UI. Use Live Mode when you are ready
              to clear sample data and build from VRBO IDs and iCal calendar
              links.
            </p>
          </div>

          <div className="dataModeActions">
            <button
              className="primaryButton"
              onClick={startLiveMode}
              type="button"
            >
              Start Live Mode
            </button>
          </div>
        </div>

        <p className="dataIntegrationMessage">{importMessage}</p>

        <form
          className="dataSourceForm"
          onSubmit={createLivePropertyFromSourceForm}
        >
          <label>
            Property name
            <input
              value={sourceForm.propertyName}
              onChange={(event) =>
                setSourceForm({
                  ...sourceForm,
                  propertyName: event.target.value,
                })
              }
              placeholder="Example: Beach Retreat 301"
            />
          </label>

          <label>
            Market / county
            <input
              value={sourceForm.market}
              onChange={(event) =>
                setSourceForm({ ...sourceForm, market: event.target.value })
              }
              placeholder="Okaloosa, Walton, Destin, 30A"
            />
          </label>

          <label>
            VRBO property ID
            <input
              value={sourceForm.vrboId}
              onChange={(event) =>
                setSourceForm({ ...sourceForm, vrboId: event.target.value })
              }
              placeholder="VRBO listing ID"
            />
          </label>

          <label>
            VRBO iCal URL
            <input
              value={sourceForm.vrboICalUrl}
              onChange={(event) =>
                setSourceForm({
                  ...sourceForm,
                  vrboICalUrl: event.target.value,
                })
              }
              placeholder="https://...ics"
            />
          </label>

          <label className="fullWidth">
            Paste VRBO .ics text (optional for browser-safe import)
            <textarea
              value={sourceForm.vrboICalText}
              onChange={(event) =>
                setSourceForm({
                  ...sourceForm,
                  vrboICalText: event.target.value,
                })
              }
              placeholder="Paste BEGIN:VCALENDAR... content here if the URL cannot be fetched from the browser"
            />
          </label>

          <label>
            Airbnb calendar URL backup
            <input
              value={sourceForm.airbnbUrl}
              onChange={(event) =>
                setSourceForm({ ...sourceForm, airbnbUrl: event.target.value })
              }
              placeholder="Optional backup: paste Airbnb .ics URL here too"
            />
          </label>

          <label>
            Airbnb iCal URL
            <input
              value={sourceForm.airbnbICalUrl}
              onChange={(event) =>
                setSourceForm({
                  ...sourceForm,
                  airbnbICalUrl: event.target.value,
                })
              }
              placeholder="https://...ics"
            />
          </label>

          <label className="fullWidth">
            Paste Airbnb .ics text (optional for browser-safe import)
            <textarea
              value={sourceForm.airbnbICalText}
              onChange={(event) =>
                setSourceForm({
                  ...sourceForm,
                  airbnbICalText: event.target.value,
                })
              }
              placeholder="Paste BEGIN:VCALENDAR... content here if the URL cannot be fetched from the browser"
            />
          </label>

          <button className="primaryButton" type="submit">
            Create Live Property + Import Calendars
          </button>
        </form>
      </section>
    );
  }

  async function addCleaner(cleaner: Cleaner) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setCleaners((current) => [...current, cleaner]);
      setSelectedCleanerId(cleaner.id);
      return;
    }

    const { data, error } = await supabase
      .from("cleaners")
      .insert({
        owner_id: user.id,
        name: cleaner.name,
        phone: cleaner.phone ?? "",

        status: cleaner.status ?? "Available",
      })
      .select()
      .single();

    if (error) {
      console.error("Cleaner save failed", error);
      window.alert(error.message);
      return;
    }

    const savedCleaner: Cleaner = {
      id: data.id,
      name: data.name ?? "",
      phone: data.phone ?? "",

      status: data.status ?? "Available",
      serviceArea: data.service_area ?? "",
      rating: 5,
      activeJobs: 0,
      specialties: [],
      notes: "",
    };

    setCleaners((current) => [...current, savedCleaner]);
    setSelectedCleanerId(savedCleaner.id);
  }

  async function updateCleaner(id: string, updates: Partial<Cleaner>) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const supabaseUpdates: Record<string, any> = {};

      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;

      if (updates.status !== undefined) supabaseUpdates.status = updates.status;

      const { error } = await supabase
        .from("cleaners")
        .update(supabaseUpdates)
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        console.error("Cleaner update failed", error);
        window.alert(error.message);
        return;
      }
    }

    setCleaners((current) =>
      current.map((cleaner) =>
        cleaner.id === id ? { ...cleaner, ...updates } : cleaner,
      ),
    );
  }
  async function deleteCleaner(id: string) {
    const cleaner = cleaners.find((item) => item.id === id);

    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${cleaner?.name ?? "this cleaner"}.`,
    );

    if (confirmation !== "DELETE") return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const { error } = await supabase
        .from("cleaners")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        console.error("Cleaner delete failed", error);
        window.alert(error.message);
        return;
      }
    }

    setCleaners((current) => current.filter((cleaner) => cleaner.id !== id));

    setReservations((current) =>
      current.map((reservation) =>
        reservation.cleanerId === id
          ? {
              ...reservation,
              cleanerId: undefined,
              status:
                reservation.status === "Assigned"
                  ? "Unassigned"
                  : reservation.status,
              timeline: [
                ...reservation.timeline,
                "Cleaner removed from reservation",
              ],
            }
          : reservation,
      ),
    );

    setHomes((current) =>
      current.map((home) =>
        home.defaultCleanerId === id
          ? { ...home, defaultCleanerId: undefined }
          : home,
      ),
    );

    const remaining = cleaners.filter((cleaner) => cleaner.id !== id);
    setSelectedCleanerId(remaining[0]?.id ?? "");
  }
  async function deleteWorkOrder(id: string) {
    const workOrder = workOrders.find((item) => item.id === id);

    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${workOrder?.title ?? "this work order"}.`,
    );

    if (confirmation !== "DELETE") return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const { error } = await supabase
        .from("work_orders")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        console.error("Work order delete failed", error);
        window.alert(error.message);
        return;
      }
    }

    setWorkOrders((current) => current.filter((order) => order.id !== id));

    if (selectedWorkOrder?.id === id) {
      setSelectedWorkOrder(null);
    }
  }
  async function updateReservationFromCleaner(
    id: string,
    status: ReservationStatus,
    note: string,
  ): Promise<boolean> {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              status,
              timeline: [...reservation.timeline, note],
            }
          : reservation,
      ),
    );

    const reservation = reservations.find((item) => item.id === id);
    const nextTimeline = reservation ? [...reservation.timeline, note] : [note];

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const { data, error } = await supabase
        .from("reservations")
        .update({
          status,
          timeline: nextTimeline,
        })
        .eq("id", id)
        .select("id, status")
        .maybeSingle();

      if (error) {
        console.error("Cleaner reservation update failed", error);
        window.alert(error.message);
        return false;
      }

      if (!data) {
        console.error("Cleaner reservation update matched no row", {
          id,
          status,
          authenticatedUserId: user.id,
        });
        window.alert(
          "The task changed on screen, but Supabase did not permit the reservation update. Check the reservations UPDATE policy for cleaner accounts.",
        );
        return false;
      }
    }

    if (reservation) {
      setNotifications((current) => [
        {
          id: `note-${Date.now()}`,
          type: "Cleaner",
          priority: status === "In Process" ? "High" : "Normal",
          title: `Cleaner update: ${status}`,
          message: `${reservation.guestName} was updated by the cleaner. ${note}`,
          relatedHomeId: reservation.homeId,
          relatedCleanerId: reservation.cleanerId,
          createdAt: new Date().toLocaleString(),
          read: false,
        },
        ...current,
      ]);
    }

    return true;
  }

  async function submitCleanerMaintenanceIssue(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!cleanerIssueForm.title.trim()) {
      window.alert("Please enter an issue title before submitting.");
      return;
    }

    if (!cleanerIssueForm.homeId && !cleanerIssueForm.reservationId) {
      window.alert(
        "Please select a property or related cleaning before submitting.",
      );
      return;
    }

    const reservation = reservations.find(
      (item) => item.id === cleanerIssueForm.reservationId,
    );
    const homeId = reservation?.homeId || cleanerIssueForm.homeId;
    const cleaner = cleaners.find((item) => item.id === cleanerPortalId);

    const nextWorkOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      homeId,
      title: cleanerIssueForm.title,
      category: cleanerIssueForm.category,
      urgency: cleanerIssueForm.urgency,
      status: "Owner Review",
      createdDate: toInputDate(new Date()),
      notes: `${cleanerIssueForm.notes || "No additional notes."} Reported by ${cleaner?.name ?? "Cleaner"} from the cleaner portal. Photo upload placeholder captured for future storage.`,
      timeline: [
        "Cleaner reported maintenance issue",
        reservation
          ? "Linked to cleaner reservation"
          : "Reported as general property issue",
        "Owner notification created",
        "Work order moved to owner review",
      ],
    };

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const { error } = await supabase.from("work_orders").insert({
        owner_id: user.id,
        property_id: nextWorkOrder.homeId,
        title: nextWorkOrder.title,
        category: nextWorkOrder.category,
        urgency: nextWorkOrder.urgency,
        status: nextWorkOrder.status,
        vendor_id: nextWorkOrder.vendorId ?? null,
        created_date: nextWorkOrder.createdDate,
        scheduled_date: nextWorkOrder.scheduledDate ?? null,
        notes: nextWorkOrder.notes,
        timeline: nextWorkOrder.timeline,
      });

      if (error) {
        console.error("Cleaner work order save failed", error);
        window.alert(error.message);
        return;
      }

      await loadWorkOrdersFromSupabase();
    } else {
      setWorkOrders((current) => [nextWorkOrder, ...current]);
    }

    setNotifications((current) => [
      {
        id: `note-${Date.now()}`,
        type: "Maintenance",
        priority:
          cleanerIssueForm.urgency === "After Hours" ||
          cleanerIssueForm.urgency === "High"
            ? "Critical"
            : "High",
        title: "Cleaner reported maintenance issue",
        message: `${cleaner?.name ?? "Cleaner"} reported: ${cleanerIssueForm.title}`,
        relatedHomeId: homeId,
        relatedCleanerId: cleanerPortalId,
        createdAt: new Date().toLocaleString(),
        read: false,
      },
      ...current,
    ]);

    if (reservation) {
      updateReservationFromCleaner(
        reservation.id,
        "In Process",
        `Cleaner reported maintenance issue: ${cleanerIssueForm.title}`,
      );
    }

    setCleanerIssueForm({
      reservationId: "",
      homeId: "",
      title: "",
      category: "General",
      urgency: "Medium",
      notes: "",
    });
  }

  function openInvoiceFromTask(task: any) {
    setInvoiceReturnPage(activePage);
    setInvoiceTaskDraft(task);
    setReadyInvoiceTasks([]);
    setSelectedCalendarItem(null);
    setShowOwnerMobileMenu(false);
    setActivePage("Cleaner Invoices");
  }

  function reviewReadyInvoices(tasks: any[]) {
    setInvoiceTaskDraft(null);
    setReadyInvoiceTasks(tasks);
    setSelectedCalendarItem(null);
    setShowOwnerMobileMenu(false);
    setActivePage("Cleaner Invoices");
  }

  function openCleanerInvoicesFilter(
    filter: "all" | "outstanding" | "paid" | "overdue",
  ) {
    setCleanerInvoiceInitialFilter(filter);
    setSelectedCleanerInvoiceId(null);
    setInvoiceTaskDraft(null);
    setReadyInvoiceTasks([]);
    setSelectedCalendarItem(null);
    setShowOwnerMobileMenu(false);
    setActivePage("Cleaner Invoices");
  }

  function openCleanerInvoice(
    invoiceId: string,
    filter: "all" | "outstanding" | "paid" | "overdue" = "all",
  ) {
    setInvoiceReturnPage(activePage);
    setCleanerInvoiceInitialFilter(filter);
    setSelectedCleanerInvoiceId(String(invoiceId));
    setInvoiceTaskDraft(null);
    setReadyInvoiceTasks([]);
    setSelectedCalendarItem(null);
    setShowOwnerMobileMenu(false);
    setActivePage("Cleaner Invoices");
  }

  function renderPlaceholder() {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Stable checkpoint</p>
        <h2>{activePage}</h2>
        <p>
          This module is parked for a later phase so the Task Board and Calendar
          can stay stable.
        </p>
        <button
          className="primaryButton"
          onClick={() => setActivePage("Reservations")}
        ></button>
      </section>
    );
  }

  return (
    <div
      className={`appShell ${isCleanerMode ? "cleanerAppMode" : ""}`}
      data-group-id={selectedGroupId}
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon">AMR</div>
          <div>
            <h1>{isCleanerMode ? "AMR Cleaner" : "Ask My Rentals"}</h1>
            <p>{isCleanerMode ? "Cleaner Operations" : "Owner Operations"}</p>
         
            {canSwitchGroups && onChangeGroup && (
              <button
                type="button"
                className="ghostButton"
                onClick={onChangeGroup}
                style={{
                  marginTop: 8,
                  padding: "6px 9px",
                  fontSize: 12,
                }}
              >
                My Workspaces
              </button>
            )}
          </div>
        </div>

        {!isCleanerMode && (
          <div className="propertySelector compactPropertySelector">
            <label>Active Property</label>

            <select
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="nav desktopNav">
          {(isCleanerMode
            ? [
                { label: "Pulse", page: "Cleaner Portal" },
                { label: "Schedule", page: "Cleaner Schedule" },
                { label: "Clients", page: "Cleaner Clients" },
                { label: "Properties", page: "Cleaner Properties" },
                { label: "Jobs", page: "Cleaner Jobs" },
                { label: "Invoices", page: "Cleaner Invoices" },
                { label: "Profile", page: "Cleaner Profile" },
                { label: "Workspaces", page: "Shared Workspaces" },
                { label: "More", page: "More" },
              ]
            : [
                { label: "Pulse", page: "Pulse" },
                { label: "Calendar", page: "Calendar" },
                { label: "Properties", page: "Properties" },
                { label: "Occupancy", page: "Occupancy" },
                { label: "Maintenance", page: "Maintenance" },
                { label: "More", page: "More" },
              ]
          ).map((item) => (
            <button
              key={item.label}
              className={activePage === item.page ? "active" : ""}
              onClick={() => {
                if (item.page === "More") {
                  setShowOwnerMobileMenu(true);
                  return;
                }

                if (isCleanerMode && item.page === "Cleaner Schedule") {
                  setOpenCleanerScheduleOnLoad(true);
                  setActivePage("Cleaner Schedule");
                  setShowOwnerMobileMenu(false);
                  return;
                }

                if (isCleanerMode && item.page === "Cleaner Turns") {
                  setActivePage("Cleaner Portal");
                  setShowOwnerMobileMenu(false);

                  window.setTimeout(() => {
                    document
                      .querySelector(".cleanerUpcomingCard")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  }, 50);

                  return;
                }

                if (isCleanerMode && item.page === "Create Job") {
                  window.alert("Create Job flow coming next");
                  return;
                }

                setActivePage(item.page);
                setShowOwnerMobileMenu(false);
              }}
              type="button"
            >
              {item.label}

              {!isCleanerMode &&
                item.page === "Notification Center" &&
                urgentNotificationCount > 0 && (
                  <span className="notificationBadge">
                    {urgentNotificationCount}
                  </span>
                )}
            </button>
          ))}
        </nav>
      </aside>

      {/* MOBILE HAMBURGER MENU: keep this overlay permanently paired with the More button below. */}
      {showOwnerMobileMenu && (
        <div
          className="ownerMobileMenuOverlay"
          onClick={() => setShowOwnerMobileMenu(false)}
        >
          <section
            className="ownerMobileMenuSheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ownerMobileMenuHeader">
              <div>
                <p className="eyebrow">More options</p>
                <h3>{isCleanerMode ? "Cleaner Menu" : "Owner Menu"}</h3>
              </div>
              <button
                className="ghostButton"
                type="button"
                onClick={() => setShowOwnerMobileMenu(false)}
              >
                Close
              </button>
            </div>

            <div className="ownerMobileMenuGrid">
              {(isCleanerMode
                ? [
                    { label: "Profile", page: "Cleaner Profile" },
                    {
                      label: "Shared Workspaces",
                      page: "Shared Workspaces",
                    },
                    { label: "Clients", page: "Cleaner Clients" },
                    { label: "Schedule", page: "Cleaner Schedule" },
                    { label: "Reports", page: "Cleaner Reports" },
                    { label: "Properties", page: "Cleaner Properties" },
                    { label: "Help", page: "Cleaner Help" },
                    { label: "Settings", page: "Cleaner Settings" },
                  ]
                : [
                    { label: "Records", page: "Records" },
                    { label: "Notifications", page: "Notification Center" },
                    { label: "Cleaners", page: "Cleaners" },
                    { label: "Cleaner Portal", page: "Cleaner Portal" },
                    { label: "Help Improve AMR", page: "Help Improve AMR" },
                    { label: "Settings", page: "Settings" },
                  ]
              ).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={activePage === item.page ? "active" : ""}
                  onClick={() => {
                    setActivePage(item.page);
                    setShowOwnerMobileMenu(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="ownerMobileMenuFooter">
              <button
                className="logoutButton"
                type="button"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          </section>
        </div>
      )}

      <main className="mainContent">
        {!isCleanerMode && (
          <header className="ownerMobileTopHeader">
            <div className="ownerMobileBrand">
              <div className="ownerMobileLogo">AMR</div>
            </div>

            <select
              className="ownerMobilePropertySelect"
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.name}
                </option>
              ))}
            </select>

            <button
              className="ownerMobileMenuButton"
              type="button"
              onClick={() => setShowOwnerMobileMenu((current) => !current)}
            >
              ☰
            </button>
          </header>
        )}
        {activePage === "Calendar" && renderCalendar()}
        {activePage === "Dashboard" && (
          <DashboardPage
            reservations={reservations.filter(
              (reservation) => reservation.homeId === selectedPropertyId,
            )}
            homes={homes.filter((home) => home.id === selectedPropertyId)}
            cleaners={cleaners}
            workOrders={workOrders.filter(
              (workOrder) => workOrder.homeId === selectedPropertyId,
            )}
            selectedPropertyId={selectedPropertyId}
            setActivePage={setActivePage}
            setSelectedCalendarItem={setSelectedCalendarItem}
            setSelectedItemType={setSelectedItemType}
            setSelectedStatus={setSelectedStatus}
            setSelectedHome={setSelectedHome}
            setSearch={setSearch}
            isImportedReservation={isImportedReservation}
            isTaskSource={isTaskSource}
            needsCleanerAssignment={needsCleanerAssignment}
            formatDate={formatDate}
          />
        )}
        {activePage === "Pulse" && (
          <GuestReadyPage
            reservations={reservations}
            homes={homes}
            cleaners={cleaners}
            updateReservation={updateReservation}
            workOrders={workOrders}
            calendarSyncIssues={calendarSyncIssues}
            selectedPropertyId={selectedPropertyId}
            formatDate={formatDate}
            needsCleanerAssignment={needsCleanerAssignment}
            renderScrollableCalendarStack={renderScrollableCalendarStack}
            setActivePage={setActivePage}
            setSelectedCalendarItem={setSelectedCalendarItem}
          />
        )}
        {activePage === "Reservation Detail" && (
          <ReservationDetailPage
            selectedCalendarItem={selectedCalendarItem}
            selectedCalendarDateKey={selectedCalendarDateKey}
            reservationDetailReturnPage={reservationDetailReturnPage}
            homes={homes}
            cleaners={cleaners}
            setActivePage={setActivePage}
            setSelectedCalendarItem={setSelectedCalendarItem}
            setSelectedCalendarDateKey={setSelectedCalendarDateKey}
            isImportedReservation={isImportedReservation}
            isTaskSource={isTaskSource}
            updateReservation={updateReservation}
            deleteReservation={deleteReservation}
            formatDate={formatDate}
            getSourceControlledMessage={getSourceControlledMessage}
          />
        )}
        {activePage === "Reservations" && (
          <ReservationsPage
            reservations={reservations.filter((reservation) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const departureDate = new Date(reservation.departure);

              return (
                getReservationHomeId(reservation) === selectedPropertyId &&
                departureDate >= today &&
                reservation.source !== "Maintenance"
              );
            })}
            homes={homes}
            search={search}
            setSearch={setSearch}
            cleaners={cleaners}
            createManualReservation={createManualReservation}
            selectedHome={selectedHome}
            selectedPropertyId={selectedPropertyId}
            selectedItemType={selectedItemType}
            propertyTaskStats={propertyTaskStats}
            needsCleanerAssignment={needsCleanerAssignment}
            isImportedReservation={isImportedReservation}
            isTaskSource={isTaskSource}
            updateReservation={updateReservation}
            deleteReservation={deleteReservation}
            getSourceControlledMessage={getSourceControlledMessage}
            formatDate={formatDate}
            setActivePage={setActivePage}
            setSelectedCalendarItem={setSelectedCalendarItem}
            setReservationDetailReturnPage={setReservationDetailReturnPage}
            setSelectedItemType={setSelectedItemType}
            calendarCreateDraft={calendarCreateDraft}
            clearCalendarCreateDraft={() => setCalendarCreateDraft(null)}
          />
        )}
        {(activePage === "Property Setup" || activePage === "Properties") && (
          <PropertiesPage
            homes={homes.filter((home) => home.id === selectedPropertyId)}
            cleaners={cleaners}
            reservations={reservations}
            workOrders={workOrders}
            selectedPropertyId={selectedPropertyId}
            setSelectedPropertyId={setSelectedPropertyId}
            showPropertyForm={showPropertyForm}
            setShowPropertyForm={setShowPropertyForm}
            editingPropertyId={editingPropertyId}
            setEditingPropertyId={setEditingPropertyId}
            propertyForm={propertyForm}
            setPropertyForm={setPropertyForm}
            createProperty={createProperty}
            updateProperty={updateProperty}
            archiveProperty={archiveProperty}
            deleteProperty={deleteProperty}
            startEditingProperty={startEditingProperty}
            autoFillListing={autoFillListing}
            syncReservations={async () => {
              await syncReservations();
            }}
            renderDataIntegrationPanel={renderDataIntegrationPanel}
            PropertyOperationsHub={PropertyOperationsHub}
          />
        )}
        {activePage === "Occupancy" && (
          <OccupancyPage
            reservations={reservations.filter(
              (reservation) => reservation.homeId === selectedPropertyId,
            )}
            calendarBlocks={calendarBlocks}
            homes={homes.filter((home) => home.id === selectedPropertyId)}
            dismissedDiscrepancies={dismissedDiscrepancies}
            setDismissedDiscrepancies={setDismissedDiscrepancies}
            setActivePage={setActivePage}
            isImportedReservation={isImportedReservation}
            toDate={toDate}
            getTaskDayCount={getTaskDayCount}
            getCalendarSyncIssues={getCalendarSyncIssues}
          />
        )}
        {activePage === "Cleaners" && (
          <CleanersPage
            cleaners={cleaners}
            addCleaner={addCleaner}
            reservations={reservations.filter(
              (reservation) => reservation.homeId === selectedPropertyId,
            )}

            homes={homes}
            selectedCleanerId={selectedCleanerId}
            setSelectedCleanerId={setSelectedCleanerId}
            setActivePage={setActivePage}
            updateCleaner={updateCleaner}
            deleteCleaner={deleteCleaner}
          />
        )}

        {activePage === "Housekeeping" && (
          <HousekeepingPage
            reservations={reservations.filter(
              (reservation) =>
                getReservationHomeId(reservation) === selectedPropertyId,
            )}
            homes={homes}
            cleaners={cleaners}
            selectedPropertyId={selectedPropertyId}
            updateReservation={updateReservation}
            needsCleanerAssignment={needsCleanerAssignment}
            formatDate={formatDate}
          />
        )}
        {activePage === "Cleaner Portal" && (
          <CleanerPortalPage
            cleaners={
              assignableTeamMembers.length > 0
                ? assignableTeamMembers
                : cleaners
            }
            homes={homes}
            reservations={reservations}
            cleanerPortalId={cleanerPortalId}
            selectedGroupId={selectedGroupId}
            selectedGroupRole={selectedGroupRole}
            cleanerIssueForm={cleanerIssueForm}
            setCleanerIssueForm={setCleanerIssueForm}

            updateReservation={updateReservation}
            updateReservationFromCleaner={updateReservationFromCleaner}
            submitCleanerMaintenanceIssue={submitCleanerMaintenanceIssue}
            isImportedReservation={isImportedReservation}
            getUrgency={getUrgency}
            formatDate={formatDate}
            openCleanerScheduleOnLoad={openCleanerScheduleOnLoad}
            setOpenCleanerScheduleOnLoad={setOpenCleanerScheduleOnLoad}
            onCreateInvoiceFromTask={openInvoiceFromTask}
            onReviewReadyInvoices={reviewReadyInvoices}
            onOpenInvoicesFilter={openCleanerInvoicesFilter}
            onOpenInvoice={openCleanerInvoice}
            onOpenProfile={() => setActivePage("Cleaner Profile")}
          />
        )}
        {activePage === "Cleaner Profile" && (
          <CleanerProfilePage
            selectedGroupId={selectedGroupId}
            selectedGroupName={selectedGroupName}
            selectedGroupRole={selectedGroupRole}
            onOpenProperties={() => setActivePage("Cleaner Properties")}
            onReturnToPulse={() => setActivePage("Cleaner Portal")}
            onStartBusiness={onCreateBusinessWorkspace}
          />
        )}
        {activePage === "Shared Workspaces" && (
          <SharedWorkspacesPage
            selectedGroupId={selectedGroupId}
            selectedGroupName={selectedGroupName}
            selectedGroupRole={selectedGroupRole}
            onBack={() => setActivePage("Cleaner Portal")}
          />
        )}
        {activePage === "Cleaner Schedule" && (
          <CleanerPortalPage
            cleaners={
              assignableTeamMembers.length > 0
                ? assignableTeamMembers
                : cleaners
            }
            homes={homes}
            reservations={reservations}
            cleanerPortalId={cleanerPortalId}
            selectedGroupId={selectedGroupId}
            selectedGroupRole={selectedGroupRole}
            cleanerIssueForm={cleanerIssueForm}
            setCleanerIssueForm={setCleanerIssueForm}

            updateReservation={updateReservation}
            updateReservationFromCleaner={updateReservationFromCleaner}
            submitCleanerMaintenanceIssue={submitCleanerMaintenanceIssue}
            isImportedReservation={isImportedReservation}
            getUrgency={getUrgency}
            formatDate={formatDate}
            openCleanerScheduleOnLoad={openCleanerScheduleOnLoad}
            setOpenCleanerScheduleOnLoad={setOpenCleanerScheduleOnLoad}
            onCreateInvoiceFromTask={openInvoiceFromTask}
            onReviewReadyInvoices={reviewReadyInvoices}
            onOpenInvoicesFilter={openCleanerInvoicesFilter}
            onOpenInvoice={openCleanerInvoice}
            onOpenProfile={() => setActivePage("Cleaner Profile")}
          />
        )}
        {activePage === "Cleaner Properties" && (
          <CleanerPropertiesPage
            homes={homes}
            reservations={reservations}
            cleaners={cleaners}
            clients={clients}
            onCreateClient={createCleanerClient}
            workOrders={workOrders}
            cleanerPortalId={cleanerPortalId}
            resyncCleanerPropertyCalendar={resyncCleanerPropertyCalendar}
            onCreateProperty={createCleanerProperty}
            onConnectCalendar={connectCleanerPropertyCalendar}
            onResyncCalendar={resyncCleanerPropertyCalendar}
            onUpdateProperty={updateCleanerProperty}
            onDeleteProperty={deleteCleanerProperty}
          />
        )}
        {activePage === "Cleaner Clients" && (
          <CleanerClientsPage homes={homes} />
        )}
        {activePage === "Cleaner Jobs" && (
<CleanerJobsPage
  homes={homes}
  cleaners={
    assignableTeamMembers.length > 0
      ? assignableTeamMembers
      : cleaners
  }
  selectedGroupRole={selectedGroupRole}
  onCreateInvoiceFromJob={openInvoiceFromTask}
/>
        )}
        {activePage === "Cleaner Reports" && (
          <ReportsPage homes={homes} reservations={reservations} />
        )}
        {activePage === "Cleaner Invoices" && (
          <InvoicesPage
            homes={homes}
            reservations={reservations}
            initialTask={invoiceTaskDraft}
            readyTasks={readyInvoiceTasks}
            initialStatusFilter={cleanerInvoiceInitialFilter}
            initialInvoiceId={selectedCleanerInvoiceId}
            onCloseInvoiceFlow={() => {
              setInvoiceTaskDraft(null);
              setReadyInvoiceTasks([]);
              setSelectedCleanerInvoiceId(null);
              setActivePage(invoiceReturnPage);
            }}
            onInitialTaskConsumed={() => {
              setInvoiceTaskDraft(null);
              setCleanerInvoiceInitialFilter("all");
            }}
            onInitialInvoiceConsumed={() => {
              setSelectedCleanerInvoiceId(null);
              setCleanerInvoiceInitialFilter("all");
            }}
          />
        )}
        {activePage === "Maintenance" && (
          <MaintenancePage
            workOrderFilter={workOrderFilter}
            homes={homes}
            vendors={vendors}
            selectedWorkOrder={selectedWorkOrder}
            setSelectedWorkOrder={setSelectedWorkOrder}
            workOrders={workOrders.filter(
              (workOrder) => workOrder.homeId === selectedPropertyId,
            )}
            setWorkOrderFilter={setWorkOrderFilter}
            showWorkOrderForm={showWorkOrderForm}
            setShowWorkOrderForm={setShowWorkOrderForm}
            ownerWorkOrderForm={ownerWorkOrderForm}
            setOwnerWorkOrderForm={setOwnerWorkOrderForm}
            selectedPropertyId={selectedPropertyId}
            createOwnerWorkOrder={createOwnerWorkOrder}
            updateWorkOrder={updateWorkOrder}
            deleteWorkOrder={deleteWorkOrder}
            getRecommendedVendors={getRecommendedVendors}
            formatDate={formatDate}
          />
        )}
        {activePage === "Notification Center" && (
          <NotificationCenterPage
            reservations={reservations.filter(
              (reservation) => reservation.homeId === selectedPropertyId,
            )}
            workOrders={workOrders.filter(
              (workOrder) => workOrder.homeId === selectedPropertyId,
            )}
            homes={homes.filter((home) => home.id === selectedPropertyId)}
            dismissedDiscrepancies={dismissedDiscrepancies}
            getCalendarSyncIssues={getCalendarSyncIssues}
            cleaners={cleaners}
            notifications={notifications}
            notificationFilter={notificationFilter}
            setNotificationFilter={setNotificationFilter}
            setNotifications={setNotifications}
            setActivePage={setActivePage}
            setSelectedItemType={setSelectedItemType}
            setSelectedStatus={setSelectedStatus}
            setSelectedHome={setSelectedHome}
            setSearch={setSearch}
            setSelectedWorkOrder={setSelectedWorkOrder}
            setWorkOrderFilter={setWorkOrderFilter}
            needsCleanerAssignment={needsCleanerAssignment}
            isImportedReservation={isImportedReservation}
            isTaskSource={isTaskSource}
            daysUntil={daysUntil}
            formatDate={formatDate}
          />
        )}
        {activePage === "Records" && (
          <RecordsPage
            reservations={reservations}
            workOrders={workOrders}
            homes={homes}
          />
        )}
        {!(
          [
            "Pulse",
            "Calendar",
            "Properties",
            "Property Setup",
            "Occupancy",
            "Performance",
            "Reservation Detail",
            "Maintenance",
            "Notification Center",
            "Records",
            "Help Improve AMR",
            "Settings",
            "Cleaners",
            "Cleaner Portal",
            "Cleaner Schedule",
            "Cleaner Profile",
            "Shared Workspaces",
            "Housekeeping",
            "Cleaner Properties",
            "Cleaner Clients",
            "Cleaner Jobs",
            "Cleaner Invoices",
            "Cleaner Reports",
          ] as string[]
        ).includes(activePage) && renderPlaceholder()}
      </main>
      {/* MOBILE BOTTOM NAV MUST ALWAYS BE: Home / Tasks / Calendar / More (hamburger). */}
      <nav
        className="mobileBottomNav"
        aria-label={
          isCleanerMode
            ? "Cleaner mobile bottom navigation"
            : "Owner mobile bottom navigation"
        }
      >
        {(isCleanerMode
          ? [
              { label: "Pulse", page: "Cleaner Portal", icon: "🧠" },
              { label: "Schedule", page: "Cleaner Schedule", icon: "📅" },
              { label: "Jobs", page: "Cleaner Jobs", icon: "💼" },
              { label: "Invoices", page: "Cleaner Invoices", icon: "💵" },
              { label: "More", page: "More", icon: "☰" },
            ]
          : [
              { label: "Pulse", page: "Pulse", icon: "❤️" },
              { label: "Calendar", page: "Calendar", icon: "📅" },
              { label: "Properties", page: "Properties", icon: "🏡" },
              { label: "Occupancy", page: "Occupancy", icon: "📈" },
              { label: "More", page: "More", icon: "⚙️" },
            ]
        ).map((item) => (
          <button
            key={item.label}
            className={activePage === item.page ? "active" : ""}
            onClick={() => {
              if (item.page === "More") {
                setShowOwnerMobileMenu(true);
                return;
              }

              if (isCleanerMode && item.page === "Cleaner Schedule") {
                setOpenCleanerScheduleOnLoad(true);
                setActivePage("Cleaner Schedule");
                setShowOwnerMobileMenu(false);
                return;
              }

              if (isCleanerMode && item.page === "Cleaner Turns") {
                setActivePage("Cleaner Portal");
                setShowOwnerMobileMenu(false);

                window.setTimeout(() => {
                  document
                    .querySelector(".cleanerUpcomingCard")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);

                return;
              }

              if (isCleanerMode && item.page === "Create Job") {
                window.alert("Create Job flow coming next");
                return;
              }

              if (item.page === "Maintenance") {
                setShowWorkOrderForm(false);
              }

              if (item.page === "Calendar") {
                setSelectedCalendarDateKey(null);
                setSelectedCalendarItem(null);
              }

              setActivePage(item.page);
              setShowOwnerMobileMenu(false);
            }}
            type="button"
          >
            <span className="navIconWrapper">
              <span>{item.icon}</span>

              {!isCleanerMode &&
                item.page === "Notification Center" &&
                urgentNotificationCount > 0 && (
                  <span className="notificationMiniCount">
                    {urgentNotificationCount}
                  </span>
                )}
            </span>

            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
