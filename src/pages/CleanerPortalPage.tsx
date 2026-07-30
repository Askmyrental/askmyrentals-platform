import {
  useEffect,
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
import {
  printWorkPacket,
  type WorkPacketInput,
} from "../utils/printWorkPacket";
import { shareWorkPacket } from "../utils/shareWorkPacket";

type WorkOrderUrgency = "Low" | "Medium" | "High" | "After Hours";

type CleanerPortalStatus =
  | "Upcoming"
  | "In Progress"
  | "Ready to Invoice"
  | "Invoiced"
  | "No Clean Needed";

type ScheduleChangeAlert = {
  id: string;
  property_id: string;
  reservation_id: string | null;
  ical_uid: string | null;
  source: string;
  alert_type: string;
  severity: "high" | "normal" | string;
  title: string;
  message: string;
  old_arrival: string | null;
  new_arrival: string | null;
  old_departure: string | null;
  new_departure: string | null;
  status: "new" | "reviewed" | "dismissed" | string;
  detected_at: string;
};

type CleanerPortalPageProps = {
  cleaners: any[];
  homes: any[];
  reservations: any[];
  cleanerPortalId: string;
  selectedGroupRole?: string;
  cleanerIssueForm: any;
  openCleanerScheduleOnLoad: boolean;
  setOpenCleanerScheduleOnLoad: Dispatch<SetStateAction<boolean>>;
  setCleanerIssueForm: Dispatch<SetStateAction<any>>;
  updateReservation: (id: string, updates: any) => void;
  updateReservationFromCleaner: (
    id: string,
    status: any,
    note: string,
  ) => Promise<boolean>;
  submitCleanerMaintenanceIssue: (event: FormEvent<HTMLFormElement>) => void;
  isImportedReservation: (reservation: any) => boolean;
  getUrgency: (date: string) => any;
  formatDate: (date: string) => string;
  onCreateInvoiceFromTask: (task: any) => void;
  onReviewReadyInvoices: (tasks: any[]) => void;
  onOpenInvoicesFilter: (
    filter: "all" | "outstanding" | "paid" | "overdue",
  ) => void;
  onOpenInvoice: (
    invoiceId: string,
    filter?: "all" | "outstanding" | "paid" | "overdue",
  ) => void;
  onOpenProfile: () => void;
};

const SelectableCleanerPortalCalendar =
  CleanerPortalCalendar as ComponentType<any>;

export default function CleanerPortalPage({
  cleaners,
  homes,
  reservations,
  cleanerPortalId,
  selectedGroupRole,
  cleanerIssueForm,
  setCleanerIssueForm,
  submitCleanerMaintenanceIssue,
  isImportedReservation,
  getUrgency,
  openCleanerScheduleOnLoad,
  setOpenCleanerScheduleOnLoad,
  updateReservation,
  updateReservationFromCleaner,
  onCreateInvoiceFromTask,
  onReviewReadyInvoices,
  onOpenInvoicesFilter,
  onOpenInvoice,
  onOpenProfile,
}: CleanerPortalPageProps) {
  const [showCleanerIssueModal, setShowCleanerIssueModal] = useState(false);
  const [showCleanerCalendar, setShowCleanerCalendar] = useState(false);
  const [selectedCleanerTask, setSelectedCleanerTask] = useState<any | null>(
    null,
  );
  const [taskBeingCompleted, setTaskBeingCompleted] = useState<any | null>(
    null,
  );
  const [taskNoteDraft, setTaskNoteDraft] = useState("");
  const [taskNoteSaved, setTaskNoteSaved] = useState(false);
  const [taskOpenedFrom, setTaskOpenedFrom] = useState<"pulse" | "schedule">(
    "schedule",
  );
  const [cleanerJobs, setCleanerJobs] = useState<any[]>([]);
  const [jobsLoadingError, setJobsLoadingError] = useState("");
  const [invoicedReservationIds, setInvoicedReservationIds] = useState<
    Set<string>
  >(() => new Set());
  const [pulseInvoices, setPulseInvoices] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTodayTaskList, setShowTodayTaskList] = useState(false);
  const [showInProgressTaskList, setShowInProgressTaskList] = useState(false);
  const [showOnlyUnassignedTasks, setShowOnlyUnassignedTasks] =
    useState(false);
  const [pulseTaskSort] = useState<
    | "date"
    | "property-asc"
    | "property-desc"
    | "cleaner-asc"
    | "cleaner-desc"
    | "unassigned-first"
    | "task-asc"
    | "task-desc"
  >("date");
  const [pulseDateRange, setPulseDateRange] = useState<
    "all" | "today" | "7" | "14" | "30" | "custom"
  >("all");
  const [pulseCustomStartDate, setPulseCustomStartDate] = useState("");
  const [pulseCustomEndDate, setPulseCustomEndDate] = useState("");
  const [pulsePropertyFilters, setPulsePropertyFilters] = useState<string[]>(["all"]);
  const [pulseAssignmentFilters, setPulseAssignmentFilters] = useState<string[]>(["all"]);
  const [showPulseDateFilter, setShowPulseDateFilter] = useState(false);
  const [showPulsePropertyFilter, setShowPulsePropertyFilter] = useState(false);
  const [showPulseAssignmentFilter, setShowPulseAssignmentFilter] = useState(false);
  const [showScheduleShareModal, setShowScheduleShareModal] = useState(false);
  const [scheduleShareCleanerIds, setScheduleShareCleanerIds] = useState<string[]>([]);
  const [scheduleChangeAlerts, setScheduleChangeAlerts] = useState<
    ScheduleChangeAlert[]
  >([]);
  const [scheduleAlertsLoading, setScheduleAlertsLoading] = useState(true);
  const [scheduleAlertsError, setScheduleAlertsError] = useState("");
  const [updatingScheduleAlertId, setUpdatingScheduleAlertId] = useState<
    string | null
  >(null);
  const [taskActionMessage, setTaskActionMessage] = useState("");
  const [assignmentSavingTaskId, setAssignmentSavingTaskId] = useState<string | null>(null);
  const [pulseUserId, setPulseUserId] = useState("");
  const [pulseIdentityName, setPulseIdentityName] = useState("");
  const [showFirstVisitWelcome, setShowFirstVisitWelcome] = useState(false);
  const [helpfulHintsEnabled, setHelpfulHintsEnabled] = useState(true);
  const [showPulseHelpfulHint, setShowPulseHelpfulHint] = useState(true);
  const [onboardingProfileReviewed, setOnboardingProfileReviewed] =
    useState(false);
  const [onboardingScheduleViewed, setOnboardingScheduleViewed] =
    useState(false);
  const [showOnboardingCelebration, setShowOnboardingCelebration] =
    useState(false);
  const [pulseHelpfulHintText, setPulseHelpfulHintText] = useState(
    "Tap any upcoming task to open its task card, review property details, add private notes, and start the work.",
  );

  const updateWorkFiltersWithoutJump = (
    updater: (current: string[]) => string[],
  ) => {
    const currentScrollTop =
      document.querySelector(".mainContent")?.scrollTop ?? window.scrollY;

    setSelectedWorkFilters((current) => updater(current));

    window.requestAnimationFrame(() => {
      const mainContent = document.querySelector(".mainContent");

      if (mainContent instanceof HTMLElement) {
        mainContent.scrollTop = currentScrollTop;
      } else {
        window.scrollTo({ top: currentScrollTop, behavior: "auto" });
      }
    });
  };
  const [showTaskFilter, setShowTaskFilter] = useState(false);
  const [selectedWorkFilters, setSelectedWorkFilters] = useState<string[]>([
    "all",
  ]);
  const [showQuickTaskReport, setShowQuickTaskReport] = useState(false);
  const [reportRange, setReportRange] = useState<
    "today" | "7" | "14" | "30" | "custom"
  >("7");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportWorkFilters, setReportWorkFilters] = useState<string[]>(["all"]);
  const [reportOptions, setReportOptions] = useState({
    propertyNotes: true,
    doorCodes: true,
    wifi: true,
  });

  useEffect(() => {
    if (!taskActionMessage) return;

    const timer = window.setTimeout(() => {
      setTaskActionMessage("");
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [taskActionMessage]);

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
        .or(`cleaner_id.eq.${user.id},assigned_user_id.eq.${user.id}`)
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

  useEffect(() => {
    let cancelled = false;

    async function loadInvoicedTaskLinks() {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, reservation_id, cleaner_job_id, status, customer_name, property_name, total_cents, paid_at, created_at",
        )
        .neq("status", "void");

      if (cancelled) return;

      if (error) {
        console.error("Invoice task link load failed", error);
        return;
      }

      const loadedInvoices = data ?? [];

      setPulseInvoices(loadedInvoices);
      setInvoicedReservationIds(
        new Set(
          loadedInvoices
            .filter((invoice) => invoice.reservation_id)
            .map((invoice) => String(invoice.reservation_id)),
        ),
      );
    }

    const refreshInvoiceLinks = () => {
      void loadInvoicedTaskLinks();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshInvoiceLinks();
      }
    };

    refreshInvoiceLinks();
    window.addEventListener("focus", refreshInvoiceLinks);
    window.addEventListener("amr:invoice-created", refreshInvoiceLinks);
    window.addEventListener("amr:invoice-deleted", refreshInvoiceLinks);
    window.addEventListener("amr:invoice-voided", refreshInvoiceLinks);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshInvoiceLinks);
      window.removeEventListener("amr:invoice-created", refreshInvoiceLinks);
      window.removeEventListener("amr:invoice-deleted", refreshInvoiceLinks);
      window.removeEventListener("amr:invoice-voided", refreshInvoiceLinks);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadScheduleChangeAlerts() {
      setScheduleAlertsLoading(true);

      const { data, error } = await supabase
        .from("schedule_change_alerts")
        .select(
          "id, property_id, reservation_id, ical_uid, source, alert_type, severity, title, message, old_arrival, new_arrival, old_departure, new_departure, status, detected_at",
        )
        .in("status", ["new", "reviewed"])
        .order("severity", { ascending: true })
        .order("detected_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Schedule change alert load failed", error);
        setScheduleAlertsError(error.message);
        setScheduleAlertsLoading(false);
        return;
      }

      const orderedAlerts = (data ?? []).sort((first, second) => {
        const severityDifference =
          (first.severity === "high" ? 0 : 1) -
          (second.severity === "high" ? 0 : 1);

        if (severityDifference !== 0) return severityDifference;

        return (
          new Date(second.detected_at).getTime() -
          new Date(first.detected_at).getTime()
        );
      });

      setScheduleChangeAlerts(orderedAlerts as ScheduleChangeAlert[]);
      setScheduleAlertsError("");
      setScheduleAlertsLoading(false);
    }

    const refreshScheduleAlerts = () => {
      void loadScheduleChangeAlerts();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshScheduleAlerts();
      }
    };

    refreshScheduleAlerts();
    window.addEventListener("focus", refreshScheduleAlerts);
    window.addEventListener(
      "amr:schedule-alerts-updated",
      refreshScheduleAlerts,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshScheduleAlerts);
      window.removeEventListener(
        "amr:schedule-alerts-updated",
        refreshScheduleAlerts,
      );
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const activeCleaner =
    cleaners.find(
      (cleaner) => String(cleaner.id) === String(cleanerPortalId),
    ) ?? cleaners[0];

  const normalizedGroupRole = String(selectedGroupRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const isWorkspaceOwner = ["owner", "group_owner", "company_owner"].includes(
    normalizedGroupRole,
  );

  const canManageAssignments = [
    "owner",
    "group_owner",
    "company_owner",
    "admin",
    "administrator",
    "manager",
    "team_manager",
  ].includes(normalizedGroupRole);

  const isAssignedTeamCleaner = [
    "cleaner",
    "employee",
    "team_member",
    "member",
  ].includes(normalizedGroupRole);

  const getTaskAssignedCleanerId = (task: any) =>
    String(
      task?.assignedUserId ??
        task?.assigned_user_id ??
        task?.assignedTo ??
        task?.assigned_to ??
        "",
    );

  const getCleanerDisplayName = (cleaner: any) =>
    String(
      cleaner?.contactName ??
        cleaner?.contact_name ??
        cleaner?.fullName ??
        cleaner?.full_name ??
        cleaner?.name ??
        cleaner?.businessName ??
        cleaner?.business_name ??
        cleaner?.email ??
        "Team Member",
    ).trim();

  const getCleanerEmail = (cleaner: any) =>
    String(
      cleaner?.email ??
        cleaner?.businessEmail ??
        cleaner?.business_email ??
        cleaner?.contactEmail ??
        cleaner?.contact_email ??
        "",
    )
      .trim()
      .toLowerCase();

  const sortedUniqueCleaners: any[] = Array.from<any>(
    cleaners.reduce((unique, cleaner) => {
      const email = getCleanerEmail(cleaner);
      const id = String(cleaner?.id ?? "").trim();
      const key = email ? `email:${email}` : id ? `id:${id}` : `name:${getCleanerDisplayName(cleaner).toLowerCase()}`;

      if (!unique.has(key)) unique.set(key, cleaner);
      return unique;
    }, new Map<string, any>()).values(),
  ).sort((first, second) =>
    getCleanerDisplayName(first).localeCompare(getCleanerDisplayName(second), undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  const sortedHomes = [...homes].sort((first, second) =>
    String(first?.name ?? "").localeCompare(String(second?.name ?? ""), undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  const getAssignedCleaner = (task: any) => {
    const assignedCleanerId = getTaskAssignedCleanerId(task);
    return cleaners.find(
      (cleaner) => String(cleaner.id) === assignedCleanerId,
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPulseIdentity() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (cancelled || !user) return;

      const metadata = user.user_metadata ?? {};

     const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();

if (profileError) {
  console.error("Cleaner Pulse profile lookup failed", profileError);
}

      if (cancelled) return;

      const loggedInAccountName = String(
        profile?.contact_name ??
          profile?.display_name ??
          profile?.full_name ??
          profile?.first_name ??
          metadata.full_name ??
          metadata.name ??
          metadata.first_name ??
          "",
      ).trim();

      const emailName = String(
  profile?.business_email ??
    profile?.email ??
    user.email ??
    "",
)
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

      const looksLikeUsername =
        /\d{3,}$/.test(emailName.replace(/\s+/g, "")) ||
        (!emailName.includes(" ") && /\d/.test(emailName));

      const resolvedName =
        loggedInAccountName ||
        (looksLikeUsername ? "" : emailName);
      const welcomeKey = `amr:cleaner-pulse-welcomed:${user.id}`;
      const hintsEnabledKey = `amr:helpful-hints-enabled:${user.id}`;
      const pulseTipHiddenKey = `amr:pulse-tip-hidden:${user.id}`;
      const profileReviewedKey = `amr:onboarding-profile-reviewed:${user.id}`;
      const scheduleViewedKey = `amr:onboarding-schedule-viewed:${user.id}`;
      const helpfulTips = [
        "Tap any upcoming task to open its task card, review property details, add private notes, and start the work.",
        "Property Intelligence keeps access details, supplies, warnings, and special instructions with the task.",
        "The Back-to-Back badge helps you spot same-day guest turnovers before they become surprises.",
        "Immediate Threat highlights last-minute bookings, cancellations, extensions, and other schedule changes.",
        "Work Packets create a clean schedule you can print, save as a PDF, or share with your team.",
      ];

      setPulseUserId(user.id);
      setPulseIdentityName(resolvedName);
      setOnboardingProfileReviewed(
        window.localStorage.getItem(profileReviewedKey) === "true",
      );
      setOnboardingScheduleViewed(
        window.localStorage.getItem(scheduleViewedKey) === "true",
      );
      setPulseHelpfulHintText(
        helpfulTips[new Date().getDate() % helpfulTips.length],
      );
      setShowFirstVisitWelcome(
        !isWorkspaceOwner && window.localStorage.getItem(welcomeKey) !== "true",
      );
      setHelpfulHintsEnabled(
        window.localStorage.getItem(hintsEnabledKey) !== "false",
      );
      setShowPulseHelpfulHint(
        window.localStorage.getItem(pulseTipHiddenKey) !== "true",
      );
    }

    void loadPulseIdentity();

    return () => {
      cancelled = true;
    };
  }, [isWorkspaceOwner]);

  const markPulseWelcomeComplete = () => {
    if (pulseUserId) {
      window.localStorage.setItem(
        `amr:cleaner-pulse-welcomed:${pulseUserId}`,
        "true",
      );
    }

    setShowFirstVisitWelcome(false);
  };

  const markOnboardingScheduleViewed = () => {
    if (pulseUserId) {
      window.localStorage.setItem(
        `amr:onboarding-schedule-viewed:${pulseUserId}`,
        "true",
      );
    }
    setOnboardingScheduleViewed(true);
  };

  const openCleanerProfile = () => {
    if (pulseUserId) {
      window.localStorage.setItem(
        `amr:onboarding-profile-reviewed:${pulseUserId}`,
        "true",
      );
    }

    setOnboardingProfileReviewed(true);
    onOpenProfile();
  };

  const dismissPulseHelpfulHint = () => {
    if (pulseUserId) {
      window.localStorage.setItem(
        `amr:pulse-tip-hidden:${pulseUserId}`,
        "true",
      );
    }

    setShowPulseHelpfulHint(false);
  };

  const disableHelpfulHints = () => {
    if (pulseUserId) {
      window.localStorage.setItem(
        `amr:helpful-hints-enabled:${pulseUserId}`,
        "false",
      );
    }

    setHelpfulHintsEnabled(false);
  };

  const pulseFirstName =
    pulseIdentityName.trim().split(/\s+/)[0] || "";

  const pulseWorkspaceName = String(
    activeCleaner?.businessName ??
      activeCleaner?.business_name ??
      activeCleaner?.companyName ??
      activeCleaner?.company_name ??
      "",
  ).trim();

  const onboardingCompletedSteps =
    1 + Number(onboardingProfileReviewed) + Number(onboardingScheduleViewed);
  const onboardingProgress = Math.round((onboardingCompletedSteps / 3) * 100);

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

  const getCleanerPortalStatus = (reservation: any): CleanerPortalStatus => {
    const normalizedStatus = String(reservation.status ?? "").toLowerCase();

    if (normalizedStatus === "no clean needed") {
      return "No Clean Needed";
    }

    if (
      reservation.invoiceSent ||
      normalizedStatus.includes("invoice sent") ||
      (!reservation.isCleanerJob &&
        invoicedReservationIds.has(String(reservation.id)))
    ) {
      return "Invoiced";
    }

    if (normalizedStatus.includes("complete")) {
      return "Ready to Invoice";
    }

    if (
      normalizedStatus.includes("progress") ||
      normalizedStatus.includes("process") ||
      normalizedStatus.includes("started")
    ) {
      return "In Progress";
    }

    return "Upcoming";
  };

  const getCleanerPortalStatusClass = (status: CleanerPortalStatus) =>
    status.toLowerCase().replaceAll(" ", "-");

  const getTaskStatusLabel = (status: CleanerPortalStatus) => {
    if (status === "Ready to Invoice") {
      return isAssignedTeamCleaner ? "Completed" : "Needs Invoice";
    }

    return status;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historyStart = new Date(today);
  historyStart.setMonth(historyStart.getMonth() - 12);

  const isOwnerStay = (reservation: any) =>
    String(reservation.source ?? "").toLowerCase() === "owner block";

  const isAirbnbBlock = (reservation: any) => {
    const source = String(reservation.source ?? "").toLowerCase();
    const status = String(reservation.status ?? "").toLowerCase();
    const guestLabel = String(
      reservation.guest ??
        reservation.guestName ??
        reservation.guest_name ??
        reservation.summary ??
        reservation.title ??
        "",
    ).toLowerCase();

    return (
      source === "airbnb" &&
      (status === "blocked" || guestLabel.includes("airbnb block"))
    );
  };

  const isNoCleanNeeded = (reservation: any) =>
    String(reservation.status ?? "").toLowerCase() === "no clean needed";

  const isCleanerTurn = (reservation: any) => {
    const normalizedSource = String(reservation.source ?? "").toLowerCase();

    return (
      isImportedReservation(reservation) ||
      normalizedSource === "guest reservation" ||
      normalizedSource === "owner block" ||
      normalizedSource === "cleaning"
    );
  };

  const reservationCalendarTasks = reservations.filter((reservation) => {
    const taskDate = toLocalDate(reservation.departure);
    const normalizedStatus = String(reservation.status ?? "").toLowerCase();

    return (
      isCleanerTurn(reservation) &&
      taskDate >= historyStart &&
      (normalizedStatus !== "blocked" ||
        isOwnerStay(reservation) ||
        isAirbnbBlock(reservation))
    );
  });

  const normalizeManualJobNote = (note: unknown) =>
    String(note ?? "")
      .replaceAll("Property marked guest ready.", "Job marked complete.")
      .replaceAll("Property is not guest ready.", "Job marked complete.");

  const normalizedCalendarJobTasks = cleanerJobs
    .filter((job) => toLocalDate(job.scheduled_date) >= historyStart)
    .map((job) => {
      const linkedInvoice =
        pulseInvoices.find(
          (invoice) => String(invoice.cleaner_job_id ?? "") === String(job.id),
        ) ??
        pulseInvoices
          .filter(
            (invoice) =>
              !invoice.reservation_id &&
              String(invoice.customer_name ?? "")
                .trim()
                .toLowerCase() ===
                String(job.customer_name ?? "")
                  .trim()
                  .toLowerCase() &&
              Number(invoice.total_cents ?? 0) ===
                Number(job.amount_cents ?? 0),
          )
          .sort(
            (first, second) =>
              new Date(second.created_at).getTime() -
              new Date(first.created_at).getTime(),
          )[0];

      return {
        id: `job:${job.id}`,
        cleanerJobId: job.id,
        isCleanerJob: true,
        source: "cleaner job",
        cleanerId: job.assigned_user_id ?? "",
        cleaner_id: job.assigned_user_id ?? "",
        assignedUserId: job.assigned_user_id ?? "",
        assigned_user_id: job.assigned_user_id ?? "",
        homeId: job.property_id ?? "",
        arrival: job.scheduled_date,
        departure: job.scheduled_date,
        scheduledDate: job.scheduled_date,
        scheduledTime: job.scheduled_time ?? "",
        status:
          job.status === "in_progress"
            ? "In Progress"
            : linkedInvoice ||
                job.status === "invoiced" ||
                job.status === "paid"
              ? "Invoice Sent"
              : job.status === "completed"
                ? "Completed"
                : "Upcoming",
        invoiceSent:
          Boolean(linkedInvoice) ||
          job.status === "invoiced" ||
          job.status === "paid",
        invoiceStatus:
          linkedInvoice?.status ??
          (job.status === "paid"
            ? "paid"
            : job.status === "invoiced"
              ? "sent"
              : ""),
        invoiceId: linkedInvoice?.id ?? null,
        invoiceNumber: linkedInvoice?.invoice_number ?? "",
        invoiceTotalCents: linkedInvoice?.total_cents ?? null,
        paidAt: linkedInvoice?.paid_at ?? null,
        jobType: job.job_type,
        taskType: job.job_type,
        customerName: job.customer_name,
        customerEmail: job.customer_email ?? "",
        customerPhone: job.customer_phone ?? "",
        serviceAddress: job.service_address ?? "",
        amount: Number(job.amount_cents ?? 0) / 100,
        cleaningFee: Number(job.amount_cents ?? 0) / 100,
        notes: normalizeManualJobNote(job.notes),
        cleanerNotes: normalizeManualJobNote(job.notes),
      };
    });

  const calendarTasks = [
    ...reservationCalendarTasks.map((reservation) => {
      const linkedInvoice = pulseInvoices.find(
        (invoice) =>
          String(invoice.reservation_id ?? "") === String(reservation.id),
      );

      return {
        ...reservation,
        invoiceSent: Boolean(linkedInvoice),
        invoiceStatus: linkedInvoice?.status ?? "",
        invoiceId: linkedInvoice?.id ?? null,
        invoiceNumber: linkedInvoice?.invoice_number ?? "",
        invoiceTotalCents: linkedInvoice?.total_cents ?? null,
        paidAt: linkedInvoice?.paid_at ?? null,
      };
    }),
    ...normalizedCalendarJobTasks,
  ].sort((firstTask, secondTask) => {
    const dateDifference =
      toLocalDate(firstTask.departure).getTime() -
      toLocalDate(secondTask.departure).getTime();

    if (dateDifference !== 0) return dateDifference;

    return String(firstTask.scheduledTime ?? "").localeCompare(
      String(secondTask.scheduledTime ?? ""),
    );
  });

  const matchesSelectedWorkFilter = (task: any) => {
    if (selectedWorkFilters.includes("all")) return true;

    if (task.isCleanerJob) {
      return selectedWorkFilters.includes("manual-jobs");
    }

    return selectedWorkFilters.includes(String(task.homeId));
  };

  const filteredCalendarTasks = calendarTasks.filter(matchesSelectedWorkFilter);

  const cleanerTasks = filteredCalendarTasks.filter((task) => {
    const taskDate = toLocalDate(task.departure);
    const assignedCleanerId = getTaskAssignedCleanerId(task);
    const currentCleanerUserId = String(pulseUserId || cleanerPortalId || "");
    const visibleToCurrentCleaner =
      !isAssignedTeamCleaner ||
      assignedCleanerId === currentCleanerUserId ||
      (task.isCleanerJob &&
        String(task.cleanerOwnerId ?? task.cleaner_id ?? "") ===
          currentCleanerUserId);

    return (
      taskDate >= today &&
      getCleanerPortalStatus(task) !== "Invoiced" &&
      !isNoCleanNeeded(task) &&
      visibleToCurrentCleaner
    );
  });

  const todayTasks = cleanerTasks.filter((reservation) => {
    const departureDate = toLocalDate(reservation.departure);
    return departureDate.getTime() === today.getTime();
  });

  const inProgressTasks = cleanerTasks.filter(
    (reservation) => getCleanerPortalStatus(reservation) === "In Progress",
  );

  const readyToInvoiceTasks = cleanerTasks.filter(
    (reservation) =>
      getCleanerPortalStatus(reservation) === "Ready to Invoice" &&
      !isAssignedTeamCleaner,
  );

  const unassignedTasks = cleanerTasks.filter(
    (task) =>
      !getTaskAssignedCleanerId(task) &&
      getCleanerPortalStatus(task) === "Upcoming",
  );

  const getPulseTaskPropertyName = (task: any) => {
    const home = homes.find(
      (item) => String(item.id) === String(task.homeId),
    );

    return String(
      home?.name ??
        task?.propertyName ??
        task?.property_name ??
        task?.homeName ??
        task?.home_name ??
        task?.customerName ??
        (task?.isCleanerJob ? "Independent Job" : "Property"),
    );
  };

  const getPulseTaskAssignmentName = (task: any) => {
    const assignedCleaner = getAssignedCleaner(task);
    return assignedCleaner
      ? getCleanerDisplayName(assignedCleaner)
      : "Unassigned";
  };

  const getPulseTaskTypeName = (task: any) =>
    String(
      task.jobType ??
        task.taskType ??
        "Vacation Rental Turnover",
    );

  const comparePulseText = (first: string, second: string) =>
    first.localeCompare(second, undefined, {
      sensitivity: "base",
      numeric: true,
    });

  const comparePulseTaskDates = (first: any, second: any) => {
    const dateDifference =
      toLocalDate(first.departure).getTime() -
      toLocalDate(second.departure).getTime();

    if (dateDifference !== 0) return dateDifference;

    return String(first.scheduledTime ?? "").localeCompare(
      String(second.scheduledTime ?? ""),
    );
  };


  const getPulseDateBounds = () => {
    const start = new Date(today);
    const end = new Date(today);

    if (pulseDateRange === "all") {
      const latestTaskDate = cleanerTasks.reduce((latest, task) => {
        const taskDate = toLocalDate(
          task.departure ?? task.scheduledDate ?? task.scheduled_date,
        );
        return taskDate > latest ? taskDate : latest;
      }, new Date(today));

      return { start, end: latestTaskDate };
    }

    if (pulseDateRange === "7") end.setDate(end.getDate() + 6);
    if (pulseDateRange === "14") end.setDate(end.getDate() + 13);
    if (pulseDateRange === "30") end.setDate(end.getDate() + 29);

    if (pulseDateRange === "custom") {
      return {
        start: pulseCustomStartDate
          ? toLocalDate(pulseCustomStartDate)
          : start,
        end: pulseCustomEndDate ? toLocalDate(pulseCustomEndDate) : end,
      };
    }

    return { start, end };
  };

  const pulseDateFilterSummary =
    pulseDateRange === "all"
      ? "Date Range"
      : pulseDateRange === "today"
      ? "Today"
      : pulseDateRange === "7"
        ? "Next 7 Days"
        : pulseDateRange === "14"
          ? "Next 14 Days"
          : pulseDateRange === "30"
            ? "Next 30 Days"
            : pulseCustomStartDate && pulseCustomEndDate
              ? `${formatCleanDate(pulseCustomStartDate)}–${formatCleanDate(
                  pulseCustomEndDate,
                )}`
              : "Custom Dates";

  const togglePulseMultiFilter = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) => {
    setter((current) => {
      const withoutAll = current.filter((item) => item !== "all");
      const next = withoutAll.includes(value)
        ? withoutAll.filter((item) => item !== value)
        : [...withoutAll, value];
      return next.length === 0 ? ["all"] : next;
    });
  };

  const pulsePropertyFilterSummary = pulsePropertyFilters.includes("all")
    ? "All Properties"
    : pulsePropertyFilters.length === 1
      ? pulsePropertyFilters[0] === "manual-jobs"
        ? "Manual Jobs"
        : String(
            sortedHomes.find(
              (home) => String(home.id) === pulsePropertyFilters[0],
            )?.name ?? "1 selected",
          )
      : `${pulsePropertyFilters.length} selected`;

  const pulseAssignmentFilterSummary = pulseAssignmentFilters.includes("all")
    ? "All Assignments"
    : pulseAssignmentFilters.length === 1
      ? pulseAssignmentFilters[0] === "unassigned"
        ? "Unassigned"
        : getCleanerDisplayName(
            sortedUniqueCleaners.find(
              (cleaner) => String(cleaner.id) === pulseAssignmentFilters[0],
            ),
          )
      : `${pulseAssignmentFilters.length} selected`;

  const displayedCleanerTasks = [
    ...(canManageAssignments && showOnlyUnassignedTasks
      ? unassignedTasks
      : cleanerTasks),
  ]
    .filter((task) => {
      if (pulseDateRange === "all") return true;

      const { start, end } = getPulseDateBounds();
      const taskDate = toLocalDate(
        task.departure ?? task.scheduledDate ?? task.scheduled_date,
      );
      return taskDate >= start && taskDate <= end;
    })
    .filter((task) => {
      if (pulsePropertyFilters.includes("all")) return true;
      if (task.isCleanerJob) {
        return pulsePropertyFilters.includes("manual-jobs");
      }
      return pulsePropertyFilters.includes(String(task.homeId));
    })
    .filter((task) => {
      if (pulseAssignmentFilters.includes("all")) return true;
      const assignedCleanerId = getTaskAssignedCleanerId(task);
      if (!assignedCleanerId) {
        return pulseAssignmentFilters.includes("unassigned");
      }
      return pulseAssignmentFilters.includes(assignedCleanerId);
    })
    .sort((first, second) => {
    if (pulseTaskSort === "property-asc") {
      const result = comparePulseText(
        getPulseTaskPropertyName(first),
        getPulseTaskPropertyName(second),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "property-desc") {
      const result = comparePulseText(
        getPulseTaskPropertyName(second),
        getPulseTaskPropertyName(first),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "cleaner-asc") {
      const result = comparePulseText(
        getPulseTaskAssignmentName(first),
        getPulseTaskAssignmentName(second),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "cleaner-desc") {
      const result = comparePulseText(
        getPulseTaskAssignmentName(second),
        getPulseTaskAssignmentName(first),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "unassigned-first") {
      const assignmentDifference =
        Number(Boolean(getTaskAssignedCleanerId(first))) -
        Number(Boolean(getTaskAssignedCleanerId(second)));

      if (assignmentDifference !== 0) return assignmentDifference;

      const result = comparePulseText(
        getPulseTaskAssignmentName(first),
        getPulseTaskAssignmentName(second),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "task-asc") {
      const result = comparePulseText(
        getPulseTaskTypeName(first),
        getPulseTaskTypeName(second),
      );
      return result || comparePulseTaskDates(first, second);
    }

    if (pulseTaskSort === "task-desc") {
      const result = comparePulseText(
        getPulseTaskTypeName(second),
        getPulseTaskTypeName(first),
      );
      return result || comparePulseTaskDates(first, second);
    }

    return comparePulseTaskDates(first, second);
  });

  const createFilteredCleaningScheduleInput = (): WorkPacketInput => {
    const { start, end } = getPulseDateBounds();

    return {
      businessName: String(cleanerBusinessName),
      startDate: start,
      endDate: end,
      tasks: displayedCleanerTasks,
      homes,
      options: {
        includePropertyNotes: reportOptions.propertyNotes,
        includeDoorCodes: reportOptions.doorCodes,
        includeWifi: reportOptions.wifi,
      },
      websiteUrl: "https://www.askmyrental.com",
    };
  };

  const printFilteredCleaningSchedule = () => {
    printWorkPacket(createFilteredCleaningScheduleInput());
  };

  const getCleanerPhone = (cleaner: any) =>
    String(
      cleaner?.phone ??
        cleaner?.phoneNumber ??
        cleaner?.phone_number ??
        cleaner?.contactPhone ??
        cleaner?.contact_phone ??
        "",
    ).trim();

  const getSelectedScheduleShareCleaners = () =>
    sortedUniqueCleaners.filter((cleaner: any) =>
      scheduleShareCleanerIds.includes(String(cleaner.id)),
    );

  const openScheduleShareModal = () => {
    const explicitlyFilteredCleanerIds = pulseAssignmentFilters.filter(
      (value) => value !== "all" && value !== "unassigned",
    );
    const cleanerIdsInVisibleTasks = Array.from(
      new Set(
        displayedCleanerTasks
          .map((task) => getTaskAssignedCleanerId(task))
          .filter(Boolean),
      ),
    );

    setScheduleShareCleanerIds(
      explicitlyFilteredCleanerIds.length > 0
        ? explicitlyFilteredCleanerIds
        : cleanerIdsInVisibleTasks,
    );
    setShowScheduleShareModal(true);
  };

  const buildScheduleShareMessage = () => {
    const { start, end } = getPulseDateBounds();
    const dateLabel = `${start.toLocaleDateString()}–${end.toLocaleDateString()}`;
    const taskLines = displayedCleanerTasks.slice(0, 12).map((task) => {
      const home = homes.find(
        (item) => String(item.id) === String(task.homeId),
      );
      return `• ${formatCleanDate(task.departure)} — ${getTaskPropertyName(task, home)} — ${getPulseTaskTypeName(task)}`;
    });
    const remaining = displayedCleanerTasks.length - taskLines.length;

    return [
      `${cleanerBusinessName} cleaning schedule`,
      dateLabel,
      "",
      ...taskLines,
      remaining > 0 ? `• Plus ${remaining} more task${remaining === 1 ? "" : "s"}` : "",
      "",
      "Sent from Ask My Rental",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const emailFilteredCleaningSchedule = () => {
    const recipients = getSelectedScheduleShareCleaners()
      .map(getCleanerEmail)
      .filter(Boolean);
    if (recipients.length === 0) {
      window.alert("The selected cleaner does not have an email address saved.");
      return;
    }
    const subject = encodeURIComponent(`${cleanerBusinessName} cleaning schedule`);
    const body = encodeURIComponent(buildScheduleShareMessage());
    window.location.href = `mailto:${recipients.join(",")}?subject=${subject}&body=${body}`;
  };

  const textFilteredCleaningSchedule = () => {
    const selectedCleaners = getSelectedScheduleShareCleaners();
    if (selectedCleaners.length !== 1) {
      window.alert("Select one cleaner to open a text message.");
      return;
    }
    const phone = getCleanerPhone(selectedCleaners[0]);
    if (!phone) {
      window.alert("This cleaner does not have a phone number saved.");
      return;
    }
    const body = encodeURIComponent(buildScheduleShareMessage());
    window.location.href = `sms:${phone}?&body=${body}`;
  };

  const shareFilteredCleaningSchedule = async () => {
    await shareWorkPacket(createFilteredCleaningScheduleInput());
  };

  const focusUnassignedTasks = () => {
    setShowOnlyUnassignedTasks(true);

    window.setTimeout(() => {
      document
        .querySelector(".cleanerUpcomingCard")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  useEffect(() => {
    if (!showFirstVisitWelcome || onboardingProgress < 100) return;

    setShowOnboardingCelebration(true);
    const timer = window.setTimeout(() => {
      setShowOnboardingCelebration(false);
      markPulseWelcomeComplete();
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [showFirstVisitWelcome, onboardingProgress]);

  const isBackToBack = (reservation: any) =>
    !reservation.isCleanerJob &&
    reservations.some(
      (item) =>
        item.id !== reservation.id &&
        String(item.homeId) === String(reservation.homeId) &&
        String(item.arrival).slice(0, 10) ===
          String(reservation.departure).slice(0, 10),
    );

  const outstandingInvoices = pulseInvoices.filter((invoice) =>
    ["sent", "viewed", "overdue"].includes(String(invoice.status)),
  );

  const outstandingCents = outstandingInvoices.reduce(
    (total, invoice) => total + Number(invoice.total_cents ?? 0),
    0,
  );

  const recentPayments = pulseInvoices
    .filter((invoice) => invoice.status === "paid" && invoice.paid_at)
    .sort(
      (first, second) =>
        new Date(second.paid_at).getTime() - new Date(first.paid_at).getTime(),
    )
    .slice(0, 5);

  const focusMessage =
    canManageAssignments && unassignedTasks.length > 0
      ? `${unassignedTasks.length} ${
          unassignedTasks.length === 1 ? "task needs" : "tasks need"
        } a cleaner assignment.`
      : todayTasks.length > 0
        ? `${todayTasks.length} ${
            todayTasks.length === 1 ? "task needs" : "tasks need"
          } attention today.`
        : isAssignedTeamCleaner
          ? "Everything is caught up. Great work!"
          : readyToInvoiceTasks.length > 0
            ? `${readyToInvoiceTasks.length} completed ${
                readyToInvoiceTasks.length === 1 ? "task needs" : "tasks need"
              } ${
                readyToInvoiceTasks.length === 1
                  ? "an invoice."
                  : "invoices."
              }`
            : outstandingInvoices.length > 0
              ? `${outstandingInvoices.length} ${
                  outstandingInvoices.length === 1
                    ? "invoice is"
                    : "invoices are"
                } awaiting payment.`
              : "Everything is caught up. Great work!";

  const formatPulseMoney = (cents: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  async function updateCleanerTask(
    task: any,
    nextStatus: CleanerPortalStatus,
    note: string,
  ) {
    if (!task.isCleanerJob) {
      const reservationStatus =
        nextStatus === "Ready to Invoice"
          ? "Completed"
          : nextStatus === "In Progress"
            ? "In Process"
            : nextStatus === "Upcoming"
              ? getTaskAssignedCleanerId(task)
                ? "Accepted"
                : "Unassigned"
              : "Completed";

      const saved = await updateReservationFromCleaner(
        String(task.id),
        reservationStatus,
        note,
      );

      if (!saved) return null;

      return {
        ...task,
        status: reservationStatus,
        cleanerNotes: note || task.cleanerNotes || "",
        notes: note || task.notes || "",
      };
    }

    const statusMap: Record<CleanerPortalStatus, string> = {
      Upcoming: "upcoming",
      "In Progress": "in_progress",
      "Ready to Invoice": "completed",
      Invoiced: "invoiced",
      "No Clean Needed": "no_clean_needed",
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
      current.map((job) => (job.id === data.id ? data : job)),
    );

    return {
      ...task,
      status: nextStatus === "Ready to Invoice" ? "Completed" : nextStatus,
      notes: data.notes ?? "",
      cleanerNotes: data.notes ?? "",
      cleaningFee: Number(data.amount_cents ?? 0) / 100,
      amount: Number(data.amount_cents ?? 0) / 100,
    };
  }

  const assignTaskToCleaner = async (task: any, cleanerId: string) => {
    if (!canManageAssignments) return;

    setAssignmentSavingTaskId(String(task.id));

    try {
      if (task.isCleanerJob) {
        const { data, error } = await supabase
          .from("cleaner_jobs")
          .update({
            assigned_user_id: cleanerId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.cleanerJobId)
          .select()
          .single();

        if (error) throw error;

        setCleanerJobs((current) =>
          current.map((job) =>
            String(job.id) === String(data.id) ? data : job,
          ),
        );
      } else {
        await Promise.resolve(
          updateReservation(String(task.id), {
            assignedUserId: cleanerId || null,
            assigned_user_id: cleanerId || null,
            status:
              getCleanerPortalStatus(task) === "Upcoming"
                ? cleanerId
                  ? "Accepted"
                  : "Unassigned"
                : task.status,
          }),
        );
      }

      const assignedCleaner = cleaners.find(
        (cleaner) => String(cleaner.id) === String(cleanerId),
      );

      setSelectedCleanerTask((current: any) =>
        current && String(current.id) === String(task.id)
          ? {
              ...current,
              cleanerId: cleanerId || null,
              cleaner_id: cleanerId || null,
              assignedUserId: cleanerId || null,
              assigned_user_id: cleanerId || null,
            }
          : current,
      );

      setTaskActionMessage(
        cleanerId
          ? `Task assigned to ${getCleanerDisplayName(assignedCleaner)}.`
          : "Task returned to the unassigned queue.",
      );
    } catch (error) {
      console.error("Task assignment failed", error);
      window.alert(
        error instanceof Error ? error.message : "Unable to save assignment.",
      );
    } finally {
      setAssignmentSavingTaskId(null);
    }
  };

  const closeIssueModal = () => setShowCleanerIssueModal(false);

  const openTaskPreview = (
    taskId: string,
    openedFrom: "pulse" | "schedule" = "schedule",
  ) => {
    const matchingTask = calendarTasks.find(
      (task) => String(task.id) === String(taskId),
    );

    if (matchingTask) {
      setTaskOpenedFrom(openedFrom);
      setSelectedCleanerTask(matchingTask);
      setTaskNoteDraft(matchingTask.cleanerNotes ?? matchingTask.notes ?? "");
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
      cleanNote,
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
      taskBeingCompleted.cleanerNotes ?? taskBeingCompleted.notes ?? "",
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);
  };

  const undoTaskStart = async () => {
    if (!taskBeingCompleted) return;

    const updatedTask = await updateCleanerTask(
      taskBeingCompleted,
      "Upcoming",
      "Cleaner reset the task to not started.",
    );

    if (!updatedTask) return;

    setSelectedCleanerTask(updatedTask);
    setTaskNoteDraft(updatedTask.cleanerNotes ?? updatedTask.notes ?? "");
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
      draftSummary,
    );

    if (!updatedTask) return;

    setSelectedCleanerTask({
      ...updatedTask,
      completionDraft: draftTask.completionDraft,
    });
    setTaskNoteDraft(
      taskBeingCompleted.cleanerNotes ?? taskBeingCompleted.notes ?? "",
    );
    setTaskNoteSaved(false);
    setTaskBeingCompleted(null);

    window.alert("Draft saved. The task remains in progress.");
  };

  const finishCompletedTask = async (result: CompleteTaskResult) => {
    if (!taskBeingCompleted) return;

    const completionStatusText = taskBeingCompleted.isCleanerJob
      ? "Job marked complete."
      : result.guestReady
        ? "Property marked guest ready."
        : "Property is not guest ready.";

    const completionParts = [
      completionStatusText,
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
      result.cleaningFee ? `Cleaning fee: $${result.cleaningFee}.` : "",
      taskBeingCompleted.isCleanerJob
        ? "Independent job completed."
        : "Owner completion report queued.",
    ].filter(Boolean);

    const updatedTask = await updateCleanerTask(
      taskBeingCompleted,
      "Ready to Invoice",
      completionParts.join(" "),
    );

    if (!updatedTask) return;

    setTaskBeingCompleted(null);

    window.alert(
      taskBeingCompleted.isCleanerJob
        ? "Job completed and ready to invoice."
        : "Task completed. The owner report and invoice are ready for the next step.",
    );
  };

  const markTaskNoClean = async () => {
    if (!selectedCleanerTask || selectedCleanerTask.isCleanerJob) return;

    const taskLabel = isOwnerStay(selectedCleanerTask)
      ? "owner stay"
      : isAirbnbBlock(selectedCleanerTask)
        ? "Airbnb block"
        : "reservation";

    const saved = await updateReservationFromCleaner(
      String(selectedCleanerTask.id),
      "No Clean Needed",
      `Cleaner marked this ${taskLabel} as no cleaning needed.`,
    );

    if (!saved) return;

    setSelectedCleanerTask(null);
    setTaskNoteDraft("");
    setTaskNoteSaved(false);
    setShowCleanerCalendar(false);
    setTaskActionMessage(
      "Cleaning removed. This reservation remains on the calendar but is excluded from active schedules, work packets, reports, and invoicing.",
    );
  };

  const restoreTaskCleaning = async () => {
    if (!selectedCleanerTask || selectedCleanerTask.isCleanerJob) return;

    const restoredStatus = getTaskAssignedCleanerId(selectedCleanerTask)
      ? "Accepted"
      : "Unassigned";

    const saved = await updateReservationFromCleaner(
      String(selectedCleanerTask.id),
      restoredStatus,
      "Cleaner restored this reservation to the active cleaning schedule.",
    );

    if (!saved) return;

    setSelectedCleanerTask(null);
    setTaskNoteDraft("");
    setTaskNoteSaved(false);
    setShowCleanerCalendar(false);
    setTaskActionMessage(
      "Cleaning restored. This reservation is active again and will return to schedules, work packets, reports, and invoicing.",
    );
  };

  const selectedTaskHome = selectedCleanerTask
    ? homes.find(
        (home) => String(home.id) === String(selectedCleanerTask.homeId),
      )
    : null;

  const getTaskPropertyName = (task: any, home?: any) =>
    String(
      home?.name ??
        task?.propertyName ??
        task?.property_name ??
        task?.homeName ??
        task?.home_name ??
        task?.customerName ??
        (task?.isCleanerJob ? "Independent Job" : "Property"),
    );

  const getTaskPropertyAddress = (task: any, home?: any) =>
    String(
      home?.address ??
        home?.addressLine1 ??
        task?.propertyAddress ??
        task?.property_address ??
        task?.serviceAddress ??
        task?.service_address ??
        "",
    );

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

  const reportDateBounds = () => {
    const start = new Date(today);
    const end = new Date(today);

    if (reportRange === "7") end.setDate(end.getDate() + 6);
    if (reportRange === "14") end.setDate(end.getDate() + 13);
    if (reportRange === "30") end.setDate(end.getDate() + 29);

    if (reportRange === "custom") {
      return {
        start: reportStartDate ? toLocalDate(reportStartDate) : start,
        end: reportEndDate ? toLocalDate(reportEndDate) : end,
      };
    }

    return { start, end };
  };

  const reportTaskMatchesWork = (task: any) => {
    if (reportWorkFilters.includes("all")) return true;
    if (task.isCleanerJob) return reportWorkFilters.includes("manual-jobs");
    return reportWorkFilters.includes(String(task.homeId));
  };

  const getQuickReportTasks = () => {
    const { start, end } = reportDateBounds();
    return calendarTasks.filter((task) => {
      const taskDate = toLocalDate(
        task.departure ?? task.scheduledDate ?? task.scheduled_date,
      );
      return (
        taskDate >= start &&
        taskDate <= end &&
        reportTaskMatchesWork(task) &&
        !isNoCleanNeeded(task)
      );
    });
  };

  const cleanerBusinessName =
    activeCleaner?.businessName ??
    activeCleaner?.business_name ??
    activeCleaner?.companyName ??
    activeCleaner?.company_name ??
    activeCleaner?.name ??
    "Cleaning Service";

  const createWorkPacketInput = (): WorkPacketInput => {
    const { start, end } = reportDateBounds();

    return {
      businessName: String(cleanerBusinessName),
      startDate: start,
      endDate: end,
      tasks: getQuickReportTasks(),
      homes,
      options: {
        includePropertyNotes: reportOptions.propertyNotes,
        includeDoorCodes: reportOptions.doorCodes,
        includeWifi: reportOptions.wifi,
      },
      websiteUrl: "https://www.askmyrental.com",
    };
  };

  const getScheduleAlertProperty = (alert: ScheduleChangeAlert) =>
    homes.find((home) => String(home.id) === String(alert.property_id));

  const getScheduleAlertAffectedDate = (alert: ScheduleChangeAlert) =>
    alert.new_departure ??
    alert.old_departure ??
    alert.new_arrival ??
    alert.old_arrival ??
    "";

  const formatScheduleAlertDate = (dateKey: string | null) =>
    dateKey ? formatCleanDate(dateKey) : "—";

  const getScheduleAlertDateComparison = (alert: ScheduleChangeAlert) => {
    if (alert.old_departure || alert.new_departure) {
      return `${formatScheduleAlertDate(
        alert.old_departure,
      )} → ${formatScheduleAlertDate(alert.new_departure)}`;
    }

    if (alert.old_arrival || alert.new_arrival) {
      return `${formatScheduleAlertDate(
        alert.old_arrival,
      )} → ${formatScheduleAlertDate(alert.new_arrival)}`;
    }

    return formatScheduleAlertDate(getScheduleAlertAffectedDate(alert));
  };

  const getScheduleAlertLabel = (alertType: string) => {
    const labels: Record<string, string> = {
      last_minute_booking: "New Booking",
      cancellation: "Cancellation",
      extension: "Extended Stay",
      shortened_stay: "Shortened Stay",
      arrival_changed: "Arrival Changed",
      block_added: "Block Added",
      block_changed: "Block Changed",
      block_removed: "Block Removed",
    };

    return labels[alertType] ?? alertType.replaceAll("_", " ");
  };

  const dismissScheduleAlerts = async (alertIds: string[]) => {
    if (alertIds.length === 0) return;

    setUpdatingScheduleAlertId(alertIds[0]);

    const { error } = await supabase
      .from("schedule_change_alerts")
      .update({
        status: "dismissed",
        reviewed_at: new Date().toISOString(),
      })
      .in("id", alertIds);

    setUpdatingScheduleAlertId(null);

    if (error) {
      console.error("Schedule alert dismissal failed", error);
      window.alert(error.message);
      return;
    }

    const dismissedIds = new Set(alertIds);
    setScheduleChangeAlerts((current) =>
      current.filter((alert) => !dismissedIds.has(alert.id)),
    );
  };

  const openScheduleAlertTask = (alert: ScheduleChangeAlert) => {
    if (!alert.reservation_id) {
      window.alert(
        "This calendar change no longer has an active task to open.",
      );
      return;
    }

    const matchingTask = calendarTasks.find(
      (task) => String(task.id) === String(alert.reservation_id),
    );

    if (!matchingTask) {
      window.alert(
        "This task is no longer active on the schedule. The alert remains available for review.",
      );
      return;
    }

    setShowCleanerCalendar(false);
    openTaskPreview(String(matchingTask.id), "pulse");
  };

  const activeScheduleAlerts = scheduleChangeAlerts.filter(
    (alert) => alert.status !== "dismissed",
  );

  type DisplayScheduleAlert = {
    alert: ScheduleChangeAlert;
    relatedAlertIds: string[];
    restoredAirbnbBlock: boolean;
    displayLabel?: string;
    displayMessage?: string;
  };

  const getAlertRange = (alert: ScheduleChangeAlert) => ({
    start:
      alert.new_arrival ??
      alert.old_arrival ??
      alert.new_departure ??
      alert.old_departure ??
      "",
    end:
      alert.new_departure ??
      alert.old_departure ??
      alert.new_arrival ??
      alert.old_arrival ??
      "",
  });

  const rangesOverlap = (
    first: ReturnType<typeof getAlertRange>,
    second: ReturnType<typeof getAlertRange>,
  ) => {
    if (!first.start || !first.end || !second.start || !second.end)
      return false;
    return first.start <= second.end && second.start <= first.end;
  };

  const usedScheduleAlertIds = new Set<string>();
  const displayScheduleAlerts: DisplayScheduleAlert[] = [];

  activeScheduleAlerts.forEach((alert) => {
    if (usedScheduleAlertIds.has(alert.id)) return;

    const isAirbnbBlockChange =
      String(alert.source).toLowerCase() === "airbnb" &&
      (alert.alert_type === "block_added" ||
        alert.alert_type === "block_removed");

    if (isAirbnbBlockChange) {
      const counterpartType =
        alert.alert_type === "block_added" ? "block_removed" : "block_added";

      const counterpart = activeScheduleAlerts.find((candidate) => {
        if (
          candidate.id === alert.id ||
          usedScheduleAlertIds.has(candidate.id)
        ) {
          return false;
        }

        const detectedCloseTogether =
          Math.abs(
            new Date(candidate.detected_at).getTime() -
              new Date(alert.detected_at).getTime(),
          ) <=
          10 * 60 * 1000;

        return (
          String(candidate.source).toLowerCase() === "airbnb" &&
          candidate.alert_type === counterpartType &&
          String(candidate.property_id) === String(alert.property_id) &&
          detectedCloseTogether &&
          rangesOverlap(getAlertRange(alert), getAlertRange(candidate))
        );
      });

      if (counterpart) {
        const addedAlert =
          alert.alert_type === "block_added" ? alert : counterpart;
        const removedAlert =
          alert.alert_type === "block_removed" ? alert : counterpart;
        const addedRange = getAlertRange(addedAlert);
        const removedRange = getAlertRange(removedAlert);
        const displayStart =
          [addedRange.start, removedRange.start].filter(Boolean).sort()[0] ??
          "";
        const displayEnd =
          [addedRange.end, removedRange.end].filter(Boolean).sort().at(-1) ??
          "";

        usedScheduleAlertIds.add(alert.id);
        usedScheduleAlertIds.add(counterpart.id);

        displayScheduleAlerts.push({
          alert: addedAlert,
          relatedAlertIds: [addedAlert.id, removedAlert.id],
          restoredAirbnbBlock: true,
          displayLabel: "Airbnb Block Restored",
          displayMessage: `${getScheduleAlertProperty(addedAlert)?.name ?? "This property"}: an Airbnb block was removed and added back for ${formatCleanDate(displayStart)} to ${formatCleanDate(displayEnd)}.`,
        });
        return;
      }
    }

    usedScheduleAlertIds.add(alert.id);
    displayScheduleAlerts.push({
      alert,
      relatedAlertIds: [alert.id],
      restoredAirbnbBlock: false,
    });
  });

  displayScheduleAlerts.sort((first, second) => {
    const severityDifference =
      (first.alert.severity === "high" ? 0 : 1) -
      (second.alert.severity === "high" ? 0 : 1);

    if (severityDifference !== 0) return severityDifference;

    return (
      new Date(second.alert.detected_at).getTime() -
      new Date(first.alert.detected_at).getTime()
    );
  });

  const highScheduleAlertCount = displayScheduleAlerts.filter(
    (item) => item.alert.severity === "high",
  ).length;

  return (
    <>
      <style>{`
        .cleanerPulseShell .cleanerTaskLedgerHeader,
        .cleanerPulseShell .cleanerTaskLedgerRow {
          grid-template-columns:
            minmax(118px, 0.95fr)
            minmax(135px, 1.2fr)
            minmax(180px, 1.55fr)
            minmax(118px, 0.95fr)
            minmax(150px, 1fr);
          width: 100%;
          box-sizing: border-box;
        }

        .cleanerPulseShell .cleanerTaskLedgerAction {
          min-width: 0;
          display: flex;
          justify-content: flex-end;
        }

        .cleanerPulseShell .cleanerTaskLedgerActionButton {
          width: 100%;
          min-width: 0;
          max-width: 112px;
          min-height: 38px;
          padding: 8px 7px;
          box-sizing: border-box;
          font-size: 9.5px;
          line-height: 1.1;
          text-align: center;
          white-space: nowrap;
        }

        .cleanerTaskLedgerSortableHeader {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .cleanerTaskLedgerHeaderSort {
          width: 100%;
          min-width: 0;
          height: 30px;
          padding: 3px 24px 3px 7px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .cleanerPulseHeaderFilterWrap {
          position: relative;
          width: 100%;
        }

        .cleanerPulseHeaderFilterButton {
          width: 100%;
          min-height: 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          padding: 4px 7px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .cleanerPulseHeaderFilterMenu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 1000004;
          width: min(280px, calc(100vw - 32px));
          max-height: 330px;
          overflow-y: auto;
          padding: 10px;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22);
        }

        .cleanerPulseHeaderFilterOption {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 38px;
          padding: 8px;
          border-radius: 9px;
          color: #334155;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .cleanerPulseHeaderFilterOption:hover {
          background: #f8fafc;
        }

        .cleanerPulseDateChoices {
          display: grid;
          gap: 4px;
        }

        .cleanerPulseCustomDates {
          display: grid;
          gap: 8px;
          margin-top: 8px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
        }

        .cleanerPulseCustomDates label {
          display: grid;
          gap: 5px;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .cleanerPulseCustomDates input {
          width: 100%;
          min-height: 38px;
          padding: 7px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
        }

        .cleanerPrintScheduleButton {
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.1;
          white-space: nowrap;
        }

        .cleanerPulseHeaderFilterOption input {
          width: 16px;
          height: 16px;
          flex: 0 0 auto;
        }

        .cleanerPulseHeaderFilterFooter {
          position: sticky;
          bottom: -10px;
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding-top: 9px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .cleanerPulseHeaderFilterFooter button {
          flex: 1;
          min-height: 36px;
        }

        .cleanerMobileTaskSort {
          display: none;
        }

        .cleanerScheduleHeaderActions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }

        .cleanerScheduleShareOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000015;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.5);
        }

        .cleanerScheduleShareModal {
          width: min(560px, 100%);
          max-height: min(86vh, 720px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.3);
        }

        .cleanerScheduleShareBody {
          display: grid;
          gap: 14px;
          padding: 16px 18px;
          overflow-y: auto;
        }

        .cleanerScheduleShareList {
          display: grid;
          gap: 8px;
          max-height: 250px;
          overflow-y: auto;
        }

        .cleanerScheduleSharePerson {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          padding: 11px 12px;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
        }

        .cleanerScheduleSharePerson strong,
        .cleanerScheduleSharePerson small { display: block; }
        .cleanerScheduleSharePerson small { margin-top: 3px; color: #64748b; }

        .cleanerScheduleShareActions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          padding: 14px 18px 18px;
          border-top: 1px solid #e2e8f0;
        }

        .cleanerMobilePrintScheduleButton {
          display: none;
        }

        .cleanerUpcomingCard {
          container-type: inline-size;
          container-name: upcoming-tasks-card;
        }


        /* Switch the task ledger to its compact card layout before the
           five-column desktop grid can push Status or Action off screen. */
        @media screen and (max-width: 980px) {
          .cleanerPulseShell .cleanerTaskLedgerHeader {
            display: none !important;
          }

          .cleanerMobileTaskSort {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
          }

          .cleanerMobilePrintScheduleButton {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
            margin-bottom: 12px !important;
          }

          .cleanerMobilePrintScheduleButton button {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 44px !important;
            padding: 9px 10px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }

          .cleanerScheduleShareActions {
            grid-template-columns: 1fr !important;
          }

          .cleanerMobileTaskSort > .cleanerPulseHeaderFilterWrap {
            min-width: 0 !important;
          }

          .cleanerMobileTaskSort label {
            color: #475569 !important;
            font-size: 12px !important;
            font-weight: 800 !important;
          }

          .cleanerMobileTaskSort .cleanerPulseHeaderFilterButton {
            min-height: 42px !important;
            font-size: 12px !important;
            padding: 8px 10px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerBody {
            display: grid !important;
            gap: 10px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerRow {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            grid-template-areas:
              "property date"
              "task task"
              "status action" !important;
            gap: 8px 12px !important;
            padding: 14px !important;
            align-items: center !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerDate {
            grid-area: date !important;
            text-align: right !important;
            align-self: start !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerProperty {
            grid-area: property !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerTask {
            grid-area: task !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerStatus {
            grid-area: status !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerAction {
            grid-area: action !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            min-width: 0 !important;
            visibility: visible !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerActionButton {
            display: inline-flex !important;
            width: auto !important;
            min-width: 118px !important;
            max-width: 100% !important;
            min-height: 40px !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 9px 12px !important;
            white-space: nowrap !important;
            visibility: visible !important;
          }
        }

        /* Container-based fallback: the card may become narrow because of the
           application sidebar or docked developer tools even when the browser
           viewport is still wider than the media-query breakpoint. */
        @container upcoming-tasks-card (max-width: 860px) {
          .cleanerPulseShell .cleanerTaskLedgerHeader {
            display: none !important;
          }

          .cleanerMobileTaskSort {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
          }

          .cleanerMobilePrintScheduleButton {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
            margin-bottom: 12px !important;
          }

          .cleanerMobilePrintScheduleButton button {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 44px !important;
            padding: 9px 10px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }

          .cleanerScheduleShareActions {
            grid-template-columns: 1fr !important;
          }

          .cleanerMobileTaskSort > .cleanerPulseHeaderFilterWrap {
            min-width: 0 !important;
          }

          .cleanerMobileTaskSort label {
            color: #475569 !important;
            font-size: 12px !important;
            font-weight: 800 !important;
          }

          .cleanerMobileTaskSort .cleanerPulseHeaderFilterButton {
            min-height: 42px !important;
            font-size: 12px !important;
            padding: 8px 10px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerBody {
            display: grid !important;
            gap: 10px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerRow {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            grid-template-areas:
              "property date"
              "task task"
              "status action" !important;
            gap: 8px 12px !important;
            padding: 14px !important;
            align-items: center !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerDate {
            grid-area: date !important;
            text-align: right !important;
            align-self: start !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerProperty {
            grid-area: property !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerTask {
            grid-area: task !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerStatus {
            grid-area: status !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerAction {
            grid-area: action !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            min-width: 0 !important;
            visibility: visible !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerActionButton {
            display: inline-flex !important;
            width: auto !important;
            min-width: 118px !important;
            max-width: 100% !important;
            min-height: 40px !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 9px 12px !important;
            white-space: nowrap !important;
            visibility: visible !important;
          }
        }

        @media screen and (max-width: 700px) {
          .cleanerPulseShell .cleanerTaskLedgerHeader {
            display: none !important;
          }

          .cleanerMobileTaskSort {
            display: grid !important;
            gap: 6px !important;
            margin-bottom: 10px !important;
          }

          .cleanerMobilePrintScheduleButton {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            width: 100% !important;
            margin-bottom: 12px !important;
          }

          .cleanerMobilePrintScheduleButton button {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 44px !important;
            padding: 9px 10px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
          }

          .cleanerScheduleShareActions {
            grid-template-columns: 1fr !important;
          }

          .cleanerMobileTaskSort label {
            color: #475569 !important;
            font-size: 12px !important;
            font-weight: 800 !important;
          }

          .cleanerMobileTaskSort select {
            width: 100% !important;
            min-height: 42px !important;
            padding: 8px 34px 8px 10px !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 10px !important;
            background: #ffffff !important;
            color: #334155 !important;
            font-weight: 800 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerBody {
            display: grid !important;
            gap: 10px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerRow {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            grid-template-areas:
              "property date"
              "task task"
              "status action" !important;
            gap: 6px 12px !important;
            padding: 14px !important;
            align-items: center !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerDate {
            grid-area: date !important;
            text-align: right !important;
            align-self: start !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerDate small {
            display: none !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerProperty {
            grid-area: property !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerProperty small {
            display: none !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerTask {
            grid-area: task !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerTask small {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerStatus {
            grid-area: status !important;
            min-width: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerBadges {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerPay {
            display: none !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerAction {
            grid-area: action !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            min-width: 0 !important;
            margin: 0 !important;
          }

          .cleanerPulseShell .cleanerTaskLedgerActionButton {
            width: auto !important;
            min-width: 120px !important;
            max-width: 100% !important;
            min-height: 40px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 9px 12px !important;
            line-height: 1.1 !important;
            text-align: center !important;
            white-space: nowrap !important;
          }

          .cleanerPulseHeaderRow {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 12px !important;
          }

          .cleanerPulseNotificationButton {
            position: relative !important;
            width: 42px !important;
            height: 42px !important;
            flex: 0 0 42px !important;
            border: 1px solid #dbe3ee !important;
            border-radius: 14px !important;
            background: #ffffff !important;
            font-size: 20px !important;
          }

          .cleanerPulseNotificationBadge {
            position: absolute !important;
            top: -4px !important;
            right: -4px !important;
            min-width: 19px !important;
            height: 19px !important;
            padding: 0 5px !important;
            display: grid !important;
            place-items: center !important;
            border: 2px solid #ffffff !important;
            border-radius: 999px !important;
            background: #16a34a !important;
            color: #ffffff !important;
            font-size: 10px !important;
            font-weight: 800 !important;
          }

          .cleanerFocusGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 14px !important;
          }

          .cleanerFocusMetric {
            min-width: 0 !important;
            padding: 12px 8px !important;
            border-radius: 14px !important;
          }

          .cleanerFocusMetric strong {
            font-size: 18px !important;
          }

          .cleanerFocusMetric small {
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .cleanerNotificationSheet {
            position: fixed !important;
            inset: auto 12px 86px 12px !important;
            z-index: 1000001 !important;
            max-height: min(440px, 62vh) !important;
            overflow-y: auto !important;
          }

        }

        .cleanerFocusGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .cleanerFocusMetric {
          display: grid;
          place-items: center;
          gap: 4px;
          min-height: 76px;
          padding: 14px 12px;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          background: #ffffff;
          color: #1f2937;
          text-align: center;
          cursor: pointer;
        }

        .cleanerFocusMetric strong {
          font-size: 23px;
          line-height: 1;
        }

        .cleanerFocusMetric small {
          color: #64748b;
          font-weight: 750;
        }

        .cleanerFocusMetric.ready {
          background: #effaf4;
          border-color: #bde8ce;
        }

        .cleanerFocusMetric.outstanding {
          background: #fff8eb;
          border-color: #f3d8a5;
        }

        .cleanerAssignmentSelect {
          width: 100%;
          max-width: 230px;
          min-height: 36px;
          margin-top: 6px;
          padding: 6px 30px 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: #ffffff;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .cleanerAssignmentSelect.unassigned {
          border-color: #fca5a5;
          background: #fff1f2;
          color: #b91c1c;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.08);
        }

        .cleanerAssignmentSelect:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .cleanerNeedsAssignmentCard {
          border-color: #fecaca;
          background: #fff7f7;
        }

        .cleanerNeedsAssignmentCard .cleanerActionIcon {
          background: #fee2e2;
          color: #b91c1c;
        }

        .cleanerUnassignedFilterBanner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          padding: 10px 12px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff7f7;
          color: #991b1b;
          font-size: 13px;
          font-weight: 800;
        }

        @media screen and (max-width: 700px) {
          .cleanerAssignmentSelect {
            max-width: 100%;
          }

          .cleanerUnassignedFilterBanner {
            align-items: stretch;
            flex-direction: column;
          }

          .cleanerUnassignedFilterBanner button {
            width: 100%;
          }
        }

        .cleanerPulseHeaderRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .cleanerPulseNotificationButton {
          position: relative;
          width: 46px;
          height: 46px;
          border: 1px solid #dbe3ee;
          border-radius: 15px;
          background: #ffffff;
          cursor: pointer;
        }

        .cleanerPulseNotificationBadge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          display: grid;
          place-items: center;
          border: 2px solid #ffffff;
          border-radius: 999px;
          background: #16a34a;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
        }

        .cleanerNotificationSheet {
          position: fixed;
          top: 92px;
          right: 24px;
          z-index: 1000001;
          width: min(390px, calc(100vw - 32px));
          max-height: 520px;
          overflow-y: auto;
          padding: 18px;
          border: 1px solid #dbe3ee;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.2);
        }

        .cleanerNotificationItem {
          width: 100%;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 12px 0;
          border: 0;
          border-bottom: 1px solid #e5e7eb;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .cleanerNotificationItem:last-child {
          border-bottom: 0;
        }

        .cleanerNotificationItem strong,
        .cleanerNotificationItem small {
          display: block;
        }

        .cleanerNotificationAmount {
          color: #16844a;
          font-weight: 850;
        }

        .cleanerJobScheduleDate {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 750;
        }

        .cleanerTodayTaskOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000002;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.48);
        }

        .cleanerTodayTaskSheet {
          width: min(560px, 100%);
          max-height: min(72vh, 680px);
          overflow: auto;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        }

        .cleanerTodayTaskHeader {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          padding: 18px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .cleanerTodayTaskHeader h3 {
          margin: 0;
        }

        .cleanerTodayTaskList {
          display: grid;
          gap: 10px;
          padding: 16px;
        }

        .cleanerTodayTaskItem {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
        }

        .cleanerTodayTaskItem:hover {
          border-color: #93c5fd;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }

        .cleanerTodayTaskCopy {
          min-width: 0;
        }

        .cleanerTodayTaskCopy strong,
        .cleanerTodayTaskCopy small {
          display: block;
        }

        .cleanerTodayTaskCopy small {
          margin-top: 4px;
          color: #64748b;
        }

        .cleanerScheduleFilterBar {
          display: flex;
          justify-content: flex-end;
          margin: 0 0 14px;
        }

        .cleanerScheduleFilterBar .cleanerWorkFilterWrap {
          width: min(320px, 100%);
        }

        .cleanerWorkFilterWrap {
          position: relative;
          display: flex;
          overflow-anchor: none;
          justify-content: flex-end;
          margin: 0 0 14px;
        }

        .cleanerWorkFilterButton {
          min-width: 190px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
          background: #ffffff;
          color: #1f2937;
          font-weight: 800;
          cursor: pointer;
        }

        .cleanerWorkFilterMenu {
          position: fixed;
          top: 96px;
          right: 24px;
          z-index: 1000003;
          width: min(320px, calc(100vw - 32px));
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          overscroll-behavior: contain;
          overflow-anchor: none;
          padding: 12px;
          border: 1px solid #dbe3ee;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22);
        }

        .cleanerWorkFilterOption {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 8px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .cleanerWorkFilterOption:hover {
          background: #f8fafc;
        }

        .cleanerWorkFilterOption input {
          width: 16px;
          height: 16px;
        }

        .cleanerWorkFilterDivider {
          height: 1px;
          margin: 6px 0;
          background: #e5e7eb;
        }

        .cleanerWorkFilterSummary {
          margin-right: auto;
          color: #64748b;
          font-size: 12px;
          font-weight: 750;
        }

        .cleanerWorkFilterFooter {
          position: sticky;
          bottom: -12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .cleanerWorkFilterFooter button {
          flex: 1;
          min-height: 38px;
        }

        .cleanerScheduleActionBar {
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          gap: 10px;
          margin: 0 0 14px;
        }

        .cleanerQuickReportButton {
          min-height: 42px;
          white-space: nowrap;
        }

        .cleanerQuickReportOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000006;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.5);
        }

        .cleanerQuickReportModal {
          width: min(620px, 100%);
          max-height: min(88vh, 760px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        }

        .cleanerQuickReportBody {
          display: grid;
          gap: 14px;
          padding: 14px 18px;
          overflow-y: auto;
        }

        .cleanerQuickReportGroup {
          display: grid;
          gap: 10px;
        }

        .cleanerQuickReportGroup > strong {
          color: #0f172a;
        }

        .cleanerQuickReportChoices {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .cleanerQuickReportChoice {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          padding: 8px 10px;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
          background: #ffffff;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.2;
        }

        .cleanerQuickReportChoice input {
          width: 15px;
          height: 15px;
          flex: 0 0 auto;
        }

        .cleanerQuickReportWorkList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
          max-height: 190px;
          overflow-y: auto;
          padding: 2px;
        }

        .cleanerQuickReportDates {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cleanerQuickReportDates label {
          display: grid;
          gap: 6px;
          color: #475569;
          font-size: 12px;
          font-weight: 750;
        }

        .cleanerQuickReportDates input {
          min-height: 42px;
          padding: 8px 10px;
          border: 1px solid #dbe3ee;
          border-radius: 10px;
        }

        .cleanerQuickReportSummary {
          padding: 12px;
          border-radius: 12px;
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
        }

        .cleanerQuickReportActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 12px 18px 16px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .cleanerTaskActionToastOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000010;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.2);
          pointer-events: none;
        }

        .cleanerTaskActionToast {
          width: min(520px, calc(100vw - 36px));
          padding: 24px 26px;
          border: 1px solid #bbf7d0;
          border-radius: 22px;
          background: #f0fdf4;
          color: #166534;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
          text-align: center;
          font-size: 16px;
          font-weight: 750;
          line-height: 1.5;
          pointer-events: auto;
        }

        .cleanerTaskActionToastIcon {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          margin: 0 auto 12px;
          border-radius: 999px;
          background: #dcfce7;
          font-size: 24px;
        }

        @media screen and (max-width: 700px) {
          .cleanerTaskActionToast {
            width: min(92vw, 500px);
            padding: 21px 18px;
            font-size: 15px;
          }
        }

        .cleanerWelcomeCard {
          display: grid;
          gap: 16px;
          margin-bottom: 18px;
          padding: 20px;
          border: 1px solid #bfdbfe;
          border-radius: 20px;
          background: linear-gradient(135deg, #eff6ff 0%, #ffffff 72%);
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
        }

        .cleanerWelcomeCardHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .cleanerWelcomeCardHeader h3 {
          margin: 2px 0 5px;
        }

        .cleanerWelcomeChecklist {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .cleanerWelcomeStep {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          min-width: 0;
          padding: 12px;
          border: 1px solid #dbeafe;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.86);
        }

        .cleanerWelcomeStep span {
          flex: 0 0 auto;
        }

        .cleanerWelcomeStep strong,
        .cleanerWelcomeStep small {
          display: block;
        }

        .cleanerWelcomeStep small {
          margin-top: 3px;
          color: #64748b;
          line-height: 1.35;
        }

        .cleanerWelcomeActions {
          display: flex;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
        }

        .cleanerWelcomeProgress {
          display: grid;
          gap: 7px;
        }

        .cleanerWelcomeProgressMeta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
        }

        .cleanerWelcomeProgressTrack {
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: #dbeafe;
        }

        .cleanerWelcomeProgressFill {
          height: 100%;
          border-radius: inherit;
          background: #2563eb;
          transition: width 240ms ease;
        }

        .cleanerWelcomeStep.interactive {
          width: 100%;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .cleanerWelcomeStep.interactive:hover {
          border-color: #93c5fd;
          box-shadow: 0 10px 26px rgba(37, 99, 235, 0.11);
          transform: translateY(-1px);
        }

        .cleanerOnboardingCelebrationOverlay {
          position: fixed;
          inset: 0;
          z-index: 1000012;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.45);
        }

        .cleanerOnboardingCelebration {
          width: min(520px, 100%);
          padding: 34px 28px;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.3);
          text-align: center;
        }

        .cleanerOnboardingCelebrationIcon {
          display: block;
          margin-bottom: 10px;
          font-size: 46px;
        }

        .cleanerOnboardingCelebration h3 {
          margin: 0 0 8px;
        }

        .cleanerOnboardingCelebration p {
          margin: 0;
          color: #475569;
          line-height: 1.55;
        }

        .cleanerHelpfulHintCard {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
          margin-bottom: 18px;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #f8fafc;
        }

        .cleanerHelpfulHintCard strong,
        .cleanerHelpfulHintCard p {
          display: block;
          margin: 0;
        }

        .cleanerHelpfulHintCard p {
          margin-top: 3px;
          color: #475569;
          line-height: 1.4;
        }

        .cleanerHelpfulHintActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cleanerHelpfulHintActions button {
          min-height: 34px;
          white-space: nowrap;
        }

        @media screen and (max-width: 700px) {
          .cleanerWelcomeChecklist {
            grid-template-columns: 1fr;
          }

          .cleanerWelcomeActions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .cleanerWelcomeActions button {
            width: 100%;
          }

          .cleanerHelpfulHintCard {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .cleanerHelpfulHintActions {
            grid-column: 1 / -1;
            justify-content: flex-end;
          }
        }

        .cleanerImmediateThreatCard {
          margin-bottom: 18px;
          border: 1px solid #fecaca;
          background: linear-gradient(180deg, #fff7f7 0%, #ffffff 100%);
        }

        .cleanerImmediateThreatHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .cleanerImmediateThreatHeader h3 {
          margin: 2px 0 4px;
        }

        .cleanerImmediateThreatCount {
          min-width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #b91c1c;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
        }

        .cleanerImmediateThreatList {
          display: grid;
          gap: 10px;
        }

        .cleanerImmediateThreatItem {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: start;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #ffffff;
        }

        .cleanerImmediateThreatItem.high {
          border-left: 5px solid #dc2626;
        }

        .cleanerImmediateThreatItem.normal {
          border-left: 5px solid #f59e0b;
        }

        .cleanerImmediateThreatBadge {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cleanerImmediateThreatBadge.high {
          background: #fee2e2;
          color: #991b1b;
        }

        .cleanerImmediateThreatBadge.normal {
          background: #fef3c7;
          color: #92400e;
        }

        .cleanerImmediateThreatCopy {
          min-width: 0;
        }

        .cleanerImmediateThreatCopy strong,
        .cleanerImmediateThreatCopy small {
          display: block;
        }

        .cleanerImmediateThreatCopy p {
          margin: 5px 0 8px;
          color: #475569;
          line-height: 1.4;
        }

        .cleanerImmediateThreatMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: #64748b;
          font-size: 12px;
          font-weight: 750;
        }

        .cleanerImmediateThreatActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .cleanerImmediateThreatActions button {
          min-height: 36px;
          white-space: nowrap;
        }

        @media screen and (max-width: 700px) {
          .cleanerImmediateThreatItem {
            grid-template-columns: 1fr;
          }

          .cleanerImmediateThreatActions {
            justify-content: stretch;
          }

          .cleanerImmediateThreatActions button {
            flex: 1;
          }

          .cleanerWorkFilterWrap {
            justify-content: stretch;
          }

          .cleanerWorkFilterButton {
            width: 100%;
          }

          .cleanerScheduleActionBar {
            display: grid;
            grid-template-columns: 1fr;
          }

          .cleanerQuickReportButton {
            width: 100%;
          }

          .cleanerQuickReportChoices {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cleanerQuickReportWorkList,
          .cleanerQuickReportDates {
            grid-template-columns: 1fr;
          }

          .cleanerQuickReportModal {
            width: min(94vw, 520px);
            max-height: 86vh;
          }

          .cleanerQuickReportBody {
            gap: 12px;
            padding: 12px 14px;
          }

          .cleanerQuickReportChoice {
            min-height: 36px;
            padding: 7px 9px;
            font-size: 12px;
          }

          .cleanerQuickReportActions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 10px 14px 14px;
          }

          .cleanerWorkFilterMenu {
            top: 76px;
            right: 12px;
            left: 12px;
            width: auto;
            max-height: calc(100vh - 170px);
          }
        }
      `}</style>

      {taskActionMessage && (
        <div className="cleanerTaskActionToastOverlay">
          <div
            className="cleanerTaskActionToast"
            role="status"
            aria-live="polite"
          >
            <span className="cleanerTaskActionToastIcon" aria-hidden="true">
              ✓
            </span>
            {taskActionMessage}
          </div>
        </div>
      )}

      {showOnboardingCelebration && (
        <div
          className="cleanerOnboardingCelebrationOverlay"
          role="status"
          aria-live="polite"
        >
          <section className="cleanerOnboardingCelebration">
            <span
              className="cleanerOnboardingCelebrationIcon"
              aria-hidden="true"
            >
              🎉
            </span>
            <h3>You’re all set!</h3>
            <p>
              Welcome to the team. You’re ready to receive assignments, complete
              cleanings, and get paid.
              <br />
              Loading your dashboard…
            </p>
          </section>
        </div>
      )}

      <header className="pageHeader cleanerPortalHero cleanerCommandHero">
        <div className="cleanerPulseHeaderRow">
          <div className="cleanerCommandIntro">
            <p className="eyebrow">Cleaner Pulse</p>

            <h2>
              {showFirstVisitWelcome
                ? pulseFirstName
                  ? `Welcome, ${pulseFirstName}`
                  : "Welcome"
                : pulseFirstName
                  ? `Welcome back, ${pulseFirstName}`
                  : "Welcome back"}{" "}
              👋
            </h2>

            <p className="headerSubtext">
              {showFirstVisitWelcome
                ? pulseWorkspaceName
                  ? `You’ve joined ${pulseWorkspaceName}. Let’s get you familiar with your new workspace.`
                  : "Welcome to AMR. Let’s get you familiar with your new workspace."
                : focusMessage}
            </p>
          </div>

          {!isAssignedTeamCleaner && (
            <button
              type="button"
              className="cleanerPulseNotificationButton"
              aria-label="Open payment notifications"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications((current) => !current)}
            >
              🔔
              {recentPayments.length > 0 && (
                <span className="cleanerPulseNotificationBadge">
                  {recentPayments.length}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {!isAssignedTeamCleaner && showNotifications && (
        <>
          <button
            type="button"
            className="modalOverlay"
            aria-label="Close notifications"
            onClick={() => setShowNotifications(false)}
          />

          <section
            className="cleanerNotificationSheet"
            aria-label="Recent payment notifications"
          >
            <div className="operationsCardHeader">
              <div>
                <p className="eyebrow">Notifications</p>
                <h3>Recent Payments</h3>
              </div>

              <button
                type="button"
                className="cleanerScheduleClose"
                onClick={() => setShowNotifications(false)}
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div className="emptyStateCard">
                <strong>No recent payments</strong>
                <p>New payments will appear here.</p>
              </div>
            ) : (
              recentPayments.map((invoice) => (
                <button
                  type="button"
                  className="cleanerNotificationItem"
                  key={invoice.id}
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenInvoicesFilter("paid");
                  }}
                >
                  <span aria-hidden="true">💰</span>
                  <span>
                    <strong>✅ Payment received</strong>
                    <small>
                      {invoice.customer_name ||
                        invoice.property_name ||
                        invoice.invoice_number}
                    </small>
                  </span>
                  <span className="cleanerNotificationAmount">
                    +{formatPulseMoney(Number(invoice.total_cents ?? 0))}
                  </span>
                </button>
              ))
            )}
          </section>
        </>
      )}

      <main className="cleanerPulseShell">
        {showFirstVisitWelcome && (
          <section className="cleanerWelcomeCard" aria-label="Welcome to AMR">
            <div className="cleanerWelcomeCardHeader">
              <div>
                <p className="eyebrow">Getting Started</p>
                <h3>🎉 Welcome to the Team</h3>
                <p>
                  {pulseWorkspaceName
                    ? `You’re officially part of ${pulseWorkspaceName}. AMR is where you’ll receive assignments, view your schedule, complete tasks, and stay connected with your team.`
                    : "You’re officially part of the team. AMR is where you’ll receive assignments, view your schedule, complete tasks, and stay connected."}
                </p>
              </div>
            </div>

            <div
              className="cleanerWelcomeProgress"
              aria-label={`${onboardingProgress}% complete`}
            >
              <div className="cleanerWelcomeProgressMeta">
                <span>{onboardingCompletedSteps} of 3 steps complete</span>
                <span>{onboardingProgress}%</span>
              </div>
              <div className="cleanerWelcomeProgressTrack">
                <div
                  className="cleanerWelcomeProgressFill"
                  style={{ width: `${onboardingProgress}%` }}
                />
              </div>
            </div>

            <div className="cleanerWelcomeChecklist">
              <div className="cleanerWelcomeStep">
                <span aria-hidden="true">✅</span>
                <div>
                  <strong>You’re connected</strong>
                  <small>
                    You successfully joined the correct cleaning team.
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="cleanerWelcomeStep interactive"
                onClick={openCleanerProfile}
              >
                <span aria-hidden="true">
                  {onboardingProfileReviewed ? "✅" : "👤"}
                </span>
                <div>
                  <strong>
                    {onboardingProfileReviewed
                      ? "Profile reviewed"
                      : "Tell your team who you are"}
                  </strong>
                  <small>
                    Confirm your name and contact information. No payment setup required. Open Profile →
                  </small>
                </div>
              </button>

              <button
                type="button"
                className="cleanerWelcomeStep interactive"
                onClick={() => {
                  markOnboardingScheduleViewed();
                  setShowCleanerCalendar(true);
                }}
              >
                <span aria-hidden="true">
                  {onboardingScheduleViewed ? "✅" : "🗓️"}
                </span>
                <div>
                  <strong>
                    {onboardingScheduleViewed
                      ? "Schedule viewed"
                      : "See your upcoming work"}
                  </strong>
                  <small>
                    Open your schedule and tap a task to see the details. Open
                    Schedule →
                  </small>
                </div>
              </button>
            </div>

            <div className="cleanerWelcomeActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={markPulseWelcomeComplete}
              >
                Skip for Now
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  markOnboardingScheduleViewed();
                  setShowCleanerCalendar(true);
                }}
              >
                View My Schedule
              </button>
            </div>
          </section>
        )}

        {!showFirstVisitWelcome &&
          helpfulHintsEnabled &&
          showPulseHelpfulHint && (
            <aside
              className="cleanerHelpfulHintCard"
              aria-label="AMR helpful hint"
            >
              <span aria-hidden="true">💡</span>
              <div>
                <strong>AMR Tip</strong>
                <p>{pulseHelpfulHintText}</p>
              </div>
              <div className="cleanerHelpfulHintActions">
                <button
                  type="button"
                  className="ghostButton"
                  onClick={disableHelpfulHints}
                >
                  Turn Off Tips
                </button>
                <button
                  type="button"
                  className="cleanerScheduleClose"
                  aria-label="Hide this helpful hint"
                  onClick={dismissPulseHelpfulHint}
                >
                  ✕
                </button>
              </div>
            </aside>
          )}

        {jobsLoadingError && (
          <section className="emptyStateCard">
            <strong>Independent jobs could not be loaded</strong>
            <p>{jobsLoadingError}</p>
          </section>
        )}

        {(scheduleAlertsLoading ||
          scheduleAlertsError ||
          displayScheduleAlerts.length > 0) && (
          <section className="reservationWorkspaceCard cleanerImmediateThreatCard">
            <div className="cleanerImmediateThreatHeader">
              <div>
                <p className="eyebrow">Immediate Threat</p>
                <h3>Schedule Changes</h3>
                <p>
                  {highScheduleAlertCount > 0
                    ? `${highScheduleAlertCount} high-priority schedule ${
                        highScheduleAlertCount === 1
                          ? "change needs"
                          : "changes need"
                      } attention.`
                    : "Review recent calendar changes that could affect upcoming work."}
                </p>
              </div>

              {displayScheduleAlerts.length > 0 && (
                <span className="cleanerImmediateThreatCount">
                  {displayScheduleAlerts.length}
                </span>
              )}
            </div>

            {scheduleAlertsLoading ? (
              <div className="emptyStateCard">
                <strong>Checking schedule changes…</strong>
              </div>
            ) : scheduleAlertsError ? (
              <div className="emptyStateCard">
                <strong>Schedule alerts could not be loaded</strong>
                <p>{scheduleAlertsError}</p>
              </div>
            ) : (
              <div className="cleanerImmediateThreatList">
                {displayScheduleAlerts.map((displayItem) => {
                  const alert = displayItem.alert;
                  const property = getScheduleAlertProperty(alert);
                  const canOpenTask =
                    Boolean(alert.reservation_id) &&
                    calendarTasks.some(
                      (task) =>
                        String(task.id) === String(alert.reservation_id),
                    );

                  return (
                    <article
                      className={`cleanerImmediateThreatItem ${
                        alert.severity === "high" ? "high" : "normal"
                      }`}
                      key={alert.id}
                    >
                      <span
                        className={`cleanerImmediateThreatBadge ${
                          alert.severity === "high" ? "high" : "normal"
                        }`}
                      >
                        {alert.severity === "high" ? "High" : "Normal"}
                      </span>

                      <div className="cleanerImmediateThreatCopy">
                        <strong>
                          {displayItem.displayLabel ??
                            getScheduleAlertLabel(alert.alert_type)}{" "}
                          · {property?.name ?? "Unknown Property"}
                        </strong>
                        <p>{displayItem.displayMessage ?? alert.message}</p>
                        <div className="cleanerImmediateThreatMeta">
                          <span>
                            📅{" "}
                            {displayItem.restoredAirbnbBlock
                              ? formatScheduleAlertDate(
                                  getScheduleAlertAffectedDate(alert),
                                )
                              : getScheduleAlertDateComparison(alert)}
                          </span>
                          <span>Source: {alert.source}</span>
                        </div>

                        {!canOpenTask && (
                          <p
                            style={{
                              margin: "10px 0 0",
                              color: "#475569",
                              fontSize: "13px",
                              fontWeight: 750,
                            }}
                          >
                            <strong>Next step:</strong> Make sure your team has
                            the updated schedule.
                          </p>
                        )}
                      </div>

                      <div className="cleanerImmediateThreatActions">
                        {canOpenTask && (
                          <button
                            type="button"
                            className="primaryButton"
                            onClick={() => openScheduleAlertTask(alert)}
                          >
                            Open Task
                          </button>
                        )}

                        <button
                          type="button"
                          className="ghostButton"
                          disabled={displayItem.relatedAlertIds.includes(
                            updatingScheduleAlertId ?? "",
                          )}
                          onClick={() =>
                            void dismissScheduleAlerts(
                              displayItem.relatedAlertIds,
                            )
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section
          className="cleanerFocusGrid"
          aria-label="Today's focus"
          style={{
            gridTemplateColumns: isAssignedTeamCleaner
              ? "minmax(0, 1fr)"
              : undefined,
          }}
        >
          <button
            type="button"
            className="cleanerFocusMetric"
            disabled={todayTasks.length === 0}
            onClick={() => {
              if (todayTasks.length === 1) {
                setShowCleanerCalendar(false);
                openTaskPreview(String(todayTasks[0].id), "pulse");
                return;
              }

              if (todayTasks.length > 1) {
                setShowTodayTaskList(true);
              }
            }}
          >
            <strong>{todayTasks.length}</strong>
            <small>Today</small>
          </button>

          {!isAssignedTeamCleaner && (
          <button
            type="button"
            className="cleanerFocusMetric ready"
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
            <small>Invoice</small>
          </button>
          )}

          {!isAssignedTeamCleaner && (
          <button
            type="button"
            className="cleanerFocusMetric outstanding"
            onClick={() => onOpenInvoicesFilter("outstanding")}
          >
            <strong>{formatPulseMoney(outstandingCents)}</strong>
            <small>Awaiting Payment</small>
          </button>
          )}
        </section>

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
                  <strong>Today&apos;s Schedule</strong>
                  <p>{todayTasks.length} tasks need attention today.</p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  disabled={todayTasks.length === 0}
                  onClick={() => {
                    if (todayTasks.length === 1) {
                      setShowCleanerCalendar(false);
                      openTaskPreview(String(todayTasks[0].id), "pulse");
                      return;
                    }

                    if (todayTasks.length > 1) {
                      setShowTodayTaskList(true);
                    }
                  }}
                >
                  Review
                </button>
              </article>

              <article className="cleanerActionCard active">
                <div className="cleanerActionIcon">⏳</div>

                <div>
                  <strong>In Progress</strong>
                  <p>
                    {inProgressTasks.length} tasks are currently in progress.
                  </p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  disabled={inProgressTasks.length === 0}
                  onClick={() => {
                    if (inProgressTasks.length === 1) {
                      setShowCleanerCalendar(false);
                      openTaskPreview(String(inProgressTasks[0].id), "pulse");
                      return;
                    }

                    if (inProgressTasks.length > 1) {
                      setShowInProgressTaskList(true);
                    }
                  }}
                >
                  Continue
                </button>
              </article>


              {canManageAssignments && (
                <article className="cleanerActionCard cleanerNeedsAssignmentCard">
                  <div className="cleanerActionIcon">⚠️</div>

                  <div>
                    <strong>Needs Assignment</strong>
                    <p>
                      {unassignedTasks.length}{" "}
                      {unassignedTasks.length === 1 ? "task is" : "tasks are"}{" "}
                      waiting for a cleaner.
                    </p>
                  </div>

                  <button
                    className="primaryButton"
                    type="button"
                    disabled={unassignedTasks.length === 0}
                    onClick={focusUnassignedTasks}
                  >
                    Review
                  </button>
                </article>
              )}

              {!isAssignedTeamCleaner && (
              <article className="cleanerActionCard money">
                <div className="cleanerActionIcon">💵</div>

                <div>
                  <strong>Needs Invoice</strong>
                  <p>
                    {readyToInvoiceTasks.length} completed{" "}
                    {readyToInvoiceTasks.length === 1
                      ? "task needs"
                      : "tasks need"}{" "}
                    {readyToInvoiceTasks.length === 1
                      ? "an invoice."
                      : "invoices."}
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
                    : "Create Invoices"}
                </button>
              </article>
              )}

              <article className="cleanerActionCard schedule">
                <div className="cleanerActionIcon">🗓️</div>

                <div>
                  <strong>Today&apos;s Work Packet</strong>
                  <p>
                    Build a printable or shareable packet for selected work and
                    dates.
                  </p>
                </div>

                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => {
                    setReportWorkFilters([...selectedWorkFilters]);
                    setShowQuickTaskReport(true);
                  }}
                >
                  Create
                </button>
              </article>
            </div>
          </article>

          <article className="reservationWorkspaceCard cleanerUpcomingCard">
            <div className="operationsCardHeader">
              <div>
                <p className="eyebrow">Tasks</p>
                <h3>Upcoming Tasks &amp; Assignments</h3>
              </div>
            </div>

            {canManageAssignments && showOnlyUnassignedTasks && (
              <div className="cleanerUnassignedFilterBanner">
                <span>
                  🔴 Showing {unassignedTasks.length} unassigned{" "}
                  {unassignedTasks.length === 1 ? "task" : "tasks"}
                </span>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => setShowOnlyUnassignedTasks(false)}
                >
                  Show All Tasks
                </button>
              </div>
            )}

            <div className="cleanerMobileTaskSort">
              <div className="cleanerPulseHeaderFilterWrap">
                <label>Date Range</label>
                <button
                  type="button"
                  className="cleanerPulseHeaderFilterButton"
                  aria-expanded={showPulseDateFilter}
                  onClick={() => {
                    setShowPulseDateFilter((current) => !current);
                    setShowPulsePropertyFilter(false);
                    setShowPulseAssignmentFilter(false);
                  }}
                >
                  <span>{pulseDateFilterSummary}</span><span>▾</span>
                </button>
                {showPulseDateFilter && (
                  <div className="cleanerPulseHeaderFilterMenu">
                    <div className="cleanerPulseDateChoices">
                      {[
                        ["all", "All Upcoming Tasks"],
                        ["today", "Today"],
                        ["7", "Next 7 Days"],
                        ["14", "Next 14 Days"],
                        ["30", "Next 30 Days"],
                        ["custom", "Custom Dates"],
                      ].map(([value, label]) => (
                        <label className="cleanerPulseHeaderFilterOption" key={value}>
                          <input
                            type="radio"
                            name="pulse-mobile-date-range"
                            checked={pulseDateRange === value}
                            onChange={() => setPulseDateRange(value as typeof pulseDateRange)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    {pulseDateRange === "custom" && (
                      <div className="cleanerPulseCustomDates">
                        <label>Start date<input type="date" value={pulseCustomStartDate} onChange={(event) => setPulseCustomStartDate(event.target.value)} /></label>
                        <label>End date<input type="date" value={pulseCustomEndDate} onChange={(event) => setPulseCustomEndDate(event.target.value)} /></label>
                      </div>
                    )}
                    <div className="cleanerPulseHeaderFilterFooter">
                      <button type="button" className="primaryButton" onClick={() => setShowPulseDateFilter(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="cleanerPulseHeaderFilterWrap">
                <label>Property</label>
                <button
                  type="button"
                  className="cleanerPulseHeaderFilterButton"
                  aria-expanded={showPulsePropertyFilter}
                  onClick={() => {
                    setShowPulsePropertyFilter((current) => !current);
                    setShowPulseDateFilter(false);
                    setShowPulseAssignmentFilter(false);
                  }}
                >
                  <span>{pulsePropertyFilterSummary}</span><span>▾</span>
                </button>
                {showPulsePropertyFilter && (
                  <div className="cleanerPulseHeaderFilterMenu">
                    <label className="cleanerPulseHeaderFilterOption">
                      <input type="checkbox" checked={pulsePropertyFilters.includes("all")} onChange={() => setPulsePropertyFilters(["all"])} />
                      <span>All Properties</span>
                    </label>
                    {sortedHomes.map((home) => {
                      const value = String(home.id);
                      return (
                        <label className="cleanerPulseHeaderFilterOption" key={value}>
                          <input type="checkbox" checked={pulsePropertyFilters.includes(value)} onChange={() => togglePulseMultiFilter(value, setPulsePropertyFilters)} />
                          <span>{home.name}</span>
                        </label>
                      );
                    })}
                    <label className="cleanerPulseHeaderFilterOption">
                      <input type="checkbox" checked={pulsePropertyFilters.includes("manual-jobs")} onChange={() => togglePulseMultiFilter("manual-jobs", setPulsePropertyFilters)} />
                      <span>Manual Jobs</span>
                    </label>
                    <div className="cleanerPulseHeaderFilterFooter">
                      <button type="button" className="secondaryButton" onClick={() => setPulsePropertyFilters(["all"])}>Reset</button>
                      <button type="button" className="primaryButton" onClick={() => setShowPulsePropertyFilter(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="cleanerPulseHeaderFilterWrap">
                <label>Assignment</label>
                <button
                  type="button"
                  className="cleanerPulseHeaderFilterButton"
                  aria-expanded={showPulseAssignmentFilter}
                  onClick={() => {
                    setShowPulseAssignmentFilter((current) => !current);
                    setShowPulseDateFilter(false);
                    setShowPulsePropertyFilter(false);
                  }}
                >
                  <span>{pulseAssignmentFilterSummary}</span><span>▾</span>
                </button>
                {showPulseAssignmentFilter && (
                  <div className="cleanerPulseHeaderFilterMenu">
                    <label className="cleanerPulseHeaderFilterOption">
                      <input type="checkbox" checked={pulseAssignmentFilters.includes("all")} onChange={() => setPulseAssignmentFilters(["all"])} />
                      <span>All Assignments</span>
                    </label>
                    <label className="cleanerPulseHeaderFilterOption">
                      <input type="checkbox" checked={pulseAssignmentFilters.includes("unassigned")} onChange={() => togglePulseMultiFilter("unassigned", setPulseAssignmentFilters)} />
                      <span>Unassigned</span>
                    </label>
                    {sortedUniqueCleaners.map((cleaner: any) => {
                      const value = String(cleaner.id);
                      return (
                        <label className="cleanerPulseHeaderFilterOption" key={value}>
                          <input type="checkbox" checked={pulseAssignmentFilters.includes(value)} onChange={() => togglePulseMultiFilter(value, setPulseAssignmentFilters)} />
                          <span>{getCleanerDisplayName(cleaner)}</span>
                        </label>
                      );
                    })}
                    <div className="cleanerPulseHeaderFilterFooter">
                      <button type="button" className="secondaryButton" onClick={() => setPulseAssignmentFilters(["all"])}>Reset</button>
                      <button type="button" className="primaryButton" onClick={() => setShowPulseAssignmentFilter(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cleanerScheduleHeaderActions cleanerMobilePrintScheduleButton">
              <button
                type="button"
                className="secondaryButton"
                disabled={displayedCleanerTasks.length === 0}
                onClick={printFilteredCleaningSchedule}
              >
                🖨 Print
              </button>
              <button
                type="button"
                className="secondaryButton"
                disabled={displayedCleanerTasks.length === 0}
                onClick={openScheduleShareModal}
              >
                ↗ Share
              </button>
            </div>

            <div
              className="cleanerTaskLedger"
              style={{ overflowAnchor: "none" }}
              role="table"
              aria-label="Upcoming tasks and assignments"
            >
              <div className="cleanerTaskLedgerHeader" role="row">
                <div className="cleanerTaskLedgerSortableHeader" role="columnheader">
                  <span>Date Range</span>
                  <div className="cleanerPulseHeaderFilterWrap">
                    <button
                      type="button"
                      className="cleanerPulseHeaderFilterButton"
                      aria-expanded={showPulseDateFilter}
                      onClick={() => {
                        setShowPulseDateFilter((current) => !current);
                        setShowPulsePropertyFilter(false);
                        setShowPulseAssignmentFilter(false);
                      }}
                    ><span>{pulseDateFilterSummary}</span><span>▾</span></button>
                    {showPulseDateFilter && (
                      <div className="cleanerPulseHeaderFilterMenu">
                        <div className="cleanerPulseDateChoices">
                          {[
                            ["all", "All Upcoming Tasks"],
                            ["today", "Today"],
                            ["7", "Next 7 Days"],
                            ["14", "Next 14 Days"],
                            ["30", "Next 30 Days"],
                            ["custom", "Custom Dates"],
                          ].map(([value, label]) => (
                            <label className="cleanerPulseHeaderFilterOption" key={value}>
                              <input type="radio" name="pulse-desktop-date-range" checked={pulseDateRange === value} onChange={() => setPulseDateRange(value as typeof pulseDateRange)} />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                        {pulseDateRange === "custom" && (
                          <div className="cleanerPulseCustomDates">
                            <label>Start date<input type="date" value={pulseCustomStartDate} onChange={(event) => setPulseCustomStartDate(event.target.value)} /></label>
                            <label>End date<input type="date" value={pulseCustomEndDate} onChange={(event) => setPulseCustomEndDate(event.target.value)} /></label>
                          </div>
                        )}
                        <div className="cleanerPulseHeaderFilterFooter"><button type="button" className="primaryButton" onClick={() => setShowPulseDateFilter(false)}>Done</button></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cleanerTaskLedgerSortableHeader" role="columnheader">
                  <span>Property</span>
                  <div className="cleanerPulseHeaderFilterWrap">
                    <button
                      type="button"
                      className="cleanerPulseHeaderFilterButton"
                      aria-expanded={showPulsePropertyFilter}
                      onClick={() => {
                        setShowPulsePropertyFilter((current) => !current);
                        setShowPulseDateFilter(false);
                        setShowPulseAssignmentFilter(false);
                      }}
                    ><span>{pulsePropertyFilterSummary}</span><span>▾</span></button>
                    {showPulsePropertyFilter && (
                      <div className="cleanerPulseHeaderFilterMenu">
                        <label className="cleanerPulseHeaderFilterOption"><input type="checkbox" checked={pulsePropertyFilters.includes("all")} onChange={() => setPulsePropertyFilters(["all"])} /><span>All Properties</span></label>
                        {sortedHomes.map((home) => { const value = String(home.id); return <label className="cleanerPulseHeaderFilterOption" key={value}><input type="checkbox" checked={pulsePropertyFilters.includes(value)} onChange={() => togglePulseMultiFilter(value, setPulsePropertyFilters)} /><span>{home.name}</span></label>; })}
                        <label className="cleanerPulseHeaderFilterOption"><input type="checkbox" checked={pulsePropertyFilters.includes("manual-jobs")} onChange={() => togglePulseMultiFilter("manual-jobs", setPulsePropertyFilters)} /><span>Manual Jobs</span></label>
                        <div className="cleanerPulseHeaderFilterFooter"><button type="button" className="secondaryButton" onClick={() => setPulsePropertyFilters(["all"])}>Reset</button><button type="button" className="primaryButton" onClick={() => setShowPulsePropertyFilter(false)}>Done</button></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cleanerTaskLedgerSortableHeader" role="columnheader">
                  <span>Assignment</span>
                  <div className="cleanerPulseHeaderFilterWrap">
                    <button type="button" className="cleanerPulseHeaderFilterButton" aria-expanded={showPulseAssignmentFilter} onClick={() => { setShowPulseAssignmentFilter((current) => !current); setShowPulseDateFilter(false); setShowPulsePropertyFilter(false); }}><span>{pulseAssignmentFilterSummary}</span><span>▾</span></button>
                    {showPulseAssignmentFilter && (
                      <div className="cleanerPulseHeaderFilterMenu">
                        <label className="cleanerPulseHeaderFilterOption"><input type="checkbox" checked={pulseAssignmentFilters.includes("all")} onChange={() => setPulseAssignmentFilters(["all"])} /><span>All Assignments</span></label>
                        <label className="cleanerPulseHeaderFilterOption"><input type="checkbox" checked={pulseAssignmentFilters.includes("unassigned")} onChange={() => togglePulseMultiFilter("unassigned", setPulseAssignmentFilters)} /><span>Unassigned</span></label>
                        {sortedUniqueCleaners.map((cleaner: any) => { const value = String(cleaner.id); return <label className="cleanerPulseHeaderFilterOption" key={value}><input type="checkbox" checked={pulseAssignmentFilters.includes(value)} onChange={() => togglePulseMultiFilter(value, setPulseAssignmentFilters)} /><span>{getCleanerDisplayName(cleaner)}</span></label>; })}
                        <div className="cleanerPulseHeaderFilterFooter"><button type="button" className="secondaryButton" onClick={() => setPulseAssignmentFilters(["all"])}>Reset</button><button type="button" className="primaryButton" onClick={() => setShowPulseAssignmentFilter(false)}>Done</button></div>
                      </div>
                    )}
                  </div>
                </div>

                <span role="columnheader">Status</span>
                <div className="cleanerTaskLedgerSortableHeader" role="columnheader">
                  <span>Action</span>
                  <div className="cleanerScheduleHeaderActions">
                    <button
                      type="button"
                      className="secondaryButton cleanerPrintScheduleButton"
                      disabled={displayedCleanerTasks.length === 0}
                      onClick={printFilteredCleaningSchedule}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      className="secondaryButton cleanerPrintScheduleButton"
                      disabled={displayedCleanerTasks.length === 0}
                      onClick={openScheduleShareModal}
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>

              <div className="cleanerTaskLedgerBody">
                {displayedCleanerTasks.map((reservation) => {
                  const home = homes.find(
                    (item) => String(item.id) === String(reservation.homeId),
                  );

                  const cleanerStatus = getCleanerPortalStatus(reservation);
                  const privateNote =
                    reservation.cleanerNotes ?? reservation.notes ?? "";

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
                        <strong>
                          {formatCleanDate(reservation.departure)}
                        </strong>
                        <small>Task date</small>
                      </div>

                      <div className="cleanerTaskLedgerProperty" role="cell">
                        <strong>
                          {getTaskPropertyName(reservation, home)}
                        </strong>
                        <small>
                          {getTaskPropertyAddress(reservation, home) ||
                            (reservation.isCleanerJob
                              ? "Independent job"
                              : "Property details")}
                        </small>
                        {!reservation.isCleanerJob &&
                          !isAssignedTeamCleaner && (
                          <small>
                            👤{" "}
                            {getAssignedCleaner(reservation)
                              ? getCleanerDisplayName(
                                  getAssignedCleaner(reservation),
                                )
                              : "Unassigned"}
                          </small>
                        )}
                      </div>

                      <div className="cleanerTaskLedgerTask" role="cell">
                        <strong>
                          {reservation.jobType ??
                            reservation.taskType ??
                            "Vacation Rental Turnover"}
                        </strong>

                        {canManageAssignments ? (
                          <select
                            className={`cleanerAssignmentSelect ${
                              getTaskAssignedCleanerId(reservation)
                                ? ""
                                : "unassigned"
                            }`}
                            value={getTaskAssignedCleanerId(reservation)}
                            disabled={assignmentSavingTaskId === String(reservation.id)}
                            aria-label={`Assign cleaner for ${getTaskPropertyName(
                              reservation,
                              home,
                            )}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              event.stopPropagation();
                              void assignTaskToCleaner(
                                reservation,
                                event.target.value,
                              );
                            }}
                          >
                            <option value="">⚠ Assign Cleaner</option>
                            {assignmentSavingTaskId === String(reservation.id) && (
                              <option value={getTaskAssignedCleanerId(reservation)}>
                                Saving assignment…
                              </option>
                            )}
                            {sortedUniqueCleaners.map((cleaner) => (
                              <option
                                key={String(cleaner.id)}
                                value={String(cleaner.id)}
                              >
                                👤 {getCleanerDisplayName(cleaner)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          privateNote && <small>{privateNote}</small>
                        )}
                      </div>

                      <div className="cleanerTaskLedgerStatus" role="cell">
                        <div className="cleanerTaskLedgerBadges">
                          {isBackToBack(reservation) && (
                            <span className="conflictWarningPill">🔁 B2B</span>
                          )}

                          <span
                            className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
                              cleanerStatus,
                            )}`}
                          >
                            {getTaskStatusLabel(cleanerStatus)}
                          </span>
                        </div>
                      </div>

                      <div className="cleanerTaskLedgerAction" role="cell">
                        <button
                          type="button"
                          className={`primaryButton cleanerTaskLedgerActionButton action-${getCleanerPortalStatusClass(
                            cleanerStatus,
                          )}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setShowCleanerCalendar(false);

                            if (
                              cleanerStatus === "Ready to Invoice" &&
                              !isAssignedTeamCleaner
                            ) {
                              onCreateInvoiceFromTask(reservation);
                              return;
                            }

                            openTaskPreview(String(reservation.id), "pulse");
                          }}
                        >
                          {cleanerStatus === "Upcoming" && "Start"}
                          {cleanerStatus === "In Progress" && "Continue"}
                          {cleanerStatus === "Ready to Invoice" &&
                            (isAssignedTeamCleaner
                              ? "Completed"
                              : "Create Invoice")}
                          {cleanerStatus === "Invoiced" && "View"}
                          {cleanerStatus === "No Clean Needed" && "View"}
                        </button>
                      </div>
                    </article>
                  );
                })}

                {displayedCleanerTasks.length === 0 && (
                  <div className="emptyStateCard">
                    <strong>
                      {showOnlyUnassignedTasks
                        ? "No tasks need assignment"
                        : "No upcoming tasks"}
                    </strong>
                    <p>
                      {showOnlyUnassignedTasks
                        ? "Every upcoming task currently has a cleaner."
                        : "No upcoming tasks are currently assigned."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        </section>
      </main>

      {showTodayTaskList && (
        <div
          className="cleanerTodayTaskOverlay"
          role="presentation"
          onClick={() => setShowTodayTaskList(false)}
        >
          <section
            className="cleanerTodayTaskSheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${todayTasks.length} tasks today`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cleanerTodayTaskHeader">
              <div>
                <p className="eyebrow">Today&apos;s Tasks</p>
                <h3>Choose a task to review</h3>
              </div>

              <button
                type="button"
                className="cleanerScheduleClose"
                aria-label="Close today task list"
                onClick={() => setShowTodayTaskList(false)}
              >
                ✕
              </button>
            </header>

            <div className="cleanerTodayTaskList">
              {todayTasks.map((task) => {
                const home = homes.find(
                  (item) => String(item.id) === String(task.homeId),
                );
                const status = getCleanerPortalStatus(task);

                return (
                  <button
                    key={String(task.id)}
                    type="button"
                    className="cleanerTodayTaskItem"
                    onClick={() => {
                      setShowTodayTaskList(false);
                      setShowCleanerCalendar(false);
                      openTaskPreview(String(task.id), "pulse");
                    }}
                  >
                    <span className="cleanerTodayTaskCopy">
                      <strong>
                        {task.isCleanerJob
                          ? (task.customerName ?? "Independent Job")
                          : (home?.name ?? "Unknown Property")}
                      </strong>
                      <small>
                        {task.jobType ??
                          task.taskType ??
                          "Vacation Rental Turnover"}
                      </small>
                    </span>

                    <span
                      className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
                        status,
                      )}`}
                    >
                      {getTaskStatusLabel(status)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showInProgressTaskList && (
        <div
          className="cleanerTodayTaskOverlay"
          role="presentation"
          onClick={() => setShowInProgressTaskList(false)}
        >
          <section
            className="cleanerTodayTaskSheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${inProgressTasks.length} tasks in progress`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cleanerTodayTaskHeader">
              <div>
                <p className="eyebrow">In Progress</p>
                <h3>Choose a task to continue</h3>
              </div>

              <button
                type="button"
                className="cleanerScheduleClose"
                aria-label="Close in-progress task list"
                onClick={() => setShowInProgressTaskList(false)}
              >
                ✕
              </button>
            </header>

            <div className="cleanerTodayTaskList">
              {inProgressTasks.map((task) => {
                const home = homes.find(
                  (item) => String(item.id) === String(task.homeId),
                );
                const status = getCleanerPortalStatus(task);

                return (
                  <button
                    key={String(task.id)}
                    type="button"
                    className="cleanerTodayTaskItem"
                    onClick={() => {
                      setShowInProgressTaskList(false);
                      setShowCleanerCalendar(false);
                      openTaskPreview(String(task.id), "pulse");
                    }}
                  >
                    <span className="cleanerTodayTaskCopy">
                      <strong>
                        {task.isCleanerJob
                          ? (task.customerName ?? "Independent Job")
                          : (home?.name ?? "Unknown Property")}
                      </strong>
                      <small>
                        {task.jobType ??
                          task.taskType ??
                          "Vacation Rental Turnover"}
                      </small>
                    </span>

                    <span
                      className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
                        status,
                      )}`}
                    >
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

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

            <div className="cleanerScheduleActionBar">
              <button
                type="button"
                className="secondaryButton cleanerQuickReportButton"
                onClick={() => {
                  setReportWorkFilters([...selectedWorkFilters]);
                  setShowQuickTaskReport(true);
                }}
              >
                📄 Work Packet
              </button>

              <div className="cleanerWorkFilterWrap">
                <button
                  className="cleanerWorkFilterButton"
                  type="button"
                  aria-expanded={showTaskFilter}
                  onClick={() => setShowTaskFilter((current) => !current)}
                >
                  <span>Filter Work</span>
                  <span className="cleanerWorkFilterSummary">
                    {selectedWorkFilters.includes("all")
                      ? "All Work"
                      : `${selectedWorkFilters.length} selected`}
                  </span>
                  <span aria-hidden="true">▾</span>
                </button>

                {showTaskFilter && (
                  <div className="cleanerWorkFilterMenu">
                    <label className="cleanerWorkFilterOption">
                      <input
                        type="checkbox"
                        checked={selectedWorkFilters.includes("all")}
                        onChange={() =>
                          updateWorkFiltersWithoutJump(() => ["all"])
                        }
                      />
                      <span>All Work</span>
                    </label>

                    <div className="cleanerWorkFilterDivider" />

                    {sortedHomes.map((home) => {
                      const homeId = String(home.id);
                      const checked = selectedWorkFilters.includes(homeId);

                      return (
                        <label className="cleanerWorkFilterOption" key={homeId}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              updateWorkFiltersWithoutJump((current) => {
                                const withoutAll = current.filter(
                                  (value) => value !== "all",
                                );
                                const next = checked
                                  ? withoutAll.filter(
                                      (value) => value !== homeId,
                                    )
                                  : [...withoutAll, homeId];

                                return next.length === 0 ? ["all"] : next;
                              });
                            }}
                          />
                          <span>{home.name}</span>
                        </label>
                      );
                    })}

                    <div className="cleanerWorkFilterDivider" />

                    <label className="cleanerWorkFilterOption">
                      <input
                        type="checkbox"
                        checked={selectedWorkFilters.includes("manual-jobs")}
                        onChange={() => {
                          updateWorkFiltersWithoutJump((current) => {
                            const withoutAll = current.filter(
                              (value) => value !== "all",
                            );
                            const checked = withoutAll.includes("manual-jobs");
                            const next = checked
                              ? withoutAll.filter(
                                  (value) => value !== "manual-jobs",
                                )
                              : [...withoutAll, "manual-jobs"];

                            return next.length === 0 ? ["all"] : next;
                          });
                        }}
                      />
                      <span>Manual Jobs</span>
                    </label>

                    <div className="cleanerWorkFilterFooter">
                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={() =>
                          updateWorkFiltersWithoutJump(() => ["all"])
                        }
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="primaryButton"
                        onClick={() => setShowTaskFilter(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SelectableCleanerPortalCalendar
              cleanerTasks={filteredCalendarTasks}
              homes={homes}
              getUrgency={getUrgency}
              isAssignedTeamCleaner={isAssignedTeamCleaner}
              onSelectTask={(taskId: string) =>
                openTaskPreview(taskId, "schedule")
              }
            />
          </div>
        </div>
      )}

      {showQuickTaskReport && (
        <div
          className="cleanerQuickReportOverlay"
          role="presentation"
          onClick={() => setShowQuickTaskReport(false)}
        >
          <section
            className="cleanerQuickReportModal"
            role="dialog"
            aria-modal="true"
            aria-label="Create cleaner work packet"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cleanerTodayTaskHeader">
              <div>
                <p className="eyebrow">Cleaner work packet</p>
                <h3>Build Work Packet</h3>
              </div>
              <button
                type="button"
                className="cleanerScheduleClose"
                aria-label="Close schedule builder"
                onClick={() => setShowQuickTaskReport(false)}
              >
                ✕
              </button>
            </header>

            <div className="cleanerQuickReportBody">
              <section className="cleanerQuickReportGroup">
                <strong>Date range</strong>
                <div className="cleanerQuickReportChoices">
                  {[
                    ["today", "Today"],
                    ["7", "Next 7 Days"],
                    ["14", "Next 14 Days"],
                    ["30", "Next 30 Days"],
                    ["custom", "Custom"],
                  ].map(([value, label]) => (
                    <label className="cleanerQuickReportChoice" key={value}>
                      <input
                        type="radio"
                        name="work-packet-range"
                        value={value}
                        checked={reportRange === value}
                        onChange={() =>
                          setReportRange(
                            value as "today" | "7" | "14" | "30" | "custom",
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                {reportRange === "custom" && (
                  <div className="cleanerQuickReportDates">
                    <label>
                      Start date
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(event) =>
                          setReportStartDate(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      End date
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(event) =>
                          setReportEndDate(event.target.value)
                        }
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="cleanerQuickReportGroup">
                <strong>Choose work</strong>
                <div className="cleanerQuickReportWorkList">
                  <label className="cleanerQuickReportChoice">
                    <input
                      type="checkbox"
                      checked={reportWorkFilters.includes("all")}
                      onChange={() => setReportWorkFilters(["all"])}
                    />
                    <span>All Work</span>
                  </label>

                  {sortedHomes.map((home) => {
                    const homeId = String(home.id);
                    const checked = reportWorkFilters.includes(homeId);
                    return (
                      <label className="cleanerQuickReportChoice" key={homeId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setReportWorkFilters((current) => {
                              const withoutAll = current.filter(
                                (value) => value !== "all",
                              );
                              const next = checked
                                ? withoutAll.filter((value) => value !== homeId)
                                : [...withoutAll, homeId];
                              return next.length === 0 ? ["all"] : next;
                            })
                          }
                        />
                        <span>{home.name}</span>
                      </label>
                    );
                  })}

                  <label className="cleanerQuickReportChoice">
                    <input
                      type="checkbox"
                      checked={reportWorkFilters.includes("manual-jobs")}
                      onChange={() =>
                        setReportWorkFilters((current) => {
                          const withoutAll = current.filter(
                            (value) => value !== "all",
                          );
                          const checked = withoutAll.includes("manual-jobs");
                          const next = checked
                            ? withoutAll.filter(
                                (value) => value !== "manual-jobs",
                              )
                            : [...withoutAll, "manual-jobs"];
                          return next.length === 0 ? ["all"] : next;
                        })
                      }
                    />
                    <span>Manual Jobs</span>
                  </label>
                </div>
              </section>

              <section className="cleanerQuickReportGroup">
                <strong>Include access details</strong>
                <div className="cleanerQuickReportChoices">
                  {(
                    [
                      ["propertyNotes", "Property Notes"],
                      ["doorCodes", "Door Codes"],
                      ["wifi", "Wi-Fi Information"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="cleanerQuickReportChoice" key={key}>
                      <input
                        type="checkbox"
                        checked={reportOptions[key]}
                        onChange={(event) =>
                          setReportOptions((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <div className="cleanerQuickReportSummary">
                {getQuickReportTasks().length}{" "}
                {getQuickReportTasks().length === 1 ? "task" : "tasks"} will be
                included. Pay is never shown. Times appear only for manual jobs.
              </div>
            </div>

            <footer className="cleanerQuickReportActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => void shareWorkPacket(createWorkPacketInput())}
              >
                Share Packet
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => printWorkPacket(createWorkPacketInput())}
              >
                Print / Save PDF
              </button>
            </footer>
          </section>
        </div>
      )}

      {showScheduleShareModal && (
        <div
          className="cleanerScheduleShareOverlay"
          role="presentation"
          onClick={() => setShowScheduleShareModal(false)}
        >
          <section
            className="cleanerScheduleShareModal"
            role="dialog"
            aria-modal="true"
            aria-label="Share cleaning schedule"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cleanerTodayTaskHeader">
              <div>
                <p className="eyebrow">Share Schedule</p>
                <h3>Choose who receives this schedule</h3>
              </div>
              <button
                type="button"
                className="cleanerScheduleClose"
                aria-label="Close share schedule"
                onClick={() => setShowScheduleShareModal(false)}
              >
                ✕
              </button>
            </header>

            <div className="cleanerScheduleShareBody">
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.5 }}>
                This uses the date, property, and assignment filters currently
                shown above the schedule.
              </p>

              <div className="cleanerScheduleShareList">
                {sortedUniqueCleaners.map((cleaner: any) => {
                  const cleanerId = String(cleaner.id);
                  const checked = scheduleShareCleanerIds.includes(cleanerId);
                  const email = getCleanerEmail(cleaner);
                  const phone = getCleanerPhone(cleaner);

                  return (
                    <label className="cleanerScheduleSharePerson" key={cleanerId}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setScheduleShareCleanerIds((current) =>
                            current.includes(cleanerId)
                              ? current.filter((value) => value !== cleanerId)
                              : [...current, cleanerId],
                          )
                        }
                      />
                      <span>
                        <strong>{getCleanerDisplayName(cleaner)}</strong>
                        <small>
                          {[email, phone].filter(Boolean).join(" · ") ||
                            "No email or phone saved"}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="cleanerQuickReportSummary">
                {displayedCleanerTasks.length} filtered {displayedCleanerTasks.length === 1 ? "task" : "tasks"} will be included.
              </div>
            </div>

            <footer className="cleanerScheduleShareActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={scheduleShareCleanerIds.length === 0}
                onClick={emailFilteredCleaningSchedule}
              >
                ✉ Email
              </button>
              <button
                type="button"
                className="secondaryButton"
                disabled={scheduleShareCleanerIds.length !== 1}
                onClick={textFilteredCleaningSchedule}
              >
                💬 Text
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => void shareFilteredCleaningSchedule()}
              >
                ↗ More Sharing Options
              </button>
            </footer>
          </section>
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
                  {getTaskPropertyName(
                    selectedCleanerTask,
                    selectedTaskHome,
                  )}
                </h3>
                <p className="cleanerJobType">
                  {selectedCleanerTask.jobType ??
                    selectedCleanerTask.taskType ??
                    "Vacation Rental Turnover"}
                </p>
                <p className="cleanerJobScheduleDate">
                  📅{" "}
                  {new Date(
                    `${String(
                      selectedCleanerTask.departure ??
                        selectedCleanerTask.scheduledDate ??
                        selectedCleanerTask.scheduled_date,
                    ).slice(0, 10)}T12:00:00`,
                  ).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {(selectedCleanerTask.scheduledTime ??
                    selectedCleanerTask.scheduled_time) &&
                    ` · ${
                      selectedCleanerTask.scheduledTime ??
                      selectedCleanerTask.scheduled_time
                    }`}
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
                <span className="conflictWarningPill">🔁 Back-to-Back</span>
              )}

              {isOwnerStay(selectedCleanerTask) && (
                <span className="conflictWarningPill">🏠 Owner Stay</span>
              )}

              <span
                className={`conflictWarningPill cleanerStatusPill status-${getCleanerPortalStatusClass(
                  selectedTaskStatus,
                )}`}
              >
                {getTaskStatusLabel(selectedTaskStatus)}
              </span>
            </div>

            {!isAssignedTeamCleaner && (
            <div className="cleanerJobPayRow">
              <span>Estimated Pay</span>
              <strong>
                {selectedEstimatedPay === null || selectedEstimatedPay === ""
                  ? "Set on invoice"
                  : `$${selectedEstimatedPay}`}
              </strong>
            </div>
            )}

            {isAirbnbBlock(selectedCleanerTask) && (
              <section
                className="cleanerJobSection"
                style={{
                  borderLeft: "4px solid #f59e0b",
                  background: "#fffbeb",
                  color: "#92400e",
                }}
              >
                <div className="cleanerJobSectionHeader">
                  <strong>⚠️ Airbnb Schedule Warning</strong>
                </div>
                <p style={{ margin: 0, lineHeight: 1.45 }}>
                  Airbnb may combine multiple blocked dates into one calendar
                  entry, which could hide a scheduled cleaning task. Confirm
                  with the homeowner that this is the only cleaning needed for
                  this block.
                </p>
              </section>
            )}

            {!isAssignedTeamCleaner && (
              <section className="cleanerJobSection">
                <div className="cleanerJobSectionHeader">
                  <strong>👤 Assigned Cleaner</strong>
                </div>

                {canManageAssignments ? (
                  <select
                    value={getTaskAssignedCleanerId(selectedCleanerTask)}
                    disabled={assignmentSavingTaskId === String(selectedCleanerTask.id)}
                    onChange={(event) =>
                      void assignTaskToCleaner(
                        selectedCleanerTask,
                        event.target.value,
                      )
                    }
                    style={{
                      width: "100%",
                      minHeight: "44px",
                      padding: "9px 11px",
                      border: "1px solid #dbe3ee",
                      borderRadius: "10px",
                      background: "#ffffff",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {sortedUniqueCleaners.map((cleaner) => (
                      <option key={String(cleaner.id)} value={String(cleaner.id)}>
                        {getCleanerDisplayName(cleaner)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontWeight: 800, color: "#334155" }}>
                    {getAssignedCleaner(selectedCleanerTask)
                      ? getCleanerDisplayName(getAssignedCleaner(selectedCleanerTask))
                      : "Unassigned"}
                  </p>
                )}
              </section>
            )}

            <section className="cleanerJobSection cleanerNotesEditor">
              <div className="cleanerJobSectionHeader">
                <div className="privateTaskNotesHeading">
                  <strong>📝 Task Notes</strong>
                  <span>🔒 Internal cleaner notes only</span>
                </div>
                {taskNoteSaved && (
                  <span className="cleanerNoteSaved">Saved</span>
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
                  {selectedPropertyIntelligence.map((insight, index) => (
                    <p key={`${insight}-${index}`}>{insight}</p>
                  ))}
                </div>
              </section>
            )}

            {!isAssignedTeamCleaner && (
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
                    window.alert("Invoice reminder flow coming next")
                  }
                >
                  Send Reminders
                </button>
              )}
            </section>
            )}

            <div className="cleanerJobPrimaryActions">
              {selectedTaskStatus === "Upcoming" && (
                <>
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={async () => {
                      const updatedTask = await updateCleanerTask(
                        selectedCleanerTask,
                        "In Progress",
                        isOwnerStay(selectedCleanerTask)
                          ? "Cleaner started the owner-stay turnover."
                          : isAirbnbBlock(selectedCleanerTask)
                            ? "Cleaner started the Airbnb block turnover."
                            : "Cleaner started the task.",
                      );

                      if (updatedTask) {
                        setSelectedCleanerTask(updatedTask);
                      }
                    }}
                  >
                    ▶ Start Task
                  </button>
                </>
              )}

              {selectedTaskStatus === "In Progress" && (
                <>
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() => openCompleteTask(selectedCleanerTask)}
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
                        "Cleaner reset the task to not started.",
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

              {selectedTaskStatus === "Ready to Invoice" &&
                !isAssignedTeamCleaner && (
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
                      🧾 Create Invoice
                    </button>

                    <button
                      className="completeTaskUndoButton"
                      type="button"
                      onClick={async () => {
                        const updatedTask = await updateCleanerTask(
                          selectedCleanerTask,
                          "In Progress",
                          "Cleaner reopened the completed task.",
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

              {selectedTaskStatus === "Ready to Invoice" &&
                isAssignedTeamCleaner && (
                  <div
                    style={{
                      padding: "13px 14px",
                      border: "1px solid #bbf7d0",
                      borderRadius: "12px",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "18px", marginBottom: "4px" }}>
                      🎉 Great job!
                    </div>
                    <div>Job complete. Your employer has been notified.</div>
                  </div>
                )}

              {selectedTaskStatus === "Invoiced" &&
                !isAssignedTeamCleaner && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => {
                    const invoiceId = selectedCleanerTask.invoiceId;

                    if (!invoiceId) {
                      window.alert(
                        "AMR could not find the invoice linked to this task.",
                      );
                      return;
                    }

                    const invoiceFilter =
                      selectedCleanerTask.invoiceStatus === "paid"
                        ? "paid"
                        : "all";

                    setSelectedCleanerTask(null);
                    setShowCleanerCalendar(false);
                    onOpenInvoice(String(invoiceId), invoiceFilter);
                  }}
                >
                  {selectedCleanerTask.invoiceStatus === "paid"
                    ? "View Paid Invoice"
                    : "View Invoice"}
                </button>
              )}

              {selectedTaskStatus === "No Clean Needed" &&
                canManageAssignments && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => void restoreTaskCleaning()}
                >
                  ↩ Restore Cleaning
                </button>
              )}

              {canManageAssignments &&
                !selectedCleanerTask.isCleanerJob &&
                selectedTaskStatus !== "Invoiced" &&
                selectedTaskStatus !== "No Clean Needed" && (
                  <button
                    className="completeTaskUndoButton"
                    type="button"
                    onClick={() => void markTaskNoClean()}
                  >
                    ☐ No Cleaning Needed
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
            (home) => String(home.id) === String(taskBeingCompleted.homeId),
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
              This creates an owner notification and a maintenance work order
              automatically.
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
                  <option value="After Hours">After Hours</option>
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
