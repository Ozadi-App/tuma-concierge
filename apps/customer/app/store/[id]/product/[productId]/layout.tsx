// "_" is the placeholder the static mobile export is built with (see
// lib/native/routes.ts); on the web build it is just one extra prerendered
// page, and every real id is still rendered on demand.
export function generateStaticParams() {
  return [{ productId: "_" }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
