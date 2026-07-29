import { useEffect, useMemo, useState, type FormEvent } from "react";
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

type GroupInvite = {
  id: string;
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

export default function SharedWorkspacesPage({
  selectedGroupId,
  selectedGroupName,
  selectedGroupRole,
  onBack,
}: SharedWorkspacesPageProps) {
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupMessage, setGroupMessage] = useState("");
  const [groupError, setGroupError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("cleaner");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(true);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  useEffect(() => {
    void loadGroupAccess();
  }, [selectedGroupId]);

  async function loadGroupAccess() {
    setGroupLoading(true);
    setGroupError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      const [membersResponse, invitesResult] = await Promise.all([
        fetch(`http://localhost:4000/api/groups/${selectedGroupId}/members`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        supabase
          .from("group_invites")
          .select(
            "id, email, phone_number, invited_role, status, expires_at, created_at",
          )
          .eq("group_id", selectedGroupId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      const membersResult = await membersResponse.json().catch(() => null);

      if (!membersResponse.ok) {
        throw new Error(
          membersResult?.error ??
            `Unable to load group members (${membersResponse.status}).`,
        );
      }

      if (invitesResult.error) {
        throw invitesResult.error;
      }

      const rawMembers = Array.isArray(membersResult)
        ? membersResult
        : Array.isArray(membersResult?.members)
          ? membersResult.members
          : [];

      const normalizedMembers = rawMembers.map((member: any) => {
        const returnedProfile =
          member.profile ?? member.profiles ?? member.user_profile ?? null;

        const profile = returnedProfile
          ? {
              id:
                returnedProfile.id ??
                returnedProfile.user_id ??
                member.user_id,
              email: returnedProfile.email ?? member.email ?? null,
              full_name:
                returnedProfile.full_name ?? member.full_name ?? null,
              display_name:
                returnedProfile.display_name ?? member.display_name ?? null,
              business_name:
                returnedProfile.business_name ?? member.business_name ?? null,
            }
          : {
              id: member.user_id,
              email: member.email ?? null,
              full_name: member.full_name ?? null,
              display_name: member.display_name ?? null,
              business_name: member.business_name ?? null,
            };

        return {
          ...member,
          profile,
        };
      }) as GroupMember[];

      setGroupMembers(normalizedMembers);
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

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setGroupError("Enter the person’s email address.");
      return;
    }

    setSendingInvite(true);

    try {
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

      if (!session?.access_token) {
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
      `Revoke the invitation for ${
        invite.email ?? invite.phone_number ?? "this person"
      }?`,
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
      inspector: { background: "#fce7f3", color: "#9d174d" },
    };

    return (
      styles[normalizedRole] ?? {
        background: "#f3f4f6",
        color: "#374151",
      }
    );
  }

  function getMemberInitial(member: GroupMember) {
    return getMemberDisplayName(member).trim().charAt(0).toUpperCase() || "A";
  }

  function getInviteTiming(invite: GroupInvite) {
    const createdAt = new Date(invite.created_at);
    const expiresAt = new Date(invite.expires_at);
    const now = new Date();
    const dayMs = 86400000;

    const createdDays = Math.max(
      0,
      Math.floor((now.getTime() - createdAt.getTime()) / dayMs),
    );
    const remainingDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / dayMs,
    );

    const invitedLabel =
      createdDays === 0
        ? "Invited today"
        : `Invited ${createdDays} day${createdDays === 1 ? "" : "s"} ago`;

    const expiresLabel =
      remainingDays <= 0
        ? "Expired"
        : `Expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"}`;

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

    setGroupMessage(
      `${getMemberDisplayName(member)} is now ${formatGroupRole(role)}.`,
    );
    await loadGroupAccess();
    setUpdatingMemberId(null);
  }

  async function removeGroupMember(member: GroupMember) {
    const confirmed = window.confirm(
      `Remove ${getMemberDisplayName(member)} from this team?`,
    );

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

    setGroupMessage(
      `${getMemberDisplayName(member)} was removed from the team.`,
    );
    await loadGroupAccess();
    setUpdatingMemberId(null);
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
            Manage the people, invitations, and roles connected to your active
            AMR team.
          </p>
        </div>
      </header>

      <article className="reservationWorkspaceCard">
        <div className="operationsCardHeader">
          <div>
            <p className="eyebrow">Current Team</p>
            <h3>{selectedGroupName}</h3>
            <p className="mutedText">
              Every member keeps their own AMR account while collaborating
              inside this team.
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
              {showInviteForm ? "Hide Invite Form" : "Invite to Team"}
            </button>

            {showInviteForm && (
              <form
                className="dataSourceForm"
                onSubmit={inviteGroupMember}
                style={{ marginTop: 14 }}
              >
                <label>
                  Invite by email
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="person@example.com"
                    required
                  />
                </label>

                <label>
                  Team role
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
                  {sendingInvite ? "Creating Invitation…" : "Send Invitation"}
                </button>
              </form>
            )}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            marginTop: 22,
          }}
        >
          <section>
            <div className="operationsCardHeader">
              <div>
                <p className="eyebrow">Team Members</p>
                <h3>
                  {groupMembers.length} Active Team Member
                  {groupMembers.length === 1 ? "" : "s"}
                </h3>
              </div>
            </div>

            <input
              type="search"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Search team members by name, email, or role"
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
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
                        <p
                          className="mutedText"
                          style={{ margin: "4px 0 0" }}
                        >
                          {member.profile?.email ?? "Email unavailable"}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
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
                            onChange={(event) =>
                              void updateGroupMemberRole(
                                member,
                                event.target.value,
                              )
                            }
                            aria-label={`Change role for ${getMemberDisplayName(
                              member,
                            )}`}
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
                <p className="eyebrow">Pending Invitations</p>
                <h3>
                  {groupInvites.length} Pending Invitation
                  {groupInvites.length === 1 ? "" : "s"}
                </h3>
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
                        {invite.email ?? invite.phone_number ?? "Invite link"}
                      </strong>
                      <p
                        className="mutedText"
                        style={{ margin: "4px 0 0" }}
                      >
                        {formatGroupRole(invite.invited_role)}
                      </p>
                      <p
                        className="mutedText"
                        style={{ margin: "4px 0 0", fontSize: 12 }}
                      >
                        {getInviteTiming(invite)}
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
        </div>
      </article>
    </section>
  );
}
