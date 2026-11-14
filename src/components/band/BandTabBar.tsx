"use client";

import { useState } from "react";
import TabBar, { type TabBarItem } from "../ui/TabBar";
import { HomeIcon, PlaylistsIcon, PlusIcon } from "../ui/icons";
import { playlistTabTarget, type PlaylistPick } from "@/domain/playlist-picker";
import BandPlaylistPicker from "./BandPlaylistPicker";

/** 볼 수 있는 밴드(#106 규칙, 밴드 멤버만)와 그 플레이리스트. 목록을 읽지 못했으면 playlists 가 null 이다. */
export interface TabBand {
  id: string;
  playlists: readonly PlaylistPick[] | null;
}

type BandTabBarProps =
  | { screen: "band-home"; band: TabBand }
  /** band 가 null 이면 밴드 없는 플레이리스트이거나 밴드를 볼 수 없는 사람이다. 밴드를 드러내지 않는다. */
  | { screen: "playlist"; shareCode: string; band: TabBand | null };

type Tab = "home" | "playlists";

/**
 * 밴드 홈과 플레이리스트의 아래 탭 (#110, 시안 H). 세 칸 모두 밴드 층이다: 밴드 홈 · 플레이리스트 · ＋ 만들기.
 * 플레이리스트 칸은 밴드 홈에서 진행 중인 플레이리스트가 꼭 하나면 그리로 가고, 아니면 고르는 시트를 연다.
 * 플레이리스트 안에서는 그 칸이 지금 칸이고, 누르면 같은 시트가 지금 플레이리스트에 체크를 하고 열린다.
 * 밴드를 볼 수 없는 사람에게는 홈(/) · 플레이리스트(지금 칸, 누르면 맨 위로) · 만들기(/new)다.
 * 후보곡 · 셋리스트 · 합주는 탭이 아니라 플레이리스트 안의 보기다(PlaylistClient 의 SegmentedControl).
 */
export default function BandTabBar(props: BandTabBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { band } = props;
  const onBandHome = props.screen === "band-home";

  const home: TabBarItem<Tab> = onBandHome
    ? { id: "home", label: "밴드 홈", icon: HomeIcon }
    : band
      ? { href: `/band/${band.id}`, label: "밴드 홈", icon: HomeIcon }
      : { href: "/", label: "홈", icon: HomeIcon };
  const target = props.screen === "band-home" ? playlistTabTarget(props.band.playlists ?? []) : { kind: "pick" as const };
  const playlists: TabBarItem<Tab> =
    target.kind === "open"
      ? { href: `/playlist/${target.shareCode}`, label: "플레이리스트", icon: PlaylistsIcon }
      : { id: "playlists", label: "플레이리스트", icon: PlaylistsIcon, opensDialog: !!band };
  const create: TabBarItem<Tab> = { href: band ? `/new?band=${band.id}` : "/new", label: "만들기", icon: PlusIcon };

  function select(tab: Tab) {
    if (tab === "playlists" && band) setPickerOpen(true);
    else window.scrollTo({ top: 0 });
  }

  return (
    <>
      <TabBar
        items={[home, playlists, create]}
        value={onBandHome ? "home" : "playlists"}
        onChange={select}
        aria-label={onBandHome ? "밴드 화면" : "플레이리스트 화면"}
      />
      {band && (
        <BandPlaylistPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          playlists={band.playlists}
          current={props.screen === "playlist" ? props.shareCode : null}
        />
      )}
    </>
  );
}
