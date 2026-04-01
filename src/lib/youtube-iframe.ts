// YouTube IFrame API singleton loader
// Safe for React 19 strict mode (double-invocation of effects)

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { data: PlayerState; target: Player }) => void;
      onError?: (event: { data: number; target: Player }) => void;
    };
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    getPlayerState(): PlayerState;
    getCurrentTime(): number;
    getDuration(): number;
    destroy(): void;
  }
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: typeof YT;
  }
}

let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeAPI(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<typeof YT>((resolve) => {
    // Already loaded
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    // Set callback before loading script
    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT!);
    };

    // Check if script tag already exists (e.g., from a previous strict-mode render)
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

export { YT };
