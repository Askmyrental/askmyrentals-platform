import { useState } from "react";
import CalendarFeedFields from "./CalendarFeedFields";
import type { CalendarProvider } from "../utils/calendarFeed";

export type ConnectCalendar = (id: string, url: string, provider: CalendarProvider, replace?: boolean) => Promise<{ source: string; importedCount: number; replaced?: boolean }>;

export default function CalendarConnectionEditor({ home, onConnect }: { home: any; onConnect: ConnectCalendar }) {
  const connected = Boolean(home.calendarFeedUrl || home.airbnbUrl || home.iCalUrl);
  const [replacing, setReplacing] = useState(false);
  const [provider, setProvider] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function save() {
    setSaving(true); setError(""); setStatus("");
    try {
      const result = await onConnect(String(home.id), url, provider as CalendarProvider, replacing);
      setReplacing(false); setUrl(""); setProvider("");
      setStatus(result.replaced ? "Calendar replaced. Existing reservations were preserved. Resync separately when ready." : `Calendar connected. ${result.importedCount} entries imported.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save calendar. Retry."); }
    finally { setSaving(false); }
  }
  return <section className="calendarConnectionEditor" aria-label="Reservation calendar connection" aria-busy={saving}>
    <style>{`.calendarConnectionEditor button{min-height:44px;padding:10px 16px;margin:8px 8px 0 0;border:1px solid #cbd5e1;border-radius:12px;font:inherit;font-weight:700;cursor:pointer}.calendarConnectionEditor button:disabled{cursor:default;opacity:.6}@media(max-width:700px){.calendarConnectionEditor button{width:100%;margin-right:0}}`}</style>
    {connected && <p>{home.calendarSource === "VRBO" ? "Vrbo" : home.calendarSource || "Calendar"} is connected. One active feed is used.</p>}
    {connected && !replacing ? <button type="button" onClick={() => { setReplacing(true); setStatus(""); }}>Replace Calendar</button> : <>
      {replacing && <p>Confirm replacement to switch feeds. Existing reservations and assignments will remain unchanged. Resync separately when ready.</p>}
      <CalendarFeedFields provider={provider} onProviderChange={setProvider} url={url} onUrlChange={setUrl} disabled={saving} />
      <button type="button" disabled={saving || !provider || !url.trim()} onClick={() => void save()}>{saving ? "Saving..." : replacing ? "Confirm Replacement" : "Connect and Import Reservations"}</button>
      {replacing && <button type="button" disabled={saving} onClick={() => { setReplacing(false); setUrl(""); setProvider(""); setError(""); }}>Cancel Replacement</button>}
    </>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
  </section>;
}
