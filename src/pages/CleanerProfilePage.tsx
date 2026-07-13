import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

type CleanerProfileForm = {
  businessName: string;
  contactName: string;
  businessEmail: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

type CleanerProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  business_email?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_details_submitted?: boolean | null;
  onboarding_completed?: boolean | null;
  has_first_property?: boolean | null;
  calendar_connected?: boolean | null;
};

type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  complete: boolean;
};

const EMPTY_FORM: CleanerProfileForm = {
  businessName: "",
  contactName: "",
  businessEmail: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function CleanerProfilePage() {
  const [profile, setProfile] = useState<CleanerProfileRow | null>(null);
  const [form, setForm] = useState<CleanerProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingPayments, setConnectingPayments] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
  void loadProfile();
  void refreshStripeStatus();
}, []);

  async function loadProfile() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const user = userData.user;

      if (!user) {
        throw new Error("You must be logged in to view your profile.");
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Your login is active, but AMR could not find your profile row."
        );
      }

      const nextProfile = data as CleanerProfileRow;

      setProfile(nextProfile);
      setForm({
        businessName: nextProfile.business_name ?? "",
        contactName:
          nextProfile.contact_name ??
          nextProfile.display_name ??
          nextProfile.full_name ??
          "",
        businessEmail:
          nextProfile.business_email ??
          nextProfile.email ??
          user.email ??
          "",
        phone: nextProfile.phone ?? "",
        addressLine1: nextProfile.address_line_1 ?? "",
        addressLine2: nextProfile.address_line_2 ?? "",
        city: nextProfile.city ?? "",
        state: nextProfile.state ?? "",
        postalCode: nextProfile.postal_code ?? "",
      });
    } catch (error) {
      console.error("Unable to load cleaner profile", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your cleaner profile."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const user = userData.user;

      if (!user) {
        throw new Error("You must be logged in to save your profile.");
      }

      const updates = {
        business_name: form.businessName.trim() || null,
        contact_name: form.contactName.trim() || null,
        display_name: form.contactName.trim() || null,
        full_name: form.contactName.trim() || null,
        business_email: form.businessEmail.trim() || null,
        phone: form.phone.trim() || null,
        address_line_1: form.addressLine1.trim() || null,
        address_line_2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postalCode.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "AMR could not update your profile. Confirm the profile UPDATE policy in Supabase."
        );
      }

      setProfile(data as CleanerProfileRow);
      setMessage("Business profile saved.");
    } catch (error) {
      console.error("Unable to save cleaner profile", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save your cleaner profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function refreshStripeStatus() {
 

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error(
          "Your login session has expired. Please log in again."
        );
      }

      const response = await fetch(
        "http://localhost:4000/api/stripe/connect/status",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to refresh payment status."
        );
      }

      await loadProfile();

     

      setMessage(
        result.payoutsEnabled
          ? "Payments are connected and ready."
          : "Stripe setup was received. Some payment requirements may still need attention."
      );
    } catch (error) {
      console.error("Unable to refresh Stripe status", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh payment status."
      );
    }
  }

  async function handleConnectPayments() {
    setConnectingPayments(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error(
          "Your login session has expired. Please log in again."
        );
      }

      const response = await fetch(
        "http://localhost:4000/api/stripe/connect/onboarding",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to start payment setup."
        );
      }

      if (!result.url) {
        throw new Error(
          "Stripe did not return an onboarding address."
        );
      }

      window.location.assign(result.url);
    } catch (error) {
      console.error("Unable to connect payments", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect payments."
      );
      setConnectingPayments(false);
    }
  }

  function handleAddProperty() {
    window.alert(
      "The Add First Property workflow will open from this button next."
    );
  }

  function handleRequestCalendar() {
    window.alert(
      "The secure homeowner calendar-request workflow will open from this button next."
    );
  }

  const businessProfileComplete = Boolean(
    form.businessName.trim() &&
      form.contactName.trim() &&
      form.businessEmail.trim() &&
      form.phone.trim() &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      form.postalCode.trim()
  );

  const paymentsReady = Boolean(
    profile?.stripe_account_id &&
      profile?.stripe_onboarding_complete &&
      profile?.stripe_charges_enabled &&
      profile?.stripe_payouts_enabled
  );

  const firstPropertyReady = Boolean(profile?.has_first_property);
  const calendarReady = Boolean(profile?.calendar_connected);
  const businessReady = Boolean(
    businessProfileComplete &&
      paymentsReady &&
      firstPropertyReady &&
      calendarReady
  );

  const onboardingSteps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "profile",
        label: "Business Profile",
        description: "Add your company, contact, and mailing information.",
        complete: businessProfileComplete,
      },
      {
        id: "payments",
        label: "Connect Payments",
        description: "Set up secure invoice payments and bank deposits.",
        complete: paymentsReady,
      },
      {
        id: "property",
        label: "Add First Property",
        description: "Create the first vacation rental you service.",
        complete: firstPropertyReady,
      },
      {
        id: "calendar",
        label: "Request Calendar",
        description: "Ask the homeowner to securely share the booking calendar.",
        complete: calendarReady,
      },
      {
        id: "ready",
        label: "Ready to Work",
        description: "Your cleaning business is ready to run through AMR.",
        complete: businessReady,
      },
    ],
    [
      businessProfileComplete,
      paymentsReady,
      firstPropertyReady,
      calendarReady,
      businessReady,
    ]
  );

  const completedSteps = onboardingSteps.filter((step) => step.complete).length;
  const progressPercent = Math.round(
    (completedSteps / onboardingSteps.length) * 100
  );
  const nextStep = onboardingSteps.find((step) => !step.complete);

  if (loading) {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Cleaner Profile</p>
        <h2>Loading your business profile…</h2>
      </section>
    );
  }

  return (
    <section className="cleanerProfilePage">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Cleaner Business Hub</p>
          <h2>Business Profile</h2>
          <p className="headerSubtext">
            Set up your business, connect payments, and get ready to work.
          </p>
        </div>
      </header>

      <article className="reservationWorkspaceCard cleanerProfileProgressCard">
        <div className="cleanerHealthTopline">
          <div>
            <p className="eyebrow">Setup progress</p>
            <h3>
              {businessReady
                ? "Your cleaning business is ready 🎉"
                : `${progressPercent}% complete`}
            </h3>
          </div>

          <strong>
            {completedSteps} of {onboardingSteps.length}
          </strong>
        </div>

        <div className="cleanerHealthMeter" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        <p className="mutedText">
          {businessReady
            ? "Open the app, know what to do, and get paid."
            : `Next: ${nextStep?.label ?? "Finish setup"}. ${
                nextStep?.description ?? ""
              }`}
        </p>

        <div className="cleanerOnboardingSteps">
          {onboardingSteps.map((step, index) => (
            <div
              className={`cleanerOnboardingStep ${
                step.complete ? "isComplete" : ""
              }`}
              key={step.id}
            >
              <span className="cleanerOnboardingStepNumber">
                {step.complete ? "✓" : index + 1}
              </span>
              <div>
                <strong>{step.label}</strong>
                <p className="mutedText">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      {errorMessage && (
        <div className="emptyStateCard" role="alert">
          <strong>Profile needs attention</strong>
          <p>{errorMessage}</p>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => void loadProfile()}
          >
            Try Again
          </button>
        </div>
      )}

      <div className="cleanerProfileGrid">
        <form
          className="reservationWorkspaceCard cleanerProfileForm"
          onSubmit={saveProfile}
        >
          <div className="operationsCardHeader">
            <div>
              <p className="eyebrow">Business information</p>
              <h3>Your cleaning company</h3>
            </div>

            {businessProfileComplete && (
              <span className="statusBadge completed">Complete</span>
            )}
          </div>

          <div className="dataSourceForm">
            <label>
              Business name
              <input
                value={form.businessName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessName: event.target.value,
                  }))
                }
                placeholder="Example: Coastal Turnovers"
              />
            </label>

            <label>
              Contact name
              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Your name"
              />
            </label>

            <label>
              Business email
              <input
                type="email"
                value={form.businessEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessEmail: event.target.value,
                  }))
                }
                placeholder="you@business.com"
              />
            </label>

            <label>
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Business phone"
              />
            </label>
          </div>

          <div className="operationsCardHeader cleanerProfileSectionHeader">
            <div>
              <p className="eyebrow">Business address</p>
              <h3>Mailing information</h3>
            </div>
          </div>

          <div className="dataSourceForm">
            <label className="fullWidth">
              Street address
              <input
                value={form.addressLine1}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    addressLine1: event.target.value,
                  }))
                }
                placeholder="Street address"
              />
            </label>

            <label className="fullWidth">
              Address line 2
              <input
                value={form.addressLine2}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    addressLine2: event.target.value,
                  }))
                }
                placeholder="Suite, unit, or building"
              />
            </label>

            <label>
              City
              <input
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              State
              <input
                value={form.state}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
                placeholder="FL"
              />
            </label>

            <label>
              ZIP code
              <input
                value={form.postalCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
                placeholder="32578"
              />
            </label>
          </div>

          {message && <p className="authMessage">{message}</p>}

          <div className="cardActions">
            <button className="primaryButton" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Business Profile"}
            </button>
          </div>
        </form>

        <aside className="cleanerProfileSidebar">
          <article className="reservationWorkspaceCard cleanerGetPaidCard">
            <p className="eyebrow">Step 2 · Get paid</p>
            <h3>
              {paymentsReady ? "You’re ready to get paid" : "Let’s get you paid"}
            </h3>

            <p className="mutedText">
              {paymentsReady
                ? "Your payment account is connected and ready for AMR invoices and payouts."
                : "Connect your payment account so homeowners can pay invoices through AMR and deposits can go directly to you."}
            </p>

            {!paymentsReady && (
              <p className="mutedText">
                Stripe securely handles your bank, tax, and identity details.
                AMR never stores that sensitive information.
              </p>
            )}

            <button
              type="button"
              className="primaryButton"
              onClick={handleConnectPayments}
              disabled={connectingPayments}
            >
              {connectingPayments
                ? "Opening Stripe…"
                : paymentsReady
                  ? "Manage Payments"
                  : "Connect Payments"}
            </button>
          </article>

          <article className="reservationWorkspaceCard cleanerSetupActionCard">
            <p className="eyebrow">Step 3 · Properties</p>
            <h3>
              {firstPropertyReady ? "First property added" : "Add your first property"}
            </h3>
            <p className="mutedText">
              Create the first vacation rental your business cleans and manages.
            </p>
            <button
              type="button"
              className={firstPropertyReady ? "secondaryButton" : "primaryButton"}
              onClick={handleAddProperty}
            >
              {firstPropertyReady ? "View Properties" : "Add First Property"}
            </button>
          </article>

          <article className="reservationWorkspaceCard cleanerSetupActionCard">
            <p className="eyebrow">Step 4 · Calendar</p>
            <h3>
              {calendarReady ? "Calendar connected" : "Request the booking calendar"}
            </h3>
            <p className="mutedText">
              Send the homeowner a secure request so they can share their Airbnb,
              VRBO, or other iCal link without creating an account.
            </p>
            <button
              type="button"
              className={calendarReady ? "secondaryButton" : "primaryButton"}
              onClick={handleRequestCalendar}
              disabled={!firstPropertyReady}
            >
              {calendarReady ? "View Calendar" : "Request Calendar"}
            </button>
            {!firstPropertyReady && (
              <p className="mutedText">Add a property before requesting its calendar.</p>
            )}
          </article>

          {businessReady && (
            <article className="reservationWorkspaceCard cleanerReadyCard">
              <p className="eyebrow">Setup complete</p>
              <h3>🎉 Your cleaning business is ready.</h3>
              <p className="mutedText">
                AMR is ready to help you organize work, manage calendars, send
                invoices, and get paid.
              </p>
            </article>
          )}

          <article className="reservationWorkspaceCard">
            <p className="eyebrow">Account</p>
            <h3>Cleaner access</h3>
            <p className="mutedText">
              Signed in as {profile?.email ?? (form.businessEmail || "AMR user")}.
            </p>

            <button type="button" className="logoutButton" onClick={handleLogout}>
              Log Out
            </button>
          </article>
        </aside>
      </div>
    </section>
  );
}
