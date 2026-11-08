"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type Modifier,
  type Over,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import IconButton from "../ui/IconButton";
import { BlockCard } from "./BlockCards";
import { BLOCK_TONES } from "./block-tones";
import { setlistBlockTitle, setlistInsertSlots, type SetlistBlock, type SetlistInsertSlot } from "@/domain/setlist";
import type { SetlistItem, SongWithScore } from "@/domain/types";

type Block = SetlistBlock<SongWithScore>;
export type InsertTarget = SetlistInsertSlot<SongWithScore>;

interface Props {
  blocks: Block[];
  totalRuntime: number;
  saving: boolean;
  /** 방금 넣은 블록. 그 손잡이가 포커스를 받는다. */
  focusItemId: string | null;
  onReorder: (activeId: string, overId: string) => void;
  onOpenSlot: (target: InsertTarget) => void;
  onEdit: (item: SetlistItem) => void;
  onRemove: (itemId: string) => void;
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const titleOf = (entity: Active | Over) => String(entity.data.current?.title ?? "블록");
const placeOf = (entity: Active | Over) => Number(entity.data.current?.sortable?.index ?? 0) + 1;

const pickedUp = (active: Active) => `「${titleOf(active)}」 블록을 들었어요. 지금 ${placeOf(active)}번째예요.`;

const announcements: Announcements = {
  onDragStart: ({ active }) => pickedUp(active),
  // The first "over" is the block's own slot and lands in the same tick as the start, replacing it. Keep the start line.
  onDragOver: ({ active, over }) => (!over ? "놓을 자리를 벗어났어요." : over.id === active.id ? pickedUp(active) : `${placeOf(over)}번째 자리예요.`),
  onDragEnd: ({ active, over }) =>
    over ? `「${titleOf(active)}」 블록을 ${placeOf(over)}번째에 놓았어요.` : `「${titleOf(active)}」 블록을 제자리에 두었어요.`,
  onDragCancel: ({ active }) => `옮기기를 취소했어요. 「${titleOf(active)}」 블록은 제자리예요.`,
};

const screenReaderInstructions = {
  draggable: "스페이스나 엔터로 블록을 들고, 위아래 화살표로 옮긴 뒤 다시 스페이스나 엔터로 놓아요. Esc 를 누르면 취소해요.",
};

/** 편집 모드의 셋리스트. 오른쪽 레일 칸의 ≡ 로 끌어 순서를 바꾸고, 카드 사이 (+) 로 그 자리에 넣는다. */
export default function SetlistEditList({ blocks, totalRuntime, saving, focusItemId, onReorder, onOpenSlot, onEdit, onRemove }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Only the handle starts a drag and it is touch-action: none, so a touch elsewhere still scrolls and no long press is needed.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const slots = setlistInsertSlots(blocks, totalRuntime);
  const activeBlock = activeId ? blocks.find((block) => block.item.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null);
        if (over) onReorder(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={blocks.map((block) => block.item.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label="셋리스트" aria-busy={saving || undefined} className={saving ? "opacity-70" : undefined}>
          {blocks.map((block, index) => (
            <SortableBlockRow
              key={block.item.id}
              block={block}
              insert={slots[index]}
              dragging={activeId !== null}
              autoFocus={block.item.id === focusItemId}
              onOpenSlot={onOpenSlot}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
      <InsertRow target={slots[slots.length - 1]} hidden={activeId !== null} onOpen={onOpenSlot} />
      <DragOverlay>
        {activeBlock && (
          <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_3.5rem]">
            <div className="flex flex-col justify-center py-1">
              <div className={`${BLOCK_TONES[activeBlock.kind].radius} shadow-float`}>
                <BlockCard block={activeBlock} editing onEdit={() => undefined} onRemove={() => undefined} />
              </div>
            </div>
            <span className="flex items-center justify-center text-text">
              <GripIcon />
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface RowProps {
  block: Block;
  insert: InsertTarget;
  dragging: boolean;
  autoFocus: boolean;
  onOpenSlot: (target: InsertTarget) => void;
  onEdit: (item: SetlistItem) => void;
  onRemove: (itemId: string) => void;
}

function SortableBlockRow({ block, insert, dragging, autoFocus, onOpenSlot, onEdit, onRemove }: RowProps) {
  const title = setlistBlockTitle(block);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: block.item.id,
    data: { title },
    attributes: { roleDescription: "손잡이" },
  });
  const handleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (autoFocus) handleRef.current?.focus();
  }, [autoFocus]);

  return (
    <li>
      <InsertRow target={insert} hidden={dragging} onOpen={onOpenSlot} />
      <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="grid grid-cols-[minmax(0,1fr)_3.5rem]">
        <div className="flex flex-col justify-center py-1">
          {/* The lifted card rides in the DragOverlay; its slot keeps the size as a dashed outline. An inset outline takes no
              room, so the slot is exactly the card it stands for and the rows below do not move. */}
          <div className={isDragging ? `${BLOCK_TONES[block.kind].radius} outline-1 -outline-offset-1 outline-dashed outline-border-strong` : undefined}>
            <div className={isDragging ? "invisible" : undefined}>
              <BlockCard block={block} editing onEdit={() => onEdit(block.item)} onRemove={() => onRemove(block.item.id)} />
            </div>
          </div>
        </div>
        <span className="flex items-center justify-center print:hidden">
          <IconButton
            ref={(node) => {
              setActivatorNodeRef(node);
              handleRef.current = node;
            }}
            bare
            {...attributes}
            {...listeners}
            aria-label={`「${title}」 끌어서 순서 바꾸기`}
            // Faded, not hidden: a keyboard drag keeps focus on this handle while the overlay draws the lifted one.
            className={`cursor-grab touch-none select-none active:cursor-grabbing ${isDragging ? "opacity-0" : ""}`}
          >
            <GripIcon />
          </IconButton>
        </span>
      </div>
    </li>
  );
}

function InsertRow({ target, hidden, onOpen }: { target: InsertTarget; hidden: boolean; onOpen: (target: InsertTarget) => void }) {
  const label = target.after
    ? target.slot.before === null
      ? "맨 끝에 넣기"
      : `「${setlistBlockTitle(target.after)}」 다음에 넣기`
    : "맨 앞에 넣기";
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_3.5rem] print:hidden ${hidden ? "invisible" : ""}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="flex-1 border-t border-dashed border-border-strong" />
        <IconButton bare aria-label={label} onClick={() => onOpen(target)}>
          <svg className="size-7" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v8M8 12h8" />
          </svg>
        </IconButton>
        <span aria-hidden className="flex-1 border-t border-dashed border-border-strong" />
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 8h14M5 12h14M5 16h14" />
    </svg>
  );
}
