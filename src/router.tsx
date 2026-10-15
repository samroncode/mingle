import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { GuestLayout } from "@/layouts/GuestLayout";
import { HostLayout } from "@/layouts/HostLayout";
import { TvLayout } from "@/layouts/TvLayout";
import { CreateView } from "@/views/CreateView";
import { ErrorView } from "@/views/ErrorView";
import { GuestView } from "@/views/GuestView";
import { HostView } from "@/views/HostView";
import { LandingView } from "@/views/LandingView";
import { NotFoundView } from "@/views/NotFoundView";
import { SummaryView } from "@/views/SummaryView";
import { TvView } from "@/views/TvView";

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
