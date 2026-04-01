"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
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
  onAutoplayBlocked?: () => void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, onEnded, onPlay, onPause, onError, onAutoplayBlocked }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const [ready, setReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const pendingVideoRef = useRef<string | null>(null);
    const autoplayCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onErrorRef = useRef(onError);
    const onAutoplayBlockedRef = useRef(onAutoplayBlocked);

    // Keep refs in sync
    onEndedRef.current = onEnded;
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onErrorRef.current = onError;
    onAutoplayBlockedRef.current = onAutoplayBlocked;

    const clearAutoplayCheck = useCallback(() => {
      if (autoplayCheckTimerRef.current) {
        clearTimeout(autoplayCheckTimerRef.current);
        autoplayCheckTimerRef.current = null;
      }
    }, []);

    useImperativeHandle(ref, () => ({
      play() {
        playerRef.current?.playVideo();
      },
      pause() {
        playerRef.current?.pauseVideo();
      },
      loadVideoById(id: string) {
        setHasError(false);
        if (playerRef.current && ready) {
          playerRef.current.loadVideoById(id);
          // Check for autoplay block after 1.5s
          clearAutoplayCheck();
          autoplayCheckTimerRef.current = setTimeout(() => {
            if (playerRef.current) {
              const state = playerRef.current.getPlayerState();
              if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
                onAutoplayBlockedRef.current?.();
              }
            }
          }, 1500);
        } else {
          pendingVideoRef.current = id;
        }
      },
    }), [ready, clearAutoplayCheck]);

    useEffect(() => {
      let destroyed = false;

      loadYouTubeAPI().then((ytApi) => {
        if (destroyed || !containerRef.current) return;

        const initialVideoId = pendingVideoRef.current || videoId || undefined;
        pendingVideoRef.current = null;

        playerRef.current = new ytApi.Player(containerRef.current, {
          height: "100%",
          width: "100%",
          videoId: initialVideoId,
          playerVars: {
            autoplay: initialVideoId ? 1 : 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady() {
              if (!destroyed) {
                setReady(true);
                if (pendingVideoRef.current) {
                  playerRef.current?.loadVideoById(pendingVideoRef.current);
                  pendingVideoRef.current = null;
                }
              }
            },
            onStateChange(event: { data: YT.PlayerState }) {
              if (destroyed) return;
              switch (event.data) {
                case ytApi.PlayerState.ENDED:
                  clearAutoplayCheck();
                  onEndedRef.current?.();
                  break;
                case ytApi.PlayerState.PLAYING:
                  clearAutoplayCheck();
                  onPlayRef.current?.();
                  break;
                case ytApi.PlayerState.PAUSED:
                  onPauseRef.current?.();
                  break;
              }
            },
            onError() {
              if (!destroyed) {
                setHasError(true);
                onErrorRef.current?.();
              }
            },
          },
        });
      });

      return () => {
        destroyed = true;
        clearAutoplayCheck();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    // Initialize once
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (hasError && videoId) {
      return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
            title="YouTube video"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-lg overflow-hidden bg-black"
      />
    );
  }
);

export default YouTubePlayer;
