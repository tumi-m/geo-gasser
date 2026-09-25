import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Screens hand over with a short cross-fade (styled in styles.css) where
    // the browser has the View Transitions API; elsewhere they simply swap.
    defaultViewTransition: true,
  });
}
