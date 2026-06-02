import { useEffect, useMemo, useState } from "react";
import "./App.css";
import PropertyOperationsHub from "./components/PropertyOperationsHub";
import { supabase } from "./utils/supabase";
type ReservationStatus =
  | "Unassigned"
  | "Assigned"
  | "Accepted"
  | "In Process"
  | "Completed";

type ReservationSource = "VRBO" | "Airbnb" | "Manual" | "Owner Block";

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
  setupMode: "Manual" | "VRBO" | "Airbnb";
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





const statusOrder: ReservationStatus[] = [
  "Unassigned",
  "Assigned",
  "Accepted",
  "In Process",
  "Completed",
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

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = startDay - 1; i >= 0; i -= 1) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ date: new Date(year, month, day), inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    days.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }

  return days;
}

function isDateInRange(date: Date, start: string, end: string) {
  const target = toInputDate(date);
  return target >= start && target <= end;
}

function isSameDay(date: Date, dateString: string) {
  return toInputDate(date) === dateString;
}

function doDateRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && endA >= startB;
}

function getReservationConflictCount(candidate: Pick<Reservation, "homeId" | "arrival" | "departure">, reservations: Reservation[]) {
  return reservations.filter(
    (reservation) =>
      reservation.homeId === candidate.homeId &&
      doDateRangesOverlap(candidate.arrival, candidate.departure, reservation.arrival, reservation.departure)
  ).length;
}

function getDateAvailabilityClass(
  date: Date,
  homeId: string,
  reservations: Reservation[],
  calendarBlocks: CalendarBlock[]
) {
  const dateKey = toInputDate(date);
  const reservationHits = reservations.filter(
    (reservation) => reservation.homeId === homeId && dateKey >= reservation.arrival && dateKey <= reservation.departure
  );
  const blockHits = calendarBlocks.filter(
    (block) => block.homeId === homeId && dateKey >= block.start && dateKey <= block.end
  );

  const hasReservation = reservationHits.some((reservation) => reservation.source !== "Owner Block");
  const hasOwnerBlock = reservationHits.some((reservation) => reservation.source === "Owner Block") ||
    blockHits.some((block) => block.type === "Owner Block");
  const hasMaintenance = blockHits.some((block) => block.type === "Maintenance");
  const hasConflict = reservationHits.length + blockHits.length > 1;

  if (hasConflict) return "previewConflict";
  if (hasMaintenance) return "previewMaintenance";
  if (hasOwnerBlock) return "previewOwnerBlock";
  if (hasReservation) return "previewReservation";
  return "previewOpen";
}

function isImportedReservation(reservation: Reservation) {
  return reservation.source === "VRBO" || reservation.source === "Airbnb";
}

function getSourceControlledMessage(source: ReservationSource) {
  return `Imported from ${source}. To change or remove this reservation, update it in ${source} and re-sync.`;
}

function unfoldICalLines(icalText: string) {
  return icalText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function getICalValue(lines: string[], field: string) {
  const line = lines.find((item) => item.startsWith(`${field}:`) || item.startsWith(`${field};`));
  if (!line) return "";
  const colonIndex = line.indexOf(":");
  return colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : "";
}

function parseICalDate(value: string) {
  if (!value) return "";
  const cleanValue = value.trim();
  const datePart = cleanValue.includes("T") ? cleanValue.split("T")[0] : cleanValue.slice(0, 8);

  if (datePart.length !== 8) return "";

  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
}

function cleanICalText(value: string) {
  return value
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseICalReservations(icalText: string, homeId: string, source: Extract<ReservationSource, "VRBO" | "Airbnb">) {
  const lines = unfoldICalLines(icalText);
  const reservations: Reservation[] = [];
  let currentEvent: string[] = [];
  let insideEvent = false;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      insideEvent = true;
      currentEvent = [];
      return;
    }

    if (line === "END:VEVENT") {
      const uid = getICalValue(currentEvent, "UID") || `${source}-${homeId}-${reservations.length}`;
      const summary = cleanICalText(getICalValue(currentEvent, "SUMMARY")) || `${source} Reservation`;
      const arrival = parseICalDate(getICalValue(currentEvent, "DTSTART"));
      const departure = parseICalDate(getICalValue(currentEvent, "DTEND"));
      const description = cleanICalText(getICalValue(currentEvent, "DESCRIPTION"));

      if (arrival && departure) {
        reservations.push({
          id: `${source.toLowerCase()}-${homeId}-${uid}`.replace(/[^a-zA-Z0-9-_]/g, "-"),
          guestName: summary,
          homeId,
          source,
          arrival,
          departure,
          status: "Unassigned",
          notes: description ? `Imported calendar note: ${description}` : "",
          timeline: [`Imported from ${source} iCal`],
        });
      }

      insideEvent = false;
      currentEvent = [];
      return;
    }

    if (insideEvent) currentEvent.push(line);
  });

  return reservations;
}
function mergeImportedReservations(reservations: Reservation[]) {
  const merged: Reservation[] = [];

  reservations.forEach((reservation) => {
    const existing = merged.find((item) => {
      const sameHome = item.homeId === reservation.homeId;

      const sameArrival =
        item.arrival === reservation.arrival;

      const sameDeparture =
        item.departure === reservation.departure;

      const guestA = item.guestName
        .replace(/reserved|blocked|reservation/gi, "")
        .trim()
        .toLowerCase();

      const guestB = reservation.guestName
        .replace(/reserved|blocked|reservation/gi, "")
        .trim()
        .toLowerCase();

      const similarGuest =
        guestA &&
        guestB &&
        (guestA.includes(guestB) || guestB.includes(guestA));

      return sameHome && sameArrival && sameDeparture && similarGuest;
    });

    if (existing) {
     
        existing.source === reservation.source
          ? existing.source
          : "Merged";

      existing.notes = [
        existing.notes,
        reservation.notes,
      ]
        .filter(Boolean)
        .join(" | ");

      existing.timeline = [
        ...(existing.timeline ?? []),
        `Merged ${reservation.source} calendar match`,
      ];
    } else {
      merged.push({ ...reservation });
    }
  });

  return merged;
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
  const [selectedHome, setSelectedHome] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedCalendarHome, setSelectedCalendarHome] = useState("all");
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 4, 1));
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<Reservation | CalendarBlock | null>(null);
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
  const [manualForm, setManualForm] = useState({
    guestName: "",
    homeId: homes[0]?.id ?? "",
    source: "Manual" as ReservationSource,
    arrival: "",
    departure: "",
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
}, []);

 
<button
  className="ghostButton"
  type="button"
  onClick={handleLogout}
>
  Log Out
</button>
 

  const filteredReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        const home = homes.find((item) => item.id === reservation.homeId);
        const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
        const combined = `${reservation.guestName} ${home?.name ?? ""} ${cleaner?.name ?? ""} ${reservation.source}`.toLowerCase();

        if (selectedHome !== "all" && reservation.homeId !== selectedHome) return false;
        if (
  selectedStatus !== "all" &&
  !(
    reservation.status === selectedStatus ||
    (selectedStatus === "Unassigned" && !reservation.cleanerId)
  )
) {
  return false;
}
        if (search.trim() && !combined.includes(search.trim().toLowerCase())) return false;

        return true;
      })
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
  }, [reservations, search, selectedHome, selectedStatus]);

const boardStats = useMemo(() => {
  return {
    total: reservations.length,
    unassigned: reservations.filter((item) => item.status === "Unassigned" || !item.cleanerId).length,
    inProcess: reservations.filter((item) => item.status === "In Process").length,
    completed: reservations.filter((item) => item.status === "Completed").length,
  };
}, [reservations]);

 

  
  

  function updateReservation(id: string, updates: Partial<Reservation>) {
    setReservations((current) =>
      current.map((reservation) => {
        if (reservation.id !== id) return reservation;

        const nextStatus = updates.status ?? reservation.status;
        const nextCleaner = updates.cleanerId ?? reservation.cleanerId;
        const shouldAddTimeline = updates.status || updates.cleanerId;

        return {
          ...reservation,
          ...updates,
          timeline: shouldAddTimeline
            ? [...reservation.timeline, makeTimelineNote(nextStatus, nextCleaner)]
            : reservation.timeline,
        };
      })
    );
  }

  function deleteReservation(id: string) {
    const reservationToDelete = reservations.find((reservation) => reservation.id === id);

    if (reservationToDelete && isImportedReservation(reservationToDelete)) {
      window.alert(getSourceControlledMessage(reservationToDelete.source));
      return;
    }

    setReservations((current) => current.filter((reservation) => reservation.id !== id));
    if (selectedCalendarItem && "guestName" in selectedCalendarItem && selectedCalendarItem.id === id) {
      setSelectedCalendarItem(null);
    }
  }

  function createManualReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manualForm.guestName || !manualForm.arrival || !manualForm.departure) return;

    const conflictCount = getReservationConflictCount(
      {
        homeId: manualForm.homeId,
        arrival: manualForm.arrival,
        departure: manualForm.departure,
      },
      reservations
    );
    const home = homes.find((item) => item.id === manualForm.homeId);
    const conflictNote = conflictCount > 0
      ? `Conflict warning: overlaps ${conflictCount} existing reservation/block for ${home?.name ?? "this home"}.`
      : "";

    const nextReservation: Reservation = {
      id: `res-${Date.now()}`,
      guestName: manualForm.guestName,
      homeId: manualForm.homeId,
      source: manualForm.source,
      arrival: manualForm.arrival,
      departure: manualForm.departure,
     status: conflictCount > 0 ? "In Process" : "Unassigned",
      notes: [manualForm.notes, conflictNote].filter(Boolean).join("\\n"),
      timeline: conflictCount > 0
        ? ["Manual reservation created", conflictNote, "Saved with conflict for owner review"]
        : ["Manual reservation created"],
    };

    setReservations((current) => [nextReservation, ...current]);

    if (conflictCount > 0) {
      setNotifications((current) => [
        {
          id: `note-${Date.now()}`,
          type: "Reservation",
          priority: "High",
          title: "Calendar conflict saved",
          message: `${manualForm.guestName} overlaps ${conflictCount} existing reservation/block on ${home?.name ?? "this home"}.`,
          relatedHomeId: manualForm.homeId,
          createdAt: new Date().toLocaleString(),
          read: false,
        },
        ...current,
      ]);
    }

    setManualForm({
      guestName: "",
      homeId: homes[0]?.id ?? "",
      source: "Manual",
      arrival: "",
      departure: "",
      notes: "",
    });
    setShowManualForm(false);
  }

  function getStackedCalendarMonths(anchorDate: Date, count = 12) {
    const anchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);

    return Array.from({ length: count }, (_item, index) => new Date(anchor.getFullYear(), anchor.getMonth() + index, 1));
  }

  function getCalendarDayData(date: Date, homeFilter: string) {
    const dayReservations = reservations.filter(
      (reservation) =>
        (homeFilter === "all" || reservation.homeId === homeFilter) &&
        isDateInRange(date, reservation.arrival, reservation.departure)
    );

    const dayBlocks = calendarBlocks.filter(
      (block) =>
        (homeFilter === "all" || block.homeId === homeFilter) &&
        isDateInRange(date, block.start, block.end)
    );

    const arrivals = dayReservations.filter((reservation) => isSameDay(date, reservation.arrival));
    const departures = dayReservations.filter((reservation) => isSameDay(date, reservation.departure));
    

    return {
      dayReservations,
      dayBlocks,
      isB2B: arrivals.length > 0 && departures.length > 0,
      hasConflict:
  dayBlocks.some((block) =>
    dayReservations.some((reservation) => reservation.homeId === block.homeId)
  ),
    };
  }

  function renderScrollableCalendarStack(options?: { homeFilter?: string; anchorDate?: Date; monthCount?: number; compact?: boolean }) {
    const homeFilter = options?.homeFilter ?? "all";
    const anchorDate = options?.anchorDate ?? calendarDate;
    const monthCount = options?.monthCount ?? 12;
    const months = getStackedCalendarMonths(anchorDate, monthCount);

    return (
      <div className={`stackedCalendarScroller ${options?.compact ? "compactStackedCalendar" : ""}`}>
        {months.map((monthDate) => {
          const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());

          return (
            <section className="stackedMonthCard" key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}>
              <div className="stackedMonthHeader">
                <h3>
                  {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
                </h3>
              </div>

              <div className="stackedWeekdayGrid">
                {[
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ].map((day) => (
                  <span key={`${monthDate.toISOString()}-${day}`}>{day}</span>
                ))}
              </div>

              <div className="stackedCalendarGrid">
                {monthDays.map((day) => {
                  const dateKey = toInputDate(day.date);
                  const { dayReservations, dayBlocks, isB2B, hasConflict } = getCalendarDayData(day.date, homeFilter);
                  const visibleReservationEvents = dayReservations.slice(0, options?.compact ? 2 : 4);
                  const visibleBlockEvents = dayBlocks.slice(0, Math.max(0, (options?.compact ? 3 : 5) - visibleReservationEvents.length));
                  const hiddenEventCount = Math.max(
                    0,
                    dayReservations.length + dayBlocks.length - visibleReservationEvents.length - visibleBlockEvents.length
                  );

                  return (
                    <div className={`stackedCalendarDay ${day.inMonth ? "" : "mutedDay"}`} key={`stacked-${dateKey}`}>
                      <div className="dayTop">
                        <span>{day.date.getDate()}</span>
                        <div className="dayBadges">
                          {isB2B && <strong className="b2bBadge">B2B</strong>}
                          {hasConflict && <strong className="conflictBadge">Conflict</strong>}
                        </div>
                      </div>

                      <div className="dayEvents">
                        {visibleReservationEvents.map((reservation) => {
                          const home = homes.find((item) => item.id === reservation.homeId);
                          const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);

                          return (
                            <button
                              type="button"
                              key={`${dateKey}-${reservation.id}`}
                             className={`calendarEvent stackedCalendarEvent ${reservation.source.toLowerCase()}`}
                            onClick={() => {
  
  setSelectedCalendarItem(reservation);
}}
                              title={`${reservation.guestName} · ${home?.name ?? ""}`}
                            >
                              <span>{home?.shortName ? `${home.shortName} · ${reservation.guestName}` : reservation.guestName}</span>
                              <small>{cleaner?.name ?? reservation.source}</small>
                            </button>
                          );
                        })}

                        {visibleBlockEvents.map((block) => (
                          <button
                            type="button"
                            key={`${dateKey}-${block.id}`}
                            className={`calendarEvent block${block.type.replace(/\s/g, "")}`}
                            onClick={() => setSelectedCalendarItem(block)}
                            title={block.title}
                          >
                            <span>{block.title}</span>
                            <small>{block.type}</small>
                          </button>
                        ))}

                        {hiddenEventCount > 0 && <p className="moreEvents">+{hiddenEventCount} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }


  function renderReservationBoard() {
    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Phase 1</p>
            <h2>Reservations</h2>
            <p className="headerSubtext">
              Track stays, cleaner assignments, turnover status, manual reservations, and owner review items.
            </p>
          </div>

          <button className="primaryButton" onClick={() => setShowManualForm(true)}>
            + Add Manual Reservation
          </button>
        </header>

        <section className="statsGrid">
          <div className="statCard">
            <span>Total reservations</span>
            <strong>{boardStats.total}</strong>
          </div>
          <div className="statCard">
            <span>Unassigned</span>
            <strong>{boardStats.unassigned}</strong>
          </div>
          <div className="statCard">
            <span>Ready</span>
            <strong>{boardStats.inProcess}</strong>
          </div>
          <div className="statCard warning">
            <span>In Process</span>
            <strong>{boardStats.completed}</strong>
          </div>
        </section>

        <section className="filtersPanel">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guest, home, cleaner, or source"
          />

          <select value={selectedHome} onChange={(event) => setSelectedHome(event.target.value)}>
            <option value="all">All homes</option>
            {homes.map((home) => (
              <option key={home.id} value={home.id}>
                {home.name}
              </option>
            ))}
          </select>

          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statusOrder.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </section>

        {renderManualForm()}

        <section className="operationsCalendarPanel">
          <div className="panelHeader compact">
            <div>
              <p className="eyebrow">Operations calendar</p>
              <h3>Scrollable Reservation Calendar</h3>
              <p className="mutedText">Scroll through upcoming months without clicking next. Use the filters above to focus this calendar by property.</p>
            </div>
          </div>
         <div className="taskBoardCalendarBox">
  {renderScrollableCalendarStack({
    homeFilter: selectedHome,
    anchorDate: new Date(),
    monthCount: 12,
    compact: true,
  })}
</div>
        </section>

        <section className="reservationGrid">
         {filteredReservations.map((reservation) => {
            const home = homes.find((item) => item.id === reservation.homeId);
            const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
            const urgency = getUrgency(reservation.arrival);

            return (
              <article className="reservationCard" key={reservation.id}>
                <div className="cardTop">
                  <div className="homeBadge">{home?.shortName ?? "HM"}</div>
                  <div>
                    <h3>{home?.name ?? "Imported reservation"}</h3>
                    <p>
  {reservation.source === "Owner Block"
    ? "Owner Block"
    : reservation.source === "Manual"
      ? home?.name ?? "Unknown property"
      : "Imported reservation"}
</p>
                  </div>
                  <span className={`urgencyBadge ${urgency.className}`}>{urgency.label}</span>
                </div>

                <div className="reservationMeta">
                  <div>
                    <span>Arrival</span>
                    <strong>{formatDate(reservation.arrival)}</strong>
                  </div>
                  <div>
                    <span>Departure</span>
                    <strong>{formatDate(reservation.departure)}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{reservation.source}</strong>
                  </div>
                </div>

                <div className="assignmentRow">
                  <label>
                    Cleaner
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
                      {statusOrder.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="statusRail">
                  {statusOrder.map((status) => (
                    <span
                      key={status}
                      className={statusOrder.indexOf(status) <= statusOrder.indexOf(reservation.status) ? "done" : ""}
                    />
                  ))}
                </div>

                <label className="cleanerReminderField">
                  Cleaner Reminder / Notes
                  <textarea
                    value={reservation.notes ?? ""}
                    onChange={(event) =>
                      updateReservation(reservation.id, {
                        notes: event.target.value,
                      })
                    }
                    placeholder="Add cleaner instructions, reminders, parking notes, supply notes, or guest-specific details"
                  />
                </label>

                {isImportedReservation(reservation) && (
                  <p className="sourceControlledNotice">
                    {getSourceControlledMessage(reservation.source)}
                  </p>
                )}

                <div className="timeline">
                  <h4>Timeline</h4>
                  {reservation.timeline.map((item, index) => (
                    <div key={`${reservation.id}-${item}-${index}`} className="timelineItem">
                      <span />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>

                <div className="cardActions">
                  <button
                    onClick={() =>
                      updateReservation(reservation.id, {
                        status: reservation.status === "In Process" ?"Completed" : "In Process",
                      })
                    }
                  >
                    {reservation.status === "In Process" ? "Mark Ready" : "In Process"}
                  </button>
                  <button onClick={() => updateReservation(reservation.id, { status: "Completed" })}>Complete</button>
                  {isImportedReservation(reservation) ? (
                    <button className="disabledButton" disabled title={getSourceControlledMessage(reservation.source)}>
                      Source Controlled
                    </button>
                  ) : (
                    <button className="dangerButton" onClick={() => deleteReservation(reservation.id)}>
                      Delete
                    </button>
                  )}
                </div>

                <div className="cleanerFooter">
                  <span>Cleaner status</span>
                  <strong>{cleaner ? `${cleaner.name} · ${cleaner.status}` : "No cleaner assigned"}</strong>
                </div>
              </article>
            );
        })}

{filteredReservations.length === 0 && (
  <div className="emptyState">
    No reservations match your current filters.
  </div>
)}
        </section>
      </>
    );
  }

  function renderManualForm() {
    if (!showManualForm) return null;

    const selectedPreviewHome = homes.find((home) => home.id === manualForm.homeId);
    const selectedDateRangeActive = Boolean(manualForm.arrival && manualForm.departure);
    const selectedConflictCount = selectedDateRangeActive
      ? getReservationConflictCount(
          {
            homeId: manualForm.homeId,
            arrival: manualForm.arrival,
            departure: manualForm.departure,
          },
          reservations
        )
      : 0;

    const currentMonthAnchor = manualForm.arrival ? toDate(manualForm.arrival) : new Date();
    currentMonthAnchor.setDate(1);
    currentMonthAnchor.setHours(12, 0, 0, 0);

    const availabilityMonths = Array.from({ length: 6 }, (_item, index) => {
      const monthDate = new Date(currentMonthAnchor.getFullYear(), currentMonthAnchor.getMonth() + index, 1);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        days: getMonthDays(monthDate.getFullYear(), monthDate.getMonth()),
      };
    });

    function handleAvailabilityDateClick(dateKey: string) {
      if (!manualForm.arrival || (manualForm.arrival && manualForm.departure)) {
        setManualForm({ ...manualForm, arrival: dateKey, departure: "" });
        return;
      }

      if (dateKey < manualForm.arrival) {
        setManualForm({ ...manualForm, arrival: dateKey, departure: manualForm.arrival });
        return;
      }

      setManualForm({ ...manualForm, departure: dateKey });
    }

    return (
      <section className="manualPanel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Manual add</p>
            <h3>Add Reservation / Deep Clean</h3>
          </div>
          <button className="ghostButton" onClick={() => setShowManualForm(false)}>
            Close
          </button>
        </div>

        <form className="manualForm" onSubmit={createManualReservation}>
          <label>
            Reservation name
            <input
              value={manualForm.guestName}
              onChange={(event) => setManualForm({ ...manualForm, guestName: event.target.value })}
              placeholder="Guest name, deep clean, owner block"
            />
          </label>

          <label>
            Home
            <select value={manualForm.homeId} onChange={(event) => setManualForm({ ...manualForm, homeId: event.target.value })}>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select
              value={manualForm.source}
              onChange={(event) => setManualForm({ ...manualForm, source: event.target.value as ReservationSource })}
            >
              <option value="Manual">Manual</option>
              <option value="Owner Block">Owner Block</option>
            </select>
          </label>

          <label>
            Arrival date
            <input
              type="date"
              value={manualForm.arrival}
              onChange={(event) =>
                setManualForm({
                  ...manualForm,
                  arrival: event.target.value,
                  departure: manualForm.departure && event.target.value > manualForm.departure ? event.target.value : manualForm.departure,
                })
              }
            />
          </label>

          <label>
            Departure date
            <input
              type="date"
              value={manualForm.departure}
              onChange={(event) => setManualForm({ ...manualForm, departure: event.target.value })}
              min={manualForm.arrival || undefined}
            />
          </label>

          <div className="availabilityPreview fullWidth largeAvailabilityCalendar">
            <div className="availabilityPreviewHeader">
              <div>
                <p className="eyebrow">Availability calendar</p>
                <h4>{selectedPreviewHome ? selectedPreviewHome.name : "Select a home"}</h4>
                <p className="mutedText">Scroll down to future months. Click once for the start date, then click again for the end date.</p>
              </div>
              {selectedConflictCount > 0 && (
                <span className="conflictWarningPill">{selectedConflictCount} conflict{selectedConflictCount === 1 ? "" : "s"}</span>
              )}
            </div>

            <div className="availabilityLegend">
              <span><i className="legendReservation" /> Reservation</span>
              <span><i className="legendOwner" /> Owner block</span>
              <span><i className="legendMaintenance" /> Maintenance</span>
              <span><i className="legendConflict" /> Conflict</span>
              <span><i className="legendSelected" /> Selected range</span>
            </div>

            <div className="availabilityMonthScroller">
              {availabilityMonths.map((month) => (
                <section className="availabilityMonth" key={month.key}>
                  <h5>{month.label}</h5>
                  <div className="availabilityWeekdays">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                      <span key={`${month.key}-${day}-${index}`}>{day}</span>
                    ))}
                  </div>

                  <div className="availabilityGrid">
                    {month.days.map((day) => {
                      const dateKey = toInputDate(day.date);
                      const availabilityClass = getDateAvailabilityClass(day.date, manualForm.homeId, reservations, calendarBlocks);
                      const isSelectedRange = selectedDateRangeActive && dateKey >= manualForm.arrival && dateKey <= manualForm.departure;

                      return (
                        <button
                          type="button"
                          key={`preview-${dateKey}`}
                          className={`availabilityDay ${day.inMonth ? "" : "mutedPreviewDay"} ${availabilityClass} ${isSelectedRange ? "selectedPreviewRange" : ""}`}
                          onClick={() => handleAvailabilityDateClick(dateKey)}
                          title={dateKey}
                        >
                          {day.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {manualForm.arrival && manualForm.departure && (
              <p className={selectedConflictCount > 0 ? "conflictWarningBox" : "sourceControlledNotice"}>
                Selected range: {formatDate(manualForm.arrival)} → {formatDate(manualForm.departure)}
                {selectedConflictCount > 0 ? ` · overlaps ${selectedConflictCount} existing item${selectedConflictCount === 1 ? "" : "s"}` : " · no conflicts found"}
              </p>
            )}
          </div>

          <label className="fullWidth">
            Notes
            <textarea
              value={manualForm.notes}
              onChange={(event) => setManualForm({ ...manualForm, notes: event.target.value })}
              placeholder="Deep clean notes, supply needs, guest requests, maintenance flags"
            />
          </label>

          <button className="primaryButton" type="submit">
            Save Reservation
          </button>
        </form>
      </section>
    );
  }

  function renderCalendar() {
    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Phase 2</p>
            <h2>Calendar</h2>
            <p className="headerSubtext">
              See every reservation source in one scrollable operations calendar: VRBO, Airbnb, manual reservations, owner blocks, maintenance blocks, conflicts, and cleaner visibility.
            </p>
          </div>

          <div className="calendarHeaderActions">
            <button className="ghostButton" onClick={() => setCalendarDate(new Date())}>
              Jump to Current Month
            </button>
          </div>
        </header>

        <section className="calendarToolbar">
          <div>
            <span>Calendar</span>
            <strong>Compact reservation calendar</strong>
          </div>

          <label>
            Property
            <select value={selectedCalendarHome} onChange={(event) => setSelectedCalendarHome(event.target.value)}>
              <option value="all">All homes</option>
              {homes.map((home) => (
                <option key={home.id} value={home.id}>
                  {home.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="calendarLayout">
          <div className="calendarPanel stackedCalendarPanel">
           <div className="taskBoardCalendarBox calendarPageCalendarBox">
  {renderScrollableCalendarStack({
    homeFilter: selectedCalendarHome,
    anchorDate: calendarDate,
    monthCount: 12,
    compact: true,
  })}
</div>
          </div>

         <aside className="calendarDetailPanel" id="calendarDetailPanel">
            <p className="eyebrow">Selected item</p>
          {selectedCalendarItem ? (
  <>
    <h3>
      {"guestName" in selectedCalendarItem
        ? selectedCalendarItem.guestName
        : selectedCalendarItem.title}
    </h3>

    <p className="mutedText">
      {"guestName" in selectedCalendarItem
        ? homes.find((home) => home.id === selectedCalendarItem.homeId)?.name
        : selectedCalendarItem.type}
    </p>

    {"guestName" in selectedCalendarItem && (
      <div className="detailStack">
        <div>
          <span>Arrival</span>
          <strong>{formatDate(selectedCalendarItem.arrival)}</strong>
        </div>

        <div>
          <span>Departure</span>
          <strong>{formatDate(selectedCalendarItem.departure)}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{selectedCalendarItem.status}</strong>
        </div>
      </div>
    )}
  </>
) : (
  <>
    <h3>Click a reservation or block</h3>
    <p className="mutedText">
      Details will show here without leaving the calendar.
    </p>
  </>
)}  
          </aside>
        </section>
      </>
    );
  }


  function updateWorkOrder(id: string, updates: Partial<WorkOrder>) {
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

        if (selectedWorkOrder?.id === id) {
          setSelectedWorkOrder(updatedOrder);
        }

        return updatedOrder;
      })
    );
  }

  function getRecommendedVendors(category: string, urgency: WorkOrderUrgency) {
    return vendors
      .filter((vendor) => vendor.category === category || vendor.category === "General")
      .filter((vendor) => urgency !== "After Hours" || vendor.afterHours)
      .sort((a, b) => b.rating - a.rating);
  }

  function createOwnerWorkOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ownerWorkOrderForm.homeId || !ownerWorkOrderForm.title.trim()) return;

    const selectedVendor = vendors.find((vendor) => vendor.id === ownerWorkOrderForm.vendorId);
    const nextWorkOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      homeId: ownerWorkOrderForm.homeId,
      title: ownerWorkOrderForm.title.trim(),
      category: ownerWorkOrderForm.category,
      urgency: ownerWorkOrderForm.urgency,
      status: ownerWorkOrderForm.vendorId ? "Assigned" : "New",
      vendorId: ownerWorkOrderForm.vendorId || undefined,
      createdDate: toInputDate(new Date()),
      scheduledDate: ownerWorkOrderForm.scheduledDate || undefined,
      notes: ownerWorkOrderForm.notes || "Owner-created maintenance work order.",
      timeline: [
        "Owner created work order",
        ownerWorkOrderForm.vendorId
          ? `Vendor assigned: ${selectedVendor?.name ?? "Vendor"}`
          : "No vendor assigned yet",
        ownerWorkOrderForm.scheduledDate
          ? `Scheduled for ${formatDate(ownerWorkOrderForm.scheduledDate)}`
          : "Schedule pending",
      ],
    };

    setWorkOrders((current) => [nextWorkOrder, ...current]);
    setSelectedWorkOrder(nextWorkOrder);
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
    vrboId: property.vrbo_property_id ?? "",
    airbnbUrl: property.airbnb_property_id ?? "",
    iCalUrl: "",
    defaultCleanerId: undefined,
    bedrooms: 0,
    bathrooms: 0,
    maxGuests: 0,
    status: "Active",
    notes: "",
  }));

  setHomes(mappedHomes);

  if (mappedHomes.length > 0) {
    setSelectedPropertyId(mappedHomes[0].id);
  }
}
  async function createProperty(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!propertyForm.name.trim() || !propertyForm.city.trim()) return;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    alert("You must be logged in to create a property.");
    return;
  }

  const { error } = await supabase.from("properties").insert({
    owner_id: user.id,
    property_name: propertyForm.name.trim(),
    market: propertyForm.city.trim(),
    vrbo_property_id: propertyForm.vrboId || null,
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
  const { error } = await supabase
    .from("properties")
    .update({
      property_name: updates.name,
      market: updates.city,
      vrbo_property_id: updates.vrboId || null,
      airbnb_property_id: updates.airbnbUrl || null,
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
    `Type DELETE to permanently remove ${property?.name ?? "this property"}.`
  );

  if (confirmation !== "DELETE") return;

  const { data, error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    console.error("Property delete failed", error);
    alert(error.message);
    return;
  }

  console.log("Deleted property rows:", data);

  if (!data || data.length === 0) {
    alert("No property was deleted. The app may be using a property ID that does not match Supabase.");
    return;
  }

  await loadPropertiesFromSupabase();

  setSelectedPropertyId("");
  setEditingPropertyId(null);
  setShowPropertyForm(false);
}
  async function createLivePropertyShell(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!sourceForm.propertyName.trim() && !sourceForm.vrboId.trim()) return;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    alert("You must be logged in to create a property.");
    return;
  }

  const name = sourceForm.propertyName.trim() || `VRBO ${sourceForm.vrboId.trim()}`;

  const { data: savedProperty, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      property_name: name,
      market: sourceForm.market.trim() || "Market pending",
      vrbo_property_id: sourceForm.vrboId || null,
      airbnb_property_id: sourceForm.airbnbUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Live property save failed", error);
    alert(error.message);
    return;
  }

  const nextHomeId = savedProperty.id;
  const importedReservations: Reservation[] = [];
  const importWarnings: string[] = [];

  async function getCalendarText(url: string, pastedText: string, source: "VRBO" | "Airbnb") {
    if (pastedText.trim()) return pastedText;
    if (!url.trim()) return "";

    try {
      const response = await fetch("http://localhost:4000/api/fetch-ical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), source }),
      });

      if (!response.ok) throw new Error(`Backend calendar request failed with ${response.status}`);

      const data = await response.json();
      if (!data.icalText) throw new Error("Backend did not return calendar text");

      return data.icalText as string;
    } catch {
      importWarnings.push(`${source} calendar URL could not be fetched. Paste the raw .ics text if needed.`);
      return "";
    }
  }

  const vrboText = await getCalendarText(sourceForm.vrboICalUrl, sourceForm.vrboICalText, "VRBO");
  const airbnbText = await getCalendarText(sourceForm.airbnbICalUrl, sourceForm.airbnbICalText, "Airbnb");

  const todayKey = toInputDate(new Date());

  if (vrboText.trim()) {
    importedReservations.push(
      ...parseICalReservations(vrboText, nextHomeId, "VRBO").filter(
        (reservation) => reservation.departure >= todayKey
      )
    );
  }

  if (airbnbText.trim()) {
    importedReservations.push(
      ...parseICalReservations(airbnbText, nextHomeId, "Airbnb").filter(
        (reservation) => reservation.departure >= todayKey
      )
    );
  }

  setDataMode("Live");

  await loadPropertiesFromSupabase();

  setReservations((current) =>
    mergeImportedReservations([...importedReservations, ...current])
  );

  setSelectedPropertyId(nextHomeId);
  setSelectedCalendarHome(nextHomeId);
  setSelectedHome("all");

  const importedCount = importedReservations.length;
  const warningText = importWarnings.length ? ` ${importWarnings.join(" ")}` : "";

  setImportMessage(
    importedCount > 0
      ? `Live property saved to Supabase and ${importedCount} current/future reservations imported.${warningText}`
      : `Live property saved to Supabase. No current/future reservations were imported.${warningText}`
  );

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
  setSelectedCalendarHome("all");
  setSelectedCalendarItem(null);
  setSelectedWorkOrder(null);
  setEditingPropertyId(null);
  setShowPropertyForm(false);
  setDismissedDiscrepancies([]);
  setImportMessage("Live Mode is active. Add your real property details to begin.");
}

async function autoFillListing() {
  alert("Auto Fill Listing is temporarily parked while Supabase property setup is being connected.");
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

        <form className="dataSourceForm" onSubmit={createLivePropertyShell}>
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
            Airbnb listing URL
            <input
              value={sourceForm.airbnbUrl}
              onChange={(event) => setSourceForm({ ...sourceForm, airbnbUrl: event.target.value })}
              placeholder="https://airbnb.com/rooms/..."
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

  function renderProperties() {
    const selectedProperty = homes.find((home) => home.id === selectedPropertyId) ?? homes[0];
    const selectedReservations = selectedProperty
      ? reservations.filter((reservation) => reservation.homeId === selectedProperty.id)
      : [];
    const selectedWorkOrders = selectedProperty
      ? workOrders.filter((order) => order.homeId === selectedProperty.id)
      : [];
    const activeHomes = homes.filter((home) => home.status === "Active").length;
    const setupNeeded = homes.filter((home) => home.status === "Setup Needed").length;

    if (showPropertyForm && editingPropertyId) {
      const editingProperty = homes.find((home) => home.id === editingPropertyId);

      return (
        <>
          <header className="pageHeader">
            <div>
              <p className="eyebrow">Edit home profile</p>
              <h2>{editingProperty?.name ?? "Edit Property"}</h2>
              <p className="headerSubtext">
                Update the full home profile, listing details, cleaner assignment, capacity, and property notes.
              </p>
            </div>

            <button
              className="ghostButton"
              onClick={() => {
                setEditingPropertyId(null);
                setShowPropertyForm(false);
              }}
            >
              ← Back to Properties
            </button>
          </header>

          <section className="manualPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Property editor</p>
                <h3>Edit Property Details</h3>
              </div>
            </div>

            <form
              className="propertyForm"
              onSubmit={(event) => {
                event.preventDefault();

                updateProperty(editingPropertyId, {
                  name: propertyForm.name,
                  city: propertyForm.city,
                  address: propertyForm.address,
                  setupMode: propertyForm.setupMode,
                  vrboId: propertyForm.vrboId,
                  airbnbUrl: propertyForm.airbnbUrl,
                  iCalUrl: propertyForm.iCalUrl,
                  defaultCleanerId: propertyForm.defaultCleanerId || undefined,
                  bedrooms: Number(propertyForm.bedrooms) || 0,
                  bathrooms: Number(propertyForm.bathrooms) || 0,
                  maxGuests: Number(propertyForm.maxGuests) || 0,
                  status: propertyForm.iCalUrl || propertyForm.vrboId || propertyForm.airbnbUrl ? "Active" : "Setup Needed",
                  notes: propertyForm.notes,
                });

                setEditingPropertyId(null);
                setShowPropertyForm(false);
              }}
            >
              <label>
                Home name
                <input
                  value={propertyForm.name}
                  onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })}
                  placeholder="Example: Coates Cabin"
                />
              </label>

              <label>
                City / market
                <input
                  value={propertyForm.city}
                  onChange={(event) => setPropertyForm({ ...propertyForm, city: event.target.value })}
                  placeholder="Broken Bow"
                />
              </label>

              <label>
                Setup method
                <select
                  value={propertyForm.setupMode}
                  onChange={(event) => setPropertyForm({ ...propertyForm, setupMode: event.target.value as Home["setupMode"] })}
                >
                  <option value="VRBO">Use VRBO Listing ID</option>
                  <option value="Airbnb">Use Airbnb Listing URL</option>
                  <option value="Manual">Manually Set Up House</option>
                </select>
              </label>
              <label className="fullWidth">
                VRBO property ID
                <input
                  value={propertyForm.vrboId}
                  onChange={(event) => setPropertyForm({ ...propertyForm, vrboId: event.target.value })}
                  placeholder="VRBO ID"
                />
              </label>

              <label className="fullWidth">
                Airbnb listing URL
                <input
                  value={propertyForm.airbnbUrl}
                  onChange={(event) => setPropertyForm({ ...propertyForm, airbnbUrl: event.target.value })}
                  placeholder="https://airbnb.com/rooms/..."
                />
              </label>

              <div className="cardActions fullWidth">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={autoFillListing}
                >
                  Auto Fill Listing
                </button>
              </div>

              <label>
                iCal link
                <input
                  value={propertyForm.iCalUrl}
                  onChange={(event) => setPropertyForm({ ...propertyForm, iCalUrl: event.target.value })}
                  placeholder="Calendar feed URL"
                />
              </label>

              <label>
                Default cleaner
                <select
                  value={propertyForm.defaultCleanerId}
                  onChange={(event) => setPropertyForm({ ...propertyForm, defaultCleanerId: event.target.value })}
                >
                  <option value="">No default cleaner</option>
                  {cleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Bedrooms
                <input
                  type="number"
                  value={propertyForm.bedrooms}
                  onChange={(event) => setPropertyForm({ ...propertyForm, bedrooms: event.target.value })}
                />
              </label>

              <label>
                Bathrooms
                <input
                  type="number"
                  value={propertyForm.bathrooms}
                  onChange={(event) => setPropertyForm({ ...propertyForm, bathrooms: event.target.value })}
                />
              </label>

              <label>
                Max guests
                <input
                  type="number"
                  value={propertyForm.maxGuests}
                  onChange={(event) => setPropertyForm({ ...propertyForm, maxGuests: event.target.value })}
                />
              </label>

              <label className="fullWidth">
                Address / internal notes
                <input
                  value={propertyForm.address}
                  onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })}
                  placeholder="Address or private location notes"
                />
              </label>

              <label className="fullWidth">
                Property notes
                <textarea
                  value={propertyForm.notes}
                  onChange={(event) => setPropertyForm({ ...propertyForm, notes: event.target.value })}
                  placeholder="Owner notes, parking, supplies, access, known issues"
                />
              </label>
              <PropertyOperationsHub
  property={propertyForm}
  onChange={setPropertyForm}
/>

              <div className="cardActions fullWidth">
                <button className="primaryButton" type="submit">
                  Save Property Changes
                </button>
                <button
                  className="ghostButton"
                  type="button"
                  onClick={() => archiveProperty(editingPropertyId)}
                >
                  Archive Property
                </button>
                <button
                  className="dangerButton"
                  type="button"
                  onClick={() => deleteProperty(editingPropertyId)}
                >
                  Delete Property
                </button>
                <button
                  className="ghostButton"
                  type="button"
                  onClick={() => {
                    setEditingPropertyId(null);
                    setShowPropertyForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      );
    }

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Phase 4</p>
            <h2>Properties</h2>
            <p className="headerSubtext">
              Build home profiles, connect VRBO/Airbnb/iCal sources, set default cleaners, and prepare property intelligence.
            </p>
          </div>

          <button
            className="primaryButton"
            onClick={() => {
              setEditingPropertyId(null);
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
              setShowPropertyForm(true);
            }}
          >
            + Create Home Profile
          </button>
        </header>

        {showPropertyForm && (
          <section className="manualPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">{editingPropertyId ? "Edit home profile" : "Create home profile"}</p>
                <h3>{editingPropertyId ? "Edit Property" : "Add Property"}</h3>
              </div>
              <button
                className="ghostButton"
                onClick={() => {
                  setEditingPropertyId(null);
                  setShowPropertyForm(false);
                }}
              >
                Close
              </button>
            </div>

            <form
              className="propertyForm"
              onSubmit={(event) => {
                if (editingPropertyId) {
                  event.preventDefault();

                  updateProperty(editingPropertyId, {
                    name: propertyForm.name,
                    city: propertyForm.city,
                    address: propertyForm.address,
                    setupMode: propertyForm.setupMode,
                    vrboId: propertyForm.vrboId,
                    airbnbUrl: propertyForm.airbnbUrl,
                    iCalUrl: propertyForm.iCalUrl,
                    defaultCleanerId: propertyForm.defaultCleanerId || undefined,
                    bedrooms: Number(propertyForm.bedrooms) || 0,
                    bathrooms: Number(propertyForm.bathrooms) || 0,
                    maxGuests: Number(propertyForm.maxGuests) || 0,
                    status: propertyForm.iCalUrl || propertyForm.vrboId || propertyForm.airbnbUrl ? "Active" : "Setup Needed",
                    notes: propertyForm.notes,
                  });

                  setEditingPropertyId(null);
                  setShowPropertyForm(false);
                  return;
                }

                createProperty(event);
              }}
            >
              <label>
                Home name
                <input
                  value={propertyForm.name}
                  onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })}
                  placeholder="Example: Coates Cabin"
                />
              </label>

              <label>
                City / market
                <input
                  value={propertyForm.city}
                  onChange={(event) => setPropertyForm({ ...propertyForm, city: event.target.value })}
                  placeholder="Broken Bow"
                />
              </label>

              <label>
                Setup method
                <select
                  value={propertyForm.setupMode}
                  onChange={(event) => setPropertyForm({ ...propertyForm, setupMode: event.target.value as Home["setupMode"] })}
                >
                  <option value="VRBO">Use VRBO Listing ID</option>
                  <option value="Airbnb">Use Airbnb Listing URL</option>
                  <option value="Manual">Manually Set Up House</option>
                </select>
              </label>
              <label className="fullWidth">
                VRBO property ID
                <input
                  value={propertyForm.vrboId}
                  onChange={(event) => setPropertyForm({ ...propertyForm, vrboId: event.target.value })}
                  placeholder="VRBO ID"
                />
              </label>

              <label className="fullWidth">
                Airbnb listing URL
                <input
                  value={propertyForm.airbnbUrl}
                  onChange={(event) => setPropertyForm({ ...propertyForm, airbnbUrl: event.target.value })}
                  placeholder="https://airbnb.com/rooms/..."
                />
              </label>

              <div className="cardActions fullWidth">
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={autoFillListing}
                >
                  Auto Fill Listing
                </button>
              </div>

              <label>
                iCal link
                <input
                  value={propertyForm.iCalUrl}
                  onChange={(event) => setPropertyForm({ ...propertyForm, iCalUrl: event.target.value })}
                  placeholder="Calendar feed URL"
                />
              </label>

              <label>
                Default cleaner
                <select
                  value={propertyForm.defaultCleanerId}
                  onChange={(event) => setPropertyForm({ ...propertyForm, defaultCleanerId: event.target.value })}
                >
                  <option value="">No default cleaner</option>
                  {cleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Bedrooms
                <input
                  type="number"
                  value={propertyForm.bedrooms}
                  onChange={(event) => setPropertyForm({ ...propertyForm, bedrooms: event.target.value })}
                />
              </label>

              <label>
                Bathrooms
                <input
                  type="number"
                  value={propertyForm.bathrooms}
                  onChange={(event) => setPropertyForm({ ...propertyForm, bathrooms: event.target.value })}
                />
              </label>

              <label>
                Max guests
                <input
                  type="number"
                  value={propertyForm.maxGuests}
                  onChange={(event) => setPropertyForm({ ...propertyForm, maxGuests: event.target.value })}
                />
              </label>

              <label className="fullWidth">
                Address / internal notes
                <input
                  value={propertyForm.address}
                  onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })}
                  placeholder="Address or private location notes"
                />
              </label>

              <label className="fullWidth">
                Property notes
                <textarea
                  value={propertyForm.notes}
                  onChange={(event) => setPropertyForm({ ...propertyForm, notes: event.target.value })}
                  placeholder="Owner notes, parking, supplies, access, known issues"
                />
              </label>

              <button className="primaryButton" type="submit">
                {editingPropertyId ? "Save Property Changes" : "Save Home Profile"}
              </button>
            </form>
          </section>
        )}


        {renderDataIntegrationPanel()}

        <section className="statsGrid">
          <div className="statCard">
            <span>Total homes</span>
            <strong>{homes.length}</strong>
          </div>
          <div className="statCard">
            <span>Active</span>
            <strong>{activeHomes}</strong>
          </div>
          <div className="statCard warning">
            <span>Setup needed</span>
            <strong>{setupNeeded}</strong>
          </div>
          <div className="statCard">
            <span>Calendar feeds</span>
            <strong>{homes.filter((home) => home.iCalUrl).length}</strong>
          </div>
        </section>

        <section className="propertiesLayout">
          <div className="propertyCardGrid">
            {homes.map((home) => {
              const defaultCleaner = cleaners.find((cleaner) => cleaner.id === home.defaultCleanerId);
              const homeReservations = reservations.filter((reservation) => reservation.homeId === home.id);
              const homeWorkOrders = workOrders.filter((order) => order.homeId === home.id && order.status !== "Completed");

              return (
                <button
                  key={home.id}
                  className={`propertyCard ${selectedProperty?.id === home.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedPropertyId(home.id);
                    startEditingProperty(home);
                  }}
                >
                  <div className="propertyCardTop">
                    <div className="homeBadge">{home.shortName}</div>
                    <div>
                      <h3>{home.name}</h3>
                      <p>{home.city}</p>
                    </div>
                    <span className={`propertyStatus status${home.status.replace(/\s/g, "")}`}>{home.status}</span>
                  </div>

                  <div className="propertyMiniStats">
                    <span>{home.bedrooms} bd</span>
                    <span>{home.bathrooms} ba</span>
                    <span>{home.maxGuests} guests</span>
                  </div>

                  <div className="propertySourceRow">
                    <span>{home.setupMode}</span>
                    <span>{home.iCalUrl ? "iCal connected" : "No iCal"}</span>
                    <span>{defaultCleaner?.name ?? "No cleaner"}</span>
                  </div>

                  <p>{homeReservations.length} reservations · {homeWorkOrders.length} open work orders</p>
                </button>
              );
            })}
          </div>

          <aside className="propertyDetailPanel">
            {!selectedProperty ? (
              <>
                <p className="eyebrow">Property detail</p>
                <h3>Select a home</h3>
              </>
            ) : (
              <>
                <p className="eyebrow">Property detail</p>
                <div className="propertyDetailHeader">
                  <div className="homeBadge">{selectedProperty.shortName}</div>
                  <div>
                    <h3>{selectedProperty.name}</h3>
                    <p>{selectedProperty.address || selectedProperty.city}</p>
                  </div>
                </div>

                <div className="detailStack">
                  <div>
                    <span>Status</span>
                    <select
                      value={selectedProperty.status}
                      onChange={(event) =>
                        updateProperty(selectedProperty.id, { status: event.target.value as Home["status"] })
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Setup Needed">Setup Needed</option>
                      <option value="Paused">Paused</option>
                    </select>
                  </div>

                  <div>
                    <span>Default cleaner</span>
                    <select
                      value={selectedProperty.defaultCleanerId ?? ""}
                      onChange={(event) =>
                        updateProperty(selectedProperty.id, { defaultCleanerId: event.target.value || undefined })
                      }
                    >
                      <option value="">No default cleaner</option>
                      {cleaners.map((cleaner) => (
                        <option key={cleaner.id} value={cleaner.id}>
                          {cleaner.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="propertyDataGrid">
                  <div>
                    <span>VRBO ID</span>
                    <strong>{selectedProperty.vrboId || "Not connected"}</strong>
                  </div>
                  <div>
                    <span>Airbnb</span>
                    <strong>{selectedProperty.airbnbUrl ? "URL added" : "Not connected"}</strong>
                  </div>
                  <div>
                    <span>iCal</span>
                    <strong>{selectedProperty.iCalUrl ? "Connected" : "Missing"}</strong>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <strong>{selectedProperty.maxGuests} guests</strong>
                  </div>
                </div>

                <div className="aiAssistantBox">
                  <p className="eyebrow">Property intelligence groundwork</p>
                  <h4>Future automation path</h4>
                  <p>
                    VRBO ID, Airbnb URL, and iCal data will eventually feed occupancy comparisons, automated profile creation,
                    cleaner forecasting, and guest readiness scoring.
                  </p>
                </div>

                <div className="propertyLinkedOps">
                  <h4>Linked operations</h4>
                  <div>
                    <span>Upcoming reservations</span>
                    <strong>{selectedReservations.length}</strong>
                  </div>
                  <div>
                    <span>Open work orders</span>
                    <strong>{selectedWorkOrders.filter((order) => order.status !== "Completed").length}</strong>
                  </div>
                </div>


                {selectedProperty.notes && <p className="notesBox">{selectedProperty.notes}</p>}
              </>
            )}
          </aside>
        </section>
      </>
    );
  }

  function renderMaintenance() {
    const filteredWorkOrders = workOrders.filter((order) => {
      if (workOrderFilter === "all") return true;
      if (workOrderFilter === "after-hours") return order.urgency === "After Hours";
      if (workOrderFilter === "review") return order.status === "Owner Review";
      return order.status === workOrderFilter;
    });

    const openCount = workOrders.filter((order) => order.status !== "Completed").length;
    const urgentCount = workOrders.filter((order) => order.urgency === "High" || order.urgency === "After Hours").length;
    const reviewCount = workOrders.filter((order) => order.status === "Owner Review").length;
    const scheduledCount = workOrders.filter((order) => order.status === "Scheduled").length;

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Phase 3</p>
            <h2>Maintenance + Vendor Ops</h2>
            <p className="headerSubtext">
              Route issues, track urgency, assign vendors, capture owner review, and prepare the AI maintenance assistant layer.
            </p>
          </div>

          <div className="calendarHeaderActions">
            <button className="primaryButton" onClick={() => setShowWorkOrderForm(true)}>
              + Create Work Order
            </button>
            <button className="ghostButton" onClick={() => setWorkOrderFilter("after-hours")}>
              After-Hours Risks
            </button>
          </div>
        </header>

        <section className="statsGrid">
          <div className="statCard">
            <span>Open work orders</span>
            <strong>{openCount}</strong>
          </div>
          <div className="statCard warning">
            <span>Urgent / after-hours</span>
            <strong>{urgentCount}</strong>
          </div>
          <div className="statCard">
            <span>Owner review</span>
            <strong>{reviewCount}</strong>
          </div>
          <div className="statCard">
            <span>Scheduled</span>
            <strong>{scheduledCount}</strong>
          </div>
        </section>

        {showWorkOrderForm && (
          <section className="manualPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Owner-created work order</p>
                <h3>Create Maintenance Work Order</h3>
                <p className="mutedText">
                  Create issues directly from the owner side when a cleaner, guest, owner, or vendor reports something outside the cleaner portal.
                </p>
              </div>
              <button className="ghostButton" onClick={() => setShowWorkOrderForm(false)} type="button">
                Close
              </button>
            </div>

            <form className="manualForm" onSubmit={createOwnerWorkOrder}>
              <label>
                Property
                <select
                  value={ownerWorkOrderForm.homeId}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, homeId: event.target.value })}
                >
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
                  value={ownerWorkOrderForm.title}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, title: event.target.value })}
                  placeholder="Example: Replace broken blinds"
                />
              </label>

              <label>
                Category
                <select
                  value={ownerWorkOrderForm.category}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, category: event.target.value })}
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
                  value={ownerWorkOrderForm.urgency}
                  onChange={(event) =>
                    setOwnerWorkOrderForm({
                      ...ownerWorkOrderForm,
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
                Vendor
                <select
                  value={ownerWorkOrderForm.vendorId}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, vendorId: event.target.value })}
                >
                  <option value="">No vendor assigned yet</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} · {vendor.category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Scheduled date
                <input
                  type="date"
                  value={ownerWorkOrderForm.scheduledDate}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, scheduledDate: event.target.value })}
                />
              </label>

              <label className="fullWidth">
                Notes
                <textarea
                  value={ownerWorkOrderForm.notes}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, notes: event.target.value })}
                  placeholder="Describe the issue, guest impact, location, owner approval notes, or vendor instructions"
                />
              </label>

              <button className="primaryButton" type="submit" disabled={!homes.length}>
                Save Work Order
              </button>
            </form>
          </section>
        )}

        <section className="maintenanceLayout">
          <div>
            <section className="filtersPanel maintenanceFilters">
              <select value={workOrderFilter} onChange={(event) => setWorkOrderFilter(event.target.value)}>
                <option value="all">All work orders</option>
                <option value="New">New</option>
                <option value="Assigned">Assigned</option>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="review">Owner Review</option>
                <option value="after-hours">After-Hours Risks</option>
                <option value="Completed">Completed</option>
              </select>
            </section>

            <section className="workOrderList">
              {filteredWorkOrders.map((order) => {
                const home = homes.find((item) => item.id === order.homeId);
                const vendor = vendors.find((item) => item.id === order.vendorId);

                return (
                  <article
                    key={order.id}
                    className={`workOrderCard ${selectedWorkOrder?.id === order.id ? "selected" : ""}`}
                    onClick={() => setSelectedWorkOrder(order)}
                  >
                    <div className="workOrderTop">
                      <div>
                        <h3>{order.title}</h3>
                        <p>{home?.name ?? "Unknown home"} · {order.category}</p>
                      </div>
                      <span className={`urgencyPill urgency${order.urgency.replace(/\s/g, "")}`}>{order.urgency}</span>
                    </div>

                    <div className="workOrderMeta">
                      <span>{order.status}</span>
                      <span>{vendor?.name ?? "No vendor assigned"}</span>
                      <span>{order.scheduledDate ? `Scheduled ${formatDate(order.scheduledDate)}` : `Created ${formatDate(order.createdDate)}`}</span>
                    </div>

                    <p className="workOrderNotes">{order.notes}</p>
                  </article>
                );
              })}
            </section>
          </div>

          <aside className="maintenanceDetailPanel">
            {!selectedWorkOrder ? (
              <>
                <p className="eyebrow">Work order</p>
                <h3>Select a work order</h3>
                <p className="mutedText">Vendor routing and AI suggestions will show here.</p>
              </>
            ) : (
              <>
                <p className="eyebrow">Work order detail</p>
                <h3>{selectedWorkOrder.title}</h3>
                <p className="mutedText">
                  {homes.find((home) => home.id === selectedWorkOrder.homeId)?.name ?? "Unknown home"}
                </p>

                <div className="detailStack">
                  <div>
                    <span>Status</span>
                    <select
                      value={selectedWorkOrder.status}
                      onChange={(event) =>
                        updateWorkOrder(selectedWorkOrder.id, { status: event.target.value as WorkOrderStatus })
                      }
                    >
                      <option value="New">New</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Owner Review">Owner Review</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <span>Vendor</span>
                    <select
                      value={selectedWorkOrder.vendorId ?? ""}
                      onChange={(event) =>
                        updateWorkOrder(selectedWorkOrder.id, {
                          vendorId: event.target.value || undefined,
                          status: event.target.value ? "Assigned" : selectedWorkOrder.status,
                        })
                      }
                    >
                      <option value="">No vendor assigned</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name} · {vendor.category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="aiAssistantBox">
                  <p className="eyebrow">AI vendor assistant groundwork</p>
                  <h4>Recommended routing</h4>
                  <p>
                    {selectedWorkOrder.urgency === "After Hours"
                      ? "This is flagged as after-hours. Prioritize vendors with emergency coverage and guest-impact response."
                      : selectedWorkOrder.urgency === "High"
                        ? "High urgency. Schedule before next arrival or escalate if currently guest-impacting."
                        : "Standard routing. Assign the best matching vendor and track owner approval if needed."}
                  </p>
                </div>

                <div className="vendorSuggestions">
                  <h4>Recommended vendors</h4>
                  {getRecommendedVendors(selectedWorkOrder.category, selectedWorkOrder.urgency).map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() =>
                        updateWorkOrder(selectedWorkOrder.id, {
                          vendorId: vendor.id,
                          status: "Assigned",
                        })
                      }
                    >
                      <strong>{vendor.name}</strong>
                      <span>{vendor.category} · ★ {vendor.rating} · {vendor.afterHours ? "After-hours" : "Standard hours"}</span>
                    </button>
                  ))}
                </div>

                <div className="timeline maintenanceTimeline">
                  <h4>Timeline</h4>
                  {selectedWorkOrder.timeline.map((item, index) => (
                    <div key={`${selectedWorkOrder.id}-${item}-${index}`} className="timelineItem">
                      <span />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </section>
      </>
    );
  }


  function updateCleaner(id: string, updates: Partial<Cleaner>) {
    setCleaners((current) => current.map((cleaner) => (cleaner.id === id ? { ...cleaner, ...updates } : cleaner)));
  }

  function deleteCleaner(id: string) {
    const cleaner = cleaners.find((item) => item.id === id);

    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${cleaner?.name ?? "this cleaner"}.`
    );

    if (confirmation !== "DELETE") return;

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
        home.defaultCleanerId === id
          ? { ...home, defaultCleanerId: undefined }
          : home
      )
    );

  const remaining = cleaners.filter((cleaner) => cleaner.id !== id);
setSelectedCleanerId(remaining[0]?.id ?? "");
  }

  function markNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    );
  }

  function renderDashboard() {
  const upcomingReservations = reservations
    .filter((reservation) => reservation.status !== "Completed")
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .slice(0, 3);

  const unassignedReservations = reservations.filter((item) => !item.cleanerId).length;
  const openWorkOrders = workOrders.filter((order) => order.status !== "Completed");
  const urgentWorkOrders = workOrders.filter(
    (order) => order.urgency === "High" || order.urgency === "After Hours"
  );
  const openTasks = notifications.filter((notification) => !notification.read);
  const criticalTasks = notifications.filter(
    (notification) => !notification.read && notification.priority === "Critical"
  );

  function openReservationFromDashboard(reservation: Reservation) {
    setSelectedCalendarItem(reservation);
    setActivePage("Reservation Detail");
  }

  return (
    <>
      <header className="pageHeader dashboardHeader">
        <div>
          <p className="eyebrow">Ask My Rentals</p>
          <h2>Owner Dashboard</h2>
          <p className="headerSubtext">What needs your attention right now?</p>
        </div>
      </header>

      <section className="dashboardHeroGrid">
        <button className="dashboardLaunchCard housekeeping" type="button" onClick={() => setActivePage("Cleaners")}>
          <span className="launchIcon">🧹</span>
          <div>
            <h3>Housekeeping</h3>
            <strong>{reservations.length} Upcoming Reservations</strong>
            <p>{unassignedReservations} Unassigned</p>
          </div>
        </button>

        <button className="dashboardLaunchCard maintenance" type="button" onClick={() => setActivePage("Maintenance")}>
          <span className="launchIcon">🔧</span>
          <div>
            <h3>Maintenance</h3>
            <strong>{openWorkOrders.length} Open Issues</strong>
            <p>{urgentWorkOrders.length} Urgent</p>
          </div>
        </button>

        <button className="dashboardLaunchCard properties" type="button" onClick={() => setActivePage("Properties")}>
          <span className="launchIcon">🏡</span>
          <div>
            <h3>Properties</h3>
            <strong>{homes.length} Active Properties</strong>
            <p>Manage homes and setup</p>
          </div>
        </button>

        <button className="dashboardLaunchCard tasks" type="button" onClick={() => setActivePage("Notification Center")}>
          <span className="launchIcon">📋</span>
          <div>
            <h3>Tasks</h3>
            <strong>{openTasks.length} Outstanding Tasks</strong>
            <p>{criticalTasks.length} Critical</p>
          </div>
        </button>
      </section>

      <section className="dashboardReservationsSection">
        <div className="panelHeader compact">
          <div>
            <p className="eyebrow">Next 3</p>
            <h3>Upcoming Reservations</h3>
          </div>
        </div>

        <div className="dashboardReservationCards">
          {upcomingReservations.map((reservation) => {
            const home = homes.find((item) => item.id === reservation.homeId);
            const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);

            return (
              <button
                key={reservation.id}
                type="button"
                className="dashboardReservationCard"
                onClick={() => openReservationFromDashboard(reservation)}
              >
                <span className={`platformBadge platform${reservation.source.replace(/\s/g, "")}`}>
                  {reservation.source === "Manual" ? "OWNER BLOCK" : reservation.source.toUpperCase()}
                </span>

                <h3>{home?.name ?? "Imported reservation"}</h3>
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

                <div className="assignedCleanerLine">
                  <span>Assigned Cleaner</span>
                  <strong>{cleaner?.name ?? "Unassigned"}</strong>
                </div>
              </button>
            );
          })}
        </div>

        <button className="primaryButton fullWidthButton" type="button" onClick={() => setActivePage("Reservations")}>
          View All Reservations →
        </button>
      </section>
    </>
  );
}
function renderReservationDetail() {
  const reservation =
    selectedCalendarItem && "guestName" in selectedCalendarItem
      ? selectedCalendarItem
      : null;

  if (!reservation) {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Reservation Detail</p>
        <h2>No reservation selected</h2>
        <p>Select a reservation from the Dashboard, Calendar, or Reservations page.</p>
        <button className="primaryButton" type="button" onClick={() => setActivePage("Dashboard")}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  const home = homes.find((item) => item.id === reservation.homeId);
  const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);

  return (
    <>
      <header className="pageHeader reservationDetailHeader">
        <div>
          <span className={`platformBadge platform${reservation.source.replace(/\s/g, "")}`}>
            {reservation.source === "Manual" ? "OWNER BLOCK" : reservation.source.toUpperCase()}
          </span>
          <h2>{reservation.source === "Manual" ? reservation.guestName : home?.name ?? "Unknown property"}</h2>
          <p className="headerSubtext">
  {reservation.source === "Owner Block"
    ? "Owner Block"
    : reservation.source === "Manual"
      ? home?.name ?? "Unknown property"
      : "Imported reservation"}
</p>
        </div>

        <button className="ghostButton" type="button" onClick={() => setActivePage("Dashboard")}>
          ← Back to Dashboard
        </button>
      </header>

      <section className="reservationWorkspace">
        <article className="reservationHeroPanel">
          <div className="reservationHeroDates">
            <div>
              <span>Arrival</span>
              <strong>{formatDate(reservation.arrival)}</strong>
            </div>
            <div>
              <span>Departure</span>
              <strong>{formatDate(reservation.departure)}</strong>
            </div>
          </div>

          <div className="reservationHeroStatus">
            <div>
              <span>Status</span>
              <strong>{reservation.status}</strong>
            </div>
            <div>
              <span>Assigned Cleaner</span>
              <strong>{cleaner?.name ?? "Unassigned"}</strong>
            </div>
          </div>
        </article>

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Housekeeping</p>
          <h3>Cleaner Assignment</h3>

          <label>
            Assigned cleaner
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
        </article>

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Reservation Notes</p>
          <h3>Owner Notes</h3>

          <textarea
            value={reservation.notes ?? ""}
            onChange={(event) =>
              updateReservation(reservation.id, {
                notes: event.target.value,
              })
            }
            placeholder="Add reservation notes, cleaner instructions, parking notes, guest requests, supplies, or reminders."
          />
        </article>

        <article className="reservationWorkspaceCard doorCodePreview">
          <p className="eyebrow">Future Integration</p>
          <h3>Door Code</h3>
          <p>Smart lock and guest access codes will live here later.</p>
          <button type="button" className="disabledButton" disabled>
            Door Code Coming Soon
          </button>
        </article>
      </section>
    </>
  );
}

  function renderCleaners() {
    const selectedCleaner = cleaners.find((cleaner) => cleaner.id === selectedCleanerId) ?? cleaners[0];
    const cleanerReservations = selectedCleaner
      ? reservations.filter((reservation) => reservation.cleanerId === selectedCleaner.id)
      : [];
    const defaultHomes = selectedCleaner
      ? homes.filter((home) => home.defaultCleanerId === selectedCleaner.id)
      : [];

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Cleaner operations</p>
            <h2>Cleaners</h2>
            <p className="headerSubtext">
              Manage cleaner availability, default property assignments, specialties, active turnovers, and mobile portal groundwork.
            </p>
          </div>

          <button className="primaryButton" onClick={() => setActivePage("Reservations")}>
            Assign Turnovers
          </button>
        </header>

        <section className="statsGrid">
          <div className="statCard">
            <span>Total cleaners</span>
            <strong>{cleaners.length}</strong>
          </div>
          <div className="statCard">
            <span>Available</span>
            <strong>{cleaners.filter((cleaner) => cleaner.status === "Available").length}</strong>
          </div>
          <div className="statCard">
            <span>Busy</span>
            <strong>{cleaners.filter((cleaner) => cleaner.status === "Busy").length}</strong>
          </div>
          <div className="statCard warning">
            <span>Unassigned stays</span>
            <strong>{reservations.filter((reservation) => !reservation.cleanerId).length}</strong>
          </div>
        </section>

        <section className="cleanersLayout">
          <div className="cleanerCardGrid">
            {cleaners.map((cleaner) => (
              <button
                key={cleaner.id}
                className={`cleanerCard ${selectedCleaner?.id === cleaner.id ? "selected" : ""}`}
                onClick={() => setSelectedCleanerId(cleaner.id)}
              >
                <div className="cleanerAvatar">{cleaner.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3>{cleaner.name}</h3>
                  <p>{cleaner.serviceArea}</p>
                  <div className="propertyMiniStats">
                    <span>{cleaner.status}</span>
                    <span>★ {cleaner.rating}</span>
                    <span>{cleaner.activeJobs} active</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <aside className="cleanerDetailPanel">
            {!selectedCleaner ? (
              <>
                <p className="eyebrow">Cleaner detail</p>
                <h3>Select a cleaner</h3>
              </>
            ) : (
              <>
                <p className="eyebrow">Cleaner detail</p>
                <div className="cleanerDetailHeader">
                  <div className="cleanerAvatar large">{selectedCleaner.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <h3>{selectedCleaner.name}</h3>
                    <p>{selectedCleaner.phone} · {selectedCleaner.serviceArea}</p>
                  </div>
                </div>

                <div className="detailStack">
                  <div>
                    <span>Status</span>
                    <select
                      value={selectedCleaner.status}
                      onChange={(event) =>
                        updateCleaner(selectedCleaner.id, { status: event.target.value as Cleaner["status"] })
                      }
                    >
                      <option value="Available">Available</option>
                      <option value="Busy">Busy</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                </div>

                <div className="propertyDataGrid">
                  <div>
                    <span>Rating</span>
                    <strong>★ {selectedCleaner.rating}</strong>
                  </div>
                  <div>
                    <span>Active jobs</span>
                    <strong>{selectedCleaner.activeJobs}</strong>
                  </div>
                  <div>
                    <span>Default homes</span>
                    <strong>{defaultHomes.length}</strong>
                  </div>
                  <div>
                    <span>Assigned stays</span>
                    <strong>{cleanerReservations.length}</strong>
                  </div>
                </div>

                <div className="specialtyList">
                  <h4>Specialties</h4>
                  <div>
                    {selectedCleaner.specialties.map((specialty) => (
                      <span key={specialty}>{specialty}</span>
                    ))}
                  </div>
                </div>

                <div className="aiAssistantBox">
                  <p className="eyebrow">Cleaner portal groundwork</p>
                  <h4>Future mobile flow</h4>
                  <p>
                    This profile will support assignment acceptance, ETA tracking, messaging, inspection photos,
                    supply reporting, and completion confirmations.
                  </p>
                </div>

                {selectedCleaner.notes && <p className="notesBox">{selectedCleaner.notes}</p>}

                <div className="cardActions">
                  <button
                    className="dangerButton"
                    onClick={() => deleteCleaner(selectedCleaner.id)}
                  >
                    Delete Cleaner
                  </button>
                </div>
              </>
            )}
          </aside>
        </section>
      </>
    );
  }

  function renderNotificationCenter() {
    const visibleNotifications = notifications.filter((notification) => {
      if (notificationFilter === "all") return true;
      if (notificationFilter === "unread") return !notification.read;
      return notification.type === notificationFilter;
    });

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Owner communication</p>
            <h2>Notification Center</h2>
            <p className="headerSubtext">
              Central hub for reservation risks, cleaner updates, maintenance alerts, property setup issues, and system messages.
            </p>
          </div>

          <button
            className="primaryButton"
            onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))}
          >
            Mark All Read
          </button>
        </header>

        <section className="filtersPanel maintenanceFilters">
          <select value={notificationFilter} onChange={(event) => setNotificationFilter(event.target.value)}>
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
            <option value="Reservation">Reservations</option>
            <option value="Cleaner">Cleaners</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Property">Properties</option>
            <option value="System">System</option>
          </select>
        </section>

        <section className="notificationList">
          {visibleNotifications.map((notification) => {
            const home = homes.find((item) => item.id === notification.relatedHomeId);
            const cleaner = cleaners.find((item) => item.id === notification.relatedCleanerId);

            return (
              <article key={notification.id} className={`notificationCard ${notification.read ? "read" : "unread"}`}>
                <div className="notificationTop">
                  <div>
                    <span className={`priorityPill priority${notification.priority}`}>{notification.priority}</span>
                    <span className="typePill">{notification.type}</span>
                  </div>
                  <small>{notification.createdAt}</small>
                </div>

                <h3>{notification.title}</h3>
                <p>{notification.message}</p>

                <div className="notificationMeta">
                  {home && <span>{home.name}</span>}
                  {cleaner && <span>{cleaner.name}</span>}
                  <span>{notification.read ? "Read" : "Unread"}</span>
                </div>

                <div className="cardActions">
                  {!notification.read && <button onClick={() => markNotificationRead(notification.id)}>Mark Read</button>}
                  {notification.type === "Reservation" && <button onClick={() => setActivePage("Reservations")}>Open Reservations</button>}
                  {notification.type === "Maintenance" && <button onClick={() => setActivePage("Maintenance")}>Open Maintenance</button>}
                  {notification.type === "Property" && <button onClick={() => setActivePage("Properties")}>Open Properties</button>}
                  {notification.type === "Cleaner" && <button onClick={() => setActivePage("Cleaners")}>Open Cleaners</button>}
                </div>
              </article>
            );
          })}
        </section>
      </>
    );
  }


  function updateReservationFromCleaner(id: string, status: ReservationStatus, note: string) {
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

function submitCleanerMaintenanceIssue(event: React.FormEvent<HTMLFormElement>) {
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

  setWorkOrders((current) => [nextWorkOrder, ...current]);

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
  function renderCleanerPortal() {
    const activeCleaner = cleaners.find((cleaner) => cleaner.id === cleanerPortalId) ?? cleaners[0];
    const cleanerTasks = reservations
      .filter((reservation) => reservation.cleanerId === activeCleaner?.id)
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
    const urgentTasks = cleanerTasks.filter((reservation) => {
      const urgency = getUrgency(reservation.arrival);
      return urgency.label === "Today" || urgency.label === "Tomorrow" || urgency.className === "watch";
    });

    return (
      <>
        <header className="pageHeader cleanerPortalHero">
          <div>
            <p className="eyebrow">Mobile cleaner experience</p>
            <h2>Cleaner Portal</h2>
            <p className="headerSubtext">
              Cleaner-friendly workflow for assignments, acceptance, ETA updates, completion, and maintenance reporting.
            </p>
          </div>

          <button className="primaryButton" onClick={() => setActivePage("Reservations")}>
            Reservation
          </button>
        </header>

        <section className="cleanerPortalShell">
          <div className="cleanerPhonePanel">
            <div className="cleanerPortalTop">
              <div className="cleanerAvatar large">{activeCleaner?.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="eyebrow">Signed in as</p>
                <h3>{activeCleaner?.name}</h3>
                <span>{activeCleaner?.serviceArea} · {activeCleaner?.status}</span>
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
              <div>
                <span>Assigned</span>
                <strong>{cleanerTasks.length}</strong>
              </div>
              <div>
                <span>Urgent</span>
                <strong>{urgentTasks.length}</strong>
              </div>
              <div>
               <span>In Process
               </span>
                <strong>{cleanerTasks.filter((task) => task.status === "In Process").length}</strong>
              </div>
            </div>

            <div className="cleanerTaskStack">
              <h4>My assigned cleanings</h4>

              {cleanerTasks.length === 0 ? (
                <p className="mutedText">No assigned cleanings yet.</p>
              ) : (
                cleanerTasks.map((reservation) => {
                  const home = homes.find((item) => item.id === reservation.homeId);
                  const urgency = getUrgency(reservation.arrival);

                  return (
                    <article key={reservation.id} className="cleanerTaskCard">
                      <div className="cleanerTaskHeader">
                        <div>
                          <h3>{home?.name ?? "Unknown home"}</h3>
                          <p>{reservation.guestName}</p>
                        </div>
                        <span className={`urgencyBadge ${urgency.className}`}>{urgency.label}</span>
                      </div>

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
{home && (
  <section className="cleanerPropertyInfo">
    <p className="eyebrow">Property info</p>

    {home.operations?.access && (
      <div className="cleanerInfoCard">
        <strong>Access</strong>
        <p>{home.operations.access}</p>
      </div>
    )}

    {home.operations?.wifiName && (
      <div className="cleanerInfoCard">
        <strong>WiFi</strong>
        <p>{home.operations.wifiName}</p>
        {home.operations?.wifiPassword && <small>Password: {home.operations.wifiPassword}</small>}
      </div>
    )}

    {home.operations?.trashInstructions && (
      <div className="cleanerInfoCard">
        <strong>Trash</strong>
        <p>{home.operations.trashInstructions}</p>
      </div>
    )}

    {home.operations?.cleanerNotes && (
      <div className="cleanerInfoCard">
        <strong>Notes to Cleaner</strong>
        <p>{home.operations.cleanerNotes}</p>
      </div>
    )}
  </section>
)}
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
  disabled={toInputDate(new Date()) < reservation.departure}
  onClick={() =>
    updateReservationFromCleaner(
      reservation.id,
      "In Process",
      "Cleaner started cleaning"
    )
  }
>
  Start
</button>
                       <button
  disabled={
    reservation.status !== "In Process" ||
    toInputDate(new Date()) < reservation.departure
  }
  onClick={() =>
    updateReservationFromCleaner(
      reservation.id,
      "Completed",
      "Cleaner completed the reservation"
    )
  }
>
  Complete
</button>
                        <button
                          className="warningAction"
                          onClick={() => {
                            setCleanerIssueForm((current) => ({ ...current, reservationId: reservation.id }));
                            document.getElementById("cleanerIssueForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          Report Issue
                        </button>
                      </div>

                      <div className="etaRow">
                        <button onClick={() => updateReservationFromCleaner(reservation.id, "Accepted", "Cleaner ETA: on time")}>
                          ETA On Time
                        </button>
                        <button onClick={() => updateReservationFromCleaner(reservation.id, "In Process", "Cleaner running late; owner review recommended")}>
                          Running Late
                        </button>
                        <button onClick={() => updateReservationFromCleaner(reservation.id, "In Process", "Cleaner requested owner message")}>
                          Message Owner
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="cleanerOpsPanel">

            <section className="cleanerIssueBox" id="cleanerIssueForm">
              <p className="eyebrow">Maintenance reporting</p>
              <h3>Report an Issue</h3>
              <p className="mutedText">
                This creates an owner notification and a maintenance work order automatically.
              </p>

              <form className="cleanerIssueForm" onSubmit={submitCleanerMaintenanceIssue}>
                <label>
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
                      setCleanerIssueForm({ ...cleanerIssueForm, urgency: event.target.value as WorkOrderUrgency })
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
            </section>
          </aside>
        </section>

        <nav className="cleanerMobileNav" aria-label="Cleaner mobile navigation">
          <button
            type="button"
            onClick={() => document.querySelector(".cleanerTaskStack")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span>✓</span>
            Tasks
          </button>
          <button
            type="button"
            onClick={() => document.querySelector(".cleanerQuickStats")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span>◷</span>
            Today
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("cleanerIssueForm")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span>⚠</span>
            Issues
          </button>
          <button
            type="button"
            onClick={() => window.alert("Cleaner messaging is the next build step.")}
          >
            <span>✉</span>
            Messages
          </button>
          <button
            type="button"
            onClick={() => document.querySelector(".cleanerPortalTop")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span>●</span>
            Profile
          </button>
        </nav>
      </>
    );
  }


  function renderOccupancy() {
    const totalDays = 365;
    const guestNights = reservations.filter((reservation) => reservation.source !== "Owner Block").reduce((total, reservation) => {
      const start = toDate(reservation.arrival);
      const end = toDate(reservation.departure);
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    }, 0);
    const ownerNights = reservations.filter((reservation) => reservation.source === "Owner Block").reduce((total, reservation) => {
      const start = toDate(reservation.arrival);
      const end = toDate(reservation.departure);
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    }, 0) + calendarBlocks.filter((block) => block.type === "Owner Block").reduce((total, block) => {
      const start = toDate(block.start);
      const end = toDate(block.end);
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    }, 0);
    const blockedNights = calendarBlocks.filter((block) => block.type === "Maintenance").reduce((total, block) => {
      const start = toDate(block.start);
      const end = toDate(block.end);
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    }, 0);
    const openNights = Math.max(0, totalDays - guestNights - ownerNights - blockedNights);
    const occupancyPercent = Math.round((guestNights / totalDays) * 100);
    const projectedOccupancy = Math.min(100, occupancyPercent + 7);

    const occupancyDiscrepancies = [
      {
        id: "disc-1",
        property: "Coates Cabin",
        dateRange: "Jul 14–18",
        message: "VRBO calendar is open while Airbnb is blocked.",
        severity: "High",
        status: dismissedDiscrepancies.includes("disc-1") ? "Dismissed" : "Open",
      },
      {
        id: "disc-2",
        property: "Pine Ridge Lodge",
        dateRange: "Aug 3",
        message: "Duplicate owner block detected across calendar sources.",
        severity: "Medium",
        status: dismissedDiscrepancies.includes("disc-2") ? "Dismissed" : "Open",
      },
      {
        id: "disc-3",
        property: "Lakeview Retreat",
        dateRange: "Sep 9–12",
        message: "Reservation appears on Airbnb but is missing from VRBO.",
        severity: "High",
        status: dismissedDiscrepancies.includes("disc-3") ? "Dismissed" : "Open",
      },
    ];

    const visibleDiscrepancies = occupancyDiscrepancies.filter((item) => item.status === "Open");

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Owner intelligence</p>
            <h2>Occupancy</h2>
            <p className="headerSubtext">
              Track guest nights, owner nights, blocked nights, open inventory, projections, and calendar discrepancies.
            </p>
          </div>

          <button className="primaryButton" onClick={() => setActivePage("Calendar")}>
            Open Calendar
          </button>
        </header>

        <section className="occupancyStatsGrid">
          <article className="occupancyCard">
            <span>Occupancy</span>
            <strong>{occupancyPercent}%</strong>
            <p>Guest nights divided by annual inventory</p>
          </article>

          <article className="occupancyCard">
            <span>Guest Nights</span>
            <strong>{guestNights}</strong>
            <p>Booked rental nights</p>
          </article>

          <article className="occupancyCard">
            <span>Owner Nights</span>
            <strong>{ownerNights}</strong>
            <p>Owner stays and personal blocks</p>
          </article>

          <article className="occupancyCard">
            <span>Blocked Nights</span>
            <strong>{blockedNights}</strong>
            <p>Maintenance and unavailable dates</p>
          </article>

          <article className="occupancyCard">
            <span>Open Nights</span>
            <strong>{openNights}</strong>
            <p>Remaining available inventory</p>
          </article>

          <article className="occupancyCard">
            <span>Projected Occupancy</span>
            <strong>{projectedOccupancy}%</strong>
            <p>Mock projection until historical data is connected</p>
          </article>
        </section>

        <section className="occupancyLayout">
          <div className="occupancyPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Calendar QA</p>
                <h3>Calendar Discrepancies</h3>
              </div>
              <span className="occupancyAlertPill">{visibleDiscrepancies.length} open</span>
            </div>

            <div className="occupancyDiscrepancyStack">
              {visibleDiscrepancies.length === 0 ? (
                <div className="emptyStateBox">
                  <h4>No open discrepancies</h4>
                  <p>Dismissed and fixed items stay in records for later audit history.</p>
                </div>
              ) : (
                visibleDiscrepancies.map((item) => (
                  <article key={item.id} className="occupancyDiscrepancyCard">
                    <div className="occupancyDiscrepancyTop">
                      <div>
                        <h4>{item.property}</h4>
                        <p>{item.message}</p>
                        <span>{item.dateRange}</span>
                      </div>

                      <span className={`urgencyBadge ${item.severity === "High" ? "urgent" : "watch"}`}>
                        {item.severity}
                      </span>
                    </div>

                    <label className="occupancyNoteField">
                      Owner note
                      <input placeholder="Add note about why this is okay or what needs fixing" />
                    </label>

                    <div className="cardActions">
                      <button onClick={() => setDismissedDiscrepancies((current) => [...current, item.id])}>
                        Dismiss
                      </button>
                      <button className="primaryButton" onClick={() => setDismissedDiscrepancies((current) => [...current, item.id])}>
                        Mark Fixed
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="occupancyPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Reports</p>
                <h3>Occupancy Report</h3>
              </div>
            </div>

            <div className="occupancyReportFilters">
              <label>
                Property
                <select defaultValue="all">
                  <option value="all">All properties</option>
                  {homes.map((home) => (
                    <option key={home.id} value={home.id}>{home.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Period
                <select defaultValue="year">
                  <option value="month">This month</option>
                  <option value="quarter">This quarter</option>
                  <option value="year">This year</option>
                  <option value="prior-year">Prior year comparison</option>
                </select>
              </label>
            </div>

            <div className="occupancyReportBox">
              <div className="occupancyReportRow">
                <span>Guest nights</span>
                <strong>{guestNights}</strong>
              </div>
              <div className="occupancyReportRow">
                <span>Owner nights</span>
                <strong>{ownerNights}</strong>
              </div>
              <div className="occupancyReportRow">
                <span>Blocked nights</span>
                <strong>{blockedNights}</strong>
              </div>
              <div className="occupancyReportRow">
                <span>Open nights</span>
                <strong>{openNights}</strong>
              </div>
              <div className="occupancyReportRow total">
                <span>Occupancy</span>
                <strong>{occupancyPercent}%</strong>
              </div>
            </div>

            <button className="primaryButton fullWidthButton">Generate Report</button>
            <p className="mutedText">For now this gives owners the core numbers they can manually enter into county or tax reporting portals.</p>
          </aside>
        </section>
      </>
    );
  }

  function renderRecords() {
    const recentReservationEvents = reservations.flatMap((reservation) =>
      reservation.timeline.slice(-2).map((item) => ({
        id: `${reservation.id}-${item}`,
        label: item,
        detail: `${reservation.guestName} · ${homes.find((home) => home.id === reservation.homeId)?.name ?? "Unknown home"}`,
        type: "Reservation",
      }))
    );
    const recentWorkOrderEvents = workOrders.slice(0, 4).map((order) => ({
      id: order.id,
      label: order.title,
      detail: `${order.status} · ${order.urgency}`,
      type: "Maintenance",
    }));
    const recordItems = [...recentReservationEvents, ...recentWorkOrderEvents].slice(0, 12);

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>Records</h2>
            <p className="headerSubtext">
              A lightweight history of cleaner updates, reservation changes, maintenance items, and owner decisions.
            </p>
          </div>
        </header>

        <section className="recordsPanel">
          {recordItems.map((item) => (
            <article key={item.id} className="recordItem">
              <span>{item.type}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderPlaceholder() {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Stable checkpoint</p>
        <h2>{activePage}</h2>
        <p>
          This module is parked for a later phase so the Task Board and Calendar can stay stable.
        </p>
        <button className="primaryButton" onClick={() => setActivePage("Task Board")}>
          Go to Reservations
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
<button
  className="ghostButton"
  type="button"
  onClick={handleLogout}
>
  Log Out
</button>
        <nav className="nav desktopNav">
          {["Dashboard", "Reservations", "Calendar", "Properties", "Occupancy", "Cleaners", "Cleaner Portal", "Maintenance", "Notification Center", "Records"].map(
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
              </button>
            )
          )}
        </nav>

        <nav className="ownerMobileNav" aria-label="Owner mobile navigation">
          {[
            { label: "Home", page: "Dashboard", icon: "⌂" },
            { label: "Reservations", page: "Task Board", icon: "▦" },
            { label: "Calendar", page: "Calendar", icon: "◷" },
          ].map((item) => (
            <button
              key={item.page}
              type="button"
              className={activePage === item.page ? "active" : ""}
              onClick={() => {
                setActivePage(item.page);
                setShowOwnerMobileMenu(false);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <button
            type="button"
            className={showOwnerMobileMenu ? "active" : ""}
            onClick={() => setShowOwnerMobileMenu((current) => !current)}
          >
            <span>☰</span>
            Menu
          </button>
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
                "Notification Center",
                "Properties",
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
          </section>
        </div>
      )}

      <main className="mainContent">
        {activePage === "Calendar" && renderCalendar()}
        {activePage === "Dashboard" && renderDashboard()}
       {activePage === "Reservation Detail" && renderReservationDetail()}
        {activePage === "Reservations" && renderReservationBoard()}
        {activePage === "Properties" && renderProperties()}
        {activePage === "Occupancy" && renderOccupancy()}
        {activePage === "Cleaners" && renderCleaners()}
        {activePage === "Cleaner Portal" && renderCleanerPortal()}
        {activePage === "Maintenance" && renderMaintenance()}
        {activePage === "Notification Center" && renderNotificationCenter()}
        {activePage === "Records" && renderRecords()}
        {!["Dashboard", "Reservations", "Calendar", "Properties", "Occupancy", "Reservation Detail", "Cleaners", "Cleaner Portal", "Maintenance", "Notification Center", "Records"].includes(activePage) && renderPlaceholder()}
      </main>
      {/* MOBILE BOTTOM NAV MUST ALWAYS BE: Home / Tasks / Calendar / More (hamburger). */}
      <nav className="mobileBottomNav" aria-label="Owner mobile bottom navigation">
  {[
    { label: "Home", page: "Dashboard", icon: "⌂" },
    { label: "Reservations", page: "Reservations", icon: "▦" },
    { label: "Calendar", page: "Calendar", icon: "◷" },
    { label: "Notifications", page: "Notification Center", icon: "!" },
  ].map((item) => (
    <button
            key={item.label}
            className={activePage === item.page ? "active" : ""}
            onClick={() => {
              setActivePage(item.page);
              setShowOwnerMobileMenu(false);
            }}
            type="button"
          >
            <span>{item.icon}</span>
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
