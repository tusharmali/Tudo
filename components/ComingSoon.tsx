import Link from "next/link";

export default function ComingSoon({
  title,
  phase,
  blurb,
}: {
  title: string;
  phase: number;
  blurb: string;
}) {
  return (
    <div className="coming">
      <div className="coming-ic">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m12 3 1.9 4.6L19 9l-4.6 1.9L12 15l-1.9-4.1L5 9l4.6-1.4L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"
          />
        </svg>
      </div>
      <span className="pill p-peri">Phase {phase}</span>
      <h2 style={{ marginTop: 14 }}>{title}</h2>
      <p>{blurb}</p>
      <Link href="/dashboard" className="btn btn-ghost" style={{ display: "inline-flex" }}>
        ← Back to Home
      </Link>
    </div>
  );
}
