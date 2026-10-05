/** 아바타 글자: 한글은 이름 첫 글자, 영문은 첫 글자 대문자. 빈 이름은 "?". */
export function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}
