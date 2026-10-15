"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sign-up now lives on the shared login screen (Sign up / Log in), the same
 * as every other Peebee app — this keeps old links working. */
export default function SignUpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
