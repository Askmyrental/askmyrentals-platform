import { useId } from "react";

type Props = {
  provider: string;
  onProviderChange: (value: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  disabled?: boolean;
};

export default function CalendarFeedFields({ provider, onProviderChange, url, onUrlChange, disabled }: Props) {
  const id = useId();
  const label = provider === "VRBO" ? "Vrbo" : provider;
  return <div className="calendarFeedFields">
    <style>{`.calendarFeedFields{display:grid;gap:12px;min-width:0;width:100%}.calendarFeedFields label{display:grid;gap:8px;font-weight:700}.calendarFeedFields select,.calendarFeedFields input{box-sizing:border-box;width:100%;min-width:0;min-height:44px;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}.calendarFeedFields p{margin:0;line-height:1.5;overflow-wrap:anywhere}`}</style>
    <label htmlFor={`${id}-provider`}>Calendar provider
      <select id={`${id}-provider`} value={provider} disabled={disabled} onChange={e => { onProviderChange(e.target.value); onUrlChange(""); }}>
        <option value="">Choose Airbnb, Vrbo, or Guesty</option><option value="Airbnb">Airbnb</option><option value="VRBO">Vrbo</option><option value="Guesty">Guesty</option>
      </select>
    </label>
    {provider && <>
      <p id={`${id}-help`}>{provider === "Guesty"
        ? "In Guesty, select the property → Calendar → Calendar sync (iCal) → Export Guesty calendar → copy the export link."
        : provider === "Airbnb"
        ? "In Airbnb hosting, open Calendar, select the listing, then Availability → Connect calendars → Connect to another website. Copy the Airbnb calendar link."
        : "In the Vrbo owner dashboard, select the property, open Calendar, then Import & export → Export calendar. Copy the export link."} Choose the provider with the complete reservation calendar for this property. AMR uses one active feed.</p>
      <label htmlFor={`${id}-url`}>{label} iCal export link
        <input id={`${id}-url`} type="url" value={url} disabled={disabled} aria-describedby={`${id}-help`} onChange={e => onUrlChange(e.target.value)} placeholder={provider === "Guesty" ? "https://app.guesty.com/api/public/icalendar-dashboard-api/export/..." : provider === "Airbnb" ? "https://www.airbnb.com/calendar/ical/…" : "https://www.vrbo.com/icalendar/…ics"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </label>
    </>}
  </div>;
}
