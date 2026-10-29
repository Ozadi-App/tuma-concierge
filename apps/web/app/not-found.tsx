import Link from "next/link";

export default function NotFound() {
  return (
    <div className="plain wrap">
      <p className="kicker">404</p>
      <h1 className="display">That page is not here.</h1>
      <p className="lead">The link may be old. Head back to the start.</p>
      <Link href="/" className="btn btn-gold">Back to Peebee</Link>
    </div>
  );
}
