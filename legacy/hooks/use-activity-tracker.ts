"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Hook to track user activity and auto-logout after 30 minutes of inactivity
 */
export function useActivityTracker() {
  const { update, status } = useSession();
  const router = useRouter();
  // Use a lazy initializer or just a constant if it doesn't need to be the exact mount time
  // But Date.now() is impure. We can use useEffect to set the initial time.
  const lastActivityRef = useRef<number>(0);
  
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Redirect to login if session becomes invalid (e.g. password change or server-side expiration)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const THIRTY_MINUTES = 30 * 60 * 1000; // 30 minutes in milliseconds
    const UPDATE_INTERVAL = 5 * 60 * 1000; // Update session every 5 minutes if active
    const CHECK_INTERVAL = 60 * 1000; // Check for inactivity every minute

    // Track user activity events
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Events that indicate user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Periodically update the session if user is active
    updateIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      // If user has been active in the last 5 minutes, update the session
      if (timeSinceActivity < UPDATE_INTERVAL) {
        update(); // This triggers JWT callback with trigger: "update"
      }
    }, UPDATE_INTERVAL);

    // Check for inactivity and force logout if needed
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      // If user has been inactive for 30 minutes, force logout
      if (timeSinceActivity >= THIRTY_MINUTES) {
        // Clear intervals
        if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);

        // Show alert and redirect to login
        alert("Your session has expired due to inactivity. Please log in again.");
        router.push("/?expired=true");
      }
    }, CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [status, update, router]);
}
