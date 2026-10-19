import { Suspense } from "react";
import { JobDetail } from "../../../../components/jobs/JobDetail";

export const metadata = { title: "Job | Peebee" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <JobDetail id={id} />
    </Suspense>
  );
}
