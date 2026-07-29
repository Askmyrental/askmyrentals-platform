import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

type JobStatus =
  | "upcoming"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "paid"
  | "cancelled";

type ScheduleType =
  | "once"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom";

type RecurringEndType = "date" | "count";
type CustomIntervalUnit = "days" | "weeks" | "months";

type CleanerJob = {
  id: string;
  cleaner_id: string;
  assigned_user_id: string | null;
  property_id: string | null;
  client_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_address: string | null;
  job_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  amount_cents: number;
  notes: string | null;
  status: JobStatus;
  recurrence_series_id: string | null;
  recurrence_index: number | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type CleanerJobsPageProps = {
  homes: any[];
  cleaners?: any[];
  selectedGroupRole?: string;
  onCreateInvoiceFromJob: (job: any) => void;
};

const JOB_TYPES = [
  "Standard Residential Cleaning",
  "Deep Clean",
  "Move-In Cleaning",
  "Move-Out Cleaning",
  "Vacation Rental Turnover",
  "Commercial Cleaning",
  "Office Cleaning",
  "Post-Construction Cleaning",
  "Inspection",
  "Maintenance Visit",
  "Custom",
];

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatJobDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusLabel(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    upcoming: "Upcoming",
    in_progress: "In Progress",
    completed: "Ready to Invoice",
    invoiced: "Invoiced",
    paid: "Paid",
    cancelled: "Cancelled",
  };

  return labels[status];
}

function addMonthsKeepingDay(date: Date, months: number) {
  const originalDay = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function addInterval(
  date: Date,
  amount: number,
  unit: CustomIntervalUnit,
) {
  if (unit === "months") {
    return addMonthsKeepingDay(date, amount);
  }

  const next = new Date(date);
  next.setDate(next.getDate() + amount * (unit === "weeks" ? 7 : 1));
  return next;
}

function addWeekdays(date: Date, weekdayCount: number) {
  const next = new Date(date);
  let remaining = Math.max(1, weekdayCount);

  while (remaining > 0) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return next;
}

function moveToNextWeekday(date: Date) {
  const next = new Date(date);

  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function buildRecurringDates(options: {
  startDate: string;
  scheduleType: ScheduleType;
  endType: RecurringEndType;
  endDate: string;
  occurrenceCount: number;
  customInterval: number;
  customIntervalUnit: CustomIntervalUnit;
  weekdaysOnly: boolean;
}) {
  const {
    startDate,
    scheduleType,
    endType,
    endDate,
    occurrenceCount,
    customInterval,
    customIntervalUnit,
    weekdaysOnly,
  } = options;

  if (scheduleType === "once") return [startDate];

  const dates: string[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = endDate ? new Date(`${endDate}T12:00:00`) : null;
  const maximumJobs = 366;
  let current =
    weekdaysOnly && (start.getDay() === 0 || start.getDay() === 6)
      ? moveToNextWeekday(start)
      : new Date(start);

  while (dates.length < maximumJobs) {
    if (endType === "date" && end && current > end) break;
    if (endType === "count" && dates.length >= occurrenceCount) break;

    dates.push(toInputDate(current));

    if (scheduleType === "daily") {
      current = weekdaysOnly
        ? addWeekdays(current, 1)
        : addInterval(current, 1, "days");
    } else if (scheduleType === "weekly") {
      current = addInterval(current, 1, "weeks");
      if (weekdaysOnly) current = moveToNextWeekday(current);
    } else if (scheduleType === "biweekly") {
      current = addInterval(current, 2, "weeks");
      if (weekdaysOnly) current = moveToNextWeekday(current);
    } else if (scheduleType === "monthly") {
      current = addInterval(current, 1, "months");
      if (weekdaysOnly) current = moveToNextWeekday(current);
    } else if (customIntervalUnit === "days" && weekdaysOnly) {
      current = addWeekdays(current, Math.max(1, customInterval));
    } else {
      current = addInterval(
        current,
        Math.max(1, customInterval),
        customIntervalUnit,
      );
      if (weekdaysOnly) current = moveToNextWeekday(current);
    }
  }

  return dates;
}

function getScheduleLabel(
  scheduleType: ScheduleType,
  customInterval = 1,
  customIntervalUnit: CustomIntervalUnit = "days",
) {
  const labels: Record<Exclude<ScheduleType, "custom">, string> = {
    once: "One time",
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
  };

  if (scheduleType === "custom") {
    const singularUnit = customIntervalUnit.slice(0, -1);
    return `Every ${customInterval} ${
      customInterval === 1 ? singularUnit : customIntervalUnit
    }`;
  }

  return labels[scheduleType];
}

function getRecurringNoteSignature(notes: string | null) {
  if (!notes) return "";

  return (
    notes
      .split("\n")
      .find((line) => line.startsWith("Recurring schedule:"))
      ?.trim() ?? ""
  );
}

export default function CleanerJobsPage({
  homes,
  cleaners = [],
  selectedGroupRole,
  onCreateInvoiceFromJob,
}: CleanerJobsPageProps) {
  const [jobs, setJobs] = useState<CleanerJob[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientErrorMessage, setClientErrorMessage] = useState("");
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    billingEmail: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    preferredLanguage: "English",
    notes: "",
  });
  const [selectedJob, setSelectedJob] = useState<CleanerJob | null>(null);
  const [editingJob, setEditingJob] = useState<CleanerJob | null>(null);
  const [showJobCreatedNotice, setShowJobCreatedNotice] = useState(false);
  const [createdJobCount, setCreatedJobCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedGroupRole = String(selectedGroupRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const isAssignedTeamCleaner = [
    "cleaner",
    "employee",
    "team_member",
    "member",
  ].includes(normalizedGroupRole);

  const canManageAssignments = !isAssignedTeamCleaner;

  const getVisibleStatusLabel = (status: JobStatus) => {
    if (
      isAssignedTeamCleaner &&
      ["completed", "invoiced", "paid"].includes(status)
    ) {
      return "Completed";
    }

    return getStatusLabel(status);
  };

  const getCleanerDisplayName = (cleaner: any) =>
    String(
      cleaner?.memberName ??
        cleaner?.member_name ??
        cleaner?.profileName ??
        cleaner?.profile_name ??
        cleaner?.userName ??
        cleaner?.user_name ??
        cleaner?.fullName ??
        cleaner?.full_name ??
        cleaner?.name ??
        cleaner?.contactName ??
        cleaner?.contact_name ??
        cleaner?.email ??
        "Team Member",
    ).trim();

  const getCleanerRole = (cleaner: any) =>
    String(
      cleaner?.groupRole ??
        cleaner?.group_role ??
        cleaner?.memberRole ??
        cleaner?.member_role ??
        cleaner?.workspaceRole ??
        cleaner?.workspace_role ??
        cleaner?.role ??
        "",
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  const assignableCleaners = cleaners.filter((cleaner) => {
    const role = getCleanerRole(cleaner);

    if (!role) return true;

    return ["cleaner", "employee", "team_member", "member"].includes(role);
  });

  const getCleanerAssignmentId = (cleaner: any) =>
    String(
      cleaner?.userId ??
        cleaner?.user_id ??
        cleaner?.assignedUserId ??
        cleaner?.assigned_user_id ??
        cleaner?.id ??
        "",
    );

  const getAssignedCleanerName = (assignedUserId: string | null) => {
    if (!assignedUserId) return "Unassigned";

    const matchingCleaner = assignableCleaners.find(
      (cleaner) =>
        getCleanerAssignmentId(cleaner) === String(assignedUserId),
    );

    return matchingCleaner
      ? getCleanerDisplayName(matchingCleaner)
      : "Assigned team member";
  };

  const [form, setForm] = useState({
    clientId: "",
    propertyId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceAddress: "",
    jobCategory: "residential",
    jobType: "Standard Residential Cleaning",
    customJobType: "",
    scheduleType: "once" as ScheduleType,
    recurringEndType: "date" as RecurringEndType,
    recurringEndDate: toInputDate(
      addMonthsKeepingDay(new Date(), 3),
    ),
    occurrenceCount: "12",
    customInterval: "1",
    customIntervalUnit: "days" as CustomIntervalUnit,
    weekdaysOnly: false,
    scheduledDate: toInputDate(new Date()),
    scheduledTime: "10:00",
    assignedUserId: "",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    void Promise.all([loadJobs(), loadClients()]);
  }, []);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesStatus =
        selectedStatus === "all" ||
        (isAssignedTeamCleaner && selectedStatus === "completed"
          ? ["completed", "invoiced", "paid"].includes(job.status)
          : job.status === selectedStatus);

      const matchesSearch =
        !normalizedSearch ||
        [
          job.customer_name,
          job.customer_email,
          job.customer_phone,
          job.service_address,
          job.job_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [jobs, searchTerm, selectedStatus, isAssignedTeamCleaner]);

  const upcomingCount = jobs.filter((job) => job.status === "upcoming").length;
  const inProgressCount = jobs.filter(
    (job) => job.status === "in_progress",
  ).length;
  const readyCount = jobs.filter((job) =>
    isAssignedTeamCleaner
      ? ["completed", "invoiced", "paid"].includes(job.status)
      : job.status === "completed",
  ).length;

  async function loadJobs() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setErrorMessage("You must be logged in to view jobs.");
      setIsLoading(false);
      return;
    }

    let jobsQuery = supabase
      .from("cleaner_jobs")
      .select("*");

    jobsQuery = isAssignedTeamCleaner
      ? jobsQuery.eq("assigned_user_id", user.id)
      : jobsQuery.eq("cleaner_id", user.id);

    const { data, error } = await jobsQuery
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true });

    if (error) {
      console.error("Job load failed", error);
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setJobs((data ?? []) as CleanerJob[]);
    setIsLoading(false);
  }

  async function loadClients() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select(
          "id, name, email, phone, billing_email, address_line_1, address_line_2, city, state, zip",
        )
      .eq("owner_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Client load failed", error);
      return;
    }

    setClients((data ?? []) as Client[]);
  }

  function resetNewClientForm() {
    setNewClientForm({
      name: "",
      email: "",
      phone: "",
      billingEmail: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      preferredLanguage: "English",
      notes: "",
    });
    setClientErrorMessage("");
  }

  function openCreateClient() {
    resetNewClientForm();
    setShowCreateClient(true);
  }

  function handleClientChange(clientId: string) {
    if (clientId === "__create_new__") {
      openCreateClient();
      return;
    }

    const client = clients.find((item) => String(item.id) === String(clientId));

    const defaultAddress = client
      ? [
          client.address_line_1,
          client.address_line_2,
          [client.city, client.state].filter(Boolean).join(", "),
          client.zip,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    setForm((current) => ({
      ...current,
      clientId,
      propertyId: "",
      customerName: client?.name ?? "",
      customerEmail: client?.email ?? client?.billing_email ?? "",
      customerPhone: client?.phone ?? "",
      serviceAddress: defaultAddress,
    }));
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientErrorMessage("");

    if (!newClientForm.name.trim()) {
      setClientErrorMessage("Client name is required.");
      return;
    }

    if (!newClientForm.email.trim() && !newClientForm.phone.trim()) {
      setClientErrorMessage("Add an email address or phone number.");
      return;
    }

    setIsSavingClient(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        throw new Error("You must be logged in to create a client.");
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          owner_id: user.id,
          name: newClientForm.name.trim(),
          email: newClientForm.email.trim() || null,
          phone: newClientForm.phone.trim() || null,
          billing_email: newClientForm.billingEmail.trim() || null,
          address_line_1: newClientForm.addressLine1.trim() || null,
          address_line_2: newClientForm.addressLine2.trim() || null,
          city: newClientForm.city.trim() || null,
          state: newClientForm.state.trim() || null,
          zip: newClientForm.zip.trim() || null,
          preferred_language:
            newClientForm.preferredLanguage.trim() || "English",
          notes: newClientForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, name, email, phone, billing_email, address_line_1, address_line_2, city, state, zip",
        )
        .single();

      if (error) throw error;

      const savedClient = data as Client;

      setClients((current) =>
        [...current, savedClient].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );

      const savedAddress = [
        savedClient.address_line_1,
        savedClient.address_line_2,
        [savedClient.city, savedClient.state].filter(Boolean).join(", "),
        savedClient.zip,
      ]
        .filter(Boolean)
        .join(", ");

      setForm((current) => ({
        ...current,
        clientId: savedClient.id,
        propertyId: "",
        customerName: savedClient.name,
        customerEmail:
          savedClient.email ?? savedClient.billing_email ?? "",
        customerPhone: savedClient.phone ?? "",
        serviceAddress: savedAddress,
      }));

      setShowCreateClient(false);
      resetNewClientForm();
    } catch (error) {
      console.error("Client creation failed", error);
      setClientErrorMessage(
        error instanceof Error ? error.message : "Unable to create the client.",
      );
    } finally {
      setIsSavingClient(false);
    }
  }

  function handlePropertyChange(propertyId: string) {
    const home = homes.find(
      (item) => String(item.id) === String(propertyId),
    );

    const linkedClientId = String(
      home?.clientId ?? home?.client_id ?? form.clientId ?? "",
    );
    const linkedClient = clients.find(
      (client) => String(client.id) === linkedClientId,
    );

    setForm((current) => ({
      ...current,
      propertyId,
      clientId: linkedClientId || current.clientId,
      customerName:
        linkedClient?.name ??
        home?.client?.name ??
        home?.ownerName ??
        current.customerName,
      customerEmail:
        linkedClient?.email ??
        linkedClient?.billing_email ??
        home?.client?.email ??
        home?.ownerEmail ??
        current.customerEmail,
      customerPhone:
        linkedClient?.phone ??
        home?.client?.phone ??
        home?.ownerPhone ??
        current.customerPhone,
      serviceAddress:
        [home?.address, home?.city].filter(Boolean).join(", ") ||
        current.serviceAddress,
      amount:
        home?.cleaningFee === undefined || home?.cleaningFee === null
          ? current.amount
          : String(home.cleaningFee),
    }));
  }

  function resetJobForm() {
    setForm({
      clientId: "",
      propertyId: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceAddress: "",
      jobCategory: "residential",
      jobType: "Standard Residential Cleaning",
      customJobType: "",
      scheduleType: "once",
      recurringEndType: "date",
      recurringEndDate: toInputDate(
        addMonthsKeepingDay(new Date(), 3),
      ),
      occurrenceCount: "12",
      customInterval: "1",
      customIntervalUnit: "days",
      weekdaysOnly: false,
      scheduledDate: toInputDate(new Date()),
      scheduledTime: "10:00",
      assignedUserId: "",
      amount: "",
      notes: "",
    });
    setEditingJob(null);
  }

  function openNewJob() {
    resetJobForm();
    setShowJobCreatedNotice(false);
    setCreatedJobCount(1);
    setErrorMessage("");
    setShowCreateJob(true);
  }

  function openEditJob(job: CleanerJob) {
    setShowJobCreatedNotice(false);
    setEditingJob(job);

    const matchedClient =
      clients.find(
        (client) =>
          Boolean(job.client_id) &&
          String(client.id) === String(job.client_id),
      ) ??
      clients.find(
        (client) =>
          Boolean(job.customer_email) &&
          String(client.email ?? client.billing_email ?? "")
            .trim()
            .toLowerCase() ===
            String(job.customer_email ?? "")
              .trim()
              .toLowerCase(),
      ) ??
      clients.find(
        (client) =>
          String(client.name ?? "")
            .trim()
            .toLowerCase() ===
          String(job.customer_name ?? "")
            .trim()
            .toLowerCase(),
      );

    setForm({
      clientId: matchedClient?.id ?? job.client_id ?? "",
      propertyId: job.property_id ?? "",
      customerName: job.customer_name,
      customerEmail: job.customer_email ?? "",
      customerPhone: job.customer_phone ?? "",
      serviceAddress: job.service_address ?? "",
      jobCategory: "residential",
      jobType: JOB_TYPES.includes(job.job_type) ? job.job_type : "Custom",
      customJobType: JOB_TYPES.includes(job.job_type) ? "" : job.job_type,
      scheduleType: "once",
      recurringEndType: "date",
      recurringEndDate: job.scheduled_date,
      occurrenceCount: "1",
      customInterval: "1",
      customIntervalUnit: "days",
      weekdaysOnly: false,
      scheduledDate: job.scheduled_date,
      scheduledTime: job.scheduled_time ?? "",
      assignedUserId: job.assigned_user_id ?? "",
      amount: String(job.amount_cents / 100),
      notes: job.notes ?? "",
    });
    setSelectedJob(null);
    setErrorMessage("");
    setShowCreateJob(true);
  }

  async function saveJobAssignment(assignedUserId: string) {
    if (!editingJob || !canManageAssignments || assignmentSaving) return;

    setAssignmentSaving(true);
    setAssignmentNotice("");
    setErrorMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        throw new Error("You must be logged in to assign this job.");
      }

      const { data, error } = await supabase
        .from("cleaner_jobs")
        .update({
          assigned_user_id: assignedUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingJob.id)
        .eq("cleaner_id", user.id)
        .select()
        .single();

      if (error) throw error;

      const savedJob = data as CleanerJob;

      setJobs((current) =>
        current.map((job) => (job.id === savedJob.id ? savedJob : job)),
      );
      setEditingJob(savedJob);
      setForm((current) => ({
        ...current,
        assignedUserId: savedJob.assigned_user_id ?? "",
      }));

      const assignedName = savedJob.assigned_user_id
        ? getAssignedCleanerName(savedJob.assigned_user_id)
        : "Unassigned";

      setAssignmentNotice(
        savedJob.assigned_user_id
          ? `✓ Successfully assigned to ${assignedName}`
          : "✓ Assignment removed",
      );

      window.setTimeout(() => {
        setAssignmentNotice("");
      }, 2200);
    } catch (error) {
      console.error("Job assignment autosave failed", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the assignment.",
      );
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const finalJobType =
      form.jobType === "Custom"
        ? form.customJobType.trim()
        : form.jobType.trim();

    if (!editingJob && !form.clientId) {
      setErrorMessage("Select an existing client or create a new client.");
      return;
    }

    if (!form.customerName.trim()) {
      setErrorMessage("Client name is required.");
      return;
    }

    if (!finalJobType) {
      setErrorMessage("Job type is required.");
      return;
    }

    if (!form.scheduledDate) {
      setErrorMessage("Scheduled date is required.");
      return;
    }

    const occurrenceCount =
      form.scheduleType === "once"
        ? 1
        : Math.min(366, Math.max(2, Number(form.occurrenceCount) || 2));

    if (
      form.scheduleType !== "once" &&
      form.recurringEndType === "date" &&
      (!form.recurringEndDate ||
        form.recurringEndDate < form.scheduledDate)
    ) {
      setErrorMessage(
        "The recurring end date must be on or after the first service date.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        throw new Error("You must be logged in to create a job.");
      }

      const basePayload = {
        cleaner_id: user.id,
        assigned_user_id: form.assignedUserId || null,
        property_id: form.propertyId || null,
        client_id: form.clientId || null,
        customer_name: form.customerName.trim(),
        customer_email: form.customerEmail.trim() || null,
        customer_phone: form.customerPhone.trim() || null,
        service_address: form.serviceAddress.trim() || null,
        job_type: finalJobType,
        scheduled_time: form.scheduledTime || null,
        amount_cents: Math.round((Number(form.amount) || 0) * 100),
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingJob) {
        const { data, error } = await supabase
          .from("cleaner_jobs")
          .update({
            ...basePayload,
            scheduled_date: form.scheduledDate,
          })
          .eq("id", editingJob.id)
          .eq("cleaner_id", user.id)
          .select()
          .single();

        if (error) throw error;

        const savedJob = data as CleanerJob;

        setJobs((current) =>
          current
            .map((job) => (job.id === savedJob.id ? savedJob : job))
            .sort((first, second) =>
              `${first.scheduled_date}-${first.scheduled_time ?? ""}`.localeCompare(
                `${second.scheduled_date}-${second.scheduled_time ?? ""}`,
              ),
            ),
        );

        setSelectedJob(savedJob);
        setCreatedJobCount(1);
        setShowJobCreatedNotice(false);
      } else {
        const scheduledDates = buildRecurringDates({
          startDate: form.scheduledDate,
          scheduleType: form.scheduleType,
          endType: form.recurringEndType,
          endDate: form.recurringEndDate,
          occurrenceCount,
          customInterval: Math.max(
            1,
            Number(form.customInterval) || 1,
          ),
          customIntervalUnit: form.customIntervalUnit,
          weekdaysOnly: form.weekdaysOnly,
        });

        if (scheduledDates.length === 0) {
          throw new Error(
            "No recurring jobs fall inside the selected date range.",
          );
        }

        const recurrenceSeriesId =
          form.scheduleType === "once" ? null : crypto.randomUUID();

        const rows = scheduledDates.map((scheduledDate, recurrenceIndex) => ({
          ...basePayload,
          scheduled_date: scheduledDate,
          status: "upcoming" as JobStatus,
          recurrence_series_id: recurrenceSeriesId,
          recurrence_index:
            recurrenceSeriesId === null ? null : recurrenceIndex,
          notes:
            form.scheduleType === "once"
              ? basePayload.notes
              : [
                  basePayload.notes,
                  `Recurring schedule: ${getScheduleLabel(
                    form.scheduleType,
                    Math.max(1, Number(form.customInterval) || 1),
                    form.customIntervalUnit,
                  )} (${scheduledDates.length} jobs created).`,
                ]
                  .filter(Boolean)
                  .join("\n"),
        }));

        const { data, error } = await supabase
          .from("cleaner_jobs")
          .insert(rows)
          .select();

        if (error) throw error;

        const savedJobs = (data ?? []) as CleanerJob[];

        setJobs((current) =>
          [...current, ...savedJobs].sort((first, second) =>
            `${first.scheduled_date}-${first.scheduled_time ?? ""}`.localeCompare(
              `${second.scheduled_date}-${second.scheduled_time ?? ""}`,
            ),
          ),
        );

        setSelectedJob(savedJobs[0] ?? null);
        setCreatedJobCount(savedJobs.length);
        setShowJobCreatedNotice(true);
      }

      setShowCreateJob(false);
      resetJobForm();
    } catch (error) {
      console.error("Job creation failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the job.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateJobStatus(job: CleanerJob, status: JobStatus) {
    setErrorMessage("");

    const { data, error } = await supabase
      .from("cleaner_jobs")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select()
      .single();

    if (error) {
      console.error("Job status update failed", error);
      setErrorMessage(error.message);
      return;
    }

    const updatedJob = data as CleanerJob;

    setJobs((current) =>
      current.map((item) => (item.id === updatedJob.id ? updatedJob : item)),
    );
    setSelectedJob(updatedJob);
  }

  async function deleteJob(job: CleanerJob) {
    setErrorMessage("");

    const recurringNoteSignature = getRecurringNoteSignature(job.notes);
    const isRecurringJob = Boolean(
      job.recurrence_series_id || recurringNoteSignature,
    );

    let deleteMode: "single" | "future" | "series" = "single";

    if (isRecurringJob) {
      const choice = window.prompt(
        [
          `This job appears to be part of a recurring series.`,
          "",
          "Type 1 to delete only this job.",
          "Type 2 to delete this job and all future jobs in the series.",
          "Type 3 to delete the entire recurring series.",
          "",
          "Press Cancel to keep the jobs.",
  ].join("\n"),
  "2",
);

if (choice === null) return;

      if (choice === "1") {
        deleteMode = "single";
      } else if (choice === "2") {
        deleteMode = "future";
      } else if (choice === "3") {
        deleteMode = "series";
      } else {
        window.alert("Enter 1, 2, or 3.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `Delete ${job.job_type} for ${job.customer_name}?`,
      );

      if (!confirmed) return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      setErrorMessage("You must be logged in to delete jobs.");
      return;
    }

    let matchingJobs: CleanerJob[] = [job];

    if (deleteMode !== "single") {
      if (job.recurrence_series_id) {
        matchingJobs = jobs.filter(
          (item) =>
            item.recurrence_series_id === job.recurrence_series_id &&
            (deleteMode === "series" ||
              item.scheduled_date >= job.scheduled_date),
        );
      } else {
        // Legacy recurring jobs created before recurrence_series_id existed.
        // Match only the same cleaner, client/customer, job details, time,
        // amount, and recurring-note signature.
        matchingJobs = jobs.filter((item) => {
          const sameLegacySeries =
            !item.recurrence_series_id &&
            getRecurringNoteSignature(item.notes) === recurringNoteSignature &&
            item.cleaner_id === job.cleaner_id &&
            item.client_id === job.client_id &&
            item.property_id === job.property_id &&
            item.customer_name === job.customer_name &&
            item.job_type === job.job_type &&
            item.scheduled_time === job.scheduled_time &&
            item.amount_cents === job.amount_cents &&
            item.service_address === job.service_address;

          return (
            sameLegacySeries &&
            (deleteMode === "series" ||
              item.scheduled_date >= job.scheduled_date)
          );
        });
      }
    }

    const idsToDelete = matchingJobs.map((item) => item.id);

    if (idsToDelete.length === 0) {
      setErrorMessage("AMR could not find any matching jobs to delete.");
      return;
    }

    const finalConfirmation = window.confirm(
      idsToDelete.length === 1
        ? `Delete ${job.job_type} for ${job.customer_name}?`
        : `Delete ${idsToDelete.length} recurring jobs? This cannot be undone.`,
    );

    if (!finalConfirmation) return;

    const { error } = await supabase
      .from("cleaner_jobs")
      .delete()
      .eq("cleaner_id", user.id)
      .in("id", idsToDelete);

    if (error) {
      console.error("Job delete failed", error);
      setErrorMessage(error.message);
      return;
    }

    const deletedIdSet = new Set(idsToDelete);

    setJobs((current) =>
      current.filter((item) => !deletedIdSet.has(item.id)),
    );
    setSelectedJob(null);
    setShowJobCreatedNotice(false);
  }

  function createInvoiceForJob(job: CleanerJob) {
    const home = homes.find(
      (item) => String(item.id) === String(job.property_id),
    );

    onCreateInvoiceFromJob({
      id: job.id,
      isCleanerJob: true,
      homeId: job.property_id ?? "",
      clientId: job.client_id ?? "",
      customerName: job.customer_name,
      customerEmail: job.customer_email ?? "",
      customerPhone: job.customer_phone ?? "",
      propertyName: home?.name ?? job.service_address ?? "Independent Job",
      jobType: job.job_type,
      amount: job.amount_cents / 100,
      price: job.amount_cents / 100,
      scheduledDate: job.scheduled_date,
      notes: job.notes ?? "",
    });
  }

  return (
    <main className="cleanerJobsPage">
      {assignmentNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "22px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1300,
            padding: "12px 18px",
            border: "1px solid #86efac",
            borderRadius: "12px",
            background: "#f0fdf4",
            color: "#166534",
            fontWeight: 800,
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
          }}
        >
          {assignmentNotice}
        </div>
      )}

      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">Work Manager</p>
          <h1>Jobs</h1>
          <p className="cleanerPropertiesSubtitle">
            Schedule one-time or recurring residential, commercial, and
            vacation-rental work.
          </p>
        </div>

        <button
          className="cleanerPropertyAddButton"
          type="button"
          onClick={openNewJob}
        >
          + Create Job
        </button>
      </header>

      <section className="cleanerPropertiesMetrics" aria-label="Job summary">
        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">💼</div>
          <div>
            <strong>{jobs.length}</strong>
            <span>All Jobs</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">📅</div>
          <div>
            <strong>{upcomingCount}</strong>
            <span>Upcoming</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">⏳</div>
          <div>
            <strong>{inProgressCount}</strong>
            <span>In Progress</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">💵</div>
          <div>
            <strong>{readyCount}</strong>
            <span>{isAssignedTeamCleaner ? "Completed" : "Ready to Invoice"}</span>
          </div>
        </article>
      </section>

      <section className="cleanerPropertiesToolbar">
        <label className="cleanerPropertiesSearch">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search jobs or clients..."
            aria-label="Search jobs"
          />
        </label>

        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          aria-label="Filter jobs by status"
        >
          <option value="all">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">
            {isAssignedTeamCleaner ? "Completed" : "Ready to Invoice"}
          </option>
          {!isAssignedTeamCleaner && (
            <>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </>
          )}
          <option value="cancelled">Cancelled</option>
        </select>
      </section>

      {errorMessage && !showCreateJob && (
        <section className="emptyStateCard">
          <strong>Job error</strong>
          <p>{errorMessage}</p>
        </section>
      )}

      {isLoading ? (
        <section className="emptyStateCard">
          <strong>Loading jobs…</strong>
        </section>
      ) : filteredJobs.length === 0 ? (
        <section className="cleanerPropertiesFirstProperty">
          <div className="cleanerPropertiesFirstPropertyIcon">💼</div>
          <p className="cleanerPropertiesEyebrow">Start here</p>
          <h2>Create your first job</h2>
          <p>
            Select a client, choose one-time or recurring service, and place the
            work directly on your schedule.
          </p>

          <button
            className="cleanerCreateFirstPropertyButton"
            type="button"
            onClick={openNewJob}
          >
            Create Job <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <section className="cleanerPropertiesGrid">
          {filteredJobs.map((job) => (
            <article
              className="cleanerPropertyCard"
              key={job.id}
              role="button"
              tabIndex={0}
              aria-label={`Edit ${job.job_type} for ${job.customer_name}`}
              onClick={() => openEditJob(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openEditJob(job);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="cleanerPropertyCardBody">
                <div className="cleanerPropertyCardTitleRow">
                  <div>
                    <p className="cleanerPropertyCardLabel">Job</p>
                    <h2>{job.job_type}</h2>
                  </div>

                  <span
                    className={`cleanerInvoiceStatusBadge status-${job.status}`}
                  >
                    {getVisibleStatusLabel(job.status)}
                  </span>
                </div>

                <p className="cleanerPropertyOwner">{job.customer_name}</p>

                <p className="cleanerPropertyAddress">
                  <span aria-hidden="true">📍</span>
                  {job.service_address || "Address not added"}
                </p>

                <p
                  className="cleanerPropertyOwner"
                  style={{
                    color: job.assigned_user_id ? "#475569" : "#b91c1c",
                    fontWeight: 800,
                  }}
                >
                  {job.assigned_user_id ? "👤" : "⚠️"}{" "}
                  {getAssignedCleanerName(job.assigned_user_id)}
                </p>

                <div className="cleanerPropertyCardStats">
                  <div>
                    <span>Date</span>
                    <strong>{formatJobDate(job.scheduled_date)}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>{job.scheduled_time || "Not set"}</strong>
                  </div>
                  <div>
                    <span>Price</span>
                    <strong>{formatMoney(job.amount_cents)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{getVisibleStatusLabel(job.status)}</strong>
                  </div>
                </div>

                <div className="cleanerPropertyCardActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditJob(job);
                    }}
                  >
                    Edit Job
                  </button>

                  {job.status === "upcoming" && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateJobStatus(job, "in_progress");
                      }}
                    >
                      Start Job
                    </button>
                  )}

                  {job.status === "in_progress" && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateJobStatus(job, "completed");
                      }}
                    >
                      Complete Job
                    </button>
                  )}

                  {job.status === "completed" && !isAssignedTeamCleaner && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        createInvoiceForJob(job);
                      }}
                    >
                      Create Invoice
                    </button>
                  )}

                  {isAssignedTeamCleaner &&
                    ["completed", "invoiced", "paid"].includes(job.status) && (
                      <button
                        className="primaryButton"
                        type="button"
                        disabled
                        onClick={(event) => event.stopPropagation()}
                      >
                        ✓ Completed
                      </button>
                    )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedJob && (
        <div
          className="modalOverlay"
          onClick={() => {
            setSelectedJob(null);
            setShowJobCreatedNotice(false);
          }}
        >
          <section
            className="modalCard cleanerJobCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">Job details</p>
                <h3>{selectedJob.job_type}</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  setShowJobCreatedNotice(false);
                }}
              >
                Close
              </button>
            </div>

            {showJobCreatedNotice && (
              <section
                className="cleanerJobCreatedNotice"
                role="status"
                aria-live="polite"
              >
                <div className="cleanerJobCreatedNoticeIcon" aria-hidden="true">
                  ✓
                </div>

                <div className="cleanerJobCreatedNoticeCopy">
                  <strong>
                    {createdJobCount > 1
                      ? `${createdJobCount} recurring jobs created`
                      : "Job created successfully"}
                  </strong>
                  <p>
                    {createdJobCount > 1
                      ? "The first job is shown here. Every occurrence is now on your schedule."
                      : "This job is now on your schedule and ready to track from the Schedule page."}
                  </p>
                </div>
              </section>
            )}

            <section className="cleanerJobSection">
              <p>
                <strong>Client:</strong> {selectedJob.customer_name}
              </p>
              <p>
                <strong>Email:</strong> {selectedJob.customer_email || "—"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedJob.customer_phone || "—"}
              </p>
              <p>
                <strong>Address:</strong>{" "}
                {selectedJob.service_address || "—"}
              </p>
              <p>
                <strong>Scheduled:</strong>{" "}
                {formatJobDate(selectedJob.scheduled_date)}{" "}
                {selectedJob.scheduled_time || ""}
              </p>
              <p>
                <strong>Price:</strong>{" "}
                {formatMoney(selectedJob.amount_cents)}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {getVisibleStatusLabel(selectedJob.status)}
              </p>
              <p
                style={{
                  color: selectedJob.assigned_user_id ? undefined : "#b91c1c",
                  fontWeight: selectedJob.assigned_user_id ? undefined : 800,
                }}
              >
                <strong>Assigned to:</strong>{" "}
                {selectedJob.assigned_user_id ? "👤 " : "⚠️ "}
                {getAssignedCleanerName(selectedJob.assigned_user_id)}
              </p>
              <p>
                <strong>Notes:</strong> {selectedJob.notes || "—"}
              </p>
            </section>

            <div className="cleanerJobPrimaryActions">
              {selectedJob.status === "upcoming" && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    void updateJobStatus(selectedJob, "in_progress")
                  }
                >
                  Start Job
                </button>
              )}

              {selectedJob.status === "in_progress" && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    void updateJobStatus(selectedJob, "completed")
                  }
                >
                  Complete Job
                </button>
              )}

              {selectedJob.status === "completed" && !isAssignedTeamCleaner && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => createInvoiceForJob(selectedJob)}
                >
                  Create Invoice
                </button>
              )}

              {isAssignedTeamCleaner &&
                ["completed", "invoiced", "paid"].includes(selectedJob.status) && (
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
                    ✓ Job completed. Your employer has been notified.
                  </div>
                )}

              <button
                className="secondaryButton"
                type="button"
                onClick={() => openEditJob(selectedJob)}
              >
                Edit Job
              </button>

              <button
                className="cleanerPropertyDeleteButton"
                type="button"
                onClick={() => void deleteJob(selectedJob)}
              >
                Delete Job
              </button>
            </div>
          </section>
        </div>
      )}

      {showCreateJob && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (isSaving) return;
            setShowCreateJob(false);
            resetJobForm();
          }}
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">
                  {editingJob ? "Edit job" : "New job"}
                </p>
                <h3>{editingJob ? "Update Job" : "Create Job"}</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setShowCreateJob(false);
                  resetJobForm();
                }}
              >
                Close
              </button>
            </div>

            <form className="cleanerIssueForm" onSubmit={createJob}>
              {canManageAssignments && (
                <label>
                  Assigned to
                  <select
                    value={form.assignedUserId}
                    disabled={assignmentSaving}
                    onChange={(event) => {
                      const assignedUserId = event.target.value;

                      setForm((current) => ({
                        ...current,
                        assignedUserId,
                      }));

                      if (editingJob) {
                        void saveJobAssignment(assignedUserId);
                      }
                    }}
                    style={{
                      borderColor: form.assignedUserId
                        ? undefined
                        : "#fca5a5",
                      background: form.assignedUserId
                        ? undefined
                        : "#fff1f2",
                      color: form.assignedUserId
                        ? undefined
                        : "#b91c1c",
                      fontWeight: 800,
                    }}
                  >
                    <option value="">⚠ Unassigned</option>
                    {assignableCleaners.map((cleaner) => {
                      const assignmentId = getCleanerAssignmentId(cleaner);

                      if (!assignmentId) return null;

                      return (
                        <option
                          key={assignmentId}
                          value={assignmentId}
                        >
                          👤 {getCleanerDisplayName(cleaner)}
                        </option>
                      );
                    })}
                  </select>
                  <small>
                    {editingJob
                      ? assignmentSaving
                        ? "Saving assignment…"
                        : "Assignment saves automatically."
                      : "Choose who is responsible for this job, or leave it unassigned for the Pulse assignment queue."}
                  </small>
                </label>
              )}

              <label>
                Client
                <select
                  value={form.clientId}
                  onChange={(event) => handleClientChange(event.target.value)}
                >
                  <option value="">Select a client</option>
                  <option value="__create_new__">+ Create New Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <small>
                  Changing the client updates the contact details below.
                </small>
              </label>

              {form.jobCategory === "vacation_rental" && (
                <label>
                  Linked vacation rental (optional)
                  <select
                    value={form.propertyId}
                    onChange={(event) =>
                      handlePropertyChange(event.target.value)
                    }
                  >
                    <option value="">No linked vacation rental</option>
                    {homes.map((home) => (
                      <option key={home.id} value={home.id}>
                        {home.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Only choose a property when this job is for one of your
                    managed vacation rentals.
                  </small>
                </label>
              )}

              <label>
                Contact name
                <input
                  value={form.customerName}
                  onChange={(event) =>
                    setForm({ ...form, customerName: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Contact email
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) =>
                    setForm({ ...form, customerEmail: event.target.value })
                  }
                />
              </label>

              <label>
                Contact phone
                <input
                  value={form.customerPhone}
                  onChange={(event) =>
                    setForm({ ...form, customerPhone: event.target.value })
                  }
                />
              </label>

              <label>
                Service category
                <select
                  value={form.jobCategory}
                  onChange={(event) => {
                    const jobCategory = event.target.value;
                    setForm({
                      ...form,
                      jobCategory,
                      propertyId:
                        jobCategory === "vacation_rental"
                          ? form.propertyId
                          : "",
                    });
                  }}
                >
                  <option value="residential">Residential</option>
                  <option value="vacation_rental">Vacation Rental</option>
                  <option value="commercial">Commercial</option>
                </select>
              </label>

              <label className="fullWidth">
                Service address
                <input
                  value={form.serviceAddress}
                  onChange={(event) =>
                    setForm({ ...form, serviceAddress: event.target.value })
                  }
                />
              </label>

              <label>
                Job type
                <select
                  value={form.jobType}
                  onChange={(event) =>
                    setForm({ ...form, jobType: event.target.value })
                  }
                >
                  {JOB_TYPES.map((jobType) => (
                    <option key={jobType} value={jobType}>
                      {jobType}
                    </option>
                  ))}
                </select>
              </label>

              {form.jobType === "Custom" && (
                <label>
                  Custom job name
                  <input
                    value={form.customJobType}
                    onChange={(event) =>
                      setForm({ ...form, customJobType: event.target.value })
                    }
                    placeholder="Example: Window cleaning"
                    required
                  />
                </label>
              )}

              <label>
                Price per job
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  placeholder="0.00"
                />
              </label>

              <label>
                Schedule
                <select
                  value={form.scheduleType}
                  disabled={Boolean(editingJob)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      scheduleType: event.target.value as ScheduleType,
                    })
                  }
                >
                  <option value="once">One time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom interval</option>
                </select>
              </label>

              {form.scheduleType === "custom" && !editingJob && (
                <>
                  <label>
                    Repeat every
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={form.customInterval}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          customInterval: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Interval
                    <select
                      value={form.customIntervalUnit}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          customIntervalUnit:
                            event.target.value as CustomIntervalUnit,
                        })
                      }
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </label>
                </>
              )}

              {form.scheduleType !== "once" && !editingJob && (
                <label>
                  Weekend scheduling
                  <select
                    value={form.weekdaysOnly ? "weekdays" : "all_days"}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        weekdaysOnly: event.target.value === "weekdays",
                      })
                    }
                  >
                    <option value="all_days">
                      Include Saturdays and Sundays
                    </option>
                    <option value="weekdays">
                      Weekdays only (Monday–Friday)
                    </option>
                  </select>
                </label>
              )}

              <label>
                {form.scheduleType === "once" || editingJob
                  ? "Scheduled date"
                  : "First service date"}
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      scheduledDate: event.target.value,
                    })
                  }
                  required
                />
              </label>

              {form.scheduleType !== "once" && !editingJob && (
                <label>
                  Ends
                  <select
                    value={form.recurringEndType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        recurringEndType:
                          event.target.value as RecurringEndType,
                      })
                    }
                  >
                    <option value="date">On a specific date</option>
                    <option value="count">After a number of visits</option>
                  </select>
                </label>
              )}

              {form.scheduleType !== "once" &&
                !editingJob &&
                form.recurringEndType === "date" && (
                  <label>
                    Last service date
                    <input
                      type="date"
                      min={form.scheduledDate}
                      value={form.recurringEndDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          recurringEndDate: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                )}

              {form.scheduleType !== "once" &&
                !editingJob &&
                form.recurringEndType === "count" && (
                  <label>
                    Number of visits
                    <input
                      type="number"
                      min="2"
                      max="366"
                      value={form.occurrenceCount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          occurrenceCount: event.target.value,
                        })
                      }
                    />
                  </label>
                )}

              <label>
                Scheduled time
                <input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(event) =>
                    setForm({ ...form, scheduledTime: event.target.value })
                  }
                />
              </label>

              {form.scheduleType !== "once" && !editingJob && (
                <p className="fullWidth">
                  AMR will create each scheduled visit automatically from the
                  first service date through{" "}
                  {form.recurringEndType === "date"
                    ? form.recurringEndDate || "the selected end date"
                    : `${Number(form.occurrenceCount) || 0} total visits`}.
                  {form.weekdaysOnly
                    ? " Weekend dates will be skipped and weekday intervals will count Monday through Friday."
                    : ""}
                  Every visit can be started, completed, edited, or invoiced
                  independently.
                </p>
              )}

              <label className="fullWidth">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Scope of work, access information, supplies, or special instructions..."
                />
              </label>

              {errorMessage && <p className="fullWidth">{errorMessage}</p>}

              <button
                className="primaryButton"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? editingJob
                    ? "Saving Changes…"
                    : form.scheduleType === "once"
                      ? "Creating Job…"
                      : "Creating Recurring Jobs…"
                  : editingJob
                    ? "Save Changes"
                    : form.scheduleType === "once"
                      ? "Create Job"
                      : "Create Recurring Jobs"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showCreateClient && (
        <div
          className="modalOverlay"
          style={{ zIndex: 1100 }}
          onClick={() => {
            if (isSavingClient) return;
            setShowCreateClient(false);
            resetNewClientForm();
          }}
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">New client</p>
                <h3>Create Client</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                disabled={isSavingClient}
                onClick={() => {
                  setShowCreateClient(false);
                  resetNewClientForm();
                }}
              >
                Close
              </button>
            </div>

            <form className="cleanerIssueForm" onSubmit={createClient}>
              <label>
                Client name
                <input
                  value={newClientForm.name}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="Client or company name"
                  autoFocus
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      email: event.target.value,
                    })
                  }
                  placeholder="client@example.com"
                />
              </label>

              <label>
                Phone
                <input
                  value={newClientForm.phone}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      phone: event.target.value,
                    })
                  }
                  placeholder="Phone number"
                />
              </label>

              <label>
                Billing email
                <input
                  type="email"
                  value={newClientForm.billingEmail}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      billingEmail: event.target.value,
                    })
                  }
                  placeholder="Optional billing email"
                />
              </label>

              <label className="fullWidth">
                Default service address
                <input
                  value={newClientForm.addressLine1}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      addressLine1: event.target.value,
                    })
                  }
                  placeholder="Street address"
                />
              </label>

              <label className="fullWidth">
                Address line 2
                <input
                  value={newClientForm.addressLine2}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      addressLine2: event.target.value,
                    })
                  }
                  placeholder="Apartment, suite, unit, etc. (optional)"
                />
              </label>

              <label>
                City
                <input
                  value={newClientForm.city}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      city: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                State
                <input
                  value={newClientForm.state}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      state: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                ZIP
                <input
                  value={newClientForm.zip}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      zip: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Preferred language
                <select
                  value={newClientForm.preferredLanguage}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      preferredLanguage: event.target.value,
                    })
                  }
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </label>

              <label className="fullWidth">
                Notes
                <textarea
                  value={newClientForm.notes}
                  onChange={(event) =>
                    setNewClientForm({
                      ...newClientForm,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Optional client notes..."
                />
              </label>

              {clientErrorMessage && (
                <p className="fullWidth">{clientErrorMessage}</p>
              )}

              <button
                className="primaryButton"
                type="submit"
                disabled={isSavingClient}
              >
                {isSavingClient ? "Creating Client…" : "Create Client"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
