import { Link, useLocation } from "wouter";
import { History, BarChart3, Monitor, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Live", href: "/live", icon: Monitor, badge: "LIVE" },
    { name: "History", href: "/history", icon: History },
    { name: "Statistics", href: "/stats", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-border shrink-0">
          <img
            src="/ortogonex-logo.svg"
            alt="Ortogonex"
            className="h-8 w-auto object-contain"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Core Modules
          </div>
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer group",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span className="flex-1">{item.name}</span>
                  {"badge" in item && item.badge && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      {item.badge}
                    </span>
                  )}
                  {isActive && !("badge" in item) && (
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground opacity-50" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <div className="text-xs font-mono text-muted-foreground text-center opacity-40">
            ortogonex
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="flex-1 overflow-y-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
