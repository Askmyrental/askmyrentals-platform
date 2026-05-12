export type Page =
  | "dashboard"
  | "properties"
  | "calendar"
  | "notifications"
  | "cleaners"
  | "cleanerPortal"
  | "records";

export type ReadyStatus =
  | "Assigned"
  | "Accepted"
  | "On The Way"
  | "Cleaning"
  | "Ready"
  | "Attention Needed";

export interface CleaningItem {
  id: number;
  property: string;
  propertyId?: number;
  cleaner: string;
  departure: string;
  arrival: string;
  guestName?: string;
  type?: string;
  status: ReadyStatus;
  lastUpdate?: string;
  notes?: string;
}export type ActivityRecord = {
  id: number;
  time: string;
  event: string;
  source: "System" | "Homeowner" | "Cleaner" | "Guest";
  createdAt?: string;
};export type AppMessage = {
  id: number;
  cleaningId: number;
  property: string;
  cleaner: string;
  sender: string;
  text: string;
  timestamp: string;
  category?: string;
  time?: string;
};