const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8787;

const DATA_DIR = path.join(__dirname, "data");
const APP_DATA_FILE = path.join(DATA_DIR, "app-data.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(APP_DATA_FILE)) {
    fs.writeFileSync(
      APP_DATA_FILE,
      JSON.stringify(
        {
          properties: [],
          cleaners: [],
          reservations: [],
          turnovers: [],
          notifications: [],
          messages: [],
          records: [],
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
}

function readData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(APP_DATA_FILE, "utf8");

    if (!raw || raw.trim() === "") {
      return {
        properties: [],
        cleaners: [],
        reservations: [],
        turnovers: [],
        notifications: [],
        messages: [],
        records: [],
        updatedAt: new Date().toISOString(),
      };
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read app-data.json:", error);

    return {
      properties: [],
      cleaners: [],
      reservations: [],
      turnovers: [],
      notifications: [],
      messages: [],
      records: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

function writeData(data) {
  ensureDataFile();

  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(APP_DATA_FILE, JSON.stringify(payload, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });

  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function daysUntil(dateValue) {
  if (!dateValue) return null;

  const now = new Date();
  const target = new Date(dateValue);

  if (Number.isNaN(target.getTime())) return null;

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  return Math.ceil(
    (startOfTarget - startOfToday) / (1000 * 60 * 60 * 24)
  );
}

function calculateUrgency(turnover) {
  const reasons = [];

  const checkoutDate =
    turnover.checkoutDate ||
    turnover.checkOutDate ||
    turnover.endDate ||
    turnover.date ||
    turnover.cleaningDate;

  const cleanerId =
    turnover.cleanerId ||
    turnover.assignedCleanerId ||
    turnover.assignedTo ||
    null;

  const status = String(turnover.status || "").toLowerCase();

  const cleanerStatus = String(
    turnover.cleanerStatus ||
      turnover.assignmentStatus ||
      turnover.acceptanceStatus ||
      ""
  ).toLowerCase();

  const days = daysUntil(checkoutDate);

  if (days !== null && days < 0 && status !== "completed") {
    reasons.push("Turnover is overdue");
  }

  if (days !== null && days <= 1 && status !== "completed") {
    reasons.push("Turnover is due today or tomorrow");
  }

  if (!cleanerId && status !== "completed") {
    reasons.push("No cleaner assigned");
  }

  if (
    cleanerStatus === "declined" ||
    status === "declined" ||
    status === "rejected"
  ) {
    reasons.push("Cleaner declined assignment");
  }

  if (
    cleanerId &&
    status !== "completed" &&
    !["accepted", "confirmed", "completed"].includes(cleanerStatus)
  ) {
    reasons.push("Cleaner has not accepted yet");
  }

  if (
    turnover.requiresChecklist &&
    !turnover.checklistCompleted &&
    status !== "completed"
  ) {
    reasons.push("Checklist is missing");
  }

  let urgencyLevel = "normal";

  if (
    reasons.includes("Turnover is overdue") ||
    reasons.includes("Turnover is due today or tomorrow") ||
    reasons.includes("No cleaner assigned") ||
    reasons.includes("Cleaner declined assignment")
  ) {
    urgencyLevel = "urgent";
  } else if (reasons.length > 0) {
    urgencyLevel = "attention";
  }

  return {
    urgencyLevel,
    urgencyReasons: reasons,
    lastUrgencyCheck: new Date().toISOString(),
  };
}

function applyUrgencyToData(data) {
  const turnovers = Array.isArray(data.turnovers)
    ? data.turnovers
    : [];

  const updatedTurnovers = turnovers.map((turnover) => ({
    ...turnover,
    ...calculateUrgency(turnover),
  }));

  return {
    ...data,
    turnovers: updatedTurnovers,
  };
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // HEALTH CHECK
    if (requestUrl.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        status: "running",
        timestamp: new Date().toISOString(),
      });
    }

    // ICAL SYNC
    if (requestUrl.pathname === "/api/sync-ical") {
      if (req.method !== "GET") {
        return sendJson(res, 405, {
          error: "Method not allowed",
        });
      }

      const calendarUrl =
        requestUrl.searchParams.get("url");

      if (!calendarUrl) {
        return sendJson(res, 400, {
          error: "Missing iCal URL",
        });
      }

      if (
        !calendarUrl.startsWith("http://") &&
        !calendarUrl.startsWith("https://")
      ) {
        return sendJson(res, 400, {
          error: "Invalid iCal URL",
        });
      }

      const response = await fetch(calendarUrl, {
        headers: {
          "User-Agent": "Cleaner-App-iCal-Sync/1.0",
          Accept: "text/calendar,text/plain,*/*",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Calendar fetch failed: ${response.status}`
        );
      }

      const calendarText = await response.text();

      res.writeHead(200, {
        "Content-Type":
          "text/calendar; charset=utf-8",
      });

      res.end(calendarText);
      return;
    }

    // APP DATA
    if (requestUrl.pathname === "/api/app-data") {
      if (req.method === "GET") {
        const data = applyUrgencyToData(readData());

        writeData(data);

        return sendJson(res, 200, data);
      }

      if (req.method === "POST") {
        const incomingData = await readBody(req);

        const dataWithUrgency =
          applyUrgencyToData(incomingData);

        writeData(dataWithUrgency);

        return sendJson(res, 200, {
          ok: true,
          data: dataWithUrgency,
        });
      }

      return sendJson(res, 405, {
        error: "Method not allowed",
      });
    }

    // URGENCY CHECK
    if (requestUrl.pathname === "/api/urgency-check") {
      if (
        req.method !== "POST" &&
        req.method !== "GET"
      ) {
        return sendJson(res, 405, {
          error: "Method not allowed",
        });
      }

      const data = applyUrgencyToData(readData());

      writeData(data);

      return sendJson(res, 200, {
        ok: true,
        turnovers: data.turnovers,
      });
    }

    // NOT FOUND
    sendJson(res, 404, {
      error: "Route not found",
      path: requestUrl.pathname,
    });
  } catch (error) {
    console.error("SERVER ERROR:", error);

    sendJson(res, 500, {
      error: "Server error",
      detail: error.message,
    });
  }
});

server.listen(PORT, () => {
  ensureDataFile();

  console.log("");
  console.log("==================================");
  console.log(`Backend running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log("==================================");
  console.log("");
});