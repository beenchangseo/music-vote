"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { loadYouTubeAPI, type YT } from "@/lib/youtube-iframe";

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
  className?: string;
}

/**
 * 곡이 바뀌어도 iframe 을 다시 만들지 않는다.
 *
 * 모바일 브라우저는 사용자 제스처로 시작된 재생만 허용한다. 곡마다 iframe 을
 * 새로 만들면 그 제스처와의 연결이 끊겨 다음 곡 자동 재생이 막힌다. 처음 한 번만
 * 만들고 이후 전환은 loadVideoById 로 처리해 최초 제스처의 허용을 이어 쓴다.
 *
 * 같은 이유로 이 iframe 을 DOM 의 다른 위치로 옮기면 안 된다. 브라우저가
 * 옮겨진 iframe 을 다시 로드한다. 화면에서 한 자리를 지키도록 둘 것.
 */
const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, onEnded, onPlay, onPause, onError, className }, ref) {
    const iframeId = useRef(`yt-${Math.random().toString(36).slice(2, 9)}`).current;
    const playerRef = useRef<YT.Player | null>(null);
    const [ready, setReady] = useState(false);

    // iframe src 는 첫 곡으로 고정한다. 이후 전환은 loadVideoById 가 맡는다.
    const initialVideoIdRef = useRef<string | null>(videoId);
    if (initialVideoIdRef.current === null && videoId) {
      initialVideoIdRef.current = videoId;
    }
    const initialVideoId = initialVideoIdRef.current;

    const onEndedRef = useRef(onEnded);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);
    const onErrorRef = useRef(onError);
    useEffect(() => {
      onEndedRef.current = onEnded;
      onPlayRef.current = onPlay;
      onPauseRef.current = onPause;
      onErrorRef.current = onError;
    }, [onEnded, onPlay, onPause, onError]);

    // 플레이어는 한 번만 만든다. videoId 는 의존성에 넣지 않는다.
    useEffect(() => {
      if (!initialVideoId) return;
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
    }, [iframeId, !!initialVideoId]);

    // 곡 전환: 같은 플레이어에 다음 영상을 싣는다.
    const loadedVideoIdRef = useRef<string | null>(initialVideoId);
    useEffect(() => {
      if (!ready || !videoId) return;
      if (loadedVideoIdRef.current === videoId) return;
      loadedVideoIdRef.current = videoId;
      playerRef.current?.loadVideoById(videoId);
    }, [ready, videoId]);

    useImperativeHandle(ref, () => ({
      play() { playerRef.current?.playVideo(); },
      pause() { playerRef.current?.pauseVideo(); },
      loadVideoById(id: string) {
        if (playerRef.current && ready) {
          loadedVideoIdRef.current = id;
          playerRef.current.loadVideoById(id);
        }
      },
    }), [ready]);

    if (!initialVideoId) return null;

    return (
      <iframe
        id={iframeId}
        src={`https://www.youtube.com/embed/${initialVideoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
        title="YouTube video"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className={className ?? "w-full aspect-video rounded-lg"}
      />
    );
  }
);

export default YouTubePlayer;
