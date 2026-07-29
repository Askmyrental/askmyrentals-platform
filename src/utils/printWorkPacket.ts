export type WorkPacketOptions = {
  includePropertyNotes: boolean;
  includeDoorCodes: boolean;
  includeWifi: boolean;
};

export type WorkPacketInput = {
  businessName: string;
  startDate: Date;
  endDate: Date;
  tasks: any[];
  homes: any[];
  options: WorkPacketOptions;
  websiteUrl?: string;
};

const normalizeId = (value: unknown) => String(value ?? "");

const WORK_PACKET_DISCLAIMER =
  "Calendar information is imported from third-party platforms and may change. Verify dates with the property owner before relying on this schedule. Airbnb blocks and VRBO owner blocks are treated as cleaning tasks unless marked No Cleaning Needed.";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (date: Date | string) => {
  const value =
    date instanceof Date
      ? date
      : new Date(`${String(date).slice(0, 10)}T12:00:00`);

  return value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getTaskDate = (task: any) =>
  String(
    task.departure ??
      task.scheduledDate ??
      task.scheduled_date ??
      ""
  ).slice(0, 10);

const getTaskTime = (task: any) =>
  task.scheduledTime ?? task.scheduled_time ?? "";

const isAirbnbBlock = (task: any) =>
  String(task.source ?? "").toLowerCase() === "airbnb" &&
  String(task.status ?? "").toLowerCase() === "blocked";

const isVrboOwnerBlock = (task: any) =>
  String(task.source ?? "").toLowerCase() === "owner block";

const getBlockRange = (task: any) => {
  const arrival = String(task.arrival ?? "").slice(0, 10);
  const departure = String(task.departure ?? "").slice(0, 10);

  if (!arrival || !departure) return "";

  return `${formatDate(arrival)} – ${formatDate(departure)}`;
};

const getHome = (task: any, homes: any[]) =>
  homes.find((home) => normalizeId(home.id) === normalizeId(task.homeId));

const getTaskTitle = (task: any, homes: any[]) => {
  if (task.isCleanerJob) {
    return task.customerName ?? task.clientName ?? task.jobType ?? "Manual Job";
  }

  return getHome(task, homes)?.name ?? "Unknown Property";
};

const getTaskType = (task: any) => {
  if (isAirbnbBlock(task)) return "Airbnb Block Turnover";
  if (isVrboOwnerBlock(task)) return "Owner Stay Turnover";

  return task.jobType ?? task.taskType ?? "Vacation Rental Turnover";
};

const getAddress = (task: any, homes: any[]) => {
  if (task.isCleanerJob) {
    return task.serviceAddress ?? task.service_address ?? "";
  }

  const home = getHome(task, homes);

  return (
    home?.address ??
    home?.addressLine1 ??
    home?.address_line_1 ??
    home?.streetAddress ??
    ""
  );
};

const firstValue = (...values: unknown[]) =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  ) ?? "";

const getDoorCode = (home: any) =>
  firstValue(
    home?.doorCode,
    home?.door_code,
    home?.accessCode,
    home?.access_code,
    home?.entryCode,
    home?.entry_code,
    home?.accessNotes,
    home?.access_notes,
    home?.operations?.doorCode,
    home?.operations?.door_code,
    home?.operations?.accessCode,
    home?.operations?.access_code,
    home?.operations?.access
  );

const getWifiName = (home: any) =>
  firstValue(
    home?.wifiName,
    home?.wifi_name,
    home?.wifiNetwork,
    home?.wifi_network,
    home?.ssid,
    home?.operations?.wifiName,
    home?.operations?.wifi_name,
    home?.operations?.wifiNetwork,
    home?.operations?.wifi_network,
    home?.operations?.ssid
  );

const getWifiPassword = (home: any) =>
  firstValue(
    home?.wifiPassword,
    home?.wifi_password,
    home?.wifiPass,
    home?.wifi_pass,
    home?.operations?.wifiPassword,
    home?.operations?.wifi_password,
    home?.operations?.wifiPass,
    home?.operations?.wifi_pass
  );

const getNotes = (task: any, homes: any[]) => {
  if (task.isCleanerJob) {
    return firstValue(task.cleanerNotes, task.cleaner_notes, task.notes);
  }

  const home = getHome(task, homes);

  return firstValue(
    home?.cleanerNotes,
    home?.cleaner_notes,
    home?.notes,
    home?.propertyNotes,
    home?.property_notes,
    home?.specialInstructions,
    home?.special_instructions,
    home?.operations?.notes,
    home?.operations?.cleanerNotes,
    home?.operations?.cleaner_notes,
    home?.operations?.specialInstructions,
    home?.operations?.special_instructions
  );
};

const groupTasksByDate = (tasks: any[]) =>
  tasks.reduce<Record<string, any[]>>((groups, task) => {
    const key = getTaskDate(task);

    if (!key) return groups;

    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {});

export function buildWorkPacketText(input: WorkPacketInput): string {
  const {
    businessName,
    startDate,
    endDate,
    tasks,
    homes,
    options,
    websiteUrl = "https://www.askmyrental.com",
  } = input;

  const lines = [
    businessName.toUpperCase(),
    "CLEANER WORK PACKET",
    `${formatDate(startDate)} – ${formatDate(endDate)}`,
    "",
  ];

  const grouped = groupTasksByDate(tasks);

  Object.entries(grouped).forEach(([dateKey, dayTasks]) => {
    lines.push(formatDate(dateKey).toUpperCase());

    dayTasks.forEach((task) => {
      const home = task.isCleanerJob ? null : getHome(task, homes);
      const time = getTaskTime(task);
      const address = getAddress(task, homes);
      const notes = getNotes(task, homes);

      lines.push(getTaskTitle(task, homes));
      lines.push(getTaskType(task));

      if (isAirbnbBlock(task)) {
        const blockRange = getBlockRange(task);
        if (blockRange) lines.push(`Blocked Range: ${blockRange}`);
        lines.push("Cleaning expected unless marked No Cleaning Needed.");
        lines.push(
          "Airbnb may combine multiple blocked dates into one calendar entry, which could hide a scheduled cleaning task. Confirm with the homeowner that this is the only cleaning needed for this block."
        );
      }

      if (isVrboOwnerBlock(task)) {
        lines.push("Owner stay — cleaning is required unless marked No Cleaning Needed.");
      }

      if (task.isCleanerJob && time) {
        lines.push(`Time: ${time}`);
      }

      if (address) {
        lines.push(`Address: ${address}`);
      }

      if (options.includeDoorCodes && home) {
        const doorCode = getDoorCode(home);
        if (doorCode) lines.push(`Door Code: ${doorCode}`);
      }

      if (options.includeWifi && home) {
        const wifiName = getWifiName(home);
        const wifiPassword = getWifiPassword(home);

        if (wifiName) lines.push(`Wi-Fi: ${wifiName}`);
        if (wifiPassword) lines.push(`Wi-Fi Password: ${wifiPassword}`);
      }

      if (options.includePropertyNotes && notes) {
        lines.push(`${task.isCleanerJob ? "Job" : "Property"} Notes: ${notes}`);
      }

      lines.push("");
    });
  });

  if (tasks.length === 0) {
    lines.push("No tasks match this schedule.", "");
  }

  lines.push(
    "IMPORTANT SCHEDULE NOTICE",
    WORK_PACKET_DISCLAIMER,
    "",
    "Powered by AMR Cleaner — FREE for professional cleaning companies.",
    websiteUrl
  );

  return lines.join("\n");
}

export function printWorkPacket(input: WorkPacketInput): void {
  const {
    businessName,
    startDate,
    endDate,
    tasks,
    homes,
    options,
    websiteUrl = "https://www.askmyrental.com",
  } = input;

  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    window.alert("Please allow pop-ups so AMR can open the printable schedule.");
    return;
  }

  const grouped = groupTasksByDate(tasks);

  const scheduleHtml = Object.entries(grouped)
    .map(
      ([dateKey, dayTasks]) => `
        <section class="day">
          <h2>${escapeHtml(formatDate(dateKey))}</h2>
          ${dayTasks
            .map((task) => {
              const home = task.isCleanerJob ? null : getHome(task, homes);
              const address = getAddress(task, homes);
              const time = getTaskTime(task);
              const notes = getNotes(task, homes);
              const doorCode = home ? getDoorCode(home) : "";
              const wifiName = home ? getWifiName(home) : "";
              const wifiPassword = home ? getWifiPassword(home) : "";
              const airbnbBlock = isAirbnbBlock(task);
              const vrboOwnerBlock = isVrboOwnerBlock(task);
              const blockRange = airbnbBlock ? getBlockRange(task) : "";
              const taskClass = airbnbBlock
                ? "task airbnbBlockTask"
                : vrboOwnerBlock
                  ? "task ownerBlockTask"
                  : "task";
              const kindLabel = task.isCleanerJob
                ? "MANUAL JOB"
                : airbnbBlock
                  ? "AIRBNB BLOCK"
                  : vrboOwnerBlock
                    ? "VRBO OWNER BLOCK"
                    : "PROPERTY";

              return `
                <article class="${taskClass}">
                  <div class="taskHeader">
                    <div>
                      <span class="kind">${kindLabel}</span>
                      <h3>${escapeHtml(getTaskTitle(task, homes))}</h3>
                    </div>
                    ${
                      task.isCleanerJob && time
                        ? `<strong class="time">${escapeHtml(time)}</strong>`
                        : ""
                    }
                  </div>

                  <div class="taskMeta">
                    <span class="taskType">${escapeHtml(getTaskType(task))}</span>
                    ${
                      airbnbBlock && blockRange
                        ? `<span><strong>Blocked Range:</strong> ${escapeHtml(blockRange)}</span>`
                        : ""
                    }
                    ${
                      airbnbBlock
                        ? `<span><strong>Cleaning:</strong> Expected unless marked No Cleaning Needed</span>
                           <span class="airbnbWarning"><strong>Schedule warning:</strong> Airbnb may combine multiple blocked dates into one calendar entry, which could hide a scheduled cleaning task. Confirm with the homeowner that this is the only cleaning needed for this block.</span>`
                        : ""
                    }
                    ${
                      vrboOwnerBlock
                        ? `<span><strong>Owner stay:</strong> Cleaning required unless marked No Cleaning Needed</span>`
                        : ""
                    }
                    ${
                      address
                        ? `<span><strong>Address:</strong> ${escapeHtml(address)}</span>`
                        : ""
                    }
                    ${
                      options.includeDoorCodes && doorCode
                        ? `<span><strong>Door:</strong> ${escapeHtml(doorCode)}</span>`
                        : ""
                    }
                  </div>

                  ${
                    options.includeWifi && (wifiName || wifiPassword)
                      ? `
                        <div class="detailLine">
                          <strong>Wi-Fi:</strong>
                          ${wifiName ? `<span>${escapeHtml(wifiName)}</span>` : ""}
                          ${wifiPassword ? `<span>• ${escapeHtml(wifiPassword)}</span>` : ""}
                        </div>
                      `
                      : ""
                  }

                  ${
                    options.includePropertyNotes && notes
                      ? `
                        <div class="detailLine notesLine">
                          <strong>${task.isCleanerJob ? "Job Notes:" : "Notes:"}</strong>
                          <span>${escapeHtml(notes)}</span>
                        </div>
                      `
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </section>
      `
    )
    .join("");

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    websiteUrl
  )}`;

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(businessName)} Work Packet</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 10px;
            color: #172033;
            background: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 8.5px;
            line-height: 1.16;
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding-bottom: 5px;
            margin-bottom: 6px;
            border-bottom: 2px solid #16844a;
          }
          h1 { margin: 0; font-size: 16px; line-height: 1; }
          .subtitle {
            margin: 1px 0 0;
            color: #334155;
            font-size: 8px;
            font-weight: 700;
          }
          .range { margin: 1px 0 0; color: #64748b; font-size: 7.5px; }
          .prepared {
            color: #64748b;
            font-size: 6px;
            text-align: right;
          }
          .prepared strong {
            display: block;
            color: #16844a;
            font-size: 8.5px;
          }
          .day { margin-bottom: 4px; }
          .day > h2 {
            margin: 0 0 3px;
            padding: 3px 5px;
            border-left: 3px solid #16844a;
            background: #eef8f2;
            font-size: 8.5px;
          }
          .task {
            break-inside: avoid;
            padding: 5px 6px;
            margin-bottom: 3px;
            border: 1px solid #dbe3ee;
            border-radius: 5px;
          }
          .airbnbBlockTask {
            border-color: #cbd5e1;
            background: #f8fafc;
          }
          .airbnbWarning {
            display: block;
            width: 100%;
            margin-top: 2px;
            padding: 3px 5px;
            border-left: 2px solid #f59e0b;
            background: #fffbeb;
            color: #92400e;
            line-height: 1.2;
          }
          .ownerBlockTask {
            border-color: #cbd5e1;
            background: #f8fafc;
          }
          .taskHeader {
            display: flex;
            justify-content: space-between;
            gap: 5px;
          }
          .kind {
            color: #16844a;
            font-size: 6px;
            font-weight: 800;
            letter-spacing: .06em;
          }
          .task h3 { margin: 0; font-size: 9.5px; line-height: 1.05; }
          .taskMeta { display: flex; flex-wrap: wrap; gap: 2px 9px; margin-top: 2px; color: #475569; }
          .taskMeta span { min-width: 0; }
          .taskType { color: #172033; font-weight: 700; }
          .time { font-size: 8px; }

          .detailLine {
            display: flex;
            flex-wrap: wrap;
            gap: 2px 5px;
            margin-top: 2px;
            padding-top: 2px;
            border-top: 1px solid #eef2f7;
            font-size: 7.5px;
          }
          .notesLine span {
            white-space: pre-wrap;
          }
          .empty {
            padding: 12px;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            color: #64748b;
          }
          .scheduleDisclaimer {
            margin-top: 6px;
            padding: 5px 6px;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            background: #f8fafc;
            color: #475569;
            font-size: 6.8px;
            line-height: 1.2;
          }
          .scheduleDisclaimer strong {
            display: block;
            margin-bottom: 2px;
            color: #334155;
            font-size: 7px;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          footer {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
            margin-top: 5px;
            padding-top: 4px;
            border-top: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 6.8px;
            line-height: 1.1;
          }
          footer strong { color: #16844a; }
          footer a { color: #1d4ed8; font-weight: 700; }
          .qr { width: 34px; height: 34px; }
          @page {
            size: Letter portrait;
            margin: 0.24in;
          }
          @media print {
            body {
              padding: 0;
              font-size: 8px;
            }
            a {
              color: inherit;
              text-decoration: none;
            }
            header {
              margin-bottom: 5px;
            }
            .day {
              break-inside: auto;
            }
            .task {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${escapeHtml(businessName)}</h1>
            <p class="subtitle">Cleaner Work Packet</p>
            <p class="range">${escapeHtml(formatDate(startDate))} – ${escapeHtml(
              formatDate(endDate)
            )}</p>
          </div>
          <div class="prepared">
            Prepared with
            <strong>AMR Cleaner</strong>
          </div>
        </header>

        ${
          scheduleHtml ||
          '<div class="empty">No tasks match this schedule.</div>'
        }

        <section class="scheduleDisclaimer">
          <strong>Important Schedule Notice</strong>
          ${escapeHtml(WORK_PACKET_DISCLAIMER)}
        </section>

        <footer>
          <div>
            Powered by <strong>AMR Cleaner</strong> — <strong>FREE</strong>
            scheduling, invoicing, payments, and business tools for professional
            cleaning companies.<br />
            <a href="${escapeHtml(websiteUrl)}">${escapeHtml(websiteUrl)}</a>
          </div>
          <img class="qr" src="${qrUrl}" alt="QR code for AMR Cleaner" />
        </footer>

        <script>
          window.onload = () => setTimeout(() => window.print(), 350);
        <\/script>
      </body>
    </html>
  `);

  reportWindow.document.close();
}