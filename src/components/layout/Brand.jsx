import Link from "next/link";

export default function Brand() {
  return <Link href="/" aria-label="Roll N Spice home" className="brand">
    Roll N Spice <svg aria-hidden="true" viewBox="0 0 24 32" className="brand-flame"><path fill="currentColor" d="M13 0c3 8-4 9-1 15 2-2 3-5 3-8 7 6 10 13 7 19-4 8-17 8-21 0-3-6 0-12 5-17-1 7 0 9 2 10C5 10 12 7 13 0Z" /></svg>
  </Link>;
}
