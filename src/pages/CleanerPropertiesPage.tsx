import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";
import CleanerCreatePropertyPage, {
  type CleanerPropertyFormValues,
} from "./CleanerCreatePropertyPage";
import CleanerPropertyDetailPage from "./CleanerPropertyDetailPage";

type CleanerPropertiesPageProps = {
  homes: any[];
  reservations: any[];
  cleaners: any[];
  workOrders: any[];
  cleanerPortalId: string | null;
  onCreateProperty: (values: CleanerPropertyFormValues) => Promise<void>;
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
  cleaners,
  workOrders,
  cleanerPortalId,
  onCreateProperty,
  onUpdateProperty,
  onDeleteProperty,
}: CleanerPropertiesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [editingHome, setEditingHome] = useState<any | null>(null);
  const [isSavingProperty, setIsSavingProperty] = useState(false);
  const [savedProperty, setSavedProperty] =
    useState<CleanerPropertyFormValues | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [propertyInvoices, setPropertyInvoices] = useState<any[]>([]);

  const activeCleaner = cleaners.find(
    (cleaner) => String(cleaner.id) === String(cleanerPortalId)
  );

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
    (home) => home.calendarFeedUrl || home.iCalUrl
  ).length;

  const openMaintenanceCount = workOrders.filter(
    (order) =>
      cleanerHomes.some((home) => String(home.id) === String(order.homeId)) &&
      order.status !== "Completed"
  ).length;

  const outstandingInvoiceCount = cleanerHomes.reduce(
    (total, home) =>
      total + getOutstandingInvoicesForHome(String(home.id)).length,
    0
  );

  const selectedHome = cleanerHomes.find(
    (home) => String(home.id) === String(selectedHomeId)
  );

  async function handleCreateProperty(values: CleanerPropertyFormValues) {
    setIsSavingProperty(true);
    try {
      await onCreateProperty(values);
      setShowCreateProperty(false);
      setSavedProperty(values);
      setCopyStatus("");
    } finally {
      setIsSavingProperty(false);
    }
  }

  function mapHomeToFormValues(home: any): CleanerPropertyFormValues {
    return {
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
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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
    return (
      <main className="cleanerPropertySavedPage">
        <section className="cleanerPropertySavedCard">
          <div className="cleanerPropertySavedIcon">✓</div>
          <p className="cleanerPropertiesEyebrow">Property saved</p>
          <h1>{savedProperty.propertyName}</h1>
          <p className="cleanerPropertySavedLead">
            The property details and cleaning fee have been saved. The reservation calendar is still needed from the homeowner.
          </p>
          <div className="cleanerPropertySavedOwner">
            <span>Calendar request will go to</span>
            <strong>{savedProperty.ownerName}</strong>
            {savedProperty.ownerEmail && <p>{savedProperty.ownerEmail}</p>}
            {savedProperty.ownerPhone && <p>{savedProperty.ownerPhone}</p>}
          </div>
          <div className="cleanerPropertySavedActions">
            {savedProperty.ownerEmail && (
              <button className="cleanerCreatePropertySubmitButton" type="button" onClick={() => openEmailRequest(savedProperty)}>
                Request by Email
              </button>
            )}
            {savedProperty.ownerPhone && (
              <button className="cleanerCreatePropertyCancelButton" type="button" onClick={() => openTextRequest(savedProperty)}>
                {isMobileDevice() ? "Text Homeowner" : "Copy Text Message"}
              </button>
            )}
          </div>
          {copyStatus && <p className="cleanerPropertyRequestCopyStatus">{copyStatus}</p>}
          <button className="cleanerPropertySavedLaterButton" type="button" onClick={() => setSavedProperty(null)}>
            Do This Later
          </button>
        </section>
      </main>
    );
  }

  if (editingHome) {
    return (
      <CleanerCreatePropertyPage
        onCancel={() => setEditingHome(null)}
        onSubmit={handleUpdateProperty}
        isSaving={isSavingProperty}
        initialValues={mapHomeToFormValues(editingHome)}
        mode="edit"
      />
    );
  }

  if (showCreateProperty) {
    return (
      <CleanerCreatePropertyPage
        onCancel={() => setShowCreateProperty(false)}
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
        onBack={() => setSelectedHomeId(null)}
        onEdit={() => setEditingHome(selectedHome)}
      />
    );
  }

  return (
    <main className="cleanerPropertiesPage">
      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">My Properties</p>
          <h1>Properties</h1>
          <p className="cleanerPropertiesSubtitle">
            Build and manage every home
            {activeCleaner?.name ? ` connected to ${activeCleaner.name}` : ""}.
          </p>
        </div>
        <button className="cleanerPropertyAddButton" type="button" onClick={() => setShowCreateProperty(true)}>
          + Add Property
        </button>
      </header>

      {cleanerHomes.length === 0 ? (
        <section className="cleanerPropertiesFirstProperty">
          <div className="cleanerPropertiesFirstPropertyIcon">🏡</div>
          <p className="cleanerPropertiesEyebrow">Start here</p>
          <h2>Create your first property</h2>
          <p>Add the home, cleaning workload, homeowner contact information, access details, invoices, and maintenance in one place.</p>
          <button className="cleanerCreateFirstPropertyButton" type="button" onClick={() => setShowCreateProperty(true)}>
            Create Property <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <>
          <section className="cleanerPropertiesMetrics" aria-label="Property summary">
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">🏡</div><div><strong>{cleanerHomes.length}</strong><span>Properties</span></div></article>
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">💵</div><div><strong>{outstandingInvoiceCount}</strong><span>Outstanding Invoices</span></div></article>
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">🛠️</div><div><strong>{openMaintenanceCount}</strong><span>Open Maintenance</span></div></article>
            <article className="cleanerPropertiesMetricCard"><div className="cleanerPropertiesMetricIcon">🔗</div><div><strong>{connectedCalendars}/{cleanerHomes.length}</strong><span>Calendars Connected</span></div></article>
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
                const calendarConnected = Boolean(home.calendarFeedUrl || home.iCalUrl);
                const cleaningFee = home.cleaningFee ?? home.cleanerFee ?? home.standardCleaningFee ?? home.defaultCleaningFee;
                const propertyOpenMaintenance = workOrders.filter((order) => String(order.homeId) === String(home.id) && order.status !== "Completed").length;
                const propertyOutstandingInvoices =
                  getOutstandingInvoicesForHome(String(home.id)).length;

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
                      <div className="cleanerPropertyCardStats">
                        <div><span>Outstanding Invoices</span><strong>{propertyOutstandingInvoices}</strong></div>
                        <div><span>Open Maintenance</span><strong>{propertyOpenMaintenance}</strong></div>
                        <div><span>Cleaning Fee</span><strong>{cleaningFee !== undefined && cleaningFee !== null && cleaningFee !== "" ? `$${Number(cleaningFee).toLocaleString()}` : "Not set"}</strong></div>
                        <div><span>Calendar</span><strong>{calendarConnected ? "Connected" : "Needed"}</strong></div>
                      </div>
                      <div className="cleanerPropertyCardActions">
                        <button className="cleanerPropertyDeleteButton" type="button" onClick={() => handleDeleteProperty(home)}>Delete</button>
                        <button className="cleanerPropertyOpenButton" type="button" onClick={() => setSelectedHomeId(String(home.id))}>Open Property <span aria-hidden="true">→</span></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}
