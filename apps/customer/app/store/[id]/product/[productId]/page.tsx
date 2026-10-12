"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StoreProductRedirect() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.productId as string;

  useEffect(() => {
    if (productId) {
      router.replace(`/product/${productId}`);
    }
  }, [productId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-gold border-t-transparent" />
    </div>
  );
}
