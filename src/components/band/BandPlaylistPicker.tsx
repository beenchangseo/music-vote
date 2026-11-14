"use client";

import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import ListRow, { ListGroup, ListRowIcon, ListRowLink } from "../ui/ListRow";
import { DoneIcon, SongIcon } from "../ui/icons";
import { orderPlaylistPicks, type PlaylistPick } from "@/domain/playlist-picker";
import { PLAYLIST_STAGE_LABEL } from "@/domain/playlist-stage";

const pickDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });

interface BandPlaylistPickerProps {
  open: boolean;
  onClose: () => void;
  /** 밴드의 플레이리스트. null 이면 목록을 읽지 못했다. */
  playlists: readonly PlaylistPick[] | null;
  /** 지금 보고 있는 플레이리스트. 링크 대신 체크로 선다. 밴드 홈에서는 null. */
  current: string | null;
}

/**
 * 아래 탭 「플레이리스트」가 여는 시트 (#110). 진행 중인 것이 먼저, 그다음 나머지이고 묶음마다 최근 것부터다.
 * 플레이리스트가 없는 밴드에는 만들기 버튼을 두지 않는다. 같은 일을 하는 ＋ 만들기 탭이 바로 아래에 있다.
 */
export default function BandPlaylistPicker({ open, onClose, playlists, current }: BandPlaylistPickerProps) {
  return (
    <Modal open={open} onClose={onClose} title="플레이리스트">
      {playlists === null ? (
        <EmptyState size="inline" description="플레이리스트 목록을 불러오지 못했어요. 밴드 홈에서 볼 수 있어요" />
      ) : playlists.length === 0 ? (
        <EmptyState size="inline" title="아직 플레이리스트가 없어요" description="아래 ＋ 만들기로 첫 플레이리스트를 만들어요" />
      ) : (
        // Each row sits in a wrapper: ListGroup draws its dividers on its children, and a link row bleeds 8px past the column.
        <ListGroup role="list">
          {orderPlaylistPicks(playlists).map((pick) =>
            pick.shareCode === current ? (
              <div key={pick.shareCode} role="listitem" aria-current="page">
                <ListRow leading={<PickGlyph />} trailing={<DoneIcon className="size-5 text-primary-fg" />}>
                  <PickLabel pick={pick} current />
                </ListRow>
              </div>
            ) : (
              <div key={pick.shareCode} role="listitem">
                <ListRowLink href={`/playlist/${pick.shareCode}`} onClick={onClose} leading={<PickGlyph />}>
                  <PickLabel pick={pick} current={false} />
                </ListRowLink>
              </div>
            ),
          )}
        </ListGroup>
      )}
    </Modal>
  );
}

/** A link row reads as one name, so a hidden comma makes a screen reader pause between its parts. */
function PickLabel({ pick, current }: { pick: PlaylistPick; current: boolean }) {
  return (
    <span className="block min-w-0 py-2">
      <span className={`block truncate text-body text-text ${current ? "font-semibold" : ""}`}>{pick.title}</span>
      <span className="sr-only">,</span>{" "}
      <span className="mt-1 flex items-center gap-1.5 text-caption text-text-muted tabular-nums">
        <Badge tone="primary">{PLAYLIST_STAGE_LABEL[pick.stage]}</Badge>
        <span className="sr-only">,</span>{" "}
        <span>{pickDate.format(new Date(pick.createdAt))}</span>
      </span>
    </span>
  );
}

function PickGlyph() {
  return (
    <ListRowIcon className="text-text-muted">
      <SongIcon className="size-5" />
    </ListRowIcon>
  );
}
