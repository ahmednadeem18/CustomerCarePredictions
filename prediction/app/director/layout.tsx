import {
  getCurrentUser,
} from "@/lib/auth";

import {
  redirect,
} from "next/navigation";

export default async function DirectorLayout({
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
    user.role !== "director"
  ) {
    redirect("/staff");
  }

  return children;
}