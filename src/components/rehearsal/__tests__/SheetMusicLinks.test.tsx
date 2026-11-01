// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SheetMusicLinks from "../SheetMusicLinks";

afterEach(cleanup);

const searched = () => decodeURIComponent(screen.getByRole("link", { name: /Chordify/ }).getAttribute("href")!.split("/search/")[1]);

describe("SheetMusicLinks", () => {
  it.each([
    ["DAY6(데이식스)- 예뻤어 [가사/Lyrics]", "DAY6(데이식스)", "DAY6(데이식스) 예뻤어"],
    ["버스커 버스커 (Busker Busker) - 벚꽃 엔딩 (Cherry Blossom Ending) [MV]", "Stone Music Entertainment", "버스커 버스커 (Busker Busker) 벚꽃 엔딩 (Cherry Blossom Ending)"],
    ["Creep", "Radiohead - Topic", "Radiohead Creep"],
    ["낭만고양이", "kwon.orca.archive", "낭만고양이"],
  ])("searches %s by artist and song name without the video's tags", (title, artist, query) => {
    render(<SheetMusicLinks title={title} artist={artist} />);

    expect(searched()).toBe(query);
  });
});
