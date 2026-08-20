"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCog, Users as UsersIcon } from "lucide-react";
import type { User } from "@/types/models";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableWrapper,
} from "@/components/ui/table";

type UserAggregate = User & {
  regularHours: number;
  overtimeHours: number;
  permessoHours: number;
  sicknessHours: number;
  vacationHours: number;
};

type AdminOverviewProps = {
  users: UserAggregate[];
  /** Month the figures refer to, already formatted for display. */
  periodLabel: string;
};

/** Zero reads as absence of data, so it steps back instead of competing. */
function Hours({ value, emphasis }: { value: number; emphasis?: boolean }) {
  if (value === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return (
    <span className={emphasis ? "font-medium text-foreground" : "text-foreground"}>
      {value.toFixed(1)}
      <span className="ml-0.5 text-xs text-muted-foreground">h</span>
    </span>
  );
}

export default function AdminOverview({ users, periodLabel }: AdminOverviewProps) {
  const router = useRouter();

  return (
    <TableWrapper>
      <TableToolbar
        title="Utenti e ore lavorate"
        description={periodLabel}
        actions={
          <Link
            href="/dashboard/users"
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            <UserCog />
            Gestisci utenti
          </Link>
        }
      />

      {users.length === 0 ? (
        <EmptyState
          compact
          icon={<UsersIcon />}
          title="Nessun utente"
          description="Aggiungi il primo membro del team per iniziare a raccogliere le ore."
          action={
            <Button size="sm" onClick={() => router.push("/dashboard/users")}>
              Aggiungi utente
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead className="hidden md:table-cell">Ruolo</TableHead>
              <TableHead numeric>Totali</TableHead>
              <TableHead numeric>Straordinario</TableHead>
              <TableHead numeric>Perm/Ferie</TableHead>
              <TableHead numeric>Malattia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const total = user.regularHours + user.overtimeHours;
              const label = user.name || user.email;

              return (
                <TableRow
                  key={user.id}
                  interactive
                  onClick={() => router.push(`/dashboard/calendar?userId=${user.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {label.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {user.name || "Senza nome"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={user.role === "ADMIN" ? "primary" : "neutral"}>
                      {user.role === "ADMIN" ? "Amministratore" : "Dipendente"}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>
                    <Hours value={total} emphasis />
                  </TableCell>
                  <TableCell numeric>
                    <Hours value={user.overtimeHours} />
                  </TableCell>
                  <TableCell numeric>
                    <Hours value={user.permessoHours + user.vacationHours} />
                  </TableCell>
                  <TableCell numeric>
                    <Hours value={user.sicknessHours} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </TableWrapper>
  );
}
