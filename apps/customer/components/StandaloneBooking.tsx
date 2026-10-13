"use client";

import { useRouter } from "next/navigation";
import { ParcelModal } from "./home/ParcelModal";
import { RideModal } from "./home/RideModal";
import { ShoppingListModal } from "./home/ShoppingListModal";

export function StandaloneRideBooking({ mode, cargo = false }: { mode: "boda" | "car"; cargo?: boolean }) {
  const router = useRouter();
  return <RideModal initialMode={mode} initialCargo={cargo} serviceLocked onClose={() => router.push("/")} />;
}

export function StandaloneShoplist() {
  const router = useRouter();
  return <ShoppingListModal onClose={() => router.push("/")} />;
}

export function StandaloneParcelBooking() {
  const router = useRouter();
  return <ParcelModal onClose={() => router.push("/")} />;
}
