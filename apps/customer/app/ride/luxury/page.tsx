import { StandaloneRideBooking } from "../../../components/StandaloneBooking";

export const metadata = {
  title: "Luxury ride | Peebee",
  description: "Chauffeur-driven luxury cars for weddings, parties, red carpet arrivals and VIP transfers.",
};

export default function LuxuryRidePage() {
  return <StandaloneRideBooking mode="car" service="luxury" />;
}
