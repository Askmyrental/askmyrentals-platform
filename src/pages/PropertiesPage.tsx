type PropertiesPageProps = {
  homes: any[];
  cleaners: any[];
  reservations: any[];
  workOrders: any[];
  selectedPropertyId: string;
  setSelectedPropertyId: (value: string) => void;
  showPropertyForm: boolean;
  setShowPropertyForm: (value: boolean) => void;
  editingPropertyId: string | null;
  setEditingPropertyId: (value: string | null) => void;
  propertyForm: any;
  setPropertyForm: (value: any) => void;
  createProperty: (event: React.FormEvent<HTMLFormElement>) => void;
  updateProperty: (id: string, updates: any) => void;
  archiveProperty: (id: string) => void;
  deleteProperty: (id: string) => void;
  startEditingProperty: (home: any) => void;
  autoFillListing: () => void;
  syncReservations: () => void;
  renderDataIntegrationPanel: () => React.ReactNode;
  PropertyOperationsHub: any;
};

export default function PropertiesPage({
  homes,
  reservations,
  cleaners,
  workOrders,
  selectedPropertyId,
  setSelectedPropertyId,
  showPropertyForm,
  setShowPropertyForm,
  editingPropertyId,
  setEditingPropertyId,
  propertyForm,
  setPropertyForm,
  createProperty,
  updateProperty,
  archiveProperty,
  deleteProperty,
  startEditingProperty,
  syncReservations,
  
  PropertyOperationsHub,
}: PropertiesPageProps) {
  const selectedProperty =
    homes.find((home) => home.id === selectedPropertyId) ?? homes[0];

  const selectedReservations = selectedProperty
    ? reservations.filter((reservation) => reservation.homeId === selectedProperty.id)
    : [];

  const selectedWorkOrders = selectedProperty
    ? workOrders.filter((order) => order.homeId === selectedProperty.id)
    : [];

  const activeHomes = homes.filter((home) => home.status === "Active").length;
  const setupNeeded = homes.filter((home) => home.status === "Setup Needed").length;
  const connectedCalendarFeeds = homes.filter(
    (home) => home.iCalUrl || home.airbnbUrl
  ).length;

  const updateFormField = (field: string, value: any) => {
    setPropertyForm({
      ...propertyForm,
      [field]: value,
    });
  };

  const resetPropertyForm = () => {
    setPropertyForm({
      name: "",
      city: "",
      address: "",
      setupMode: "VRBO",
      vrboId: "",
      airbnbUrl: "",
      iCalUrl: "",
      bedrooms: "",
      bathrooms: "",
      maxGuests: "",
      notes: "",
    });
  };

  const closePropertyForm = () => {
    setEditingPropertyId(null);
    setShowPropertyForm(false);
  };

  function renderPropertyFormActions(isEditing: boolean) {
    return (
      <div className="cardActions fullWidth">
        <button className="primaryButton" type="submit">
          {isEditing ? "Save Property Changes" : "Save Property"}
        </button>

        {isEditing && editingPropertyId && (
          <>
            <button
              className="ghostButton"
              type="button"
              onClick={() => archiveProperty(editingPropertyId)}
            >
              Archive Property
            </button>

            <button
              className="dangerButton"
              type="button"
              onClick={() => deleteProperty(editingPropertyId)}
            >
              Delete Property
            </button>
          </>
        )}

        <button className="ghostButton" type="button" onClick={closePropertyForm}>
          Cancel
        </button>
      </div>
    );
  }

  function renderPropertyForm(isEditing: boolean) {
    return (
      <>
        <div className="fullWidth">
          <p className="eyebrow">Live property setup</p>
          <h3>Connect Calendars</h3>
          <p className="headerSubtext">
            Add the property name and calendar links. This is what powers
            reservations, cleaning assignments, calendar QA, and reporting.
          </p>
        </div>

        <label className="fullWidth">
          Property name
          <input
            value={propertyForm.name || ""}
            onChange={(event) => updateFormField("name", event.target.value)}
            placeholder="Example: Sea Otz"
          />
        </label>

        <div
          className="fullWidth"
          style={{
            padding: "14px 16px",
            border: "1px solid #bfdbfe",
            borderRadius: "14px",
            background: "#eff6ff",
            color: "#1e3a8a",
            lineHeight: 1.45,
          }}
        >
          <strong>Which calendar should I use?</strong>
          <p style={{ margin: "5px 0 0" }}>
            If the property is listed on both VRBO and Airbnb, connect the
            VRBO calendar when available. VRBO calendar feeds are generally
            more consistent for blocked dates and schedule changes.
          </p>
        </div>

        <label className="fullWidth">
          VRBO iCal Link <span style={{ color: "#16844a", fontWeight: 800 }}>· Preferred</span>
          <input
            value={propertyForm.iCalUrl || ""}
            onChange={(event) => updateFormField("iCalUrl", event.target.value)}
            placeholder="Paste VRBO export calendar link"
          />
          <small style={{ display: "block", marginTop: "6px", color: "#64748b" }}>
            Recommended when the owner uses both VRBO and Airbnb.
          </small>
        </label>

        <label className="fullWidth">
          Airbnb Calendar Link
          <input
            value={propertyForm.airbnbUrl || ""}
            onChange={(event) => updateFormField("airbnbUrl", event.target.value)}
            placeholder="Paste Airbnb calendar export link"
          />
          <small style={{ display: "block", marginTop: "6px", color: "#92400e" }}>
            Airbnb may combine neighboring blocked dates into one calendar
            event, which can create extra schedule-change alerts.
          </small>
        </label>

        {isEditing && (
          <div className="cardActions fullWidth">
            <button
              className="secondaryButton"
              onClick={syncReservations}
              type="button"
            >
              Sync Calendars
            </button>
          </div>
        )}

        <details className="manualPanel fullWidth">
          <summary>Property Details</summary>

          <div className="propertyForm">
            <label className="fullWidth">
              Address
              <input
                value={propertyForm.address || ""}
                onChange={(event) => updateFormField("address", event.target.value)}
                placeholder="Street address"
              />
            </label>

            <label>
              City / County
              <input
                value={propertyForm.city || ""}
                onChange={(event) => updateFormField("city", event.target.value)}
                placeholder="City or county"
              />
            </label>

            <label>
              Bedrooms
              <input
                type="number"
                value={propertyForm.bedrooms || ""}
                onChange={(event) => updateFormField("bedrooms", event.target.value)}
              />
            </label>

            <label>
              Bathrooms
              <input
                type="number"
                value={propertyForm.bathrooms || ""}
                onChange={(event) => updateFormField("bathrooms", event.target.value)}
              />
            </label>

            <label>
              Max guests
              <input
                type="number"
                value={propertyForm.maxGuests || ""}
                onChange={(event) => updateFormField("maxGuests", event.target.value)}
              />
            </label>

            <label className="fullWidth">
              Property notes
              <textarea
                value={propertyForm.notes || ""}
                onChange={(event) => updateFormField("notes", event.target.value)}
                placeholder="Optional notes for reporting, occupancy, or owner reference"
              />
            </label>
          </div>
        </details>

       <details className="manualPanel fullWidth">
  <summary>Operations Hub</summary>
  <PropertyOperationsHub
    property={propertyForm}
 cleaners={cleaners}
    onChange={setPropertyForm}
  />
</details>
          

        {renderPropertyFormActions(isEditing)}
      </>
    );
  }

  if (showPropertyForm && editingPropertyId) {
    const editingProperty = homes.find((home) => home.id === editingPropertyId);

    return (
      <>
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Edit property</p>
            <h2>{editingProperty?.name ?? "Edit Property"}</h2>
            <p className="headerSubtext">
              Update calendar links, property details, and cleaner-facing
              operations information.
            </p>
          </div>

          <button className="ghostButton" onClick={closePropertyForm}>
            ← Back to Properties
          </button>
        </header>

        <section className="manualPanel">
          <form
            className="propertyForm"
            onSubmit={(event) => {
              event.preventDefault();

              updateProperty(editingPropertyId, {
                name: propertyForm.name,
                city: propertyForm.city,
                address: propertyForm.address,
                setupMode: propertyForm.setupMode || "VRBO",
                vrboId: propertyForm.vrboId,
                airbnbUrl: propertyForm.airbnbUrl,
              iCalUrl: propertyForm.iCalUrl,
                defaultCleanerId: propertyForm.defaultCleanerId,
              bedrooms: Number(propertyForm.bedrooms) || 0,
                bathrooms: Number(propertyForm.bathrooms) || 0,
                maxGuests: Number(propertyForm.maxGuests) || 0,
                status:
                  propertyForm.iCalUrl || propertyForm.airbnbUrl
                    ? "Active"
                    : "Setup Needed",
                notes: propertyForm.notes,
              });

              closePropertyForm();
            }}
          >
            {renderPropertyForm(true)}
          </form>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Live Mode</p>
          <h2>Property Setup</h2>
          <p className="headerSubtext">
            Add properties, connect VRBO and Airbnb calendars, and manage
            cleaner-facing property instructions.
          </p>
        </div>

        <button
          className="primaryButton"
          onClick={() => {
            setEditingPropertyId(null);
            resetPropertyForm();
            setShowPropertyForm(true);
          }}
        >
          + Add Property
        </button>
      </header>

      {showPropertyForm && !editingPropertyId && (
        <section className="manualPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Live property setup</p>
              <h3>Add Property</h3>
            </div>

            <button className="ghostButton" onClick={closePropertyForm}>
              Close
            </button>
          </div>

          <form className="propertyForm" onSubmit={createProperty}>
            {renderPropertyForm(false)}
          </form>
        </section>
      )}

     {/* {renderDataIntegrationPanel()} */}

      <section className="statsGrid">
        <div className="statCard">
          <span>Total homes</span>
          <strong>{homes.length}</strong>
        </div>

        <div className="statCard">
          <span>Active</span>
          <strong>{activeHomes}</strong>
        </div>

        <div className="statCard warning">
          <span>Setup needed</span>
          <strong>{setupNeeded}</strong>
        </div>

        <div className="statCard">
          <span>Calendar feeds</span>
          <strong>{connectedCalendarFeeds}</strong>
        </div>
      </section>

      <section className="propertiesLayout">
        <div className="propertyCardGrid">
          {homes.map((home) => {
            const homeReservations = reservations.filter(
              (reservation) => reservation.homeId === home.id
            );

            const homeWorkOrders = workOrders.filter(
              (order) => order.homeId === home.id && order.status !== "Completed"
            );

            return (
              <button
                key={home.id}
                className={`propertyCard ${
                  selectedProperty?.id === home.id ? "selected" : ""
                }`}
                onClick={() => {
                  setSelectedPropertyId(home.id);
                  startEditingProperty(home);
                }}
              >
                <div className="propertyCardTop">
                  <div className="homeBadge">{home.shortName}</div>

                  <div>
                    <h3>{home.name}</h3>
                    <p>{home.address || home.city || "No address added"}</p>
                  </div>

                  <span
                    className={`propertyStatus status${String(
                      home.status || ""
                    ).replace(/\s/g, "")}`}
                  >
                    {home.status}
                  </span>
                </div>

                <div className="propertyMiniStats">
                  <span>{home.bedrooms || 0} bd</span>
                  <span>{home.bathrooms || 0} ba</span>
                  <span>{home.maxGuests || 0} guests</span>
                </div>

                <div className="propertySourceRow">
                  <span>{home.iCalUrl ? "VRBO connected" : "No VRBO calendar"}</span>
                  <span>
                    {home.airbnbUrl ? "Airbnb connected" : "No Airbnb calendar"}
                  </span>
                </div>

                <p>
                  {homeReservations.length} reservations · {homeWorkOrders.length} open
                  work orders
                </p>
              </button>
            );
          })}
        </div>

        <aside className="propertyDetailPanel">
          {!selectedProperty ? (
            <>
              <p className="eyebrow">Property detail</p>
              <h3>Select a home</h3>
            </>
          ) : (
            <>
              <p className="eyebrow">Property detail</p>

              <div className="propertyDetailHeader">
                <div className="homeBadge">{selectedProperty.shortName}</div>

                <div>
                  <h3>{selectedProperty.name}</h3>
                  <p>
                    {selectedProperty.address ||
                      selectedProperty.city ||
                      "No address added"}
                  </p>
                </div>
              </div>
<div className="cardActions">
  <button
    className="primaryButton"
    type="button"
    onClick={() => startEditingProperty(selectedProperty)}
  >
    Edit Property
  </button>

  <button
    className="ghostButton"
    type="button"
    onClick={syncReservations}
  >
    Sync Calendars
  </button>
</div>
              <div className="detailStack">
                <div>
                  <span>Status</span>
                  <select
                    value={selectedProperty.status}
                    onChange={(event) =>
                      updateProperty(selectedProperty.id, {
                        status: event.target.value,
                      })
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Setup Needed">Setup Needed</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="propertyDataGrid">
                <div>
                  <span>VRBO Calendar</span>
                  <strong>{selectedProperty.iCalUrl ? "Connected" : "Missing"}</strong>
                </div>

                <div>
                  <span>Airbnb Calendar</span>
                  <strong>
                    {selectedProperty.airbnbUrl ? "Connected" : "Missing"}
                  </strong>
                </div>

                <div>
                  <span>Capacity</span>
                  <strong>{selectedProperty.maxGuests || 0} guests</strong>
                </div>

                <div>
                  <span>Bedrooms</span>
                  <strong>{selectedProperty.bedrooms || 0}</strong>
                </div>
              </div>

              <div className="aiAssistantBox">
                <p className="eyebrow">Calendar-powered operations</p>
                <h4>Live property workflow</h4>
                <p>
                  VRBO and Airbnb calendar links feed reservation syncing,
                  calendar QA, occupancy comparisons, cleaner forecasting, and
                  guest readiness scoring.
                </p>
              </div>

              <div className="propertyLinkedOps">
                <h4>Linked operations</h4>
                <div>
                  <span>Upcoming reservations</span>
                  <strong>{selectedReservations.length}</strong>
                </div>
                <div>
                  <span>Open work orders</span>
                  <strong>
                    {
                      selectedWorkOrders.filter(
                        (order) => order.status !== "Completed"
                      ).length
                    }
                  </strong>
                </div>
              </div>

              {selectedProperty.notes && (
                <p className="notesBox">{selectedProperty.notes}</p>
              )}
            </>
          )}
        </aside>
      </section>
    </>
  );
}
