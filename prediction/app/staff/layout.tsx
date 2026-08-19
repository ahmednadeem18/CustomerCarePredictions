import {
  getCurrentUser,
} from "@/lib/auth";

import {
  redirect,
} from "next/navigation";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user =
    await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (
    user.role !== "staff"
  ) {
    redirect("/director");
  }

  return children;
}