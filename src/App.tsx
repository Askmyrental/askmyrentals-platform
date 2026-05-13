import { useMemo, useState } from "react";
import "./App.css";

type ReservationStatus =
  | "New"
  | "Assigned"
  | "Accepted"
  | "Cleaning"
  | "Ready"
  | "Needs Review"
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

type WorkOrderStatus = "New" | "Assigned" | "Scheduled" | "In Progress" | "Owner Review" | "Completed";
type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";

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

const starterHomes: Home[] = [
  {
    id: "coates",
    name: "Coates Cabin",
    city: "Broken Bow",
    shortName: "CO",
    address: "Broken Bow, OK",
    vrboId: "1234567",
    iCalUrl: "https://example.com/coates.ics",
    setupMode: "VRBO",
    defaultCleanerId: "aarthi",
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 8,
    status: "Active",
    notes: "Primary test property. VRBO ID will eventually support listing intelligence and occupancy comparisons.",
  },
  {
    id: "pine",
    name: "Pine Ridge Lodge",
    city: "Gatlinburg",
    shortName: "PR",
    address: "Gatlinburg, TN",
    airbnbUrl: "https://airbnb.com/rooms/example",
    iCalUrl: "https://example.com/pine.ics",
    setupMode: "Airbnb",
    defaultCleanerId: "maria",
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 10,
    status: "Active",
    notes: "Needs stronger vendor coverage during peak season.",
  },
  {
    id: "lake",
    name: "Lakeview Retreat",
    city: "Branson",
    shortName: "LR",
    address: "Branson, MO",
    setupMode: "Manual",
    defaultCleanerId: "jordan",
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 6,
    status: "Setup Needed",
    notes: "Manual setup started. Add calendar feed when available.",
  },
];

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

const starterReservations: Reservation[] = [
  {
    id: "res-1001",
    guestName: "Miller Family",
    homeId: "coates",
    source: "VRBO",
    arrival: "2026-05-16",
    departure: "2026-05-19",
    status: "Assigned",
    cleanerId: "aarthi",
    notes: "Back-to-back turnover. Check hot tub towels.",
    timeline: ["Imported from VRBO", "Turnover created", "Assigned to Aarthi"],
  },
  {
    id: "res-1002",
    guestName: "Owner Deep Clean",
    homeId: "pine",
    source: "Manual",
    arrival: "2026-05-20",
    departure: "2026-05-20",
    status: "New",
    notes: "Manual reservation for deep clean and restock.",
    timeline: ["Manual reservation created"],
  },
  {
    id: "res-1003",
    guestName: "Thompson Stay",
    homeId: "lake",
    source: "Airbnb",
    arrival: "2026-05-22",
    departure: "2026-05-26",
    status: "Accepted",
    cleanerId: "jordan",
    notes: "Guest requested early check-in if possible.",
    timeline: ["Imported from Airbnb", "Assigned to Jordan", "Jordan accepted"],
  },
  {
    id: "res-1004",
    guestName: "Rivera Group",
    homeId: "coates",
    source: "VRBO",
    arrival: "2026-05-19",
    departure: "2026-05-23",
    status: "New",
    notes: "Same-day arrival after Miller departure.",
    timeline: ["Imported from VRBO", "B2B risk detected"],
  },
];

const starterBlocks: CalendarBlock[] = [
  {
    id: "block-1",
    homeId: "coates",
    type: "Owner Block",
    title: "Owner Weekend",
    start: "2026-05-29",
    end: "2026-05-31",
    notes: "Owner using property.",
  },
  {
    id: "block-2",
    homeId: "pine",
    type: "Maintenance",
    title: "HVAC Service",
    start: "2026-05-23",
    end: "2026-05-23",
    notes: "Vendor window 10 AM - 2 PM.",
  },
];

const vendors: Vendor[] = [
  { id: "vendor-hvac", name: "Summit HVAC", category: "HVAC", phone: "555-1200", rating: 4.9, afterHours: true },
  { id: "vendor-plumb", name: "Rapid Rooter", category: "Plumbing", phone: "555-4421", rating: 4.7, afterHours: true },
  { id: "vendor-elec", name: "BrightLine Electric", category: "Electrical", phone: "555-3390", rating: 4.8, afterHours: false },
  { id: "vendor-handyman", name: "Cabin Care Pros", category: "General", phone: "555-7731", rating: 4.6, afterHours: false },
];

const starterWorkOrders: WorkOrder[] = [
  {
    id: "wo-1001",
    homeId: "pine",
    title: "HVAC not cooling consistently",
    category: "HVAC",
    urgency: "High",
    status: "Scheduled",
    vendorId: "vendor-hvac",
    createdDate: "2026-05-12",
    scheduledDate: "2026-05-23",
    notes: "Guest reported warm upstairs bedroom. Vendor window already added to calendar.",
    timeline: ["Issue created", "Vendor recommended", "Service scheduled"],
  },
  {
    id: "wo-1002",
    homeId: "coates",
    title: "Loose deck railing",
    category: "General",
    urgency: "Medium",
    status: "Owner Review",
    vendorId: "vendor-handyman",
    createdDate: "2026-05-11",
    notes: "Cleaner flagged during turnover. Needs owner approval before dispatch.",
    timeline: ["Cleaner reported issue", "Photo review requested", "Owner review needed"],
  },
  {
    id: "wo-1003",
    homeId: "lake",
    title: "Kitchen sink slow drain",
    category: "Plumbing",
    urgency: "After Hours",
    status: "New",
    createdDate: "2026-05-12",
    notes: "Potential guest-impacting issue. Recommend after-hours plumber if guest is currently in home.",
    timeline: ["Issue created", "After-hours risk detected"],
  },
];

const starterNotifications: OwnerNotification[] = [
  {
    id: "note-1",
    type: "Reservation",
    priority: "High",
    title: "B2B turnover detected",
    message: "Coates Cabin has a same-day departure and arrival on May 19. Confirm cleaner timing.",
    relatedHomeId: "coates",
    relatedCleanerId: "aarthi",
    createdAt: "2026-05-12 09:10",
    read: false,
  },
  {
    id: "note-2",
    type: "Maintenance",
    priority: "Critical",
    title: "After-hours maintenance risk",
    message: "Lakeview Retreat has a slow kitchen drain flagged as after-hours risk.",
    relatedHomeId: "lake",
    createdAt: "2026-05-12 10:25",
    read: false,
  },
  {
    id: "note-3",
    type: "Cleaner",
    priority: "Normal",
    title: "Cleaner accepted assignment",
    message: "Jordan accepted the Thompson Stay turnover.",
    relatedHomeId: "lake",
    relatedCleanerId: "jordan",
    createdAt: "2026-05-12 11:05",
    read: true,
  },
  {
    id: "note-4",
    type: "Property",
    priority: "Normal",
    title: "Property setup incomplete",
    message: "Lakeview Retreat is missing an iCal feed.",
    relatedHomeId: "lake",
    createdAt: "2026-05-12 12:00",
    read: false,
  },
];

const statusOrder: ReservationStatus[] = [
  "New",
  "Assigned",
  "Accepted",
  "Cleaning",
  "Ready",
  "Needs Review",
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
  const cleaner = starterCleaners.find((item) => item.id === cleanerId);

  if (status === "Assigned" && cleaner) {
    return `Assigned to ${cleaner.name}`;
  }

  if (status === "Accepted" && cleaner) {
    return `${cleaner.name} accepted assignment`;
  }

  if (status === "Cleaning") {
    return "Cleaner marked cleaning in progress";
  }

  if (status === "Ready") {
    return "Cleaner marked home ready";
  }

  if (status === "Needs Review") {
    return "Flagged for owner review";
  }

  if (status === "Completed") {
    return "Turnover completed";
  }

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

export default function App() {
  const [activePage, setActivePage] = useState("Reservation Board");
  const [homes, setHomes] = useState<Home[]>(starterHomes);
  const [cleaners, setCleaners] = useState<Cleaner[]>(starterCleaners);
  const [reservations, setReservations] = useState<Reservation[]>(starterReservations);
  const [calendarBlocks] = useState<CalendarBlock[]>(starterBlocks);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(starterWorkOrders);
  const [notifications, setNotifications] = useState<OwnerNotification[]>(starterNotifications);
  const [selectedHome, setSelectedHome] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedCalendarHome, setSelectedCalendarHome] = useState(homes[0]?.id ?? "all");
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 4, 1));
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<Reservation | CalendarBlock | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(starterWorkOrders[0]);
  const [workOrderFilter, setWorkOrderFilter] = useState("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState(starterHomes[0]?.id ?? "");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
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
  const [selectedCleanerId, setSelectedCleanerId] = useState(starterCleaners[0]?.id ?? "");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [manualForm, setManualForm] = useState({
    guestName: "",
    homeId: homes[0]?.id ?? "",
    source: "Manual" as ReservationSource,
    arrival: "",
    departure: "",
    notes: "",
  });

  const filteredReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        const home = homes.find((item) => item.id === reservation.homeId);
        const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);
        const combined = `${reservation.guestName} ${home?.name ?? ""} ${cleaner?.name ?? ""} ${reservation.source}`.toLowerCase();

        if (selectedHome !== "all" && reservation.homeId !== selectedHome) return false;
        if (selectedStatus !== "all" && reservation.status !== selectedStatus) return false;
        if (search.trim() && !combined.includes(search.trim().toLowerCase())) return false;

        return true;
      })
      .sort((a, b) => a.arrival.localeCompare(b.arrival));
  }, [reservations, search, selectedHome, selectedStatus]);

  const boardStats = useMemo(() => {
    return {
      total: reservations.length,
      unassigned: reservations.filter((item) => !item.cleanerId).length,
      needsReview: reservations.filter((item) => item.status === "Needs Review").length,
      ready: reservations.filter((item) => item.status === "Ready").length,
    };
  }, [reservations]);

  const calendarDays = useMemo(
    () => getMonthDays(calendarDate.getFullYear(), calendarDate.getMonth()),
    [calendarDate]
  );

  const visibleCalendarReservations = useMemo(() => {
    return reservations.filter((reservation) => selectedCalendarHome === "all" || reservation.homeId === selectedCalendarHome);
  }, [reservations, selectedCalendarHome]);

  const visibleCalendarBlocks = useMemo(() => {
    return calendarBlocks.filter((block) => selectedCalendarHome === "all" || block.homeId === selectedCalendarHome);
  }, [calendarBlocks, selectedCalendarHome]);

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
    setReservations((current) => current.filter((reservation) => reservation.id !== id));
    if (selectedCalendarItem && "guestName" in selectedCalendarItem && selectedCalendarItem.id === id) {
      setSelectedCalendarItem(null);
    }
  }

  function createManualReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manualForm.guestName || !manualForm.arrival || !manualForm.departure) return;

    const nextReservation: Reservation = {
      id: `res-${Date.now()}`,
      guestName: manualForm.guestName,
      homeId: manualForm.homeId,
      source: manualForm.source,
      arrival: manualForm.arrival,
      departure: manualForm.departure,
      status: "New",
      notes: manualForm.notes,
      timeline: ["Manual reservation created"],
    };

    setReservations((current) => [nextReservation, ...current]);
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

  function moveCalendarMonth(direction: number) {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function renderReservationBoard() {
    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Phase 1</p>
            <h2>Reservation Board</h2>
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
            <strong>{boardStats.ready}</strong>
          </div>
          <div className="statCard warning">
            <span>Needs review</span>
            <strong>{boardStats.needsReview}</strong>
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
                    <h3>{reservation.guestName}</h3>
                    <p>{home?.name ?? "Unknown home"}</p>
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
                          status: event.target.value ? "Assigned" : "New",
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

                {reservation.notes && <p className="notesBox">{reservation.notes}</p>}

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
                        status: reservation.status === "Needs Review" ? "Ready" : "Needs Review",
                      })
                    }
                  >
                    {reservation.status === "Needs Review" ? "Mark Ready" : "Needs Review"}
                  </button>
                  <button onClick={() => updateReservation(reservation.id, { status: "Completed" })}>Complete</button>
                  <button className="dangerButton" onClick={() => deleteReservation(reservation.id)}>
                    Delete
                  </button>
                </div>

                <div className="cleanerFooter">
                  <span>Cleaner status</span>
                  <strong>{cleaner ? `${cleaner.name} · ${cleaner.status}` : "No cleaner assigned"}</strong>
                </div>
              </article>
            );
          })}
        </section>
      </>
    );
  }

  function renderManualForm() {
    if (!showManualForm) return null;

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
              <option value="VRBO">VRBO</option>
              <option value="Airbnb">Airbnb</option>
            </select>
          </label>

          <label>
            Arrival / start
            <input
              type="date"
              value={manualForm.arrival}
              onChange={(event) => setManualForm({ ...manualForm, arrival: event.target.value })}
            />
          </label>

          <label>
            Departure / end
            <input
              type="date"
              value={manualForm.departure}
              onChange={(event) => setManualForm({ ...manualForm, departure: event.target.value })}
            />
          </label>

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
              See property stays, same-day turnovers, owner blocks, maintenance blocks, and cleaner visibility.
            </p>
          </div>

          <div className="calendarHeaderActions">
            <button className="ghostButton" onClick={() => moveCalendarMonth(-1)}>
              Previous
            </button>
            <button className="ghostButton" onClick={() => setCalendarDate(new Date(2026, 4, 1))}>
              May 2026
            </button>
            <button className="ghostButton" onClick={() => moveCalendarMonth(1)}>
              Next
            </button>
          </div>
        </header>

        <section className="calendarToolbar">
          <div>
            <span>Calendar month</span>
            <strong>
              {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
            </strong>
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
          <div className="calendarPanel">
            <div className="weekdayGrid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="calendarGrid">
              {calendarDays.map((day) => {
                const dateKey = toInputDate(day.date);
                const dayReservations = visibleCalendarReservations.filter((reservation) =>
                  isDateInRange(day.date, reservation.arrival, reservation.departure)
                );
                const dayBlocks = visibleCalendarBlocks.filter((block) => isDateInRange(day.date, block.start, block.end));
                const arrivals = visibleCalendarReservations.filter((reservation) => isSameDay(day.date, reservation.arrival));
                const departures = visibleCalendarReservations.filter((reservation) => isSameDay(day.date, reservation.departure));
                const isB2B = arrivals.length > 0 && departures.length > 0;

                return (
                  <div className={`calendarDay ${day.inMonth ? "" : "mutedDay"}`} key={dateKey}>
                    <div className="dayTop">
                      <span>{day.date.getDate()}</span>
                      {isB2B && <strong className="b2bBadge">B2B</strong>}
                    </div>

                    <div className="dayEvents">
                      {dayReservations.slice(0, 3).map((reservation) => {
                        const home = homes.find((item) => item.id === reservation.homeId);
                        const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);

                        return (
                          <button
                            key={`${dateKey}-${reservation.id}`}
                            className={`calendarEvent source${reservation.source.replace(/\s/g, "")}`}
                            onClick={() => setSelectedCalendarItem(reservation)}
                            title={`${reservation.guestName} · ${home?.name ?? ""}`}
                          >
                            <span>{reservation.guestName}</span>
                            <small>{cleaner?.name ?? "Unassigned"}</small>
                          </button>
                        );
                      })}

                      {dayBlocks.map((block) => (
                        <button
                          key={`${dateKey}-${block.id}`}
                          className={`calendarEvent block${block.type.replace(/\s/g, "")}`}
                          onClick={() => setSelectedCalendarItem(block)}
                          title={block.title}
                        >
                          <span>{block.title}</span>
                          <small>{block.type}</small>
                        </button>
                      ))}

                      {dayReservations.length > 3 && <p className="moreEvents">+{dayReservations.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="calendarDetailPanel">
            <p className="eyebrow">Selected item</p>
            {!selectedCalendarItem ? (
              <>
                <h3>Click a reservation or block</h3>
                <p className="mutedText">Details will show here without leaving the calendar.</p>
              </>
            ) : "guestName" in selectedCalendarItem ? (
              <>
                <h3>{selectedCalendarItem.guestName}</h3>
                <p className="mutedText">
                  {homes.find((home) => home.id === selectedCalendarItem.homeId)?.name ?? "Unknown home"}
                </p>

                <div className="detailStack">
                  <div>
                    <span>Stay</span>
                    <strong>
                      {formatDate(selectedCalendarItem.arrival)} → {formatDate(selectedCalendarItem.departure)}
                    </strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{selectedCalendarItem.status}</strong>
                  </div>
                  <div>
                    <span>Cleaner</span>
                    <strong>
                      {cleaners.find((cleaner) => cleaner.id === selectedCalendarItem.cleanerId)?.name ?? "Unassigned"}
                    </strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{selectedCalendarItem.source}</strong>
                  </div>
                </div>

                {selectedCalendarItem.notes && <p className="notesBox">{selectedCalendarItem.notes}</p>}

                <div className="cardActions">
                  <button
                    onClick={() => {
                      updateReservation(selectedCalendarItem.id, { status: "Needs Review" });
                      setSelectedCalendarItem({ ...selectedCalendarItem, status: "Needs Review" });
                    }}
                  >
                    Needs Review
                  </button>
                  <button
                    onClick={() => {
                      updateReservation(selectedCalendarItem.id, { status: "Completed" });
                      setSelectedCalendarItem({ ...selectedCalendarItem, status: "Completed" });
                    }}
                  >
                    Complete
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{selectedCalendarItem.title}</h3>
                <p className="mutedText">
                  {homes.find((home) => home.id === selectedCalendarItem.homeId)?.name ?? "Unknown home"}
                </p>

                <div className="detailStack">
                  <div>
                    <span>Type</span>
                    <strong>{selectedCalendarItem.type}</strong>
                  </div>
                  <div>
                    <span>Dates</span>
                    <strong>
                      {formatDate(selectedCalendarItem.start)} → {formatDate(selectedCalendarItem.end)}
                    </strong>
                  </div>
                </div>

                {selectedCalendarItem.notes && <p className="notesBox">{selectedCalendarItem.notes}</p>}
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


  function createProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!propertyForm.name.trim() || !propertyForm.city.trim()) return;

    const shortName = propertyForm.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const nextHome: Home = {
      id: `home-${Date.now()}`,
      name: propertyForm.name,
      city: propertyForm.city,
      shortName: shortName || "HM",
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
    };

    setHomes((current) => [...current, nextHome]);
    setSelectedPropertyId(nextHome.id);
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

  function updateProperty(id: string, updates: Partial<Home>) {
    setHomes((current) => current.map((home) => (home.id === id ? { ...home, ...updates } : home)));
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

          <button className="primaryButton" onClick={() => setShowPropertyForm(true)}>
            + Create Home Profile
          </button>
        </header>

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

        {showPropertyForm && (
          <section className="manualPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Create home profile</p>
                <h3>Add Property</h3>
              </div>
              <button className="ghostButton" onClick={() => setShowPropertyForm(false)}>
                Close
              </button>
            </div>

            <form className="propertyForm" onSubmit={createProperty}>
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

              <label>
                VRBO property ID
                <input
                  value={propertyForm.vrboId}
                  onChange={(event) => setPropertyForm({ ...propertyForm, vrboId: event.target.value })}
                  placeholder="VRBO ID"
                />
              </label>

              <label>
                Airbnb listing URL
                <input
                  value={propertyForm.airbnbUrl}
                  onChange={(event) => setPropertyForm({ ...propertyForm, airbnbUrl: event.target.value })}
                  placeholder="https://airbnb.com/rooms/..."
                />
              </label>

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
                Save Home Profile
              </button>
            </form>
          </section>
        )}

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
                  onClick={() => setSelectedPropertyId(home.id)}
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

          <button className="primaryButton" onClick={() => setWorkOrderFilter("after-hours")}>
            After-Hours Risks
          </button>
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

  function markNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    );
  }

  function renderDashboard() {
    const upcomingReservations = reservations
      .filter((reservation) => reservation.status !== "Completed")
      .sort((a, b) => a.arrival.localeCompare(b.arrival))
      .slice(0, 4);
    const openWorkOrders = workOrders.filter((order) => order.status !== "Completed");
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    const availableCleaners = cleaners.filter((cleaner) => cleaner.status === "Available").length;

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h2>Dashboard</h2>
            <p className="headerSubtext">
              A quick command center for upcoming turnovers, alerts, properties, cleaners, and maintenance risks.
            </p>
          </div>

          <button className="primaryButton" onClick={() => setActivePage("Reservation Board")}>
            Open Reservation Board
          </button>
        </header>

        <section className="statsGrid">
          <div className="statCard">
            <span>Homes</span>
            <strong>{homes.length}</strong>
          </div>
          <div className="statCard">
            <span>Upcoming stays</span>
            <strong>{reservations.filter((reservation) => reservation.status !== "Completed").length}</strong>
          </div>
          <div className="statCard">
            <span>Available cleaners</span>
            <strong>{availableCleaners}</strong>
          </div>
          <div className="statCard warning">
            <span>Unread alerts</span>
            <strong>{unreadCount}</strong>
          </div>
        </section>

        <section className="dashboardGrid">
          <article className="dashboardPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Next up</p>
                <h3>Upcoming turnovers</h3>
              </div>
              <button className="ghostButton" onClick={() => setActivePage("Calendar")}>Calendar</button>
            </div>

            <div className="dashboardList">
              {upcomingReservations.map((reservation) => {
                const home = homes.find((item) => item.id === reservation.homeId);
                const cleaner = cleaners.find((item) => item.id === reservation.cleanerId);

                return (
                  <button key={reservation.id} onClick={() => setActivePage("Reservation Board")}>
                    <strong>{reservation.guestName}</strong>
                    <span>{home?.name ?? "Unknown home"} · {formatDate(reservation.arrival)}</span>
                    <small>{cleaner?.name ?? "Unassigned"} · {reservation.status}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="dashboardPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Alerts</p>
                <h3>Notification center</h3>
              </div>
              <button className="ghostButton" onClick={() => setActivePage("Notification Center")}>Open</button>
            </div>

            <div className="dashboardList">
              {notifications.slice(0, 4).map((notification) => (
                <button key={notification.id} onClick={() => setActivePage("Notification Center")}>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <small>{notification.priority} · {notification.read ? "Read" : "Unread"}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="dashboardPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Maintenance</p>
                <h3>Open work orders</h3>
              </div>
              <button className="ghostButton" onClick={() => setActivePage("Maintenance")}>Open</button>
            </div>

            <div className="dashboardList">
              {openWorkOrders.slice(0, 4).map((order) => {
                const home = homes.find((item) => item.id === order.homeId);

                return (
                  <button key={order.id} onClick={() => setActivePage("Maintenance")}>
                    <strong>{order.title}</strong>
                    <span>{home?.name ?? "Unknown home"} · {order.category}</span>
                    <small>{order.urgency} · {order.status}</small>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="dashboardPanel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Cleaner coverage</p>
                <h3>Cleaner operations</h3>
              </div>
              <button className="ghostButton" onClick={() => setActivePage("Cleaners")}>Open</button>
            </div>

            <div className="cleanerMiniGrid">
              {cleaners.map((cleaner) => (
                <button key={cleaner.id} onClick={() => { setSelectedCleanerId(cleaner.id); setActivePage("Cleaners"); }}>
                  <strong>{cleaner.name}</strong>
                  <span>{cleaner.serviceArea}</span>
                  <small>{cleaner.status} · {cleaner.activeJobs} active</small>
                </button>
              ))}
            </div>
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

          <button className="primaryButton" onClick={() => setActivePage("Reservation Board")}>
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
                  {notification.type === "Reservation" && <button onClick={() => setActivePage("Reservation Board")}>Open Reservations</button>}
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

  function renderPlaceholder() {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Stable checkpoint</p>
        <h2>{activePage}</h2>
        <p>
          This module is parked for a later phase so the Reservation Board and Calendar can stay stable.
        </p>
        <button className="primaryButton" onClick={() => setActivePage("Reservation Board")}>
          Go to Reservation Board
        </button>
      </section>
    );
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon">AMR</div>
          <div>
            <h1>Ask My Rentals</h1>
            <p>Owner Operations</p>
          </div>
        </div>

        <nav className="nav">
          {["Dashboard", "Reservation Board", "Calendar", "Properties", "Cleaners", "Maintenance", "Notification Center"].map(
            (item) => (
              <button
                key={item}
                className={activePage === item ? "active" : ""}
                onClick={() => setActivePage(item)}
              >
                {item}
              </button>
            )
          )}
        </nav>

        <div className="quickLinksBox">
          <div className="quickLinksHeader">Quick Links</div>
          <button
            onClick={() => {
              setActivePage("Reservation Board");
              setShowManualForm(true);
            }}
          >
            Add Manual Reservation
          </button>
          <button
            onClick={() => {
              setActivePage("Dashboard");
            }}
          >
            Open Dashboard
          </button>
          <button
            onClick={() => {
              setActivePage("Calendar");
              setSelectedCalendarHome("all");
            }}
          >
            View Full Calendar
          </button>
          <button
            onClick={() => {
              setActivePage("Reservation Board");
              setSelectedStatus("New");
            }}
          >
            Unassigned / New
          </button>
          <button
            onClick={() => {
              setActivePage("Properties");
              setShowPropertyForm(true);
            }}
          >
            Create Home Profile
          </button>
          <button
            onClick={() => {
              setActivePage("Maintenance");
              setWorkOrderFilter("after-hours");
            }}
          >
            Maintenance Risks
          </button>
          <button
            onClick={() => {
              setActivePage("Reservation Board");
              setSelectedStatus("Needs Review");
            }}
          >
            Needs Owner Review
          </button>
        </div>
      </aside>

      <main className="mainContent">
        {activePage === "Reservation Board" && renderReservationBoard()}
        {activePage === "Calendar" && renderCalendar()}
        {activePage === "Dashboard" && renderDashboard()}
        {activePage === "Reservation Board" && renderReservationBoard()}
        {activePage === "Calendar" && renderCalendar()}
        {activePage === "Properties" && renderProperties()}
        {activePage === "Cleaners" && renderCleaners()}
        {activePage === "Maintenance" && renderMaintenance()}
        {activePage === "Notification Center" && renderNotificationCenter()}
        {!["Dashboard", "Reservation Board", "Calendar", "Properties", "Cleaners", "Maintenance", "Notification Center"].includes(activePage) && renderPlaceholder()}
      </main>
    </div>
  );
}
