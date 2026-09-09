import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mentor/")({
  component: MentorIndexPage,
});

function MentorIndexPage() {
  return <Navigate to="/mentor/find" />;
}
