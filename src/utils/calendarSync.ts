import ICAL from "ical.js";

export function formatDateForDatabase(date: Date) {
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

      const startDate = calendarEvent.startDate
        ? calendarEvent.startDate.toJSDate()
        : null;
      const endDate = calendarEvent.endDate
        ? calendarEvent.endDate.toJSDate()
        : null;

      const uid =
        vevent.getFirstPropertyValue("uid") ||
        vevent.getFirstPropertyValue("UID");

      console.log("PARSED ICAL EVENT", {
        source,
        uid,
        summary: calendarEvent.summary,
        start: startDate ? formatDateForDatabase(startDate) : null,
        end: endDate ? formatDateForDatabase(endDate) : null,
      });

      if (!startDate || !endDate || !uid) return null;

      const summary = (calendarEvent.summary || "").trim();

      const normalizedSummary = summary.toLowerCase();

      const isBlocked =
        normalizedSummary === "blocked" ||
        normalizedSummary.includes("not available") ||
        normalizedSummary.includes("unavailable") ||
        normalizedSummary.includes("closed") ||
        normalizedSummary.includes("owner block");

      return {
        property_id: propertyId,
        ical_uid: uid,
        guest_name: isBlocked ? `${source} Block` : (summary || `${source} Guest`),
        source,
        arrival: formatDateForDatabase(startDate),
        departure: formatDateForDatabase(endDate),
        cleaner_id: null,
        status: isBlocked ? "Blocked" : "Unassigned",
        notes: "",
        timeline: [`Imported from ${source} calendar`],
      };
    })
    .filter(Boolean);
}