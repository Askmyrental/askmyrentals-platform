// src/utils/calendarMerge.ts

export type ReservationLike = {
  id?: string;
  property_id?: string;
  homeId?: string;
  home_id?: string;
  propertyId?: string;
  arrival: string;
  departure: string;
  source: string;
  guest_name?: string;
  guestName?: string;
  status?: string;
  type?: string;
  title?: string;
  label?: string;
  notes?: string;
  protectedOn?: string[];
  protectionRecords?: ReservationLike[];
  [key: string]: any;
};

function toDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = toDate(dateKey);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

function getNightKeys(arrival: string, departure: string): string[] {
  const nights: string[] = [];
  const current = toDate(arrival);
  const checkout = toDate(departure);

  while (current < checkout) {
    nights.push(toInputDate(current));
    current.setDate(current.getDate() + 1);
  }

  return nights;
}

function getPlatform(item: ReservationLike) {
  const sourceText = String(item.source || item.type || "").toLowerCase();
  const titleText = String(
    item.guestName ||
      item.guest_name ||
      item.title ||
      item.label ||
      item.notes ||
      ""
  ).toLowerCase();

  if (sourceText.includes("airbnb") || titleText.includes("airbnb")) return "Airbnb";
  if (sourceText.includes("vrbo") || titleText.includes("vrbo")) return "VRBO";
  return "";
}

function getHomeKey(item: ReservationLike) {
  return String(
    item.homeId ||
      item.property_id ||
      item.home_id ||
      item.propertyId ||
      ""
  );
}

function setDisplayName<T extends ReservationLike>(item: T, value: string): T {
  return {
    ...item,
    guestName: item.guestName !== undefined ? value : item.guestName,
    guest_name: item.guest_name !== undefined ? value : item.guest_name,
    title: item.title !== undefined ? value : item.title,
    label: item.label !== undefined ? value : item.label,
  };
}

function isPlatformBlock(item: ReservationLike) {
  const text = [
    item.guestName,
    item.guest_name,
    item.title,
    item.label,
    item.type,
    item.source,
    item.status,
    item.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("block") ||
    text.includes("blocked") ||
    text.includes("not available") ||
    text.includes("unavailable")
  );
}

function isPrimaryOperationalItem(item: ReservationLike) {
  const platform = getPlatform(item);
  if (!platform) return false;
  return !isPlatformBlock(item);
}

function addProtectedOn<T extends ReservationLike>(item: T, platform: string, block: ReservationLike): T {
  const currentProtectedOn = Array.isArray(item.protectedOn) ? item.protectedOn : [];
  const currentProtectionRecords = Array.isArray(item.protectionRecords)
    ? item.protectionRecords
    : [];

  return {
    ...item,
    protectedOn: currentProtectedOn.includes(platform)
      ? currentProtectedOn
      : [...currentProtectedOn, platform],
    protectionRecords: [...currentProtectionRecords, block],
    isUnifiedPlatformStay: true,
  };
}

function buildCoveredNightSet(
  block: ReservationLike,
  primaryItems: ReservationLike[]
) {
  const blockPlatform = getPlatform(block);
  const homeKey = getHomeKey(block);
  const coveredNights = new Set<string>();

  primaryItems.forEach((item) => {
    if (getHomeKey(item) !== homeKey) return;
    if (getPlatform(item) === blockPlatform) return;

    getNightKeys(item.arrival, item.departure).forEach((night) => {
      coveredNights.add(night);
    });
  });

  return coveredNights;
}

function areBlockNightsCoveredByPrimaryItems(
  block: ReservationLike,
  primaryItems: ReservationLike[]
) {
  const blockPlatform = getPlatform(block);
  const homeKey = getHomeKey(block);

  if (!blockPlatform || !homeKey) return false;

  const blockNights = getNightKeys(block.arrival, block.departure);
  if (blockNights.length === 0) return false;

  const coveredNights = buildCoveredNightSet(block, primaryItems);

  if (blockNights.every((night) => coveredNights.has(night))) return true;

  // Airbnb/VRBO can export one continuous protection block for several
  // back-to-back reservations and can include one trailing checkout edge day.
  const withoutTrailingNight = blockNights.slice(0, -1);
  if (
    withoutTrailingNight.length > 0 &&
    withoutTrailingNight.every((night) => coveredNights.has(night))
  ) {
    return true;
  }

  // Occasionally the source block starts one night before the operational chain.
  const withoutLeadingNight = blockNights.slice(1);
  if (
    withoutLeadingNight.length > 0 &&
    withoutLeadingNight.every((night) => coveredNights.has(night))
  ) {
    return true;
  }

  // Handles both one leading and one trailing platform edge day.
  const withoutEdges = blockNights.slice(1, -1);
  return (
    withoutEdges.length > 0 &&
    withoutEdges.every((night) => coveredNights.has(night))
  );
}

function blockOverlapsPrimaryItem(block: ReservationLike, item: ReservationLike) {
  return block.arrival < item.departure && block.departure > item.arrival;
}

function areMatchingOwnerBlocks(first: ReservationLike, second: ReservationLike) {
  if (!isPlatformBlock(first) || !isPlatformBlock(second)) return false;
  if (getHomeKey(first) !== getHomeKey(second)) return false;

  const firstPlatform = getPlatform(first);
  const secondPlatform = getPlatform(second);

  if (!firstPlatform || !secondPlatform) return false;
  if (firstPlatform === secondPlatform) return false;

  if (first.arrival !== second.arrival) return false;

  return (
    first.departure === second.departure ||
    first.departure === addDays(second.departure, 1) ||
    second.departure === addDays(first.departure, 1)
  );
}

function mergeOwnerBlocks<T extends ReservationLike>(first: T, second: ReservationLike): T {
  const merged = {
    ...first,
    source: "Owner Block",
    type: "Owner Block",
    status: "Blocked",
    guestName: "Owner Block",
    guest_name: "Owner Block",
    title: "Owner Block",
    label: "Owner Block",
    arrival: first.arrival < second.arrival ? first.arrival : second.arrival,
departure: first.departure < second.departure ? first.departure : second.departure,
    protectedOn: [getPlatform(first), getPlatform(second)].filter(Boolean),
    protectionRecords: [first, second],
    isUnifiedOwnerBlock: true,
  } as T;

  return setDisplayName(merged, "Owner Block");
}

export function mergeProtectionReservations<T extends ReservationLike>(
  reservations: T[]
): T[] {
  const primaryItems = reservations.filter(isPrimaryOperationalItem);
  const blockItems = reservations.filter(isPlatformBlock);

  const hiddenBlockIds = new Set<string>();
  const getItemKey = (item: ReservationLike, index: number) =>
    String(
      item.id ||
        item.ical_uid ||
        `${getHomeKey(item)}-${item.source}-${item.arrival}-${item.departure}-${index}`
    );

  blockItems.forEach((block, blockIndex) => {
    if (!areBlockNightsCoveredByPrimaryItems(block, primaryItems)) return;
    hiddenBlockIds.add(getItemKey(block, blockIndex));
  });

  const annotated = reservations.map((item) => ({ ...item })) as T[];

  blockItems.forEach((block, blockIndex) => {
    const blockKey = getItemKey(block, blockIndex);
    if (!hiddenBlockIds.has(blockKey)) return;

    const protectionPlatform = getPlatform(block);

    annotated.forEach((candidate, candidateIndex) => {
      if (!isPrimaryOperationalItem(candidate)) return;
      if (getHomeKey(candidate) !== getHomeKey(block)) return;
      if (getPlatform(candidate) === protectionPlatform) return;
      if (!blockOverlapsPrimaryItem(block, candidate)) return;

      annotated[candidateIndex] = addProtectedOn(
        candidate,
        protectionPlatform,
        block
      );
    });
  });

  const ownerBlockMergeHiddenIds = new Set<string>();
  const finalItems: T[] = [];

  annotated.forEach((item, index) => {
    const itemKey = getItemKey(item, index);

    if (hiddenBlockIds.has(itemKey)) return;
    if (ownerBlockMergeHiddenIds.has(itemKey)) return;

    if (isPlatformBlock(item)) {
      const matchIndex = annotated.findIndex((candidate, candidateIndex) => {
        if (candidateIndex <= index) return false;

        const candidateKey = getItemKey(candidate, candidateIndex);

        if (hiddenBlockIds.has(candidateKey)) return false;
        if (ownerBlockMergeHiddenIds.has(candidateKey)) return false;

        return areMatchingOwnerBlocks(item, candidate);
      });

      if (matchIndex >= 0) {
        const match = annotated[matchIndex];
        ownerBlockMergeHiddenIds.add(getItemKey(match, matchIndex));
        finalItems.push(mergeOwnerBlocks(item, match));
        return;
      }
    }

    finalItems.push(item);
  });

  return finalItems;
}
