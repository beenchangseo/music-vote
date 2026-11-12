/**
 * 화면에 붙은 막대가 붙어 있는 동안 자기 높이를 <html> 의 CSS 변수로 알린다.
 * globals.css 의 html scroll-padding 이 이 값을 써서, scrollIntoView 나 포커스로 끌어온 내용이 막대 밑에 숨지 않는다.
 * 높이를 부르는 쪽에 숫자로 적어 두면 막대 내용이 바뀔 때마다 어긋난다.
 */
function measureHeight(name: string) {
  return (el: HTMLElement | null) => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  };
}

function clearHeight(name: string) {
  return () => {
    document.documentElement.style.removeProperty(name);
  };
}

function publishHeight(name: string) {
  const measure = measureHeight(name);
  const clear = clearHeight(name);
  return (el: HTMLElement | null) => {
    const stop = measure(el);
    if (!stop) return;
    return () => {
      stop();
      clear();
    };
  };
}

// ref 는 여기서 한 번만 만든다. 렌더마다 새 함수를 넘기면 React 가 매번 떼었다 다시 붙인다.
// 위에 붙는 막대는 한 화면에 하나라(합주의 ScreenToolbar, 편집 중인 셋리스트의 동작 줄) 한 변수를 같이 쓴다.
export const publishScreenToolbarHeight = publishHeight("--screen-toolbar-height");
export const publishTabBarHeight = publishHeight("--tab-bar-height");

// MiniPlayer 막대는 플레이어를 펼치면 내려가지만 그 높이는 곡이 있는 동안 남긴다. 지우면 body 가 비운 페이지 끝이 줄어
// 스크롤이 끌려 올라가고, 접은 뒤 마지막 곡이 막대 밑에 숨는다. 그래서 막대 ref 는 재기만 하고, 지우기는 MiniPlayer 가 곡이
// 사라질 때 한다.
export const measureMiniPlayerHeight = measureHeight("--mini-player-height");
export const clearMiniPlayerHeight = clearHeight("--mini-player-height");
