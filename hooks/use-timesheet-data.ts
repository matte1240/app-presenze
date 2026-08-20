"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useCallback,
} from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { useRouter } from "next/navigation";
import type { TimeEntryDTO, LeaveRequestDTO, WorkingScheduleDTO } from "@/types/models";
import { calculateHours } from "@/lib/utils/time-utils";
import { isDateEditable as isDateEditableUtil } from "@/lib/utils/date-utils";
import { isHoliday, getHolidayName } from "@/lib/utils/holiday-utils";
import {
  getBaseHoursFromScheduleMap,
  getMorningHoursFromScheduleMap,
  getAfternoonHoursFromScheduleMap,
} from "@/lib/utils/schedule-utils";

export type ModalFormState = {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  notes: string;
  dayType: "normal" | "ferie" | "malattia" | "paternity";
  medicalCertificate: string;
  isMorningPermesso: boolean;
  isAfternoonPermesso: boolean;
  isPermesso104: boolean;
  permesso104Override: number | null;
};

export const INITIAL_MODAL_FORM: ModalFormState = {
  morningStart: "08:00",
  morningEnd: "12:00",
  afternoonStart: "14:00",
  afternoonEnd: "18:00",
  notes: "",
  dayType: "normal",
  medicalCertificate: "",
  isMorningPermesso: false,
  isAfternoonPermesso: false,
  isPermesso104: false,
  permesso104Override: null,
};

type UseTimesheetDataOptions = {
  initialEntries: TimeEntryDTO[];
  targetUserId?: string;
  isAdmin?: boolean;
  onEntrySaved?: (updatedEntries: TimeEntryDTO[]) => void;
  userFeatures?: { hasPermesso104: boolean; hasPaternityLeave: boolean };
};

/** Helper: calculate overlap between two HH:MM time ranges. */
export function calculateOverlap(start1: string, end1: string, start2: string, end2: string): number {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  const start = Math.max(s1, s2);
  const end = Math.min(e1, e2);
  return start < end ? (end - start) / 60 : 0;
}

export function useTimesheetData({
  initialEntries,
  targetUserId,
  isAdmin = false,
  onEntrySaved,
}: UseTimesheetDataOptions) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<TimeEntryDTO[]>(initialEntries);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const hasFetched = useRef(false);

  // User working schedules
  const [userSchedules, setUserSchedules] = useState<WorkingScheduleDTO[]>([]);
  const [canWorkSunday, setCanWorkSunday] = useState(false);
  const scheduleMap = useMemo(
    () => new Map(userSchedules.map((s) => [s.dayOfWeek, s])),
    [userSchedules]
  );

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [requests, setRequests] = useState<LeaveRequestDTO[]>([]);
  const [modalForm, setModalForm] = useState<ModalFormState>(INITIAL_MODAL_FORM);
  const prevDayTypeRef = useRef<ModalFormState["dayType"]>("normal");

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; date: string; visible: boolean;
  } | null>(null);

  // Month picker
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // ──── Fetching ────

  const fetchEntries = useCallback(async (signal?: AbortSignal) => {
    setIsFetching(true);
    setError(null);
    try {
      const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const to = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const url = targetUserId
        ? `/api/hours?userId=${targetUserId}&from=${from}&to=${to}`
        : `/api/hours?from=${from}&to=${to}`;
      const response = await fetch(url, { signal });
      if (response.status === 401) { router.push("/"); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Failed to load entries.");
      setEntries(payload as TimeEntryDTO[]);
      onEntrySaved?.(payload as TimeEntryDTO[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Error fetching entries:", err);
      setError("Failed to load entries");
    } finally {
      setIsFetching(false);
      setIsRefetching(false);
    }
  }, [currentMonth, targetUserId, router, onEntrySaved]);

  // Refetch entries
  useEffect(() => {
    if (!isRefetching) return;
    const controller = new AbortController();
    fetchEntries(controller.signal);
    return () => controller.abort();
  }, [isRefetching, fetchEntries, onEntrySaved]);

  // Fetch on month change
  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; return; }
    const controller = new AbortController();
    fetchEntries(controller.signal);
    return () => controller.abort();
  }, [fetchEntries, onEntrySaved]);

  // Fetch leave requests
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`/api/requests?${targetUserId ? `userId=${targetUserId}` : ""}`);
        if (res.ok) setRequests(await res.json());
      } catch (err) { console.error("Failed to fetch requests", err); }
    };
    fetchRequests();
  }, [targetUserId, isRefetching]);

  // Fetch user schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const url = targetUserId
          ? `/api/users/${targetUserId}/schedule`
          : `/api/users/me/schedule`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const responseData = data.data || data;
          if (responseData.schedules) {
            setUserSchedules(responseData.schedules);
            setCanWorkSunday(responseData.canWorkSunday ?? false);
          } else if (Array.isArray(responseData)) {
            setUserSchedules(responseData);
          }
        }
      } catch (err) { console.error("Failed to fetch user schedules", err); }
    };
    fetchSchedules();
  }, [targetUserId]);

  // ──── Modal day-type reset ────

  useEffect(() => {
    if (!isModalOpen) return;
    const dayTypeChanged = prevDayTypeRef.current !== modalForm.dayType;
    prevDayTypeRef.current = modalForm.dayType;
    if (!dayTypeChanged) return;

    if (modalForm.dayType === "normal" && selectedDate) {
      const selectedDay = new Date(selectedDate + "T00:00:00");
      const schedule = scheduleMap.get(selectedDay.getDay());
      setModalForm((f) => ({
        ...f,
        morningStart: schedule ? (schedule.morningStart ?? "") : "08:00",
        morningEnd: schedule ? (schedule.morningEnd ?? "") : "12:00",
        afternoonStart: schedule ? (schedule.afternoonStart ?? "") : "14:00",
        afternoonEnd: schedule ? (schedule.afternoonEnd ?? "") : "18:00",
        notes: "",
        isMorningPermesso: false,
        isAfternoonPermesso: false,
        isPermesso104: false,
        permesso104Override: null,
      }));
    } else if (modalForm.dayType === "ferie" || modalForm.dayType === "malattia") {
      setModalForm((f) => ({ ...f, notes: "" }));
    }
  }, [modalForm.dayType, selectedDate, scheduleMap, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) prevDayTypeRef.current = "normal";
  }, [isModalOpen]);

  // Block body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isModalOpen]);

  // ──── Derived data ────

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "PENDING"), [requests]);
  const approvedRequests = useMemo(() => requests.filter((r) => r.status === "APPROVED"), [requests]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntryDTO[]>();
    for (const entry of entries) {
      const bucket = map.get(entry.workDate) ?? [];
      bucket.push(entry);
      map.set(entry.workDate, bucket);
    }
    for (const [, bucket] of map) bucket.sort((a, b) => a.workDate.localeCompare(b.workDate));
    return map;
  }, [entries]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, { isHoliday: boolean; name: string | undefined }>();
    for (const day of calendarDays) {
      const dateKey = format(day, "yyyy-MM-dd");
      const isHol = isHoliday(day);
      map.set(dateKey, { isHoliday: isHol, name: isHol ? getHolidayName(day) : undefined });
    }
    return map;
  }, [calendarDays]);

  // Totals
  const totalHours = useMemo(
    () => entries.reduce((sum, e) => sum + e.hoursWorked + (e.overtimeHours ?? 0), 0), [entries]
  );
  const totalOvertime = useMemo(
    () => entries.reduce((sum, e) => sum + (e.overtimeHours ?? 0), 0), [entries]
  );
  const totalPermFerie = useMemo(
    () => entries.reduce((sum, e) => sum + (e.permessoHours ?? 0) + (e.vacationHours ?? 0), 0), [entries]
  );
  const totalPermesso104 = useMemo(
    () => entries.reduce((sum, e) => sum + (e.permesso104Hours ?? 0), 0), [entries]
  );
  const totalSickness = useMemo(
    () => entries.reduce((sum, e) => sum + (e.sicknessHours ?? 0), 0), [entries]
  );

  // ──── Calculated hours for modal ────

  const calculatedHours = useMemo(() => {
    const dayOfWeekForCalc = selectedDate ? getDay(new Date(`${selectedDate}T12:00:00`)) : 1;
    const baseHoursForDay = getBaseHoursFromScheduleMap(scheduleMap, dayOfWeekForCalc);

    if (modalForm.dayType === "ferie") {
      return { morning: 0, afternoon: 0, totalWorked: 0, regular: 0, overtime: 0, permesso: 0, sickness: 0, vacation: baseHoursForDay || 8, permesso104: 0, paternity: 0 };
    }
    if (modalForm.dayType === "malattia") {
      return { morning: 0, afternoon: 0, totalWorked: 0, regular: 0, overtime: 0, permesso: 0, sickness: baseHoursForDay || 8, vacation: 0, permesso104: 0, paternity: 0 };
    }
    if (modalForm.dayType === "paternity") {
      return { morning: 0, afternoon: 0, totalWorked: 0, regular: 0, overtime: 0, permesso: 0, sickness: 0, vacation: 0, permesso104: 0, paternity: baseHoursForDay || 8 };
    }

    const morningWorked = modalForm.isMorningPermesso ? 0 : calculateHours(modalForm.morningStart, modalForm.morningEnd);
    const afternoonWorked = modalForm.isAfternoonPermesso ? 0 : calculateHours(modalForm.afternoonStart, modalForm.afternoonEnd);
    const totalWorked = morningWorked + afternoonWorked;
    let overlap = 0;

    if (selectedDate) {
      const approvedPermission = approvedRequests.find((req) => {
        if (req.type !== "PERMESSO") return false;
        return format(new Date(req.startDate), "yyyy-MM-dd") === selectedDate;
      });
      if (approvedPermission?.startTime && approvedPermission.endTime) {
        if (!modalForm.isMorningPermesso && modalForm.morningStart && modalForm.morningEnd) {
          overlap += calculateOverlap(modalForm.morningStart, modalForm.morningEnd, approvedPermission.startTime, approvedPermission.endTime);
        }
        if (!modalForm.isAfternoonPermesso && modalForm.afternoonStart && modalForm.afternoonEnd) {
          overlap += calculateOverlap(modalForm.afternoonStart, modalForm.afternoonEnd, approvedPermission.startTime, approvedPermission.endTime);
        }
      }
    }

    const netWork = Math.max(0, totalWorked - overlap);
    let regular = 0, overtime = 0, permesso = 0, permesso104 = 0;

    if (selectedDate && modalForm.dayType === "normal") {
      const dateObj = new Date(`${selectedDate}T12:00:00`);
      const dayOfWeek = getDay(dateObj);
      const isHol = isHoliday(dateObj);
      const isSunday = dayOfWeek === 0;
      const baseHours = getBaseHoursFromScheduleMap(scheduleMap, dayOfWeek);
      const isWorkingDay = baseHours > 0;

      if (isSunday || isHol || !isWorkingDay) {
        overtime = netWork;
      } else {
        if (netWork < baseHours) {
          regular = netWork;
          const missingHours = baseHours - netWork;
          if (modalForm.isPermesso104) {
            const perm104 = modalForm.permesso104Override !== null
              ? Math.min(Math.max(0, modalForm.permesso104Override), missingHours)
              : missingHours;
            permesso104 = perm104;
            permesso = missingHours - perm104;
          } else {
            permesso = missingHours;
          }
        } else {
          regular = baseHours;
          overtime = netWork - baseHours;
        }
      }
    }

    const morningScheduleHours = getMorningHoursFromScheduleMap(scheduleMap, dayOfWeekForCalc);
    const afternoonScheduleHours = getAfternoonHoursFromScheduleMap(scheduleMap, dayOfWeekForCalc);

    return {
      morning: modalForm.isMorningPermesso ? morningScheduleHours : morningWorked,
      afternoon: modalForm.isAfternoonPermesso ? afternoonScheduleHours : afternoonWorked,
      totalWorked: netWork, regular, overtime, permesso, sickness: 0, vacation: 0, permesso104, paternity: 0,
    };
  }, [
    modalForm.morningStart, modalForm.morningEnd, modalForm.afternoonStart, modalForm.afternoonEnd,
    modalForm.isMorningPermesso, modalForm.isAfternoonPermesso, modalForm.dayType,
    modalForm.isPermesso104, modalForm.permesso104Override, selectedDate, approvedRequests, scheduleMap,
  ]);

  const activePerm = useMemo(() => {
    if (!selectedDate) return null;
    return approvedRequests.find(
      (req) => req.type === "PERMESSO" && format(new Date(req.startDate), "yyyy-MM-dd") === selectedDate
    );
  }, [selectedDate, approvedRequests]);

  // ──── Helpers ────

  const isDateEditable = useCallback(
    (date: Date) => isDateEditableUtil(date, isAdmin, canWorkSunday),
    [isAdmin, canWorkSunday]
  );

  return {
    // State
    currentMonth, setCurrentMonth,
    entries, setEntries,
    isFetching, error, setError,
    isSaving, startSaving,

    // Schedules
    userSchedules, canWorkSunday, scheduleMap,

    // Modal
    isModalOpen, setIsModalOpen,
    selectedDate, setSelectedDate,
    modalError, setModalError,
    modalForm, setModalForm,
    calculatedHours, activePerm,

    // Requests
    requests, pendingRequests, approvedRequests,
    isRefetching, setIsRefetching,

    // Calendar
    calendarDays, entriesByDay, holidayMap,
    isMonthPickerOpen, setIsMonthPickerOpen,

    // Context menu
    contextMenu, setContextMenu,

    // Totals
    totalHours, totalOvertime, totalPermFerie, totalPermesso104, totalSickness,

    // Helpers
    isDateEditable,
    router,
    targetUserId,
    isAdmin,
    onEntrySaved,
  };
}
