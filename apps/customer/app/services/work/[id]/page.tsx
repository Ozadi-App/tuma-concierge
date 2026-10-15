import { WorkJobDetail } from "../../../../components/work/WorkJobDetail";

export const metadata = { title: "Job | Peebee" };

export default async function WorkJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkJobDetail id={id} />;
}
