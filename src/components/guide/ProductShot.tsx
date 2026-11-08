import Image from "next/image";
import type { ReactNode } from "react";
import type { ProductScreenshot } from "@/lib/seo";

/** A product screenshot on a public page. The alt says what the screen shows, the caption why it is here. */
export default function ProductShot({
  shot,
  caption,
  sizes,
  className = "",
}: {
  shot: ProductScreenshot;
  caption?: ReactNode;
  /** The shown width (next/image sizes). */
  sizes: string;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      <Image
        src={shot.src}
        width={shot.width}
        height={shot.height}
        alt={shot.alt}
        sizes={sizes}
        className="h-auto w-full rounded-card border border-border"
      />
      {caption && <figcaption className="mt-2 break-keep text-center text-caption text-text-muted">{caption}</figcaption>}
    </figure>
  );
}
