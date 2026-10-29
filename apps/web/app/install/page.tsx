import type { Metadata } from "next";
import { AccountView } from "../../components/AccountView";
import { ACCOUNT_BY_SLUG } from "../../lib/account";

export const metadata: Metadata = { title: ACCOUNT_BY_SLUG["install"].title, description: ACCOUNT_BY_SLUG["install"].lead.slice(0, 150) };
export default function Page() {
  return <AccountView slug="install" />;
}
