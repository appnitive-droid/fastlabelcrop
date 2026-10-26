"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./primitives";

const NavigationContext = createContext<((href: string, options: { replace?: boolean; scroll?: boolean }) => void) | null>(null);

export function useNavigationFeedback() {
  return useContext(NavigationContext);
}

export default function NavigationFeedback({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(href: string, options: { replace?: boolean; scroll?: boolean }) {
    startTransition(() => {
      if (options.replace) router.replace(href, { scroll: options.scroll });
      else router.push(href, { scroll: options.scroll });
    });
  }
  return <NavigationContext.Provider value={navigate}>
    {children}
    {pending && <div className="pointer-events-none fixed inset-x-0 top-0 z-50" role="status" aria-live="polite">
      <div className="h-1 animate-pulse bg-accent-600 motion-reduce:animate-none" />
      <div className="absolute right-4 top-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-lg"><Spinner label="Opening page…" /></div>
    </div>}
  </NavigationContext.Provider>;
}
