"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { loadYouTubeAPI, YT } from "@/lib/youtube-iframe";

export interface YouTubePlayerHandle {
  play(): void;
  pause(): void;
  loadVideoById(videoId: string): void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: () => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, onEnded, onPlay, onPause, onError }, ref) {
    const iframeId = useRef(`yt-${Math.random().toString(36).slice(2, 9)}`).current;
    const playerRef = useRef<YT.Player | null>(null);
    const [ready, setReady] = useState(false);

    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onErrorRef = useRef(onError);
    onEndedRef.current = onEnded;
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onErrorRef.current = onError;

    // Attach YT API to the existing iframe for event detection (onEnded, onPlay, onPause)
    useEffect(() => {
      if (!videoId) return;
      let destroyed = false;

      loadYouTubeAPI().then((ytApi) => {
        if (destroyed) return;
        playerRef.current = new ytApi.Player(iframeId, {
          events: {
            onReady() {
              if (!destroyed) setReady(true);
            },
            onStateChange(event: { data: YT.PlayerState }) {
              if (destroyed) return;
              switch (event.data) {
                case ytApi.PlayerState.ENDED:
                  onEndedRef.current?.();
                  break;
                case ytApi.PlayerState.PLAYING:
                  onPlayRef.current?.();
                  break;
                case ytApi.PlayerState.PAUSED:
                  onPauseRef.current?.();
                  break;
              }
            },
            onError() {
              if (!destroyed) onErrorRef.current?.();
            },
          },
        });
      });

      return () => {
        destroyed = true;
        playerRef.current = null;
        setReady(false);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    useImperativeHandle(ref, () => ({
      play() { playerRef.current?.playVideo(); },
      pause() { playerRef.current?.pauseVideo(); },
      loadVideoById(id: string) {
        if (playerRef.current && ready) {
          playerRef.current.loadVideoById(id);
        }
      },
    }), [ready]);

    if (!videoId) return null;

    return (
      <iframe
        id={iframeId}
        key={videoId}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
        title="YouTube video"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
        className="w-full aspect-video rounded-lg"
      />
    );
  }
);

export default YouTubePlayer;
