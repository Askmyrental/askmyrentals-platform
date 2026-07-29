import { useState } from "react";

type CleanerPropertyDetailPageProps = {
  home: any;
  reservations: any[];
  invoices: any[];
  onConnectCalendar: (
    propertyId: string,
    calendarUrl: string,
  ) => Promise<{ importedCount: number; source: string }>;
  onResyncCalendar: (
    propertyId: string,
  ) => Promise<{ importedCount: number }>;
  onBack: () => void;
  onEdit: () => void;
};

function buildCalendarRequestMessage(home: any) {
  return `Hi ${home?.client?.name ?? home?.ownerName ?? "there"}, I added ${home?.name || "your property"} to AMR Cleaner. Could you send me the iCal reservation calendar link from the booking platform you use? Once I receive it, I can connect the calendar and import upcoming cleanings automatically.`;
}

export default function CleanerPropertyDetailPage({
  home,
  reservations,
  invoices,
  onConnectCalendar,
  onResyncCalendar,
  onBack,
  onEdit,
}: CleanerPropertyDetailPageProps) {
  const [requestStatus, setRequestStatus] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [calendarStatus, setCalendarStatus] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isResyncingCalendar, setIsResyncingCalendar] = useState(false);
  const [resyncStatus, setResyncStatus] = useState("");
  const [resyncError, setResyncError] = useState("");
  const [calendarResult, setCalendarResult] = useState<{
    source: string;
    importedCount: number;
  } | null>(null);
  const propertyName = home?.name || "Unnamed Property";
  const propertyImage =
    home?.imageUrl || home?.photoUrl || home?.propertyPhoto || home?.coverImage;
  const propertyAddress =
    [home?.address, home?.city].filter(Boolean).join(", ") ||
    "Address not added";
  const clientName =
    home?.client?.name ?? home?.ownerName ?? "Client not added";
  const clientEmail =
    home?.client?.email ?? home?.ownerEmail ?? "";
  const clientPhone =
    home?.client?.phone ?? home?.ownerPhone ?? "";
  const calendarConnected = Boolean(
    home?.calendarFeedUrl || home?.iCalUrl || home?.airbnbUrl,
  );
  const cleaningFee =
    home?.cleaningFee ??
    home?.cleanerFee ??
    home?.standardCleaningFee ??
    home?.defaultCleaningFee;
  const outstandingInvoiceCount =
    home?.outstandingInvoiceCount ?? home?.outstandingInvoices?.length ?? 0;
  const openMaintenanceCount =
    home?.openMaintenanceCount ?? home?.openMaintenanceIssues?.length ?? 0;
  const outstandingInvoices = Array.isArray(home?.outstandingInvoices)
    ? home.outstandingInvoices
    : [];
  const maintenanceItems = Array.isArray(home?.maintenanceHistory)
    ? home.maintenanceHistory
    : Array.isArray(home?.openMaintenanceIssues)
      ? home.openMaintenanceIssues
      : [];
  const homeReservations = reservations.filter(
    (reservation: any) =>
      String(
        reservation.homeId ?? reservation.propertyId ?? reservation.property_id,
      ) === String(home?.id),
  );
  const homeInvoices = invoices.filter(
    (invoice: any) => String(invoice.property_id) === String(home?.id),
  );
  const setupSteps = [
    { label: "Property created", complete: true },
    {
      label: "Client information",
      complete: Boolean(
        clientName !== "Client not added" && Boolean(clientEmail || clientPhone),
      ),
    },
    { label: "Calendar connected", complete: calendarConnected },
    {
      label: "Reservations imported",
      complete: calendarConnected && homeReservations.length > 0,
    },
    {
      label: "First cleaning completed",
      complete: homeReservations.some((reservation: any) =>
        String(reservation.status ?? "")
          .toLowerCase()
          .includes("complete"),
      ),
    },
    {
      label: "First invoice sent",
      complete: homeInvoices.some((invoice: any) =>
        ["sent", "viewed", "paid", "overdue"].includes(String(invoice.status)),
      ),
    },
  ];
  const setupPercent = Math.round(
    (setupSteps.filter((step) => step.complete).length / setupSteps.length) *
      100,
  );
  const setupTone =
    setupPercent < 40
      ? "critical"
      : setupPercent < 70
        ? "warning"
        : setupPercent < 90
          ? "watch"
          : "healthy";
  const nextStep = setupSteps.find((step) => !step.complete);

  const bedding = [
    ["King", home?.kingBeds],
    ["Queen", home?.queenBeds],
    ["Double", home?.doubleBeds],
    ["Twin", home?.twinBeds],
    ["Bunk", home?.bunkBeds],
    ["Pyramid bunk", home?.pyramidBunks],
    ["Murphy bed", home?.murphyBeds],
    ["Sofa sleeper", home?.sofaSleepers],
  ].filter(([, count]) => Number(count) > 0);

  async function copyCalendarRequest() {
    const message = buildCalendarRequestMessage(home);

    try {
      await navigator.clipboard.writeText(message);
      setRequestStatus(
        "Text message copied. Paste it into your phone or preferred messaging app.",
      );
    } catch {
      window.prompt("Copy this calendar request:", message);
    }
  }

  function requestByEmail() {
    const subject = encodeURIComponent(
      `Calendar link needed for ${propertyName}`,
    );
    const body = encodeURIComponent(buildCalendarRequestMessage(home));
    window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
  }

  function isMobileDevice() {
    const userAgentData = (navigator as Navigator & {
      userAgentData?: { mobile?: boolean };
    }).userAgentData;

    if (typeof userAgentData?.mobile === "boolean") {
      return userAgentData.mobile;
    }

    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async function requestByText() {
    if (!isMobileDevice()) {
      await copyCalendarRequest();
      return;
    }

    const body = encodeURIComponent(buildCalendarRequestMessage(home));
    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${clientPhone}${separator}body=${body}`;
  }

  async function connectCalendar() {
    if (!calendarUrl.trim()) return;
    setIsConnectingCalendar(true);
    setCalendarStatus("Checking calendar and importing reservations...");
    setCalendarError("");
    try {
      const result = await onConnectCalendar(
        String(home.id),
        calendarUrl.trim(),
      );
      setCalendarStatus("");
      setCalendarResult({
        source: result.source,
        importedCount: result.importedCount,
      });
    } catch (error) {
      setCalendarStatus("");
      setCalendarError(
        error instanceof Error
          ? error.message
          : "AMR could not connect this calendar.",
      );
    } finally {
      setIsConnectingCalendar(false);
    }
  }

  async function resyncCalendar() {
    if (isResyncingCalendar) return;

    setIsResyncingCalendar(true);
    setResyncStatus("Comparing the saved calendar with current reservations...");
    setResyncError("");

    try {
      const result = await onResyncCalendar(String(home.id));
      setResyncStatus(
        `Calendar synced successfully. ${result.importedCount} ${
          result.importedCount === 1 ? "current entry" : "current entries"
        } synced. Reservations no longer in the feed were removed from active schedules.`,
      );
    } catch (error) {
      setResyncStatus("");
      setResyncError(
        error instanceof Error
          ? error.message
          : "AMR could not resync this calendar.",
      );
    } finally {
      setIsResyncingCalendar(false);
    }
  }


  return (
    <main className="cleanerPropertyDetailPage">
      <style>{`
        .propertySetupDetailCard { margin:18px 0; padding:18px; border-radius:20px; border:1px solid #e2e8f0; background:#f8fafc; }
        .propertySetupDetailTop { display:flex; justify-content:space-between; gap:12px; font-weight:900; color:#334155; }
        .propertySetupDetailTrack { height:10px; margin:10px 0 14px; border-radius:999px; overflow:hidden; background:#e2e8f0; }
        .propertySetupDetailTrack span { display:block; height:100%; border-radius:inherit; }
        .propertySetupDetailCard.critical .propertySetupDetailTrack span { background:#ef4444; }
        .propertySetupDetailCard.warning .propertySetupDetailTrack span { background:#f97316; }
        .propertySetupDetailCard.watch .propertySetupDetailTrack span { background:#eab308; }
        .propertySetupDetailCard.healthy .propertySetupDetailTrack span { background:#22c55e; }
        .propertySetupDetailList { display:grid; gap:8px; }
        .propertySetupDetailStep { width:100%; border:0; border-radius:12px; background:transparent; display:flex; align-items:center; gap:9px; color:#475569; font-weight:800; padding:9px 8px; text-align:left; }
        .propertySetupDetailStep.actionable { cursor:pointer; background:#fff; border:1px solid #e2e8f0; }
        .propertySetupDetailStep.actionable:hover { border-color:#93c5fd; color:#1d4ed8; transform:translateY(-1px); }
        .propertySetupDetailStepArrow { margin-left:auto; color:#94a3b8; font-weight:900; }
        .propertySetupDetailStep i { width:20px; height:20px; border-radius:999px; display:grid; place-items:center; font-style:normal; background:#e2e8f0; color:#64748b; font-size:11px; font-weight:900; }
        .propertySetupDetailStep.complete i { background:#dcfce7; color:#166534; }
        .propertySetupDetailNext { margin:13px 0 0; padding-top:12px; border-top:1px solid #e2e8f0; color:#475569; font-size:12px; font-weight:850; }
        .propertyCalendarConnectPanel { margin-top:14px; display:grid; gap:10px; }
        .propertyCalendarConnectPanel input { width:100%; }
        .propertyCalendarConnectButtons { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .propertyCalendarConnectButtons button { min-height:44px; border:1px solid #cbd5e1; border-radius:14px; background:#fff; color:#334155; padding:11px 13px; font-weight:850; }
        .propertyCalendarConnectButtons .textAction { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
        .propertyCalendarConnectButtons .callAction { background:#ecfdf5; border-color:#bbf7d0; color:#166534; }
        .propertyCalendarImportButton { width:100%; min-height:48px; border:0; border-radius:15px; background:#2563eb; color:#fff; font-weight:900; box-shadow:0 10px 22px rgba(37,99,235,.2); }
        .propertyCalendarImportButton:disabled { background:#cbd5e1; box-shadow:none; }
        @media(max-width:700px){ .propertyCalendarConnectButtons{grid-template-columns:1fr;} .propertyCalendarConnectButtons button{width:100%;} }
        .propertyCalendarConnectStatus { padding:11px 12px; border-radius:14px; background:#dcfce7; color:#166534; font-weight:800; }
        .propertyCalendarConnectError { padding:11px 12px; border-radius:14px; background:#fee2e2; color:#991b1b; font-weight:800; }
        .propertyCalendarSuccess { display:grid; gap:8px; padding:16px; border-radius:18px; background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; text-align:center; }
        .propertyCalendarSuccess strong { font-size:28px; }
        .propertyCalendarConnectedPanel { margin:18px 0; border:1px solid #bbf7d0; background:linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%); }
        .propertyCalendarConnectedHeader { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .propertyCalendarConnectedTitle { display:flex; gap:12px; align-items:flex-start; }
        .propertyCalendarConnectedIcon { width:40px; height:40px; flex:0 0 40px; display:grid; place-items:center; border-radius:999px; background:#dcfce7; color:#166534; font-size:20px; font-weight:900; }
        .propertyCalendarConnectedTitle h2 { margin:2px 0 5px; }
        .propertyCalendarConnectedTitle p { margin:0; color:#475569; }
        .propertyCalendarResyncButton { min-height:44px; padding:0 18px; border:0; border-radius:14px; background:#16844a; color:#fff; font-weight:900; white-space:nowrap; cursor:pointer; }
        .propertyCalendarResyncButton:disabled { cursor:wait; opacity:.68; }
        .propertyCalendarResyncStatus { margin:14px 0 0; padding:12px 13px; border-radius:14px; background:#dcfce7; color:#166534; font-weight:800; line-height:1.45; }
        .propertyCalendarResyncError { margin:14px 0 0; padding:12px 13px; border-radius:14px; background:#fee2e2; color:#991b1b; font-weight:800; }
        @media(max-width:700px){ .propertyCalendarConnectedHeader{display:grid;} .propertyCalendarResyncButton{width:100%;} }
      `}</style>
      <div className="cleanerPropertyDetailTopActions">
        <button
          className="cleanerPropertyDetailBackButton"
          type="button"
          onClick={onBack}
        >
          ← Back to Properties
        </button>

        <button
          className="cleanerPropertyEditButton"
          type="button"
          onClick={onEdit}
        >
          Edit Property
        </button>
      </div>

      <section className="cleanerPropertyDetailHero">
        <div className="cleanerPropertyDetailImage">
          {propertyImage ? (
            <img src={propertyImage} alt={propertyName} />
          ) : (
            <div className="cleanerPropertyDetailImagePlaceholder">
              <span>🏡</span>
              <small>Property photo</small>
            </div>
          )}
        </div>

        <div className="cleanerPropertyDetailHeroContent">
          <div className="cleanerPropertyDetailTitleRow">
            <div>
              <p className="cleanerPropertiesEyebrow">Property</p>
              <h1>{propertyName}</h1>
            </div>

            <span
              className={
                calendarConnected
                  ? "cleanerPropertyCalendarBadge isConnected"
                  : "cleanerPropertyCalendarBadge needsConnection"
              }
            >
              {calendarConnected ? "Calendar Connected" : "Calendar Needed"}
            </span>
          </div>

          <p className="cleanerPropertyDetailAddress">
            <span aria-hidden="true">📍</span>
            {propertyAddress}
          </p>

          <div className="cleanerPropertyDetailQuickStats">
            <div>
              <span>Client</span>
              <strong>{clientName}</strong>
            </div>

            <div>
              <span>Cleaning Fee</span>
              <strong>
                {cleaningFee !== undefined &&
                cleaningFee !== null &&
                cleaningFee !== ""
                  ? `$${Number(cleaningFee).toLocaleString()}`
                  : "Not set"}
              </strong>
            </div>

            <div>
              <span>Outstanding Invoices</span>
              <strong>{outstandingInvoiceCount}</strong>
            </div>

            <div>
              <span>Open Maintenance</span>
              <strong>{openMaintenanceCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={`propertySetupDetailCard ${setupTone}`}>
        <div className="propertySetupDetailTop">
          <span>
            {setupPercent === 100 ? "Property Health" : "Setup Progress"}
          </span>
          <strong>{setupPercent}%</strong>
        </div>
        <div className="propertySetupDetailTrack">
          <span style={{ width: `${setupPercent}%` }} />
        </div>
        <div className="propertySetupDetailList">
          {setupSteps.map((step) => (
            <div
              className={`propertySetupDetailStep ${step.complete ? "complete" : ""}`}
              key={step.label}
            >
              <i>{step.complete ? "✓" : "○"}</i>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
        <p className="propertySetupDetailNext">
          {nextStep
            ? `Next recommended step: ${nextStep.label}`
            : "Everything is operating normally."}
        </p>
      </section>

      {calendarConnected && (
        <section
          className="cleanerCalendarRequestBanner propertyCalendarConnectedPanel"
          aria-label="Reservation calendar status"
        >
          <div className="propertyCalendarConnectedHeader">
            <div className="propertyCalendarConnectedTitle">
              <span className="propertyCalendarConnectedIcon" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="cleanerPropertyCardLabel">Reservation Calendar</p>
                <h2>Calendar Connected</h2>
                <p>
                  {home?.calendarSource || (home?.airbnbUrl ? "Airbnb" : "VRBO")}
                  {" calendar is connected. Resync compares the current feed with saved reservations."}
                </p>
              </div>
            </div>

            <button
              className="propertyCalendarResyncButton"
              type="button"
              disabled={isResyncingCalendar}
              onClick={() => void resyncCalendar()}
            >
              {isResyncingCalendar ? "Syncing..." : "↻ Resync Calendar"}
            </button>
          </div>

          {resyncStatus && (
            <p className="propertyCalendarResyncStatus" role="status">
              ✓ {resyncStatus}
            </p>
          )}

          {resyncError && (
            <p className="propertyCalendarResyncError" role="alert">
              {resyncError}
            </p>
          )}
        </section>
      )}

      {!calendarConnected && (
        <section
          className="cleanerCalendarRequestBanner"
          id="propertyCalendarConnect"
        >
          <div>
            <p className="cleanerPropertyCardLabel">Calendar Needed</p>
            <h2>Connect the reservation calendar</h2>
            <p>
              Paste the Airbnb or VRBO iCal link below, or request it from{" "}
              {clientName}.
            </p>

            <div className="propertyCalendarConnectPanel">
              <input
                type="url"
                id="propertyCalendarUrl"
                value={calendarUrl}
                onChange={(event) => {
                  setCalendarUrl(event.target.value);
                  setCalendarError("");
                }}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                aria-label="Airbnb or VRBO iCal link"
              />
              <div className="propertyCalendarConnectButtons">
                <button
                  type="button"
                  disabled={!calendarUrl.trim() || isConnectingCalendar}
                  onClick={() => void connectCalendar()}
                >
                  {isConnectingCalendar
                    ? "Importing..."
                    : "Import Reservations"}
                </button>
                {clientPhone && isMobileDevice() && (
                  <button
                    className="textAction"
                    type="button"
                    onClick={() => void requestByText()}
                  >
                    📱 Text Client
                  </button>
                )}
                {clientPhone && (
                  <button
                    className="callAction"
                    type="button"
                    onClick={() => (window.location.href = `tel:${clientPhone}`)}
                  >
                    📞 Call Client
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void copyCalendarRequest()}
                >
                  📋 Copy Request
                </button>
                {clientEmail && (
                  <button type="button" onClick={requestByEmail}>
                    📧 Email Client
                  </button>
                )}
              </div>
              {calendarResult && (
                <div className="propertyCalendarSuccess" role="status">
                  <span>✓ {calendarResult.source} calendar connected</span>
                  <strong>{calendarResult.importedCount}</strong>
                  <span>{calendarResult.importedCount === 1 ? "calendar entry imported" : "calendar entries imported"}</span>
                </div>
              )}
              {calendarStatus && (
                <p className="propertyCalendarConnectStatus">
                  ✓ {calendarStatus}
                </p>
              )}
              {calendarError && (
                <p className="propertyCalendarConnectError">{calendarError}</p>
              )}
              {requestStatus && (
                <p className="cleanerCalendarRequestStatus">{requestStatus}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="cleanerPropertyDetailGrid" id="propertySetupNextWork">
        <article className="cleanerPropertyDetailCard">
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Home Setup</p>
              <h2>Cleaning Details</h2>
            </div>
          </div>

          <div className="cleanerPropertyDetailInfoList">
            <div>
              <span>Address</span>
              <strong>{propertyAddress}</strong>
            </div>
            <div>
              <span>Bedrooms</span>
              <strong>{home?.bedrooms || "Not added"}</strong>
            </div>
            <div>
              <span>Bathrooms</span>
              <strong>{home?.bathrooms || "Not added"}</strong>
            </div>
            <div>
              <span>Kitchens</span>
              <strong>{home?.kitchens || "Not added"}</strong>
            </div>
            <div>
              <span>Floors</span>
              <strong>{home?.floors || "Not added"}</strong>
            </div>
          </div>

          <div className="cleanerPropertyBeddingSummary">
            <p className="cleanerPropertyCardLabel">Bedding</p>
            {bedding.length === 0 ? (
              <p>No bedding quantities added.</p>
            ) : (
              <div className="cleanerPropertyBeddingGrid">
                {bedding.map(([label, count]) => (
                  <div key={String(label)}>
                    <strong>{String(count)}</strong>
                    <span>{String(label)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="cleanerPropertyDetailCard">
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Client Contact</p>
              <h2>{clientName}</h2>
            </div>
          </div>

          <div className="cleanerPropertyDetailInfoList">
            <div>
              <span>Email</span>
              <strong>{clientEmail || "Not added"}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{clientPhone || "Not added"}</strong>
            </div>
          </div>
        </article>

        <article className="cleanerPropertyDetailCard">
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Access & Operations</p>
              <h2>Property Details</h2>
            </div>
          </div>

          <div className="cleanerPropertyDetailInfoList">
            <div>
              <span>Door / Access</span>
              <strong>{home?.operations?.access || "Not added"}</strong>
            </div>
            <div>
              <span>Wi-Fi Name</span>
              <strong>{home?.operations?.wifiName || "Not added"}</strong>
            </div>
            <div>
              <span>Wi-Fi Password</span>
              <strong>{home?.operations?.wifiPassword || "Not added"}</strong>
            </div>
            <div>
              <span>Parking</span>
              <strong>{home?.parkingInstructions || "Not added"}</strong>
            </div>
            <div>
              <span>Trash</span>
              <strong>
                {home?.operations?.trashInstructions || "Not added"}
              </strong>
            </div>
            <div>
              <span>Supply Locations</span>
              <strong>{home?.supplyLocations || "Not added"}</strong>
            </div>
          </div>
        </article>

        <article className="cleanerPropertyDetailCard">
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Cleaner Workspace</p>
              <h2>Private Notes</h2>
            </div>
          </div>

          <div className="cleanerPropertyDetailNotes">
            <p>
              {home?.notes ||
                "No private cleaner notes have been added for this property yet."}
            </p>
          </div>
        </article>

        <article
          className={`cleanerPropertyDetailCard cleanerPropertyDetailWideCard ${
            outstandingInvoices.length === 0 ? "isCompactEmpty" : ""
          }`}
        >
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Payments</p>
              <h2>Outstanding Invoices</h2>
            </div>
            <span>{outstandingInvoiceCount}</span>
          </div>

          {outstandingInvoices.length === 0 ? (
            <div className="cleanerPropertyDetailEmpty">
              <p>No outstanding invoices are connected to this property yet.</p>
            </div>
          ) : (
            <div className="cleanerPropertyDetailTaskList">
              {outstandingInvoices.map((invoice: any, index: number) => (
                <div
                  className="cleanerPropertyDetailTask"
                  key={invoice.id || invoice.invoiceNumber || index}
                >
                  <div>
                    <strong>
                      {invoice.invoiceNumber
                        ? `Invoice ${invoice.invoiceNumber}`
                        : "Outstanding Invoice"}
                    </strong>
                    <span>
                      {invoice.date
                        ? new Date(invoice.date).toLocaleDateString()
                        : "Date not available"}
                    </span>
                  </div>
                  <span className="cleanerPropertyDetailTaskStatus">
                    {invoice.amount !== undefined
                      ? `$${Number(invoice.amount).toLocaleString()}`
                      : "Amount pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article
          className={`cleanerPropertyDetailCard cleanerPropertyDetailWideCard ${
            maintenanceItems.length === 0 ? "isCompactEmpty" : ""
          }`}
        >
          <div className="cleanerPropertyDetailCardHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Property History</p>
              <h2>Maintenance</h2>
            </div>
            <span>{openMaintenanceCount}</span>
          </div>

          {maintenanceItems.length === 0 ? (
            <div className="cleanerPropertyDetailEmpty">
              <p>No maintenance issues are connected to this property yet.</p>
            </div>
          ) : (
            <div className="cleanerPropertyDetailTaskList">
              {maintenanceItems.map((item: any, index: number) => (
                <div
                  className="cleanerPropertyDetailTask"
                  key={item.id || index}
                >
                  <div>
                    <strong>
                      {item.title || item.category || "Maintenance Issue"}
                    </strong>
                    <span>
                      {item.description ||
                        item.notes ||
                        "No additional details added."}
                    </span>
                  </div>
                  <span className="cleanerPropertyDetailTaskStatus">
                    {item.status || item.priority || "Open"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
