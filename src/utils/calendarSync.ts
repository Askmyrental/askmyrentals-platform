import ICAL from "ical.js";

export function formatDateForDatabase(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatICalDateForDatabase(icalDate: ICAL.Time | null | undefined) {
  if (!icalDate) return "";

  // iCal reservations are usually all-day DATE values. Do NOT convert them
  // through JavaScript Date/timezones, because that can shift the calendar day.
  const year = String(icalDate.year).padStart(4, "0");
  const month = String(icalDate.month).padStart(2, "0");
  const day = String(icalDate.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function subtractOneDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseICalTextToReservations(
  icalText: string,
  propertyId: string,
  source: "VRBO" | "Airbnb"
) {
  const jcalData = ICAL.parse(icalText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  return vevents
    .map((vevent: any) => {
      const calendarEvent = new ICAL.Event(vevent);

      const startDate = calendarEvent.startDate ?? null;
      const endDate = calendarEvent.endDate ?? null;

      const uid =
        vevent.getFirstPropertyValue("uid") ||
        vevent.getFirstPropertyValue("UID");

      const arrival = formatICalDateForDatabase(startDate);
      const rawDeparture = formatICalDateForDatabase(endDate);

      if (!arrival || !rawDeparture || !uid) return null;

      const summary = (calendarEvent.summary || "").trim();
      const normalizedSummary = summary.toLowerCase();

      const isBlocked =
        normalizedSummary === "blocked" ||
        normalizedSummary.includes("not available") ||
        normalizedSummary.includes("unavailable") ||
        normalizedSummary.includes("closed") ||
        normalizedSummary.includes("owner block");

      // Airbnb manual blocked calendar exports are arriving with one extra
      // checkout edge day compared with the actual owner-selected blocked range.
      // Guest reservations should keep the raw iCal departure date.
      const departure =
        source === "Airbnb" && isBlocked
          ? subtractOneDay(rawDeparture)
          : rawDeparture;

      console.log("PARSED ICAL EVENT", {
        source,
        uid,
        summary: calendarEvent.summary,
        arrival,
        rawDeparture,
        departure,
        isBlocked,
        startIsDate: startDate?.isDate,
        endIsDate: endDate?.isDate,
      });

      return {
        property_id: propertyId,
        ical_uid: uid,
        guest_name: isBlocked ? `${source} Block` : summary || `${source} Guest`,
        source,
        arrival,
        departure,
        cleaner_id: null,
        status: isBlocked ? "Blocked" : "Unassigned",
        notes: "",
        timeline: [`Imported from ${source} calendar`],
      };
    })
    .filter(Boolean);
}
