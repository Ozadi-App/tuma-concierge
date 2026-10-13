import { StandaloneRideBooking } from "../../components/StandaloneBooking";

export const metadata = {
  title: "Move / Cargo | Peebee",
  description: "Book moving vans, pickup trucks, and box trucks for your transport and relocation needs.",
};

export default function MovePage() {
  return <StandaloneRideBooking mode="car" cargo />;
}
