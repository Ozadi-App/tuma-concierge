import { redirect } from "next/navigation";

// Older link to the services home.
export default function ServiceHomePage() {
  redirect("/services");
}
