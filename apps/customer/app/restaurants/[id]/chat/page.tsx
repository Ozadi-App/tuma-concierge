"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ChatLauncher } from "../../../../components/chat/ChatLauncher";

/** A direct link to a restaurant conversation opens it in the chat drawer, over the restaurant's page. */
export default function RestaurantChatPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const itemId = search.get("item");
  const itemName = search.get("itemName");
  return <ChatLauncher layer={{ type: "restaurant", id, item: itemId && itemName ? { id: itemId, name: itemName } : undefined }} underlay={`/restaurants/${id}`} />;
}
