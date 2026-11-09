import { createBrowserRouter } from "react-router";
import { Suspense } from "react";
import { RouterProvider } from "react-router/dom";
import { GuestLayout } from "@/app/layouts/GuestLayout";
import { HostLayout } from "@/app/layouts/HostLayout";
import { TvLayout } from "@/app/layouts/TvLayout";
import { ErrorView } from "@/views/shared/ErrorView";
import { lazyView } from "@/lib/routes/loadView";
import { RouteLoading } from "@/views/shared/RouteLoading";
import { NotFoundView } from "@/views/shared/NotFoundView";

const CreateView = lazyView(
  () => import("@/views/create/CreateView"),
  "CreateView",
);
const HostView = lazyView(() => import("@/views/host/HostView"), "HostView");
const PizzaAdminView = lazyView(
  () => import("@/views/pizza/PizzaAdminView"),
  "PizzaAdminView",
);
const PizzaView = lazyView(
  () => import("@/views/pizza/PizzaView"),
  "PizzaView",
);
const SummaryView = lazyView(
  () => import("@/views/summary/SummaryView"),
  "SummaryView",
);
const TvView = lazyView(() => import("@/views/tv/TvView"), "TvView");
const GuestView = lazyView(
  () => import("@/views/guest/GuestView"),
  "GuestView",
);
const LandingView = lazyView(
  () => import("@/views/landing/LandingView"),
  "LandingView",
);

// Routes from CLAUDE.md. The host's admin key arrives in the URL fragment
// (`/host/:code#key=…`), which is not part of route matching.
const router = createBrowserRouter([
  {
    errorElement: <ErrorView />,
    children: [
      {
        element: <GuestLayout />,
        children: [
          {
            path: "/",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <LandingView />
              </Suspense>
            ),
          },
          {
            path: "/p/:code",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <GuestView />
              </Suspense>
            ),
          },
          {
            path: "/p/:code/summary",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <SummaryView />
              </Suspense>
            ),
          },
          {
            path: "/pizza",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <PizzaView />
              </Suspense>
            ),
          },
          {
            path: "/pizza/admin",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <PizzaAdminView />
              </Suspense>
            ),
          },
          { path: "*", element: <NotFoundView /> },
        ],
      },
      {
        element: <HostLayout />,
        children: [
          {
            path: "/new",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <CreateView />
              </Suspense>
            ),
          },
          {
            path: "/host/:code",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <HostView />
              </Suspense>
            ),
          },
        ],
      },
      {
        element: <TvLayout />,
        children: [
          {
            path: "/tv/:code",
            element: (
              <Suspense fallback={<RouteLoading />}>
                <TvView />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
