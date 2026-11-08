// Firefox gained Intl.Segmenter in 125 while Next 16 supports 111+. Without it, code points stand in for graphemes and
// the last run of non-spaces for the last word, so an import here never throws.
const segmenter = (granularity: "grapheme" | "word") =>
  typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity }) : null;
const graphemeSegmenter = segmenter("grapheme");
const wordSegmenter = segmenter("word");

/** 보이는 글자(grapheme) 단위로 나눈다. 이모지 가족·국기를 가르지 않는다. */
export function graphemes(text: string): string[] {
  return graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text), (s) => s.segment) : Array.from(text);
}

/** 마지막 단어와 그 뒤에 붙은 문장부호("Version)"). 단어가 없으면 빈 문자열이다. */
export function lastWord(text: string): string {
  if (!wordSegmenter) return /\S+\s*$/u.exec(text)?.[0] ?? "";
  const segments = Array.from(wordSegmenter.segment(text));
  const index = segments.findLastIndex((s) => s.isWordLike);
  return index < 0 ? "" : segments.slice(index).map((s) => s.segment).join("");
}
