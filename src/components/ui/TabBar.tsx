"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { publishTabBarHeight } from "./chrome-inset";
import type { TabIconProps } from "./icons";

interface TabBarItemBase {
  label: string;
  /** ui/icons 의 탭 아이콘. 지금 화면의 탭이면 filled 로 그린다. */
  icon: ComponentType<TabIconProps>;
}

/** 이 화면 안에서 보기를 바꾸는 탭. */
interface TabBarView<T extends string> extends TabBarItemBase {
  id: T;
  href?: never;
}

/** 이 화면을 떠나는 탭(플레이리스트의 밴드 홈, 만들기). 지금 화면이 될 수 없어 늘 꺼진 모양이다. */
interface TabBarLink extends TabBarItemBase {
  href: string;
  id?: never;
}

export type TabBarItem<T extends string> = TabBarView<T> | TabBarLink;

interface TabBarProps<T extends string> {
  items: readonly TabBarItem<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label": string;
}

type TabState = "current" | "idle";

const TAB_TONE: Record<TabState, string> = {
  current: "text-text",
  idle: "text-text-muted hover:text-text",
};

const itemClass = (state: TabState) =>
  `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-control text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${TAB_TONE[state]}`;

/**
 * 화면 아래에 붙는 탭 (dock). 탭 줄은 h-dock 이고, 그 아래 홈 인디케이터 자리를 스스로 칠한다(data-safe-bottom).
 * 그 자리까지 더한 높이를 --tab-bar-height 로 알리고, MiniPlayer 는 그 높이 위에, body 는 그만큼 비운다.
 * 알리기 전(하이드레이션 전)에는 globals.css 가 data-tab-bar 를 보고 같은 높이를 미리 둔다.
 * Spotify 처럼 아이콘 위 글자이고 칸 상자가 없다. 지금 탭은 채운 아이콘과 text-text, 나머지는 선 아이콘과 text-muted 다.
 * 위로 24px 은 bg 로 옅어지는 막이라 목록이 탭 밑으로 갑자기 잘리지 않는다. 막은 높이에 들지 않아 MiniPlayer 가 덮는다.
 * 글자는 줄을 바꾸지 않는다. 지금 쓰는 칸은 셋이라(BandTabBar) 320px 화면에서 칸이 100px 남짓이고 "플레이리스트" 여섯 글자가 한 줄에 선다.
 */
export default function TabBar<T extends string>({ items, value, onChange, "aria-label": label }: TabBarProps<T>) {
  return (
    <nav
      ref={publishTabBarHeight}
      aria-label={label}
      data-safe-bottom
      data-tab-bar
      className="fixed inset-x-0 bottom-0 z-40 bg-bg pb-safe-bottom print:hidden before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-b before:from-bg/0 before:to-bg"
    >
      <div className="mx-auto flex h-dock max-w-lg items-center px-2">
        {items.map((item) => {
          if (item.href !== undefined) {
            return (
              <Link key={item.label} href={item.href} className={itemClass("idle")}>
                <item.icon />
                {item.label}
              </Link>
            );
          }
          const current = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={current ? "page" : undefined}
              className={itemClass(current ? "current" : "idle")}
            >
              <item.icon filled={current} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
