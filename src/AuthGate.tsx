import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Navigate } from "react-router-dom";
import { supabase } from "./utils/supabase";
import App from "./App";
import MyGroupsPage from "./pages/MyGroupsPage";

type AppRole = "cleaner" | "owner" | "employee" | "admin";

type Profile = {
  id: string;
  role: AppRole;
  email?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
  phone?: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_details_submitted?: boolean | null;
};

type CleanerLaunchPage = "Cleaner Portal" | "Cleaner Properties";

type GroupOption = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  role: string;
};

type PendingGroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  invitedRole: string;
  expiresAt: string;
};

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [propertyCount, setPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [launchPage, setLaunchPage] = useState<CleanerLaunchPage | null>(null);
  const [skipSetupForSession, setSkipSetupForSession] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [profileRetryKey, setProfileRetryKey] = useState(0);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupLoadError, setGroupLoadError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingGroupInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteLoadError, setInviteLoadError] = useState("");
  const [accountRefreshKey, setAccountRefreshKey] = useState(0);
  const [employeeWelcomeDismissed, setEmployeeWelcomeDismissed] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Unable to restore Supabase session", error);
      }

      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        setSession((currentSession) => {
          const currentUserId = currentSession?.user?.id ?? null;
          const nextUserId = newSession?.user?.id ?? null;
          const userChanged = currentUserId !== nextUserId;

          if (event === "SIGNED_OUT" || !newSession) {
            setProfile(null);
            setPropertyCount(0);
            setLaunchPage(null);
            setSkipSetupForSession(false);
            setProfileLoadError("");
            setGroups([]);
            setSelectedGroupId(null);
            setGroupLoadError("");
            setPendingInvites([]);
            setInviteMessage("");
            setInviteLoadError("");
            setEmployeeWelcomeDismissed(false);
          } else if (event === "SIGNED_IN" && userChanged) {
            setProfile(null);
            setPropertyCount(0);
            setLaunchPage(null);
            setSkipSetupForSession(false);
            setProfileLoadError("");
            setGroups([]);
            setSelectedGroupId(null);
            setGroupLoadError("");
            setPendingInvites([]);
            setInviteMessage("");
            setInviteLoadError("");
            setEmployeeWelcomeDismissed(false);
          }

          /*
           * TOKEN_REFRESHED and USER_UPDATED should not clear the loaded
           * profile. Clearing it here caused the app to show the
           * "Profile connection needed" screen even though the user was
           * still authenticated.
           */
          return newSession;
        });
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setProfile(null);
      setPropertyCount(0);
      setProfileLoadError("");
      return;
    }

    let cancelled = false;

    const wait = (milliseconds: number) =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    async function loadAccount() {
      setProfileLoading(true);
      setSetupMessage("");
      setProfileLoadError("");

      let profileData: Profile | null = null;
      let lastProfileError: { message?: string; code?: string } | null = null;

      /*
       * Retry brief/transient failures before showing a recovery screen.
       * A missing row is not retried repeatedly.
       */
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const profileResult = await supabase
          .from("profiles")
          .select(
            "id, role, email, full_name, display_name, business_name, phone, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted"
          )
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (!profileResult.error) {
          profileData = profileResult.data as Profile | null;
          lastProfileError = null;
          break;
        }

        lastProfileError = profileResult.error;

        if (attempt < 2) {
          await wait(450 * (attempt + 1));
        }
      }

      if (cancelled) return;

      if (lastProfileError) {
        console.error("Unable to load AMR profile", lastProfileError);
        setProfileLoadError(
          "AMR could not load your team. Your account is still signed in."
        );
        setProfileLoading(false);
        return;
      }

      if (!profileData) {
        setProfileLoadError(
          "No AMR team is connected to this login yet."
        );
        setProfileLoading(false);
        return;
      }

      const propertyResult = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);

      if (cancelled) return;

      if (propertyResult.error) {
        console.error(
          "Unable to count cleaner properties",
          propertyResult.error
        );
      }

      setProfile(profileData);
      setBusinessName(profileData.business_name ?? "");
      setPhone(profileData.phone ?? "");
      setPropertyCount(propertyResult.count ?? 0);
      setProfileLoading(false);
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profileRetryKey, accountRefreshKey]);

  useEffect(() => {
    const userEmail = session?.user?.email?.trim().toLowerCase();

    if (!session?.user?.id || !userEmail) {
      setPendingInvites([]);
      setInviteLoadError("");
      return;
    }

    let cancelled = false;

    async function loadPendingInvites() {
      setInvitesLoading(true);
      setInviteLoadError("");

      const { data, error } = await supabase.rpc(
        "get_my_pending_group_invites",
      );

      if (cancelled) return;

      if (error) {
        console.error("Unable to load pending group invitations", error);
        setInviteLoadError(
          "AMR could not check your pending invitations.",
        );
        setInvitesLoading(false);
        return;
      }

      setPendingInvites(
        (data ?? []).map((invite: any) => ({
          id: String(invite.invite_id),
          groupId: String(invite.group_id),
          groupName: invite.group_name ?? "AMR Group",
          invitedRole: invite.invited_role ?? "member",
          expiresAt: invite.expires_at,
        })),
      );
      setInvitesLoading(false);
    }

    void loadPendingInvites();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email, accountRefreshKey]);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId || !profile) {
      setGroups([]);
      setSelectedGroupId(null);
      setGroupLoadError("");
      return;
    }

    let cancelled = false;

    async function loadGroups() {
      setGroupsLoading(true);
      setGroupLoadError("");

      const { data, error } = await supabase
        .from("group_members")
        .select(
          "group_id, role, status, groups(id, name, description, logo_url, status)"
        )
        .eq("user_id", userId)
        .eq("status", "active");

      if (cancelled) return;

      if (error) {
        console.error("Unable to load AMR groups", error);
        setGroupLoadError(
          "AMR could not load your teams. Your existing team is still safe."
        );
        setGroupsLoading(false);
        return;
      }

      const mappedGroups: GroupOption[] = (data ?? [])
        .map((membership: any) => {
          const relatedGroup = Array.isArray(membership.groups)
            ? membership.groups[0]
            : membership.groups;

          if (!relatedGroup || relatedGroup.status !== "active") {
            return null;
          }

          return {
            id: String(relatedGroup.id),
            name: relatedGroup.name ?? "AMR Group",
            description: relatedGroup.description ?? null,
            logoUrl: relatedGroup.logo_url ?? null,
            role: membership.role ?? "member",
          };
        })
        .filter(Boolean) as GroupOption[];

      setGroups(mappedGroups);

      const storageKey = `amr-selected-group:${userId}`;
      const savedGroupId = window.localStorage.getItem(storageKey);
      const savedGroupStillExists = mappedGroups.some(
        (group) => group.id === savedGroupId
      );

      if (mappedGroups.length === 1) {
        setSelectedGroupId(mappedGroups[0].id);
        window.localStorage.setItem(storageKey, mappedGroups[0].id);
      } else if (savedGroupStillExists && savedGroupId) {
        setSelectedGroupId(savedGroupId);
      } else {
        setSelectedGroupId(null);
      }

      setGroupsLoading(false);
    }

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profile]);

  async function respondToGroupInvite(
    inviteId: string,
    response: "accept" | "decline",
  ) {
    setInviteActionId(inviteId);
    setInviteMessage("");
    setInviteLoadError("");

    const functionName =
      response === "accept"
        ? "accept_my_group_invite"
        : "decline_my_group_invite";

    const { error } = await supabase.rpc(functionName, {
      p_invite_id: inviteId,
    });

    if (error) {
      console.error(`Unable to ${response} group invitation`, error);
      setInviteLoadError(error.message);
      setInviteActionId(null);
      return;
    }

    setInviteMessage(
      response === "accept"
        ? "Invitation accepted. Opening your new team…"
        : "Invitation declined.",
    );
    setInviteActionId(null);
    setSelectedGroupId(null);
    setAccountRefreshKey((current) => current + 1);
  }

  function formatInviteRole(role: string) {
    return role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function selectGroup(groupId: string) {
    const userId = session?.user?.id;

    setSelectedGroupId(groupId);

    if (userId) {
      window.localStorage.setItem(
        `amr-selected-group:${userId}`,
        groupId
      );
    }
  }

  function returnToGroupPicker() {
    const userId = session?.user?.id;

    setSelectedGroupId(null);

    if (userId) {
      window.localStorage.removeItem(`amr-selected-group:${userId}`);
    }
  }

  const cleanerSetupSteps = useMemo(() => {
    const paymentsReady = Boolean(
      profile?.stripe_onboarding_complete && profile?.stripe_payouts_enabled
    );

    return [
      {
        label: "Business name",
        complete: Boolean(profile?.business_name?.trim()),
      },
      {
        label: "Phone number",
        complete: Boolean(profile?.phone?.trim()),
      },
      {
        label: "Connect payments",
        complete: paymentsReady,
      },
      {
        label: "Add first property",
        complete: propertyCount > 0,
      },
      {
        label: "Invite first homeowner",
        complete: false,
      },
    ];
  }, [profile, propertyCount]);

  const completedSetupSteps = cleanerSetupSteps.filter(
    (step) => step.complete
  ).length;

  const cleanerNeedsSetup =
    profile?.role === "cleaner" &&
    (!profile.business_name?.trim() ||
      !profile.phone?.trim() ||
      propertyCount === 0);

  async function saveCleanerBasics() {
    const userId = session?.user?.id;

    if (!userId || !profile) return;

    if (!businessName.trim() || !phone.trim()) {
      setSetupMessage("Enter your business name and phone number first.");
      return;
    }

    setSavingSetup(true);
    setSetupMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .update({
        business_name: businessName.trim(),
        phone: phone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        "id, role, email, full_name, display_name, business_name, phone, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted"
      )
      .single();

    if (error) {
      console.error("Unable to save cleaner setup", error);
      setSetupMessage(error.message);
      setSavingSetup(false);
      return;
    }

    setProfile(data as Profile);
    setSetupMessage("Business details saved.");
    setSavingSetup(false);
  }

  if (
    loading ||
    (session && (profileLoading || groupsLoading || invitesLoading))
  ) {
    return (
      <div className="authPage">
        <section className="authCard authWorkspaceLoading">
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">AMR Cleaner</p>
          <h1>Opening your team…</h1>
          <p>Restoring your secure session and loading your team.</p>
          <div className="authLoadingBar" aria-hidden="true">
            <span />
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (pendingInvites.length > 0) {
    return (
      <div className="authPage">
        <section className="authCard" style={{ maxWidth: 680 }}>
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">Team invitation</p>
          <h1>You’ve been invited to AMR</h1>
          <p>
            Review the team and access level before joining.
          </p>

          <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
            {pendingInvites.map((invite) => (
              <article
                key={invite.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 18,
                }}
              >
                <p className="eyebrow">AMR team</p>
                <h2 style={{ marginBottom: 6 }}>{invite.groupName}</h2>
                <p className="mutedText">
                  Role: {formatInviteRole(invite.invitedRole)}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={inviteActionId === invite.id}
                    onClick={() =>
                      void respondToGroupInvite(invite.id, "accept")
                    }
                  >
                    {inviteActionId === invite.id
                      ? "Joining…"
                      : "Accept Invitation"}
                  </button>

                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={inviteActionId === invite.id}
                    onClick={() =>
                      void respondToGroupInvite(invite.id, "decline")
                    }
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>

          {inviteMessage && <p className="authMessage">{inviteMessage}</p>}

          {inviteLoadError && (
            <div className="emptyStateCard" role="alert">
              <strong>Invitation needs attention</strong>
              <p>{inviteLoadError}</p>
            </div>
          )}

          <button
            className="secondaryButton"
            type="button"
            style={{ marginTop: 18 }}
            onClick={() => void supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="authPage">
        <section className="authCard authRecoveryCard">
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">Team connection</p>
          <h1>We couldn&apos;t load your team</h1>
          <p>
            {profileLoadError ||
              "Your account is still signed in. Try loading your team again."}
          </p>

          <div className="authRecoveryNotice">
            <span aria-hidden="true">🔒</span>
            <div>
              <strong>Your login is still active</strong>
              <small>
                Retrying will not sign you out or erase your work.
              </small>
            </div>
          </div>

          <div className="authRecoveryActions">
            <button
              className="primaryButton"
              type="button"
              onClick={() => setProfileRetryKey((current) => current + 1)}
            >
              Try Again
            </button>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => void supabase.auth.signOut()}
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (groupLoadError) {
    return (
      <div className="authPage">
        <section className="authCard authRecoveryCard">
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">Team connection</p>
          <h1>We couldn&apos;t load your teams</h1>
          <p>{groupLoadError}</p>

          <div className="authRecoveryActions">
            <button
              className="primaryButton"
              type="button"
              onClick={() => setProfileRetryKey((current) => current + 1)}
            >
              Try Again
            </button>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => void supabase.auth.signOut()}
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="authPage">
        <section className="authCard authRecoveryCard">
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">My Teams</p>
          <h1>No active team was found</h1>
          <p>
            {inviteLoadError ||
              "Your login is working, but it is not connected to an active AMR team yet."}
          </p>

          <button
            className="secondaryButton"
            type="button"
            onClick={() => void supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </section>
      </div>
    );
  }

  if (groups.length > 1 && !selectedGroupId) {
    return (
      <MyGroupsPage
        groups={groups}
        profileName={
          profile.display_name ??
          profile.full_name ??
          profile.business_name ??
          ""
        }
        onSelectGroup={selectGroup}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );
  }

  const selectedGroupForWelcome =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0];

  if (
    profile.role === "employee" &&
    !employeeWelcomeDismissed &&
    selectedGroupForWelcome
  ) {
    return (
      <div className="authPage">
        <section className="authCard" style={{ maxWidth: 640 }}>
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">Welcome to your team</p>
          <h1>You joined {selectedGroupForWelcome.name}</h1>
          <p>
            Your invitation was accepted successfully. Your team administrator
            can now assign properties, cleaning tasks, and team access to
            you.
          </p>

          <div className="authRecoveryNotice">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>
                Role: {formatInviteRole(selectedGroupForWelcome.role)}
              </strong>
              <small>
                An empty Pulse simply means nothing has been assigned to you yet.
              </small>
            </div>
          </div>

          <button
            className="primaryButton"
            type="button"
            onClick={() => setEmployeeWelcomeDismissed(true)}
          >
            Open My Team
          </button>
        </section>
      </div>
    );
  }

  if (
    profile.role === "cleaner" &&
    cleanerNeedsSetup &&
    !skipSetupForSession &&
    !launchPage
  ) {
    return (
      <div className="authPage">
        <section className="authCard" style={{ maxWidth: 620 }}>
          <div className="brandIcon">AMR</div>
          <p className="eyebrow">AMR Cleaner Setup</p>
          <h1>Welcome to Ask My Rentals</h1>
          <p>
            Let&apos;s set up your cleaning business so Pulse can organize your
            work and help you get paid.
          </p>

          <div style={{ margin: "18px 0" }}>
            <strong>
              Setup progress: {completedSetupSteps} of {cleanerSetupSteps.length}
            </strong>
            <div
              style={{
                height: 9,
                borderRadius: 999,
                background: "#e5e7eb",
                overflow: "hidden",
                marginTop: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${
                    (completedSetupSteps / cleanerSetupSteps.length) * 100
                  }%`,
                  background: "#111827",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Business name
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Example: Coastal Turnovers"
              />
            </label>

            <label>
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Cleaner business phone"
              />
            </label>

            <button
              className="primaryButton"
              type="button"
              disabled={savingSetup}
              onClick={saveCleanerBasics}
            >
              {savingSetup ? "Saving..." : "Save Business Details"}
            </button>
          </div>

          <div style={{ display: "grid", gap: 9, margin: "20px 0" }}>
            {cleanerSetupSteps.map((step) => (
              <div
                key={step.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                }}
              >
                <span>{step.label}</span>
                <strong>{step.complete ? "✓ Complete" : "Not yet"}</strong>
              </div>
            ))}
          </div>

          {setupMessage && <p className="authMessage">{setupMessage}</p>}

          <div style={{ display: "grid", gap: 10 }}>
            <button
              className="primaryButton"
              type="button"
              onClick={() => setLaunchPage("Cleaner Properties")}
            >
              {propertyCount > 0
                ? "Open My Properties"
                : "Add My First Property"}
            </button>

            <button
              className="secondaryButton"
              type="button"
              onClick={() => setSkipSetupForSession(true)}
            >
              Continue to Cleaner Pulse
            </button>
          </div>
        </section>
      </div>
    );
  }

  const cleanerMode =
    profile.role === "cleaner" || profile.role === "employee";

  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? groups[0];

  return (
    <App
      userRole={profile.role}
      initialPage={
        launchPage ?? (cleanerMode ? "Cleaner Portal" : "Pulse")
      }
      selectedGroupId={selectedGroup.id}
      selectedGroupName={selectedGroup.name}
      selectedGroupRole={selectedGroup.role}
      canSwitchGroups={groups.length > 1}
      onChangeGroup={returnToGroupPicker}
    />
  );
}
