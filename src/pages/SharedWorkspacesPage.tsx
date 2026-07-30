import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "../utils/supabase";

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

type GroupContact = {
  id: string;
  group_id: string;
  linked_user_id?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  invited_at?: string | null;
};

type GroupInvite = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone_number: string | null;
  invited_role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type SharedWorkspacesPageProps = {
  selectedGroupId: string;
  selectedGroupName: string;
  selectedGroupRole: string;
  onBack: () => void;
};

type AddMode = "invite" | "manual";

const API_URL = "http://localhost:4000";

export default function SharedWorkspacesPage({
  selectedGroupId,
  selectedGroupName,
  selectedGroupRole,
  onBack,
}: SharedWorkspacesPageProps) {
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupContacts, setGroupContacts] = useState<GroupContact[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupMessage, setGroupMessage] = useState("");
  const [groupError, setGroupError] = useState("");

  const [addMode, setAddMode] = useState<AddMode>("invite");
  const [showAddForm, setShowAddForm] = useState(true);
  const [showManualWarning, setShowManualWarning] = useState(false);
  const manualConfirmedRef = useRef(false);
  const addPersonFormRef = useRef<HTMLFormElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("cleaner");
  const [savingPerson, setSavingPerson] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  useEffect(() => {
    void loadGroupAccess();
  }, [selectedGroupId]);

  async function getAccessToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session?.access_token) {
      throw new Error("Your login session has expired. Please log in again.");
    }

    return session.access_token;
  }

  async function loadGroupAccess() {
    setGroupLoading(true);
    setGroupError("");

    try {
      const accessToken = await getAccessToken();

      const [membersResponse, invitesResult] = await Promise.all([
        fetch(`${API_URL}/api/groups/${selectedGroupId}/members`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        supabase
          .from("group_invites")
          .select(
            "id, first_name, last_name, email, phone_number, invited_role, status, expires_at, created_at",
          )
          .eq("group_id", selectedGroupId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      const membersResult = await membersResponse.json().catch(() => null);

      if (!membersResponse.ok) {
        throw new Error(
          membersResult?.error ??
            `Unable to load team members (${membersResponse.status}).`,
        );
      }

      if (invitesResult.error) throw invitesResult.error;

      const rawMembers = Array.isArray(membersResult)
        ? membersResult
        : Array.isArray(membersResult?.members)
          ? membersResult.members
          : [];

      const normalizedMembers = rawMembers.map((member: any) => {
        const returnedProfile =
          member.profile ?? member.profiles ?? member.user_profile ?? null;

        return {
          ...member,
          profile: returnedProfile
            ? {
                email: returnedProfile.email ?? member.email ?? null,
                full_name:
                  returnedProfile.full_name ?? member.full_name ?? null,
                display_name:
                  returnedProfile.display_name ?? member.display_name ?? null,
                business_name:
                  returnedProfile.business_name ?? member.business_name ?? null,
              }
            : {
                email: member.email ?? null,
                full_name: member.full_name ?? null,
                display_name: member.display_name ?? null,
                business_name: member.business_name ?? null,
              },
        };
      }) as GroupMember[];

      setGroupMembers(normalizedMembers);
      setGroupContacts(
        (Array.isArray(membersResult?.contacts)
          ? membersResult.contacts
          : []) as GroupContact[],
      );
      setGroupInvites((invitesResult.data ?? []) as GroupInvite[]);
    } catch (error) {
      console.error("Unable to load team access", error);
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to load team members and invitations.",
      );
    } finally {
      setGroupLoading(false);
    }
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole("cleaner");
  }

  async function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupMessage("");
    setGroupError("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setGroupError("Enter the person’s first and last name.");
      return;
    }

    if (addMode === "invite" && !normalizedEmail) {
      setGroupError("An email address is required to send an AMR invitation.");
      return;
    }

    if (addMode === "manual" && !normalizedEmail && !normalizedPhone) {
      setGroupError("Enter an email address or phone number.");
      return;
    }

    if (addMode === "manual" && !manualConfirmedRef.current) {
      setShowManualWarning(true);
      return;
    }

    manualConfirmedRef.current = false;

    setSavingPerson(true);

    try {
      const accessToken = await getAccessToken();
      const endpoint =
        addMode === "invite"
          ? `${API_URL}/api/group-invites/send`
          : `${API_URL}/api/group-contacts`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          groupId: selectedGroupId,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail || null,
          phone: normalizedPhone || null,
          phoneNumber: normalizedPhone || null,
          role,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ??
            (addMode === "invite"
              ? "Unable to send the invitation."
              : "Unable to add the manual team contact."),
        );
      }

      setGroupMessage(
        addMode === "invite"
          ? `Invitation emailed to ${normalizedEmail}.`
          : `${normalizedFirstName} ${normalizedLastName} was added as a manual contact.`,
      );
      resetForm();
      manualConfirmedRef.current = false;
      setShowManualWarning(false);
      await loadGroupAccess();
    } catch (error) {
      setGroupError(
        error instanceof Error ? error.message : "Unable to add this person.",
      );
    } finally {
      setSavingPerson(false);
    }
  }

  async function updateManualContactRole(
    contact: GroupContact,
    nextRole: string,
  ) {
    if (nextRole === contact.role) return;

    setUpdatingMemberId(contact.id);
    setGroupMessage("");
    setGroupError("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/group-contacts/${contact.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            groupId: selectedGroupId,
            role: nextRole,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ?? "Unable to update this manual team member’s role.",
        );
      }

      setGroupContacts((current) =>
        current.map((item) =>
          item.id === contact.id
            ? {
                ...item,
                role: result?.contact?.role ?? nextRole,
              }
            : item,
        ),
      );

      setGroupMessage(
        `${contact.first_name} ${contact.last_name} is now assigned as ${formatGroupRole(
          nextRole,
        )}.`,
      );

      window.dispatchEvent(new Event("amr:team-contacts-updated"));
    } catch (error) {
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to update this manual team member’s role.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function inviteManualContact(contact: GroupContact) {
    setUpdatingMemberId(contact.id);
    setGroupMessage("");
    setGroupError("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `${API_URL}/api/group-contacts/${contact.id}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ groupId: selectedGroupId }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to send the invitation.");
      }

      setGroupMessage(
        `Invitation sent to ${contact.first_name} ${contact.last_name}.`,
      );
      await loadGroupAccess();
    } catch (error) {
      setGroupError(
        error instanceof Error ? error.message : "Unable to send the invitation.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function removeManualContact(contact: GroupContact) {
    if (
      !window.confirm(
        `Remove ${contact.first_name} ${contact.last_name} from this team?`,
      )
    ) {
      return;
    }

    setUpdatingMemberId(contact.id);
    setGroupError("");
    setGroupMessage("");

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `${API_URL}/api/group-contacts/${contact.id}?groupId=${encodeURIComponent(
          selectedGroupId,
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to remove the contact.");
      }

      setGroupMessage(
        `${contact.first_name} ${contact.last_name} was removed from the team.`,
      );
      await loadGroupAccess();
    } catch (error) {
      setGroupError(
        error instanceof Error ? error.message : "Unable to remove the contact.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function revokeGroupInvite(invite: GroupInvite) {
    if (!window.confirm(`Revoke the invitation for ${invite.email}?`)) return;

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
      setGroupError(error.message);
      return;
    }

    setGroupMessage("Invitation revoked.");
    await loadGroupAccess();
  }

  function formatGroupRole(value: string) {
    return value
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

  async function updateGroupMemberRole(member: GroupMember, nextRole: string) {
    setUpdatingMemberId(member.id);
    setGroupError("");
    setGroupMessage("");

    const { error } = await supabase
      .from("group_members")
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("group_id", selectedGroupId);

    if (error) {
      setGroupError(error.message);
      setUpdatingMemberId(null);
      return;
    }

    setGroupMessage(
      `${getMemberDisplayName(member)} is now ${formatGroupRole(nextRole)}.`,
    );
    await loadGroupAccess();
    setUpdatingMemberId(null);
  }

  async function removeGroupMember(member: GroupMember) {
    if (
      !window.confirm(`Remove ${getMemberDisplayName(member)} from this team?`)
    ) {
      return;
    }

    setUpdatingMemberId(member.id);

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

    setGroupMessage(`${getMemberDisplayName(member)} was removed from the team.`);
    await loadGroupAccess();
    setUpdatingMemberId(null);
  }

  const canManageGroup = ["owner", "administrator", "manager"].includes(
    selectedGroupRole,
  );

  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    const live = groupMembers.map((member) => ({
      kind: "member" as const,
      id: member.id,
      name: getMemberDisplayName(member),
      email: member.profile?.email ?? "",
      role: member.role,
      member,
    }));

    const manual = groupContacts
      .filter((contact) => !contact.linked_user_id && contact.status !== "active")
      .map((contact) => ({
        kind: "contact" as const,
        id: contact.id,
        name: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email ?? contact.phone ?? "",
        role: contact.role,
        contact,
      }));

    return [...live, ...manual].filter((person) =>
      !query
        ? true
        : [person.name, person.email, formatGroupRole(person.role)].some(
            (value) => value.toLowerCase().includes(query),
          ),
    );
  }, [groupMembers, groupContacts, memberSearch]);

  return (
    <section className="cleanerProfilePage">
      <header className="pageHeader">
        <div>
          <button
            type="button"
            className="ghostButton"
            onClick={onBack}
            style={{ marginBottom: 10 }}
          >
            ← Back to Pulse
          </button>
          <p className="eyebrow">Collaboration</p>
          <h2>Teams</h2>
          <p className="headerSubtext">
            Manage active AMR members, manual contacts, invitations, and roles.
          </p>
        </div>
      </header>

      <article className="reservationWorkspaceCard">
        <div className="operationsCardHeader">
          <div>
            <p className="eyebrow">Current Team</p>
            <h3>{selectedGroupName}</h3>
            <p className="mutedText">
              Enter the team member’s information, then invite them to AMR
              for live scheduling or add them as a manual contact.
            </p>
          </div>
          <span className="statusBadge completed">
            {formatGroupRole(selectedGroupRole)}
          </span>
        </div>

        {groupError && (
          <div className="emptyStateCard" role="alert">
            <strong>Team needs attention</strong>
            <p>{groupError}</p>
          </div>
        )}

        {groupMessage && <p className="authMessage">{groupMessage}</p>}

        {canManageGroup && (
          <section style={{ marginTop: 18 }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setShowAddForm((current) => !current)}
            >
              {showAddForm ? "Hide Add Team Member Form" : "Add Team Member"}
            </button>

            {showAddForm && (
              <div style={{ marginTop: 14 }}>
                <form
                  ref={addPersonFormRef}
                  className="dataSourceForm"
                  onSubmit={submitPerson}
                >
                  <label>
                    First name
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      autoComplete="given-name"
                      required
                    />
                  </label>

                  <label>
                    Last name
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      autoComplete="family-name"
                      required
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="Required for an AMR invitation"
                    />
                  </label>

                  <label>
                    Phone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="Optional"
                    />
                  </label>

                  <label>
                    Team role
                    <select value={role} onChange={(event) => setRole(event.target.value)}>
                      <option value="cleaner">Cleaner</option>
                      <option value="team_member">Team Member</option>
                      <option value="manager">Manager</option>
                      <option value="administrator">Administrator</option>
                      <option value="homeowner">Homeowner</option>
                      <option value="maintenance">Maintenance Worker</option>
                    </select>
                  </label>

                  <div
                    style={{
                      gridColumn: "1 / -1",
                      borderTop: "1px solid #e5e7eb",
                      marginTop: 8,
                      paddingTop: 16,
                    }}
                  >
                    <p
                      className="mutedText"
                      style={{ margin: "0 0 12px", fontSize: 13 }}
                    >
                      Choose how to add this person after entering their information.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <button
                        className="primaryButton"
                        type="button"
                        disabled={savingPerson}
                        onClick={() => {
                          setAddMode("invite");
                          setShowManualWarning(false);
                          requestAnimationFrame(() => {
                            document
                              .querySelector<HTMLFormElement>(".dataSourceForm")
                              ?.requestSubmit();
                          });
                        }}
                      >
                        {savingPerson && addMode === "invite"
                          ? "Sending…"
                          : "Invite to AMR"}
                      </button>

                      <button
                        className="secondaryButton"
                        type="button"
                        disabled={savingPerson}
                        onClick={() => {
                          setAddMode("manual");
                          setShowManualWarning(false);
                          requestAnimationFrame(() => {
                            document
                              .querySelector<HTMLFormElement>(".dataSourceForm")
                              ?.requestSubmit();
                          });
                        }}
                      >
                        {savingPerson && addMode === "manual"
                          ? "Adding…"
                          : "Add Manually"}
                      </button>
                    </div>

                    <p
                      className="mutedText"
                      style={{ margin: "10px 0 0", fontSize: 13 }}
                    >
                      Invite to AMR provides live scheduling and updates. Add
                      Manually creates a contact for printed and shared schedules.
                    </p>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        <section style={{ marginTop: 24 }}>
          <div className="operationsCardHeader">
            <div>
              <p className="eyebrow">Team Members</p>
              <h3>
                {visibleMembers.length} Team Member
                {visibleMembers.length === 1 ? "" : "s"}
              </h3>
            </div>
          </div>

          <input
            type="search"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search team members by name, email, phone, or role"
            style={{ width: "100%", marginBottom: 12 }}
          />

          {groupLoading ? (
            <p className="mutedText">Loading team…</p>
          ) : visibleMembers.length === 0 ? (
            <p className="mutedText">No matching team members found.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleMembers.map((person) => (
                <div
                  key={`${person.kind}-${person.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 14,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{person.name}</strong>
                    <p className="mutedText" style={{ margin: "4px 0 0" }}>
                      {person.email || "Contact information unavailable"}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      <span className="statusBadge">
                        {formatGroupRole(person.role)}
                      </span>
                      <span
                        className={`statusBadge ${
                          person.kind === "member" ? "completed" : ""
                        }`}
                      >
                        {person.kind === "member"
                          ? "Active in AMR"
                          : person.contact.status === "invitation_pending"
                            ? "Invitation Pending"
                            : "Manual Contact"}
                      </span>
                    </div>
                  </div>

                  {canManageGroup && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      {person.kind === "member" ? (
                        person.member.role !== "owner" && (
                          <>
                            <select
                              value={person.member.role}
                              disabled={updatingMemberId === person.member.id}
                              onChange={(event) =>
                                void updateGroupMemberRole(
                                  person.member,
                                  event.target.value,
                                )
                              }
                              style={{
                                width: 170,
                                minWidth: 170,
                                maxWidth: 170,
                                height: 42,
                                flex: "0 0 170px",
                                padding: "0 36px 0 12px",
                                border: "1px solid #d0d5dd",
                                borderRadius: 10,
                                background: "#ffffff",
                                color: "#344054",
                                fontSize: 14,
                                fontWeight: 500,
                                boxSizing: "border-box",
                              }}
                            >
                              <option value="cleaner">Cleaner</option>
                              <option value="manager">Manager</option>
                              <option value="inspector">Inspector</option>
                              <option value="maintenance">Maintenance Worker</option>
                            </select>
                            <button
                              type="button"
                              className="secondaryButton"
                              disabled={updatingMemberId === person.member.id}
                              onClick={() => void removeGroupMember(person.member)}
                            >
                              Remove
                            </button>
                          </>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            className="primaryButton"
                            disabled={
                              updatingMemberId === person.contact.id ||
                              person.contact.status === "invitation_pending"
                            }
                            onClick={() => void inviteManualContact(person.contact)}
                          >
                            {person.contact.status === "invitation_pending"
                              ? "Invitation Pending"
                              : "Invite to AMR for Live Scheduling"}
                          </button>

                          <select
                            value={person.contact.role || "cleaner"}
                            aria-label={`Role for ${person.name}`}
                            disabled={updatingMemberId === person.contact.id}
                            onChange={(event) =>
                              void updateManualContactRole(
                                person.contact,
                                event.target.value,
                              )
                            }
                            style={{
                              width: 170,
                              minWidth: 170,
                              maxWidth: 170,
                              height: 42,
                              flex: "0 0 170px",
                              padding: "0 36px 0 12px",
                              border: "1px solid #d0d5dd",
                              borderRadius: 10,
                              background: "#ffffff",
                              color: "#344054",
                              fontSize: 14,
                              fontWeight: 500,
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="cleaner">Cleaner</option>
                            <option value="manager">Manager</option>
                            <option value="inspector">Inspector</option>
                            <option value="maintenance">
                              Maintenance Worker
                            </option>
                          </select>

                          <button
                            type="button"
                            className="secondaryButton"
                            disabled={updatingMemberId === person.contact.id}
                            onClick={() => void removeManualContact(person.contact)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="operationsCardHeader">
            <div>
              <p className="eyebrow">Pending Invitations</p>
              <h3>
                {groupInvites.length} Pending Invitation
                {groupInvites.length === 1 ? "" : "s"}
              </h3>
            </div>
          </div>

          {groupInvites.length === 0 ? (
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
                      {[invite.first_name, invite.last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim() ||
                        invite.email ||
                        "Invitation"}
                    </strong>
                    <p className="mutedText" style={{ margin: "4px 0 0" }}>
                      {invite.email}
                    </p>
                  </div>
                  {canManageGroup && (
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => void revokeGroupInvite(invite)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </article>

      {showManualWarning && (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowManualWarning(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(15, 23, 42, 0.58)",
            overflowY: "auto",
          }}
        >
          <section
            className="modalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-contact-title"
            style={{
              width: "min(520px, 100%)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              margin: "auto",
              background: "#ffffff",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p className="eyebrow">Manual Contact</p>
                <h3 id="manual-contact-title">
                  Add this cleaner without AMR access?
                </h3>
              </div>

              <button
                type="button"
                className="ghostButton"
                aria-label="Close manual contact warning"
                onClick={() => setShowManualWarning(false)}
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <p className="mutedText">
              A manual contact can receive printed or shared schedules, but they
              will not receive live assignment changes, property details, task
              tools, alerts, or a personal AMR schedule.
            </p>

            <div className="emptyStateCard">
              <strong>Recommended</strong>
              <p>
                Send an AMR invitation so this cleaner can use live scheduling
                and receive up-to-date information.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  setAddMode("invite");
                  manualConfirmedRef.current = false;
                  setShowManualWarning(false);
                }}
              >
                Send Invitation Instead
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  manualConfirmedRef.current = true;
                  setShowManualWarning(false);
                  requestAnimationFrame(() => {
                    addPersonFormRef.current?.requestSubmit();
                  });
                }}
              >
                Continue Manually
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
