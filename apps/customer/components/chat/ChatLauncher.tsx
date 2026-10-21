"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { openChatAfterNavigation, type ChatLayer } from "../../lib/chat-drawer";

/** The page behind a direct link to a chat: it sends the customer to `underlay` and has the chat drawer open over it. */
export function ChatLauncher({ layer, underlay }: { layer: ChatLayer; underlay: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    openChatAfterNavigation(layer, pathname);
    router.replace(underlay);
    // Runs once per visit to the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
