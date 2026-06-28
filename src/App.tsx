import GuestReadyPage from "./pages/GuestReadyPage";
import HousekeepingPage from "./pages/HousekeepingPage";
import { parseICalTextToReservations } from "./utils/calendarSync";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getMonthDays, getStackedCalendarMonths } from "./utils/calendarUtils";
import { ScrollableCalendarStack } from "./components/ScrollableCalendarStack";
import { CalendarPage } from "./pages/CalendarPage";
import ReservationsPage from "./pages/ReservationsPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
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
  | "Reservation"
  | "Mirror Block"
  | "Owner Block"
  | "Operational Task";
type BlockType = "Owner Block" | "Maintenance";

type Home = {
  id: string;
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
  status: "Active" | "Setup Needed" | "Paused";
  notes?: string;
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

type NotificationPriority = "Critical" | "High" | "Normal" | "Low";
type NotificationType = "Reservation" | "Cleaner" | "Maintenance" | "Property" | "System";

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

type WorkOrderUrgency =
  | "Low"
  | "Medium"
  | "High"
  | "After Hours";

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
  { id: "vendor-hvac", name: "Summit HVAC", category: "HVAC", phone: "555-1200", rating: 4.9, afterHours: true },
  { id: "vendor-plumb", name: "Rapid Rooter", category: "Plumbing", phone: "555-4421", rating: 4.7, afterHours: true },
  { id: "vendor-elec", name: "BrightLine Electric", category: "Electrical", phone: "555-3390", rating: 4.8, afterHours: false },
  { id: "vendor-handyman", name: "Cabin Care Pros", category: "General", phone: "555-7731", rating: 4.6, afterHours: false },
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
  const cleaner = starterCleaners.find((item: Cleaner) => item.id === cleanerId);

  if (status === "Assigned" && cleaner) return `Assigned to ${cleaner.name}`;
  if (status === "Accepted" && cleaner) return `${cleaner.name} accepted assignment`;
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
  return source === "Cleaning" || source === "Vendor Visit" || source === "Inspection";
}
function getReservationType(
  source: ReservationSource,
  status: ReservationStatus,
  guestName = ""
): ReservationType {
  const normalizedGuestName = String(guestName).toLowerCase();

  const looksLikePlatformBlock =
    normalizedGuestName.includes("block") ||
    normalizedGuestName.includes("not available") ||
    normalizedGuestName.includes("unavailable");

  if (source === "Owner Block") return "Owner Block";
  if (isTaskSource(source)) return "Operational Task";

  if (
    (source === "VRBO" || source === "Airbnb") &&
    (status === "Blocked" || looksLikePlatformBlock)
  ) {
    return "Mirror Block";
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

  return reservation.guestName;
}

function needsCleanerAssignment(reservation: Reservation) {
  if (
    reservation.type === "Mirror Block" ||
    reservation.status === "Blocked"
  ) {
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
    !reservation.cleanerId
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
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    }, 0);
}

function getSyncDateRangeLabel(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} → ${formatDate(end)}`;
}

function getCalendarSyncIssues(reservations: Reservation[], homes: Home[], dismissedIds: string[]) {
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

  const twelveMonthsFromTodayKey = toInputDate(addMonths(new Date(), 12));

  const isCalendarHealthEligible = (reservation: Reservation) => {
    if (!reservation.arrival || !reservation.departure) return false;

    // Ignore reservations that have already checked out.
    if (reservation.departure <= todayKey) return false;

    // Ignore reservations already in progress.
    // Airbnb iCal may not export the past portion of active reservations,
    // so these can create false missing-protection alerts.
    if (reservation.arrival < todayKey && reservation.departure > todayKey) return false;

    // Only evaluate today through 12 months ahead.
    if (reservation.arrival < todayKey) return false;
    if (reservation.arrival > twelveMonthsFromTodayKey) return false;

    return true;
  };

  const isOperationalReservation = (reservation: Reservation) => {
    if (reservation.type === "Mirror Block") return false;
    if (reservation.status === "Blocked") return false;
    if (isTaskSource(reservation.source)) return false;

    return (
      reservation.type === "Reservation" ||
      reservation.type === "Owner Block"
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
      Math.round((toDate(dateA).getTime() - toDate(dateB).getTime()) / 86400000)
    );
  };

  const addRangeToSet = (set: Set<string>, start: string, end: string) => {
    getNightKeys(start, end).forEach((night) => set.add(night));
  };

  const issues: CalendarSyncIssue[] = [];

  homes.forEach((home) => {
    const propertyHealthItems = healthReservations.filter(
      (reservation) => reservation.homeId === home.id
    );

    const platformItems = propertyHealthItems.filter(
      (reservation) => reservation.source === "VRBO" || reservation.source === "Airbnb"
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
            if (!vrboNightSource.has(night)) vrboNightSource.set(night, reservation);
          }

          if (reservation.source === "Airbnb") {
            airbnbNights.add(night);
            if (!airbnbNightSource.has(night)) airbnbNightSource.set(night, reservation);
          }
        });
      });

      const vrboRanges = getDateRangesFromNights([...vrboNights]);
      const airbnbRanges = getDateRangesFromNights([...airbnbNights]);

      vrboRanges.forEach((vrboRange) => {
        airbnbRanges.forEach((airbnbRange) => {
          const startsClose = getDayDifference(vrboRange.start, airbnbRange.start) <= 1;
          const endsClose = getDayDifference(vrboRange.end, airbnbRange.end) <= 1;

          if (startsClose && endsClose) {
            const mergedStart =
              vrboRange.start < airbnbRange.start ? vrboRange.start : airbnbRange.start;
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
        sourceMap: Map<string, Reservation>
      ) => {
        if (missingNights.length === 0) return;

        const ranges = getDateRangesFromNights(missingNights);

        ranges.forEach((range) => {
          const dateRange = getSyncDateRangeLabel(range.start, range.end);
          const primaryReservation =
            sourceMap.get(range.start) ||
            missingNights
              .map((night) => sourceMap.get(night))
              .find(Boolean);

          if (!primaryReservation) return;

          const overlapsReservationAlreadyInProgress = reservations.some((reservation) => {
            if (reservation.homeId !== home.id) return false;
            if (reservation.source !== "VRBO" && reservation.source !== "Airbnb") return false;

            return (
              reservation.arrival < todayKey &&
              reservation.departure > todayKey &&
              reservation.arrival < range.end &&
              reservation.departure > range.start
            );
          });

          if (overlapsReservationAlreadyInProgress) return;

          const itemLabel =
            primaryReservation.type === "Mirror Block" ? "blocked dates" : "reservation";

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
        vrboNightSource
      );

      createIssue(
        "Airbnb",
        "VRBO",
        [...airbnbNights].filter((night) => !vrboNights.has(night)),
        airbnbNightSource
      );
    }

    // Cleaner not assigned checks use all future property reservations, not just platform imports.
    propertyHealthItems.forEach((reservation) => {
      if (!needsCleanerAssignment(reservation)) return;

      const issueId = `cleaner-not-assigned-${reservation.id}`;

      issues.push({
        id: issueId,
        property: home.name ?? "Unknown property",
        dateRange: getSyncDateRangeLabel(reservation.arrival, reservation.departure),
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
        dateRange: getSyncDateRangeLabel(reservation.arrival, reservation.departure),
        message: `Cleaner has not accepted the upcoming clean for ${reservation.guestName}.`,
        severity: "High",
        status: dismissedIds.includes(issueId) ? "Dismissed" : "Open",
        primaryReservation: reservation,
        overlappingReservation: reservation,
      });
    });

    // Reservation Conflict Detection.
    const operationalReservations = propertyHealthItems.filter(isOperationalReservation);

    for (let i = 0; i < operationalReservations.length; i++) {
      for (let j = i + 1; j < operationalReservations.length; j++) {
        const first = operationalReservations[i];
        const second = operationalReservations[j];

        const overlaps =
          first.arrival < second.departure &&
          first.departure > second.arrival;

        if (!overlaps) continue;

        const issueId = `reservation-conflict-${first.id}-${second.id}`;

        issues.push({
          id: issueId,
          property: home.name ?? "Unknown property",
          dateRange: getSyncDateRangeLabel(
            first.arrival < second.arrival ? first.arrival : second.arrival,
            first.departure > second.departure
              ? first.departure
              : second.departure
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
  return reservation.homeId ?? reservation.propertyId ?? reservation.property_id ?? "";
}










export default function App() 
{
  const [activePage, setActivePage] = useState("Dashboard");
  const [showOwnerMobileMenu, setShowOwnerMobileMenu] = useState(false);
  const [homes, setHomes] = useState<Home[]>([]);
 const [cleaners, setCleaners] = useState<Cleaner[]>(starterCleaners);
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
  new Date(today.getFullYear(), today.getMonth() - 1, 1)
);
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<Reservation | CalendarBlock | null>(null);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);
  const [reservationDetailReturnPage, setReservationDetailReturnPage] = useState("Dashboard");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [workOrderFilter, setWorkOrderFilter] = useState("all");
 const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
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
  const [selectedCleanerId, setSelectedCleanerId] = useState(starterCleaners[0]?.id ?? "");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [dismissedDiscrepancies, setDismissedDiscrepancies] = useState<string[]>([]);
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
  const [importMessage, setImportMessage] = useState("Demo data is active. Switch to Live Mode when you are ready to start from real VRBO/iCal sources.");
  const [cleanerPortalId, setCleanerPortalId] = useState(starterCleaners[0]?.id ?? "");
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

  
  const [saveStatus] = useState("Connected to Supabase");
  useEffect(() => {
  loadPropertiesFromSupabase();
  loadReservationsFromSupabase();
  loadWorkOrdersFromSupabase();
  loadCleanersFromSupabase();
}, []);


const urgentNotificationCount =
  workOrders.filter(
    (order) =>
      order.homeId === selectedPropertyId &&
      (order.urgency === "High" || order.urgency === "After Hours") &&
      order.status !== "Completed"
  ).length;
const propertyTaskStats = useMemo(() => {
  const propertyTasks = reservations.filter((item) => isTaskSource(item.source));
  const openTasks = propertyTasks.filter((item) => item.status !== "Completed");
  const cleaningTasksNeedingCleaner = propertyTasks.filter((item) => needsCleanerAssignment(item));
  const upcomingTasks = propertyTasks.filter((item) => item.arrival >= toInputDate(new Date()));

  
  return {
    total: propertyTasks.length,
    open: openTasks.length,
    needCleaner: cleaningTasksNeedingCleaner.length,
    upcoming: upcomingTasks.length,
  };
}, [reservations]);



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
      overlapsExistingReservation.arrival
    )} → ${formatDate(
      overlapsExistingReservation.departure
    )}\n\nDo you still want to create it anyway?`
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
    cleanerId ? makeTimelineNote("Assigned", cleanerId) : "No cleaner assigned",
  ];

  const { error } = await supabase
    .from("reservations")
    .insert({
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
    })
    

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

      const nextCleaner =
  "cleanerId" in updates ? updates.cleanerId : reservation.cleanerId;

const nextStatus =
  "cleanerId" in updates && !updates.cleanerId
    ? "Unassigned"
    : updates.status ?? reservation.status;

      const shouldAddTimeline =
        updates.status !== undefined || "cleanerId" in updates;

      updatedReservation = {
        ...reservation,
        ...updates,
        cleanerId: nextCleaner,
        timeline: shouldAddTimeline
          ? [...reservation.timeline, makeTimelineNote(nextStatus, nextCleaner)]
          : reservation.timeline,
      };

      return updatedReservation;
    })
  );

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (user) {
    const supabaseUpdates: Record<string, any> = {};

    if ("cleanerId" in updates) {
      supabaseUpdates.cleaner_id = updates.cleanerId ?? null;
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
  const reservationToDelete = reservations.find((reservation) => reservation.id === id);

  if (!reservationToDelete) return;

  if (reservationToDelete.source === "VRBO" || reservationToDelete.source === "Airbnb") {
    window.alert(getSourceControlledMessage(reservationToDelete.source));
    return;
  }

  const confirmation = window.confirm(
    `Delete ${reservationToDelete.guestName}? This cannot be undone.`
  );

  if (!confirmation) return;

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Reservation delete failed", error);
    window.alert(error.message);
    return;
  }

  setReservations((current) => current.filter((reservation) => reservation.id !== id));
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
        isDateInRange(date, block.start, block.end)
    );

    const importedReservations = dayReservations.filter((reservation) => isImportedReservation(reservation));
    const propertyTasks = dayReservations.filter((reservation) => isTaskSource(reservation.source));
    const arrivals = importedReservations.filter((reservation) => isSameDay(date, reservation.arrival));
    const departures = importedReservations.filter((reservation) => isSameDay(date, reservation.departure));
    const hasTrueBackToBack = arrivals.some((arrival) =>
      departures.some(
        (departure) =>
          departure.id !== arrival.id &&
          departure.homeId === arrival.homeId
      )
    );

    return {
      dayReservations,
      dayBlocks,
      propertyTasks,
      isB2B: hasTrueBackToBack,
      hasTasks: propertyTasks.length > 0,
      hasConflict:
  dayBlocks.some((block) =>
    importedReservations.some((reservation) => reservation.homeId === block.homeId)
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
     <ScrollableCalendarStack
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
      })
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
      .filter((vendor) => vendor.category === category || vendor.category === "General")
      .filter((vendor) => urgency !== "After Hours" || vendor.afterHours)
      .sort((a, b) => b.rating - a.rating);
  }

  async function createOwnerWorkOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedWorkOrderHomeId = ownerWorkOrderForm.homeId || selectedPropertyId || homes[0]?.id || "";
    const workOrderTitle = ownerWorkOrderForm.title.trim();

    if (!selectedWorkOrderHomeId) {
      window.alert("Please create or select a property before creating a work order.");
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

    const selectedVendor = vendors.find((vendor) => vendor.id === ownerWorkOrderForm.vendorId);
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
        notes: ownerWorkOrderForm.notes || "Owner-created maintenance work order.",
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
          ownerWorkOrderForm.urgency === "After Hours" || ownerWorkOrderForm.urgency === "High"
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

  const mappedHomes: Home[] = (data ?? []).map((property: any) => ({
    id: property.id,
    name: property.property_name ?? "Unnamed Property",
    city: property.market ?? "",
    shortName: (property.property_name ?? "HM")
      .split(" ")
      .map((word: string) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    address: "",
    setupMode: "VRBO",
    vrboId: property.vrbo_listing_id ?? "",
    airbnbUrl:
      property.airbnb_ical_url ??
      property.airbnb_calendar_url ??
      property.airbnb_property_id ??
      "",
    iCalUrl:
      property.vrbo_ical_url ??
      property.vrbo_calendar_url ??
      property.vrbo_property_id ??
      "",
    defaultCleanerId: property.default_cleaner_id ?? "",
    bedrooms: 0,
    bathrooms: 0,
    maxGuests: 0,
    status: "Active",
    notes: "",
    
  }));

  setHomes(mappedHomes);

if (mappedHomes.length > 0) {
  setSelectedPropertyId((currentSelectedPropertyId) => {
    const stillExists = mappedHomes.some((home) => home.id === currentSelectedPropertyId);
    return stillExists ? currentSelectedPropertyId : mappedHomes[0].id;
  });
}
}
async function loadReservationsFromSupabase() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) return;

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("owner_id", user.id)
    .order("arrival", { ascending: true });

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
    type: getReservationType(source, status, item.guest_name),
    arrival: item.arrival,
    departure: item.departure,
    status,
    cleanerId: item.cleaner_id ?? undefined,
    notes: item.notes ?? "",
    timeline: Array.isArray(item.timeline) ? item.timeline : [],
  };
});
console.table(
  mappedReservations
    .filter(
      (r) =>
        r.arrival.startsWith("2026-08") ||
        r.departure.startsWith("2026-08")
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
          86400000
      ),
    }))
);
  setReservations(mappedReservations);
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

  if (mappedCleaners.length > 0) {
    setSelectedCleanerId(mappedCleaners[0].id);
    setCleanerPortalId(mappedCleaners[0].id);
  }
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
    vrbo_property_id: propertyForm.iCalUrl || null,
airbnb_property_id: propertyForm.airbnbUrl || null,
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
    `Type DELETE to permanently remove ${property?.name ?? "this property"} and its reservations.`
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

  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id);

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
  
async function syncReservations() {
  try {
    if (!selectedPropertyId) {
      alert("Please select a property first.");
      return;
    }

    const selectedProperty = homes.find((home) => home.id === selectedPropertyId);

    if (!selectedProperty) {
      alert("Selected property not found.");
      return;
    }

    if (!selectedProperty.iCalUrl && !selectedProperty.airbnbUrl) {
      alert("This property does not have any calendar links yet.");
      return;
    }

    let importedReservations: any[] = [];

    if (selectedProperty.iCalUrl) {
      const vrboResponse = await fetch("http://localhost:4000/api/fetch-ical", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: selectedProperty.iCalUrl,
          source: "VRBO",
        }),
      });

      const vrboResult = await vrboResponse.json();

      if (!vrboResponse.ok) {
        throw new Error(vrboResult.error || "Failed to fetch VRBO calendar");
      }

      const vrboReservations = parseICalTextToReservations(
        vrboResult.icalText,
        selectedProperty.id,
        "VRBO"
      );

      importedReservations = [...importedReservations, ...vrboReservations];
    }

    if (selectedProperty.airbnbUrl) {
      const airbnbResponse = await fetch("http://localhost:4000/api/fetch-ical", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: selectedProperty.airbnbUrl,
          source: "Airbnb",
        }),
      });

      const airbnbResult = await airbnbResponse.json();

      if (!airbnbResponse.ok) {
        throw new Error(airbnbResult.error || "Failed to fetch Airbnb calendar");
      }

      const airbnbReservations = parseICalTextToReservations(
        airbnbResult.icalText,
        selectedProperty.id,
        "Airbnb"
      );

      console.log("PARSED AIRBNB NOVEMBER BLOCKS");
      console.table(
        airbnbReservations
          .filter(
            (reservation: any) =>
              reservation.arrival.startsWith("2026-08") ||
              reservation.departure.startsWith("2026-08")
          )
          .map((reservation: any) => ({
            guest_name: reservation.guest_name,
            source: reservation.source,
            status: reservation.status,
            arrival: reservation.arrival,
            departure: reservation.departure,
          }))
      );

      importedReservations = [...importedReservations, ...airbnbReservations];
    }

    console.log("ALL IMPORTED NOVEMBER ITEMS");
    console.table(
      importedReservations
        .filter(
          (reservation: any) =>
            reservation.arrival.startsWith("2026-08") ||
            reservation.departure.startsWith("2026-08")
        )
        .map((reservation: any) => ({
          guest_name: reservation.guest_name,
          source: reservation.source,
          status: reservation.status,
          arrival: reservation.arrival,
          departure: reservation.departure,
            ical_uid: reservation.ical_uid, 
        }))
    );
const importWindowStart = toInputDate(new Date());

const importWindowEndDate = new Date();
importWindowEndDate.setMonth(importWindowEndDate.getMonth() + 12);
const importWindowEnd = toInputDate(importWindowEndDate);

importedReservations = importedReservations.filter(
  (reservation: any) =>
    reservation.departure >= importWindowStart &&
    reservation.arrival <= importWindowEnd
);

importedReservations = importedReservations.filter((reservation: any) => {
  const duplicateOneNightBlock = importedReservations.some((other: any) => {
    if (other === reservation) return false;

    return (
      reservation.source === other.source &&
      reservation.status === "Blocked" &&
      other.status === "Blocked" &&
      reservation.arrival === other.departure &&
      reservation.departure > reservation.arrival
    );
    
  });

  return !duplicateOneNightBlock;
});
importedReservations = importedReservations.filter((reservation: any) => {
  const isOneNightBlock =
    reservation.status === "Blocked" &&
    reservation.source === "VRBO" &&
    Math.round(
      (new Date(reservation.departure).getTime() -
        new Date(reservation.arrival).getTime()) /
        86400000
    ) === 1;

  const attachedToLongerVrboBlock = importedReservations.some((other: any) => {
    if (other === reservation) return false;

    return (
      other.source === "VRBO" &&
      other.status === "Blocked" &&
      other.arrival < other.departure &&
      reservation.arrival === other.departure
    );
  });

  return !(isOneNightBlock && attachedToLongerVrboBlock);
});
if (!importedReservations.length) {
  alert("No reservations found in the calendars.");
  return;
}
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      throw new Error("You must be logged in to sync reservations.");
    }

    const defaultCleanerId = selectedProperty.defaultCleanerId ?? "";
    const importedUids = importedReservations
      .map((reservation: any) => reservation.ical_uid)
      .filter(Boolean);

    const { data: existingReservationRows, error: existingReservationError } =
      await supabase
        .from("reservations")
        .select("id, property_id, source, ical_uid, cleaner_id, status")
        .eq("owner_id", user.id)
        .eq("property_id", selectedProperty.id)
        .in("ical_uid", importedUids);

    if (existingReservationError) {
      throw existingReservationError;
    }

    const existingReservationMap = new Map(
      (existingReservationRows ?? []).map((reservation: any) => [
        `${reservation.property_id}-${reservation.source}-${reservation.ical_uid}`,
        reservation,
      ])
    );

    const reservationRows = importedReservations.map((reservation: any) => {
      const reservationKey = `${selectedProperty.id}-${reservation.source}-${reservation.ical_uid}`;
      const existingReservation = existingReservationMap.get(reservationKey);
      const existingCleanerId = existingReservation?.cleaner_id ?? null;
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
        status,
      };
    });

    const { error: upsertError } = await supabase
      .from("reservations")
      .upsert(reservationRows, {
        onConflict: "property_id,source,ical_uid",
      });

    if (upsertError) {
      throw upsertError;
    }

    const { data: allExistingImportedRows, error: allExistingImportedError } =
      await supabase
        .from("reservations")
        .select("id, source, ical_uid")
        .eq("owner_id", user.id)
        .eq("property_id", selectedProperty.id)
        .not("ical_uid", "is", null);

    if (allExistingImportedError) {
      throw allExistingImportedError;
    }

    const latestImportedUidSet = new Set(
      importedReservations
        .filter((reservation: any) => reservation.ical_uid)
        .map((reservation: any) => `${reservation.source}-${reservation.ical_uid}`)
    );

    const staleReservationIds = (allExistingImportedRows ?? [])
      .filter((reservation: any) => {
        const existingKey = `${reservation.source}-${reservation.ical_uid}`;
        return !latestImportedUidSet.has(existingKey);
      })
      .map((reservation: any) => reservation.id);

    if (staleReservationIds.length > 0) {
      const { error: staleDeleteError } = await supabase
        .from("reservations")
        .delete()
        .in("id", staleReservationIds);

      if (staleDeleteError) {
        throw staleDeleteError;
      }
    }

    alert(
      `Imported ${importedReservations.length} reservations successfully.${
        staleReservationIds.length > 0
          ? ` Removed ${staleReservationIds.length} stale reservations.`
          : ""
      }`
    );

    window.location.reload();
  } catch (error: any) {
    console.error("Reservation sync failed:", error);
    alert(error.message || "Failed to sync reservations.");
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
  setImportMessage("Live Mode is active. Add your real property details to begin.");
}

async function autoFillListing() {
  alert("Auto Fill Listing is temporarily parked while Supabase property setup is being connected.");
}

async function createLivePropertyFromSourceForm(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const propertyName = sourceForm.propertyName.trim();
  const vrboCalendarUrl = sourceForm.vrboICalUrl.trim();
  const airbnbCalendarUrl = (sourceForm.airbnbICalUrl || sourceForm.airbnbUrl).trim();

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

  setImportMessage("Live property saved. Select it in Property Setup, confirm both calendar links are visible, then run Sync Reservations.");
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
              Use Demo Mode for testing the UI. Use Live Mode when you are ready to clear sample data and build from VRBO IDs and iCal calendar links.
            </p>
          </div>

          <div className="dataModeActions">
            
            <button className="primaryButton" onClick={startLiveMode} type="button">
              Start Live Mode
            </button>
          </div>
        </div>

        <p className="dataIntegrationMessage">{importMessage}</p>

        <form className="dataSourceForm" onSubmit={createLivePropertyFromSourceForm}>
  <label>
            Property name
            <input
              value={sourceForm.propertyName}
              onChange={(event) => setSourceForm({ ...sourceForm, propertyName: event.target.value })}
              placeholder="Example: Beach Retreat 301"
            />
          </label>

          <label>
            Market / county
            <input
              value={sourceForm.market}
              onChange={(event) => setSourceForm({ ...sourceForm, market: event.target.value })}
              placeholder="Okaloosa, Walton, Destin, 30A"
            />
          </label>

          <label>
            VRBO property ID
            <input
              value={sourceForm.vrboId}
              onChange={(event) => setSourceForm({ ...sourceForm, vrboId: event.target.value })}
              placeholder="VRBO listing ID"
            />
          </label>

          <label>
            VRBO iCal URL
            <input
              value={sourceForm.vrboICalUrl}
              onChange={(event) => setSourceForm({ ...sourceForm, vrboICalUrl: event.target.value })}
              placeholder="https://...ics"
            />
          </label>

          <label className="fullWidth">
            Paste VRBO .ics text (optional for browser-safe import)
            <textarea
              value={sourceForm.vrboICalText}
              onChange={(event) => setSourceForm({ ...sourceForm, vrboICalText: event.target.value })}
              placeholder="Paste BEGIN:VCALENDAR... content here if the URL cannot be fetched from the browser"
            />
          </label>

          <label>
            Airbnb calendar URL backup
            <input
              value={sourceForm.airbnbUrl}
              onChange={(event) => setSourceForm({ ...sourceForm, airbnbUrl: event.target.value })}
              placeholder="Optional backup: paste Airbnb .ics URL here too"
            />
          </label>

          <label>
            Airbnb iCal URL
            <input
              value={sourceForm.airbnbICalUrl}
              onChange={(event) => setSourceForm({ ...sourceForm, airbnbICalUrl: event.target.value })}
              placeholder="https://...ics"
            />
          </label>

          <label className="fullWidth">
            Paste Airbnb .ics text (optional for browser-safe import)
            <textarea
              value={sourceForm.airbnbICalText}
              onChange={(event) => setSourceForm({ ...sourceForm, airbnbICalText: event.target.value })}
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
    current.map((cleaner) => (cleaner.id === id ? { ...cleaner, ...updates } : cleaner))
  );
}
async function deleteCleaner(id: string) {
  const cleaner = cleaners.find((item) => item.id === id);

  const confirmation = window.prompt(
    `Type DELETE to permanently remove ${cleaner?.name ?? "this cleaner"}.`
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
            status: reservation.status === "Assigned" ? "Unassigned" : reservation.status,
            timeline: [...reservation.timeline, "Cleaner removed from reservation"],
          }
        : reservation
    )
  );

  setHomes((current) =>
    current.map((home) =>
      home.defaultCleanerId === id ? { ...home, defaultCleanerId: undefined } : home
    )
  );

  const remaining = cleaners.filter((cleaner) => cleaner.id !== id);
  setSelectedCleanerId(remaining[0]?.id ?? "");
}
async function deleteWorkOrder(id: string) {
  const workOrder = workOrders.find((item) => item.id === id);

  const confirmation = window.prompt(
    `Type DELETE to permanently remove ${workOrder?.title ?? "this work order"}.`
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
  note: string
) {
  setReservations((current) =>
    current.map((reservation) =>
      reservation.id === id
        ? {
            ...reservation,
            status,
            timeline: [...reservation.timeline, note],
          }
        : reservation
    )
  );

  const reservation = reservations.find((item) => item.id === id);
  const nextTimeline = reservation ? [...reservation.timeline, note] : [note];

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (user) {
    const { error } = await supabase
      .from("reservations")
      .update({
        status,
        timeline: nextTimeline,
      })
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Cleaner reservation update failed", error);
      window.alert(error.message);
      return;
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
}

async function submitCleanerMaintenanceIssue(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!cleanerIssueForm.title.trim()) {
    window.alert("Please enter an issue title before submitting.");
    return;
  }

  if (!cleanerIssueForm.homeId && !cleanerIssueForm.reservationId) {
    window.alert("Please select a property or related cleaning before submitting.");
    return;
  }

  const reservation = reservations.find((item) => item.id === cleanerIssueForm.reservationId);
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
      reservation ? "Linked to cleaner reservation" : "Reported as general property issue",
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
      priority: cleanerIssueForm.urgency === "After Hours" || cleanerIssueForm.urgency === "High" ? "Critical" : "High",
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
      `Cleaner reported maintenance issue: ${cleanerIssueForm.title}`
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
   
  
  function renderPlaceholder() {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Stable checkpoint</p>
        <h2>{activePage}</h2>
        <p>
          This module is parked for a later phase so the Task Board and Calendar can stay stable.
        </p>
        <button className="primaryButton" onClick={() => setActivePage("Reservations")}>
          
        </button>
      </section>
    );
  }

  return (
   <div className={`appShell ${activePage === "Cleaner Portal" ? "cleanerAppMode" : ""}`}>
  <aside className="sidebar">
    <div className="brand">
          <div className="brandIcon">AMR</div>
          <div>
            <h1>Ask My Rentals</h1>
            <p>Owner Operations</p>
            <small className="saveStatus">{saveStatus}</small>
          </div>
        </div>


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
<nav className="nav desktopNav"></nav>
        <nav className="nav desktopNav">
          {["Dashboard", "Reservations", "Calendar", "Property Setup", "Occupancy", "Cleaners", "Cleaner Portal", "Maintenance", "Notification Center", "Records", ].map(
            (item) => (
             <button
  key={item}
  className={activePage === item ? "active" : ""}
  onClick={() => {
    setActivePage(item);
    setShowOwnerMobileMenu(false);
  }}
>
  {item}

  {item === "Notification Center" &&
    urgentNotificationCount > 0 && (
      <span className="notificationBadge">
        {urgentNotificationCount}
      </span>
    )}
</button>
            )
          )}
        </nav>

        
      </aside>

      {/* MOBILE HAMBURGER MENU: keep this overlay permanently paired with the More button below. */}
      {showOwnerMobileMenu && (
        <div className="ownerMobileMenuOverlay" onClick={() => setShowOwnerMobileMenu(false)}>
          <section className="ownerMobileMenuSheet" onClick={(event) => event.stopPropagation()}>
            <div className="ownerMobileMenuHeader">
              <div>
                <p className="eyebrow">More options</p>
                <h3>Owner Menu</h3>
              </div>
              <button className="ghostButton" type="button" onClick={() => setShowOwnerMobileMenu(false)}>
                Close
              </button>
            </div>

            <div className="ownerMobileMenuGrid">
              {[
                "Property Setup",
                "Occupancy",
                "Maintenance",
                "Cleaners",
                "Cleaner Portal",
                "Records",
                "Messages",
                "Settings",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activePage === item ? "active" : ""}
                  onClick={() => {
                    setActivePage(item);
                    setShowOwnerMobileMenu(false);
                  }}
                >
                  {item === "Notification Center" ? "Notifications" : item}
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
        {activePage !== "Cleaner Portal" && (
  <header className="ownerMobileTopHeader">
    <div className="ownerMobileLogo">AMR</div>

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
  {activePage !== "Cleaner Portal" && (
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
  reservations={reservations.filter((reservation) => reservation.homeId === selectedPropertyId)}
  homes={homes.filter((home) => home.id === selectedPropertyId)}
  cleaners={cleaners}
  workOrders={workOrders.filter((workOrder) => workOrder.homeId === selectedPropertyId)}
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
{activePage === "Guest Ready" && (
  <GuestReadyPage
    reservations={reservations.filter(
      (reservation) => getReservationHomeId(reservation) === selectedPropertyId
    )}
    homes={homes}
    cleaners={cleaners}
    workOrders={workOrders.filter(
      (workOrder) => workOrder.homeId === selectedPropertyId
    )}
    selectedPropertyId={selectedPropertyId}
    formatDate={formatDate}
    needsCleanerAssignment={needsCleanerAssignment}
  />
)}
       {activePage === "Reservation Detail" && (
  <ReservationDetailPage
    reservationDetailReturnPage={reservationDetailReturnPage}
    selectedCalendarItem={selectedCalendarItem}
    homes={homes}
    selectedCalendarDateKey={selectedCalendarDateKey}
setSelectedCalendarItem={setSelectedCalendarItem}
setSelectedCalendarDateKey={setSelectedCalendarDateKey}
formatDate={formatDate}
getSourceControlledMessage={getSourceControlledMessage}
    cleaners={cleaners}
    setActivePage={setActivePage}
    isImportedReservation={isImportedReservation}
    isTaskSource={isTaskSource}
    updateReservation={updateReservation}
    deleteReservation={deleteReservation}
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
  />
)}
        {activePage === "Property Setup" && (
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
  syncReservations={syncReservations}
  renderDataIntegrationPanel={renderDataIntegrationPanel}
  PropertyOperationsHub={PropertyOperationsHub}
/>
)}
        {activePage === "Occupancy" && (
<OccupancyPage
  reservations={reservations.filter((reservation) => reservation.homeId === selectedPropertyId)}
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
  (reservation) => reservation.homeId === selectedPropertyId
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
        getReservationHomeId(reservation) === selectedPropertyId
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
  cleaners={cleaners}
  homes={homes}
  reservations={reservations}
  cleanerPortalId={cleanerPortalId}
  setCleanerPortalId={setCleanerPortalId}
  cleanerIssueForm={cleanerIssueForm}
  setCleanerIssueForm={setCleanerIssueForm}
  
  updateReservation={updateReservation}
  updateReservationFromCleaner={updateReservationFromCleaner}
  submitCleanerMaintenanceIssue={submitCleanerMaintenanceIssue}
  isImportedReservation={isImportedReservation}
  getUrgency={getUrgency}
  formatDate={formatDate}
  toInputDate={toInputDate}
/>
)}
        {activePage === "Maintenance" && (
  <MaintenancePage
  workOrderFilter={workOrderFilter}
    homes={homes}
    vendors={vendors}
    selectedWorkOrder={selectedWorkOrder}
    setSelectedWorkOrder={setSelectedWorkOrder}
    workOrders={workOrders.filter((workOrder) => workOrder.homeId === selectedPropertyId)}
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
  reservations={reservations.filter((reservation) => reservation.homeId === selectedPropertyId)}
  workOrders={workOrders.filter((workOrder) => workOrder.homeId === selectedPropertyId)}
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
        {![
  "Dashboard",
  "Reservations",
  "Calendar",
  "Property Setup",
  "Occupancy",
  "Reservation Detail",
  "Cleaners",
  "Housekeeping",
  "Cleaner Portal",
  "Maintenance",
  "Notification Center",
  "Records",
  "Guest Ready",
].includes(activePage) && renderPlaceholder()}
      </main>
      {/* MOBILE BOTTOM NAV MUST ALWAYS BE: Home / Tasks / Calendar / More (hamburger). */}
      <nav className="mobileBottomNav" aria-label="Owner mobile bottom navigation">
  {[
    { label: "Home", page: "Dashboard", icon: "🏠" },
{ label: "Reservations", page: "Reservations", icon: "🧾" },
{ label: "Calendar", page: "Calendar", icon: "📅" },
{ label: "Notifications", page: "Notification Center", icon: "🔔" },
  ].map((item) => (
    <button
            key={item.label}
            className={activePage === item.page ? "active" : ""}
            onClick={() => {
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

  {item.page === "Notification Center" &&
    urgentNotificationCount > 0 && (
      <span className="notificationMiniCount">
        {urgentNotificationCount}
      </span>
    )}
</span>

<small>{item.label}</small>
          </button>
        ))}

        <button
          type="button"
          className={showOwnerMobileMenu ? "active" : ""}
          onClick={() => setShowOwnerMobileMenu((current) => !current)}
        >
          <span>☰</span>
          <small>More</small>
        </button>
      </nav>
    </div>
  );
}
