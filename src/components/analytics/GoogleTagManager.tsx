"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { gaCampaign, gaPage, gaReferrer, parseGtmContainerId } from "@/domain/google-analytics";
import { isGaOptedOut, isGaOptOutSaved, subscribeGaOptOut } from "@/lib/ga-opt-out";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// Set once gtm.js is queued, for the life of the page. A loaded container runs its own tags (user_engagement, enhanced
// measurement) whatever the page stops pushing, so turning sending off then reloads into a page without it.
let containerQueued = false;

export default function GoogleTagManager() {
  const id = parseGtmContainerId(process.env.NEXT_PUBLIC_GTM_ID);
  const pathname = usePathname();
  // null on the server and through hydration. The server can't read the choice, and a server-rendered <Script>
  // has the browser preload gtm.js from Google even for a visitor who opted out.
  const optedOut = useSyncExternalStore(subscribeGaOptOut, isGaOptedOut, () => null);
  const last = useRef<{ pathname: string; location: string } | null>(null);

  // Keyed on the pathname alone: a query-only change (/band/x?created=1 → /band/x) is the same page to GA.
  // A layout effect, so this page's fields and gtm.start are queued before <Script> inserts gtm.js from its own
  // passive effect, which runs before this component's: passive effects run children first.
  useLayoutEffect(() => {
    if (!id) return;
    // Still the server's null through hydration.
    const off = optedOut ?? isGaOptedOut();
    if (off) {
      // Also for a switch turned off in another tab. Not while only memory holds the choice: the reload would forget it.
      if (containerQueued && isGaOptOutSaved()) {
        // Once: the reload ends this page, and a navigation before it lands must not ask again.
        containerQueued = false;
        window.location.reload();
      }
      return;
    }
    if (last.current?.pathname === pathname) return;
    const dataLayer = (window.dataLayer ??= []);
    const origin = window.location.origin;
    const page = gaPage(pathname);
    const location = origin + page.path;
    const referrer = last.current?.location ?? gaReferrer(document.referrer, origin);
    // Read on the landing page only, like utm_ parameters in page_location would have been.
    const campaign = last.current ? {} : gaCampaign(window.location.search);
    last.current = { pathname, location };
    // Top-level keys persist in GTM's data model until the next page writes them. page_referrer is always written,
    // undefined included, so an earlier value cannot outlive its page.
    dataLayer.push({ page_location: location, page_title: page.title, page_referrer: referrer, ...campaign });
    if (!containerQueued) {
      containerQueued = true;
      // After the page fields: GTM fires Initialization, where the Google tag reads its config, before the first
      // queued event, so fields pushed after gtm.js would reach it empty and GA would fall back to the real URL.
      dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    }
    dataLayer.push({ event: "plypick_page_view" });
  }, [id, pathname, optedOut]);

  if (!id || optedOut !== false) return null;
  return <Script src={`https://www.googletagmanager.com/gtm.js?id=${id}`} />;
}
