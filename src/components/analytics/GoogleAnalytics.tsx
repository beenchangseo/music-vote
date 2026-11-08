"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { gaPage, gaReferrer, parseGaMeasurementId } from "@/domain/google-analytics";

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
  const last = useRef<{ pathname: string; location: string } | null>(null);

  // Keyed on the pathname alone: a query-only change (/band/x?created=1 → /band/x) is the same page to GA.
  // A layout effect, so the gtag queue and this page's fields exist before any page's own mount effect calls
  // track(): passive effects run children first, wherever this component sits in the tree.
  useLayoutEffect(() => {
    if (!id || last.current?.pathname === pathname) return;
    const gtag = installGtag(id);
    const origin = window.location.origin;
    const page = gaPage(pathname);
    const location = origin + page.path;
    const referrer = last.current?.location ?? gaReferrer(document.referrer, origin);
    last.current = { pathname, location };
    // `set` rather than page_view params: user_engagement and track() events read these too and would
    // otherwise default to document.location and document.title.
    gtag("set", { page_location: location, page_title: page.title, ...(referrer && { page_referrer: referrer }) });
    gtag("event", "page_view");
  }, [id, pathname]);

  if (!id) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />;
}
