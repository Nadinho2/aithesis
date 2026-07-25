import { Outlet, useRouterState } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { IconRail, getSectionFromPath } from "@/components/IconRail";
import { ContextSidebar } from "@/components/ContextSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";

export function AppShell() {
  const isMobile = useIsMobile();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const section = getSectionFromPath(path);

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-bone pb-[64px]">
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bone">
      <IconRail />
      <div className="flex-1 ml-[72px] flex min-h-screen">
        {section !== "home" && <ContextSidebar section={section} />}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
