import { ContractDetail } from "../../../../../components/jobs/ContractDetail";

export const metadata = { title: "Job | Peebee" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractDetail id={id} />;
}
