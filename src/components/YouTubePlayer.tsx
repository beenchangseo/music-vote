"use client";

import { useState } from "react";
import Image from "next/image";

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  autoLoad?: boolean;
}

export default function YouTubePlayer({ videoId, title, autoLoad = false }: YouTubePlayerProps) {
  const [loaded, setLoaded] = useState(autoLoad);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  if (!loaded) {
    return (
      <button
        onClick={() => setLoaded(true)}
        className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden group"
        aria-label={`${title} 재생`}
      >
        <Image
          src={thumbnailUrl}
          alt={title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 group-hover:bg-red-500 transition-colors shadow-lg">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
