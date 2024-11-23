"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWindowSize } from "usehooks-ts";

import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { BetterTooltip } from "@/components/ui/tooltip";
import { PlusIcon, VercelIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";

export function ChatHeader() {
  const router = useRouter();
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2"></header>
  );
}
