import { StandaloneRideBooking } from "../../../components/StandaloneBooking";

export const metadata = {
  title: "Ambulance | Peebee",
  description: "Request an ambulance. The nearest free one is sent straight away.",
};

export default function AmbulancePage() {
  return <StandaloneRideBooking mode="car" service="ambulance" />;
}
