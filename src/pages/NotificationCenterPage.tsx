type NotificationType = "Reservation" | "Cleaner" | "Maintenance" | "Property" | "System" | "Calendar";
type NotificationPriority = "Low" | "Normal" | "High" | "Critical";

type NotificationAction =
  | "reservations-needs-cleaner"
  | "maintenance"
  | "tasks"
  | "properties"
  | "cleaners"
  | "calendar-sync-issues"
  | "none";

type NotificationListItem = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  relatedHomeId?: string;
  relatedCleanerId?: string;
  relatedWorkOrderId?: string;
  action: NotificationAction;
};

type NotificationCenterPageProps = {
  reservations: any[];
  workOrders: any[];
  homes: any[];
  cleaners: any[];
  notifications: any[];
  notificationFilter: string;
  setNotificationFilter: (value: string) => void;
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  setActivePage: (page: string) => void;
  setSelectedItemType: (value: string) => void;
  setSelectedStatus: (value: string) => void;
  setSelectedHome: (value: string) => void;
  setSearch: (value: string) => void;
  setSelectedWorkOrder: (value: any) => void;
  setWorkOrderFilter: (value: string) => void;
  needsCleanerAssignment: (reservation: any) => boolean;
  isImportedReservation: (reservation: any) => boolean;
  isTaskSource: (source: any) => boolean;
  daysUntil: (date: string) => number;
  formatDate: (date: string) => string;
  dismissedDiscrepancies: string[];
  getCalendarSyncIssues: (reservations: any[], homes: any[], dismissedIds: string[]) => any[];
};

export default function NotificationCenterPage({
  reservations,
  workOrders,
  homes,
  notifications,
  notificationFilter,
  setNotificationFilter,
  setActivePage,
  setSelectedItemType,
  setSelectedStatus,
  setSelectedHome,
  setSearch,
  setSelectedWorkOrder,
  setWorkOrderFilter,
  needsCleanerAssignment,
  isImportedReservation,
  isTaskSource,
  daysUntil,
  formatDate,
  dismissedDiscrepancies,
  getCalendarSyncIssues,
}: NotificationCenterPageProps) {
 const today = new Date();
today.setHours(0, 0, 0, 0);

const reservationsNeedingCleanerAssigned = reservations
  .filter((reservation) => {
    const departureDate = new Date(reservation.departure);
    departureDate.setHours(0, 0, 0, 0);

    return (
      departureDate >= today &&
      needsCleanerAssignment(reservation) &&
      isImportedReservation(reservation)
    );
  })
  .sort((a, b) =>
    String(a.arrival ?? "").localeCompare(String(b.arrival ?? ""))
  );
const calendarSyncIssues = getCalendarSyncIssues(
  reservations,
  homes,
  dismissedDiscrepancies
).filter((item) => item.status === "Open");
  const criticalWorkOrders = workOrders
    .filter(
      (order) =>
        order.status !== "Completed" &&
        (order.urgency === "High" || order.urgency === "After Hours" || order.status === "Owner Review")
    )
    .sort((a, b) => String(a.createdDate ?? "").localeCompare(String(b.createdDate ?? "")));

  const upcomingTasks = reservations
    .filter(
      (reservation) =>
        isTaskSource(reservation.source) &&
        reservation.status !== "Completed" &&
        daysUntil(reservation.arrival) >= 0 &&
        daysUntil(reservation.arrival) <= 3
    )
    .sort((a, b) => String(a.arrival ?? "").localeCompare(String(b.arrival ?? "")));

 

const generatedNotifications: NotificationListItem[] = [
  ...(reservationsNeedingCleanerAssigned.length > 0
    ? [
        {
          id: "generated-needs-cleaner-assigned",
          type: "Reservation" as NotificationType,
          priority: "High" as NotificationPriority,
          title: `${reservationsNeedingCleanerAssigned.length} Reservations Need Cleaner Assigned`,
          message: "Imported reservations are waiting for a cleaner assignment.",
          createdAt: "Live alert",
          read: false,
          action: "reservations-needs-cleaner" as NotificationAction,
        },
      ]
    : []),

  ...calendarSyncIssues.map((issue) => ({
    id: `generated-calendar-sync-${issue.id}`,
    type: "Calendar" as NotificationType,
    priority: issue.severity === "High" ? "High" as NotificationPriority : "Normal" as NotificationPriority,
    title: "Calendar Sync Issue",
    message: `${issue.property}: ${issue.message}`,
    createdAt: issue.dateRange,
    read: false,
    action: "calendar-sync-issues" as NotificationAction,
  })),

  ...criticalWorkOrders.map((order) => {
    const home = homes.find((item) => item.id === order.homeId);
      return {
        id: `generated-work-order-${order.id}`,
        type: "Maintenance" as NotificationType,
        priority:
          order.urgency === "After Hours" || order.urgency === "High"
            ? ("Critical" as NotificationPriority)
            : ("High" as NotificationPriority),
        title: `${order.urgency === "After Hours" ? "After-Hours" : order.urgency} Work Order`,
        message: `${order.title} · ${home?.name ?? "Unknown property"}`,
        relatedHomeId: order.homeId,
        relatedWorkOrderId: order.id,
        createdAt: order.scheduledDate
          ? `Scheduled ${formatDate(order.scheduledDate)}`
          : `Created ${formatDate(order.createdDate)}`,
        read: false,
        action: "maintenance" as NotificationAction,
      };
    }),
    ...(upcomingTasks.length > 0
      ? [
          {
            id: "generated-upcoming-tasks",
            type: "System" as NotificationType,
            priority: "Normal" as NotificationPriority,
            title: `${upcomingTasks.length} Upcoming Tasks`,
            message: "Cleaning or inspection tasks are scheduled in the next 3 days.",
            createdAt: "Live alert",
            read: false,
            action: "tasks" as NotificationAction,
          },
        ]
      : []),
  ];

  const savedNotifications: NotificationListItem[] = notifications.map((notification) => ({
    ...notification,
    action:
      notification.type === "Reservation"
        ? "reservations-needs-cleaner"
        : notification.type === "Maintenance"
          ? "maintenance"
          : notification.type === "Property"
            ? "properties"
            : notification.type === "Cleaner"
              ? "cleaners"
              : "none",
  }));

  const allNotificationItems = [...generatedNotifications, ...savedNotifications];

  const visibleNotifications = allNotificationItems.filter((notification) => {
    if (notificationFilter === "all") return true;
    if (notificationFilter === "unread") return !notification.read;
    return notification.type === notificationFilter;
  });

  function openNotification(notification: NotificationListItem) {
    if (notification.action === "reservations-needs-cleaner") {
      setSelectedItemType("needs-cleaner");
      setSelectedStatus("all");
      setSelectedHome("all");
      setSearch("");
      setActivePage("Reservations");
      return;
    }

    if (notification.action === "maintenance") {
      const matchingWorkOrder = workOrders.find((order) => order.id === notification.relatedWorkOrderId);
      if (matchingWorkOrder) setSelectedWorkOrder(matchingWorkOrder);
      setWorkOrderFilter(
        matchingWorkOrder?.urgency === "After Hours" ? "after-hours" : "all"
      );
      setActivePage("Maintenance");
      return;
    }

    if (notification.action === "tasks") {
      setSelectedItemType("tasks");
      setSelectedStatus("all");
      setSelectedHome("all");
      setSearch("");
      setActivePage("Reservations");
      return;
    }

    if (notification.action === "calendar-sync-issues") {
      setNotificationFilter("Calendar");
      setActivePage("Notification Center");
      return;
    }

    if (notification.action === "properties") setActivePage("Properties");
    if (notification.action === "cleaners") setActivePage("Cleaners");
  }

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Owner alert inbox</p>
          <h2>Notification Center</h2>
          <p className="headerSubtext">
            Active alerts for cleaner assignments, critical maintenance, setup issues, and upcoming property tasks.
          </p>
        </div>
      </header>

      <section className="statsGrid">
        <button className="statCard warning" type="button" onClick={() => openNotification({
          id: "shortcut-needs-cleaner",
          type: "Reservation",
          priority: "High",
          title: "Needs Cleaner",
          message: "",
          createdAt: "",
          read: false,
          action: "reservations-needs-cleaner",
        })}>
          <span>Need Cleaner Assigned</span>
          <strong>{reservationsNeedingCleanerAssigned.length}</strong>
        </button>

        <button
          className="statCard warning"
          type="button"
          onClick={() => {
            const firstCriticalWorkOrder = criticalWorkOrders[0];

            if (firstCriticalWorkOrder) {
              setSelectedWorkOrder(firstCriticalWorkOrder);
            }

            setWorkOrderFilter("after-hours");
            setActivePage("Maintenance");
          }}
        >
          <span>Critical Maintenance</span>
          <strong>{criticalWorkOrders.length}</strong>
        </button>

        <button className="statCard" type="button" onClick={() => openNotification({
          id: "shortcut-tasks",
          type: "System",
          priority: "Normal",
          title: "Upcoming Tasks",
          message: "",
          createdAt: "",
          read: false,
          action: "tasks",
        })}>
          <span>Upcoming Tasks</span>
          <strong>{upcomingTasks.length}</strong>
        </button>

        <button
          className={calendarSyncIssues.length > 0 ? "statCard warning" : "statCard"}
          type="button"
          onClick={() => setNotificationFilter("Calendar")}
        >
          <span>Calendar Health</span>
          <strong>{calendarSyncIssues.length}</strong>
        </button>

        <div className="statCard">
          <span>Open Alerts</span>
          <strong>{allNotificationItems.length}</strong>
        </div>
      </section>

      <section className="filtersPanel maintenanceFilters">
        <select value={notificationFilter} onChange={(event) => setNotificationFilter(event.target.value)}>
          <option value="all">All alerts</option>
          <option value="unread">Unread only</option>
          <option value="Reservation">Reservations</option>
          <option value="Cleaner">Cleaners</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Property">Properties</option>
          <option value="System">System</option>
          <option value="Calendar">Calendar Health</option>
        </select>
      </section>

      <section className="notificationList">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Calendar Sync Intelligence</p>
            <h3>Calendar Health</h3>
            <p className="headerSubtext">
              Sync issues, missing calendar blocks, duplicates, and double-booking risks that need owner attention.
            </p>
          </div>
        </div>

        {calendarSyncIssues.length === 0 ? (
          <div className="emptyState">
            No calendar health issues right now.
          </div>
        ) : (
          calendarSyncIssues.map((issue) => (
            <article className="notificationCard unread" key={`calendar-health-${issue.id}`}>
              <div className="notificationTop">
                <div>
                  <span className={`priorityPill priority${issue.severity === "High" ? "High" : "Normal"}`}>
                    {issue.severity === "High" ? "High" : "Normal"}
                  </span>
                  <span className="typePill">Calendar</span>
                </div>
                <small>{issue.dateRange}</small>
              </div>

              <h3>{issue.property}</h3>
              <p>{issue.message}</p>
            </article>
          ))
        )}
      </section>

      <section className="notificationList">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Owner command center</p>
            <h3>All Alerts</h3>
          </div>
        </div>

        {visibleNotifications.length === 0 ? (
          <div className="emptyState">
            No active alerts right now.
          </div>
        ) : (
          visibleNotifications.map((notification) => (
            <article
              className={`notificationCard ${notification.read ? "read" : "unread"}`}
              key={notification.id}
            >
              <div className="notificationTop">
                <div>
                  <span className={`priorityPill priority${notification.priority}`}>
                    {notification.priority}
                  </span>
                  <span className="typePill">{notification.type}</span>
                </div>
                <small>{notification.createdAt}</small>
              </div>

              <h3>{notification.title}</h3>
              <p>{notification.message}</p>

              <div className="cardActions">
                <button type="button" onClick={() => openNotification(notification)}>
                  Open Alert
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}