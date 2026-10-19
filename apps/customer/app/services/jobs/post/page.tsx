import { Suspense } from "react";
import { PostJob } from "../../../../components/jobs/PostJob";

export const metadata = { title: "Post a job | Peebee" };

export default function PostJobPage() {
  return (
    <Suspense>
      <PostJob />
    </Suspense>
  );
}
