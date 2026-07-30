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