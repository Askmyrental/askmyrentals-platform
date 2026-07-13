require("dotenv").config({
  path: require("path").join(__dirname, ".env.server"),
});
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5189";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env.server");
}

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL in .env.server");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.server"
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
const DATA_DIR = path.join(__dirname, "data");
const APP_DATA_FILE = path.join(DATA_DIR, "app-data.json");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function isSafeCalendarUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
async function requireAuthenticatedUser(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Missing authentication token.",
      });
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired authentication token.",
      });
    }

    req.amrUser = user;
    next();
  } catch (error) {
    console.error("Authentication failed", error);

    res.status(401).json({
      error: "Unable to authenticate this request.",
    });
  }
}

async function getProfileForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      [
        "id",
        "email",
        "business_email",
        "business_name",
        "contact_name",
        "phone",
        "stripe_account_id",
      ].join(",")
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No AMR profile exists for this user.");
  }

  return data;
}

async function updateStripeProfileStatus(account) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_onboarding_complete: Boolean(
        account.details_submitted
      ),
      stripe_charges_enabled: Boolean(
        account.charges_enabled
      ),
      stripe_payouts_enabled: Boolean(
        account.payouts_enabled
      ),
      stripe_details_submitted: Boolean(
        account.details_submitted
      ),
      stripe_connected_at: account.details_submitted
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    throw new Error(error.message);
  }
}
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Ask My Rentals backend server",
    features: ["ical-fetch", "local-persistence", "listing-lookup"],
  });
});

app.post("/api/lookup-listing", async (req, res) => {
  const { input } = req.body || {};

  if (!input || typeof input !== "string") {
    return res.status(400).json({
      error: "Missing listing input.",
    });
  }

  const trimmed = input.trim();
  const isAirbnb = trimmed.toLowerCase().includes("airbnb.com");
  const isVrbo = /^\d{5,}$/.test(trimmed);

  if (!isAirbnb && !isVrbo) {
    return res.status(400).json({
      error: "Input must be a VRBO ID or Airbnb URL.",
    });
  }

  if (isVrbo) {
    return res.json({
      ok: true,
      property: {
        sourceType: "VRBO",
        listingId: trimmed,
        name: `VRBO Property ${trimmed}`,
        city: "Broken Bow",
        address: "Auto-detected from VRBO ID",
        bedrooms: "3",
        bathrooms: "2",
        maxGuests: "8",
        notes: "Demo VRBO auto-fill completed.",
      },
    });
  }

  return res.json({
    ok: true,
    property: {
      sourceType: "Airbnb",
      listingUrl: trimmed,
      name: "Airbnb Listing Auto Fill",
      city: "Nashville",
      address: "Auto-detected from Airbnb URL",
      bedrooms: "2",
      bathrooms: "1",
      maxGuests: "4",
      notes: "Demo Airbnb auto-fill completed.",
    },
  });
});
app.post(
  "/api/stripe/connect/onboarding",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const user = req.amrUser;
      const profile = await getProfileForUser(user.id);

      let stripeAccountId = profile.stripe_account_id;

      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email:
            profile.business_email ||
            profile.email ||
            user.email ||
            undefined,
          capabilities: {
            card_payments: {
              requested: true,
            },
            transfers: {
              requested: true,
            },
          },
          business_profile: {
            name: profile.business_name || undefined,
          },
          metadata: {
            amr_user_id: user.id,
          },
        });

        stripeAccountId = account.id;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            stripe_account_id: stripeAccountId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (error) {
          throw new Error(error.message);
        }
      }

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${CLIENT_URL}/app?stripe=refresh`,
        return_url: `${CLIENT_URL}/app?stripe=return`,
        type: "account_onboarding",
      });

      res.json({
        url: accountLink.url,
      });
    } catch (error) {
      console.error(
        "Unable to create Stripe onboarding link",
        error
      );

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Stripe onboarding.",
      });
    }
  }
);

app.get(
  "/api/stripe/connect/status",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const user = req.amrUser;
      const profile = await getProfileForUser(user.id);

      if (!profile.stripe_account_id) {
        return res.json({
          connected: false,
          detailsSubmitted: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }

      const account = await stripe.accounts.retrieve(
        profile.stripe_account_id
      );

      await updateStripeProfileStatus(account);
   

      res.json({
        connected: true,
        stripeAccountId: account.id,
        detailsSubmitted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
      });
    } catch (error) {
      console.error("Unable to retrieve Stripe status", error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve payment status.",
      });
    }
  }
);

app.post(
  "/api/stripe/connect/dashboard",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const profile = await getProfileForUser(req.amrUser.id);

      if (!profile.stripe_account_id) {
        return res.status(400).json({
          error: "No connected Stripe account was found.",
        });
      }

      const loginLink = await stripe.accounts.createLoginLink(
        profile.stripe_account_id
      );

      res.json({
        url: loginLink.url,
      });
    } catch (error) {
      console.error("Unable to open Stripe Dashboard", error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to open payment management.",
      });
    }
  }
);


app.post(
  "/api/stripe/invoices/checkout",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const invoiceId = String(req.body?.invoiceId || "").trim();

      if (!invoiceId) {
        return res.status(400).json({
          error: "Missing invoice ID.",
        });
      }

      const profile = await getProfileForUser(req.amrUser.id);

      if (!profile.stripe_account_id) {
        return res.status(400).json({
          error: "Connect a Stripe payment account before sending invoices.",
        });
      }

      const account = await stripe.accounts.retrieve(
        profile.stripe_account_id
      );

      if (!account.charges_enabled || !account.payouts_enabled) {
        return res.status(400).json({
          error: "Your Stripe account is not ready to accept payments yet.",
        });
      }

      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("cleaner_id", req.amrUser.id)
        .maybeSingle();

      if (invoiceError) {
        throw new Error(invoiceError.message);
      }

      if (!invoice) {
        return res.status(404).json({
          error: "Invoice not found.",
        });
      }

      if (invoice.status === "paid") {
        return res.status(409).json({
          error: "This invoice has already been paid.",
        });
      }

      if (invoice.status === "void") {
        return res.status(409).json({
          error: "A void invoice cannot be sent.",
        });
      }

      if (invoice.stripe_payment_link && invoice.status !== "draft") {
        return res.json({
          ok: true,
          reused: true,
          url: invoice.stripe_payment_link,
          sessionId: invoice.stripe_checkout_session_id,
        });
      }

      const { data: items, error: itemError } = await supabaseAdmin
        .from("invoice_items")
        .select("id, description, quantity, unit_price_cents, line_total_cents, sort_order")
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true });

      if (itemError) {
        throw new Error(itemError.message);
      }

      if (!items || items.length === 0) {
        return res.status(400).json({
          error: "Add at least one item before sending the invoice.",
        });
      }

      const calculatedSubtotal = items.reduce(
        (sum, item) => sum + Number(item.line_total_cents || 0),
        0
      );
      const calculatedTax = Number(invoice.tax_cents || 0);
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      if (calculatedTotal <= 0) {
        return res.status(400).json({
          error: "Invoice total must be greater than zero.",
        });
      }

      const lineItems = items.map((item) => ({
        price_data: {
          currency: String(invoice.currency || "usd").toLowerCase(),
          product_data: {
            name: item.description || "Cleaning service",
          },
          unit_amount: Math.round(Number(item.line_total_cents || 0)),
        },
        quantity: 1,
      }));

      if (calculatedTax > 0) {
        lineItems.push({
          price_data: {
            currency: String(invoice.currency || "usd").toLowerCase(),
            product_data: {
              name: "Tax",
            },
            unit_amount: calculatedTax,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: lineItems,
          customer_email: invoice.customer_email || undefined,
          success_url: `${CLIENT_URL}/app?invoice=${encodeURIComponent(
            invoice.id
          )}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${CLIENT_URL}/app?invoice=${encodeURIComponent(
            invoice.id
          )}&payment=cancelled`,
          payment_intent_data: {
            metadata: {
              amr_invoice_id: invoice.id,
              amr_cleaner_id: req.amrUser.id,
              invoice_number: invoice.invoice_number,
            },
          },
          metadata: {
            amr_invoice_id: invoice.id,
            amr_cleaner_id: req.amrUser.id,
            invoice_number: invoice.invoice_number,
          },
        },
        {
          stripeAccount: profile.stripe_account_id,
          idempotencyKey: `amr-invoice-${invoice.id}`,
        }
      );

      if (!session.url) {
        throw new Error("Stripe did not return a payment URL.");
      }

      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "sent",
          subtotal_cents: calculatedSubtotal,
          total_cents: calculatedTotal,
          stripe_checkout_session_id: session.id,
          stripe_payment_link: session.url,
          sent_at: invoice.sent_at || now,
          updated_at: now,
        })
        .eq("id", invoice.id)
        .eq("cleaner_id", req.amrUser.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: activityError } = await supabaseAdmin
        .from("invoice_activity")
        .insert({
          invoice_id: invoice.id,
          event_type: "invoice_sent",
          event_description: "Stripe Checkout payment link created.",
          created_by: req.amrUser.id,
          metadata: {
            stripe_checkout_session_id: session.id,
          },
        });

      if (activityError) {
        console.error("Invoice activity insert failed", activityError);
      }

      res.json({
        ok: true,
        url: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Unable to create invoice checkout session", error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the invoice payment link.",
      });
    }
  }
);

app.post("/api/fetch-ical", async (req, res) => {
  const { url, source } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing calendar URL" });
  }

  if (!isSafeCalendarUrl(url)) {
    return res.status(400).json({
      error: "Calendar URL must start with http:// or https://",
    });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AskMyRentalsCalendarSync/1.0",
        Accept: "text/calendar,text/plain,*/*",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Calendar fetch failed with status ${response.status}`,
      });
    }

    const icalText = await response.text();

    if (!icalText.includes("BEGIN:VCALENDAR")) {
      return res.status(422).json({
        error: "The URL responded, but it did not look like an iCal calendar.",
      });
    }

    res.json({
      ok: true,
      source: source || "Unknown",
      length: icalText.length,
      icalText,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to fetch calendar URL from server.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/app-data", (_req, res) => {
  ensureDataDir();

  if (!fs.existsSync(APP_DATA_FILE)) {
    return res.json({
      ok: true,
      exists: false,
      data: null,
    });
  }

  try {
    const raw = fs.readFileSync(APP_DATA_FILE, "utf8");
    const data = JSON.parse(raw);

    res.json({
      ok: true,
      exists: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to read saved app data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/app-data", (req, res) => {
  ensureDataDir();

  const payload = req.body;

  if (!payload || typeof payload !== "object") {
    return res.status(400).json({
      error: "Missing app data payload.",
    });
  }

  const dataToSave = {
    ...payload,
    savedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(APP_DATA_FILE, JSON.stringify(dataToSave, null, 2), "utf8");

    res.json({
      ok: true,
      message: "App data saved.",
      savedAt: dataToSave.savedAt,
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to save app data.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ask My Rentals backend server running on http://localhost:${PORT}`);
});
