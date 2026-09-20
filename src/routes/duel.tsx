import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/duel")({ component: DuelLayout });

function DuelLayout() {
  return <Outlet />;
}
