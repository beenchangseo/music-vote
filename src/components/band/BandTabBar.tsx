"use client";

import { useState } from "react";
import TabBar, { type TabBarItem } from "../ui/TabBar";
import { HomeIcon, PlaylistsIcon, PlusIcon } from "../ui/icons";
import { playlistTabTarget, type PlaylistPick } from "@/domain/playlist-picker";
import BandPlaylistPicker from "./BandPlaylistPicker";

interface BandTabBarProps {
  teamId: string;
  playlists: readonly PlaylistPick[];
}

type Tab = "home" | "playlists";

/**
 * 밴드 홈의 아래 탭 (#110, 시안 H). 세 칸 모두 밴드 층이다: 밴드 홈 · 플레이리스트 · ＋ 만들기.
 * 플레이리스트 칸은 진행 중인 플레이리스트가 꼭 하나면 그리로 가고, 아니면 고르는 시트를 연다.
 * 플레이리스트 안의 아래 탭은 밴드 홈 · 후보곡 · 셋리스트 · 합주다(playlist/NavigationBar).
 */
export default function BandTabBar({ teamId, playlists }: BandTabBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const target = playlistTabTarget(playlists);
  const playlistsTab: TabBarItem<Tab> =
    target.kind === "open"
      ? { href: `/playlist/${target.shareCode}`, label: "플레이리스트", icon: PlaylistsIcon }
      : { id: "playlists", label: "플레이리스트", icon: PlaylistsIcon, opensDialog: true };

  function select(tab: Tab) {
    if (tab === "playlists") setPickerOpen(true);
    else window.scrollTo({ top: 0 });
  }

  return (
    <>
      <TabBar
        items={[
          { id: "home", label: "밴드 홈", icon: HomeIcon },
          playlistsTab,
          { href: `/new?band=${teamId}`, label: "만들기", icon: PlusIcon },
        ]}
        value="home"
        onChange={select}
        aria-label="밴드 화면"
      />
      <BandPlaylistPicker open={pickerOpen} onClose={() => setPickerOpen(false)} playlists={playlists} />
    </>
  );
}
