import { Suspense } from "react";
import { FindWorkers } from "../../../../components/jobs/FindWorkers";

export const metadata = { title: "Find a worker | Peebee" };

export default function FindWorkersPage() {
  return (
    <Suspense>
      <FindWorkers />
    </Suspense>
  );
}
