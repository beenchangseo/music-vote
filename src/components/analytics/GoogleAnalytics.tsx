"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { gaCampaign, gaPage, gaReferrer, parseGaMeasurementId } from "@/domain/google-analytics";
import { isGaOptedOut, subscribeGaOptOut } from "@/lib/ga-opt-out";

type Gtag = NonNullable<Window["gtag"]>;

function installGtag(id: string): Gtag {
  if (window.gtag) return window.gtag;
  const dataLayer = (window.dataLayer ??= []);
  window.gtag = function gtag() {
    // gtag.js only reads Arguments objects from dataLayer; an array of rest parameters is silently ignored.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  return window.gtag;
}

export default function GoogleAnalytics() {
  const id = parseGaMeasurementId(process.env.NEXT_PUBLIC_GA_ID);
  const pathname = usePathname();
  // null on the server and through hydration. The server can't read the choice, and a server-rendered <Script>
  // has the browser preload gtag.js from Google even for a visitor who opted out.
  const optedOut = useSyncExternalStore(subscribeGaOptOut, isGaOptedOut, () => null);
  const last = useRef<{ pathname: string; location: string } | null>(null);

  // Keyed on the pathname alone: a query-only change (/band/x?created=1 → /band/x) is the same page to GA.
  // A layout effect, so the gtag queue and this page's fields exist before any page's own mount effect calls
  // track(): passive effects run children first, wherever this component sits in the tree.
  useLayoutEffect(() => {
    if (!id) return;
    // Still the server's null through hydration, and that commit's mount effects are the first to call track().
    const off = optedOut ?? isGaOptedOut();
    // gtag.js checks this before it sets a cookie or sends a hit, so it also stops a tag that already loaded.
    window[`ga-disable-${id}`] = off;
    if (off || last.current?.pathname === pathname) return;
    const gtag = installGtag(id);
    const origin = window.location.origin;
    const page = gaPage(pathname);
    const location = origin + page.path;
    const referrer = last.current?.location ?? gaReferrer(document.referrer, origin);
    // Read on the landing page only, like utm_ parameters in page_location would have been.
    const campaign = last.current ? {} : gaCampaign(window.location.search);
    last.current = { pathname, location };
    // `set` rather than page_view params: user_engagement and track() events read these too and would
    // otherwise default to document.location and document.title.
    gtag("set", {
      page_location: location,
      page_title: page.title,
      ...(referrer && { page_referrer: referrer }),
      ...campaign,
    });
    gtag("event", "page_view");
  }, [id, pathname, optedOut]);

  if (!id || optedOut !== false) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />;
}
