"use client";

import { useState } from "react";

type RenewalImageProps = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
};

/**
 * Renders a portrait image with a tasteful themed placeholder fallback, so the
 * layout looks finished before the final files are dropped into /public.
 */
export default function RenewalImage({
  src,
  alt,
  caption,
  className = "",
}: RenewalImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] ${className}`}
    >
      <div className="aspect-[4/5] w-full">
        {failed ? (
          <div className="renewal-placeholder flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-sm font-medium text-white/70">{alt}</span>
            <span className="text-xs text-white/45">{src}</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-5 text-sm font-medium text-white">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
