import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import CleanerCreatePropertyPage, {
  type CleanerClientOption,
  type CleanerPropertyFormValues,
} from "./CleanerCreatePropertyPage";
import CleanerPropertyDetailPage from "./CleanerPropertyDetailPage";

type CleanerPropertiesPageProps = {
  homes: any[];
  reservations: any[];
  cleaners: any[];
  clients: CleanerClientOption[];
  workOrders: any[];
  cleanerPortalId: string | null;
  onCreateClient: (values: {
    name: string;
    email: string;
    phone: string;
    preferredLanguage: string;
    notes: string;
  }) => Promise<CleanerClientOption>;
  onCreateProperty: (values: CleanerPropertyFormValues) => Promise<string>;
  onConnectCalendar: (
    propertyId: string,
    calendarUrl: string
  ) => Promise<{ importedCount: number; source: string }>;
  onResyncCalendar?: (
    propertyId: string
  ) => Promise<{ importedCount: number }>;
  resyncCleanerPropertyCalendar?: (
    propertyId: string
  ) => Promise<{ importedCount: number }>;
  onUpdateProperty: (
    propertyId: string,
    values: CleanerPropertyFormValues
  ) => Promise<void>;
  onDeleteProperty: (propertyId: string) => Promise<void>;
};

function buildCalendarRequestMessage(values: CleanerPropertyFormValues) {
  return `Hi ${values.ownerName}, I added ${values.propertyName} to AMR Cleaner. Please send me the iCal reservation calendar link from the booking platform you use as the most complete calendar for this property. Once I receive it, I can connect upcoming turns automatically.`;
}

export default function CleanerPropertiesPage({
  homes,
  reservations,
  cleaners,
  clients,
  workOrders,
  cleanerPortalId,
  onCreateClient,
  onCreateProperty,
  onConnectCalendar,
  onResyncCalendar,
  resyncCleanerPropertyCalendar,
  onUpdateProperty,
  onDeleteProperty,
}: CleanerPropertiesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [createPropertyFormKey, setCreatePropertyFormKey] = useState(0);
  const [editingHome, setEditingHome] = useState<any | null>(null);
  const [isSavingProperty, setIsSavingProperty] = useState(false);
  const [savedProperty, setSavedProperty] =
    useState<(CleanerPropertyFormValues & { id: string }) | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarImportStatus, setCalendarImportStatus] = useState("");
  const [calendarImportError, setCalendarImportError] = useState("");
  const [isImportingCalendar, setIsImportingCalendar] = useState(false);
  const [propertyInvoices, setPropertyInvoices] = useState<any[]>([]);
  const [showAcademy, setShowAcademy] = useState(false);
  const [calendarSetupHome, setCalendarSetupHome] = useState<any | null>(null);
  const [setupCalendarUrl, setSetupCalendarUrl] = useState("");
  const [setupCalendarStatus, setSetupCalendarStatus] = useState("");
  const [setupCalendarError, setSetupCalendarError] = useState("");
  const [isSetupCalendarSaving, setIsSetupCalendarSaving] = useState(false);
  const [resyncingHomeId, setResyncingHomeId] = useState<string | null>(null);
  const [resyncMessage, setResyncMessage] = useState("");
  const [resyncError, setResyncError] = useState("");
  const [calendarSuccess, setCalendarSuccess] = useState<{
    propertyName: string;
    source: string;
    importedCount: number;
  } | null>(null);

  const activeCleaner = cleaners.find(
    (cleaner) => String(cleaner.id) === String(cleanerPortalId)
  );

  const resyncCalendar =
    onResyncCalendar ?? resyncCleanerPropertyCalendar;

  useEffect(() => {
    void loadPropertyInvoices();
  }, []);

  async function loadPropertyInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, property_id, total_cents, issue_date, due_date, customer_name"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Property invoice load failed", error);
      return;
    }

    setPropertyInvoices(data ?? []);
  }

  const outstandingStatuses = new Set(["sent", "viewed", "overdue"]);

  const getOutstandingInvoicesForHome = (homeId: string) =>
    propertyInvoices
      .filter(
        (invoice) =>
          String(invoice.property_id) === String(homeId) &&
          outstandingStatuses.has(String(invoice.status))
      )
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        date: invoice.issue_date,
        dueDate: invoice.due_date,
        amount: Number(invoice.total_cents ?? 0) / 100,
        status: invoice.status,
        customerName: invoice.customer_name,
      }));

  // App.tsx already scopes homes to the authenticated account.
  // Do not filter them again through the legacy cleaners table.
  const cleanerHomes = useMemo(() => homes, [homes]);

  const filteredHomes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return cleanerHomes;

    return cleanerHomes.filter((home) =>
      [home.name, home.address, home.city, home.ownerName, home.ownerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [cleanerHomes, searchTerm]);

  const connectedCalendars = cleanerHomes.filter(
    (home) => home.calendarFeedUrl || home.iCalUrl || home.airbnbUrl
  ).length;

  const selectedHome = cleanerHomes.find(
    (home) => String(home.id) === String(selectedHomeId)
  );

  function openBlankCreatePropertyForm() {
    setEditingHome(null);
    setSavedProperty(null);
    setCalendarUrl("");
    setCalendarImportStatus("");
    setCalendarImportError("");
    setCopyStatus("");
    setSetupCalendarUrl("");
    setSetupCalendarStatus("");
    setSetupCalendarError("");
    setCalendarSetupHome(null);
    setCreatePropertyFormKey((current) => current + 1);
    setShowCreateProperty(true);
  }

  async function handleCreateProperty(values: CleanerPropertyFormValues) {
    setIsSavingProperty(true);
    try {
      const propertyId = await onCreateProperty(values);
      setShowCreateProperty(false);
      setSavedProperty({ ...values, id: propertyId });
      setCalendarUrl("");
      setCalendarImportStatus("");
      setCalendarImportError("");
      setCopyStatus("");
    } finally {
      setIsSavingProperty(false);
    }
  }

  async function importSavedPropertyCalendar() {
    if (!savedProperty || !calendarUrl.trim()) return;

    setIsImportingCalendar(true);
    setCalendarImportError("");
    setCalendarImportStatus("Checking calendar and importing reservations...");

    try {
      const result = await onConnectCalendar(
        savedProperty.id,
        calendarUrl.trim()
      );

      setCalendarImportStatus(
        `${result.source} calendar connected. ${result.importedCount} ${
          result.importedCount === 1 ? "reservation" : "reservations"
        } imported.`
      );
    } catch (error) {
      setCalendarImportStatus("");
      setCalendarImportError(
        error instanceof Error
          ? error.message
          : "AMR could not connect this calendar."
      );
    } finally {
      setIsImportingCalendar(false);
    }
  }

  function getPropertySetup(home: any) {
    const homeReservations = reservations.filter(
      (reservation: any) =>
        String(
          reservation.homeId ?? reservation.propertyId ?? reservation.property_id
        ) === String(home.id)
    );
    const homeInvoices = propertyInvoices.filter(
      (invoice) => String(invoice.property_id) === String(home.id)
    );
    const calendarConnected = Boolean(
      home.calendarFeedUrl || home.iCalUrl || home.airbnbUrl
    );
    const firstCleaningComplete = homeReservations.some((reservation: any) =>
      String(reservation.status ?? "").toLowerCase().includes("complete")
    );
    const firstInvoiceSent = homeInvoices.some((invoice) =>
      ["sent", "viewed", "paid", "overdue"].includes(String(invoice.status))
    );

    const steps = [
      { id: "property", label: "Property created", complete: true },
      {
        id: "owner",
        label: "Homeowner information",
        complete: Boolean(home.ownerName && (home.ownerEmail || home.ownerPhone)),
      },
      { id: "calendar", label: "Calendar connected", complete: calendarConnected },
      {
        id: "reservations",
        label: "Reservations imported",
        complete: calendarConnected && homeReservations.length > 0,
      },
      { id: "cleaning", label: "First cleaning completed", complete: firstCleaningComplete },
      { id: "invoice", label: "First invoice sent", complete: firstInvoiceSent },
    ];

    const completed = steps.filter((step) => step.complete).length;
    const percent = Math.round((completed / steps.length) * 100);
    return { steps, completed, percent, calendarConnected };
  }

  function getProgressTone(percent: number) {
    if (percent < 40) return "critical";
    if (percent < 70) return "warning";
    if (percent < 90) return "watch";
    return "healthy";
  }

  function openCalendarSetup(home: any) {
    setCalendarSetupHome(home);
    setSetupCalendarUrl(
      home.calendarFeedUrl || home.iCalUrl || home.airbnbUrl || ""
    );
    setSetupCalendarStatus("");
    setSetupCalendarError("");
    setCalendarSuccess(null);
  }

  async function connectExistingPropertyCalendar() {
    if (!calendarSetupHome || !setupCalendarUrl.trim()) return;
    setIsSetupCalendarSaving(true);
    setSetupCalendarStatus("Checking calendar and importing reservations...");
    setSetupCalendarError("");
    try {
      const result = await onConnectCalendar(
        String(calendarSetupHome.id),
        setupCalendarUrl.trim()
      );
      setSetupCalendarStatus("");
      setCalendarSuccess({
        propertyName: calendarSetupHome.name || "Property",
        source: result.source,
        importedCount: result.importedCount,
      });
    } catch (error) {
      setSetupCalendarStatus("");
      setSetupCalendarError(
        error instanceof Error ? error.message : "AMR could not connect this calendar."
      );
    } finally {
      setIsSetupCalendarSaving(false);
    }
  }

  async function resyncPropertyCalendar(home: any) {
    const homeId = String(home.id);

    setResyncingHomeId(homeId);
    setResyncMessage("");
    setResyncError("");

    try {
      if (!resyncCalendar) {
        throw new Error("Calendar resync is not configured.");
      }

      const result = await resyncCalendar(homeId);
      setResyncMessage(
        `${home.name || "Property"} refreshed. ${result.importedCount} ${
          result.importedCount === 1 ? "calendar entry" : "calendar entries"
        } synced.`
      );
    } catch (error) {
      setResyncError(
        error instanceof Error
          ? error.message
          : "AMR could not refresh this calendar."
      );
    } finally {
      setResyncingHomeId(null);
    }
  }

  function handleSetupStep(home: any, stepId: string) {
    if (stepId === "owner") {
      setEditingHome(home);
      return;
    }
    if (stepId === "calendar" || stepId === "reservations") {
      openCalendarSetup(home);
      return;
    }
    setSelectedHomeId(String(home.id));
  }

  function mapHomeToFormValues(home: any): CleanerPropertyFormValues {
    return {
      clientId: home?.clientId ?? "",
      propertyName: home?.name ?? "",
      propertyPhotoUrl: home?.imageUrl ?? "",
      address: home?.address ?? "",
      city: home?.city ?? "",
      bedrooms: String(home?.bedrooms ?? 0),
      bathrooms: String(home?.bathrooms ?? 0),
      kitchens: String(home?.kitchens ?? 0),
      floors: String(home?.floors ?? 0),
      kingBeds: String(home?.kingBeds ?? 0),
      queenBeds: String(home?.queenBeds ?? 0),
      doubleBeds: String(home?.doubleBeds ?? 0),
      twinBeds: String(home?.twinBeds ?? 0),
      bunkBeds: String(home?.bunkBeds ?? 0),
      pyramidBunks: String(home?.pyramidBunks ?? 0),
      murphyBeds: String(home?.murphyBeds ?? 0),
      sofaSleepers: String(home?.sofaSleepers ?? 0),
      cleaningFee:
        home?.cleaningFee === undefined || home?.cleaningFee === null
          ? ""
          : String(home.cleaningFee),
      ownerName: home?.ownerName ?? "",
      ownerEmail: home?.ownerEmail ?? "",
      ownerPhone: home?.ownerPhone ?? "",
      accessInstructions: home?.operations?.access ?? "",
      wifiName: home?.operations?.wifiName ?? "",
      wifiPassword: home?.operations?.wifiPassword ?? "",
      parkingInstructions: home?.parkingInstructions ?? "",
      trashInstructions: home?.operations?.trashInstructions ?? "",
      supplyLocations: home?.supplyLocations ?? "",
      privateCleanerNotes: home?.notes ?? "",
    };
  }

  async function handleUpdateProperty(values: CleanerPropertyFormValues) {
    if (!editingHome) return;
    setIsSavingProperty(true);
    try {
      await onUpdateProperty(String(editingHome.id), values);
      setEditingHome(null);
    } finally {
      setIsSavingProperty(false);
    }
  }

  async function handleDeleteProperty(home: any) {
    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${home.name ?? "this property"}.`
    );
    if (confirmation !== "DELETE") return;
    await onDeleteProperty(String(home.id));
    if (selectedHomeId === String(home.id)) setSelectedHomeId(null);
  }

  async function copyCalendarRequest(values: CleanerPropertyFormValues) {
    const message = buildCalendarRequestMessage(values);
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(
        "Text message copied. Paste it into your phone or preferred messaging app."
      );
    } catch {
      window.prompt("Copy this calendar request:", message);
    }
  }

  function openEmailRequest(values: CleanerPropertyFormValues) {
    const subject = encodeURIComponent(
      `Calendar link needed for ${values.propertyName}`
    );
    const body = encodeURIComponent(buildCalendarRequestMessage(values));
    window.location.href = `mailto:${values.ownerEmail}?subject=${subject}&body=${body}`;
  }

 function isMobileDevice() {
  const userAgentData = (navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  }).userAgentData;

  if (userAgentData?.mobile === true) {
    return true;
  }

  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
    return true;
  }

  // Allow Chrome responsive mode to behave like mobile
  return window.matchMedia("(max-width: 700px)").matches;
}

  async function openTextRequest(values: CleanerPropertyFormValues) {
    if (!isMobileDevice()) {
      await copyCalendarRequest(values);
      return;
    }
    const body = encodeURIComponent(buildCalendarRequestMessage(values));
    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${values.ownerPhone}${separator}body=${body}`;
  }

  if (savedProperty) {
    const calendarConnected = Boolean(calendarImportStatus);

    return (
      <main className="cleanerPropertySavedPage">
        <style>{`
          .cleanerCalendarConnectBox {
            width: 100%;
            margin: 22px 0 16px;
            padding: 18px;
            border: 1px solid #dbeafe;
            border-radius: 20px;
            background: #f8fbff;
            text-align: left;
          }
          .cleanerCalendarConnectBox h2 {
            margin: 0 0 6px;
            font-size: 20px;
          }
          .cleanerCalendarConnectBox p {
            margin: 0 0 14px;
            color: #64748b;
          }
          .cleanerCalendarConnectRow {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
          }
          .cleanerCalendarConnectRow input {
            min-width: 0;
          }
          .cleanerCalendarImportStatus,
          .cleanerCalendarImportError {
            margin: 12px 0 0 !important;
            padding: 11px 12px;
            border-radius: 14px;
            font-weight: 700;
          }
          .cleanerCalendarImportStatus {
            background: #dcfce7;
            color: #166534 !important;
          }
          .cleanerCalendarImportError {
            background: #fee2e2;
            color: #991b1b !important;
          }
          .cleanerPropertySavedActions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            width: 100%;
          }
          .cleanerPropertySavedActions button,
          .cleanerPropertySavedLaterButton {
            min-height: 46px;
            border-radius: 14px !important;
            padding: 0 16px !important;
            font-weight: 850 !important;
          }
          .cleanerPropertySavedLaterButton {
            width: 100%;
            margin-top: 12px;
            border: 0;
            background: transparent;
            color: #475569;
          }
          .cleanerPropertyRequestDivider {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 18px 0;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .08em;
          }
          .cleanerPropertyRequestDivider::before,
          .cleanerPropertyRequestDivider::after {
            content: "";
            flex: 1;
            height: 1px;
            background: #e2e8f0;
          }
          @media (max-width: 700px) {
            .cleanerCalendarConnectRow { grid-template-columns: 1fr; }
            .cleanerPropertySavedActions { grid-template-columns: 1fr; }
          }
        `}</style>

        <section className="cleanerPropertySavedCard">
          <div className="cleanerPropertySavedIcon">✓</div>
          <p className="cleanerPropertiesEyebrow">Property created</p>
          <h1>{savedProperty.propertyName}</h1>
          <p className="cleanerPropertySavedLead">
            The property is saved. Paste the Airbnb or VRBO iCal link now to
            import upcoming reservations.
          </p>

          <div className="cleanerCalendarConnectBox">
            <h2>Connect Your Reservation Calendar</h2>
            <p>
              Paste the complete calendar link the homeowner sent by text,
              email, or another messaging app.
            </p>

            <div className="cleanerCalendarConnectRow">
              <input
                type="url"
                value={calendarUrl}
                onChange={(event) => {
                  setCalendarUrl(event.target.value);
                  setCalendarImportError("");
                }}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                autoFocus
                disabled={isImportingCalendar || calendarConnected}
                aria-label="Airbnb or VRBO iCal calendar link"
              />
              <button
                className="cleanerCreatePropertySubmitButton"
                type="button"
                onClick={() => void importSavedPropertyCalendar()}
                disabled={
                  !calendarUrl.trim() ||
                  isImportingCalendar ||
                  calendarConnected
                }
              >
                {isImportingCalendar
                  ? "Importing..."
                  : calendarConnected
                    ? "Connected"
                    : "Import Reservations"}
              </button>
            </div>

            {calendarImportStatus && (
              <p className="cleanerCalendarImportStatus">
                ✓ {calendarImportStatus}
              </p>
            )}
            {calendarImportError && (
              <p className="cleanerCalendarImportError">
                {calendarImportError}
              </p>
            )}
          </div>

          {!calendarConnected && (
            <>
              <div className="cleanerPropertyRequestDivider">
                Need the calendar?
              </div>

              <div className="cleanerPropertySavedOwner">
                <span>Request it from</span>
                <strong>{savedProperty.ownerName}</strong>
                {savedProperty.ownerEmail && <p>{savedProperty.ownerEmail}</p>}
                {savedProperty.ownerPhone && <p>{savedProperty.ownerPhone}</p>}
              </div>

              <div className="cleanerPropertySavedActions">
                {savedProperty.ownerPhone && isMobileDevice() && (
                  <button
                    className="cleanerCreatePropertySubmitButton"
                    type="button"
                    onClick={() => void openTextRequest(savedProperty)}
                  >
                    Text Homeowner
                  </button>
                )}

                <button
                  className="cleanerCreatePropertyCancelButton"
                  type="button"
                  onClick={() => void copyCalendarRequest(savedProperty)}
                >
                  Copy Request
                </button>

                {savedProperty.ownerEmail && (
                  <button
                    className="cleanerCreatePropertyCancelButton"
                    type="button"
                    onClick={() => openEmailRequest(savedProperty)}
                  >
                    Email Homeowner
                  </button>
                )}
              </div>

              {copyStatus && (
                <p className="cleanerPropertyRequestCopyStatus">
                  {copyStatus}
                </p>
              )}
            </>
          )}

          <button
            className="cleanerPropertySavedLaterButton"
            type="button"
            onClick={() => setSavedProperty(null)}
          >
            {calendarConnected ? "Return to Properties" : "Do This Later"}
          </button>
        </section>
      </main>
    );
  }

  if (editingHome) {
    return (
      <CleanerCreatePropertyPage
        key={`edit-property-${editingHome.id}`}
        clients={clients}
        onCreateClient={onCreateClient}
        onCancel={() => setEditingHome(null)}
        onSubmit={handleUpdateProperty}
        onDelete={async () => {
          await handleDeleteProperty(editingHome);
          setEditingHome(null);
        }}
        propertyNameForDelete={editingHome.name || "this property"}
        isSaving={isSavingProperty}
        initialValues={mapHomeToFormValues(editingHome)}
        mode="edit"
      />
    );
  }

  if (showCreateProperty) {
    return (
      <CleanerCreatePropertyPage
        key={`create-property-blank-${createPropertyFormKey}`}
        clients={clients}
        onCreateClient={onCreateClient}
        onCancel={() => {
          setShowCreateProperty(false);
          setCalendarUrl("");
          setCopyStatus("");
        }}
        onSubmit={handleCreateProperty}
        isSaving={isSavingProperty}
      />
    );
  }

  if (selectedHome) {
    const propertyWorkOrders = workOrders.filter(
      (order) => String(order.homeId) === String(selectedHome.id)
    );
    const openPropertyWorkOrders = propertyWorkOrders.filter(
      (order) => order.status !== "Completed"
    );
    return (
      <CleanerPropertyDetailPage
        home={{
          ...selectedHome,
          outstandingInvoiceCount: getOutstandingInvoicesForHome(
            String(selectedHome.id)
          ).length,
          outstandingInvoices: getOutstandingInvoicesForHome(
            String(selectedHome.id)
          ),
          openMaintenanceCount: openPropertyWorkOrders.length,
          openMaintenanceIssues: openPropertyWorkOrders,
          maintenanceHistory: propertyWorkOrders,
        }}
        reservations={reservations}
        invoices={propertyInvoices}
        onConnectCalendar={onConnectCalendar}
        onResyncCalendar={async (propertyId) => {
          if (!resyncCalendar) {
            throw new Error("Calendar resync is not configured.");
          }
          return resyncCalendar(propertyId);
        }}
        onBack={() => setSelectedHomeId(null)}
        onEdit={() => setEditingHome(selectedHome)}
      />
    );
  }

  return (
    <main className="cleanerPropertiesPage">
      <style>{`
        .cleanerPropertySetupMeter { margin:16px 0 4px; padding:16px; border-radius:18px; background:#f8fafc; border:1px solid #e2e8f0; }
        .cleanerPropertySetupTop { display:flex; justify-content:space-between; gap:12px; margin-bottom:9px; font-size:13px; font-weight:900; color:#334155; }
        .cleanerPropertySetupTrack { height:10px; overflow:hidden; border-radius:999px; background:#e2e8f0; }
        .cleanerPropertySetupTrack span { display:block; height:100%; border-radius:inherit; transition:width .2s ease; }
        .cleanerPropertySetupMeter.critical .cleanerPropertySetupTrack span { background:#ef4444; }
        .cleanerPropertySetupMeter.warning .cleanerPropertySetupTrack span { background:#f97316; }
        .cleanerPropertySetupMeter.watch .cleanerPropertySetupTrack span { background:#eab308; }
        .cleanerPropertySetupMeter.healthy .cleanerPropertySetupTrack span { background:#22c55e; }
        .cleanerPropertySetupChecklist { display:grid; gap:7px; margin-top:13px; }
        .cleanerPropertySetupStep { width:100%; border:0; background:transparent; display:flex; align-items:center; gap:9px; padding:5px 0; text-align:left; color:#334155; font-weight:750; }
        .cleanerPropertySetupStep.actionable:hover { color:#2563eb; }
        .cleanerPropertySetupStepIcon { width:20px; height:20px; border-radius:999px; display:grid; place-items:center; flex:0 0 auto; background:#e2e8f0; color:#64748b; font-size:11px; font-weight:900; }
        .cleanerPropertySetupStep.complete .cleanerPropertySetupStepIcon { background:#dcfce7; color:#166534; }
        .cleanerPropertySetupStepArrow { margin-left:auto; color:#94a3b8; }
        .cleanerPropertySetupNext { margin:12px 0 0; padding-top:11px; border-top:1px solid #e2e8f0; color:#475569; font-size:12px; font-weight:800; }
        .cleanerPropertiesMetrics.threeUp { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .cleanerAcademyMetric { border:1px solid #c7d2fe; background:#eef2ff; text-align:left; }
        .cleanerAcademyMetric small { display:block; margin-top:3px; color:#6366f1; font-size:10px; font-weight:800; }
        .cleanerPropertySimpleStats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
        .cleanerPropertySimpleStats div { padding:11px 12px; border-radius:14px; background:#f8fafc; }
        .cleanerPropertySimpleStats span { display:block; color:#64748b; font-size:11px; }
        .cleanerPropertySimpleStats strong { display:block; margin-top:4px; font-size:14px; }
        .amrModalOverlay { position:fixed; inset:0; z-index:100000; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.48); }
        .amrModalCard { width:min(620px,100%); max-height:90vh; overflow:auto; background:white; border-radius:24px; padding:22px; box-shadow:0 24px 70px rgba(15,23,42,.28); }
        .amrModalHeader { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
        .amrModalHeader h2 { margin:2px 0 6px; }
        .amrModalClose { border:0; width:36px; height:36px; border-radius:999px; background:#f1f5f9; font-weight:900; }
        .amrAcademyList { display:grid; gap:10px; margin-top:18px; }
        .amrAcademyItem { display:flex; justify-content:space-between; gap:12px; padding:14px; border-radius:16px; background:#f8fafc; }
        .amrAcademyItem span { color:#7c3aed; font-size:11px; font-weight:900; }
        .calendarConnectField { display:grid; gap:8px; margin:18px 0 12px; }
        .calendarConnectField label { font-size:12px; font-weight:900; color:#475569; }
        .calendarConnectActions { display:flex; flex-wrap:wrap; gap:10px; }
        .calendarConnectStatus { margin-top:12px; padding:11px 12px; border-radius:14px; background:#dcfce7; color:#166534; font-weight:800; }
        .calendarConnectError { margin-top:12px; padding:11px 12px; border-radius:14px; background:#fee2e2; color:#991b1b; font-weight:800; }
        .calendarConnectStatus { margin:12px 0 0; padding:11px 12px; border-radius:14px; background:#dcfce7; color:#166534; font-weight:800; }
        .calendarSuccessCard { display:grid; gap:14px; text-align:center; padding:18px 4px 4px; }
        .calendarSuccessIcon { width:62px; height:62px; margin:0 auto; display:grid; place-items:center; border-radius:999px; background:#dcfce7; color:#166534; font-size:30px; font-weight:900; }
        .calendarSuccessCard h2 { margin:0; font-size:26px; }
        .calendarSuccessCard p { margin:0; color:#64748b; }
        .calendarSuccessCount { padding:16px; border-radius:18px; background:#f0fdf4; border:1px solid #bbf7d0; }
        .calendarSuccessCount strong { display:block; font-size:34px; color:#166534; }
        .calendarSuccessActions { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .calendarSuccessToast { position:fixed; top:18px; left:50%; transform:translateX(-50%); z-index:1000002; width:min(92vw,560px); padding:14px 18px; border-radius:16px; background:#166534; color:white; box-shadow:0 18px 50px rgba(15,23,42,.24); font-weight:900; text-align:center; }
        .calendarResyncToast { position:fixed; top:18px; left:50%; transform:translateX(-50%); z-index:1000002; width:min(92vw,620px); padding:14px 18px; border-radius:16px; background:#166534; color:white; box-shadow:0 18px 50px rgba(15,23,42,.24); font-weight:900; text-align:center; }
        .calendarResyncToast.error { background:#991b1b; }
        .cleanerPropertyResyncButton { border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; font-weight:850; }

        @media(max-width:700px){
          .cleanerPropertiesMetrics.threeUp{grid-template-columns:1fr 1fr;}
          .cleanerAcademyMetric{grid-column:1/-1;}
          .amrModalOverlay{
            padding:16px 12px calc(96px + env(safe-area-inset-bottom));
            align-items:center;
          }
          .amrModalCard{
            border-radius:24px;
            width:100%;
            max-height:calc(100dvh - 128px);
            padding:20px 18px;
          }
          .calendarConnectActions{
            display:grid;
            grid-template-columns:1fr;
          }
          .calendarConnectActions button{
            width:100%;
            min-height:46px;
          }
          .calendarSuccessActions{
            grid-template-columns:1fr;
          }
        }
      `}</style>
      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">My Properties</p>
          <h1>Properties</h1>
          <p className="cleanerPropertiesSubtitle">
            Build and manage every home
            {activeCleaner?.name ? ` connected to ${activeCleaner.name}` : ""}.
          </p>
        </div>
        <button className="cleanerPropertyAddButton" type="button" onClick={openBlankCreatePropertyForm}>
          + Add Property
        </button>
      </header>

      {cleanerHomes.length === 0 ? (
        <section className="cleanerPropertiesFirstProperty">
          <div className="cleanerPropertiesFirstPropertyIcon">🏡</div>
          <p className="cleanerPropertiesEyebrow">Start here</p>
          <h2>Create your first property</h2>
          <p>Add the home, cleaning workload, homeowner contact information, access details, invoices, and maintenance in one place.</p>
          <button className="cleanerCreateFirstPropertyButton" type="button" onClick={openBlankCreatePropertyForm}>
            Create Property <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <>
          <section className="cleanerPropertiesMetrics threeUp" aria-label="Property summary">
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">🏡</div><div><strong>{cleanerHomes.length}</strong><span>Properties</span></div></article>
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">🔗</div><div><strong>{connectedCalendars}/{cleanerHomes.length}</strong><span>Calendars Connected</span></div></article>
            <button className="cleanerPropertiesMetricCard cleanerAcademyMetric" type="button" onClick={() => setShowAcademy(true)}><div className="cleanerPropertiesMetricIcon">🎓</div><div><strong>AMR Academy</strong><span>Quick setup guides</span><small>Beta · Videos coming soon</small></div></button>
          </section>

          <section className="cleanerPropertiesToolbar">
            <label className="cleanerPropertiesSearch"><span aria-hidden="true">⌕</span><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search properties..." aria-label="Search properties" /></label>
            <span className="cleanerPropertiesResultCount">{filteredHomes.length} {filteredHomes.length === 1 ? "property" : "properties"}</span>
          </section>

          {filteredHomes.length === 0 ? (
            <section className="cleanerPropertiesEmptyState"><div className="cleanerPropertiesEmptyIcon">🔎</div><h2>No matching properties</h2><p>Try searching by property name, owner, city, or address.</p></section>
          ) : (
            <section className="cleanerPropertiesGrid">
              {filteredHomes.map((home) => {
                const propertyName = home.name || "Unnamed Property";
                const propertyImage = home.imageUrl || home.photoUrl || home.propertyPhoto || home.coverImage;
                const propertyAddress = [home.address, home.city].filter(Boolean).join(", ") || "Address not added";
                const ownerName = home.ownerName || "Owner not added";
                const calendarConnected = Boolean(
                  home.calendarFeedUrl || home.iCalUrl || home.airbnbUrl
                );
                const cleaningFee = home.cleaningFee ?? home.cleanerFee ?? home.standardCleaningFee ?? home.defaultCleaningFee;
                const propertySetup = getPropertySetup(home);
                const nextSetupStep = propertySetup.steps.find(
                  (step) => !step.complete
                );

                return (
                  <article className="cleanerPropertyCard" key={home.id}>
                    <div className="cleanerPropertyCardImage">
                      {propertyImage ? <img src={propertyImage} alt={propertyName} /> : <div className="cleanerPropertyCardImagePlaceholder"><span>🏡</span><small>Property photo</small></div>}
                      <span className={calendarConnected ? "cleanerPropertyCalendarBadge isConnected" : "cleanerPropertyCalendarBadge needsConnection"}>{calendarConnected ? "Calendar Connected" : "Calendar Needed"}</span>
                    </div>
                    <div className="cleanerPropertyCardBody">
                      <div className="cleanerPropertyCardTitleRow"><div><p className="cleanerPropertyCardLabel">Property</p><h2>{propertyName}</h2></div><span className="cleanerPropertyActivePill">{home.status || "Active"}</span></div>
                      <p className="cleanerPropertyOwner">{ownerName}</p>
                      <p className="cleanerPropertyAddress"><span aria-hidden="true">📍</span>{propertyAddress}</p>
                      <div className="cleanerPropertySimpleStats">
                        <div><span>Cleaning Fee</span><strong>{cleaningFee !== undefined && cleaningFee !== null && cleaningFee !== "" ? `$${Number(cleaningFee).toLocaleString()}` : "Not set"}</strong></div>
                        <div><span>Calendar</span><strong>{calendarConnected ? "Connected" : "Needed"}</strong></div>
                      </div>
                      <div
                        className={`cleanerPropertySetupMeter ${getProgressTone(propertySetup.percent)}`}
                        aria-label={`Setup progress ${propertySetup.percent}%`}
                      >
                        <div className="cleanerPropertySetupTop">
                          <span>
                            {propertySetup.percent === 100
                              ? "Property Health"
                              : "Setup Progress"}
                          </span>
                          <strong>{propertySetup.percent}%</strong>
                        </div>
                        <div className="cleanerPropertySetupTrack">
                          <span
                            style={{ width: `${propertySetup.percent}%` }}
                          />
                        </div>
                        <div className="cleanerPropertySetupChecklist">
                          {propertySetup.steps.map((step) => (
                            <button
                              key={step.id}
                              type="button"
                              className={`cleanerPropertySetupStep ${step.complete ? "complete" : "actionable"}`}
                              onClick={() => !step.complete && handleSetupStep(home, step.id)}
                              disabled={step.complete}
                            >
                              <span className="cleanerPropertySetupStepIcon">{step.complete ? "✓" : "○"}</span>
                              <span>{step.label}</span>
                              {!step.complete && <span className="cleanerPropertySetupStepArrow">→</span>}
                            </button>
                          ))}
                        </div>
                        <p className="cleanerPropertySetupNext">
                          {nextSetupStep ? `Next recommended step: ${nextSetupStep.label}` : "Setup complete and operating normally."}
                        </p>
                      </div>
                      <div className="cleanerPropertyCardActions">
                        <button
                          className="cleanerPropertyDeleteButton"
                          type="button"
                          onClick={() => handleDeleteProperty(home)}
                        >
                          Delete
                        </button>

                        {calendarConnected && (
                          <button
                            className="cleanerPropertyResyncButton"
                            type="button"
                            disabled={resyncingHomeId === String(home.id)}
                            onClick={() => void resyncPropertyCalendar(home)}
                          >
                            {resyncingHomeId === String(home.id)
                              ? "Refreshing..."
                              : "↻ Resync Calendar"}
                          </button>
                        )}

                        <button
                          className="cleanerPropertyOpenButton"
                          type="button"
                          onClick={() => setSelectedHomeId(String(home.id))}
                        >
                          Open Property <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      {resyncMessage && (
        <button
          type="button"
          className="calendarResyncToast"
          role="status"
          onClick={() => setResyncMessage("")}
        >
          ✓ {resyncMessage}
        </button>
      )}

      {resyncError && (
        <button
          type="button"
          className="calendarResyncToast error"
          role="alert"
          onClick={() => setResyncError("")}
        >
          {resyncError}
        </button>
      )}

      {showAcademy && (
        <div className="amrModalOverlay" role="presentation" onClick={() => setShowAcademy(false)}>
          <section className="amrModalCard" role="dialog" aria-modal="true" aria-label="AMR Academy" onClick={(event) => event.stopPropagation()}>
            <div className="amrModalHeader"><div><p className="cleanerPropertiesEyebrow">Beta learning center</p><h2>AMR Academy</h2><p>Short walkthroughs will be added as AMR moves through beta.</p></div><button className="amrModalClose" type="button" onClick={() => setShowAcademy(false)}>×</button></div>
            <div className="amrAcademyList">
              {["Create your first property", "Connect an Airbnb calendar", "Connect a VRBO calendar", "Use Cleaner Pulse", "Send your first invoice"].map((title) => <div className="amrAcademyItem" key={title}><strong>▶ {title}</strong><span>COMING SOON</span></div>)}
            </div>
          </section>
        </div>
      )}

      {calendarSuccess && (
        <div className="calendarSuccessToast" role="status">
          Calendar connected — {calendarSuccess.importedCount} {calendarSuccess.importedCount === 1 ? "entry" : "entries"} imported
        </div>
      )}

      {calendarSetupHome && (
        <div className="amrModalOverlay" role="presentation" onClick={() => setCalendarSetupHome(null)}>
          <section className="amrModalCard" role="dialog" aria-modal="true" aria-label="Connect reservation calendar" onClick={(event) => event.stopPropagation()}>
            {calendarSuccess ? (
              <div className="calendarSuccessCard">
                <div className="calendarSuccessIcon">✓</div>
                <p className="cleanerPropertiesEyebrow">Calendar connected</p>
                <h2>{calendarSuccess.propertyName}</h2>
                <p>{calendarSuccess.source} is connected and AMR refreshed the property schedule.</p>
                <div className="calendarSuccessCount">
                  <strong>{calendarSuccess.importedCount}</strong>
                  <span>{calendarSuccess.importedCount === 1 ? "calendar entry imported" : "calendar entries imported"}</span>
                </div>
                <div className="calendarSuccessActions">
                  <button
                    className="cleanerCreatePropertySubmitButton"
                    type="button"
                    onClick={() => {
                      setCalendarSetupHome(null);
                      setSelectedHomeId(String(calendarSetupHome.id));
                    }}
                  >
                    Open Property
                  </button>
                  <button
                    className="cleanerCreatePropertyCancelButton"
                    type="button"
                    onClick={() => setCalendarSetupHome(null)}
                  >
                    Return to Properties
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="amrModalHeader"><div><p className="cleanerPropertiesEyebrow">Property setup</p><h2>Connect Reservation Calendar</h2><p>{calendarSetupHome.name || "Property"}</p></div><button className="amrModalClose" type="button" onClick={() => setCalendarSetupHome(null)}>×</button></div>
                <div className="calendarConnectField"><label htmlFor="setup-calendar-url">Paste Airbnb or VRBO iCal link</label><input id="setup-calendar-url" type="url" value={setupCalendarUrl} onChange={(event) => setSetupCalendarUrl(event.target.value)} placeholder="https://www.airbnb.com/calendar/ical/..." autoFocus /></div>
                <div className="calendarConnectActions"><button className="cleanerCreatePropertySubmitButton" type="button" disabled={!setupCalendarUrl.trim() || isSetupCalendarSaving} onClick={() => void connectExistingPropertyCalendar()}>{isSetupCalendarSaving ? "Importing..." : "Import Reservations"}</button><button className="cleanerCreatePropertyCancelButton" type="button" onClick={() => setEditingHome(calendarSetupHome)}>Edit homeowner contact</button></div>
                {setupCalendarStatus && <p className="calendarConnectStatus">✓ {setupCalendarStatus}</p>}
                {setupCalendarError && <p className="calendarConnectError">{setupCalendarError}</p>}
                <p className="cleanerPropertySetupNext">Need the link first? Open the property to call, email, copy a request, or text from a phone.</p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
