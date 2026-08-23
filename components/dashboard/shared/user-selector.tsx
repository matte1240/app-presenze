"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { Select } from "@/components/ui/input";

type User = {
  id: string;
  name: string | null;
  email: string;
};

type UserSelectorProps = {
  users: User[];
  selectedUserId: string;
};

export default function UserSelector({ users, selectedUserId }: UserSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleUserChange = (userId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (userId) {
      params.set("userId", userId);
    } else {
      params.delete("userId");
    }
    router.push(`?${params.toString()}`);
  };

  // A bare control on the page, not a card of its own: it is a filter over the
  // calendar below, and wrapping it in a panel gave it the same visual weight
  // as the data it filters.
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="user-select"
        className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground"
      >
        <Users className="size-4" />
        Calendario di
      </label>
      <Select
        id="user-select"
        value={selectedUserId}
        onChange={(e) => handleUserChange(e.target.value)}
        className="w-auto min-w-52 font-medium"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email}
          </option>
        ))}
      </Select>
    </div>
  );
}