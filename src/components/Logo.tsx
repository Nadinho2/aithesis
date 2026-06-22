import { Link } from "@tanstack/react-router";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <span className="size-8 bg-ink rounded-sm flex items-center justify-center">
        <span className="w-4 h-0.5 bg-bone" />
      </span>
      <span className="font-serif italic text-xl font-bold tracking-tight text-ink">
        Mybrainpadi
      </span>
    </Link>
  );
}
