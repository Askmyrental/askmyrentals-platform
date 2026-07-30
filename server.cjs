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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const INVITE_EMAIL_FROM =
  process.env.INVITE_EMAIL_FROM || "AMR <onboarding@resend.dev>";
const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || CLIENT_URL;

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

function formatRoleLabel(role) {
  return String(role || "team member")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function sendGroupInvitationEmail({ to, groupName, role }) {
  if (!RESEND_API_KEY) {
    throw new Error(
      "Invitation email is not configured. Add RESEND_API_KEY to .env.server."
    );
  }

  const inviteUrl =
    `${PUBLIC_APP_URL}/invite?email=${encodeURIComponent(to)}` +
    `&group=${encodeURIComponent(groupName)}` +
    `&role=${encodeURIComponent(role)}`;

  const roleLabel = formatRoleLabel(role);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: INVITE_EMAIL_FROM,
      to: [to],
      subject: `You’re invited to ${groupName} on AMR`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;color:#111827">
          <div style="font-weight:800;font-size:20px;margin-bottom:20px">AMR Cleaner</div>
          <h1 style="font-size:28px;margin:0 0 12px">You’re invited to ${groupName}</h1>
          <p style="font-size:16px;line-height:1.6">
            You’ve been invited to join the team as <strong>${roleLabel}</strong>.
          </p>
          <p style="font-size:16px;line-height:1.6">
            Use the email address <strong>${to}</strong> when creating or logging into your AMR account.
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700;margin:16px 0">
            Continue to AMR
          </a>
          <p style="font-size:13px;color:#6b7280;line-height:1.5">
            After confirming your email and logging in, AMR will ask you to accept the workspace invitation.
          </p>
        </div>
      `,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message || result?.error || "Unable to send invitation email."
    );
  }

  return result;
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

app.get(
  "/api/groups/:groupId/members",
  
  requireAuthenticatedUser,
  async (req, res) => {
    console.log("✅ Group Members API Hit", req.params.groupId);
    try {
      const groupId = String(req.params.groupId || "").trim();

      if (!groupId) {
        return res.status(400).json({ error: "Missing group ID." });
      }

      const { data: requesterMembership, error: requesterMembershipError } =
        await supabaseAdmin
          .from("group_members")
          .select("id, role, status")
          .eq("group_id", groupId)
          .eq("user_id", req.amrUser.id)
          .eq("status", "active")
          .maybeSingle();

      if (requesterMembershipError) {
        throw new Error(requesterMembershipError.message);
      }

      if (!requesterMembership) {
        return res.status(403).json({
          error: "You do not have access to this workspace.",
        });
      }

      const { data: members, error: membersError } = await supabaseAdmin
        .from("group_members")
        .select("id, user_id, role, status, joined_at, created_at")
        .eq("group_id", groupId)
        .neq("status", "removed")
        .order("created_at", { ascending: true });

      if (membersError) {
        throw new Error(membersError.message);
      }

      const userIds = (members || []).map((member) => member.user_id);
      let profilesById = new Map();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select(
            [
              "id",
              "email",
              "full_name",
              "display_name",
              "business_name",
              "business_email",
              "contact_name",
              "phone",
              "address_line_1",
              "city",
              "state",
              "postal_code",
            ].join(",")
          )
          .in("id", userIds);

        if (profilesError) {
          throw new Error(profilesError.message);
        }

        profilesById = new Map(
          (profiles || []).map((profile) => [String(profile.id), profile])
        );
      }

      const { data: contacts, error: contactsError } = await supabaseAdmin
        .from("group_contacts")
        .select(
          "id, group_id, linked_user_id, first_name, last_name, email, phone, role, status, invited_at, linked_at, created_at, updated_at"
        )
        .eq("group_id", groupId)
        .neq("status", "removed")
        .order("created_at", { ascending: true });

      if (contactsError) {
        throw new Error(contactsError.message);
      }

      res.json({
        members: (members || []).map((member) => ({
          ...member,
          profile: profilesById.get(String(member.user_id)) || null,
        })),
        contacts: contacts || [],
      });
    } catch (error) {
      console.error("Unable to load group members", error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to load group members.",
      });
    }
  }
);


async function requireGroupManager(groupId, userId) {
  const { data: membership, error } = await supabaseAdmin
    .from("group_members")
    .select("id, role, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (
    !membership ||
    !["owner", "administrator", "manager"].includes(membership.role)
  ) {
    const permissionError = new Error(
      "You do not have permission to manage this team."
    );
    permissionError.statusCode = 403;
    throw permissionError;
  }

  return membership;
}

app.post(
  "/api/group-contacts",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const groupId = String(req.body?.groupId || "").trim();
      const firstName = String(req.body?.firstName || "").trim();
      const lastName = String(req.body?.lastName || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase() || null;
      const phone = String(req.body?.phone || "").trim() || null;
      const role = String(req.body?.role || "cleaner").trim();

      const allowedRoles = new Set([
        "cleaner",
        "team_member",
        "manager",
        "administrator",
        "homeowner",
        "maintenance",
        "inspector",
      ]);

      if (!groupId || !firstName || !lastName) {
        return res.status(400).json({
          error: "Group, first name, and last name are required.",
        });
      }

      if (!email && !phone) {
        return res.status(400).json({
          error: "Enter an email address or phone number.",
        });
      }

      if (!allowedRoles.has(role)) {
        return res.status(400).json({ error: "That team role is not supported." });
      }

      await requireGroupManager(groupId, req.amrUser.id);

      if (email) {
        const { data: existingContact, error: existingContactError } =
          await supabaseAdmin
            .from("group_contacts")
            .select("id, status")
            .eq("group_id", groupId)
            .ilike("email", email)
            .neq("status", "removed")
            .maybeSingle();

        if (existingContactError) {
          throw new Error(existingContactError.message);
        }

        if (existingContact) {
          return res.status(409).json({
            error: "A manual team contact already exists for this email.",
          });
        }
      }

      const { data: contact, error: contactError } = await supabaseAdmin
        .from("group_contacts")
        .insert({
          group_id: groupId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role,
          status: "manual",
          created_by: req.amrUser.id,
        })
        .select(
          "id, group_id, linked_user_id, first_name, last_name, email, phone, role, status, invited_at, linked_at, created_at, updated_at"
        )
        .single();

      if (contactError) throw new Error(contactError.message);

      res.json({ ok: true, contact });
    } catch (error) {
      console.error("Unable to create manual team contact", error);
      res.status(error?.statusCode || 500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the manual team contact.",
      });
    }
  }
);

app.patch(
  "/api/group-contacts/:contactId",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const contactId = String(req.params.contactId || "").trim();
      const groupId = String(req.body?.groupId || "").trim();
      const role = req.body?.role ? String(req.body.role).trim() : null;
      const status = req.body?.status ? String(req.body.status).trim() : null;

      if (!contactId || !groupId) {
        return res.status(400).json({ error: "Contact and group are required." });
      }

      await requireGroupManager(groupId, req.amrUser.id);

      const updates = { updated_at: new Date().toISOString() };

      if (role) updates.role = role;
      if (status) updates.status = status;

      const { data: contact, error } = await supabaseAdmin
        .from("group_contacts")
        .update(updates)
        .eq("id", contactId)
        .eq("group_id", groupId)
        .select(
          "id, group_id, linked_user_id, first_name, last_name, email, phone, role, status, invited_at, linked_at, created_at, updated_at"
        )
        .single();

      if (error) throw new Error(error.message);

      res.json({ ok: true, contact });
    } catch (error) {
      console.error("Unable to update manual team contact", error);
      res.status(error?.statusCode || 500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the manual team contact.",
      });
    }
  }
);

app.delete(
  "/api/group-contacts/:contactId",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const contactId = String(req.params.contactId || "").trim();
      const groupId = String(req.query?.groupId || "").trim();

      if (!contactId || !groupId) {
        return res.status(400).json({ error: "Contact and group are required." });
      }

      await requireGroupManager(groupId, req.amrUser.id);

      const { error } = await supabaseAdmin
        .from("group_contacts")
        .update({
          status: "removed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", contactId)
        .eq("group_id", groupId);

      if (error) throw new Error(error.message);

      res.json({ ok: true });
    } catch (error) {
      console.error("Unable to remove manual team contact", error);
      res.status(error?.statusCode || 500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove the manual team contact.",
      });
    }
  }
);

app.post(
  "/api/group-contacts/:contactId/invite",
  requireAuthenticatedUser,
  async (req, res) => {
    let createdInviteId = null;

    try {
      const contactId = String(req.params.contactId || "").trim();
      const groupId = String(req.body?.groupId || "").trim();

      if (!contactId || !groupId) {
        return res.status(400).json({ error: "Contact and group are required." });
      }

      await requireGroupManager(groupId, req.amrUser.id);

      const { data: contact, error: contactError } = await supabaseAdmin
        .from("group_contacts")
        .select("id, first_name, last_name, email, phone, role, status")
        .eq("id", contactId)
        .eq("group_id", groupId)
        .maybeSingle();

      if (contactError) throw new Error(contactError.message);
      if (!contact) return res.status(404).json({ error: "Manual contact not found." });
      if (!contact.email) {
        return res.status(400).json({
          error: "Add an email address before inviting this cleaner to AMR.",
        });
      }

      const { data: group, error: groupError } = await supabaseAdmin
        .from("groups")
        .select("id, name, status")
        .eq("id", groupId)
        .eq("status", "active")
        .maybeSingle();

      if (groupError) throw new Error(groupError.message);
      if (!group) return res.status(404).json({ error: "Workspace not found." });

      const { data: existingInvite, error: existingInviteError } =
        await supabaseAdmin
          .from("group_invites")
          .select("id")
          .eq("group_id", groupId)
          .eq("email", contact.email.toLowerCase())
          .eq("status", "pending")
          .maybeSingle();

      if (existingInviteError) throw new Error(existingInviteError.message);
      if (existingInvite) {
        return res.status(409).json({
          error: "A pending invitation already exists for this email.",
        });
      }

      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("group_invites")
        .insert({
          group_id: groupId,
          group_contact_id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email.toLowerCase(),
          phone_number: contact.phone,
          invited_role: contact.role || "cleaner",
          invited_by: req.amrUser.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (inviteError) throw new Error(inviteError.message);
      createdInviteId = invite.id;

      const emailResult = await sendGroupInvitationEmail({
        to: contact.email.toLowerCase(),
        groupName: group.name,
        role: contact.role || "cleaner",
      });

      const { error: updateContactError } = await supabaseAdmin
        .from("group_contacts")
        .update({
          status: "invitation_pending",
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id)
        .eq("group_id", groupId);

      if (updateContactError) throw new Error(updateContactError.message);

      res.json({
        ok: true,
        inviteId: invite.id,
        emailId: emailResult.id || null,
      });
    } catch (error) {
      console.error("Unable to invite manual team contact", error);

      if (createdInviteId) {
        await supabaseAdmin
          .from("group_invites")
          .delete()
          .eq("id", createdInviteId);
      }

      res.status(error?.statusCode || 500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to invite the manual team contact.",
      });
    }
  }
);

app.post(
  "/api/group-invites/send",
  requireAuthenticatedUser,
  async (req, res) => {
    let createdInviteId = null;

    try {
      const groupId = String(req.body?.groupId || "").trim();
      const firstName = String(req.body?.firstName || "").trim() || null;
      const lastName = String(req.body?.lastName || "").trim() || null;
      const phoneNumber = String(req.body?.phoneNumber || "").trim() || null;
      const groupContactId = String(req.body?.groupContactId || "").trim() || null;
      const email = String(req.body?.email || "").trim().toLowerCase();
      const role = String(req.body?.role || "cleaner").trim();

      const allowedInviteRoles = new Set([
        "cleaner",
        "team_member",
        "manager",
        "administrator",
        "homeowner",
        "maintenance",
      ]);

      if (!groupId || !email) {
        return res.status(400).json({
          error: "Group and email are required.",
        });
      }

      if (!allowedInviteRoles.has(role)) {
        return res.status(400).json({
          error: "That invitation role is not supported.",
        });
      }

      const { data: membership, error: membershipError } =
        await supabaseAdmin
          .from("group_members")
          .select("id, role, status")
          .eq("group_id", groupId)
          .eq("user_id", req.amrUser.id)
          .eq("status", "active")
          .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (
        !membership ||
        !["owner", "administrator", "manager"].includes(membership.role)
      ) {
        return res.status(403).json({
          error: "You do not have permission to invite members to this group.",
        });
      }

      const { data: group, error: groupError } = await supabaseAdmin
        .from("groups")
        .select("id, name, status")
        .eq("id", groupId)
        .eq("status", "active")
        .maybeSingle();

      if (groupError) throw new Error(groupError.message);

      if (!group) {
        return res.status(404).json({
          error: "The selected AMR group was not found.",
        });
      }

      const { data: existingInvite, error: existingInviteError } =
        await supabaseAdmin
          .from("group_invites")
          .select("id")
          .eq("group_id", groupId)
          .eq("email", email)
          .eq("status", "pending")
          .maybeSingle();

      if (existingInviteError) {
        throw new Error(existingInviteError.message);
      }

      if (existingInvite) {
        return res.status(409).json({
          error: "A pending invitation already exists for this email.",
        });
      }

      const { data: createdInvite, error: inviteError } =
        await supabaseAdmin
          .from("group_invites")
          .insert({
            group_id: groupId,
            group_contact_id: groupContactId,
            first_name: firstName,
            last_name: lastName,
            email,
            phone_number: phoneNumber,
            invited_role: role,
            invited_by: req.amrUser.id,
            status: "pending",
          })
          .select("id")
          .single();

      if (inviteError) throw new Error(inviteError.message);

      createdInviteId = createdInvite.id;

      const emailResult = await sendGroupInvitationEmail({
        to: email,
        groupName: group.name,
        role,
      });

      res.json({
        ok: true,
        inviteId: createdInvite.id,
        emailId: emailResult.id || null,
      });
    } catch (error) {
      console.error("Unable to create group invitation", error);

      if (createdInviteId) {
        const { error: cleanupError } = await supabaseAdmin
          .from("group_invites")
          .delete()
          .eq("id", createdInviteId);

        if (cleanupError) {
          console.error(
            "Unable to clean up failed group invitation",
            cleanupError
          );
        }
      }

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to create and send the invitation.",
      });
    }
  }
);

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


app.post(
  "/api/invoices/:invoiceId/void",
  requireAuthenticatedUser,
  async (req, res) => {
    try {
      const invoiceId = String(req.params.invoiceId || "").trim();

      if (!invoiceId) {
        return res.status(400).json({
          error: "Missing invoice ID.",
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
          error: "A paid invoice cannot be voided.",
        });
      }

      if (invoice.status === "draft") {
        return res.status(409).json({
          error: "Draft invoices should be deleted instead of voided.",
        });
      }

      if (invoice.status === "void") {
        return res.json({
          ok: true,
          alreadyVoid: true,
          invoice,
        });
      }

      if (!["sent", "viewed", "overdue"].includes(invoice.status)) {
        return res.status(409).json({
          error: "Only sent, viewed, or overdue invoices can be voided.",
        });
      }

      if (invoice.stripe_checkout_session_id) {
        try {
          const profile = await getProfileForUser(req.amrUser.id);

          if (profile.stripe_account_id) {
            const checkoutSession = await stripe.checkout.sessions.retrieve(
              invoice.stripe_checkout_session_id,
              {},
              { stripeAccount: profile.stripe_account_id }
            );

            if (checkoutSession.status === "open") {
              await stripe.checkout.sessions.expire(
                invoice.stripe_checkout_session_id,
                {},
                { stripeAccount: profile.stripe_account_id }
              );
            }
          }
        } catch (error) {
          console.warn(
            "Unable to expire Stripe Checkout Session while voiding invoice",
            error
          );
        }
      }

      const now = new Date().toISOString();

      const { data: updatedInvoice, error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "void",
          stripe_payment_link: null,
          updated_at: now,
        })
        .eq("id", invoice.id)
        .eq("cleaner_id", req.amrUser.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: activityError } = await supabaseAdmin
        .from("invoice_activity")
        .insert({
          invoice_id: invoice.id,
          event_type: "invoice_voided",
          event_description: "Invoice voided by cleaner.",
          created_by: req.amrUser.id,
        });

      if (activityError) {
        console.error("Invoice void activity insert failed", activityError);
      }

      res.json({
        ok: true,
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error("Unable to void invoice", error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Unable to void the invoice.",
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

app.post("/api/public/invoices/:publicToken/checkout", async (req, res) => {
  try {
    const publicToken = String(req.params.publicToken || "").trim();

    if (!publicToken) {
      return res.status(400).json({
        error: "Missing invoice token.",
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("public_token", publicToken)
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
      return res.status(410).json({
        error: "This invoice is no longer available.",
      });
    }

    const profile = await getProfileForUser(invoice.cleaner_id);

    if (!profile.stripe_account_id) {
      return res.status(400).json({
        error: "The cleaner has not connected a Stripe account.",
      });
    }

    const account = await stripe.accounts.retrieve(
      profile.stripe_account_id
    );

    if (!account.charges_enabled || !account.payouts_enabled) {
      return res.status(400).json({
        error:
          "Secure payment is temporarily unavailable while the cleaner's Stripe account is being reviewed.",
      });
    }

    if (
      invoice.stripe_payment_link &&
      invoice.stripe_checkout_session_id &&
      invoice.status !== "draft"
    ) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          invoice.stripe_checkout_session_id,
          {},
          {
            stripeAccount: profile.stripe_account_id,
          }
        );

        if (
          existingSession.status === "open" &&
          existingSession.payment_status === "unpaid" &&
          existingSession.url
        ) {
          return res.json({
            ok: true,
            reused: true,
            url: existingSession.url,
            sessionId: existingSession.id,
          });
        }
      } catch (error) {
        console.warn(
          "Unable to reuse existing Checkout Session; creating a new one.",
          error
        );
      }
    }

    const { data: items, error: itemError } = await supabaseAdmin
      .from("invoice_items")
      .select(
        "id, description, quantity, unit_price_cents, line_total_cents, sort_order"
      )
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      throw new Error(itemError.message);
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        error: "This invoice has no billable items.",
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
        unit_amount: Math.round(Number(item.unit_price_cents || 0)),
      },
      quantity: Number(item.quantity || 1),
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
        success_url: `${CLIENT_URL}/pay/${encodeURIComponent(
          invoice.public_token
        )}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/pay/${encodeURIComponent(
          invoice.public_token
        )}?payment=cancelled`,
        metadata: {
          amr_invoice_id: invoice.id,
          amr_cleaner_id: invoice.cleaner_id,
          invoice_number: invoice.invoice_number,
          public_token: invoice.public_token,
        },
        payment_intent_data: {
          metadata: {
            amr_invoice_id: invoice.id,
            amr_cleaner_id: invoice.cleaner_id,
            invoice_number: invoice.invoice_number,
          },
        },
      },
      {
        stripeAccount: profile.stripe_account_id,
        idempotencyKey: `amr-public-invoice-${invoice.id}-${Date.now()}`,
      }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a payment URL.");
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        status: invoice.status === "draft" ? "sent" : invoice.status,
        subtotal_cents: calculatedSubtotal,
        total_cents: calculatedTotal,
        stripe_checkout_session_id: session.id,
        stripe_payment_link: session.url,
        sent_at: invoice.sent_at || now,
        updated_at: now,
      })
      .eq("id", invoice.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    res.json({
      ok: true,
      reused: false,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Unable to create public invoice checkout session", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to start secure payment.",
    });
  }
});

app.get("/api/public/invoices/:publicToken/verify-payment", async (req, res) => {
  try {
    const publicToken = String(req.params.publicToken || "").trim();
    const sessionId = String(req.query.session_id || "").trim();

    if (!publicToken) {
      return res.status(400).json({
        error: "Missing invoice token.",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "Missing Stripe Checkout Session ID.",
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("public_token", publicToken)
      .maybeSingle();

    if (invoiceError) {
      throw new Error(invoiceError.message);
    }

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found.",
      });
    }

    const profile = await getProfileForUser(invoice.cleaner_id);

    if (!profile.stripe_account_id) {
      return res.status(400).json({
        error: "The cleaner does not have a connected Stripe account.",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      {
        stripeAccount: profile.stripe_account_id,
      }
    );

    const sessionInvoiceId = String(
      session.metadata?.amr_invoice_id || ""
    );

    if (sessionInvoiceId !== String(invoice.id)) {
      return res.status(409).json({
        error: "This payment session does not belong to this invoice.",
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(409).json({
        error: "Stripe has not confirmed this payment as paid.",
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
      });
    }

    const paidAt = new Date(
      Number(session.created || Math.floor(Date.now() / 1000)) * 1000
    ).toISOString();

    const amountPaidCents = Number(
      session.amount_total ?? invoice.total_cents ?? 0
    );

    if (invoice.status !== "paid") {
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_source: "stripe",
          amount_paid_cents: amountPaidCents,
          stripe_checkout_session_id: session.id,
          stripe_payment_link: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: activityError } = await supabaseAdmin
        .from("invoice_activity")
        .insert({
          invoice_id: invoice.id,
          event_type: "invoice_paid",
          event_description: "Invoice paid through Stripe Checkout.",
          created_by: null,
          metadata: {
            stripe_checkout_session_id: session.id,
            payment_status: session.payment_status,
            amount_total: amountPaidCents,
          },
        });

      if (activityError) {
        console.error("Invoice paid activity insert failed", activityError);
      }
    }

    res.json({
      ok: true,
      paid: true,
      status: "paid",
      paidAt,
      amountPaidCents,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Unable to verify public invoice payment", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify this payment.",
    });
  }
});

app.get("/api/public/invoices/:publicToken", async (req, res) => {
  try {
    const publicToken = String(req.params.publicToken || "").trim();

    if (!publicToken) {
      return res.status(400).json({
        error: "Missing invoice token.",
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select(
        [
          "id",
          "cleaner_id",
          "invoice_number",
          "status",
          "customer_name",
          "property_name",
          "subtotal_cents",
          "tax_cents",
          "total_cents",
          "currency",
          "issue_date",
          "due_date",
          "paid_at",
          "notes",
          "payment_terms",
          "public_token",
        ].join(",")
      )
      .eq("public_token", publicToken)
      .maybeSingle();

    if (invoiceError) {
      throw new Error(invoiceError.message);
    }

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found.",
      });
    }

    if (invoice.status === "void") {
      return res.status(410).json({
        error: "This invoice is no longer available.",
      });
    }

    const { data: items, error: itemError } = await supabaseAdmin
      .from("invoice_items")
      .select(
        "id, description, quantity, unit_price_cents, line_total_cents, sort_order"
      )
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      throw new Error(itemError.message);
    }

    const { data: cleanerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "business_name, contact_name, business_email, phone, address_line_1, address_line_2, city, state"
      )
      .eq("id", invoice.cleaner_id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    res.json({
      invoice: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        customerName: invoice.customer_name,
        propertyName: invoice.property_name,
        subtotalCents: invoice.subtotal_cents,
        taxCents: invoice.tax_cents,
        totalCents: invoice.total_cents,
        currency: invoice.currency || "usd",
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        notes: invoice.notes,
        paymentTerms: invoice.payment_terms,
      },
      items: items ?? [],
      cleaner: {
        businessName: cleanerProfile?.business_name || "AMR Cleaning Professional",
        contactName: cleanerProfile?.contact_name || null,
        businessEmail: cleanerProfile?.business_email || null,
        phone: cleanerProfile?.phone || null,
        addressLine1: cleanerProfile?.address_line_1 || null,
        addressLine2: cleanerProfile?.address_line_2 || null,
        city: cleanerProfile?.city || null,
        state: cleanerProfile?.state || null,
      },
    });
  } catch (error) {
    console.error("Unable to load public invoice", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load this invoice.",
    });
  }
});
app.listen(PORT, () => {
  console.log(`Ask My Rentals backend server running on http://localhost:${PORT}`);
});
