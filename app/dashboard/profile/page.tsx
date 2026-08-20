import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import EmployeeProfile from "@/components/dashboard/employee/profile";

export default async function ProfilePage() {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  return (
    <EmployeeProfile
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
      }}
    />
  );
}
