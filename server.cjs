const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

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
