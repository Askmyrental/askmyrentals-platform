import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "void";

type Invoice = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  customer_name: string;
  customer_email: string | null;
  property_id: string | null;
  reservation_id?: string | null;
  cleaner_job_id?: string | null;
  property_name: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  notes?: string | null;
  payment_terms?: string | null;
  stripe_payment_link?: string | null;
  payment_source?: "stripe" | "manual" | null;
  manual_payment_method?: string | null;
  manual_payment_reference?: string | null;
  manual_payment_note?: string | null;
  amount_paid_cents?: number | null;
  invoice_items?: {
    description: string;
    sort_order?: number | null;
  }[];
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

type InvoicesPageProps = {
  homes: any[];
  reservations: any[];
  initialTask?: any | null;
  readyTasks?: any[];
  initialStatusFilter?: string;
  initialInvoiceId?: string | null;
  onInitialTaskConsumed?: () => void;
  onInitialInvoiceConsumed?: () => void;
  onCloseInvoiceFlow?: () => void;
};

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatInvoiceDate(value: string | null) {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

export default function InvoicesPage({
  homes,
  reservations,
  initialTask,
  readyTasks = [],
  initialStatusFilter = "all",
  initialInvoiceId = null,
  onInitialTaskConsumed,
  onInitialInvoiceConsumed,
  onCloseInvoiceFlow,
}: InvoicesPageProps) {
  const today = useMemo(() => new Date(), []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showWorkFilter, setShowWorkFilter] = useState(false);
  const [selectedWorkFilters, setSelectedWorkFilters] = useState<Set<string>>(
    () => new Set(["all"])
  );
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [invoiceToMarkPaid, setInvoiceToMarkPaid] = useState<Invoice | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isVoidingInvoice, setIsVoidingInvoice] = useState(false);
  const [sourceTask, setSourceTask] = useState<any | null>(null);
  const [openedFromTaskFlow, setOpenedFromTaskFlow] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: toInputDate(today),
    amount: "",
    method: "",
    reference: "",
    note: "",
  });

  const [form, setForm] = useState({
    propertyId: "",
    reservationId: "",
    customerName: "",
    customerEmail: "",
    description: "Vacation rental turnover cleaning",
    quantity: "1",
    unitPrice: "",
    taxAmount: "0",
    issueDate: toInputDate(today),
    dueDate: toInputDate(addDays(today, 7)),
    notes: "",
    paymentTerms: "Due within 7 days",
  });

  const selectedHome = homes.find(
    (home) => String(home.id) === String(form.propertyId)
  );

  const propertyReservations = reservations.filter(
    (reservation) =>
      String(reservation.homeId) === String(form.propertyId) &&
      String(reservation.status ?? "").toLowerCase().includes("complete")
  );

  const quantity = Number(form.quantity) || 0;
  const unitPriceCents = Math.round((Number(form.unitPrice) || 0) * 100);
  const subtotalCents = Math.round(quantity * unitPriceCents);
  const taxCents = Math.round((Number(form.taxAmount) || 0) * 100);
  const totalCents = subtotalCents + taxCents;

  function openCreateInvoiceForTask(task: any) {
    setSourceTask(task);
    setOpenedFromTaskFlow(true);

    const home = homes.find(
      (item) => String(item.id) === String(task.homeId)
    );

    const taskPrice =
      task.cleaningFee ??
      task.amount ??
      task.invoiceAmount ??
      task.price ??
      home?.cleaningFee ??
      "";

    setForm((current) => ({
      ...current,
      propertyId: String(task.homeId ?? ""),
      reservationId: task.isCleanerJob ? "" : String(task.id ?? ""),
      customerName: task.customerName ?? home?.ownerName ?? "",
      customerEmail: task.customerEmail ?? home?.ownerEmail ?? "",
      description:
        task.jobType ??
        task.taskType ??
        "Vacation rental turnover cleaning",
      unitPrice:
        taskPrice === null || taskPrice === undefined
          ? ""
          : String(taskPrice),
    }));

    setErrorMessage("");
    setShowCreateInvoice(true);
  }

  useEffect(() => {
    void loadInvoices();
  }, []);

  useEffect(() => {
    if (!initialTask) return;
    openCreateInvoiceForTask(initialTask);
  }, [initialTask, homes]);

  useEffect(() => {
    setSelectedStatus(initialStatusFilter || "all");
  }, [initialStatusFilter]);

  useEffect(() => {
    if (!initialInvoiceId || invoices.length === 0) return;

    const requestedInvoice = invoices.find(
      (invoice) => String(invoice.id) === String(initialInvoiceId)
    );

    if (!requestedInvoice) return;

    setSelectedStatus("all");
    void openInvoice(requestedInvoice);
    onInitialInvoiceConsumed?.();
  }, [initialInvoiceId, invoices, onInitialInvoiceConsumed]);

  async function loadInvoices() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_items(description, sort_order)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Invoice load failed", error);
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    const loadedInvoices = (data ?? []) as Invoice[];
    setInvoices(loadedInvoices);
    setIsLoading(false);

    const requestedInvoiceId = window.sessionStorage.getItem(
      "amr:open-invoice-id"
    );

    if (requestedInvoiceId) {
      window.sessionStorage.removeItem("amr:open-invoice-id");
      const requestedInvoice = loadedInvoices.find(
        (invoice) => String(invoice.id) === String(requestedInvoiceId)
      );

      if (requestedInvoice) {
        setSelectedStatus("all");
        void openInvoice(requestedInvoice);
      }
    }
  }

  function handlePropertyChange(propertyId: string) {
    const home = homes.find(
      (item) => String(item.id) === String(propertyId)
    );

    setForm((current) => ({
      ...current,
      propertyId,
      reservationId: "",
      customerName: home?.ownerName ?? "",
      customerEmail: home?.ownerEmail ?? "",
      unitPrice:
        home?.cleaningFee === undefined || home?.cleaningFee === null
          ? current.unitPrice
          : String(home.cleaningFee),
    }));
  }

  async function openInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setSelectedInvoiceItems([]);
    setCopyMessage("");
    setSendConfirmation("");
    setErrorMessage("");
    setIsLoadingInvoice(true);

    const { data, error } = await supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price_cents, line_total_cents")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Invoice item load failed", error);
      setErrorMessage(error.message);
    } else {
      setSelectedInvoiceItems((data ?? []) as InvoiceItem[]);
    }

    setIsLoadingInvoice(false);
  }

  async function createDraftInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.customerName.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }

    if (!form.description.trim()) {
      setErrorMessage("Add an invoice item description.");
      return;
    }

    if (totalCents <= 0) {
      setErrorMessage("Invoice total must be greater than zero.");
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const user = userData.user;

      if (userError || !user) {
        throw new Error("You must be logged in to create an invoice.");
      }

      const invoiceNumber = `AMR-${Date.now().toString().slice(-8)}`;

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          cleaner_id: user.id,
          property_id: form.propertyId || null,
          reservation_id: form.reservationId || null,
          cleaner_job_id:
            sourceTask?.isCleanerJob && sourceTask.cleanerJobId
              ? sourceTask.cleanerJobId
              : null,
          invoice_number: invoiceNumber,
          status: "draft",
          customer_name: form.customerName.trim(),
          customer_email: form.customerEmail.trim() || null,
          property_name: selectedHome?.name ?? null,
          subtotal_cents: subtotalCents,
          tax_cents: taxCents,
          total_cents: totalCents,
          currency: "usd",
          issue_date: form.issueDate,
          due_date: form.dueDate || null,
          notes: form.notes.trim() || null,
          payment_terms: form.paymentTerms.trim() || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const { data: item, error: itemError } = await supabase
        .from("invoice_items")
        .insert({
          invoice_id: invoice.id,
          description: form.description.trim(),
          quantity,
          unit_price_cents: unitPriceCents,
          line_total_cents: subtotalCents,
          sort_order: 0,
        })
        .select("id, description, quantity, unit_price_cents, line_total_cents")
        .single();

      if (itemError) {
        await supabase.from("invoices").delete().eq("id", invoice.id);
        throw itemError;
      }

      await supabase.from("invoice_activity").insert({
        invoice_id: invoice.id,
        event_type: "invoice_created",
        event_description: "Draft invoice created by cleaner.",
        created_by: user.id,
      });

      if (sourceTask?.isCleanerJob && sourceTask.cleanerJobId) {
        const { error: jobUpdateError } = await supabase
          .from("cleaner_jobs")
          .update({
            status: "invoiced",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sourceTask.cleanerJobId);

        if (jobUpdateError) {
          console.error("Cleaner job invoice link update failed", jobUpdateError);
        }

        try {
          const savedJobInvoiceMap = JSON.parse(
            window.localStorage.getItem("amr:job-invoice-map") ?? "{}"
          );
          savedJobInvoiceMap[String(sourceTask.cleanerJobId)] = String(invoice.id);
          window.localStorage.setItem(
            "amr:job-invoice-map",
            JSON.stringify(savedJobInvoiceMap)
          );
        } catch (storageError) {
          console.warn("Unable to save cleaner job invoice link", storageError);
        }
      }

      window.dispatchEvent(
        new CustomEvent("amr:invoice-created", {
          detail: {
            invoiceId: invoice.id,
            reservationId: invoice.reservation_id ?? null,
            cleanerJobId: sourceTask?.cleanerJobId ?? null,
          },
        })
      );

      const createdInvoice = invoice as Invoice;

      setInvoices((current) => [createdInvoice, ...current]);
      setSelectedInvoice(createdInvoice);
      setSelectedInvoiceItems([item as InvoiceItem]);
      setShowCreateInvoice(false);
      setSourceTask(null);
      onInitialTaskConsumed?.();

      setForm({
        propertyId: "",
        reservationId: "",
        customerName: "",
        customerEmail: "",
        description: "Vacation rental turnover cleaning",
        quantity: "1",
        unitPrice: "",
        taxAmount: "0",
        issueDate: toInputDate(new Date()),
        dueDate: toInputDate(addDays(new Date(), 7)),
        notes: "",
        paymentTerms: "Due within 7 days",
      });
    } catch (error) {
      console.error("Invoice creation failed", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the invoice."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function sendInvoice(invoice: Invoice) {
    setIsSendingInvoice(true);
    setErrorMessage("");
    setCopyMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("You must be logged in to send an invoice.");
      }

      const response = await fetch(
        "http://localhost:4000/api/stripe/invoices/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ invoiceId: invoice.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to send the invoice.");
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        status: "sent",
        stripe_payment_link: result.url,
      };

      setSelectedInvoice(updatedInvoice);
      setSendConfirmation(
        "Invoice sent successfully. Stripe created the secure payment page, and AMR is now waiting for the customer to pay."
      );
      setInvoices((current) =>
        current.map((item) =>
          item.id === invoice.id ? updatedInvoice : item
        )
      );

      try {
        await navigator.clipboard.writeText(result.url);
        setCopyMessage("Payment link created and copied.");
      } catch {
        setCopyMessage(
          "Payment link created. Use Copy Payment Link to share it."
        );
      }
    } catch (error) {
      console.error("Invoice send failed", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the invoice."
      );
    } finally {
      setIsSendingInvoice(false);
    }
  }

  async function copyPaymentLink(invoice: Invoice) {
    if (!invoice.stripe_payment_link) return;

    try {
      await navigator.clipboard.writeText(invoice.stripe_payment_link);
      setCopyMessage("Payment link copied.");
    } catch {
      window.prompt("Copy this payment link:", invoice.stripe_payment_link);
    }
  }


  function closeInvoiceFlow() {
    setSelectedInvoice(null);
    setShowCreateInvoice(false);
    setSourceTask(null);

    if (openedFromTaskFlow) {
      setOpenedFromTaskFlow(false);
      onCloseInvoiceFlow?.();
    }
  }

  function openMarkPaid(invoice: Invoice) {
    setInvoiceToMarkPaid(invoice);
    setPaymentForm({
      paymentDate: toInputDate(new Date()),
      amount: String((invoice.total_cents / 100).toFixed(2)),
      method: "",
      reference: "",
      note: "",
    });
    setErrorMessage("");
    setShowMarkPaid(true);
  }

  async function markInvoicePaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceToMarkPaid) return;

    const amountPaidCents = Math.round((Number(paymentForm.amount) || 0) * 100);

    if (!paymentForm.method) {
      setErrorMessage("Choose how the customer paid.");
      return;
    }

    if (amountPaidCents <= 0) {
      setErrorMessage("Payment amount must be greater than zero.");
      return;
    }

    setIsMarkingPaid(true);
    setErrorMessage("");

    try {
      const paidAt = `${paymentForm.paymentDate}T12:00:00`;
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_source: "manual",
          manual_payment_method: paymentForm.method,
          manual_payment_reference: paymentForm.reference.trim() || null,
          manual_payment_note: paymentForm.note.trim() || null,
          amount_paid_cents: amountPaidCents,
        })
        .eq("id", invoiceToMarkPaid.id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("invoice_activity").insert({
        invoice_id: invoiceToMarkPaid.id,
        event_type: "invoice_marked_paid",
        event_description: `Invoice manually marked paid via ${paymentForm.method}.`,
        created_by: userData.user?.id ?? null,
      });

      const updatedInvoice = data as Invoice;
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === updatedInvoice.id ? updatedInvoice : invoice
        )
      );
      setSelectedInvoice((current) =>
        current?.id === updatedInvoice.id ? updatedInvoice : current
      );
      setShowMarkPaid(false);
      setInvoiceToMarkPaid(null);
    } catch (error) {
      console.error("Mark paid failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to mark the invoice paid."
      );
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function voidInvoice(invoice: Invoice) {
    if (!["sent", "viewed", "overdue"].includes(invoice.status)) return;

    const confirmed = window.confirm(
      `Void ${invoice.invoice_number}?\n\nThis cancels the payment request. The invoice will remain in your history as a voided record and will be removed from Outstanding.`
    );

    if (!confirmed) return;

    setIsVoidingInvoice(true);
    setErrorMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("You must be logged in to void an invoice.");
      }

      const response = await fetch(
        `http://localhost:4000/api/invoices/${invoice.id}/void`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to void the invoice.");
      }

      const updatedInvoice = result.invoice as Invoice;

      setInvoices((current) =>
        current.map((item) =>
          item.id === updatedInvoice.id ? updatedInvoice : item
        )
      );

      setSelectedInvoice((current) =>
        current?.id === updatedInvoice.id ? null : current
      );
      setSelectedInvoiceItems([]);

      setCopyMessage("");
      setSendConfirmation("");

      window.dispatchEvent(
        new CustomEvent("amr:invoice-voided", {
          detail: {
            invoiceId: updatedInvoice.id,
            reservationId: updatedInvoice.reservation_id ?? null,
          },
        })
      );
    } catch (error) {
      console.error("Invoice void failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to void the invoice."
      );
    } finally {
      setIsVoidingInvoice(false);
    }
  }

  async function deleteDraftInvoice(invoice: Invoice) {
    if (invoice.status !== "draft") return;

    const confirmed = window.confirm(
      `Delete draft ${invoice.invoice_number}? This cannot be undone.`
    );

    if (!confirmed) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id)
      .eq("status", "draft");

    if (error) {
      console.error("Draft invoice delete failed", error);
      setErrorMessage(error.message);
      return;
    }

    setInvoices((current) =>
      current.filter((item) => item.id !== invoice.id)
    );

    window.dispatchEvent(
      new CustomEvent("amr:invoice-deleted", {
        detail: {
          invoiceId: invoice.id,
          reservationId: invoice.reservation_id ?? null,
        },
      })
    );

    if (selectedInvoice?.id === invoice.id) {
      setSelectedInvoice(null);
      setSelectedInvoiceItems([]);
    }
  }

  const MANUAL_JOBS_FILTER = "__manual_jobs__";

  function toggleWorkFilter(filterId: string) {
    setSelectedWorkFilters((current) => {
      if (filterId === "all") {
        return new Set(["all"]);
      }

      const next = new Set(current);
      next.delete("all");

      if (next.has(filterId)) {
        next.delete(filterId);
      } else {
        next.add(filterId);
      }

      if (next.size === 0) {
        return new Set(["all"]);
      }

      return next;
    });
  }

  function invoiceMatchesWorkFilter(invoice: Invoice) {
    if (selectedWorkFilters.has("all")) return true;

    const isManualJob = Boolean(invoice.cleaner_job_id);

    if (
      selectedWorkFilters.has(MANUAL_JOBS_FILTER) &&
      isManualJob
    ) {
      return true;
    }

    if (
      invoice.property_id &&
      selectedWorkFilters.has(String(invoice.property_id))
    ) {
      return true;
    }

    return false;
  }

  const workFilteredInvoices = invoices.filter(invoiceMatchesWorkFilter);

  const filteredReadyTasks = readyTasks.filter((task) => {
    if (selectedWorkFilters.has("all")) return true;

    if (task.isCleanerJob) {
      return selectedWorkFilters.has(MANUAL_JOBS_FILTER);
    }

    return selectedWorkFilters.has(String(task.homeId ?? ""));
  });

  const workFilterLabel = selectedWorkFilters.has("all")
    ? "All Work"
    : selectedWorkFilters.size === 1
      ? selectedWorkFilters.has(MANUAL_JOBS_FILTER)
        ? "Manual Jobs"
        : homes.find((home) =>
            selectedWorkFilters.has(String(home.id))
          )?.name ?? "1 selected"
      : `${selectedWorkFilters.size} selected`;

  const statusPriority: Record<InvoiceStatus, number> = {
    draft: 0,
    overdue: 1,
    sent: 2,
    viewed: 3,
    paid: 4,
    void: 5,
  };

  const filteredInvoices = workFilteredInvoices
    .filter((invoice) => {
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "outstanding" &&
        ["sent", "viewed", "overdue"].includes(invoice.status)) ||
      invoice.status === selectedStatus;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [
        invoice.invoice_number,
        invoice.customer_name,
        invoice.customer_email,
        invoice.property_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    return matchesStatus && matchesSearch;
  })
    .sort((first, second) => {
      const statusDifference =
        statusPriority[first.status] - statusPriority[second.status];

      if (statusDifference !== 0) return statusDifference;

      return (
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime()
      );
    });

  const draftInvoices = workFilteredInvoices.filter(
    (invoice) => invoice.status === "draft"
  );

  const outstandingInvoices = workFilteredInvoices.filter((invoice) =>
    ["sent", "viewed", "overdue"].includes(invoice.status)
  );

  const paidInvoices = workFilteredInvoices.filter(
    (invoice) => invoice.status === "paid"
  );

  const overdueInvoices = workFilteredInvoices.filter(
    (invoice) => invoice.status === "overdue"
  );

  function getInvoiceTaskDate(invoice: Invoice) {
    const linkedTask = reservations.find(
      (reservation) =>
        String(reservation.id) === String(invoice.reservation_id ?? "")
    );

    const taskDate =
      linkedTask?.departure ??
      linkedTask?.date ??
      linkedTask?.serviceDate ??
      linkedTask?.taskDate ??
      linkedTask?.scheduledDate ??
      invoice.issue_date;

    return formatInvoiceDate(taskDate ?? null);
  }

  function getInvoiceServiceDetails(invoice: Invoice) {
    const linkedTask = reservations.find(
      (reservation) =>
        String(reservation.id) === String(invoice.reservation_id ?? "")
    );

    const firstItemDescription =
      invoice.invoice_items
        ?.slice()
        .sort(
          (first, second) =>
            Number(first.sort_order ?? 0) -
            Number(second.sort_order ?? 0)
        )[0]?.description ??
      selectedInvoiceItems[0]?.description ??
      "Service";

    return {
      serviceType: firstItemDescription,
      serviceDate: formatInvoiceDate(
        linkedTask?.departure ??
          linkedTask?.scheduledDate ??
          linkedTask?.date ??
          linkedTask?.serviceDate ??
          linkedTask?.taskDate ??
          invoice.issue_date
      ),
      propertyOrCustomer:
        invoice.property_name ||
        linkedTask?.propertyName ||
        linkedTask?.customerName ||
        invoice.customer_name ||
        "—",
    };
  }

  return (
    <main className="cleanerInvoicesPage">

      <style>{`
        .cleanerInvoiceVoidButton {
          border: 1px solid #f1b8b8 !important;
          background: #fff5f5 !important;
          color: #b42318 !important;
        }

        .cleanerInvoiceVoidButton:hover {
          background: #fee4e2 !important;
        }

        .cleanerInvoiceLedgerRow.isVoid {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          opacity: 0.68;
          cursor: default !important;
        }

        .cleanerInvoiceLedgerRow.isVoid:hover {
          transform: none !important;
          box-shadow: none !important;
        }

        .cleanerInvoiceStatusBadge.status-void {
          background: #e2e8f0 !important;
          color: #64748b !important;
          border-color: #cbd5e1 !important;
        }

        .cleanerInvoiceVoidHistoryNote {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
        }

        .cleanerInvoiceVoidedNotice {
          display: flex;
          gap: 10px;
          margin: 14px 0;
          padding: 13px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #f8fafc;
          color: #475569;
        }

        .cleanerInvoiceVoidedNotice strong,
        .cleanerInvoiceVoidedNotice p {
          display: block;
          margin: 0;
        }

        .cleanerInvoiceVoidedNotice p {
          margin-top: 3px;
          font-size: 13px;
        }

        .cleanerInvoiceServiceDetails {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #f8fafc;
        }

        .cleanerInvoiceServiceDetails div {
          min-width: 0;
        }

        .cleanerInvoiceServiceDetails span,
        .cleanerInvoiceServiceDetails strong {
          display: block;
        }

        .cleanerInvoiceServiceDetails span {
          margin-bottom: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .cleanerInvoiceServiceDetails strong {
          color: #0f172a;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .cleanerInvoiceWorkFilterWrap {
          position: relative;
          margin-left: auto;
        }

        .cleanerInvoiceHistoryHeader {
          width: 100%;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 16px;
        }

        .cleanerInvoiceHistoryHeader > div:first-child {
          min-width: 0;
        }

        .cleanerInvoiceHistoryHeader .cleanerInvoiceWorkFilterWrap {
          flex: 0 0 auto;
          margin-left: auto !important;
        }

        .cleanerInvoiceWorkFilterButton {
          min-width: 150px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .cleanerInvoiceWorkFilterPanel {
          position: fixed;
          top: 50%;
          left: 50%;
          z-index: 1000005;
          width: min(360px, calc(100vw - 32px));
          max-height: min(560px, calc(100vh - 48px));
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          transform: translate(-50%, -50%);
          border: 1px solid #dbe3ee;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }

        .cleanerInvoiceWorkFilterHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .cleanerInvoiceWorkFilterHeader h3 {
          margin: 0;
        }

        .cleanerInvoiceWorkFilterOptions {
          overflow-y: auto;
          padding: 10px 16px;
          overscroll-behavior: contain;
        }

        .cleanerInvoiceWorkFilterOption {
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 12px !important;
          width: 100% !important;
          min-height: 42px;
          padding: 8px 0;
          margin: 0 !important;
          color: #0f172a;
          font-weight: 700;
          text-align: left !important;
          cursor: pointer;
        }

        .cleanerInvoiceWorkFilterOption input[type="checkbox"] {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          flex: 0 0 18px !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .cleanerInvoiceWorkFilterOption span {
          display: block !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          width: auto !important;
          margin: 0 !important;
          text-align: left !important;
          line-height: 1.3 !important;
          overflow-wrap: anywhere;
        }

        .cleanerInvoiceWorkFilterDivider {
          height: 1px;
          margin: 6px 0;
          background: #e2e8f0;
        }

        .cleanerInvoiceWorkFilterActions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }

        @media screen and (max-width: 700px) {
          .cleanerInvoicesPage .reservationWorkspaceCard {
            padding: 12px !important;
          }

          .cleanerInvoiceServiceDetails {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .cleanerInvoicesPage .operationsCardHeader {
            margin-bottom: 8px !important;
          }

          .cleanerInvoiceHistoryHeader {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            align-items: stretch !important;
          }

          .cleanerInvoiceHistoryHeader .cleanerInvoiceWorkFilterWrap {
            width: 100% !important;
            margin-left: 0 !important;
          }

          .cleanerInvoiceHistoryHeader .cleanerInvoiceWorkFilterButton {
            width: 100% !important;
            justify-content: space-between !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedger {
            display: grid !important;
            gap: 8px !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerHeader {
            display: none !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerRow {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 4px 10px !important;
            padding: 10px 12px !important;
            min-height: 0 !important;
            border-radius: 12px !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerNumber {
            grid-column: 1;
            grid-row: 1;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerNumber strong {
            font-size: 13px !important;
            line-height: 1.15 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerNumber small {
            margin-top: 1px !important;
            font-size: 9px !important;
            line-height: 1.1 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerAmount {
            grid-column: 2;
            grid-row: 1;
            align-self: start;
            text-align: right;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerAmount strong {
            font-size: 13px !important;
            line-height: 1.15 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerCustomer {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerCustomer strong {
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerCustomer small {
            margin-top: 1px !important;
            font-size: 10px !important;
            line-height: 1.1 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerDate {
            grid-column: 1;
            font-size: 9px !important;
            line-height: 1.1 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerDate[data-label="Due"] {
            display: none !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerStatus {
            grid-column: 1 / -1;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin-top: 1px !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceStatusBadge {
            padding: 3px 7px !important;
            font-size: 9px !important;
            line-height: 1 !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerStatus small {
            font-size: 9px !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerActions {
            grid-column: 1 / -1;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin-top: 3px !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerActions .cleanerInvoiceStatusBadge {
            margin-left: auto !important;
            flex: 0 0 auto !important;
          }

          .cleanerInvoicesPage .cleanerInvoiceLedgerActions button {
            min-height: 30px !important;
            padding: 5px 10px !important;
            font-size: 10px !important;
            border-radius: 9px !important;
          }
        }
      `}</style>
      <header className="cleanerPropertiesHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">Get Paid</p>
          <h1>Invoices</h1>
          <p className="cleanerPropertiesSubtitle">
            Create, send, and track every cleaner invoice.
          </p>
        </div>

        <button
          className="cleanerPropertyAddButton"
          type="button"
          onClick={() => {
            setErrorMessage("");
            setSourceTask(null);
            setOpenedFromTaskFlow(false);
            setShowCreateInvoice(true);
          }}
        >
          + Create Invoice
        </button>
      </header>

      <section className="cleanerPropertiesMetrics" aria-label="Invoice summary">
        <button
          type="button"
          className={`cleanerPropertiesMetricCard ${
            selectedStatus === "draft" ? "active" : ""
          }`}
          onClick={() => setSelectedStatus("draft")}
          aria-pressed={selectedStatus === "draft"}
        >
          <div className="cleanerPropertiesMetricIcon">📝</div>
          <div>
            <strong>{draftInvoices.length}</strong>
            <span>Drafts</span>
          </div>
        </button>

        <button
          type="button"
          className={`cleanerPropertiesMetricCard ${
            selectedStatus === "outstanding" ? "active" : ""
          }`}
          onClick={() => setSelectedStatus("outstanding")}
          aria-pressed={selectedStatus === "outstanding"}
        >
          <div className="cleanerPropertiesMetricIcon">⏳</div>
          <div>
            <strong>{outstandingInvoices.length}</strong>
            <span>Outstanding</span>
          </div>
        </button>

        <button
          type="button"
          className={`cleanerPropertiesMetricCard ${
            selectedStatus === "paid" ? "active" : ""
          }`}
          onClick={() => setSelectedStatus("paid")}
          aria-pressed={selectedStatus === "paid"}
        >
          <div className="cleanerPropertiesMetricIcon">✅</div>
          <div>
            <strong>{paidInvoices.length}</strong>
            <span>Paid</span>
          </div>
        </button>

        <button
          type="button"
          className={`cleanerPropertiesMetricCard ${
            selectedStatus === "overdue" ? "active" : ""
          }`}
          onClick={() => setSelectedStatus("overdue")}
          aria-pressed={selectedStatus === "overdue"}
        >
          <div className="cleanerPropertiesMetricIcon">⚠️</div>
          <div>
            <strong>{overdueInvoices.length}</strong>
            <span>Overdue</span>
          </div>
        </button>
      </section>

      {filteredReadyTasks.length > 0 && (
        <section className="reservationWorkspaceCard cleanerReadyInvoiceQueue">
          <div className="operationsCardHeader">
            <div>
              <p className="eyebrow">Ready to invoice</p>
              <h3>
                {filteredReadyTasks.length} completed{" "}
                {filteredReadyTasks.length === 1 ? "task" : "tasks"}
              </h3>
            </div>
          </div>

          <div className="cleanerTurnStack">
            {filteredReadyTasks.map((task) => {
              const home = homes.find(
                (item) => String(item.id) === String(task.homeId)
              );

              return (
                <article className="cleanerActionCard money" key={task.id}>
                  <div className="cleanerActionIcon">💵</div>

                  <div>
                    <strong>{home?.name ?? "Completed task"}</strong>
                    <p>
                      {task.jobType ??
                        task.taskType ??
                        "Vacation rental turnover cleaning"}
                    </p>
                    <small>
                      Completed task ready for invoice
                    </small>
                  </div>

                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() => openCreateInvoiceForTask(task)}
                  >
                    Create Invoice
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="cleanerPropertiesToolbar">
        <label className="cleanerPropertiesSearch">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search invoices..."
            aria-label="Search invoices"
          />
        </label>

        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          aria-label="Filter invoices by status"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="outstanding">Outstanding</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </section>

      {showWorkFilter && (
        <>
          <button
            type="button"
            className="modalOverlay"
            aria-label="Close work filter"
            onClick={() => setShowWorkFilter(false)}
          />

          <section
            className="cleanerInvoiceWorkFilterPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Filter invoices by property or manual jobs"
          >
            <header className="cleanerInvoiceWorkFilterHeader">
              <div>
                <p className="eyebrow">Invoice filter</p>
                <h3>Choose Work</h3>
              </div>

              <button
                type="button"
                className="cleanerScheduleClose"
                aria-label="Close work filter"
                onClick={() => setShowWorkFilter(false)}
              >
                ✕
              </button>
            </header>

            <div className="cleanerInvoiceWorkFilterOptions">
              <label className="cleanerInvoiceWorkFilterOption">
                <input
                  type="checkbox"
                  checked={selectedWorkFilters.has("all")}
                  onChange={() => toggleWorkFilter("all")}
                />
                <span>All Work</span>
              </label>

              <div className="cleanerInvoiceWorkFilterDivider" />

              {homes.map((home) => (
                <label
                  className="cleanerInvoiceWorkFilterOption"
                  key={home.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedWorkFilters.has(String(home.id))}
                    onChange={() => toggleWorkFilter(String(home.id))}
                  />
                  <span>{home.name}</span>
                </label>
              ))}

              <div className="cleanerInvoiceWorkFilterDivider" />

              <label className="cleanerInvoiceWorkFilterOption">
                <input
                  type="checkbox"
                  checked={selectedWorkFilters.has(MANUAL_JOBS_FILTER)}
                  onChange={() => toggleWorkFilter(MANUAL_JOBS_FILTER)}
                />
                <span>Manual Jobs</span>
              </label>
            </div>

            <footer className="cleanerInvoiceWorkFilterActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setSelectedWorkFilters(new Set(["all"]))}
              >
                Reset
              </button>

              <button
                type="button"
                className="primaryButton"
                onClick={() => setShowWorkFilter(false)}
              >
                Done
              </button>
            </footer>
          </section>
        </>
      )}

      {errorMessage && (
        <section className="emptyStateCard">
          <strong>Invoice error</strong>
          <p>{errorMessage}</p>
        </section>
      )}

      {isLoading ? (
        <section className="emptyStateCard">
          <strong>Loading invoices…</strong>
        </section>
      ) : invoices.length === 0 ? (
        <section className="cleanerPropertiesFirstProperty">
          <div className="cleanerPropertiesFirstPropertyIcon">🧾</div>
          <p className="cleanerPropertiesEyebrow">Start here</p>
          <h2>Create your first invoice</h2>
          <p>
            Turn completed work into a professional invoice and prepare it for
            Stripe payment.
          </p>

          <button
            className="cleanerCreateFirstPropertyButton"
            type="button"
            onClick={() => setShowCreateInvoice(true)}
          >
            Create Invoice
            <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : filteredInvoices.length === 0 ? (
        <section className="emptyStateCard cleanerInvoiceFilterEmptyState">
          <strong>No invoices in this category</strong>
          <p>
            There are currently no invoices matching the selected filter.
          </p>
          <button
            className="secondaryButton"
            type="button"
            onClick={() => setSelectedStatus("all")}
          >
            View All Invoices
          </button>
        </section>
      ) : (
        <section className="reservationWorkspaceCard">
          <div className="operationsCardHeader cleanerInvoiceHistoryHeader">
            <div>
              <p className="eyebrow">Invoice history</p>
              <h3>{filteredInvoices.length} invoices</h3>
            </div>

            <div className="cleanerInvoiceWorkFilterWrap">
              <button
                type="button"
                className="secondaryButton cleanerInvoiceWorkFilterButton"
                aria-haspopup="dialog"
                aria-expanded={showWorkFilter}
                onClick={() => setShowWorkFilter(true)}
              >
                <span>Filter Work</span>
                <small>{workFilterLabel} ▾</small>
              </button>
            </div>
          </div>

          <div className="cleanerInvoiceLedger" role="table" aria-label="Invoice history">
            <div className="cleanerInvoiceLedgerHeader" role="row">
              <span role="columnheader">Invoice</span>
              <span role="columnheader">Customer / Property</span>
              <span role="columnheader">Issued</span>
              <span role="columnheader">Due</span>
              <span role="columnheader">Amount</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actions</span>
            </div>

            {filteredInvoices.map((invoice) => (
              <article
                className={`cleanerInvoiceLedgerRow ${
                  invoice.status === "void" ? "isVoid" : ""
                }`}
                key={invoice.id}
                role="row"
                tabIndex={invoice.status === "void" ? -1 : 0}
                aria-disabled={invoice.status === "void"}
                onClick={() => {
                  if (invoice.status === "void") return;
                  void openInvoice(invoice);
                }}
                onKeyDown={(event) => {
                  if (invoice.status === "void") return;

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openInvoice(invoice);
                  }
                }}
              >
                <div className="cleanerInvoiceLedgerNumber" role="cell">
                  <strong>{invoice.invoice_number}</strong>
                </div>

                <div className="cleanerInvoiceLedgerCustomer" role="cell">
                  <strong>
                    {invoice.invoice_items
                      ?.slice()
                      .sort(
                        (first, second) =>
                          Number(first.sort_order ?? 0) -
                          Number(second.sort_order ?? 0)
                      )[0]?.description ||
                      invoice.property_name ||
                      "Service invoice"}
                  </strong>
                  <small>Task date: {getInvoiceTaskDate(invoice)}</small>
                </div>

                <div className="cleanerInvoiceLedgerDate" role="cell" data-label="Issued">
                  {formatInvoiceDate(invoice.issue_date)}
                </div>

                <div className="cleanerInvoiceLedgerDate" role="cell" data-label="Due">
                  {formatInvoiceDate(invoice.due_date)}
                </div>

                <div className="cleanerInvoiceLedgerAmount" role="cell">
                  <strong>{formatMoney(invoice.total_cents)}</strong>
                </div>


                <div className="cleanerInvoiceLedgerStatus" role="cell">
                  <span
                    className={`cleanerInvoiceStatusBadge status-${invoice.status}`}
                    aria-label={`Invoice status ${invoice.status}`}
                  >
                    {invoice.status.toUpperCase()}
                  </span>
                </div>

                <div className="cleanerInvoiceLedgerActions" role="cell">
                  {invoice.status === "void" ? (
                    <span className="cleanerInvoiceVoidHistoryNote">
                      Record only
                    </span>
                  ) : (
                    <>
                      <button
                        className="secondaryButton cleanerInvoiceViewButton"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openInvoice(invoice);
                        }}
                      >
                        View
                      </button>

                      {["sent", "viewed", "overdue"].includes(invoice.status) && (
                        <button
                          className="secondaryButton cleanerInvoicePaidButton"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMarkPaid(invoice);
                          }}
                        >
                          Mark Paid
                        </button>
                      )}

                      {["sent", "viewed", "overdue"].includes(invoice.status) && (
                        <button
                          className="secondaryButton cleanerInvoiceVoidButton"
                          type="button"
                          disabled={isVoidingInvoice}
                          onClick={(event) => {
                            event.stopPropagation();
                            void voidInvoice(invoice);
                          }}
                        >
                          Void
                        </button>
                      )}

                      {invoice.status === "draft" && (
                        <button
                          className="cleanerPropertyDeleteButton"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteDraftInvoice(invoice);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedInvoice && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!isSendingInvoice) closeInvoiceFlow();
          }}
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader cleanerInvoicePreviewHeader">
              <div>
                <p className="eyebrow">Invoice preview</p>
                <div className="cleanerInvoicePreviewTitleRow">
                  <h3>{selectedInvoice.invoice_number}</h3>
                  <span
                    className={`cleanerInvoiceStatusBadge status-${selectedInvoice.status}`}
                  >
                    {selectedInvoice.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <button
                className="cleanerScheduleClose"
                type="button"
                disabled={isSendingInvoice}
                onClick={closeInvoiceFlow}
                aria-label="Close invoice preview"
              >
                ✕
              </button>
            </div>

            <section className="reservationWorkspaceCard cleanerInvoicePreviewCard">
              <div className="cleanerInvoiceBillTo">
                <div>
                  <p className="eyebrow">Bill to</p>
                  <h3>{selectedInvoice.customer_name}</h3>
                  <p>{selectedInvoice.customer_email || "No email added"}</p>
                </div>

                <strong>{formatMoney(selectedInvoice.total_cents)}</strong>
              </div>

              {sendConfirmation && (
                <div className="cleanerInvoiceSentNotice" role="status">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>Invoice sent</strong>
                    <p>{sendConfirmation}</p>
                  </div>
                </div>
              )}

              {!sendConfirmation &&
                ["sent", "viewed", "overdue"].includes(selectedInvoice.status) &&
                selectedInvoice.stripe_payment_link && (
                  <div className="cleanerInvoiceSentNotice" role="status">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>Payment request is active</strong>
                      <p>
                        Stripe is hosting the secure payment page. AMR is
                        waiting for the customer&apos;s payment.
                      </p>
                    </div>
                  </div>
                )}

              <section
                className="cleanerInvoiceServiceDetails"
                aria-label="Service details"
              >
                <div>
                  <span>Service</span>
                  <strong>
                    {getInvoiceServiceDetails(selectedInvoice).serviceType}
                  </strong>
                </div>
                <div>
                  <span>Service date</span>
                  <strong>
                    {getInvoiceServiceDetails(selectedInvoice).serviceDate}
                  </strong>
                </div>
                <div>
                  <span>Property / Customer</span>
                  <strong>
                    {getInvoiceServiceDetails(selectedInvoice).propertyOrCustomer}
                  </strong>
                </div>
              </section>

              <div className="cleanerInvoiceItems">
                <div className="cleanerInvoiceItemsHeader">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Amount</span>
                </div>

                {isLoadingInvoice ? (
                  <p className="mutedText">Loading invoice items…</p>
                ) : (
                  selectedInvoiceItems.map((item) => (
                    <article className="cleanerInvoiceItemRow" key={item.id}>
                      <div>
                        <strong>{item.description}</strong>
                        <small>{formatMoney(item.unit_price_cents)} each</small>
                      </div>
                      <span>{Number(item.quantity)}</span>
                      <strong>{formatMoney(item.line_total_cents)}</strong>
                    </article>
                  ))
                )}
              </div>

              <div className="cleanerInvoicePreviewTotals">
                <p>
                  <span>Subtotal</span>
                  <strong>{formatMoney(selectedInvoice.subtotal_cents)}</strong>
                </p>
                <p>
                  <span>Tax</span>
                  <strong>{formatMoney(selectedInvoice.tax_cents)}</strong>
                </p>
                <p>
                  <span>Total</span>
                  <strong>{formatMoney(selectedInvoice.total_cents)}</strong>
                </p>
              </div>

              <p>
                Issued {formatInvoiceDate(selectedInvoice.issue_date)} · Due{" "}
                {formatInvoiceDate(selectedInvoice.due_date)}
              </p>

              {selectedInvoice.payment_terms && (
                <p>
                  <strong>Terms:</strong> {selectedInvoice.payment_terms}
                </p>
              )}

              {selectedInvoice.notes && (
                <p>
                  <strong>Notes:</strong> {selectedInvoice.notes}
                </p>
              )}

              {selectedInvoice.status === "void" && (
                <div className="cleanerInvoiceVoidedNotice" role="status">
                  <span aria-hidden="true">⊘</span>
                  <div>
                    <strong>Invoice voided</strong>
                    <p>
                      This invoice is retained for your records and is no longer
                      active or payable.
                    </p>
                  </div>
                </div>
              )}

              {selectedInvoice.status === "paid" && (
                <div className="cleanerInvoicePaymentSummary">
                  <strong>Payment recorded</strong>
                  <p>
                    {selectedInvoice.payment_source === "stripe"
                      ? "Paid automatically through AMR"
                      : `Paid manually${selectedInvoice.manual_payment_method ? ` via ${selectedInvoice.manual_payment_method}` : ""}`}
                  </p>
                  <small>{formatInvoiceDate(selectedInvoice.paid_at)}</small>
                </div>
              )}
            </section>

            {copyMessage && <p>{copyMessage}</p>}

            <div className="cleanerJobPrimaryActions">
              {selectedInvoice.status === "draft" && (
                <button
                  className="primaryButton"
                  type="button"
                  disabled={isSendingInvoice || isLoadingInvoice}
                  onClick={() => void sendInvoice(selectedInvoice)}
                >
                  {isSendingInvoice
                    ? "Creating Payment Link…"
                    : "Send Invoice"}
                </button>
              )}

              {["sent", "viewed", "overdue"].includes(selectedInvoice.status) && (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => openMarkPaid(selectedInvoice)}
                >
                  Mark as Paid
                </button>
              )}

              {["sent", "viewed", "overdue"].includes(selectedInvoice.status) && (
                <button
                  className="secondaryButton cleanerInvoiceVoidButton"
                  type="button"
                  disabled={isVoidingInvoice}
                  onClick={() => void voidInvoice(selectedInvoice)}
                >
                  {isVoidingInvoice ? "Voiding…" : "Void Invoice"}
                </button>
              )}

              {selectedInvoice.status !== "void" &&
                selectedInvoice.stripe_payment_link && (
                <>
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() =>
                      window.open(
                        selectedInvoice.stripe_payment_link ?? "",
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    Preview Payment Page
                  </button>

                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => void copyPaymentLink(selectedInvoice)}
                  >
                    Copy Payment Link
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {showMarkPaid && invoiceToMarkPaid && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (!isMarkingPaid) setShowMarkPaid(false);
          }}
        >
          <section className="modalCard cleanerMarkPaidModal" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <p className="eyebrow">Record outside payment</p>
                <h3>Mark Invoice Paid</h3>
                <p>{invoiceToMarkPaid.invoice_number} · {formatMoney(invoiceToMarkPaid.total_cents)}</p>
              </div>
              <button
                className="secondaryButton"
                type="button"
                disabled={isMarkingPaid}
                onClick={() => setShowMarkPaid(false)}
              >
                Close
              </button>
            </div>

            <form className="cleanerIssueForm" onSubmit={markInvoicePaid}>
              <label>
                Payment date
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })}
                  required
                />
              </label>

              <label>
                Amount received
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                  required
                />
              </label>

              <label className="fullWidth">
                Payment method
                <select
                  value={paymentForm.method}
                  onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}
                  required
                >
                  <option value="">Choose payment method</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Venmo">Venmo</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Cash App">Cash App</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Bank transfer">Bank transfer</option>
                  <option value="Card outside AMR">Card outside AMR</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="fullWidth">
                Reference or confirmation number
                <input
                  value={paymentForm.reference}
                  onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })}
                  placeholder="Optional check number or transaction reference"
                />
              </label>

              <label className="fullWidth">
                Internal note
                <textarea
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
                  placeholder="Optional note for your records"
                />
              </label>

              <p className="cleanerPaymentNotice">
                AMR is not listed because payments completed through AMR are recorded automatically.
              </p>

              {errorMessage && <p>{errorMessage}</p>}

              <button className="primaryButton" type="submit" disabled={isMarkingPaid}>
                {isMarkingPaid ? "Saving Payment…" : "Mark Paid"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showCreateInvoice && (
        <div
          className="modalOverlay"
          onClick={() => {
            if (isSaving) return;
            onInitialTaskConsumed?.();
            closeInvoiceFlow();
          }}
        >
          <section
            className="modalCard"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">New invoice</p>
                <h3>Create Invoice</h3>
              </div>

              <button
                className="secondaryButton"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  onInitialTaskConsumed?.();
                  closeInvoiceFlow();
                }}
              >
                Close
              </button>
            </div>

            <form className="cleanerIssueForm" onSubmit={createDraftInvoice}>
              <label>
                Property
                <select
                  value={form.propertyId}
                  onChange={(event) => handlePropertyChange(event.target.value)}
                >
                  <option value="">Manual invoice</option>
                  {homes.map((home) => (
                    <option key={home.id} value={home.id}>
                      {home.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Completed task
                <select
                  value={form.reservationId}
                  onChange={(event) =>
                    setForm({ ...form, reservationId: event.target.value })
                  }
                  disabled={!form.propertyId}
                >
                  <option value="">No linked task</option>
                  {propertyReservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.guestName ?? "Completed task"} ·{" "}
                      {reservation.departure}
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

              <label className="fullWidth">
                Description
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                />
              </label>

              <label>
                Unit price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(event) =>
                    setForm({ ...form, unitPrice: event.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                Tax amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taxAmount}
                  onChange={(event) =>
                    setForm({ ...form, taxAmount: event.target.value })
                  }
                />
              </label>

              <label>
                Total
                <input value={formatMoney(totalCents)} readOnly />
              </label>

              <label>
                Issue date
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(event) =>
                    setForm({ ...form, issueDate: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Due date
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm({ ...form, dueDate: event.target.value })
                  }
                />
              </label>

              <label className="fullWidth">
                Payment terms
                <input
                  value={form.paymentTerms}
                  onChange={(event) =>
                    setForm({ ...form, paymentTerms: event.target.value })
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
                  placeholder="Thank-you note, service details, or payment instructions..."
                />
              </label>

              {errorMessage && <p>{errorMessage}</p>}

              <button
                className="primaryButton"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Creating Invoice…" : "Continue to Send"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
