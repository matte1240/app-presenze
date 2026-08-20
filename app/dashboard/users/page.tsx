import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ManageUsers from "@/components/dashboard/admin/manage-users";
import type { User } from "@/types/models";

export default async function UsersPage() {
  // Auth + admin role enforced by proxy.ts
  const session = (await getAuthSession())!;

  const users = (await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      createdAt: true,
      hasPermesso104: true,
      hasPaternityLeave: true,
    },
  })) as User[];

  return <ManageUsers users={users} currentUserId={session.user.id} />;
}
