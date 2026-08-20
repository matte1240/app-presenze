import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/api-middleware";
import prisma from "@/lib/prisma";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const LOG_FILE = path.join(process.cwd(), "logs", "audit.log");

export async function GET(req: NextRequest) {
  try {
    // Auth + admin role enforced by proxy.ts
    await getRequiredSession();

    const { searchParams } = new URL(req.url);
    const download = searchParams.get("download");

    // Download raw log file
    if (download === "1") {
      if (!existsSync(LOG_FILE)) {
        return NextResponse.json({ error: "No log file found" }, { status: 404 });
      }
      const content = await readFile(LOG_FILE, "utf-8");
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.log"`,
        },
      });
    }

    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ logs: [], total: 0 });
    }

    const content = await readFile(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Parse all lines (newest first)
    let entries: Record<string, unknown>[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        entries.push(JSON.parse(lines[i]));
      } catch {
        // skip malformed lines
      }
    }

    // Filter by category if specified
    if (category) {
      entries = entries.filter((e) => e.category === category);
    }

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    // Resolve user IDs to names (both top-level userId and targetUserId/newUserId in details)
    const userIds = new Set<string>();
    for (const e of paginated) {
      if (e.userId) userIds.add(e.userId as string);
      const details = e.details as Record<string, unknown> | undefined;
      if (details?.targetUserId) userIds.add(details.targetUserId as string);
      if (details?.newUserId) userIds.add(details.newUserId as string);
    }

    const userMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true },
      });
      for (const u of users) {
        userMap[u.id] = u.name ?? u.id;
      }
    }

    const enriched = paginated.map((e) => {
      const details = e.details as Record<string, unknown> | undefined;
      const enrichedDetails = details ? { ...details } : undefined;
      if (enrichedDetails?.targetUserId) {
        enrichedDetails.targetUserName = userMap[enrichedDetails.targetUserId as string] ?? null;
      }
      if (enrichedDetails?.newUserId) {
        enrichedDetails.newUserName = userMap[enrichedDetails.newUserId as string] ?? null;
      }
      return {
        ...e,
        userName: e.userId ? (userMap[e.userId as string] ?? null) : null,
        details: enrichedDetails,
      };
    });

    return NextResponse.json({ logs: enriched, total });
  } catch (error) {
    console.error("Error reading audit logs:", error);
    return NextResponse.json(
      { error: "Failed to read audit logs" },
      { status: 500 }
    );
  }
}
