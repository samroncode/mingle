import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { GuestLayout } from "@/app/layouts/GuestLayout";
import { HostLayout } from "@/app/layouts/HostLayout";
import { TvLayout } from "@/app/layouts/TvLayout";
import { CreateView } from "@/views/create/CreateView";
import { ErrorView } from "@/views/shared/ErrorView";
import { GuestView } from "@/views/guest/GuestView";
import { HostView } from "@/views/host/HostView";
import { LandingView } from "@/views/landing/LandingView";
import { NotFoundView } from "@/views/shared/NotFoundView";
import { SummaryView } from "@/views/summary/SummaryView";
import { TvView } from "@/views/tv/TvView";

// Routes from CLAUDE.md. The host's admin key arrives in the URL fragment
// (`/host/:code#key=…`), which is not part of route matching.
const router = createBrowserRouter([
  {
    errorElement: <ErrorView />,
    children: [
      {
        element: <GuestLayout />,
        children: [
          { path: "/", element: <LandingView /> },
          { path: "/p/:code", element: <GuestView /> },
          { path: "/p/:code/summary", element: <SummaryView /> },
          { path: "*", element: <NotFoundView /> },
        ],
      },
      {
        element: <HostLayout />,
        children: [
          { path: "/new", element: <CreateView /> },
          { path: "/host/:code", element: <HostView /> },
        ],
      },
      {
        element: <TvLayout />,
        children: [{ path: "/tv/:code", element: <TvView /> }],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
