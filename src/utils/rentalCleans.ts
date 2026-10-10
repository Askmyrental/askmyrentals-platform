// Helpers for showing calendar-driven rental cleans next to independent jobs
// in the Work list. These only read data; nothing here writes to the database.

export type RentalCleanStatus =
  | "Upcoming"
  | "In Progress"
  | "Completed"
  | "Invoiced"
  | "No Clean Needed";

export const RENTAL_CLEAN_LABEL = "Rental clean";

// Stored task types stay unchanged; this only changes what people see.
export function displayWorkType(value: unknown, fallback = RENTAL_CLEAN_LABEL) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  if (text.toLowerCase() === "vacation rental turnover") return RENTAL_CLEAN_LABEL;
  return text;
}

function toLocalDay(value: unknown) {
  const text = String(value ?? "").slice(0, 10);
  if (!text) return null;
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getRentalCleanStatus(reservation: any): RentalCleanStatus {
  const status = String(reservation?.status ?? "").toLowerCase();
  if (status === "no clean needed") return "No Clean Needed";
  if (reservation?.invoiceSent || status.includes("invoice sent")) return "Invoiced";
  if (status.includes("complete")) return "Completed";
  if (
    status.includes("progress") ||
    status.includes("process") ||
    status.includes("started")
  ) {
    return "In Progress";
  }
  return "Upcoming";
}

export function getRentalCleanAssignedUserId(task: any) {
  return String(
    task?.assignedUserId ??
      task?.assigned_user_id ??
      task?.assignedTo ??
      task?.assigned_to ??
      "",
  ).trim();
}

export function getRentalCleanAssignedContactId(task: any) {
  return String(task?.assignedContactId ?? task?.assigned_contact_id ?? "").trim();
}

function isOwnerStay(reservation: any) {
  return String(reservation?.source ?? "").toLowerCase() === "owner block";
}

function isAirbnbBlock(reservation: any) {
  const source = String(reservation?.source ?? "").toLowerCase();
  const status = String(reservation?.status ?? "").toLowerCase();
  const guestLabel = String(
    reservation?.guest ??
      reservation?.guestName ??
      reservation?.guest_name ??
      reservation?.summary ??
      reservation?.title ??
      "",
  ).toLowerCase();
  return source === "airbnb" && (status === "blocked" || guestLabel.includes("airbnb block"));
}

// Mirrors the rules the home screen uses to decide which reservations need a clean.
export function isRentalCleanReservation(
  reservation: any,
  isImportedReservation: (reservation: any) => boolean,
) {
  const source = String(reservation?.source ?? "").toLowerCase();
  const status = String(reservation?.status ?? "").toLowerCase();
  const needsClean =
    isImportedReservation(reservation) ||
    source === "guest reservation" ||
    source === "owner block" ||
    source === "cleaning";
  const notPlainBlock = status !== "blocked" || isOwnerStay(reservation) || isAirbnbBlock(reservation);
  return needsClean && notPlainBlock;
}

type SelectOptions = {
  isImportedReservation: (reservation: any) => boolean;
  today?: Date;
  // When set, only rental cleans assigned to this user are returned
  // (team cleaners and maintenance staff only see their own work).
  onlyAssignedToUserId?: string | null;
};

export function selectUpcomingRentalCleans(reservations: any[], options: SelectOptions) {
  const today = new Date(options.today ?? new Date());
  today.setHours(0, 0, 0, 0);

  return reservations
    .filter((reservation) => isRentalCleanReservation(reservation, options.isImportedReservation))
    .filter((reservation) => {
      const day = toLocalDay(reservation?.departure);
      return Boolean(day && day >= today);
    })
    .filter((reservation) => {
      const status = getRentalCleanStatus(reservation);
      return status !== "No Clean Needed" && status !== "Invoiced";
    })
    .filter((reservation) => {
      if (options.onlyAssignedToUserId === undefined) return true;
      if (!options.onlyAssignedToUserId) return false;
      return getRentalCleanAssignedUserId(reservation) === String(options.onlyAssignedToUserId);
    })
    .sort((first, second) =>
      String(first?.departure ?? "").localeCompare(String(second?.departure ?? "")),
    );
}

export function getRentalCleanSourceLabel(reservation: any) {
  const source = String(reservation?.calendarSource ?? reservation?.source ?? "").trim();
  if (!source) return "From calendar";
  const lower = source.toLowerCase();
  if (lower === "owner block") return "Owner stay";
  if (lower === "guest reservation" || lower === "cleaning") return "From calendar";
  return `From ${source.charAt(0).toUpperCase()}${source.slice(1)}`;
}
