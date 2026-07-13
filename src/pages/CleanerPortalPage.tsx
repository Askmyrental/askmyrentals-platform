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
import { supabase } from "../utils/supabase";

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
  onCreateInvoiceFromTask: (task: any) => void;
  onReviewReadyInvoices: (tasks: any[]) => void;
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
  onCreateInvoiceFromTask,
  onReviewReadyInvoices,
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
  const [cleanerJobs, setCleanerJobs] = useState<any[]>([]);
  const [jobsLoadingError, setJobsLoadingError] = useState("");

  useEffect(() => {
    if (!openCleanerScheduleOnLoad) return;

    setShowCleanerCalendar(true);
    setOpenCleanerScheduleOnLoad(false);
  }, [openCleanerScheduleOnLoad, setOpenCleanerScheduleOnLoad]);

  useEffect(() => {
    let cancelled = false;

    async function loadCleanerJobs() {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const user = userData.user;

      if (cancelled) return;

      if (userError || !user) {
        setJobsLoadingError("Unable to load independent jobs.");
        return;
      }

      const { data, error } = await supabase
        .from("cleaner_jobs")
        .select("*")
        .eq("cleaner_id", user.id)
        .neq("status", "cancelled")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Cleaner job schedule load failed", error);
        setJobsLoadingError(error.message);
        return;
      }

      setCleanerJobs(data ?? []);
      setJobsLoadingError("");
    }

    void loadCleanerJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCleaner =
    cleaners.find(
      (cleaner) => String(cleaner.id) === String(cleanerPortalId)
    ) ?? cleaners[0];

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

  const reservationTasks = reservations
    .filter((reservation) => {
      const departureDate = toLocalDate(reservation.departure);
      const normalizedStatus = String(
        reservation.status ?? ""
      ).toLowerCase();
      const normalizedSource = String(
        reservation.source ?? ""
      ).toLowerCase();

      const isCleanerTurn =
        isImportedReservation(reservation) ||
        normalizedSource === "guest reservation" ||
        normalizedSource === "owner block" ||
        normalizedSource === "cleaning";

      return (
        isCleanerTurn &&
        departureDate >= today &&
        normalizedStatus !== "blocked" &&
        normalizedStatus !== "no clean needed"
      );
    });

  const normalizedJobTasks = cleanerJobs
    .filter((job) => toLocalDate(job.scheduled_date) >= today)
    .map((job) => ({
      id: `job:${job.id}`,
      cleanerJobId: job.id,
      isCleanerJob: true,
      source: "cleaner job",
      homeId: job.property_id ?? "",
      arrival: job.scheduled_date,
      departure: job.scheduled_date,
      scheduledDate: job.scheduled_date,
      scheduledTime: job.scheduled_time ?? "",
      status:
        job.status === "in_progress"
          ? "In Progress"
          : job.status === "completed"
            ? "Completed"
            : job.status === "invoiced" || job.status === "paid"
              ? "Invoice Sent"
              : "Upcoming",
      jobType: job.job_type,
      taskType: job.job_type,
      customerName: job.customer_name,
      customerEmail: job.customer_email ?? "",
      customerPhone: job.customer_phone ?? "",
      serviceAddress: job.service_address ?? "",
      amount: Number(job.amount_cents ?? 0) / 100,
      cleaningFee: Number(job.amount_cents ?? 0) / 100,
      notes: job.notes ?? "",
      cleanerNotes: job.notes ?? "",
    }));

  const cleanerTasks = [...reservationTasks, ...normalizedJobTasks].sort(
    (firstTask, secondTask) => {
      const dateDifference =
        toLocalDate(firstTask.departure).getTime() -
        toLocalDate(secondTask.departure).getTime();

      if (dateDifference !== 0) return dateDifference;

      return String(firstTask.scheduledTime ?? "").localeCompare(
        String(secondTask.scheduledTime ?? "")
      );
    }
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
    !reservation.isCleanerJob &&
    reservations.some(
      (item) =>
        item.id !== reservation.id &&
        String(item.homeId) === String(reservation.homeId) &&
        String(item.arrival).slice(0, 10) === String(reservation.departure).slice(0, 10)
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

  async function updateCleanerTask(
    task: any,
    nextStatus: CleanerPortalStatus,
    note: string
  ) {
    if (!task.isCleanerJob) {
      updateReservationFromCleaner(
        String(task.id),
        nextStatus,
        note
      );
      return task;
    }

    const statusMap: Record<CleanerPortalStatus, string> = {
      Upcoming: "upcoming",
      "In Progress": "in_progress",
      "Ready to Invoice": "completed",
      Invoiced: "invoiced",
    };

    const { data, error } = await supabase
      .from("cleaner_jobs")
      .update({
        status: statusMap[nextStatus],
        notes: note || task.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.cleanerJobId)
      .select()
      .single();

    if (error) {
      console.error("Independent job update failed", error);
      window.alert(error.message);
      return null;
    }

    setCleanerJobs((current) =>
      current.map((job) => (job.id === data.id ? data : job))
    );

    return {
      ...task,
      status:
        nextStatus === "Ready to Invoice"
          ? "Completed"
          : nextStatus,
      notes: data.notes ?? "",
      cleanerNotes: data.notes ?? "",
      cleaningFee: Number(data.amount_cents ?? 0) / 100,
      amount: Number(data.amount_cents ?? 0) / 100,
    };
  }

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

  const saveTaskNote = async () => {
    if (!selectedCleanerTask || !selectedTaskStatus) return;

    const cleanNote = taskNoteDraft.trim();
    const updatedTask = await updateCleanerTask(
      selectedCleanerTask,
      selectedTaskStatus,
      cleanNote
    );

    if (!updatedTask) return;

    setSelectedCleanerTask({
      ...updatedTask,
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

  const undoTaskStart = async () => {
    if (!taskBeingCompleted) return;

    const updatedTask = await updateCleanerTask(
      taskBeingCompleted,
      "Upcoming",
      "Cleaner reset the task to not started."
    );

    if (!updatedTask) return;

    setSelectedCleanerTask(updatedTask);
    setTaskNoteDraft(
      updatedTask.cleanerNotes ??
        updatedTask.notes ??
        ""
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);
  };

  const saveCompletionDraft = async (result: CompleteTaskResult) => {
    if (!taskBeingCompleted) return;

    const draftTask = {
      ...taskBeingCompleted,
      status: "In Progress",
      cleaningFee: result.cleaningFee,
      completionDraft: {
        guestReady: result.guestReady,
        notes: result.notes,
        includePhotos: result.includePhotos,
        maintenanceReported: result.maintenanceReported,
        maintenanceTitle: result.maintenanceTitle,
        maintenanceDescription: result.maintenanceDescription,
        maintenanceUrgency: result.maintenanceUrgency,
        cleaningFee: result.cleaningFee,
      },
    };

    const draftSummary = [
      "Completion report saved as draft.",
      result.notes ? `Homeowner message: ${result.notes}` : "",
      result.maintenanceReported
        ? `Maintenance draft: ${result.maintenanceTitle}. ${result.maintenanceDescription}`
        : "",
      result.cleaningFee ? `Cleaning fee: $${result.cleaningFee}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const updatedTask = await updateCleanerTask(
      {
        ...draftTask,
        notes: draftSummary,
      },
      "In Progress",
      draftSummary
    );

    if (!updatedTask) return;

    setSelectedCleanerTask({
      ...updatedTask,
      completionDraft: draftTask.completionDraft,
    });
    setTaskNoteDraft(
      taskBeingCompleted.cleanerNotes ??
        taskBeingCompleted.notes ??
        ""
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);

    window.alert("Draft saved. The task remains in progress.");
  };

  const finishCompletedTask = async (result: CompleteTaskResult) => {
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
      taskBeingCompleted.isCleanerJob
        ? "Independent job completed."
        : "Owner completion report queued.",
    ].filter(Boolean);

    const updatedTask = await updateCleanerTask(
      taskBeingCompleted,
      "Ready to Invoice",
      completionParts.join(" ")
    );

    if (!updatedTask) return;

    setTaskBeingCompleted(null);

    window.alert(
      taskBeingCompleted.isCleanerJob
        ? "Job completed and ready to invoice."
        : "Task completed. The owner report and invoice are ready for the next step."
    );
  };

  const selectedTaskHome = selectedCleanerTask
    ? homes.find(
        (home) => String(home.id) === String(selectedCleanerTask.homeId)
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
            Welcome back,{" "}
            {(activeCleaner?.name ?? "Cleaner").split(" ")[0]} 👋
          </h2>

          <p className="headerSubtext">
            Your workday is organized and ready.
          </p>
        </div>

        <div
          className="cleanerMobileStatusLine"
          aria-label="Today’s cleaner status"
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
            <span className="cleanerMobileStatusIcon">🧹</span>
            <span>
              <strong>{todayTasks.length}</strong>
              <small>
                {todayTasks.length === 1 ? "task due today" : "tasks due today"}
              </small>
            </span>
          </button>

          <span className="cleanerMobileStatusDivider" aria-hidden="true" />

          <button
            type="button"
            disabled={readyToInvoiceTasks.length === 0}
            onClick={() => {
              if (readyToInvoiceTasks.length === 1) {
                onCreateInvoiceFromTask(readyToInvoiceTasks[0]);
                return;
              }

              if (readyToInvoiceTasks.length > 1) {
                onReviewReadyInvoices(readyToInvoiceTasks);
              }
            }}
          >
            <span className="cleanerMobileStatusIcon">💵</span>
            <span>
              <strong>{readyToInvoiceTasks.length}</strong>
              <small>
                {readyToInvoiceTasks.length === 1
                  ? "task ready to invoice"
                  : "tasks ready to invoice"}
              </small>
            </span>
          </button>
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
            <small>🧹 Today</small>
          </button>

          <button
            type="button"
            disabled={readyToInvoiceTasks.length === 0}
            onClick={() => {
              if (readyToInvoiceTasks.length === 1) {
                onCreateInvoiceFromTask(readyToInvoiceTasks[0]);
                return;
              }

              if (readyToInvoiceTasks.length > 1) {
                onReviewReadyInvoices(readyToInvoiceTasks);
              }
            }}
          >
            <strong>{readyToInvoiceTasks.length}</strong>
            <small>💵 Ready to Invoice</small>
          </button>
        </div>
      </header>

      <main className="cleanerPulseShell">
        {jobsLoadingError && (
          <section className="emptyStateCard">
            <strong>Independent jobs could not be loaded</strong>
            <p>{jobsLoadingError}</p>
          </section>
        )}
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
                  disabled={readyToInvoiceTasks.length === 0}
                  onClick={() => {
                    if (readyToInvoiceTasks.length === 1) {
                      onCreateInvoiceFromTask(readyToInvoiceTasks[0]);
                      return;
                    }

                    onReviewReadyInvoices(readyToInvoiceTasks);
                  }}
                >
                  {readyToInvoiceTasks.length === 1
                    ? "Create Invoice"
                    : "Review Invoices"}
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

      <div className="cleanerTaskLedger" role="table" aria-label="Upcoming cleaner tasks">
        <div className="cleanerTaskLedgerHeader" role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Property</span>
          <span role="columnheader">Task</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Pay</span>
          <span role="columnheader">Action</span>
        </div>

        <div className="cleanerTaskLedgerBody">
          {cleanerTasks.map((reservation) => {
            const home = homes.find(
              (item) => String(item.id) === String(reservation.homeId)
            );

            const cleanerStatus = getCleanerPortalStatus(reservation);
            const privateNote =
              reservation.cleanerNotes ??
              reservation.notes ??
              "";

            const estimatedPay =
              reservation.cleaningFee ??
              reservation.amount ??
              reservation.invoiceAmount ??
              reservation.price ??
              null;

            return (
              <article
                key={reservation.id}
                className="cleanerTaskLedgerRow"
                role="row"
                tabIndex={0}
                data-cleaner-task-id={reservation.id}
                onClick={() => {
                  setShowCleanerCalendar(false);
                  openTaskPreview(String(reservation.id), "pulse");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setShowCleanerCalendar(false);
                    openTaskPreview(String(reservation.id), "pulse");
                  }
                }}
              >
                <div className="cleanerTaskLedgerDate" role="cell">
                  <strong>{formatCleanDate(reservation.departure)}</strong>
                  <small>Task date</small>
                </div>

                <div className="cleanerTaskLedgerProperty" role="cell">
                  <strong>
                    {reservation.isCleanerJob
                      ? reservation.customerName ?? "Independent Job"
                      : home?.name ?? "Unknown Property"}
                  </strong>
                  <small>
                    {reservation.isCleanerJob
                      ? reservation.serviceAddress || "Independent job"
                      : home?.address ??
                        home?.addressLine1 ??
                        "Property details"}
                  </small>
                </div>

                <div className="cleanerTaskLedgerTask" role="cell">
                  <strong>
                    {reservation.jobType ??
                      reservation.taskType ??
                      "Vacation Rental Turnover"}
                  </strong>
                  <small>
                    {privateNote
                      ? privateNote
                      : "No private task note"}
                  </small>
                </div>

                <div className="cleanerTaskLedgerStatus" role="cell">
                  <div className="cleanerTaskLedgerBadges">
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
                </div>

                <div className="cleanerTaskLedgerPay" role="cell">
                  <strong>
                    {estimatedPay === null || estimatedPay === ""
                      ? "Set on invoice"
                      : `$${estimatedPay}`}
                  </strong>
                  <small>
                    {reservation.isCleanerJob
                      ? "Independent job"
                      : `${home?.outstandingInvoiceCount ?? 0} outstanding`}
                  </small>
                </div>

                <div className="cleanerTaskLedgerAction" role="cell">
                  <button
                    type="button"
                    className={`primaryButton cleanerTaskLedgerActionButton action-${getCleanerPortalStatusClass(
                      cleanerStatus
                    )}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowCleanerCalendar(false);

                      if (cleanerStatus === "Ready to Invoice") {
                        onCreateInvoiceFromTask(reservation);
                        return;
                      }

                      openTaskPreview(String(reservation.id), "pulse");
                    }}
                  >
                    {cleanerStatus === "Upcoming" && "Start"}
                    {cleanerStatus === "In Progress" && "Continue"}
                    {cleanerStatus === "Ready to Invoice" && "Invoice"}
                    {cleanerStatus === "Invoiced" && "View"}
                  </button>
                </div>
              </article>
            );
          })}

          {cleanerTasks.length === 0 && (
            <div className="emptyStateCard">
              <strong>No upcoming tasks</strong>
              <p>No upcoming tasks are currently assigned.</p>
            </div>
          )}
        </div>
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
                          selectedCleanerTask.customerName ??
                          (selectedCleanerTask.isCleanerJob
                            ? "Independent Job"
                            : "Unknown Property")}
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
                        onClick={async () => {
                          const updatedTask = await updateCleanerTask(
                            selectedCleanerTask,
                            "In Progress",
                            "Cleaner started the task."
                          );

                          if (updatedTask) {
                            setSelectedCleanerTask(updatedTask);
                          }
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
      onClick={async () => {
        const updatedTask = await updateCleanerTask(
          selectedCleanerTask,
          "Upcoming",
          "Cleaner reset the task to not started."
        );

        if (updatedTask) {
          setSelectedCleanerTask(updatedTask);
        }
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
      onClick={() => {
        onCreateInvoiceFromTask(selectedCleanerTask);
        setSelectedCleanerTask(null);
        setShowCleanerCalendar(false);
      }}
    >
      💵 Send Invoice
    </button>

    <button
      className="completeTaskUndoButton"
      type="button"
      onClick={async () => {
        const updatedTask = await updateCleanerTask(
          selectedCleanerTask,
          "In Progress",
          "Cleaner reopened the completed task."
        );

        if (updatedTask) {
          setSelectedCleanerTask(updatedTask);
        }
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
            (home) => String(home.id) === String(taskBeingCompleted.homeId)
          )}
          onClose={returnToInProgressTask}
          onUndoStart={undoTaskStart}
          onSaveDraft={saveCompletionDraft}
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