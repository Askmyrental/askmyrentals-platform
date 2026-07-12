import { useState } from "react";

type CleanerPropertyDetailPageProps = {
  home: any;
  onBack: () => void;
  onEdit: () => void;
};

function buildCalendarRequestMessage(home: any) {
  return `Hi ${home?.ownerName || "there"}, I added ${home?.name || "your property"} to AMR Cleaner. Please send me the iCal reservation calendar link from the booking platform you use as the most complete calendar for this property. Once I receive it, I can connect upcoming turns automatically.`;
}

export default function CleanerPropertyDetailPage({
  home,
  onBack,
  onEdit,
}: CleanerPropertyDetailPageProps) {
  const [requestStatus, setRequestStatus] = useState("");
  const propertyName = home?.name || "Unnamed Property";
  const propertyImage =
    home?.imageUrl ||
    home?.photoUrl ||
    home?.propertyPhoto ||
    home?.coverImage;
  const propertyAddress =
    [home?.address, home?.city].filter(Boolean).join(", ") ||
    "Address not added";
  const ownerName = home?.ownerName || "Owner not added";
  const ownerEmail = home?.ownerEmail || "";
  const ownerPhone = home?.ownerPhone || "";
  const calendarConnected = Boolean(
    home?.calendarFeedUrl ||
      home?.iCalUrl ||
      home?.airbnbUrl ||
      home?.vrboId
  );
  const cleaningFee =
    home?.cleaningFee ??
    home?.cleanerFee ??
    home?.standardCleaningFee ??
    home?.defaultCleaningFee;
  const outstandingInvoiceCount =
    home?.outstandingInvoiceCount ??
    home?.outstandingInvoices?.length ??
    0;
  const openMaintenanceCount =
    home?.openMaintenanceCount ??
    home?.openMaintenanceIssues?.length ??
    0;
  const outstandingInvoices = Array.isArray(home?.outstandingInvoices)
    ? home.outstandingInvoices
    : [];
  const maintenanceItems = Array.isArray(home?.maintenanceHistory)
    ? home.maintenanceHistory
    : Array.isArray(home?.openMaintenanceIssues)
      ? home.openMaintenanceIssues
      : [];

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
        "Text message copied. Paste it into your phone or preferred messaging app."
      );
    } catch {
      window.prompt("Copy this calendar request:", message);
    }
  }

  function requestByEmail() {
    const subject = encodeURIComponent(
      `Calendar link needed for ${propertyName}`
    );
    const body = encodeURIComponent(buildCalendarRequestMessage(home));
    window.location.href = `mailto:${ownerEmail}?subject=${subject}&body=${body}`;
  }

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async function requestByText() {
    if (!isMobileDevice()) {
      await copyCalendarRequest();
      return;
    }

    const body = encodeURIComponent(buildCalendarRequestMessage(home));
    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
    window.location.href = `sms:${ownerPhone}${separator}body=${body}`;
  }

  return (
    <main className="cleanerPropertyDetailPage">
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
              {calendarConnected
                ? "Calendar Connected"
                : "Calendar Needed"}
            </span>
          </div>

          <p className="cleanerPropertyDetailAddress">
            <span aria-hidden="true">📍</span>
            {propertyAddress}
          </p>

          <div className="cleanerPropertyDetailQuickStats">
            <div>
              <span>Owner</span>
              <strong>{ownerName}</strong>
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

      {!calendarConnected && (
        <section className="cleanerCalendarRequestBanner">
          <div>
            <p className="cleanerPropertyCardLabel">Calendar Needed</p>
            <h2>Request the reservation calendar</h2>
            <p>
              Contact {ownerName} and ask for the home's most complete iCal
              reservation feed.
            </p>
          </div>

          <div className="cleanerCalendarRequestActions">
            {ownerEmail && (
              <button type="button" onClick={requestByEmail}>
                Email Request
              </button>
            )}
            {ownerPhone && (
              <button type="button" onClick={requestByText}>
                {isMobileDevice() ? "Text Homeowner" : "Copy Text Message"}
              </button>
            )}
          </div>

          {requestStatus && (
            <p className="cleanerCalendarRequestStatus">{requestStatus}</p>
          )}
        </section>
      )}

      <section className="cleanerPropertyDetailGrid">
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
              <p className="cleanerPropertyCardLabel">Homeowner Contact</p>
              <h2>{ownerName}</h2>
            </div>
          </div>

          <div className="cleanerPropertyDetailInfoList">
            <div>
              <span>Email</span>
              <strong>{ownerEmail || "Not added"}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{ownerPhone || "Not added"}</strong>
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