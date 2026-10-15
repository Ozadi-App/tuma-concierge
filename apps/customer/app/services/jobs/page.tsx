import { redirect } from "next/navigation";

// Old entry point for "my jobs"; the Peebee Work job list now lives at /services/work.
export default function ServicesJobsPage() {
  redirect("/services/work");
}
