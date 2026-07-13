import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

type JobStatus =
  | "upcoming"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "paid"
  | "cancelled";

type CleanerJob = {
  id: string;
  cleaner_id: string;
  property_id: string | null;
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
  created_at: string;
};

type CleanerJobsPageProps = {
  homes: any[];
  onCreateInvoiceFromJob: (job: any) => void;
};

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

export default function CleanerJobsPage({
  homes,
  onCreateInvoiceFromJob,
}: CleanerJobsPageProps) {
  const [jobs, setJobs] = useState<CleanerJob[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CleanerJob | null>(null);
  const [editingJob, setEditingJob] = useState<CleanerJob | null>(null);
  const [showJobCreatedNotice, setShowJobCreatedNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    propertyId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceAddress: "",
    jobType: "",
    scheduledDate: toInputDate(new Date()),
    scheduledTime: "10:00",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    void loadJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesStatus =
        selectedStatus === "all" || job.status === selectedStatus;

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
  }, [jobs, searchTerm, selectedStatus]);

  const upcomingCount = jobs.filter((job) => job.status === "upcoming").length;
  const inProgressCount = jobs.filter(
    (job) => job.status === "in_progress"
  ).length;
  const readyCount = jobs.filter((job) => job.status === "completed").length;

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

    const { data, error } = await supabase
      .from("cleaner_jobs")
      .select("*")
      .eq("cleaner_id", user.id)
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

  function handlePropertyChange(propertyId: string) {
    const home = homes.find(
      (item) => String(item.id) === String(propertyId)
    );

    setForm((current) => ({
      ...current,
      propertyId,
      customerName: home?.ownerName ?? current.customerName,
      customerEmail: home?.ownerEmail ?? current.customerEmail,
      customerPhone: home?.ownerPhone ?? current.customerPhone,
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
      propertyId: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceAddress: "",
      jobType: "",
      scheduledDate: toInputDate(new Date()),
      scheduledTime: "10:00",
      amount: "",
      notes: "",
    });
    setEditingJob(null);
  }

  function openNewJob() {
    resetJobForm();
    setShowJobCreatedNotice(false);
    setErrorMessage("");
    setShowCreateJob(true);
  }

  function openEditJob(job: CleanerJob) {
    setShowJobCreatedNotice(false);
    setEditingJob(job);
    setForm({
      propertyId: job.property_id ?? "",
      customerName: job.customer_name,
      customerEmail: job.customer_email ?? "",
      customerPhone: job.customer_phone ?? "",
      serviceAddress: job.service_address ?? "",
      jobType: job.job_type,
      scheduledDate: job.scheduled_date,
      scheduledTime: job.scheduled_time ?? "",
      amount: String(job.amount_cents / 100),
      notes: job.notes ?? "",
    });
    setSelectedJob(null);
    setErrorMessage("");
    setShowCreateJob(true);
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.customerName.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }

    if (!form.jobType.trim()) {
      setErrorMessage("Job name is required.");
      return;
    }

    if (!form.scheduledDate) {
      setErrorMessage("Scheduled date is required.");
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

      const payload = {
        cleaner_id: user.id,
        property_id: form.propertyId || null,
        customer_name: form.customerName.trim(),
        customer_email: form.customerEmail.trim() || null,
        customer_phone: form.customerPhone.trim() || null,
        service_address: form.serviceAddress.trim() || null,
        job_type: form.jobType.trim(),
        scheduled_date: form.scheduledDate,
        scheduled_time: form.scheduledTime || null,
        amount_cents: Math.round((Number(form.amount) || 0) * 100),
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const query = editingJob
        ? supabase
            .from("cleaner_jobs")
            .update(payload)
            .eq("id", editingJob.id)
            .eq("cleaner_id", user.id)
        : supabase
            .from("cleaner_jobs")
            .insert({
              ...payload,
              status: "upcoming",
            });

      const { data, error } = await query.select().single();

      if (error) throw error;

      const savedJob = data as CleanerJob;
      const wasEditingJob = Boolean(editingJob);

      setJobs((current) => {
        const nextJobs = editingJob
          ? current.map((job) => (job.id === savedJob.id ? savedJob : job))
          : [...current, savedJob];

        return nextJobs.sort((first, second) =>
          `${first.scheduled_date}-${first.scheduled_time ?? ""}`.localeCompare(
            `${second.scheduled_date}-${second.scheduled_time ?? ""}`
          )
        );
      });

      setSelectedJob(savedJob);
      setShowJobCreatedNotice(!wasEditingJob);
      setShowCreateJob(false);
      resetJobForm();
    } catch (error) {
      console.error("Job creation failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the job."
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
      current.map((item) => (item.id === updatedJob.id ? updatedJob : item))
    );
    setSelectedJob(updatedJob);
  }

  async function deleteJob(job: CleanerJob) {
    const confirmed = window.confirm(
      `Delete ${job.job_type} for ${job.customer_name}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("cleaner_jobs")
      .delete()
      .eq("id", job.id);

    if (error) {
      console.error("Job delete failed", error);
      setErrorMessage(error.message);
      return;
    }

    setJobs((current) => current.filter((item) => item.id !== job.id));
    setSelectedJob(null);
  }

  function createInvoiceForJob(job: CleanerJob) {
    const home = homes.find(
      (item) => String(item.id) === String(job.property_id)
    );

    onCreateInvoiceFromJob({
      id: job.id,
      isCleanerJob: true,
      homeId: job.property_id ?? "",
      customerName: job.customer_name,
      customerEmail: job.customer_email ?? "",
      customerPhone: job.customer_phone ?? "",
      propertyName: home?.name ?? job.service_address ?? "Manual Job",
      jobType: job.job_type,
      amount: job.amount_cents / 100,
      price: job.amount_cents / 100,
      scheduledDate: job.scheduled_date,
      notes: job.notes ?? "",
    });
  }

  return (
    <main className="cleanerJobsPage">
      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">Work Manager</p>
          <h1>Jobs</h1>
          <p className="cleanerPropertiesSubtitle">
            Create, schedule, complete, and invoice independent cleaning jobs.
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
            <span>Ready to Invoice</span>
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
            placeholder="Search jobs..."
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
          <option value="completed">Ready to Invoice</option>
          <option value="invoiced">Invoiced</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </section>

      {errorMessage && (
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
          <h2>Create your first independent job</h2>
          <p>
            Add a customer, schedule the work, complete it, and send an invoice.
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
            <article className="cleanerPropertyCard" key={job.id}>
              <div className="cleanerPropertyCardBody">
                <div className="cleanerPropertyCardTitleRow">
                  <div>
                    <p className="cleanerPropertyCardLabel">Job</p>
                    <h2>{job.job_type}</h2>
                  </div>

                  <span
                    className={`cleanerInvoiceStatusBadge status-${job.status}`}
                  >
                    {getStatusLabel(job.status)}
                  </span>
                </div>

                <p className="cleanerPropertyOwner">{job.customer_name}</p>

                <p className="cleanerPropertyAddress">
                  <span aria-hidden="true">📍</span>
                  {job.service_address || "Address not added"}
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
                    <strong>{getStatusLabel(job.status)}</strong>
                  </div>
                </div>

                <div className="cleanerPropertyCardActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => {
                      setShowJobCreatedNotice(false);
                      setSelectedJob(job);
                    }}
                  >
                    Open Job
                  </button>

                  {job.status === "upcoming" && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={() => void updateJobStatus(job, "in_progress")}
                    >
                      Start Job
                    </button>
                  )}

                  {job.status === "in_progress" && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={() => void updateJobStatus(job, "completed")}
                    >
                      Complete Job
                    </button>
                  )}

                  {job.status === "completed" && (
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={() => createInvoiceForJob(job)}
                    >
                      Create Invoice
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
                  <strong>Job created successfully</strong>
                  <p>
                    This job is now on your schedule and ready to track from the
                    Schedule page.
                  </p>
                </div>
              </section>
            )}

            <section className="cleanerJobSection">
              <p><strong>Customer:</strong> {selectedJob.customer_name}</p>
              <p><strong>Email:</strong> {selectedJob.customer_email || "—"}</p>
              <p><strong>Phone:</strong> {selectedJob.customer_phone || "—"}</p>
              <p><strong>Address:</strong> {selectedJob.service_address || "—"}</p>
              <p>
                <strong>Scheduled:</strong>{" "}
                {formatJobDate(selectedJob.scheduled_date)}{" "}
                {selectedJob.scheduled_time || ""}
              </p>
              <p><strong>Price:</strong> {formatMoney(selectedJob.amount_cents)}</p>
              <p><strong>Status:</strong> {getStatusLabel(selectedJob.status)}</p>
              <p><strong>Notes:</strong> {selectedJob.notes || "—"}</p>
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

              {selectedJob.status === "completed" && (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => createInvoiceForJob(selectedJob)}
                >
                  Create Invoice
                </button>
              )}

              {["upcoming", "in_progress"].includes(selectedJob.status) && (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => openEditJob(selectedJob)}
                >
                  Edit Job
                </button>
              )}

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
              <label>
                Existing property
                <select
                  value={form.propertyId}
                  onChange={(event) =>
                    handlePropertyChange(event.target.value)
                  }
                >
                  <option value="">Manual customer / address</option>
                  {homes.map((home) => (
                    <option key={home.id} value={home.id}>
                      {home.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Customer name
                <input
                  value={form.customerName}
                  onChange={(event) =>
                    setForm({ ...form, customerName: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Customer email
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) =>
                    setForm({ ...form, customerEmail: event.target.value })
                  }
                />
              </label>

              <label>
                Customer phone
                <input
                  value={form.customerPhone}
                  onChange={(event) =>
                    setForm({ ...form, customerPhone: event.target.value })
                  }
                />
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
                Job name
                <input
                  value={form.jobType}
                  onChange={(event) =>
                    setForm({ ...form, jobType: event.target.value })
                  }
                  placeholder="Example: Deep clean, office cleaning, move-out clean"
                  required
                />
              </label>

              <label>
                Price
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
                Scheduled date
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) =>
                    setForm({ ...form, scheduledDate: event.target.value })
                  }
                  required
                />
              </label>

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

              {errorMessage && <p>{errorMessage}</p>}

              <button
                className="primaryButton"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? editingJob
                    ? "Saving Changes…"
                    : "Creating Job…"
                  : editingJob
                    ? "Save Changes"
                    : "Create Job"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
