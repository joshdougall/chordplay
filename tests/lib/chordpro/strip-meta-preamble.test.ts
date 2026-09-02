import { describe, it, expect } from "vitest";
import { stripMetaPreamble } from "@/lib/chordpro/strip-meta";

const CZARSKI = `SONG:   LAST NIGHT
ARTIST: MORGAN WALLEN
VIDEO:  https://youtu.be/TBkpoTbJAsI
TUNING: STANDARD
TAB BY: DON CZARSKI
EMAIL:  GUITARZAN7@HOTMAIL.COM

[Intro]
C  G  Am  F

[Verse 1]
I spent a little too much time last night`;

describe("stripMetaPreamble", () => {
  it("removes a LABEL: VALUE credit block even though its first line is unrecognised", () => {
    const out = stripMetaPreamble(CZARSKI);
    expect(out).not.toMatch(/GUITARZAN7/);
    expect(out).not.toMatch(/DON CZARSKI/);
    expect(out).not.toMatch(/^SONG:/m);
    expect(out).not.toMatch(/^ARTIST:/m);
    expect(out).not.toMatch(/youtu\.be/);
  });

  it("keeps the music that follows the block", () => {
    const out = stripMetaPreamble(CZARSKI);
    expect(out).toMatch(/\[Intro\]/);
    expect(out).toMatch(/C {2}G {2}Am {2}F/);
    expect(out).toMatch(/I spent a little too much time last night/);
  });

  it("NEVER removes a capo line — it changes what your hands do", () => {
    const src = "CAPO: 1st FRET\n\n[Intro]\nC G\n\nlyric here";
    expect(stripMetaPreamble(src)).toMatch(/CAPO: 1st FRET/);
  });

  it("keeps a prose capo line too", () => {
    const src = "Capo 2nd fret.\n\n[Verse 1]\nG\nsome words";
    expect(stripMetaPreamble(src)).toMatch(/Capo 2nd fret\./);
  });

  it("does not eat a section header that starts the song", () => {
    const src = "Tabbed by: someone\n\n[Intro]\nDm C\n\n[Verse 1]\nwords here";
    const out = stripMetaPreamble(src);
    expect(out).toMatch(/\[Intro\]/);
    expect(out).toMatch(/Dm C/);
    expect(out).not.toMatch(/Tabbed by/);
  });

  it("removes a restated title block", () => {
    const src = "SNOWSHOES\nAs recorded by Caamp\n(From the 2022 Album LAVENDER DAYS)\n\n[Intro]\nDmaj7 A\n\nlyric";
    const out = stripMetaPreamble(src);
    expect(out).not.toMatch(/As recorded by/);
    expect(out).not.toMatch(/LAVENDER DAYS/);
    expect(out).toMatch(/\[Intro\]/);
  });

  it("still keeps directives", () => {
    const src = "{title: X}\n{artist: Y}\n{key: G}\n\nTAB BY: someone\n\n[Verse]\nwords";
    const out = stripMetaPreamble(src);
    expect(out).toMatch(/\{title: X\}/);
    expect(out).toMatch(/\{key: G\}/);
    expect(out).not.toMatch(/TAB BY/);
  });

  it("leaves an already-clean sheet untouched apart from blank padding", () => {
    const src = "{title: X}\n\n[Verse 1]\nG\nfirst line of the song";
    expect(stripMetaPreamble(src)).toMatch(/first line of the song/);
    expect(stripMetaPreamble(src)).toMatch(/\[Verse 1\]/);
  });

  it("never strips content after the song has started", () => {
    const src = "[Verse 1]\nwords\n\nEMAIL: someone@example.com\n\nmore words";
    const out = stripMetaPreamble(src);
    expect(out).toMatch(/EMAIL: someone@example\.com/);
  });
});
