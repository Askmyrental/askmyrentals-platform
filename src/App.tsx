import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CleanerPortal from "./components/CleanerPortal";
type Page =
  | "dashboard"
  | "properties"
  | "calendar"
  | "notifications"
  | "cleaners"
  | "cleanerPortal"
  | "records";

type ReadyStatus =
  | "Assigned"
  | "Accepted"
  | "On The Way"
  | "Cleaning"
  | "Ready"
  | "Attention Needed";
 

type MessageSender = "Homeowner" | "Cleaner" | "System";

type Property = {
  id: number;
  name: string;
  location: string;
  description: string;
  cleaner: string;
  icalUrl: string;
  vrboId: string;
  airbnbUrl: string;
  imageUrl: string;
  syncStatus: string;
};

type UrgencyLevel = "urgent" | "attention" | "normal";

type CleaningItem = {
  id: number;
  propertyId: number;
  property: string;
  cleaner: string;
  departure: string;
  arrival: string;
  checkoutDate?: string;
  checkOutDate?: string;
  cleaningDate?: string;
  type: "Guest Booking" | "Deep Clean" | "Owner Stay";
  status: ReadyStatus;
  cleanerStatus?: string;
  assignmentStatus?: string;
  assignedCleanerId?: string | number | null;
  lastUpdate: string;
  guestName?: string;
  requiresChecklist?: boolean;
  checklistCompleted?: boolean;
  urgencyLevel?: UrgencyLevel;
  urgencyReasons?: string[];
  lastUrgencyCheck?: string;
};

type ActivityRecord = {
  id: number;
  time: string;
  event: string;
  source: "System" | "Homeowner" | "Cleaner" | "Guest";
  createdAt?: string;
};

type AppMessage = {
  id: number;
  time: string;
  createdAt: string;
  property: string;
  cleaner: string;
  sender: MessageSender;
  text: string;
  category: "General" | "ETA Request" | "Early Arrival" | "Issue" | "Ready Update";
};

const STORAGE_KEY = "cleaner-app-state-v1";
const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8787";

const API_URL = `${API_BASE}/api/app-data`;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const cleaners = [
  { name: "Libby", status: "Available", assigned: "Sea Otz" },
  { name: "Ashley", status: "Available", assigned: "Not assigned" },
  { name: "Maria", status: "Unavailable", assigned: "Not assigned" },
];

const statusHelp: Record<ReadyStatus, string> = {
  Assigned: "Cleaner has been assigned but the home has not been accepted yet.",
  Accepted: "Cleaner accepted this cleaning.",
  "On The Way": "Cleaner is on the way.",
  Cleaning: "Cleaner is currently cleaning.",
  Ready: "Cleaner confirmed the property is guest-ready.",
  "Attention Needed": "Guest arrival is approaching and the home has not been marked ready.",
};

const defaultProperties: Property[] = [
  {
    id: 1,
    name: "Sea Otz",
    location: "Beach Property",
    description: "A beautiful vacation home ready for guest turnovers and owner stays.",
    cleaner: "Libby",
    icalUrl: "",
    vrboId: "",
    airbnbUrl: "",
    imageUrl: "",
    syncStatus: "No calendar synced yet",
  },
];

function todayTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayDateTime() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function makeRecord(
  event: string,
  source: ActivityRecord["source"] = "System"
): ActivityRecord {
  const now = new Date();

  return {
    id: now.getTime() + Math.floor(Math.random() * 1000),
    time: todayDateTime(),
    event,
    source,
    createdAt: now.toISOString(),
  };
}

function makeMessage(
  property: string,
  cleaner: string,
  sender: MessageSender,
  text: string,
  category: AppMessage["category"] = "General"
): AppMessage {
  const now = new Date();

  return {
    id: now.getTime() + Math.floor(Math.random() * 1000),
    time: todayDateTime(),
    createdAt: now.toISOString(),
    property,
    cleaner,
    sender,
    text,
    category,
  };
}

function formatIcalDate(raw: string) {
  if (!raw) return "";
  const value = raw.trim().replace("Z", "");
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function unfoldIcal(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function getIcalValue(event: string, key: string) {
  const line = event.split(/\r?\n/).find((item) => item.startsWith(key));
  if (!line) return "";
  return line.split(":").slice(1).join(":").trim();
}

function parseIcalBookings(text: string, property: Property): CleaningItem[] {
  const unfolded = unfoldIcal(text);
  const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  return events
    .map((event, index) => {
      const startLine = event.split(/\r?\n/).find((line) => line.startsWith("DTSTART"));
      const endLine = event.split(/\r?\n/).find((line) => line.startsWith("DTEND"));

      if (!startLine || !endLine) return null;

      const arrival = formatIcalDate(startLine.split(":")[1]);
      const departure = formatIcalDate(endLine.split(":")[1]);

      if (!arrival || !departure) return null;

      const summary = getIcalValue(event, "SUMMARY") || property.name;
      const lowerSummary = summary.toLowerCase();

      const type =
        lowerSummary.includes("owner") ||
        lowerSummary.includes("block") ||
        lowerSummary.includes("blocked")
          ? ("Owner Stay" as const)
          : ("Guest Booking" as const);

      return {
        id: Date.now() + index,
        propertyId: property.id,
        property: property.name,
        cleaner: property.cleaner || "Unassigned",
        arrival,
        departure,
        type,
        status: "Assigned" as const,
        lastUpdate: todayTime(),
        guestName: summary,
      };
    })
    .filter(Boolean) as CleaningItem[];
}

function isDateBetweenInclusive(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function daysUntilDate(dateValue: string) {
  if (!dateValue) return null;

  const now = new Date();
  const target = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(target.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  return Math.ceil(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function calculateUrgency(item: CleaningItem): Pick<
  CleaningItem,
  "urgencyLevel" | "urgencyReasons" | "lastUrgencyCheck"
> {
  const reasons: string[] = [];
  const status = String(item.status || "").toLowerCase();
  const cleanerStatus = String(
    item.cleanerStatus || item.assignmentStatus || item.status || ""
  ).toLowerCase();
  const cleanerAssigned =
    Boolean(item.cleaner && item.cleaner !== "Unassigned") || Boolean(item.assignedCleanerId);
  const keyDate = item.checkoutDate || item.checkOutDate || item.cleaningDate || item.departure;
  const days = daysUntilDate(keyDate);

  if (status !== "ready") {
    if (days !== null && days < 0) reasons.push("Turnover is overdue");
    if (days !== null && days <= 1 && days >= 0) {
      reasons.push("Turnover is due today or tomorrow");
    }
    if (!cleanerAssigned) reasons.push("No cleaner assigned");
    if (status === "attention needed") reasons.push("Cleaner requested help");
    if (cleanerStatus === "declined" || status === "declined" || status === "rejected") {
      reasons.push("Cleaner declined assignment");
    }
    if (
      cleanerAssigned &&
      !["accepted", "on the way", "cleaning", "ready", "confirmed", "completed"].includes(
        cleanerStatus
      )
    ) {
      reasons.push("Cleaner has not accepted yet");
    }
    if (item.requiresChecklist && !item.checklistCompleted) {
      reasons.push("Checklist is missing");
    }
  }

  const urgentReasons = [
    "Turnover is overdue",
    "Turnover is due today or tomorrow",
    "No cleaner assigned",
    "Cleaner declined assignment",
    "Cleaner requested help",
  ];

  const urgencyLevel: UrgencyLevel = reasons.some((reason) => urgentReasons.includes(reason))
    ? "urgent"
    : reasons.length > 0
      ? "attention"
      : "normal";

  return {
    urgencyLevel,
    urgencyReasons: reasons,
    lastUrgencyCheck: new Date().toISOString(),
  };
}

function withUrgency(item: CleaningItem): CleaningItem {
  return {
    ...item,
    ...calculateUrgency(item),
  };
}

function normalizeCleanings(cleanings: CleaningItem[] | undefined) {
  if (!Array.isArray(cleanings)) return [];
  return cleanings.map((item) => withUrgency(item));
}

function urgencyRank(level?: UrgencyLevel) {
  if (level === "urgent") return 0;
  if (level === "attention") return 1;
  return 2;
}

function urgencyLabel(level?: UrgencyLevel) {
  if (level === "urgent") return "Urgent";
  if (level === "attention") return "Needs Attention";
  return "Normal";
}

function urgencyStyle(level?: UrgencyLevel): React.CSSProperties {
  if (level === "urgent") {
    return {
      display: "inline-flex",
      alignItems: "center",
      width: "fit-content",
      borderRadius: "999px",
      padding: "5px 10px",
      background: "#fee2e2",
      color: "#991b1b",
      fontWeight: 900,
      fontSize: "12px",
      border: "1px solid #fecaca",
    };
  }

  if (level === "attention") {
    return {
      display: "inline-flex",
      alignItems: "center",
      width: "fit-content",
      borderRadius: "999px",
      padding: "5px 10px",
      background: "#fef3c7",
      color: "#92400e",
      fontWeight: 900,
      fontSize: "12px",
      border: "1px solid #fde68a",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    borderRadius: "999px",
    padding: "5px 10px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 900,
    fontSize: "12px",
    border: "1px solid #bbf7d0",
  };
}


function cleanReservationLabel(label: string) {
  return label
    .replace("Reserved - ", "")
    .replace("Reserved-", "")
    .replace("Reserved", "")
    .trim() || "Reserved";
}

function normalizeRecords(records: ActivityRecord[] | undefined) {
  if (!Array.isArray(records)) return [];

  return records.map((record, index) => ({
    ...record,
    id: record.id || Date.now() + index,
    time: record.time || "Unknown time",
    event: record.event || "Record saved.",
    source: record.source || "System",
  }));
}

function normalizeMessages(messages: AppMessage[] | undefined) {
  if (!Array.isArray(messages)) return [];

  return messages.map((message, index) => ({
    ...message,
    id: message.id || Date.now() + index,
    time: message.time || "Unknown time",
    createdAt: message.createdAt || new Date().toISOString(),
    property: message.property || "Unknown property",
    cleaner: message.cleaner || "Unassigned",
    sender: message.sender || "System",
    text: message.text || "",
    category: message.category || "General",
  }));
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    return {
      properties: Array.isArray(parsed?.properties)
        ? parsed.properties
        : defaultProperties,
      cleanings: normalizeCleanings(parsed?.turnovers || parsed?.cleanings),
      records: normalizeRecords(parsed?.records),
      messages: normalizeMessages(parsed?.messages),
    };
  } catch {
    return null;
  }
}

function saveStateToStorage(state: {
  properties: Property[];
  cleanings: CleaningItem[];
  records: ActivityRecord[];
  messages: AppMessage[];
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const savedState = loadSavedState();

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const [page, setPage] = useState<Page>("dashboard");
  const [calendarYear, setCalendarYear] = useState(currentYear);
  const calendarMonthRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [activeTab, setActiveTab] = useState<
    "urgent" | "pending" | "confirmed" | "early" | "message"
  >("urgent");

  const [properties, setProperties] = useState<Property[]>(
    savedState?.properties || defaultProperties
  );

  const [cleanings, setCleanings] = useState<CleaningItem[]>(
    savedState?.cleanings || []
  );

  const [records, setRecords] = useState<ActivityRecord[]>(
    savedState?.records?.length
      ? savedState.records
      : [makeRecord("App opened. No reservations loaded yet.")]
  );

  const [messages, setMessages] = useState<AppMessage[]>(
    savedState?.messages || []
  );

  const [recordSearch, setRecordSearch] = useState("");
  const [recordSourceFilter, setRecordSourceFilter] = useState<
    "All" | ActivityRecord["source"]
  >("All");
  const [recordSaveStatus, setRecordSaveStatus] = useState("Saved locally");

  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

  const [manualPropertyId, setManualPropertyId] = useState(1);
  const [manualArrival, setManualArrival] = useState("");
  const [manualDeparture, setManualDeparture] = useState("");
  const [manualGuestName, setManualGuestName] = useState("");
  const [manualType, setManualType] =
    useState<CleaningItem["type"]>("Guest Booking");

  const [selectedCleaner, setSelectedCleaner] = useState("Libby");
  const [selectedProperty, setSelectedProperty] = useState("Sea Otz");
  const [message, setMessage] = useState("");
  const [cleanerReplyText, setCleanerReplyText] = useState("");
  const [cleanerPortalFilter, setCleanerPortalFilter] = useState("All");

  useEffect(() => {
    const loadBackend = async () => {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Backend load failed");
        }

        const data = await response.json();

        if (Array.isArray(data.properties) && data.properties.length > 0) {
          setProperties(data.properties);
        }

        const backendCleanings = Array.isArray(data.turnovers)
          ? data.turnovers
          : Array.isArray(data.cleanings)
            ? data.cleanings
            : [];

        if (backendCleanings.length > 0) {
          setCleanings(normalizeCleanings(backendCleanings));
        }

        if (Array.isArray(data.records) && data.records.length > 0) {
          setRecords(normalizeRecords(data.records));
        }

        if (Array.isArray(data.messages)) {
          setMessages(normalizeMessages(data.messages));
        }

        setRecordSaveStatus("Loaded from backend");
      } catch {
        setRecordSaveStatus("Using local browser data");
      }
    };

    loadBackend();
  }, []);

  useEffect(() => {
    const cleaningsWithUrgency = normalizeCleanings(cleanings);

    const saveLocal = saveStateToStorage({
      properties,
      cleanings: cleaningsWithUrgency,
      records,
      messages,
    });

    setRecordSaveStatus(saveLocal ? "Saved locally" : "Local storage issue");

    const saveBackend = async () => {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties,
            cleanings,
            records,
            messages,
            savedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error("Backend save failed");
        }

        setRecordSaveStatus("Saved to backend");
      } catch {
        setRecordSaveStatus("Saved locally only");
      }
    };

    saveBackend();
  }, [properties, cleanings, records, messages]);

  useEffect(() => {
    if (page === "calendar" && calendarYear === currentYear) {
      setTimeout(() => {
        calendarMonthRefs.current[currentMonth]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [page, calendarYear, currentMonth, currentYear]);

  const sortedCleanings = useMemo(() => {
    return normalizeCleanings(cleanings).sort((a, b) => {
      const urgencyDifference = urgencyRank(a.urgencyLevel) - urgencyRank(b.urgencyLevel);
      if (urgencyDifference !== 0) return urgencyDifference;
      return new Date(a.departure).getTime() - new Date(b.departure).getTime();
    });
  }, [cleanings]);

  const pendingCleanings = sortedCleanings.filter(
    (item) => item.status !== "Ready"
  );

  const readyCleanings = sortedCleanings.filter((item) => item.status === "Ready");

  const urgentCleanings = sortedCleanings.filter(
    (item) => item.urgencyLevel === "urgent"
  );

  const attentionCleanings = sortedCleanings.filter(
    (item) => item.urgencyLevel === "attention"
  );

  const activeAlertCleanings = sortedCleanings.filter(
    (item) => item.urgencyLevel === "urgent" || item.urgencyLevel === "attention"
  );

  const cleanerPortalItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return normalizeCleanings(cleanings)
      .filter((item) => item.departure >= today || item.arrival >= today)
      .filter((item) => {
        if (cleanerPortalFilter === "All") return true;
        return item.cleaner === cleanerPortalFilter;
      })
      .sort((a, b) => {
        const urgencyDifference = urgencyRank(a.urgencyLevel) - urgencyRank(b.urgencyLevel);
        if (urgencyDifference !== 0) return urgencyDifference;
        return new Date(a.departure).getTime() - new Date(b.departure).getTime();
      });
  }, [cleanings, cleanerPortalFilter]);

  const filteredRecords = useMemo(() => {
    const search = recordSearch.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSource =
        recordSourceFilter === "All" || record.source === recordSourceFilter;

      const matchesSearch =
        !search ||
        [record.time, record.event, record.source, record.createdAt || ""]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return matchesSource && matchesSearch;
    });
  }, [records, recordSearch, recordSourceFilter]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [messages]);

  const exportRecords = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `cleaner-app-records-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
    addRecord("Records exported.", "System");
  };

  const clearRecords = () => {
    const shouldClear = window.confirm(
      "Clear activity records from this browser and backend? Properties and reservations will stay saved."
    );

    if (!shouldClear) return;

    setRecords([makeRecord("Activity records cleared by homeowner.", "Homeowner")]);
    setRecordSearch("");
    setRecordSourceFilter("All");
  };

  const addRecord = (
    event: string,
    source: ActivityRecord["source"] = "System"
  ) => {
    setRecords((current) => [makeRecord(event, source), ...current]);
  };

  const addMessage = (
    property: string,
    cleaner: string,
    sender: MessageSender,
    text: string,
    category: AppMessage["category"] = "General"
  ) => {
    if (!text.trim()) return;

    const newMessage = makeMessage(
      property,
      cleaner,
      sender,
      text.trim(),
      category
    );

    setMessages((current) => [newMessage, ...current]);

    addRecord(
      `${sender} message sent to ${cleaner} for ${property}: ${text.trim()}`,
      sender === "Cleaner" ? "Cleaner" : "Homeowner"
    );
  };

  const sendHomeownerMessage = (
    category: AppMessage["category"] = "General",
    customText?: string
  ) => {
    const property =
      selectedProperty === "All" ? properties[0]?.name || "Property" : selectedProperty;
    const cleaner = selectedCleaner === "All" ? "Cleaner" : selectedCleaner;
    const text = customText || message;

    addMessage(property, cleaner, "Homeowner", text, category);
    setMessage("");
  };

  const sendCleanerReply = (
    item: CleaningItem,
    text: string,
    category: AppMessage["category"] = "General"
  ) => {
    addMessage(item.property, item.cleaner, "Cleaner", text, category);
    setCleanerReplyText("");
  };

  const updateProperty = (
    propertyId: number,
    field: keyof Property,
    value: string
  ) => {
    setProperties((current) =>
      current.map((property) =>
        property.id === propertyId ? { ...property, [field]: value } : property
      )
    );
  };

  const syncIcal = async (property: Property) => {
    if (!property.icalUrl.trim()) {
      alert("Add the iCal URL first, then click Sync iCal.");
      addRecord(`${property.name} iCal sync failed: no iCal URL saved.`);
      return;
    }

    try {
const response = await fetch(
  `${API_BASE}/api/sync-ical?url=${encodeURIComponent(
    property.icalUrl.trim()
  )}`
);

      if (!response.ok) {
        throw new Error("Calendar could not be fetched through proxy.");
      }

      const text = await response.text();
      const imported = parseIcalBookings(text, property);

      setCleanings((current) => {
        const withoutThisProperty = current.filter(
          (item) => item.propertyId !== property.id
        );

        return [...withoutThisProperty, ...normalizeCleanings(imported)];
      });

      setProperties((current) =>
        current.map((item) =>
          item.id === property.id
            ? {
                ...item,
                syncStatus: `${imported.length} reservations synced at ${todayTime()}`,
              }
            : item
        )
      );

      addRecord(`${imported.length} reservations imported from iCal for ${property.name}.`);
      alert(`${imported.length} reservations imported from iCal.`);
    } catch {
      addRecord(`${property.name} iCal sync failed through proxy.`);
      alert("iCal sync failed. Make sure server.cjs is running with: node server.cjs");
    }
  };

  const addManualReservation = () => {
    const property = properties.find((item) => item.id === manualPropertyId);

    if (!property || !manualArrival || !manualDeparture) {
      alert("Choose a property, arrival date, and departure date.");
      return;
    }

    const newCleaning: CleaningItem = {
      id: Date.now(),
      propertyId: property.id,
      property: property.name,
      cleaner: property.cleaner || "Unassigned",
      arrival: manualArrival,
      departure: manualDeparture,
      type: manualType,
      status: "Assigned",
      lastUpdate: todayTime(),
      guestName: manualGuestName || property.name,
    };

    setCleanings((current) => [...current, withUrgency(newCleaning)]);

    addRecord(
      `Manual reservation added for ${property.name}: ${manualArrival} to ${manualDeparture}.`,
      "Homeowner"
    );

    setManualArrival("");
    setManualDeparture("");
    setManualGuestName("");
    setManualType("Guest Booking");
  };

  const addAnotherHome = () => {
    const newHome: Property = {
      id: Date.now(),
      name: "New Home",
      location: "Add location",
      description: "Add a short description for this home.",
      cleaner: "",
      icalUrl: "",
      vrboId: "",
      airbnbUrl: "",
      imageUrl: "",
      syncStatus: "No calendar synced yet",
    };

    setProperties((current) => [...current, newHome]);
    setEditingPropertyId(newHome.id);
    addRecord("New home added by homeowner.", "Homeowner");
  };

  const removeHome = (property: Property) => {
    setProperties((current) => current.filter((item) => item.id !== property.id));
    setCleanings((current) => current.filter((item) => item.propertyId !== property.id));
    setConfirmRemoveId(null);
    addRecord(`${property.name} removed by homeowner.`, "Homeowner");
  };

  const linkVrbo = (property: Property) => {
    if (!property.vrboId.trim()) {
      alert("Add the VRBO listing ID first.");
      return;
    }

    addRecord(`${property.name} linked to VRBO listing ${property.vrboId}.`, "Homeowner");
    alert("VRBO listing saved. Full property import can be connected to a backend later.");
  };

  const linkAirbnb = (property: Property) => {
    if (!property.airbnbUrl.trim()) {
      alert("Add the Airbnb listing URL first.");
      return;
    }

    addRecord(`${property.name} linked to Airbnb URL.`, "Homeowner");
    alert("Airbnb listing saved. Full property import can be connected to a backend later.");
  };

   const updateStatus = (
    id: number,
    newStatus: ReadyStatus,
    source: ActivityRecord["source"] = "Homeowner"
  ) => {
    const item = cleanings.find((cleaning) => cleaning.id === id);
    if (!item) return;

   setCleanings((current) =>
  current.map((cleaning) =>
    cleaning.id === id
      ? withUrgency({
          ...cleaning,
          status: newStatus,
          cleanerStatus: newStatus,
          lastUpdate: todayTime(),
        })
      : cleaning
  )
);

    addRecord(`${item.property} status changed to ${newStatus}.`, source);

    if (source === "Cleaner" && newStatus === "Ready") {
      addMessage(
        item.property,
        item.cleaner,
        "Cleaner",
        `${item.property} is ready for the next guest.`,
        "Ready Update"
      );
    }
  };

  const getDaysInMonth = (year: number, monthIndex: number) => {
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const getStatusClass = (status: ReadyStatus) => {
    if (status === "Ready") return "status green";
    if (status === "Attention Needed") return "status red";
    return "status orange";
  };


  const urgencyBadge = (item: CleaningItem) => (
    <span
      style={urgencyStyle(item.urgencyLevel)}
      title={item.urgencyReasons?.length ? item.urgencyReasons.join(" • ") : "On track"}
    >
      {urgencyLabel(item.urgencyLevel)}
    </span>
  );

  const urgencyReasonText = (item: CleaningItem) =>
    item.urgencyReasons?.length ? item.urgencyReasons.join(" • ") : "On track";

  const navButton = (target: Page, label: string) => (
    <button
      className={page === target ? "nav-button active" : "nav-button"}
      onClick={() => {
        if (target === "calendar") {
          setCalendarYear(currentYear);
        }

        setPage(target);
      }}
    >
      {label}
    </button>
  );

  const getReservationBarColor = (type: CleaningItem["type"]) => {
    if (type === "Owner Stay") return "#dbeafe";
    return "#fef3c7";
  };

  const getCalendarItemsForDay = (dateString: string) => {
    return sortedCleanings.filter((item) =>
      isDateBetweenInclusive(dateString, item.arrival, item.departure)
    );
  };

  const getBarPosition = (item: CleaningItem, dateString: string) => {
    const isStart = item.arrival === dateString;
    const isEnd = item.departure === dateString;

    if (isStart && isEnd) {
      return {
        left: "25%",
        right: "25%",
        borderRadius: "999px",
      };
    }

    if (isStart) {
      return {
        left: "50%",
        right: "0",
        borderRadius: "999px 0 0 999px",
      };
    }

    if (isEnd) {
      return {
        left: "0",
        right: "50%",
        borderRadius: "0 999px 999px 0",
      };
    }

    return {
      left: "0",
      right: "0",
      borderRadius: "0",
    };
  };

  const shouldShowCenteredLabel = (item: CleaningItem, dateString: string) => {
    const arrivalTime = new Date(`${item.arrival}T00:00:00`).getTime();
    const departureTime = new Date(`${item.departure}T00:00:00`).getTime();
    const midTime = arrivalTime + (departureTime - arrivalTime) / 2;
    const midDate = new Date(midTime).toISOString().slice(0, 10);

    return midDate === dateString;
  };

  const getNextCleaningForProperty = (propertyId: number) => {
    const today = new Date().toISOString().slice(0, 10);

    return sortedCleanings.find(
      (item) => item.propertyId === propertyId && item.departure >= today
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Cleaner App</div>

        {navButton("dashboard", "Dashboard")}
        {navButton("properties", "Properties")}
        {navButton("calendar", "Calendar")}
        {navButton("notifications", "Notifications")}
        {navButton("cleaners", "Cleaners")}
        {navButton("cleanerPortal", "Cleaner Portal")}
        {navButton("records", "Records")}
      </aside>

      <main className="main-content">
        {page === "dashboard" && (
          <>
            <div className="page-header">
              <h1>Dashboard</h1>
              <p>
                Quick view of departures, arrivals, urgent items, and cleaner
                activity.
              </p>
            </div>

            <section className="card-section">
              <h2>Urgent / Today</h2>

              {activeAlertCleanings.length === 0 && (
                <div className="urgent-card">
                  <div>
                    <strong>All turnovers are on track</strong>
                    <p>No urgent or attention items are currently flagged.</p>
                  </div>
                  <span style={urgencyStyle("normal")}>Normal</span>
                </div>
              )}

              {activeAlertCleanings.slice(0, 5).map((item) => (
                <div
                  className={item.urgencyLevel === "urgent" ? "urgent-card warning" : "urgent-card"}
                  key={`dash-alert-${item.id}`}
                >
                  <div>
                    <strong>{item.property} • {item.departure}</strong>
                    <p>{urgencyReasonText(item)}</p>
                  </div>
                  {urgencyBadge(item)}
                </div>
              ))}

              <div className="urgent-card">
                <div>
                  <strong>Cleaner ETA Needed</strong>
                  <p>Guests arrived early or cleaner timing needs attention.</p>
                </div>

                <button
                  className="primary-btn"
                  onClick={() => {
                    setActiveTab("message");
                    setMessage("Can you please send your ETA for this turnover?");
                    setPage("notifications");
                  }}
                >
                  Request ETA
                </button>
              </div>

              <div className="urgent-card warning">
                <div>
                  <strong>Attention Needed</strong>
                  <p>Any arrival not marked ready by 3:00 PM should appear here.</p>
                </div>

                <button
                  className="secondary-btn"
                  onClick={() => setPage("notifications")}
                >
                  View Status
                </button>
              </div>
            </section>

            <section className="card-section">
              <h2>Upcoming Departures</h2>

              <div className="compact-table">
                <div className="table-header confirmed-header">
                  <span>Property</span>
                  <span>Departure</span>
                  <span>Cleaner</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Last Update</span>
                </div>

                {sortedCleanings.length === 0 && (
                  <div className="table-row confirmed-row">
                    <span>No reservations loaded yet.</span>
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </div>
                )}

                {sortedCleanings.map((item) => (
                  <div className="table-row confirmed-row" key={item.id}>
                    <span>{item.property}</span>
                    <span>{item.departure}</span>
                    <span>{item.cleaner}</span>
                    <span
                      className={getStatusClass(item.status)}
                      title={statusHelp[item.status]}
                    >
                      {item.status}
                    </span>
                    <span>{urgencyBadge(item)}</span>
                    <span>{item.lastUpdate}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-section">
              <h2>Upcoming Arrivals</h2>

              <div className="compact-table">
                <div className="table-header">
                  <span>Property</span>
                  <span>Arrival</span>
                  <span>Cleaner</span>
                  <span>Ready Status</span>
                  <span>Priority</span>
                  <span>Last Update</span>
                  <span>Owner Override</span>
                </div>

                {sortedCleanings.length === 0 && (
                  <div className="table-row">
                    <span>No reservations loaded yet.</span>
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </div>
                )}

                {sortedCleanings.map((item) => (
                  <div className="table-row" key={item.id}>
                    <span>{item.property}</span>
                    <span>{item.arrival}</span>
                    <span>{item.cleaner}</span>
                    <span
                      className={getStatusClass(item.status)}
                      title={statusHelp[item.status]}
                    >
                      {item.status}
                    </span>
                    <span>{urgencyBadge(item)}</span>
                    <span>{item.lastUpdate}</span>

                    <div className="row-actions">
                      <button onClick={() => updateStatus(item.id, "Assigned")}>
                        Assigned
                      </button>
                      <button onClick={() => updateStatus(item.id, "Ready")}>
                        Ready
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "Attention Needed")}
                      >
                        Needs Attention
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {page === "properties" && (
          <>
            <div className="page-header">
              <h1>Properties</h1>
              <p>
                View your homes, assign cleaners, connect listing calendars,
                and manage property details.
              </p>
            </div>

            <section className="card-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: "22px",
                }}
              >
                <h2 style={{ margin: 0 }}>Your Homes</h2>

                <button className="primary-btn" onClick={addAnotherHome}>
                  Add Another Home
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }}
              >
                {properties.map((property) => {
                  const nextCleaning = getNextCleaningForProperty(property.id);

                  return (
                    <div
                      key={property.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "20px",
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(260px, 360px) 1fr",
                          gap: "0",
                        }}
                      >
                        <div
                          style={{
                            minHeight: "230px",
                            background: property.imageUrl
                              ? `url(${property.imageUrl}) center/cover`
                              : "linear-gradient(135deg, #dbeafe, #fef3c7)",
                            display: "flex",
                            alignItems: "end",
                            padding: "18px",
                          }}
                        >
                          {!property.imageUrl && (
                            <div
                              style={{
                                background: "rgba(255,255,255,0.85)",
                                borderRadius: "999px",
                                padding: "8px 12px",
                                fontWeight: 800,
                              }}
                            >
                              Home Photo
                            </div>
                          )}
                        </div>

                        <div style={{ padding: "24px" }}>
                          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
                            {property.name}
                          </h2>

                          <p style={{ color: "#6b7280", marginTop: 0 }}>
                            {property.location}
                          </p>

                          <p>{property.description}</p>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(180px, 1fr))",
                              gap: "12px",
                              marginTop: "18px",
                            }}
                          >
                            <div>
                              <strong>Cleaner</strong>
                              <p>{property.cleaner || "Unassigned"}</p>
                            </div>

                            <div>
                              <strong>Calendar</strong>
                              <p>{property.syncStatus}</p>
                            </div>

                            <div>
                              <strong>Next Departure</strong>
                              <p>{nextCleaning?.departure || "None loaded"}</p>
                            </div>

                            <div>
                              <strong>Next Arrival</strong>
                              <p>{nextCleaning?.arrival || "None loaded"}</p>
                            </div>
                          </div>

                          <div className="button-row">
                            <button
                              className="primary-btn"
                              onClick={() => setEditingPropertyId(property.id)}
                            >
                              Edit Home
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() => syncIcal(property)}
                            >
                              Sync Calendar
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() => {
                                setCalendarYear(currentYear);
                                setPage("calendar");
                              }}
                            >
                              View Calendar
                            </button>

                            <button
                              className="secondary-btn"
                              onClick={() => setConfirmRemoveId(property.id)}
                            >
                              Remove Home
                            </button>
                          </div>
                        </div>
                      </div>

                      {editingPropertyId === property.id && (
                        <div
                          style={{
                            borderTop: "1px solid #e5e7eb",
                            padding: "24px",
                            background: "#f9fafb",
                          }}
                        >
                          <h2>Edit Home</h2>

                          <div className="form-card">
                            <label>Property Name</label>
                            <input
                              value={property.name}
                              onChange={(e) =>
                                updateProperty(property.id, "name", e.target.value)
                              }
                            />

                            <label>Location</label>
                            <input
                              value={property.location}
                              onChange={(e) =>
                                updateProperty(property.id, "location", e.target.value)
                              }
                            />

                            <label>Description</label>
                            <textarea
                              value={property.description}
                              onChange={(e) =>
                                updateProperty(
                                  property.id,
                                  "description",
                                  e.target.value
                                )
                              }
                            />

                            <label>Home Photo URL</label>
                            <input
                              value={property.imageUrl}
                              onChange={(e) =>
                                updateProperty(property.id, "imageUrl", e.target.value)
                              }
                              placeholder="Paste image URL"
                            />

                            <label>Assigned Cleaner</label>
                            <select
                              value={property.cleaner}
                              onChange={(e) =>
                                updateProperty(property.id, "cleaner", e.target.value)
                              }
                            >
                              <option value="">Unassigned</option>
                              {cleaners.map((cleaner) => (
                                <option key={cleaner.name} value={cleaner.name}>
                                  {cleaner.name}
                                </option>
                              ))}
                            </select>

                            <label>iCal URL</label>
                            <input
                              value={property.icalUrl}
                              onChange={(e) =>
                                updateProperty(property.id, "icalUrl", e.target.value)
                              }
                              placeholder="Paste Airbnb or VRBO iCal URL"
                            />

                            <label>VRBO Listing ID</label>
                            <input
                              value={property.vrboId}
                              onChange={(e) =>
                                updateProperty(property.id, "vrboId", e.target.value)
                              }
                              placeholder="Example: 1234567"
                            />

                            <label>Airbnb Listing URL</label>
                            <input
                              value={property.airbnbUrl}
                              onChange={(e) =>
                                updateProperty(
                                  property.id,
                                  "airbnbUrl",
                                  e.target.value
                                )
                              }
                              placeholder="Paste Airbnb listing URL"
                            />

                            <div className="button-row">
                              <button
                                className="primary-btn"
                                onClick={() => syncIcal(property)}
                              >
                                Sync iCal
                              </button>

                              <button
                                className="secondary-btn"
                                onClick={() => linkVrbo(property)}
                              >
                                Link VRBO
                              </button>

                              <button
                                className="secondary-btn"
                                onClick={() => linkAirbnb(property)}
                              >
                                Link Airbnb
                              </button>

                              <button
                                className="secondary-btn"
                                onClick={() => {
                                  setEditingPropertyId(null);
                                  addRecord(
                                    `${property.name} property details saved.`,
                                    "Homeowner"
                                  );
                                }}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {confirmRemoveId === property.id && (
                        <div
                          style={{
                            borderTop: "1px solid #fecaca",
                            background: "#fef2f2",
                            padding: "20px 24px",
                          }}
                        >
                          <strong>Remove {property.name}?</strong>
                          <p>
                            This removes the home and its loaded reservations from
                            this app view. This action will be recorded.
                          </p>

                          <div className="button-row">
                            <button
                              className="secondary-btn"
                              onClick={() => setConfirmRemoveId(null)}
                            >
                              Cancel
                            </button>

                            <button
                              className="primary-btn"
                              onClick={() => removeHome(property)}
                            >
                              Yes, Remove Home
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card-section">
              <h2>Manual Reservation</h2>

              <div className="form-card">
                <label>Property</label>
                <select
                  value={manualPropertyId}
                  onChange={(e) => setManualPropertyId(Number(e.target.value))}
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>

                <label>Reservation Type</label>
                <select
                  value={manualType}
                  onChange={(e) =>
                    setManualType(e.target.value as CleaningItem["type"])
                  }
                >
                  <option value="Guest Booking">Guest Booking</option>
                  <option value="Owner Stay">Owner / Block</option>
                  <option value="Deep Clean">Deep Clean</option>
                </select>

                <label>Guest Name / Label</label>
                <input
                  value={manualGuestName}
                  onChange={(e) => setManualGuestName(e.target.value)}
                  placeholder="Guest name, owner stay, or block label"
                />

                <label>Arrival Date</label>
                <input
                  type="date"
                  value={manualArrival}
                  onChange={(e) => setManualArrival(e.target.value)}
                />

                <label>Departure Date</label>
                <input
                  type="date"
                  value={manualDeparture}
                  onChange={(e) => setManualDeparture(e.target.value)}
                />

                <button className="primary-btn" onClick={addManualReservation}>
                  Add Reservation
                </button>
              </div>
            </section>
          </>
        )}

        {page === "calendar" && (
          <>
            <div className="page-header">
              <h1>Calendar</h1>
              <p>
                Guest bookings are tan. Owner blocks are light blue. Calendar
                opens near the current month.
              </p>
            </div>

            <section className="card-section">
              <div className="button-row">
                <button
                  className="secondary-btn"
                  onClick={() => setCalendarYear(calendarYear - 1)}
                >
                  Previous Year
                </button>

                <button className="primary-btn">{calendarYear}</button>

                <button
                  className="secondary-btn"
                  onClick={() => setCalendarYear(calendarYear + 1)}
                >
                  Next Year
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginTop: "18px",
                  flexWrap: "wrap",
                  color: "#4b5563",
                  fontSize: "14px",
                }}
              >
                <span>
                  <strong>Tan</strong> = guest booking
                </span>
                <span>
                  <strong>Light blue</strong> = owner stay / block
                </span>
              </div>

              <div
                style={{
                  marginTop: "30px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "42px",
                }}
              >
                {monthNames.map((month, monthIndex) => (
                  <div
                    key={month}
                    ref={(element) => {
                      calendarMonthRefs.current[monthIndex] = element;
                    }}
                  >
                    <h2 style={{ marginBottom: "16px" }}>{month}</h2>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
                        gap: "2px",
                        overflowX: "auto",
                      }}
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            style={{
                              fontWeight: 800,
                              color: "#6b7280",
                              padding: "8px",
                              fontSize: "13px",
                              background: "#f9fafb",
                            }}
                          >
                            {day}
                          </div>
                        )
                      )}

                      {Array.from({
                        length: new Date(calendarYear, monthIndex, 1).getDay(),
                      }).map((_, index) => (
                        <div key={`empty-${month}-${index}`} />
                      ))}

                      {Array.from({
                        length: getDaysInMonth(calendarYear, monthIndex),
                      }).map((_, index) => {
                        const dayNumber = index + 1;

                        const dateString = `${calendarYear}-${String(
                          monthIndex + 1
                        ).padStart(2, "0")}-${String(dayNumber).padStart(
                          2,
                          "0"
                        )}`;

                        const dayItems = getCalendarItemsForDay(dateString);

                        return (
                          <div
                            key={`${month}-${dayNumber}`}
                            style={{
                              minHeight: "78px",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              padding: "6px",
                              position: "relative",
                              background: "#ffffff",
                              overflow: "hidden",
                            }}
                          >
                            <strong style={{ fontSize: "16px" }}>
                              {dayNumber}
                            </strong>

                            {dayItems.map((item, itemIndex) => {
                              const position = getBarPosition(item, dateString);
                              const showLabel = shouldShowCenteredLabel(
                                item,
                                dateString
                              );

                              return (
                                <div
                                  key={`${item.id}-${dateString}`}
                                  title={`${item.guestName || item.property}: ${
                                    item.arrival
                                  } to ${item.departure}`}
                                  style={{
                                    position: "absolute",
                                    left: position.left,
                                    right: position.right,
                                    bottom: `${12 + itemIndex * 22}px`,
                                    height: "18px",
                                    background: getReservationBarColor(item.type),
                                    borderRadius: position.borderRadius,
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    color: "#111827",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    padding: showLabel ? "2px 8px" : "0",
                                    textAlign: "center",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {showLabel
                                    ? cleanReservationLabel(
                                        item.guestName || item.property
                                      )
                                    : ""}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {page === "notifications" && (
          <>
            <div className="page-header">
              <h1>Notification Center</h1>
              <p>
                Manage cleaner responses, urgent updates, early arrivals, and
                messages.
              </p>
            </div>

            <div className="tabs">
              <button
                className={activeTab === "urgent" ? "tab active" : "tab"}
                onClick={() => setActiveTab("urgent")}
              >
                Urgent / Today
              </button>

              <button
                className={activeTab === "pending" ? "tab active" : "tab"}
                onClick={() => setActiveTab("pending")}
              >
                Pending Requests
              </button>

              <button
                className={activeTab === "confirmed" ? "tab active" : "tab"}
                onClick={() => setActiveTab("confirmed")}
              >
                Confirmed / Ready
              </button>

              <button
                className={activeTab === "early" ? "tab active" : "tab"}
                onClick={() => setActiveTab("early")}
              >
                Early Arrival
              </button>

              <button
                className={activeTab === "message" ? "tab active" : "tab"}
                onClick={() => setActiveTab("message")}
              >
                Message Cleaner
              </button>
            </div>

            {activeTab === "urgent" && (
              <section className="card-section">
                <h2>Urgent / Today</h2>

                {urgentCleanings.length === 0 && attentionCleanings.length === 0 && (
                  <div className="urgent-card">
                    <div>
                      <strong>No active alerts</strong>
                      <p>Every loaded turnover is currently tracking normally.</p>
                    </div>
                    <span style={urgencyStyle("normal")}>Normal</span>
                  </div>
                )}

                {urgentCleanings.map((item) => (
                  <div className="urgent-card warning" key={`urgent-${item.id}`}>
                    <div>
                      <strong>{item.property} needs attention now</strong>
                      <p>{urgencyReasonText(item)}</p>
                    </div>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        setSelectedProperty(item.property);
                        setSelectedCleaner(item.cleaner);
                        setActiveTab("message");
                        setMessage(`Urgent: please update ${item.property} for ${item.departure}. ${urgencyReasonText(item)}`);
                      }}
                    >
                      Message Cleaner
                    </button>
                  </div>
                ))}

                {attentionCleanings.map((item) => (
                  <div className="urgent-card" key={`attention-${item.id}`}>
                    <div>
                      <strong>{item.property} needs follow-up</strong>
                      <p>{urgencyReasonText(item)}</p>
                    </div>
                    {urgencyBadge(item)}
                  </div>
                ))}

                <div className="urgent-card">
                  <div>
                    <strong>Cleaner ETA Needed</strong>
                    <p>Ask the cleaner for arrival timing or progress.</p>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={() => {
                      setActiveTab("message");
                      setMessage("Can you please send your ETA for this turnover?");
                    }}
                  >
                    Request ETA
                  </button>
                </div>

                <div className="urgent-card warning">
                  <div>
                    <strong>Attention Needed</strong>
                    <p>Arrival is approaching and property is not marked ready.</p>
                  </div>

                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setActiveTab("message");
                      setMessage("The next arrival is approaching. Please update the cleaning status.");
                    }}
                  >
                    Send Reminder
                  </button>
                </div>
              </section>
            )}

            {activeTab === "pending" && (
              <section className="card-section">
                <h2>Pending Cleaner Requests</h2>

                <div className="compact-table">
                  <div className="table-header">
                    <span>Property</span>
                    <span>Date</span>
                    <span>Cleaner</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span>Priority</span>
                    <span>Actions</span>
                  </div>

                  {pendingCleanings.map((item) => (
                    <div className="table-row" key={item.id}>
                      <span>{item.property}</span>
                      <span>{item.departure}</span>
                      <span>{item.cleaner}</span>
                      <span>{item.type}</span>
                      <span
                        className={getStatusClass(item.status)}
                        title={statusHelp[item.status]}
                      >
                        {item.status}
                      </span>
                      <span>{urgencyBadge(item)}</span>

                      <div className="row-actions">
                        <button
                          onClick={() =>
                            addMessage(
                              item.property,
                              item.cleaner,
                              "Homeowner",
                              `Reminder: please update ${item.property} for ${item.departure}.`,
                              "General"
                            )
                          }
                        >
                          Reminder
                        </button>
                        <button onClick={() => updateStatus(item.id, "Ready")}>
                          Mark Ready
                        </button>
                        <button>Reassign</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "confirmed" && (
              <section className="card-section">
                <h2>Confirmed / Ready Cleanings</h2>

                <div className="compact-table">
                  <div className="table-header confirmed-header">
                    <span>Property</span>
                    <span>Date</span>
                    <span>Cleaner</span>
                    <span>Type</span>
                    <span>Status</span>
                  </div>

                  {readyCleanings.map((item) => (
                    <div className="table-row confirmed-row" key={item.id}>
                      <span>{item.property}</span>
                      <span>{item.departure}</span>
                      <span>{item.cleaner}</span>
                      <span>{item.type}</span>
                      <span className="status green" title={statusHelp.Ready}>
                        Ready
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "early" && (
              <section className="card-section">
                <h2>Early Arrival</h2>

                <div className="form-card">
                  <label>Property</label>
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                  >
                    {properties.map((property) => (
                      <option key={property.id}>{property.name}</option>
                    ))}
                  </select>

                  <label>Cleaner</label>
                  <select
                    value={selectedCleaner}
                    onChange={(e) => setSelectedCleaner(e.target.value)}
                  >
                    {cleaners.map((cleaner) => (
                      <option key={cleaner.name}>{cleaner.name}</option>
                    ))}
                  </select>

                  <label>Early Arrival Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Guests arrived early. What is your ETA?"
                  />

                  <div className="button-row">
                    <button
                      className="primary-btn"
                      onClick={() => sendHomeownerMessage("Early Arrival")}
                    >
                      Request Early Arrival
                    </button>
                    <button
                      className="secondary-btn"
                      onClick={() =>
                        sendHomeownerMessage(
                          "Early Arrival",
                          "Guests may arrive early. Please update us if the home can be ready sooner."
                        )
                      }
                    >
                      Schedule Early Arrival
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "message" && (
              <section className="card-section">
                <h2>Message Cleaner</h2>

                <div className="form-card">
                  <label>Property</label>
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                  >
                    {properties.map((property) => (
                      <option key={property.id}>{property.name}</option>
                    ))}
                  </select>

                  <label>Cleaner</label>
                  <select
                    value={selectedCleaner}
                    onChange={(e) => setSelectedCleaner(e.target.value)}
                  >
                    {cleaners.map((cleaner) => (
                      <option key={cleaner.name}>{cleaner.name}</option>
                    ))}
                  </select>

                  <label>Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write message to cleaner..."
                  />

                  <div className="button-row">
                    <button
                      className="primary-btn"
                      onClick={() => sendHomeownerMessage("General")}
                    >
                      Send Message
                    </button>

                    <button
                      className="secondary-btn"
                      onClick={() =>
                        sendHomeownerMessage(
                          "ETA Request",
                          "Can you please send your ETA for this turnover?"
                        )
                      }
                    >
                      Quick ETA Request
                    </button>
                  </div>
                </div>

                <h2 style={{ marginTop: "28px" }}>Message History</h2>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {sortedMessages.length === 0 && (
                    <div
                      style={{
                        border: "1px dashed #d1d5db",
                        borderRadius: "14px",
                        padding: "18px",
                        background: "#f9fafb",
                        color: "#6b7280",
                      }}
                    >
                      No messages yet.
                    </div>
                  )}

                  {sortedMessages.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "14px",
                        padding: "16px",
                        background: item.sender === "Cleaner" ? "#f0fdf4" : "#f9fafb",
                      }}
                    >
                      <strong>
                        {item.sender} • {item.category}
                      </strong>
                      <p style={{ margin: "6px 0" }}>{item.text}</p>
                      <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
                        {item.property} • {item.cleaner} • {item.time}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {page === "cleaners" && (
          <>
            <div className="page-header">
              <h1>Cleaners</h1>
              <p>View cleaner availability, assignments, and status.</p>
            </div>

            <section className="card-section">
              <h2>Cleaner Team</h2>

              {cleaners.map((cleaner) => (
                <div
                  className={
                    cleaner.status === "Unavailable"
                      ? "urgent-card warning"
                      : "urgent-card"
                  }
                  key={cleaner.name}
                >
                  <div>
                    <strong>{cleaner.name}</strong>
                    <p>Status: {cleaner.status}</p>
                    <p>Assigned: {cleaner.assigned}</p>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={() => {
                      setSelectedCleaner(cleaner.name);
                      setActiveTab("message");
                      setPage("notifications");
                    }}
                  >
                    Message
                  </button>
                </div>
              ))}

              <button className="secondary-btn">Add Cleaner</button>
            </section>
          </>
        )}

       {page === "cleanerPortal" && (
  <CleanerPortal
    cleanerPortalItems={cleanerPortalItems}
    cleanerPortalFilter={cleanerPortalFilter}
    setCleanerPortalFilter={setCleanerPortalFilter}
    cleaners={cleaners}
    sortedMessages={sortedMessages}
    cleanerReplyText={cleanerReplyText}
    setCleanerReplyText={setCleanerReplyText}
    updateStatus={updateStatus}
  />
)}

        {page === "records" && (
          <>
            <div className="page-header">
              <h1>Records</h1>
              <p>
                Complete activity history across reservations, cleanings,
                messages, and updates. Records are saved locally and to the
                backend.
              </p>
            </div>

            <section className="card-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <h2 style={{ marginBottom: "6px" }}>Activity Records</h2>
                  <p style={{ margin: 0, color: "#6b7280" }}>
                    {recordSaveStatus} • {filteredRecords.length} of {records.length} records shown
                  </p>
                </div>

                <div className="button-row">
                  <button className="secondary-btn" onClick={exportRecords}>
                    Export Records
                  </button>

                  <button className="secondary-btn" onClick={clearRecords}>
                    Clear Records
                  </button>
                </div>
              </div>

              <div
                className="form-card"
                style={{
                  marginBottom: "18px",
                  gridTemplateColumns: "2fr 1fr auto",
                  alignItems: "end",
                }}
              >
                <div>
                  <label>Search Records</label>
                  <input
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    placeholder="Search property, cleaner, status, message, VRBO, iCal, or date"
                  />
                </div>

                <div>
                  <label>Source</label>
                  <select
                    value={recordSourceFilter}
                    onChange={(e) =>
                      setRecordSourceFilter(
                        e.target.value as "All" | ActivityRecord["source"]
                      )
                    }
                  >
                    <option value="All">All Sources</option>
                    <option value="System">System</option>
                    <option value="Homeowner">Homeowner</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>

                <button
                  className="secondary-btn"
                  onClick={() => {
                    setRecordSearch("");
                    setRecordSourceFilter("All");
                  }}
                >
                  Reset
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                <div className="urgent-card warning">
                  <div>
                    <strong>{urgentCleanings.length}</strong>
                    <p>Urgent turnovers</p>
                  </div>
                </div>
                <div className="urgent-card">
                  <div>
                    <strong>{attentionCleanings.length}</strong>
                    <p>Need attention</p>
                  </div>
                </div>
                <div className="urgent-card">
                  <div>
                    <strong>{sortedCleanings.filter((item) => item.urgencyLevel === "normal").length}</strong>
                    <p>Normal turnovers</p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {filteredRecords.length === 0 && (
                  <div
                    style={{
                      border: "1px dashed #d1d5db",
                      borderRadius: "14px",
                      padding: "18px",
                      background: "#f9fafb",
                      color: "#6b7280",
                    }}
                  >
                    No records match this search. Try a different keyword or reset
                    the filters.
                  </div>
                )}

                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "14px",
                      padding: "16px",
                      background: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{record.time}</strong>

                      <span
                        style={{
                          color: "#6b7280",
                          fontWeight: 700,
                        }}
                      >
                        {record.source}
                      </span>
                    </div>

                    <div>{record.event}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}