import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import CleanerPortalCalendar from "./CleanerPortalCalendar";
import CompleteTaskModal, {
  type CompleteTaskResult,
} from "../components/pulse/CompleteTaskModal";

type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";

type CleanerPortalStatus =
  | "Upcoming"
  | "In Progress"
  | "Ready to Invoice"
  | "Invoiced";

type CleanerPortalPageProps = {
  cleaners: any[];
  homes: any[];
  reservations: any[];
  cleanerPortalId: string;
  cleanerIssueForm: any;
  openCleanerScheduleOnLoad: boolean;
  setOpenCleanerScheduleOnLoad: Dispatch<SetStateAction<boolean>>;
  setCleanerIssueForm: Dispatch<SetStateAction<any>>;
  updateReservation: (id: string, updates: any) => void;
  updateReservationFromCleaner: (
    id: string,
    status: any,
    note: string
  ) => void;
  submitCleanerMaintenanceIssue: (
    event: FormEvent<HTMLFormElement>
  ) => void;
  isImportedReservation: (reservation: any) => boolean;
  getUrgency: (date: string) => any;
  formatDate: (date: string) => string;
};

const SelectableCleanerPortalCalendar =
  CleanerPortalCalendar as ComponentType<any>;

export default function CleanerPortalPage({
  cleaners,
  homes,
  reservations,
  cleanerPortalId,
  cleanerIssueForm,
  setCleanerIssueForm,
  submitCleanerMaintenanceIssue,
  isImportedReservation,
  getUrgency,
  openCleanerScheduleOnLoad,
  setOpenCleanerScheduleOnLoad,
  updateReservationFromCleaner,
}: CleanerPortalPageProps) {
  const [showCleanerIssueModal, setShowCleanerIssueModal] = useState(false);
  const [showCleanerCalendar, setShowCleanerCalendar] = useState(false);
  const [selectedCleanerTask, setSelectedCleanerTask] = useState<any | null>(
    null
  );
  const [taskBeingCompleted, setTaskBeingCompleted] = useState<any | null>(
    null
  );
  const [taskNoteDraft, setTaskNoteDraft] = useState("");
  const [taskNoteSaved, setTaskNoteSaved] = useState(false);
  const [taskOpenedFrom, setTaskOpenedFrom] = useState<
    "pulse" | "schedule"
  >("schedule");

  useEffect(() => {
    if (!openCleanerScheduleOnLoad) return;

    setShowCleanerCalendar(true);
    setOpenCleanerScheduleOnLoad(false);
  }, [openCleanerScheduleOnLoad, setOpenCleanerScheduleOnLoad]);

  const activeCleaner =
    cleaners.find((cleaner) => cleaner.id === cleanerPortalId) ?? cleaners[0];

  const toLocalDate = (dateString: string) => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatCleanDate = (dateString: string) => {
    const date = toLocalDate(dateString);

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getCleanerPortalStatus = (
    reservation: any
  ): CleanerPortalStatus => {
    const normalizedStatus = String(
      reservation.status ?? ""
    ).toLowerCase();

    if (
      reservation.invoiceSent ||
      normalizedStatus.includes("invoice sent")
    ) {
      return "Invoiced";
    }

    if (normalizedStatus.includes("complete")) {
      return "Ready to Invoice";
    }

    if (
      normalizedStatus.includes("progress") ||
      normalizedStatus.includes("started")
    ) {
      return "In Progress";
    }

    return "Upcoming";
  };

  const getCleanerPortalStatusClass = (
    status: CleanerPortalStatus
  ) => status.toLowerCase().replaceAll(" ", "-");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cleanerHomes = homes.filter(
    (home) => home.defaultCleanerId === activeCleaner?.id
  );

  const cleanerTasks = reservations
    .filter((reservation) => {
      const departureDate = toLocalDate(reservation.departure);

      const cleanerOwnsProperty = cleanerHomes.some(
        (home) => home.id === reservation.homeId
      );

      return (
        (reservation.cleanerId === activeCleaner?.id ||
          cleanerOwnsProperty) &&
        (isImportedReservation(reservation) ||
          reservation.source === "Guest Reservation" ||
          reservation.source === "Owner Block" ||
          reservation.source === "Cleaning") &&
        departureDate >= today &&
        reservation.status !== "Blocked" &&
        reservation.status !== "No Clean Needed"
      );
    })
    .sort(
      (firstReservation, secondReservation) =>
        toLocalDate(firstReservation.departure).getTime() -
        toLocalDate(secondReservation.departure).getTime()
    );

  const todayTasks = cleanerTasks.filter((reservation) => {
    const departureDate = toLocalDate(reservation.departure);
    return departureDate.getTime() === today.getTime();
  });

  const inProgressTasks = cleanerTasks.filter(
    (reservation) =>
      getCleanerPortalStatus(reservation) === "In Progress"
  );

  const readyToInvoiceTasks = cleanerTasks.filter(
    (reservation) =>
      getCleanerPortalStatus(reservation) === "Ready to Invoice"
  );

  const isBackToBack = (reservation: any) =>
    reservations.some(
      (item) =>
        item.id !== reservation.id &&
        item.homeId === reservation.homeId &&
        item.arrival === reservation.departure
    );

  const cleanerHealthScore = useMemo(() => {
    const total = Math.max(cleanerTasks.length, 1);
    const attentionCount =
      inProgressTasks.length + readyToInvoiceTasks.length;

    return Math.max(
      72,
      Math.round(100 - (attentionCount / total) * 14)
    );
  }, [
    cleanerTasks.length,
    inProgressTasks.length,
    readyToInvoiceTasks.length,
  ]);

  const closeIssueModal = () => setShowCleanerIssueModal(false);

  const openTaskPreview = (
    taskId: string,
    openedFrom: "pulse" | "schedule" = "schedule"
  ) => {
    const matchingTask = cleanerTasks.find(
      (task) => String(task.id) === String(taskId)
    );

    if (matchingTask) {
      setTaskOpenedFrom(openedFrom);
      setSelectedCleanerTask(matchingTask);
      setTaskNoteDraft(
        matchingTask.cleanerNotes ??
          matchingTask.notes ??
          ""
      );
      setTaskNoteSaved(false);
    }
  };

  const closeTaskPreview = () => {
    setSelectedCleanerTask(null);
    setTaskNoteDraft("");
    setTaskNoteSaved(false);

    if (taskOpenedFrom === "pulse") {
      setShowCleanerCalendar(false);
    }
  };

  const saveTaskNote = () => {
    if (!selectedCleanerTask || !selectedTaskStatus) return;

    const cleanNote = taskNoteDraft.trim();

    updateReservationFromCleaner(
      String(selectedCleanerTask.id),
      selectedTaskStatus,
      cleanNote || "Cleaner note cleared."
    );

    setSelectedCleanerTask({
      ...selectedCleanerTask,
      cleanerNotes: cleanNote,
    });
    setTaskNoteSaved(true);
  };

  const openCompleteTask = (task: any) => {
    setSelectedCleanerTask(null);
    setTaskBeingCompleted(task);
  };

  const returnToInProgressTask = () => {
    if (!taskBeingCompleted) return;

    setSelectedCleanerTask({
      ...taskBeingCompleted,
      status: "In Progress",
    });
    setTaskNoteDraft(
      taskBeingCompleted.cleanerNotes ??
        taskBeingCompleted.notes ??
        ""
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);
  };

  const undoTaskStart = () => {
    if (!taskBeingCompleted) return;

    updateReservationFromCleaner(
      String(taskBeingCompleted.id),
      "Upcoming",
      "Cleaner reset the task to not started."
    );

    setSelectedCleanerTask({
      ...taskBeingCompleted,
      status: "Upcoming",
    });
    setTaskNoteDraft(
      taskBeingCompleted.cleanerNotes ??
        taskBeingCompleted.notes ??
        ""
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);
  };

  const finishCompletedTask = (result: CompleteTaskResult) => {
    if (!taskBeingCompleted) return;

    const completionParts = [
      result.guestReady
        ? "Property marked guest ready."
        : "Property is not guest ready.",
      result.notes ? `Cleaner notes: ${result.notes}` : "",
      result.includePhotos
        ? `${result.photos.length} completion photo${
            result.photos.length === 1 ? "" : "s"
          } selected.`
        : "No completion photos included.",
    result.maintenanceReported
  ? `Maintenance observation (${result.maintenanceUrgency}): ${result.maintenanceTitle}. ${result.maintenanceDescription} ${
      result.maintenancePhotos.length
    } maintenance photo${
      result.maintenancePhotos.length === 1 ? "" : "s"
    } selected.`
  : "No maintenance issues reported.",
      result.cleaningFee
        ? `Cleaning fee: $${result.cleaningFee}.`
        : "",
      "Owner completion report queued.",
    ].filter(Boolean);

    updateReservationFromCleaner(
      String(taskBeingCompleted.id),
      "Completed",
      completionParts.join(" ")
    );

    setTaskBeingCompleted(null);

    window.alert(
      "Task completed. The owner report and invoice are ready for the next step."
    );
  };

  const selectedTaskHome = selectedCleanerTask
    ? homes.find(
        (home) => home.id === selectedCleanerTask.homeId
      )
    : null;

  const selectedTaskStatus = selectedCleanerTask
    ? getCleanerPortalStatus(selectedCleanerTask)
    : null;

  const selectedPropertyIntelligence = selectedTaskHome
    ? [
        selectedTaskHome.cleanerNotes,
        selectedTaskHome.accessNotes
          ? `🔐 ${selectedTaskHome.accessNotes}`
          : "",
        selectedTaskHome.supplyNotes
          ? `🧴 ${selectedTaskHome.supplyNotes}`
          : "",
        selectedTaskHome.propertyWarnings
          ? `⚠️ ${selectedTaskHome.propertyWarnings}`
          : "",
        selectedTaskHome.specialInstructions
          ? `📌 ${selectedTaskHome.specialInstructions}`
          : "",
      ].filter(Boolean)
    : [];

  const selectedOutstandingInvoiceCount =
    selectedTaskHome?.outstandingInvoiceCount ?? 0;

  const selectedOutstandingInvoiceAmount =
    selectedTaskHome?.outstandingInvoiceAmount ??
    selectedTaskHome?.outstandingBalance ??
    null;

  const selectedEstimatedPay =
    selectedCleanerTask?.cleaningFee ??
    selectedCleanerTask?.amount ??
    selectedCleanerTask?.invoiceAmount ??
    selectedCleanerTask?.price ??
    null;

  return (
    <>
      <header className="pageHeader cleanerPortalHero cleanerCommandHero">
        <div className="cleanerCommandIntro">
          <p className="eyebrow">Cleaner Pulse</p>

          <h2>
            Good morning,{" "}
            {(activeCleaner?.name ?? "Cleaner").split(" ")[0]} 👋
          </h2>

          <p className="cleanerTodayLabel">Today&apos;s Status</p>

          <p className="headerSubtext">
            Your tasks, active work, and invoice reminders are ready.
          </p>
        </div>

        <div
          className="cleanerTodaySnapshot"
          aria-label="Cleaner snapshot"
        >
          <button
            type="button"
            onClick={() =>
              document
                .querySelector(".cleanerUpcomingCard")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
            }
          >
            <strong>{todayTasks.length}</strong>
            <small>🧹 TODAY</small>
          </button>

          <button
            type="button"
            onClick={() =>
              document
                .querySelector(".cleanerActionCenterCard")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
            }
          >
            <strong>{readyToInvoiceTasks.length}</strong>
            <small>💵 READY</small>
          </button>
        </div>
      </header>

      <main className="cleanerPulseShell">
        <article className="cleanerHealthCard compactCleanerHealthCard">
          <div className="cleanerHealthTopline">
            <div>
              <p className="eyebrow">Cleaner Health</p>
              <h3>Task schedule is on track</h3>
            </div>

            <div className="cleanerHealthScore">
              <strong>{cleanerHealthScore}%</strong>
              <span>Excellent</span>
            </div>
          </div>

          <div className="cleanerHealthMeter" aria-hidden="true">
            <span style={{ width: `${cleanerHealthScore}%` }} />
          </div>

          <p>
            AMR is watching today&apos;s tasks, active work, and
            completed tasks that are ready to invoice.
          </p>
        </article>

        <section className="cleanerPulseFlow">
          <article className="reservationWorkspaceCard cleanerActionCenterCard">
            <div className="operationsCardHeader">
              <div>
                <p className="eyebrow">Action Center</p>
                <h3>Cleaner Priorities</h3>
              </div>
            </div>

            <div className="cleanerActionStack">
              <article className="cleanerActionCard urgent">
                <div className="cleanerActionIcon">🧹</div>

                <div>
                  <strong>Today&apos;s Tasks</strong>
                  <p>
                    {todayTasks.length} tasks need attention today.
                  </p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    document
                      .querySelector(".cleanerUpcomingCard")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                >
                  Review
                </button>
              </article>

              <article className="cleanerActionCard active">
                <div className="cleanerActionIcon">⏳</div>

                <div>
                  <strong>In Progress</strong>
                  <p>
                    {inProgressTasks.length} tasks are currently in
                    progress.
                  </p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    document
                      .querySelector(".cleanerUpcomingCard")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                >
                  Continue
                </button>
              </article>

              <article className="cleanerActionCard money">
                <div className="cleanerActionIcon">💵</div>

                <div>
                  <strong>Ready to Invoice</strong>
                  <p>
                    {readyToInvoiceTasks.length} completed tasks are
                    ready to invoice.
                  </p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    document
                      .querySelector(".cleanerUpcomingCard")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                  }
                >
                  Send Invoice
                </button>
              </article>
            </div>
          </article>

          <article className="reservationWorkspaceCard cleanerUpcomingCard">
            <div className="operationsCardHeader">
              <div>
                <p className="eyebrow">Tasks</p>
                <h3>Upcoming Tasks</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                onClick={() => setShowCleanerCalendar(true)}
              >
                Open Schedule
              </button>
            </div>

      <div className="cleanerTurnStack cleanerPulseTaskGrid">
  {cleanerTasks.slice(0, 6).map((reservation) => {
    const home = homes.find(
      (item) => item.id === reservation.homeId
    );

    const cleanerStatus =
      getCleanerPortalStatus(reservation);

    const privateNote =
      reservation.cleanerNotes ??
      reservation.notes ??
      "";

    return (
      <button
        key={reservation.id}
        type="button"
        className="cleanerPulseTaskCard"
        data-cleaner-task-id={reservation.id}
        onClick={() => {
          setShowCleanerCalendar(false);
          openTaskPreview(String(reservation.id), "pulse");
        }}
      >
        <div className="cleanerPulseTaskCardTop">
          <div>
            <p className="eyebrow">Task</p>
            <h3>{home?.name ?? "Unknown Property"}</h3>
            <span>
              {reservation.jobType ??
                reservation.taskType ??
                "Vacation Rental Turnover"}
            </span>
            <p className="cleanerPulsePay">
  💵 Estimated Pay{" "}
  <strong>
    {reservation.cleaningFee ??
      reservation.amount ??
      reservation.invoiceAmount ??
      "Set on invoice"}
  </strong>
</p>
          </div>

          <div className="cleanerPulseTaskDate">
            <strong>
              {formatCleanDate(reservation.departure)}
            </strong>
            <span>Task Date</span>
          </div>
        </div>

        <div className="cleanerPulseTaskBadges">
          {isBackToBack(reservation) && (
            <span className="conflictWarningPill">
              🔁 B2B
            </span>
          )}

          <span
            className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
              cleanerStatus
            )}`}
          >
            {cleanerStatus}
          </span>
        </div>

          <div className="cleanerPulseTaskNote">
            <span>🔒 Private note</span>
            <p>{privateNote}</p>
          </div>
        <div className="cleanerPulseInsight">
  <span>✨ AMR Insight</span>

  <p>
    {reservation.isBackToBack
      ? "Tight turnaround today. Plan supplies before arrival."
      : "Everything looks good for this turnover."}
  </p>
</div>

      <div className="cleanerPulseTaskFooter">
  <div className="cleanerPulseInvoiceInfo">
    <span>Outstanding Invoices</span>

    <strong>
      {home?.outstandingInvoiceCount ?? 0}
    </strong>
  </div>

  <button
    type="button"
    className="primaryButton cleanerCardActionButton"
    onClick={(event) => {
      event.stopPropagation();

      setShowCleanerCalendar(false);
      openTaskPreview(String(reservation.id), "pulse");
    }}
  >
    {cleanerStatus === "Upcoming" && "▶ Start Task"}
    {cleanerStatus === "In Progress" && "⏳ Continue Task"}
    {cleanerStatus === "Ready to Invoice" && "💵 Send Invoice"}
    {cleanerStatus === "Invoiced" && "✓ View Invoice"}
  </button>
</div>
      </button>
    );
  })}

  {cleanerTasks.length === 0 && (
    <div className="emptyStateCard">
      <strong>No upcoming tasks</strong>
      <p>No upcoming tasks are currently assigned.</p>
    </div>
  )}
</div>
          </article>
        </section>
      </main>

      {showCleanerCalendar && (
        <div
          className="modalOverlay"
          onClick={() => {
            setSelectedCleanerTask(null);
            setShowCleanerCalendar(false);
          }}
        >
          <div
            className="modalCard cleanerCalendarModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cleanerScheduleModalHeader">
              <div>
                <p className="eyebrow">Cleaner schedule</p>
                <h3>My Calendar</h3>
              </div>

              <button
                type="button"
                className="cleanerScheduleClose"
                onClick={() => {
                  setSelectedCleanerTask(null);
                  setShowCleanerCalendar(false);
                }}
              >
                ✕
              </button>
            </div>

            <SelectableCleanerPortalCalendar
              cleanerTasks={cleanerTasks}
              homes={homes}
              getUrgency={getUrgency}
              onSelectTask={(taskId: string) =>
                openTaskPreview(taskId, "schedule")
              }
            />

    
          </div>
        </div>
      )}

{selectedCleanerTask && selectedTaskStatus && (
            <div
  className="cleanerTaskPreviewOverlay cleanerTaskPreviewGlobalOverlay"
  onClick={closeTaskPreview}
>
                <article
                  className="cleanerTaskPreviewCard cleanerJobCard"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="cleanerTaskPreviewHeader">
                    <div>
                      <p className="eyebrow">Task</p>
                      <h3>
                        {selectedTaskHome?.name ??
                          "Unknown Property"}
                      </h3>
                      <p className="cleanerJobType">
                        {selectedCleanerTask.jobType ??
                          selectedCleanerTask.taskType ??
                          "Vacation Rental Turnover"}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="cleanerScheduleClose"
                      onClick={closeTaskPreview}
                      aria-label="Close task card"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="cardTopLine cleanerJobStatusRow">
                    {isBackToBack(selectedCleanerTask) && (
                      <span className="conflictWarningPill">
                        🔁 Back-to-Back
                      </span>
                    )}

                    <span
                      className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
                        selectedTaskStatus
                      )}`}
                    >
                      {selectedTaskStatus}
                    </span>
                  </div>

                  <div className="cleanerJobPayRow">
                    <span>Estimated Pay</span>
                    <strong>
                      {selectedEstimatedPay === null ||
                      selectedEstimatedPay === ""
                        ? "Set on invoice"
                        : `$${selectedEstimatedPay}`}
                    </strong>
                  </div>

                  <section className="cleanerJobSection cleanerNotesEditor">
                    <div className="cleanerJobSectionHeader">
                     <div className="privateTaskNotesHeading">
  <strong>📝 Task Notes</strong>
  <span>🔒 Internal cleaner notes only</span>
</div>
                      {taskNoteSaved && (
                        <span className="cleanerNoteSaved">
                          Saved
                        </span>
                      )}
                    </div>

                    <textarea
                      value={taskNoteDraft}
                      onChange={(event) => {
                        setTaskNoteDraft(event.target.value);
                        setTaskNoteSaved(false);
                      }}
                      placeholder="Add notes for this task..."
                    />

                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={saveTaskNote}
                    >
                      Save Note
                    </button>
                  </section>

                  {selectedPropertyIntelligence.length > 0 && (
                    <section className="cleanerJobSection">
                      <div className="cleanerJobSectionHeader">
                        <strong>🧠 Property Intelligence</strong>
                      </div>

                      <div className="cleanerIntelligenceList">
                        {selectedPropertyIntelligence.map(
                          (insight, index) => (
                            <p key={`${insight}-${index}`}>
                              {insight}
                            </p>
                          )
                        )}
                      </div>
                    </section>
                  )}

                  <section className="cleanerJobSection cleanerInvoiceSnapshot">
                    <div>
                      <span>💵 Outstanding Invoices</span>
                      <strong>
                        {selectedOutstandingInvoiceCount}
                        {selectedOutstandingInvoiceAmount !== null &&
                          ` · $${selectedOutstandingInvoiceAmount}`}
                      </strong>
                    </div>

                    {selectedOutstandingInvoiceCount > 0 && (
                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={() =>
                          window.alert(
                            "Invoice reminder flow coming next"
                          )
                        }
                      >
                        Send Reminders
                      </button>
                    )}
                  </section>

                  <div className="cleanerJobPrimaryActions">
                    {selectedTaskStatus === "Upcoming" && (
                      <button
                        className="primaryButton"
                        type="button"
                        onClick={() => {
                          updateReservationFromCleaner(
                            String(selectedCleanerTask.id),
                            "In Progress",
                            "Cleaner started the task."
                          );

                          setSelectedCleanerTask({
                            ...selectedCleanerTask,
                            status: "In Progress",
                          });
                        }}
                      >
                        ▶ Start Task
                      </button>
                    )}

                  {selectedTaskStatus === "In Progress" && (
  <>
    <button
      className="primaryButton"
      type="button"
      onClick={() =>
        openCompleteTask(selectedCleanerTask)
      }
    >
      ✅ Complete Task
    </button>

    <button
      className="completeTaskUndoButton"
      type="button"
      onClick={() => {
        updateReservationFromCleaner(
          String(selectedCleanerTask.id),
          "Upcoming",
          "Cleaner reset the task to not started."
        );

        setSelectedCleanerTask({
          ...selectedCleanerTask,
          status: "Upcoming",
        });
      }}
    >
      ↩ Undo Start
    </button>
  </>
)}

                  
                  {selectedTaskStatus === "Ready to Invoice" && (
  <>
    <button
      className="primaryButton"
      type="button"
      onClick={() =>
        window.alert("Invoice flow coming next 💵")
      }
    >
      💵 Send Invoice
    </button>

    <button
      className="completeTaskUndoButton"
      type="button"
      onClick={() => {
        updateReservationFromCleaner(
          String(selectedCleanerTask.id),
          "In Progress",
          "Cleaner reopened the completed task."
        );

        setSelectedCleanerTask({
          ...selectedCleanerTask,
          status: "In Progress",
        });
      }}
    >
      ↩ Reopen Task
    </button>
  </>
)}

                    {selectedTaskStatus === "Invoiced" && (
                      <button
                        className="primaryButton"
                        type="button"
                        disabled
                      >
                        Invoice Sent
                      </button>
                    )}

                    <button
                      className="secondaryButton"
                      type="button"
                      onClick={closeTaskPreview}
                    >
                      {taskOpenedFrom === "pulse"
                        ? "← Back to Pulse"
                        : "← Back to Schedule"}
                    </button>
                  </div>
                </article>
              </div>
            )}


      {taskBeingCompleted && (
        <CompleteTaskModal
          task={taskBeingCompleted}
          home={homes.find(
            (home) => home.id === taskBeingCompleted.homeId
          )}
          onClose={returnToInProgressTask}
          onUndoStart={undoTaskStart}
          onFinish={finishCompletedTask}
        />
      )}

      {showCleanerIssueModal && (
        <div className="modalOverlay" onClick={closeIssueModal}>
          <div
            className="modalCard cleanerIssueModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">Maintenance reporting</p>
                <h3>Report an Issue</h3>
              </div>

              <button
                type="button"
                className="secondaryButton"
                onClick={closeIssueModal}
              >
                Close
              </button>
            </div>

            <p className="mutedText">
              This creates an owner notification and a maintenance work
              order automatically.
            </p>

            <form
              className="cleanerIssueForm"
              onSubmit={submitCleanerMaintenanceIssue}
            >
              <label>
                Property
                <select
                  value={cleanerIssueForm.homeId}
                  onChange={(event) =>
                    setCleanerIssueForm({
                      ...cleanerIssueForm,
                      homeId: event.target.value,
                    })
                  }
                >
                  <option value="">Select property</option>

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
                  value={cleanerIssueForm.title}
                  onChange={(event) =>
                    setCleanerIssueForm({
                      ...cleanerIssueForm,
                      title: event.target.value,
                    })
                  }
                  placeholder="Example: Loose railing, leak under sink"
                />
              </label>

              <label>
                Category
                <select
                  value={cleanerIssueForm.category}
                  onChange={(event) =>
                    setCleanerIssueForm({
                      ...cleanerIssueForm,
                      category: event.target.value,
                    })
                  }
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
                  value={cleanerIssueForm.urgency}
                  onChange={(event) =>
                    setCleanerIssueForm({
                      ...cleanerIssueForm,
                      urgency: event.target.value as WorkOrderUrgency,
                    })
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="After Hours">
                    After Hours
                  </option>
                </select>
              </label>

              <label>
                Photo upload placeholder
                <input type="file" accept="image/*" />
              </label>

              <label>
                Notes
                <textarea
                  value={cleanerIssueForm.notes}
                  onChange={(event) =>
                    setCleanerIssueForm({
                      ...cleanerIssueForm,
                      notes: event.target.value,
                    })
                  }
                  placeholder="What happened? Where is it? Does it impact the next guest?"
                />
              </label>

              <button className="primaryButton" type="submit">
                Send to Owner + Create Work Order
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}