type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";
type WorkOrderStatus =
  | "New"
  | "Assigned"
  | "Scheduled"
  | "In Progress"
  | "Owner Review"
  | "Completed"
  | "Archived";

type MaintenancePageProps = {
  deleteWorkOrder: (id: string) => void;
  workOrders: any[];
  homes: any[];
  vendors: any[];
  selectedWorkOrder: any;
  setSelectedWorkOrder: (value: any) => void;
  workOrderFilter: string;
  setWorkOrderFilter: (value: string) => void;
  showWorkOrderForm: boolean;
  setShowWorkOrderForm: (value: boolean) => void;
  ownerWorkOrderForm: any;
  setOwnerWorkOrderForm: (value: any) => void;
  selectedPropertyId: string;
  createOwnerWorkOrder: (event: React.FormEvent<HTMLFormElement>) => void;
  updateWorkOrder: (id: string, updates: any) => void;
  getRecommendedVendors: (category: string, urgency: WorkOrderUrgency) => any[];
  formatDate: (date: string) => string;
};

export default function MaintenancePage({
  workOrders,
  homes,
  vendors,
  selectedWorkOrder,
  setSelectedWorkOrder,
  workOrderFilter,
  setWorkOrderFilter,
  showWorkOrderForm,
  setShowWorkOrderForm,
  ownerWorkOrderForm,
  setOwnerWorkOrderForm,
  selectedPropertyId,
  createOwnerWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getRecommendedVendors,
  formatDate,
}: MaintenancePageProps) {
  const filteredWorkOrders = workOrders.filter((order) => {
    if (workOrderFilter === "all") return true;
    if (workOrderFilter === "urgent") return order.urgency === "High" || order.urgency === "After Hours";
    if (workOrderFilter === "after-hours") return order.urgency === "After Hours";
    if (workOrderFilter === "review") return order.status === "Owner Review";
    return order.status === workOrderFilter;
  });

 const activeWorkOrders = workOrders.filter(
  (order) => order.status !== "Completed" && order.status !== "Archived"
);

const openCount = activeWorkOrders.length;
const urgentCount = activeWorkOrders.filter(
  (order) => order.urgency === "High" || order.urgency === "After Hours"
).length;
  const reviewCount = workOrders.filter((order) => order.status === "Owner Review").length;
  const scheduledCount = workOrders.filter((order) => order.status === "Scheduled").length;

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Phase 3</p>
          <h2>Maintenance + Vendor Ops</h2>
          <p className="headerSubtext">
            Route issues, track urgency, assign vendors, capture owner review, and prepare the AI maintenance assistant layer.
          </p>
        </div>

        <div className="calendarHeaderActions">
          <button className="primaryButton" onClick={() => setShowWorkOrderForm(true)}>
            + Create Work Order
          </button>
          
        </div>
      </header>

     <section className="statsGrid">
  <button
    type="button"
    className={`statCard ${workOrderFilter === "all" ? "selected" : ""}`}
    onClick={() => setWorkOrderFilter("all")}
  >
    <span>Open work orders</span>
    <strong>{openCount}</strong>
  </button>

  <button
    type="button"
    className={`statCard warning ${
      workOrderFilter === "urgent" ? "selected" : ""
    }`}
    onClick={() => setWorkOrderFilter("urgent")}
  >
    <span>Urgent / after-hours</span>
    <strong>{urgentCount}</strong>
  </button>

  <button
    type="button"
    className={`statCard ${
      workOrderFilter === "review" ? "selected" : ""
    }`}
    onClick={() => setWorkOrderFilter("review")}
  >
    <span>Owner review</span>
    <strong>{reviewCount}</strong>
  </button>

  <button
    type="button"
    className={`statCard ${
      workOrderFilter === "Scheduled" ? "selected" : ""
    }`}
    onClick={() => setWorkOrderFilter("Scheduled")}
  >
    <span>Scheduled</span>
    <strong>{scheduledCount}</strong>
  </button>
</section>

       {showWorkOrderForm && (
        <div className="modalOverlay" onClick={() => setShowWorkOrderForm(false)}>
          <div
            className="modalCard maintenanceModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-work-order-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panelHeader modalHeader">
              <div>
                <p className="eyebrow">New maintenance issue</p>
                <h3 id="create-work-order-title">Create Work Order</h3>
                <p className="mutedText">Create and track maintenance issues.</p>
              </div>

              <button className="ghostButton" onClick={() => setShowWorkOrderForm(false)} type="button">
                Close
              </button>
            </div>

            <form className="manualForm workOrderModalForm" onSubmit={createOwnerWorkOrder}>
              <label>
                Property
                <select
                  value={ownerWorkOrderForm.homeId || selectedPropertyId || homes[0]?.id || ""}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, homeId: event.target.value })}
                >
                  {homes.map((home) => (
                    <option key={home.id} value={home.id}>
                      {home.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Issue title
                <input
                  value={ownerWorkOrderForm.title}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, title: event.target.value })}
                  placeholder="Example: AC not cooling"
                />
              </label>

              <label>
                Category
                <select
                  value={ownerWorkOrderForm.category}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, category: event.target.value })}
                >
                  <option value="General">General</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Appliance">Appliance</option>
                  <option value="Supplies">Supplies</option>
                </select>
              </label>

              <label>
                Urgency
                <select
                  value={ownerWorkOrderForm.urgency}
                  onChange={(event) =>
                    setOwnerWorkOrderForm({
                      ...ownerWorkOrderForm,
                      urgency: event.target.value as WorkOrderUrgency,
                    })
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="After Hours">After Hours</option>
                </select>
              </label>

              <label className="fullWidth">
                Notes / instructions
                <textarea
                  value={ownerWorkOrderForm.notes}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, notes: event.target.value })}
                  placeholder="Describe the issue, location in the home, guest impact, approval notes, or vendor instructions."
                />
              </label>

              <div className="fullWidth formDivider">
                <p className="eyebrow">Optional scheduling</p>
              </div>

              <label>
                Vendor
                <select
                  value={ownerWorkOrderForm.vendorId}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, vendorId: event.target.value })}
                >
                  <option value="">Assign later</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} · {vendor.category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Scheduled date
                <input
                  type="date"
                  value={ownerWorkOrderForm.scheduledDate}
                  onChange={(event) => setOwnerWorkOrderForm({ ...ownerWorkOrderForm, scheduledDate: event.target.value })}
                />
              </label>

              <div className="fullWidth formActions">
                <button className="primaryButton" type="submit" disabled={!homes.length}>
                  Save Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="maintenanceLayout">
        <div>
          <section className="filtersPanel maintenanceFilters">
            <select value={workOrderFilter} onChange={(event) => setWorkOrderFilter(event.target.value)}>
              <option value="all">All work orders</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="review">Owner Review</option>
              <option value="urgent">Urgent / After-Hours</option>
              <option value="Completed">Completed</option>
            </select>
          </section>

          <section className="workOrderList">
            {filteredWorkOrders.map((order) => {
              const home = homes.find((item) => item.id === order.homeId);
              const vendor = vendors.find((item) => item.id === order.vendorId);

              return (
                <article
                  key={order.id}
                  className={`workOrderCard ${selectedWorkOrder?.id === order.id ? "selected" : ""}`}
                  onClick={() => setSelectedWorkOrder(order)}
                >
                  <div className="workOrderTop">
                    <div>
                      <h3>{order.title}</h3>
                      <p>
                        {home?.name ?? "Unknown home"} · {order.category}
                      </p>
                    </div>
                    <span className={`urgencyPill urgency${order.urgency.replace(/\s/g, "")}`}>{order.urgency}</span>
                  </div>

                  <div className="workOrderMeta">
                    <span>{order.status}</span>
                    <span>{vendor?.name ?? "No vendor assigned"}</span>
                    <span>{order.scheduledDate ? `Scheduled ${formatDate(order.scheduledDate)}` : `Created ${formatDate(order.createdDate)}`}</span>
                  </div>

                  <p className="workOrderNotes">{order.notes}</p>
                </article>
              );
            })}
          </section>
        </div>

        {selectedWorkOrder && (
  <div className="modalOverlay" onClick={() => setSelectedWorkOrder(null)}>
    <div
      className="modalCard maintenanceModal"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="panelHeader modalHeader">
        <div>
          <p className="eyebrow">Work order detail</p>
          <h3>{selectedWorkOrder.title}</h3>
          <p className="mutedText">
            {homes.find((home) => home.id === selectedWorkOrder.homeId)?.name ?? "Unknown home"}
          </p>
        </div>

        <button className="ghostButton" onClick={() => setSelectedWorkOrder(null)} type="button">
  Save & Exit
</button>
      </div>

      <div className="detailStack">
        <div>
          <span>Status</span>
          <select
            value={selectedWorkOrder.status}
            onChange={(event) =>
              updateWorkOrder(selectedWorkOrder.id, { status: event.target.value as WorkOrderStatus })
            }
          >
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Owner Review">Owner Review</option>
            <option value="Completed">Completed</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <div>
          <span>Vendor</span>
          <select
            value={selectedWorkOrder.vendorId ?? ""}
            onChange={(event) =>
              updateWorkOrder(selectedWorkOrder.id, {
                vendorId: event.target.value || undefined,
                status: event.target.value ? "Assigned" : selectedWorkOrder.status,
              })
            }
          >
            <option value="">No vendor assigned</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} · {vendor.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="aiAssistantBox">
        <p className="eyebrow">AI vendor assistant groundwork</p>
        <h4>Recommended routing</h4>
        <p>
          {selectedWorkOrder.urgency === "After Hours"
            ? "This is flagged as after-hours. Prioritize vendors with emergency coverage and guest-impact response."
            : selectedWorkOrder.urgency === "High"
              ? "High urgency. Schedule before next arrival or escalate if currently guest-impacting."
              : "Standard routing. Assign the best matching vendor and track owner approval if needed."}
        </p>
      </div>

      <div className="vendorSuggestions">
        <h4>Recommended vendors</h4>
        {getRecommendedVendors(selectedWorkOrder.category, selectedWorkOrder.urgency).map((vendor) => (
          <button
            key={vendor.id}
            onClick={() =>
              updateWorkOrder(selectedWorkOrder.id, {
                vendorId: vendor.id,
                status: "Assigned",
              })
            }
          >
            <strong>{vendor.name}</strong>
            <span>
              {vendor.category} · ★ {vendor.rating} · {vendor.afterHours ? "After-hours" : "Standard hours"}
            </span>
          </button>
        ))}
        <div className="cardActions">
  <button
    type="button"
    className="dangerButton"
    onClick={() => deleteWorkOrder(selectedWorkOrder.id)}
  >
    Delete Work Order
  </button>
</div>
      </div>
<div className="cardActions">
 
</div>
      <div className="timeline maintenanceTimeline">
        <h4>Timeline</h4>
        {(selectedWorkOrder.timeline ?? []).map((item: string, index: number) => (
          <div key={`${selectedWorkOrder.id}-${item}-${index}`} className="timelineItem">
            <span />
            <p>{item}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
      </section>
    </>
  );
}