import { Link } from "@tanstack/react-router";

export default function Header() {
  const links = [{ to: "/", label: "Dashboard" }] as const;

  return (
    <header className="border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-row items-center justify-between px-4 py-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-muted-foreground">
            PricePulse
          </p>
          <h1 className="text-lg font-semibold">Monitoring cen i alerty</h1>
        </div>
        <nav className="flex gap-4 text-sm">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to} activeProps={{ className: "text-primary" }}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
