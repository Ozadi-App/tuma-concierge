import { redirect } from "next/navigation";

// Send is no longer its own button: Parcel lives in Ride.
export default function DeliverHomePage() {
  redirect("/ride");
}
