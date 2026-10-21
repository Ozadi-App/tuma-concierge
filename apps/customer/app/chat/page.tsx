"use client";

import { ChatLauncher } from "../../components/chat/ChatLauncher";

/** A direct link to the chat list opens it in the chat drawer. */
export default function ChatListPage() {
  return <ChatLauncher layer={{ type: "list" }} underlay="/" />;
}
