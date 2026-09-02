import { z } from "zod";

export const coasterStatusSchema = z.enum([
  "OPERATING",
  "UNDER_CONSTRUCTION",
  "TEMPORARILY_CLOSED",
  "CLOSED",
  "REMOVED",
  "UNKNOWN",
]);
export type CoasterStatus = z.infer<typeof coasterStatusSchema>;

export const parkStatusSchema = z.enum([
  "OPERATING",
  "TEMPORARILY_CLOSED",
  "CLOSED",
  "UNKNOWN",
]);
export type ParkStatus = z.infer<typeof parkStatusSchema>;

/** Maps canonical coaster status to CoasterTrak legacy lifecycle labels. */
export function toCoasterTrakCoasterStatus(status: CoasterStatus): string {
  switch (status) {
    case "OPERATING":
    case "TEMPORARILY_CLOSED":
      return "Operating";
    case "CLOSED":
    case "REMOVED":
      return "Defunct";
    case "UNDER_CONSTRUCTION":
    case "UNKNOWN":
    default:
      return "Unknown";
  }
}

/** Maps canonical park status to CoasterTrak legacy lifecycle labels. */
export function toCoasterTrakParkStatus(status: ParkStatus): string {
  switch (status) {
    case "OPERATING":
    case "TEMPORARILY_CLOSED":
      return "Operating";
    case "CLOSED":
      return "Defunct";
    case "UNKNOWN":
    default:
      return "Unknown";
  }
}
