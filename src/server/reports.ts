import { REPORT_REASONS } from "@/lib/constants";

export function isValidReportReason(input: string): input is (typeof REPORT_REASONS)[number] {
  return (REPORT_REASONS as readonly string[]).includes(input);
}

export function canCreateReport(recentReportCount: number, limit = 5) {
  return recentReportCount < limit;
}
