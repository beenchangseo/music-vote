/**
 * 화면에 붙은 막대가 붙어 있는 동안 자기 높이를 <html> 의 CSS 변수로 알린다.
 * globals.css 의 html scroll-padding 이 이 값을 써서, scrollIntoView 나 포커스로 끌어온 내용이 막대 밑에 숨지 않는다.
 * 높이를 부르는 쪽에 숫자로 적어 두면 막대 내용이 바뀔 때마다 어긋난다.
 */
function publishHeight(name: string) {
  return (el: HTMLElement | null) => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => root.setProperty(name, `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty(name);
    };
  };
}

// ref 는 여기서 한 번만 만든다. 렌더마다 새 함수를 넘기면 React 가 매번 떼었다 다시 붙인다.
// 위에 붙는 막대는 한 화면에 하나라(합주의 ScreenToolbar, 편집 중인 셋리스트의 동작 줄) 한 변수를 같이 쓴다.
export const publishScreenToolbarHeight = publishHeight("--screen-toolbar-height");
export const publishTabBarHeight = publishHeight("--tab-bar-height");
export const publishMiniPlayerHeight = publishHeight("--mini-player-height");
