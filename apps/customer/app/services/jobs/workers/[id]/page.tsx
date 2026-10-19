import { Suspense } from "react";
import { WorkerDetail } from "../../../../../components/jobs/WorkerDetail";

export const metadata = { title: "Worker | Peebee" };

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <WorkerDetail id={id} />
    </Suspense>
  );
}
