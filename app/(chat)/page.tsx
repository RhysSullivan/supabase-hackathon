"use client";

import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";

export default function Page() {
  const id = generateUUID();
  return <Chat key={id} id={id} initialMessages={[]} />;
}
