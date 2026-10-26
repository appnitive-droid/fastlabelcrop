"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useNavigationFeedback } from "./NavigationFeedback";

/** Preserve Next's prefetching and native modified/new-tab link behavior. */
export default function AppLink({ onClick, ...props }: ComponentProps<typeof NextLink>) {
  const navigate = useNavigationFeedback();
  return <NextLink {...props} onClick={(event) => {
    onClick?.(event);
    if (!navigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.currentTarget;
    if (anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const destination = new URL(anchor.href);
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    event.preventDefault();
    navigate(destination.pathname + destination.search + destination.hash, { replace: props.replace, scroll: props.scroll });
  }} />;
}
