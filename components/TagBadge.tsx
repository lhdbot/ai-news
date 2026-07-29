import Link from "next/link";

export default function TagBadge({ tag }: { tag: string }) {
  return (
    <Link
      href={`/tag/${encodeURIComponent(tag)}`}
      className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
    >
      #{tag}
    </Link>
  );
}
