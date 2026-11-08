"use client";

import type { ReactNode } from "react";
import { segmentItemClass } from "./SegmentedControl";
import { publishTabBarHeight } from "./chrome-inset";

export interface TabBarItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface TabBarProps<T extends string> {
  items: readonly TabBarItem<T>[];
  value: T;
  onChange: (id: T) => void;
  "aria-label": string;
}

/**
 * 화면 아래에 붙는 탭 (dock). 높이는 --spacing-dock 이고 MiniPlayer 가 bottom-dock 으로 이 위에 붙는다.
 * 모양은 SegmentedControl 과 같고, 뜻은 화면 전환이라 aria-current 로 말한다.
 * 글자는 줄을 바꾸지 않는다. 칸이 320px 화면의 1/3(91px)이라 칸 여백을 4px 로 줄여서, 칸 셋이면 "셋리스트" 같은 네 글자까지 아이콘 옆 한 줄에 선다.
 */
export default function TabBar<T extends string>({ items, value, onChange, "aria-label": label }: TabBarProps<T>) {
  return (
    <nav ref={publishTabBarHeight} aria-label={label} className="fixed inset-x-0 bottom-0 z-40 bg-bg print:hidden">
      <div className="mx-auto flex h-dock max-w-lg items-center px-4">
        <div className="flex w-full gap-1 rounded-card bg-surface p-1">
          {items.map((item) => {
            const active = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={active ? "page" : undefined}
                className={`${segmentItemClass(active, "px-1")} [&_svg]:shrink-0`}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
