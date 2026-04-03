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
    const iframeId = useRef(`yt-${Math.random().toString(36).slice(2, 9)}`).current;
    const playerRef = useRef<YT.Player | null>(null);
    const [ready, setReady] = useState(false);
    const autoplayCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep callback refs stable
    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onErrorRef = useRef(onError);
    const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
    onEndedRef.current = onEnded;
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onErrorRef.current = onError;
    onAutoplayBlockedRef.current = onAutoplayBlocked;

    const clearAutoplayCheck = useCallback(() => {
      if (autoplayCheckRef.current) {
        clearTimeout(autoplayCheckRef.current);
        autoplayCheckRef.current = null;
      }
    }, []);

    // Attach YT API to the existing iframe after it renders
    useEffect(() => {
      if (!videoId) return;

      let destroyed = false;

      loadYouTubeAPI().then((ytApi) => {
        if (destroyed) return;

        // Attach to existing iframe (does NOT replace it)
        playerRef.current = new ytApi.Player(iframeId, {
          events: {
            onReady() {
              if (!destroyed) {
                setReady(true);
                // Check if autoplay was blocked on mobile (1.5s after ready)
                clearAutoplayCheck();
                autoplayCheckRef.current = setTimeout(() => {
                  if (playerRef.current && !destroyed) {
                    const state = playerRef.current.getPlayerState();
                    if (state === ytApi.PlayerState.UNSTARTED || state === ytApi.PlayerState.CUED) {
                      onAutoplayBlockedRef.current?.();
                    }
                  }
                }, 1500);
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
              if (!destroyed) onErrorRef.current?.();
            },
          },
        });
      });

      return () => {
        destroyed = true;
        clearAutoplayCheck();
        // Don't call destroy() — React will remove the iframe from DOM.
        // Calling destroy() on an API-attached iframe can cause errors.
        playerRef.current = null;
        setReady(false);
      };
    // Re-run when videoId changes (iframe is re-created via key={videoId})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    useImperativeHandle(ref, () => ({
      play() {
        playerRef.current?.playVideo();
      },
      pause() {
        playerRef.current?.pauseVideo();
      },
      loadVideoById(id: string) {
        if (playerRef.current && ready) {
          playerRef.current.loadVideoById(id);
          clearAutoplayCheck();
          autoplayCheckRef.current = setTimeout(() => {
            if (playerRef.current) {
              const state = playerRef.current.getPlayerState();
              if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.CUED) {
                onAutoplayBlockedRef.current?.();
              }
            }
          }, 1500);
        }
      },
    }), [ready, clearAutoplayCheck]);

    // Cleanup on unmount
    useEffect(() => {
      return () => clearAutoplayCheck();
    }, [clearAutoplayCheck]);

    if (!videoId) return null;

    // Render iframe directly — this preserves the user gesture chain on mobile.
    // The iframe is inserted synchronously during React render (within tap handler),
    // so autoplay=1 is allowed by mobile browsers.
    return (
      <iframe
        id={iframeId}
        key={videoId}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
        title="YouTube video"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="w-full aspect-video rounded-lg"
      />
    );
  }
);

export default YouTubePlayer;
