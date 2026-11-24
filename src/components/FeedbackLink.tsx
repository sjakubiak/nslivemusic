"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Link to /feedback that remembers which page the visitor was on. */
export default function FeedbackLink({ children = "Feedback" }: { children?: React.ReactNode }) {
  const path = usePathname();
  const href = path && path !== "/" && !path.startsWith("/feedback") ? `/feedback?from=${encodeURIComponent(path)}` : "/feedback";
  return <Link href={href}>{children}</Link>;
}
