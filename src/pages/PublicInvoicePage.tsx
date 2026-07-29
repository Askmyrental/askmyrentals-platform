import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

type PublicInvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

type PublicInvoiceData = {
  invoice: {
    invoiceNumber: string;
    status: string;
    customerName: string;
    propertyName: string | null;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    currency: string;
    issueDate: string;
    dueDate: string | null;
    paidAt: string | null;
    notes: string | null;
    paymentTerms: string | null;
  };
  items: PublicInvoiceItem[];
  cleaner: {
    businessName: string;
    contactName: string | null;
    businessEmail: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zip?: string | null;
  };
};

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
}

export default function PublicInvoicePage() {
  const { publicToken } = useParams();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  const paymentState = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");

  async function loadInvoice() {
    if (!publicToken) {
      setErrorMessage("This invoice link is invalid.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:4000/api/public/invoices/${encodeURIComponent(
          publicToken
        )}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load this invoice.");
      }

      setData(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load this invoice."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoice();
  }, [publicToken]);

  useEffect(() => {
    async function verifyPayment() {
      if (paymentState !== "success" || !publicToken || !sessionId) return;

      setIsVerifyingPayment(true);
      setVerificationMessage("");
      setPaymentError("");

      try {
        const response = await fetch(
          `http://localhost:4000/api/public/invoices/${encodeURIComponent(
            publicToken
          )}/verify-payment?session_id=${encodeURIComponent(sessionId)}`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to verify the Stripe payment."
          );
        }

        setVerificationMessage("Payment confirmed. Thank you.");
        await loadInvoice();

        window.history.replaceState(
          {},
          "",
          `/pay/${encodeURIComponent(publicToken)}`
        );
      } catch (error) {
        setPaymentError(
          error instanceof Error
            ? error.message
            : "Unable to verify the Stripe payment."
        );
      } finally {
        setIsVerifyingPayment(false);
      }
    }

    void verifyPayment();
  }, [paymentState, publicToken, sessionId]);

  async function startPayment() {
    if (!publicToken) return;

    setIsStartingPayment(true);
    setPaymentError("");

    try {
      const response = await fetch(
        `http://localhost:4000/api/public/invoices/${encodeURIComponent(
          publicToken
        )}/checkout`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to start secure payment.");
      }

      if (!result.url) {
        throw new Error("Stripe did not return a secure payment page.");
      }

      window.location.href = result.url;
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Unable to start secure payment."
      );
    } finally {
      setIsStartingPayment(false);
    }
  }

  if (isLoading) {
    return (
      <main className="publicInvoicePage">
        <section className="publicInvoiceStateCard">
          <strong>Loading invoice…</strong>
        </section>
      </main>
    );
  }

  if (errorMessage || !data) {
    return (
      <main className="publicInvoicePage">
        <section className="publicInvoiceStateCard">
          <div className="publicInvoiceLogo">AMR</div>
          <h1>Invoice unavailable</h1>
          <p>{errorMessage || "This invoice could not be found."}</p>
        </section>
      </main>
    );
  }

  const { invoice, items, cleaner } = data;
  const isPaid = invoice.status === "paid";
  const amountDueCents = isPaid ? 0 : invoice.totalCents;

  const cleanerAddress = [
    cleaner.addressLine1,
    cleaner.addressLine2,
    [cleaner.city, cleaner.state, cleaner.zip].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <main className="publicInvoicePage">
      <section className="publicInvoiceShell">
        <header className="publicInvoiceHeader">
          <div className="publicInvoiceBrand">
            <div className="publicInvoiceLogo">AMR</div>
            <div>
              <p className="publicInvoiceEyebrow">Invoice from</p>
              <h1>{cleaner.businessName}</h1>
              {cleaner.contactName && <p>{cleaner.contactName}</p>}
              {cleaner.businessEmail && <p>{cleaner.businessEmail}</p>}
              {cleaner.phone && <p>{cleaner.phone}</p>}
              {cleanerAddress.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>

          <div className="publicInvoiceMeta">
            <span className={`publicInvoiceStatus status-${invoice.status}`}>
              {invoice.status.toUpperCase()}
            </span>
            <h2>{invoice.invoiceNumber}</h2>
            <p>Issued {formatDate(invoice.issueDate)}</p>
            <p>Due {formatDate(invoice.dueDate)}</p>
          </div>
        </header>

        {paymentState === "cancelled" && !isPaid && (
          <div className="publicInvoiceAlert warning">
            <strong>Payment was not completed</strong>
            <p>Your invoice is still open. You may try again when ready.</p>
          </div>
        )}

        {isVerifyingPayment && (
          <div className="publicInvoiceAlert success">
            <strong>Confirming payment</strong>
            <p>AMR is checking the completed payment with Stripe.</p>
          </div>
        )}

        {verificationMessage && isPaid && (
          <div className="publicInvoiceAlert success">
            <strong>Payment confirmed</strong>
            <p>{verificationMessage}</p>
          </div>
        )}

        {isPaid && !verificationMessage && (
          <div className="publicInvoiceAlert success">
            <strong>Paid in full</strong>
            <p>Payment was recorded on {formatDate(invoice.paidAt)}.</p>
          </div>
        )}

        <section className="publicInvoiceBillTo">
          <div>
            <p className="publicInvoiceEyebrow">Bill to</p>
            <h3>{invoice.customerName}</h3>
            <p>{invoice.propertyName || "Cleaning service"}</p>
          </div>
          <div>
            <p className="publicInvoiceEyebrow">Amount due</p>
            <strong>{formatMoney(amountDueCents, invoice.currency)}</strong>
          </div>
        </section>

        <section className="publicInvoiceItems">
          <div className="publicInvoiceItemsHeader">
            <span>Description</span>
            <span>Quantity</span>
            <span>Rate</span>
            <span>Amount</span>
          </div>

          {items.map((item) => (
            <article className="publicInvoiceItemRow" key={item.id}>
              <div>
                <strong>{item.description}</strong>
              </div>
              <span data-label="Quantity">{Number(item.quantity)}</span>
              <span data-label="Rate">
                {formatMoney(item.unit_price_cents, invoice.currency)}
              </span>
              <strong data-label="Amount">
                {formatMoney(item.line_total_cents, invoice.currency)}
              </strong>
            </article>
          ))}
        </section>

        <section className="publicInvoiceTotals">
          <p>
            <span>Subtotal</span>
            <strong>
              {formatMoney(invoice.subtotalCents, invoice.currency)}
            </strong>
          </p>
          <p>
            <span>Tax</span>
            <strong>{formatMoney(invoice.taxCents, invoice.currency)}</strong>
          </p>
          <p className="publicInvoiceGrandTotal">
            <span>{isPaid ? "Amount due" : "Total due"}</span>
            <strong>{formatMoney(amountDueCents, invoice.currency)}</strong>
          </p>
        </section>

        {(invoice.paymentTerms || invoice.notes) && (
          <section className="publicInvoiceNotes">
            {invoice.paymentTerms && (
              <div>
                <strong>Payment terms</strong>
                <p>{invoice.paymentTerms}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <strong>Notes</strong>
                <p>{invoice.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="publicInvoiceFooter">
          {isPaid ? (
            <button type="button" disabled>
              Paid
            </button>
          ) : (
            <button
              type="button"
              disabled={isStartingPayment || isVerifyingPayment}
              onClick={() => void startPayment()}
            >
              {isStartingPayment ? "Opening Secure Payment…" : "Pay Securely"}
            </button>
          )}

          {paymentError && (
            <p className="publicInvoicePaymentError" role="alert">
              {paymentError}
            </p>
          )}

          <p>Secure payments powered by Stripe</p>
        </footer>
      </section>
    </main>
  );
}
