export type CalendarProvider = "Airbnb" | "VRBO" | "Guesty";

export function validateCalendarFeed(provider: string, value: string) {
  if (provider !== "Airbnb" && provider !== "VRBO" && provider !== "Guesty") throw new Error("Choose Airbnb, Vrbo, or Guesty first.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a complete iCal export link."); }
  const host = url.hostname.toLowerCase();
  const matches = provider === "Airbnb"
    ? /(^|\.)airbnb\.(com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/.test(host)
    : provider === "Guesty" ? /(^|\.)guesty\.com$/.test(host)
    : /(^|\.)(vrbo|homeaway|homelidays)\.(com(?:\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})$/.test(host);
  if (url.protocol !== "https:" || url.username || url.password || !matches ||
      !/ical|\.ics(?:$|\/)/i.test(url.pathname)) {
    throw new Error(`Use the HTTPS ${provider === "VRBO" ? "Vrbo" : provider} iCal export link, not a listing or website link.`);
  }
  return url.href;
}

export function resolveCalendarFeed(property: any, details: any = {}) {
  const canonical = String(property.calendar_feed_url ?? "").trim();
  const airbnb = String(details.airbnbCalendarUrl ?? property.airbnb_ical_url ?? property.airbnb_calendar_url ?? property.airbnb_property_id ?? "").trim();
  const vrbo = String(details.vrboCalendarUrl ?? details.calendarFeedUrl ?? property.vrbo_ical_url ?? property.vrbo_calendar_url ?? property.vrbo_property_id ?? "").trim();
  const source = property.calendar_source || details.calendarSource;
  const canonicalMatchesSource = !source || (source === "Airbnb" ? /airbnb/i.test(canonical) : !/airbnb/i.test(canonical));
  const url = (canonicalMatchesSource ? canonical : "") || (source === "Airbnb" ? airbnb : vrbo) || canonical || airbnb || vrbo;
  const provider = source === "Airbnb" || source === "VRBO" || source === "Guesty" ? source
    : /guesty\.com/i.test(url) ? "Guesty" : /airbnb/i.test(url) ? "Airbnb" : /vrbo|homeaway|homelidays/i.test(url) ? "VRBO" : url ? source || "Unknown provider" : "";
  return { url, provider };
}

export function calendarFeedUpdates(provider: CalendarProvider, url: string) {
  return {
    calendar_feed_url: url,
    calendar_source: provider,
    airbnb_property_id: provider === "Airbnb" ? url : null,
    vrbo_property_id: provider === "VRBO" ? url : null,
  };
}
