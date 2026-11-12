"use client";

import { useState } from "react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import ListRow, { ListGroup, ListRowIcon, ListRowLink } from "../ui/ListRow";
import { ChevronIcon, DoneIcon, GuitarIcon, HomeIcon } from "../ui/icons";

/** What the switcher sheet draws of a band. No account ids reach the browser (docs/adr/0011). */
export interface SwitchBand {
  id: string;
  name: string;
}

interface BandSwitcherProps {
  current: SwitchBand;
  /** 내 밴드, 서버가 준 순서 그대로. 지금 밴드도 들어 있다. */
  bands: SwitchBand[];
}

/**
 * 밴드 홈 왼쪽 위 "{밴드} ▾". 누르면 내 밴드 시트가 열린다. 지금 밴드에는 체크, 다른 밴드는 그 밴드 홈으로,
 * 묶음 아래 따로 「전체 홈」이 앱 홈(/)으로 간다. 전에 이 자리에 있던 ‹ 는 "뒤로"로 읽혀서 바꿨다(#106).
 */
export default function BandSwitcher({ current, bands }: BandSwitcherProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tonal" pill onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${current.name} 밴드 바꾸기`}>
        <span className="truncate">{current.name}</span>
        <ChevronIcon direction="down" className="size-4 shrink-0" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="내 밴드">
        {/* Each row sits in a wrapper: ListGroup draws its dividers on its children, and a link row bleeds 8px past the column. */}
        <ListGroup>
          {bands.map((band) => (
            <div key={band.id}>
              {band.id === current.id ? (
                <ListRow aria-current="true" leading={<BandGlyph />} trailing={<DoneIcon className="size-5 text-primary-fg" />}>
                  <span className="block truncate text-body font-semibold text-text">{band.name}</span>
                </ListRow>
              ) : (
                <ListRowLink href={`/band/${band.id}`} leading={<BandGlyph />}>
                  <span className="block truncate text-body text-text">{band.name}</span>
                </ListRowLink>
              )}
            </div>
          ))}
        </ListGroup>
        <ListGroup className="mt-3">
          <ListRowLink
            href="/"
            leading={
              <ListRowIcon className="text-text-muted">
                <HomeIcon className="size-5" />
              </ListRowIcon>
            }
          >
            <span className="block text-body text-text">전체 홈</span>
          </ListRowLink>
        </ListGroup>
      </Modal>
    </>
  );
}

function BandGlyph() {
  return (
    <ListRowIcon className="text-text-muted">
      <GuitarIcon className="size-5" />
    </ListRowIcon>
  );
}
