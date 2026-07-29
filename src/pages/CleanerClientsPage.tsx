import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

type ClientRecord = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_email: string | null;
  preferred_language: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
};

type CleanerClientsPageProps = {
  homes: any[];
};

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  billingEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  preferredLanguage: string;
  notes: string;
};

const EMPTY_FORM: ClientFormState = {
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
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "Not scheduled";

  return new Date(`${dateValue}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatClientAddress(client: ClientRecord) {
  const street = [client.address_line_1, client.address_line_2]
    .filter(Boolean)
    .join(", ");
  const cityStateZip = [
    client.city,
    [client.state, client.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [street, cityStateZip].filter(Boolean).join(", ");
}

export default function CleanerClientsPage({
  homes,
}: CleanerClientsPageProps) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(
    null,
  );
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadClientWorkspace();
  }, []);

  async function loadClientWorkspace() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setErrorMessage("You must be logged in to view clients.");
      setIsLoading(false);
      return;
    }

    const [clientResult, jobResult, invoiceResult] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("owner_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("cleaner_jobs")
        .select("*")
        .eq("cleaner_id", user.id)
        .order("scheduled_date", { ascending: true }),
      supabase
        .from("invoices")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (clientResult.error) {
      setErrorMessage(clientResult.error.message);
      setIsLoading(false);
      return;
    }

    setClients((clientResult.data ?? []) as ClientRecord[]);

    if (!jobResult.error) {
      setJobs(jobResult.data ?? []);
    } else {
      console.warn("Client jobs could not be loaded", jobResult.error);
    }

    if (!invoiceResult.error) {
      setInvoices(invoiceResult.data ?? []);
    } else {
      console.warn("Client invoices could not be loaded", invoiceResult.error);
    }

    setIsLoading(false);
  }

  const filteredClients = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) return clients;

    return clients.filter((client) =>
      [
        client.name,
        client.email,
        client.phone,
        client.billing_email,
        client.address_line_1,
        client.address_line_2,
        client.city,
        client.state,
        client.zip,
        client.preferred_language,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [clients, searchTerm]);

  function getClientProperties(clientId: string) {
    return homes.filter(
      (home) =>
        String(home.clientId ?? home.client_id ?? "") === String(clientId),
    );
  }

  function getClientJobs(client: ClientRecord) {
    return jobs.filter(
      (job) => String(job.client_id ?? "") === String(client.id),
    );
  }

  function getClientInvoices(client: ClientRecord) {
    return invoices.filter((invoice) => {
      if (invoice.client_id) {
        return String(invoice.client_id) === String(client.id);
      }

      const invoiceEmail = String(
        invoice.customer_email ??
          invoice.client_email ??
          invoice.email ??
          "",
      ).toLowerCase();

      const invoiceName = String(
        invoice.customer_name ??
          invoice.client_name ??
          invoice.bill_to_name ??
          "",
      ).toLowerCase();

      return (
        (client.email &&
          invoiceEmail === String(client.email).toLowerCase()) ||
        invoiceName === String(client.name).toLowerCase()
      );
    });
  }

  function openNewClient() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setErrorMessage("");
    setShowClientForm(true);
  }

  function openEditClient(client: ClientRecord) {
    setEditingClient(client);
    setForm({
      name: client.name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      billingEmail: client.billing_email ?? "",
      addressLine1: client.address_line_1 ?? "",
      addressLine2: client.address_line_2 ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      zip: client.zip ?? "",
      preferredLanguage: client.preferred_language ?? "English",
      notes: client.notes ?? "",
    });
    setSelectedClient(null);
    setErrorMessage("");
    setShowClientForm(true);
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.name.trim()) {
      setErrorMessage("Client name is required.");
      return;
    }

    if (!form.email.trim() && !form.phone.trim()) {
      setErrorMessage("Add an email address or phone number.");
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        throw new Error("You must be logged in to save a client.");
      }

      const payload = {
        owner_id: user.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        billing_email: form.billingEmail.trim() || null,
        address_line_1: form.addressLine1.trim() || null,
        address_line_2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        preferred_language: form.preferredLanguage || "English",
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const query = editingClient
        ? supabase
            .from("clients")
            .update(payload)
            .eq("id", editingClient.id)
            .eq("owner_id", user.id)
        : supabase.from("clients").insert(payload);

      const { data, error } = await query.select("*").single();

      if (error) throw error;

      const savedClient = data as ClientRecord;

      setClients((current) => {
        const next = editingClient
          ? current.map((client) =>
              client.id === savedClient.id ? savedClient : client,
            )
          : [...current, savedClient];

        return next.sort((first, second) =>
          first.name.localeCompare(second.name),
        );
      });

      setSelectedClient(savedClient);
      setShowClientForm(false);
      setEditingClient(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the client.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteClient(client: ClientRecord) {
    const linkedProperties = getClientProperties(client.id);
    const linkedJobs = getClientJobs(client);

    if (linkedProperties.length > 0 || linkedJobs.length > 0) {
      window.alert(
        `${client.name} cannot be deleted while linked to ${linkedProperties.length} propert${linkedProperties.length === 1 ? "y" : "ies"} and ${linkedJobs.length} job${linkedJobs.length === 1 ? "" : "s"}. Reassign or remove those records first.`,
      );
      return;
    }

    const confirmation = window.prompt(
      `Type DELETE to permanently remove ${client.name}.`,
    );

    if (confirmation !== "DELETE") return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setClients((current) =>
      current.filter((item) => item.id !== client.id),
    );
    setSelectedClient(null);
  }

  const totalProperties = clients.reduce(
    (total, client) => total + getClientProperties(client.id).length,
    0,
  );
  const upcomingJobs = jobs.filter(
    (job) =>
      job.status === "upcoming" &&
      String(job.scheduled_date ?? "") >= new Date().toISOString().slice(0, 10),
  ).length;
  const outstandingInvoiceTotal = invoices
    .filter((invoice) =>
      ["sent", "viewed", "overdue", "outstanding"].includes(
        String(invoice.status ?? "").toLowerCase(),
      ),
    )
    .reduce(
      (total, invoice) =>
        total +
        Number(
          invoice.amount_cents ??
            invoice.total_cents ??
            invoice.balance_due_cents ??
            0,
        ),
      0,
    );

  return (
    <main className="cleanerClientsPage">
      <style>{`
        .cleanerClientsPage { display:grid; gap:22px; }
        .clientCardMeta { display:grid; gap:8px; margin:16px 0; color:#475569; }
        .clientCardMeta span { display:flex; gap:8px; align-items:center; }
        .clientStatsGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:16px; }
        .clientStatsGrid div { padding:12px; border-radius:14px; background:#f8fafc; border:1px solid #e2e8f0; }
        .clientStatsGrid span { display:block; color:#64748b; font-size:12px; font-weight:700; }
        .clientStatsGrid strong { display:block; margin-top:4px; color:#0f172a; }
        .clientDetailSection { margin-top:18px; padding-top:16px; border-top:1px solid #e2e8f0; }
        .clientDetailSection h4 { margin:0 0 10px; }
        .clientDetailList { display:grid; gap:9px; }
        .clientDetailRow { display:flex; justify-content:space-between; gap:14px; padding:11px 12px; border:1px solid #e2e8f0; border-radius:12px; }
        .clientDetailRow span { color:#64748b; }
        @media(max-width:700px){ .clientStatsGrid{grid-template-columns:1fr;} }
      `}</style>

      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">Customer Database</p>
          <h1>Clients</h1>
          <p className="cleanerPropertiesSubtitle">
            Manage client contact details, service addresses, vacation rentals, jobs, and billing relationships in one place.
          </p>
        </div>

        <button
          className="cleanerPropertyAddButton"
          type="button"
          onClick={openNewClient}
        >
          + Create Client
        </button>
      </header>

      <section className="cleanerPropertiesMetrics" aria-label="Client summary">
        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">👥</div>
          <div>
            <strong>{clients.length}</strong>
            <span>Total Clients</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">🏡</div>
          <div>
            <strong>{totalProperties}</strong>
            <span>Linked Vacation Rentals</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">📅</div>
          <div>
            <strong>{upcomingJobs}</strong>
            <span>Upcoming Jobs</span>
          </div>
        </article>

        <article className="cleanerPropertiesMetricCard">
          <div className="cleanerPropertiesMetricIcon">💵</div>
          <div>
            <strong>{formatMoney(outstandingInvoiceTotal)}</strong>
            <span>Outstanding</span>
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
            placeholder="Search clients..."
            aria-label="Search clients"
          />
        </label>
      </section>

      {errorMessage && !showClientForm && (
        <section className="emptyStateCard">
          <strong>Client error</strong>
          <p>{errorMessage}</p>
        </section>
      )}

      {isLoading ? (
        <section className="emptyStateCard">
          <strong>Loading clients…</strong>
        </section>
      ) : filteredClients.length === 0 ? (
        <section className="cleanerPropertiesFirstProperty">
          <div className="cleanerPropertiesFirstPropertyIcon">👥</div>
          <p className="cleanerPropertiesEyebrow">Start here</p>
          <h2>Create your first client</h2>
          <p>
            Save client contact and service-address information once, then create one-time or recurring jobs. Vacation rentals remain optional.
          </p>
          <button
            className="cleanerCreateFirstPropertyButton"
            type="button"
            onClick={openNewClient}
          >
            Create Client <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <section className="cleanerPropertiesGrid">
          {filteredClients.map((client) => {
            const clientProperties = getClientProperties(client.id);
            const clientJobs = getClientJobs(client);
            const clientInvoices = getClientInvoices(client);
            const nextJob = clientJobs.find(
              (job) =>
                job.status === "upcoming" &&
                String(job.scheduled_date ?? "") >=
                  new Date().toISOString().slice(0, 10),
            );

            return (
              <article className="cleanerPropertyCard" key={client.id}>
                <div className="cleanerPropertyCardBody">
                  <div className="cleanerPropertyCardTitleRow">
                    <div>
                      <p className="cleanerPropertyCardLabel">Client</p>
                      <h2>{client.name}</h2>
                    </div>
                  </div>

                  <div className="clientCardMeta">
                    <span>✉️ {client.email || "Email not added"}</span>
                    <span>📞 {client.phone || "Phone not added"}</span>
                    <span>
                      📍 {formatClientAddress(client) || "Service address not added"}
                    </span>
                    <span>
                      🌐 {client.preferred_language || "English"}
                    </span>
                  </div>

                  <div className="clientStatsGrid">
                    <div>
                      <span>Vacation Rentals</span>
                      <strong>{clientProperties.length}</strong>
                    </div>
                    <div>
                      <span>Jobs</span>
                      <strong>{clientJobs.length}</strong>
                    </div>
                    <div>
                      <span>Invoices</span>
                      <strong>{clientInvoices.length}</strong>
                    </div>
                  </div>

                  <p className="cleanerPropertyAddress">
                    <span aria-hidden="true">📅</span>
                    {nextJob
                      ? `Next: ${formatDate(nextJob.scheduled_date)}`
                      : "No upcoming job"}
                  </p>

                  <div className="cleanerPropertyCardActions">
                    <button
                      className="primaryButton"
                      type="button"
                      onClick={() => setSelectedClient(client)}
                    >
                      Open Client
                    </button>
                    <button
                      className="secondaryButton"
                      type="button"
                      onClick={() => openEditClient(client)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedClient && (
        <div
          className="modalOverlay"
          onClick={() => setSelectedClient(null)}
        >
          <section
            className="modalCard cleanerJobCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">Client profile</p>
                <h3>{selectedClient.name}</h3>
              </div>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setSelectedClient(null)}
              >
                Close
              </button>
            </div>

            <section className="cleanerJobSection">
              <p>
                <strong>Email:</strong> {selectedClient.email || "—"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedClient.phone || "—"}
              </p>
              <p>
                <strong>Billing email:</strong>{" "}
                {selectedClient.billing_email || "—"}
              </p>
              <p>
                <strong>Default service address:</strong>{" "}
                {formatClientAddress(selectedClient) || "—"}
              </p>
              <p>
                <strong>Preferred language:</strong>{" "}
                {selectedClient.preferred_language || "English"}
              </p>
              <p>
                <strong>Notes:</strong> {selectedClient.notes || "—"}
              </p>
            </section>

            <section className="clientDetailSection">
              <h4>Vacation Rental Properties</h4>
              <div className="clientDetailList">
                {getClientProperties(selectedClient.id).length === 0 ? (
                  <p>No vacation rental properties are linked to this client.</p>
                ) : (
                  getClientProperties(selectedClient.id).map((home) => (
                    <div className="clientDetailRow" key={home.id}>
                      <strong>{home.name}</strong>
                      <span>{home.address || home.city || "No address"}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="clientDetailSection">
              <h4>Jobs</h4>
              <div className="clientDetailList">
                {getClientJobs(selectedClient).length === 0 ? (
                  <p>
                    No jobs are linked to this client yet. Older jobs created
                    before client linking was added will remain unassigned.
                  </p>
                ) : (
                  getClientJobs(selectedClient)
                    .slice(0, 8)
                    .map((job) => (
                      <div className="clientDetailRow" key={job.id}>
                        <div>
                          <strong>{job.job_type}</strong>
                          <span>{formatDate(job.scheduled_date)}</span>
                        </div>
                        <span>{job.status}</span>
                      </div>
                    ))
                )}
              </div>
            </section>

            <section className="clientDetailSection">
              <h4>Invoices</h4>
              <div className="clientDetailList">
                {getClientInvoices(selectedClient).length === 0 ? (
                  <p>No invoices are connected to this client.</p>
                ) : (
                  getClientInvoices(selectedClient)
                    .slice(0, 8)
                    .map((invoice) => (
                      <div className="clientDetailRow" key={invoice.id}>
                        <strong>
                          {invoice.invoice_number
                            ? `Invoice ${invoice.invoice_number}`
                            : "Invoice"}
                        </strong>
                        <span>{invoice.status || "Draft"}</span>
                      </div>
                    ))
                )}
              </div>
            </section>

            <div className="cleanerJobPrimaryActions">
              <button
                className="primaryButton"
                type="button"
                onClick={() => openEditClient(selectedClient)}
              >
                Edit Client
              </button>
              <button
                className="cleanerPropertyDeleteButton"
                type="button"
                onClick={() => void deleteClient(selectedClient)}
              >
                Delete Client
              </button>
            </div>
          </section>
        </div>
      )}

      {showClientForm && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (isSaving) return;
            setShowClientForm(false);
            setEditingClient(null);
            setForm(EMPTY_FORM);
          }}
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">
                  {editingClient ? "Edit client" : "New client"}
                </p>
                <h3>
                  {editingClient ? "Update Client" : "Create Client"}
                </h3>
              </div>
              <button
                className="secondaryButton"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setShowClientForm(false);
                  setEditingClient(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Close
              </button>
            </div>

            <form className="cleanerIssueForm" onSubmit={saveClient}>
              <label>
                Client name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>

              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </label>

              <label>
                Billing email
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={(event) =>
                    setForm({ ...form, billingEmail: event.target.value })
                  }
                />
              </label>

              <label className="fullWidth">
                Default service address
                <input
                  value={form.addressLine1}
                  onChange={(event) =>
                    setForm({ ...form, addressLine1: event.target.value })
                  }
                  placeholder="Street address"
                />
              </label>

              <label className="fullWidth">
                Address line 2
                <input
                  value={form.addressLine2}
                  onChange={(event) =>
                    setForm({ ...form, addressLine2: event.target.value })
                  }
                  placeholder="Apartment, suite, unit, or building"
                />
              </label>

              <label>
                City
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                />
              </label>

              <label>
                State
                <input
                  value={form.state}
                  onChange={(event) =>
                    setForm({ ...form, state: event.target.value })
                  }
                />
              </label>

              <label>
                ZIP
                <input
                  value={form.zip}
                  onChange={(event) =>
                    setForm({ ...form, zip: event.target.value })
                  }
                />
              </label>

              <label>
                Preferred language
                <select
                  value={form.preferredLanguage}
                  onChange={(event) =>
                    setForm({
                      ...form,
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
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Client preferences, billing notes, access details, or other information..."
                />
              </label>

              {errorMessage && <p className="fullWidth">{errorMessage}</p>}

              <button
                className="primaryButton"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? editingClient
                    ? "Saving Changes…"
                    : "Creating Client…"
                  : editingClient
                    ? "Save Changes"
                    : "Create Client"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
