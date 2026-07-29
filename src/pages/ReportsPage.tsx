import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabase";

type DatePreset = "this_month" | "last_month" | "this_year" | "custom";
type InvoiceStatus = "draft" | "sent" | "viewed" | "paid" | "overdue" | "void";

type ReportInvoice = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  customer_name: string;
  property_id: string | null;
  property_name: string | null;
  total_cents: number;
  amount_paid_cents?: number | null;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

type ReportsPageProps = {
  homes: any[];
  reservations: any[];
};

const outstandingStatuses: InvoiceStatus[] = ["sent", "viewed", "overdue"];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRange(preset: DatePreset, customStart: string, customEnd: string) {
  const today = new Date();

  if (preset === "last_month") {
    const prior = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { start: dateKey(startOfMonth(prior)), end: dateKey(endOfMonth(prior)) };
  }

  if (preset === "this_year") {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }

  if (preset === "custom") {
    return { start: customStart, end: customEnd };
  }

  return { start: dateKey(startOfMonth(today)), end: dateKey(endOfMonth(today)) };
}

function isWithin(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  const key = value.slice(0, 10);
  return key >= start && key <= end;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getItemPropertyId(item: any) {
  return String(
    item.property_id ??
      item.propertyId ??
      item.home_id ??
      item.homeId ??
      ""
  );
}

function getReservationDate(item: any) {
  return (
    item.departure ??
    item.scheduled_date ??
    item.scheduledDate ??
    item.service_date ??
    item.job_date ??
    item.date ??
    ""
  );
}

function getJobPriceCents(item: any) {
  const rawValue =
    item.amount_cents ??
    item.price_cents ??
    item.total_cents ??
    item.estimated_amount_cents ??
    item.amount ??
    item.price ??
    item.cleaningFee ??
    item.cleaning_fee ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return null;

  const looksLikeCents =
    item.amount_cents !== undefined ||
    item.price_cents !== undefined ||
    item.total_cents !== undefined ||
    item.estimated_amount_cents !== undefined;

  return Math.round(looksLikeCents ? numericValue : numericValue * 100);
}

export default function ReportsPage({ homes, reservations }: ReportsPageProps) {
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customStart, setCustomStart] = useState(dateKey(startOfMonth(today)));
  const [customEnd, setCustomEnd] = useState(dateKey(today));
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const [invoices, setInvoices] = useState<ReportInvoice[]>([]);
  const [cleanerJobs, setCleanerJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const range = useMemo(
    () => getRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  useEffect(() => {
    void loadReportData();
  }, []);

  async function loadReportData() {
    setIsLoading(true);
    setErrorMessage("");

    const [invoiceResult, jobsResult] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("cleaner_jobs").select("*"),
    ]);

    if (invoiceResult.error) {
      console.error("Report invoice load failed", invoiceResult.error);
      setErrorMessage(invoiceResult.error.message);
    } else {
      setInvoices((invoiceResult.data ?? []) as ReportInvoice[]);
    }

    if (jobsResult.error) {
      console.warn("Cleaner jobs were not included in reports", jobsResult.error);
      setCleanerJobs([]);
    } else {
      setCleanerJobs(jobsResult.data ?? []);
    }

    setIsLoading(false);
  }

  const report = useMemo(() => {
    const matchesProperty = (item: any) =>
      selectedPropertyId === "all" ||
      getItemPropertyId(item) === selectedPropertyId;

    const scopedInvoices = invoices.filter(matchesProperty);
    const scopedReservations = reservations.filter(matchesProperty);
    const scopedCleanerJobs = cleanerJobs.filter(matchesProperty);

    const issuedInvoices = scopedInvoices.filter((invoice) =>
      isWithin(invoice.issue_date || invoice.created_at, range.start, range.end)
    );

    const paidInvoices = scopedInvoices.filter(
      (invoice) =>
        invoice.status === "paid" &&
        isWithin(invoice.paid_at || invoice.issue_date, range.start, range.end)
    );

    const outstandingInvoices = issuedInvoices.filter((invoice) =>
      outstandingStatuses.includes(invoice.status)
    );

    const revenueCents = paidInvoices.reduce(
      (total, invoice) =>
        total + (invoice.amount_paid_cents ?? invoice.total_cents ?? 0),
      0
    );

    const outstandingCents = outstandingInvoices.reduce(
      (total, invoice) => total + (invoice.total_cents ?? 0),
      0
    );

    const completedReservations = scopedReservations.filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      const completedDate =
        item.completed_at ?? item.completedAt ?? item.departure ?? item.date;

      return (
        status.includes("complete") &&
        status !== "no clean needed" &&
        isWithin(completedDate, range.start, range.end)
      );
    });

    const completedJobs = scopedCleanerJobs.filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      const completedDate =
        item.completed_at ??
        item.completedAt ??
        item.service_date ??
        item.scheduled_date ??
        item.job_date ??
        item.date;

      return (
        (status.includes("complete") || status.includes("invoice")) &&
        isWithin(completedDate, range.start, range.end)
      );
    });

    const jobsCompleted =
      completedReservations.length + completedJobs.length;

    const todayKey = dateKey(new Date());

    const upcomingReservations = scopedReservations.filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      const taskDate = getReservationDate(item);
      const source = String(item.source ?? "").toLowerCase();

      const operationalSource =
        source === "vrbo" ||
        source === "airbnb" ||
        source === "guest reservation" ||
        source === "owner block";

      return (
        operationalSource &&
        status !== "no clean needed" &&
        !status.includes("complete") &&
        taskDate >= todayKey &&
        isWithin(taskDate, range.start, range.end)
      );
    });

    const upcomingJobs = scopedCleanerJobs.filter((item) => {
      const status = String(item.status ?? "").toLowerCase();
      const taskDate = getReservationDate(item);

      return (
        !status.includes("complete") &&
        !status.includes("invoice") &&
        status !== "cancelled" &&
        taskDate >= todayKey &&
        isWithin(taskDate, range.start, range.end)
      );
    });

    const reservationForecastItems = upcomingReservations.map((item) => {
      const propertyId = getItemPropertyId(item);
      const home = homes.find(
        (home) => String(home.id) === propertyId
      );
      const fee = Number(
        item.cleaningFee ??
          item.cleaning_fee ??
          home?.cleaningFee ??
          home?.cleaning_fee ??
          0
      );
      const amountCents =
        Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) : null;

      return {
        id: `reservation-${item.id}`,
        propertyId,
        propertyName: home?.name ?? "Unassigned property",
        date: getReservationDate(item),
        type:
          String(item.source ?? "").toLowerCase() === "owner block"
            ? "Owner Block"
            : "Turnover",
        amountCents,
      };
    });

    const jobForecastItems = upcomingJobs.map((item) => {
      const propertyId = getItemPropertyId(item);
      const home = homes.find(
        (home) => String(home.id) === propertyId
      );

      return {
        id: `job-${item.id}`,
        propertyId,
        propertyName:
          home?.name ??
          item.property_name ??
          item.customer_name ??
          "Manual job",
        date: getReservationDate(item),
        type: "Manual Job",
        amountCents: getJobPriceCents(item),
      };
    });

    const forecastItems = [
      ...reservationForecastItems,
      ...jobForecastItems,
    ];

    const projectedRevenueCents = forecastItems.reduce(
      (total, item) => total + (item.amountCents ?? 0),
      0
    );

    const unpricedForecastJobs = forecastItems.filter(
      (item) => item.amountCents === null
    ).length;

    const forecastCounts = {
      total: forecastItems.length,
      turnovers: forecastItems.filter((item) => item.type === "Turnover").length,
      ownerBlocks: forecastItems.filter((item) => item.type === "Owner Block").length,
      manualJobs: forecastItems.filter((item) => item.type === "Manual Job").length,
      unpriced: unpricedForecastJobs,
    };

    const propertyMap = new Map<
      string,
      {
        property: string;
        jobs: number;
        turnovers: number;
        manualJobs: number;
        upcomingJobs: number;
        projectedRevenue: number;
        unpricedJobs: number;
        revenue: number;
        outstanding: number;
        invoices: number;
      }
    >();

    const ensureProperty = (
      propertyId: string,
      propertyName?: string | null
    ) => {
      const home = homes.find(
        (item) => String(item.id) === String(propertyId)
      );
      const property =
        propertyName || home?.name || "Unassigned property";
      const key = propertyId || property;

      const current = propertyMap.get(key) ?? {
        property,
        jobs: 0,
        turnovers: 0,
        manualJobs: 0,
        upcomingJobs: 0,
        projectedRevenue: 0,
        unpricedJobs: 0,
        revenue: 0,
        outstanding: 0,
        invoices: 0,
      };

      propertyMap.set(key, current);
      return current;
    };

    completedReservations.forEach((item) => {
      const propertyId = getItemPropertyId(item);
      const current = ensureProperty(propertyId);
      current.jobs += 1;
      current.turnovers += 1;
    });

    completedJobs.forEach((item) => {
      const propertyId = getItemPropertyId(item);
      const current = ensureProperty(propertyId);
      current.jobs += 1;
      current.manualJobs += 1;
    });

    forecastItems.forEach((item) => {
      const current = ensureProperty(item.propertyId, item.propertyName);
      current.upcomingJobs += 1;
      current.projectedRevenue += item.amountCents ?? 0;
      if (item.amountCents === null) current.unpricedJobs += 1;
    });

    issuedInvoices
      .filter(
        (invoice) =>
          invoice.status !== "draft" && invoice.status !== "void"
      )
      .forEach((invoice) => {
        const propertyId = String(invoice.property_id ?? "");
        const current = ensureProperty(
          propertyId,
          invoice.property_name
        );

        current.invoices += 1;

        if (invoice.status === "paid") {
          current.revenue +=
            invoice.amount_paid_cents ?? invoice.total_cents;
        }

        if (outstandingStatuses.includes(invoice.status)) {
          current.outstanding += invoice.total_cents;
        }
      });

    const properties = Array.from(propertyMap.values())
      .map((item) => ({
        ...item,
        average: item.invoices
          ? Math.round(
              (item.revenue + item.outstanding) / item.invoices
            )
          : 0,
      }))
      .sort(
        (a, b) =>
          b.revenue +
          b.projectedRevenue +
          b.outstanding -
          (a.revenue + a.projectedRevenue + a.outstanding)
      );

    const customerMap = new Map<
      string,
      {
        customer: string;
        invoices: number;
        paid: number;
        outstanding: number;
        lastPayment: string | null;
      }
    >();

    issuedInvoices
      .filter(
        (invoice) =>
          invoice.status !== "draft" && invoice.status !== "void"
      )
      .forEach((invoice) => {
        const customer =
          invoice.customer_name || "Unnamed customer";
        const current =
          customerMap.get(customer.toLowerCase()) ?? {
            customer,
            invoices: 0,
            paid: 0,
            outstanding: 0,
            lastPayment: null,
          };

        current.invoices += 1;

        if (invoice.status === "paid") {
          current.paid +=
            invoice.amount_paid_cents ?? invoice.total_cents;

          const paidKey =
            invoice.paid_at?.slice(0, 10) ?? invoice.issue_date;

          if (
            !current.lastPayment ||
            paidKey > current.lastPayment
          ) {
            current.lastPayment = paidKey;
          }
        }

        if (outstandingStatuses.includes(invoice.status)) {
          current.outstanding += invoice.total_cents;
        }

        customerMap.set(customer.toLowerCase(), current);
      });

    const customers = Array.from(customerMap.values()).sort(
      (a, b) =>
        b.paid +
        b.outstanding -
        (a.paid + a.outstanding)
    );

    const monthCursor = new Date(`${range.start}T12:00:00`);
    const rangeEndDate = new Date(`${range.end}T12:00:00`);
    const months: {
      key: string;
      label: string;
      actualRevenue: number;
      projectedRevenue: number;
    }[] = [];

    while (monthCursor <= rangeEndDate && months.length < 18) {
      const key = `${monthCursor.getFullYear()}-${String(
        monthCursor.getMonth() + 1
      ).padStart(2, "0")}`;

      months.push({
        key,
        label: monthCursor.toLocaleDateString(undefined, {
          month: "short",
        }),
        actualRevenue: 0,
        projectedRevenue: 0,
      });

      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    paidInvoices.forEach((invoice) => {
      const key = (invoice.paid_at || invoice.issue_date).slice(
        0,
        7
      );
      const month = months.find((item) => item.key === key);

      if (month) {
        month.actualRevenue +=
          invoice.amount_paid_cents ?? invoice.total_cents;
      }
    });

    forecastItems.forEach((item) => {
      const month = months.find(
        (entry) => entry.key === item.date.slice(0, 7)
      );
      if (month) month.projectedRevenue += item.amountCents ?? 0;
    });

    const invoiceCounts = {
      paid: issuedInvoices.filter(
        (invoice) => invoice.status === "paid"
      ).length,
      outstanding: outstandingInvoices.length,
      viewed: issuedInvoices.filter(
        (invoice) => invoice.status === "viewed"
      ).length,
      overdue: issuedInvoices.filter(
        (invoice) => invoice.status === "overdue"
      ).length,
      void: issuedInvoices.filter(
        (invoice) => invoice.status === "void"
      ).length,
    };

    return {
      revenueCents,
      outstandingCents,
      jobsCompleted,
      completedTurnovers: completedReservations.length,
      completedManualJobs: completedJobs.length,
      averageInvoiceCents: paidInvoices.length
        ? Math.round(revenueCents / paidInvoices.length)
        : 0,
      projectedRevenueCents,
      forecastCounts,
      forecastItems,
      properties,
      customers,
      months,
      invoiceCounts,
    };
  }, [
    cleanerJobs,
    homes,
    invoices,
    range.end,
    range.start,
    reservations,
    selectedPropertyId,
  ]);

  function exportCsv() {
    const rows: string[][] = [
      ["AMR Business Report"],
      ["Date range", range.start, range.end],
      [
        "Property",
        selectedPropertyId === "all"
          ? "All properties"
          : homes.find(
              (home) => String(home.id) === selectedPropertyId
            )?.name ?? "Selected property",
      ],
      [],
      ["Overview"],
      ["Revenue", formatMoney(report.revenueCents)],
      ["Jobs completed", String(report.jobsCompleted)],
      ["Completed turnovers", String(report.completedTurnovers)],
      ["Completed manual jobs", String(report.completedManualJobs)],
      ["Outstanding", formatMoney(report.outstandingCents)],
      ["Average invoice", formatMoney(report.averageInvoiceCents)],
      ["Projected revenue", formatMoney(report.projectedRevenueCents)],
      ["Upcoming jobs", String(report.forecastCounts.total)],
      ["Unpriced upcoming jobs", String(report.forecastCounts.unpriced)],
      [],
      [
        "Property",
        "Completed Jobs",
        "Upcoming Jobs",
        "Turnovers",
        "Manual Jobs",
        "Actual Revenue",
        "Projected Revenue",
        "Average Invoice",
        "Outstanding",
      ],
      ...report.properties.map((item) => [
        item.property,
        String(item.jobs),
        String(item.upcomingJobs),
        String(item.turnovers),
        String(item.manualJobs),
        formatMoney(item.revenue),
        formatMoney(item.projectedRevenue),
        formatMoney(item.average),
        formatMoney(item.outstanding),
      ]),
      [],
      ["Customer", "Invoices", "Paid", "Outstanding", "Last Payment"],
      ...report.customers.map((item) => [
        item.customer,
        String(item.invoices),
        formatMoney(item.paid),
        formatMoney(item.outstanding),
        formatDate(item.lastPayment),
      ]),
    ];

    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `amr-report-${range.start}-to-${range.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const maxTrend = Math.max(
    ...report.months.map((month) =>
      Math.max(month.actualRevenue, month.projectedRevenue)
    ),
    1
  );

  return (
    <main className="cleanerReportsPage">
      <style>{`
        .cleanerReportsPage { display: grid; gap: 18px; }
        .reportsHeader { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; }
        .reportsHeader h1 { margin:0; font-size:34px; letter-spacing:-.04em; }
        .reportsHeader p { margin:7px 0 0; color:#64748b; }
        .reportsActions { display:flex; gap:9px; flex-wrap:wrap; }
        .reportsFilterBar, .reportsPanel, .reportsMetricCard { background:#fff; border:1px solid #e5e7eb; box-shadow:0 14px 36px rgba(15,23,42,.06); }
        .reportsFilterBar { display:flex; align-items:end; gap:12px; flex-wrap:wrap; border-radius:22px; padding:14px; }
        .reportsFilterBar label { display:grid; gap:6px; min-width:150px; color:#475569; font-size:12px; font-weight:800; }
        .reportsMetrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .reportsMetricCard { border-radius:22px; padding:18px; }
        .reportsMetricIcon { width:38px; height:38px; display:grid; place-items:center; border-radius:13px; background:#eff6ff; margin-bottom:14px; }
        .reportsMetricCard span { display:block; color:#64748b; font-size:12px; font-weight:800; }
        .reportsMetricCard strong { display:block; margin-top:5px; font-size:27px; letter-spacing:-.04em; }
        .reportsMetricCard small { display:block; margin-top:6px; color:#94a3b8; }
        .reportsPanel { border-radius:24px; padding:20px; min-width:0; }
        .reportsPanelHeader { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:16px; }
        .reportsPanelHeader h2 { margin:0; font-size:21px; }
        .reportsPanelHeader p { margin:5px 0 0; color:#64748b; font-size:13px; }
        .reportsTwoColumn { display:grid; grid-template-columns:1.25fr .75fr; gap:18px; }
        .reportsTrend { min-height:250px; display:flex; align-items:end; gap:10px; padding:20px 4px 0; border-top:1px solid #eef2f7; }
        .reportsTrendColumn { flex:1; min-width:34px; display:grid; grid-template-rows:1fr auto auto; gap:7px; height:210px; align-items:end; text-align:center; }
        .reportsTrendValue { color:#475569; font-size:10px; font-weight:800; }
        .reportsTrendBar { width:100%; min-height:4px; border-radius:10px 10px 4px 4px; }
        .reportsTrendBarGroup { width:100%; height:100%; display:flex; align-items:end; gap:4px; }
        .reportsTrendBar.actual { background:linear-gradient(180deg,#16a34a,#86efac); }
        .reportsTrendBar.projected { background:linear-gradient(180deg,#2563eb,#93c5fd); }
        .reportsTrendLabel { color:#64748b; font-size:11px; font-weight:800; }
        .reportsForecastMetrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:14px; }
        .reportsForecastLegend { display:flex; gap:16px; margin-top:12px; color:#64748b; font-size:12px; font-weight:800; }
        .reportsForecastLegend span { display:flex; align-items:center; gap:6px; }
        .reportsForecastLegend i { width:10px; height:10px; border-radius:999px; display:block; }
        .reportsForecastLegend i.actual { background:#16a34a; }
        .reportsForecastLegend i.projected { background:#2563eb; }
        .reportsInvoiceSummary { display:grid; gap:10px; }
        .reportsSummaryRow { display:flex; justify-content:space-between; gap:12px; padding:13px 14px; border-radius:16px; background:#f8fafc; }
        .reportsSummaryRow span { color:#64748b; }
        .reportsSummaryRow strong { font-size:17px; }
        .reportsTable { width:100%; border-collapse:collapse; }
        .reportsTable th { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.06em; text-align:left; padding:10px 12px; border-bottom:1px solid #e5e7eb; }
        .reportsTable td { padding:13px 12px; border-bottom:1px solid #eef2f7; font-size:13px; }
        .reportsTable tr:last-child td { border-bottom:0; }
        .reportsTable strong { display:block; }
        .reportsOutstanding { color:#b45309; font-weight:800; }
        .reportsPaid { color:#166534; font-weight:800; }
        .reportsEmpty { padding:24px; text-align:center; color:#64748b; background:#f8fafc; border-radius:18px; }
        .reportsError { padding:14px; border-radius:18px; background:#fff1f2; color:#9f1239; border:1px solid #fecdd3; }
        @media print { .sidebar,.mobileBottomNav,.reportsActions,.reportsFilterBar { display:none !important; } .mainContent { padding:0 !important; } .reportsPanel,.reportsMetricCard { box-shadow:none; break-inside:avoid; } }
        @media(max-width:1000px) { .reportsMetrics { grid-template-columns:repeat(2,1fr); } .reportsTwoColumn { grid-template-columns:1fr; } .reportsForecastMetrics { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:700px) { .reportsHeader { display:grid; } .reportsHeader h1 { font-size:28px; } .reportsMetrics { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } .reportsMetricCard { padding:14px; } .reportsMetricCard strong { font-size:22px; } .reportsPanel { padding:14px; overflow-x:auto; } .reportsTable { min-width:680px; } .reportsFilterBar { display:grid; grid-template-columns:1fr 1fr; } .reportsFilterBar label:first-child { grid-column:1/-1; } .reportsTrend { min-width:470px; } }
      `}</style>

      <header className="reportsHeader">
        <div>
          <p className="eyebrow">Business intelligence snapshot</p>
          <h1>Reports</h1>
          <p>Review actual performance, upcoming workload, and projected revenue for any property and date range.</p>
        </div>
        <div className="reportsActions">
          <button className="ghostButton" type="button" onClick={() => window.print()}>Print Report</button>
          <button className="primaryButton" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
      </header>

      <section className="reportsFilterBar" aria-label="Report date filters">
        <label>
          Property
          <select
            value={selectedPropertyId}
            onChange={(event) =>
              setSelectedPropertyId(event.target.value)
            }
          >
            <option value="all">All Properties</option>
            {homes.map((home) => (
              <option key={home.id} value={String(home.id)}>
                {home.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date range
          <select value={preset} onChange={(event) => setPreset(event.target.value as DatePreset)}>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label>Start date<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label>End date<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </>
        )}
        <span className="mutedText">{formatDate(range.start)} – {formatDate(range.end)}</span>
        <small className="mutedText">These filters control both actual results and the future revenue forecast below.</small>
      </section>

      {errorMessage && <div className="reportsError"><strong>Reports could not load.</strong> {errorMessage}</div>}

      <section className="reportsMetrics" aria-label="Business overview">
        <article className="reportsMetricCard"><div className="reportsMetricIcon">💵</div><span>Revenue</span><strong>{isLoading ? "—" : formatMoney(report.revenueCents)}</strong><small>Paid during this range</small></article>
        <article className="reportsMetricCard"><div className="reportsMetricIcon">✅</div><span>Jobs Completed</span><strong>{isLoading ? "—" : report.jobsCompleted}</strong><small>Actual completed work</small></article>
        <article className="reportsMetricCard"><div className="reportsMetricIcon">🏡</div><span>Turnovers</span><strong>{isLoading ? "—" : report.completedTurnovers}</strong><small>Completed reservation cleans</small></article>
        <article className="reportsMetricCard"><div className="reportsMetricIcon">💼</div><span>Manual Jobs</span><strong>{isLoading ? "—" : report.completedManualJobs}</strong><small>Completed independent jobs</small></article>
        <article className="reportsMetricCard"><div className="reportsMetricIcon">⏳</div><span>Outstanding</span><strong>{isLoading ? "—" : formatMoney(report.outstandingCents)}</strong><small>Sent, viewed, or overdue</small></article>
        <article className="reportsMetricCard"><div className="reportsMetricIcon">🧾</div><span>Average Invoice</span><strong>{isLoading ? "—" : formatMoney(report.averageInvoiceCents)}</strong><small>Average paid invoice</small></article>
      </section>

      <section className="reportsTwoColumn">
        <article className="reportsPanel">
          <div className="reportsPanelHeader">
            <div>
              <h2>Revenue Forecast</h2>
              <p>Actual paid revenue and projected revenue from scheduled work.</p>
            </div>
          </div>

          <div className="reportsForecastMetrics">
            <div className="reportsSummaryRow"><span>Projected Revenue</span><strong>{formatMoney(report.projectedRevenueCents)}</strong></div>
            <div className="reportsSummaryRow"><span>Upcoming Jobs</span><strong>{report.forecastCounts.total}</strong></div>
            <div className="reportsSummaryRow"><span>Turnovers</span><strong>{report.forecastCounts.turnovers}</strong></div>
            <div className="reportsSummaryRow"><span>Owner Blocks</span><strong>{report.forecastCounts.ownerBlocks}</strong></div>
            <div className="reportsSummaryRow"><span>Manual Jobs</span><strong>{report.forecastCounts.manualJobs}</strong></div>
            <div className="reportsSummaryRow"><span>Missing Prices</span><strong>{report.forecastCounts.unpriced}</strong></div>
          </div>

          {report.months.length ? (
            <div className="reportsTrend">
              {report.months.map((month) => (
                <div className="reportsTrendColumn" key={month.key}>
                  <span className="reportsTrendValue">
                    {month.projectedRevenue
                      ? formatMoney(month.projectedRevenue)
                      : month.actualRevenue
                        ? formatMoney(month.actualRevenue)
                        : "$0"}
                  </span>
                  <div className="reportsTrendBarGroup">
                    <div
                      className="reportsTrendBar actual"
                      title={`Actual: ${formatMoney(month.actualRevenue)}`}
                      style={{
                        height: `${Math.max(
                          3,
                          (month.actualRevenue / maxTrend) * 100
                        )}%`,
                      }}
                    />
                    <div
                      className="reportsTrendBar projected"
                      title={`Projected: ${formatMoney(month.projectedRevenue)}`}
                      style={{
                        height: `${Math.max(
                          3,
                          (month.projectedRevenue / maxTrend) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="reportsTrendLabel">{month.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="reportsEmpty">
              No actual or projected revenue is recorded for this range.
            </div>
          )}

          <div className="reportsForecastLegend">
            <span><i className="actual" /> Actual</span>
            <span><i className="projected" /> Projected</span>
          </div>
        </article>

        <article className="reportsPanel">
          <div className="reportsPanelHeader"><div><h2>Invoice Summary</h2><p>Financial status at a glance.</p></div></div>
          <div className="reportsInvoiceSummary">
            <div className="reportsSummaryRow"><span>Paid</span><strong>{report.invoiceCounts.paid}</strong></div>
            <div className="reportsSummaryRow"><span>Outstanding</span><strong>{report.invoiceCounts.outstanding}</strong></div>
            <div className="reportsSummaryRow"><span>Viewed</span><strong>{report.invoiceCounts.viewed}</strong></div>
            <div className="reportsSummaryRow"><span>Overdue</span><strong>{report.invoiceCounts.overdue}</strong></div>
            <div className="reportsSummaryRow"><span>Void</span><strong>{report.invoiceCounts.void}</strong></div>
          </div>
        </article>
      </section>

      <section className="reportsPanel">
        <div className="reportsPanelHeader"><div><h2>Property Performance</h2><p>Compare the homes generating your work and revenue.</p></div></div>
        {report.properties.length ? (
          <table className="reportsTable">
            <thead><tr><th>Property</th><th>Completed</th><th>Upcoming</th><th>Actual Revenue</th><th>Projected Revenue</th><th>Unpriced</th><th>Outstanding</th></tr></thead>
            <tbody>{report.properties.map((item) => <tr key={item.property}><td><strong>{item.property}</strong></td><td>{item.jobs}</td><td>{item.upcomingJobs}</td><td className="reportsPaid">{formatMoney(item.revenue)}</td><td>{formatMoney(item.projectedRevenue)}</td><td>{item.unpricedJobs}</td><td className={item.outstanding ? "reportsOutstanding" : "reportsPaid"}>{item.outstanding ? formatMoney(item.outstanding) : "Paid in full"}</td></tr>)}</tbody>
          </table>
        ) : <div className="reportsEmpty">Property performance will appear as invoices are created.</div>}
      </section>

      <section className="reportsPanel">
        <div className="reportsPanelHeader"><div><h2>Customer Health</h2><p>See paid revenue, open balances, and recent payment activity by homeowner.</p></div></div>
        {report.customers.length ? (
          <table className="reportsTable">
            <thead><tr><th>Customer</th><th>Invoices</th><th>Paid</th><th>Outstanding</th><th>Last Payment</th></tr></thead>
            <tbody>{report.customers.map((item) => <tr key={item.customer}><td><strong>{item.customer}</strong></td><td>{item.invoices}</td><td className="reportsPaid">{formatMoney(item.paid)}</td><td className={item.outstanding ? "reportsOutstanding" : "reportsPaid"}>{item.outstanding ? formatMoney(item.outstanding) : "$0"}</td><td>{formatDate(item.lastPayment)}</td></tr>)}</tbody>
          </table>
        ) : <div className="reportsEmpty">Customer health will appear once invoices exist in this range.</div>}
      </section>
    </main>
  );
}
