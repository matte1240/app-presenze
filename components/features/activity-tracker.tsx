"use client";

import { useActivityTracker } from "@/hooks/use-activity-tracker";

export default function ActivityTracker() {
  useActivityTracker();
  return null;
}
