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


type GroupMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at?: string | null;
  profile?: {
    email?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  } | null;
};

type GroupInvite = {
  id: string;
  email: string | null;
  phone_number: string | null;
  invited_role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type CleanerProfilePageProps = {
  selectedGroupId: string;
  selectedGroupName: string;
  selectedGroupRole: string;
  onOpenProperties: () => void;
  onStartBusiness: (businessName: string) => Promise<void>;
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

export default function CleanerProfilePage({
  selectedGroupId,
  selectedGroupName,
  selectedGroupRole,
  onOpenProperties,
  onStartBusiness,
}: CleanerProfilePageProps) {
  const [profile, setProfile] = useState<CleanerProfileRow | null>(null);
  const [form, setForm] = useState<CleanerProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingPayments, setConnectingPayments] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupMessage, setGroupMessage] = useState("");
  const [groupError, setGroupError] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("cleaner");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showBusinessInformation, setShowBusinessInformation] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [showBusinessCreation, setShowBusinessCreation] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [businessCreationError, setBusinessCreationError] = useState("");

  const normalizedGroupRole = String(selectedGroupRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const isAssignedTeamMember = [
    "cleaner",
    "employee",
    "team_member",
    "member",
  ].includes(normalizedGroupRole);

  const canUseBusinessTools = !isAssignedTeamMember;

  useEffect(() => {
    void loadProfile();

    if (canUseBusinessTools) {
      void refreshStripeStatus();
    }
  }, [canUseBusinessTools]);

  useEffect(() => {
    void loadGroupAccess();
  }, [selectedGroupId]);

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

  async function loadGroupAccess() {
    setGroupLoading(true);
    setGroupError("");

    try {
      const [membersResult, invitesResult] = await Promise.all([
        supabase
          .from("group_members")
          .select("id, user_id, role, status, joined_at, created_at")
          .eq("group_id", selectedGroupId)
          .neq("status", "removed")
          .order("created_at", { ascending: true }),

        supabase
          .from("group_invites")
          .select(
            "id, email, phone_number, invited_role, status, expires_at, created_at"
          )
          .eq("group_id", selectedGroupId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (membersResult.error) throw membersResult.error;
      if (invitesResult.error) throw invitesResult.error;

      const rawMembers = membersResult.data ?? [];
      const memberUserIds = rawMembers.map((member: any) =>
        String(member.user_id),
      );

      let profilesById = new Map<string, any>();

      if (memberUserIds.length > 0) {
        const profileResult = await supabase
          .from("profiles")
          .select("id, email, full_name, display_name, business_name")
          .in("id", memberUserIds);

        if (profileResult.error) throw profileResult.error;

        profilesById = new Map(
          (profileResult.data ?? []).map((memberProfile: any) => [
            String(memberProfile.id),
            memberProfile,
          ]),
        );
      }

      setGroupMembers(
        rawMembers.map((member: any) => ({
          ...member,
          profile: profilesById.get(String(member.user_id)) ?? null,
        })) as GroupMember[],
      );

      setGroupInvites((invitesResult.data ?? []) as GroupInvite[]);
    } catch (error) {
      console.error("Unable to load group access", error);
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to load group members and invitations.",
      );
    } finally {
      setGroupLoading(false);
    }
  }

  async function inviteGroupMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupMessage("");
    setGroupError("");

    const normalizedFirstName = inviteFirstName.trim();
    const normalizedLastName = inviteLastName.trim();
    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedFirstName || !normalizedLastName) {
      setGroupError("Enter the person’s first and last name.");
      return;
    }

    if (!normalizedEmail) {
      setGroupError("Enter the person’s email address.");
      return;
    }

    setSendingInvite(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const user = userData.user;

      if (!user) {
        throw new Error("You must be logged in to invite a member.");
      }

      const existingPendingInvite = groupInvites.some(
        (invite) =>
          invite.status === "pending" &&
          invite.email?.trim().toLowerCase() === normalizedEmail,
      );

      if (existingPendingInvite) {
        throw new Error("A pending invitation already exists for this email.");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      const response = await fetch(
        "http://localhost:4000/api/group-invites/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            groupId: selectedGroupId,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            email: normalizedEmail,
            role: inviteRole,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to create and send the invitation.",
        );
      }

      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInviteRole("cleaner");
      setShowInviteForm(false);
      setGroupMessage(`Invitation emailed to ${normalizedEmail}.`);
      await loadGroupAccess();
    } catch (error) {
      console.error("Unable to create group invitation", error);
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to create the invitation.",
      );
    } finally {
      setSendingInvite(false);
    }
  }

  async function revokeGroupInvite(invite: GroupInvite) {
    const confirmed = window.confirm(
      `Revoke the invitation for ${invite.email ?? invite.phone_number ?? "this person"}?`,
    );

    if (!confirmed) return;

    setGroupMessage("");
    setGroupError("");

    const { error } = await supabase
      .from("group_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("group_id", selectedGroupId);

    if (error) {
      console.error("Unable to revoke invitation", error);
      setGroupError(error.message);
      return;
    }

    setGroupMessage("Invitation revoked.");
    await loadGroupAccess();
  }

  function formatGroupRole(role: string) {
    return role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getMemberDisplayName(member: GroupMember) {
    return (
      member.profile?.display_name ??
      member.profile?.full_name ??
      member.profile?.business_name ??
      member.profile?.email ??
      "AMR Member"
    );
  }

  const canManageGroup = ["owner", "administrator", "manager"].includes(
    selectedGroupRole,
  );

  const filteredGroupMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return groupMembers;

    return groupMembers.filter((member) =>
      [
        getMemberDisplayName(member),
        member.profile?.email ?? "",
        formatGroupRole(member.role),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [groupMembers, memberSearch]);
  function getRoleBadgeStyle(role: string) {
    const normalizedRole = role.toLowerCase();
    const styles: Record<string, { background: string; color: string }> = {
      owner: { background: "#dcfce7", color: "#166534" },
      manager: { background: "#dbeafe", color: "#1d4ed8" },
      administrator: { background: "#f3e8ff", color: "#7e22ce" },
      cleaner: { background: "#ffedd5", color: "#c2410c" },
      team_member: { background: "#e0f2fe", color: "#0369a1" },
      homeowner: { background: "#fef9c3", color: "#854d0e" },
      maintenance: { background: "#e5e7eb", color: "#374151" },
    };

    return styles[normalizedRole] ?? { background: "#f3f4f6", color: "#374151" };
  }

  function getMemberInitial(member: GroupMember) {
    return getMemberDisplayName(member).trim().charAt(0).toUpperCase() || "A";
  }

  function getInviteTiming(invite: GroupInvite) {
    const createdAt = new Date(invite.created_at);
    const expiresAt = new Date(invite.expires_at);
    const now = new Date();
    const dayMs = 86400000;
    const createdDays = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / dayMs));
    const remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs);

    const invitedLabel = createdDays === 0 ? "Invited today" : `Invited ${createdDays} day${createdDays === 1 ? "" : "s"} ago`;
    const expiresLabel = remainingDays <= 0 ? "Expired" : `Expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"}`;

    return `${invitedLabel} · ${expiresLabel}`;
  }

  async function updateGroupMemberRole(member: GroupMember, role: string) {
    setUpdatingMemberId(member.id);
    setGroupError("");
    setGroupMessage("");

    const { error } = await supabase
      .from("group_members")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("group_id", selectedGroupId);

    if (error) {
      setGroupError(error.message);
      setUpdatingMemberId(null);
      return;
    }

    setGroupMessage(`${getMemberDisplayName(member)} is now ${formatGroupRole(role)}.`);
    await loadGroupAccess();
    setUpdatingMemberId(null);
  }

  async function removeGroupMember(member: GroupMember) {
    const confirmed = window.confirm(`Remove ${getMemberDisplayName(member)} from this workspace?`);
    if (!confirmed) return;

    setUpdatingMemberId(member.id);
    setGroupError("");
    setGroupMessage("");

    const { error } = await supabase
      .from("group_members")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("group_id", selectedGroupId);

    if (error) {
      setGroupError(error.message);
      setUpdatingMemberId(null);
      return;
    }

    setGroupMessage(`${getMemberDisplayName(member)} was removed from the workspace.`);
    await loadGroupAccess();
    setUpdatingMemberId(null);
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
      setMessage(isAssignedTeamMember ? "Team profile saved." : "Business profile saved.");
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

  async function createBusinessWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const businessName = newBusinessName.trim();

    if (!businessName) {
      setBusinessCreationError("Enter the name of your cleaning business.");
      return;
    }

    setCreatingBusiness(true);
    setBusinessCreationError("");

    try {
      await onStartBusiness(businessName);
    } catch (error) {
      console.error("Unable to create business workspace", error);
      setBusinessCreationError(
        error instanceof Error
          ? error.message
          : "AMR could not create your business workspace.",
      );
      setCreatingBusiness(false);
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

  function SectionToggle({
    eyebrow,
    title,
    open,
    onToggle,
    status,
  }: {
    eyebrow: string;
    title: string;
    open: boolean;
    onToggle: () => void;
    status: string;
  }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: 0,
          border: 0,
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 700,
          }}
        >
          <small>{status}</small>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </span>
      </button>
    );
  }

  if (loading) {
    return (
      <section className="placeholderPage">
        <p className="eyebrow">Cleaner Profile</p>
        <h2>Loading your business profile…</h2>
      </section>
    );
  }

  if (isAssignedTeamMember) {
    return (
      <section className="cleanerProfilePage">
        <header className="pageHeader">
          <div>
            <p className="eyebrow">Team profile</p>
            <h2>My Profile</h2>
            <p className="headerSubtext">
              Confirm the information your team uses for assignments and communication.
            </p>
          </div>
        </header>

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

        <form
          className="reservationWorkspaceCard cleanerProfileForm"
          onSubmit={saveProfile}
        >
          <div>
            <p className="eyebrow">Personal information</p>
            <h3>Tell your team who you are</h3>
            <p className="mutedText">
              This information helps your manager identify and contact you. No
              payment or business setup is required to receive assignments.
            </p>
          </div>

          <div className="dataSourceForm" style={{ marginTop: 18 }}>
            <label>
              Full name
              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.businessEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessEmail: event.target.value,
                  }))
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
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
                placeholder="Phone number"
                autoComplete="tel"
              />
            </label>
          </div>

          {message && <p className="authMessage">{message}</p>}

          <div className="cardActions">
            <button className="primaryButton" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Team Profile"}
            </button>
          </div>
        </form>

        <article className="reservationWorkspaceCard" style={{ marginTop: 18 }}>
          <p className="eyebrow">Optional</p>
          <h3>Start Your Own Cleaning Business</h3>
          <p className="mutedText">
            Create a separate AMR business workspace while keeping your current
            team membership and assignments exactly as they are.
          </p>

          {!showBusinessCreation ? (
            <button
              type="button"
              className="primaryButton"
              onClick={() => {
                setBusinessCreationError("");
                setShowBusinessCreation(true);
              }}
            >
              Create My Business
            </button>
          ) : (
            <form
              onSubmit={createBusinessWorkspace}
              style={{ display: "grid", gap: 12, marginTop: 16 }}
            >
              <div className="authRecoveryNotice">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Your current team access will stay active</strong>
                  <small>
                    AMR will create a new workspace where you are the owner. You
                    can switch between both workspaces at any time.
                  </small>
                </div>
              </div>

              <label>
                Business name
                <input
                  value={newBusinessName}
                  onChange={(event) => setNewBusinessName(event.target.value)}
                  placeholder="Example: Londyn Cleaning Services"
                  autoComplete="organization"
                  autoFocus
                  required
                />
              </label>

              {businessCreationError && (
                <div className="emptyStateCard" role="alert">
                  <strong>Business workspace needs attention</strong>
                  <p>{businessCreationError}</p>
                </div>
              )}

              <div className="cardActions">
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={creatingBusiness}
                  onClick={() => {
                    setShowBusinessCreation(false);
                    setNewBusinessName("");
                    setBusinessCreationError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primaryButton"
                  disabled={creatingBusiness}
                >
                  {creatingBusiness
                    ? "Creating Business…"
                    : "Create Business Workspace"}
                </button>
              </div>
            </form>
          )}
        </article>

        <article className="reservationWorkspaceCard" style={{ marginTop: 18 }}>
          <p className="eyebrow">Team access</p>
          <h3>{selectedGroupName}</h3>
          <p className="mutedText">
            You are connected as {formatGroupRole(selectedGroupRole)}.
          </p>
        </article>

        <article className="reservationWorkspaceCard" style={{ marginTop: 18 }}>
          <p className="eyebrow">Account</p>
          <h3>Cleaner access</h3>
          <p className="mutedText">
            Signed in as {profile?.email ?? form.businessEmail ?? "AMR user"}.
          </p>

          <button
            type="button"
            className="logoutButton"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="cleanerProfilePage">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Cleaner Business Hub</p>
          <h2>Business & Team</h2>
          <p className="headerSubtext">
            Manage your company information, payments, properties, and team
            access without repeating the same setup tools.
          </p>
        </div>
      </header>

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

      <article className="reservationWorkspaceCard cleanerProfileProgressCard">
        <div className="cleanerHealthTopline">
          <div>
            <p className="eyebrow">Business readiness</p>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setShowBusinessInformation(true)}
            style={{ justifyContent: "space-between" }}
          >
            <span>Business information</span>
            <strong>{businessProfileComplete ? "✓" : "Open"}</strong>
          </button>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => setShowPayments(true)}
            style={{ justifyContent: "space-between" }}
          >
            <span>Payments</span>
            <strong>{paymentsReady ? "✓" : "Open"}</strong>
          </button>

          <button
            type="button"
            className="secondaryButton"
            onClick={onOpenProperties}
            style={{ justifyContent: "space-between" }}
          >
            <span>Properties & calendars</span>
            <strong>
              {firstPropertyReady && calendarReady ? "✓" : "Open"}
            </strong>
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
            }}
          >
            <span>Ready to work</span>
            <strong>{businessReady ? "✓" : "Not yet"}</strong>
          </div>
        </div>

        {!businessReady && (
          <p className="mutedText" style={{ marginTop: 14 }}>
            Next: {nextStep?.label ?? "Finish setup"}.{" "}
            {nextStep?.description ?? ""}
          </p>
        )}
      </article>

      <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
        <form
          className="reservationWorkspaceCard cleanerProfileForm"
          onSubmit={saveProfile}
        >
          <SectionToggle
            eyebrow="Business information"
            title="Company and mailing details"
            open={showBusinessInformation}
            onToggle={() =>
              setShowBusinessInformation((current) => !current)
            }
            status={businessProfileComplete ? "Complete" : "Needs setup"}
          />

          {showBusinessInformation && (
            <>
              <div className="dataSourceForm" style={{ marginTop: 18 }}>
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
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Business Profile"}
                </button>
              </div>
            </>
          )}
        </form>

        <article className="reservationWorkspaceCard cleanerGetPaidCard">
          <SectionToggle
            eyebrow="Payments"
            title={
              paymentsReady
                ? "Payment account connected"
                : "Connect your payment account"
            }
            open={showPayments}
            onToggle={() => setShowPayments((current) => !current)}
            status={paymentsReady ? "Complete" : "Needs setup"}
          />

          {showPayments && (
            <div style={{ marginTop: 18 }}>
              <p className="mutedText">
                {paymentsReady
                  ? "Your payment account is connected and ready for AMR invoices and payouts."
                  : "Connect payments so homeowners can pay invoices through AMR and deposits can go directly to you."}
              </p>

              {!paymentsReady && (
                <p className="mutedText">
                  Stripe securely handles bank, tax, and identity details. AMR
                  does not store that sensitive information.
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
            </div>
          )}
        </article>

        <article className="reservationWorkspaceCard">
          <div className="operationsCardHeader">
            <div>
              <p className="eyebrow">Group access</p>
              <h3>{selectedGroupName}</h3>
              <p className="mutedText">
                Invite cleaners, managers, homeowners, or maintenance workers
                into this workspace.
              </p>
            </div>

            <span className="statusBadge completed">
              {formatGroupRole(selectedGroupRole)}
            </span>
          </div>

          {groupError && (
            <div className="emptyStateCard" role="alert">
              <strong>Group access needs attention</strong>
              <p>{groupError}</p>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => void loadGroupAccess()}
              >
                Try Again
              </button>
            </div>
          )}

          {groupMessage && <p className="authMessage">{groupMessage}</p>}

          {canManageGroup && (
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setShowInviteForm((current) => !current)}
              >
                {showInviteForm ? "Hide Invite Form" : "Invite Another Member"}
              </button>

              {showInviteForm && (
                <form
                  className="dataSourceForm"
                  onSubmit={inviteGroupMember}
                  style={{ marginTop: 14 }}
                >
                  <label>
                    First name
                    <input
                      value={inviteFirstName}
                      onChange={(event) => setInviteFirstName(event.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      required
                    />
                  </label>

                  <label>
                    Last name
                    <input
                      value={inviteLastName}
                      onChange={(event) => setInviteLastName(event.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      required
                    />
                  </label>

                  <label>
                    Member email
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="person@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label>
                    Group role
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value)}
                    >
                      <option value="cleaner">Cleaner</option>
                      <option value="team_member">Team Member</option>
                      <option value="manager">Manager</option>
                      <option value="administrator">Administrator</option>
                      <option value="homeowner">Homeowner</option>
                      <option value="maintenance">Maintenance Worker</option>
                    </select>
                  </label>

                  <button
                    className="primaryButton"
                    type="submit"
                    disabled={sendingInvite}
                  >
                    {sendingInvite ? "Creating Invitation…" : "Invite Member"}
                  </button>
                </form>
              )}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              marginTop: 22,
            }}
          >
            <section>
              <div className="operationsCardHeader">
                <div>
                  <p className="eyebrow">Active access</p>
                  <h3>{groupMembers.length} Active Member{groupMembers.length === 1 ? "" : "s"}</h3>
                </div>
              </div>

              <input
                type="search"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Search members by name, email, or role"
                style={{ width: "100%", marginBottom: 12 }}
              />

              {groupLoading ? (
                <p className="mutedText">Loading members…</p>
              ) : filteredGroupMembers.length === 0 ? (
                <p className="mutedText">No matching members found.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredGroupMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 14,
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {getMemberInitial(member)}
                        </div>
                        <div>
                          <strong>{getMemberDisplayName(member)}</strong>
                          <p className="mutedText" style={{ margin: "4px 0 0" }}>
                            {member.profile?.email ?? "Email unavailable"}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span
                          className="statusBadge"
                          style={getRoleBadgeStyle(member.role)}
                        >
                          {formatGroupRole(member.role)}
                        </span>

                        {canManageGroup && member.role !== "owner" && (
                          <>
                            <select
                              value={member.role}
                              disabled={updatingMemberId === member.id}
                              onChange={(event) => void updateGroupMemberRole(member, event.target.value)}
                              aria-label={`Change role for ${getMemberDisplayName(member)}`}
                            >
                              <option value="cleaner">Cleaner</option>
                              <option value="team_member">Team Member</option>
                              <option value="manager">Manager</option>
                              <option value="administrator">Administrator</option>
                              <option value="homeowner">Homeowner</option>
                              <option value="maintenance">Maintenance Worker</option>
                            </select>
                            <button
                              type="button"
                              className="secondaryButton"
                              disabled={updatingMemberId === member.id}
                              onClick={() => void removeGroupMember(member)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="operationsCardHeader">
                <div>
                  <p className="eyebrow">Awaiting response</p>
                  <h3>{groupInvites.length} Pending Invitation{groupInvites.length === 1 ? "" : "s"}</h3>
                </div>
              </div>

              {groupLoading ? (
                <p className="mutedText">Loading invitations…</p>
              ) : groupInvites.length === 0 ? (
                <p className="mutedText">No pending invitations.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {groupInvites.map((invite) => (
                    <div
                      key={invite.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                      }}
                    >
                      <div>
                        <strong>
                          {invite.email ??
                            invite.phone_number ??
                            "Invite link"}
                        </strong>
                        <p
                          className="mutedText"
                          style={{ margin: "4px 0 0" }}
                        >
                          {formatGroupRole(invite.invited_role)}
                        </p>
                        <p className="mutedText" style={{ margin: "4px 0 0", fontSize: 12 }}>
                          {getInviteTiming(invite)}
                        </p>
                      </div>

                      {canManageGroup && (
                        <button
                          type="button"
                          className="secondaryButton"
                          onClick={() =>
                            void revokeGroupInvite(invite)
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </article>

        <article className="reservationWorkspaceCard">
          <p className="eyebrow">Account</p>
          <h3>Cleaner access</h3>
          <p className="mutedText">
            Signed in as{" "}
            {profile?.email ?? (form.businessEmail || "AMR user")}.
          </p>

          <button
            type="button"
            className="logoutButton"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </article>
      </div>
    </section>
  );
}
