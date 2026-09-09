import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/community/")({
  component: CommunityIndexPage,
});

function CommunityIndexPage() {
  return <Navigate to="/community/university-feed" />;
}
