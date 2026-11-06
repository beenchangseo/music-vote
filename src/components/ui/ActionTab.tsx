import { Children, Fragment, type ButtonHTMLAttributes, type ReactNode } from "react";

const tabLook =
  "inline-flex h-control-md min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap px-1 text-sm font-semibold " +
  "transition-colors max-[359px]:text-caption [&_svg]:size-4.5 [&_svg]:shrink-0";

type ActionTabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  icon: ReactNode;
  /** 켜진 상태(셋리스트에 있음). 보라 글자로 칠한다. */
  selected?: boolean;
  children: ReactNode;
};

/**
 * 곡 행 아래 탭 (디자인 E1). 바탕 없이 아이콘 + 글자, 44px. 글자 폭은 지키고 남는 폭을 나눠 가진다.
 * 360px 아래에서는 글자가 12px 가 되어 "셋리스트에 추가" 가 320px 에서도 한 줄이다. 아이콘 크기는 탭이 정한다.
 * onClick 이 없으면 상태만 보이는 글자다 (셋리스트를 고칠 수 없는 참여자의 "셋리스트에 있음").
 */
export function ActionTab({ icon, selected = false, onClick, type = "button", children, ...rest }: ActionTabProps) {
  const tone = selected ? "text-primary-fg" : "text-text";
  if (!onClick) {
    return (
      <span className={`${tabLook} ${tone}`}>
        {icon}
        {children}
      </span>
    );
  }
  return (
    <button type={type} onClick={onClick} className={`${tabLook} ${tone} ${selected ? "hover:text-on-primary-tint" : "hover:text-primary-fg"}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** ActionTab 줄. 위에 한 줄을 긋고 칸 사이에 짧은 세로줄을 넣는다. 맨 끝에 IconButton(⋯)을 둘 수 있다. */
export function ActionTabBar({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="flex items-center border-t border-surface-hover">
      {Children.toArray(children).map((child, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden className="h-5 w-px shrink-0 bg-surface-hover" />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}
