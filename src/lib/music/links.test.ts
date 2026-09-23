import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appleQueueFor, embedHeight, parseMusicLink } from "./links.ts";

const PL = "37i9dQZF1DXcBWIGoYBM5M";

describe("spotify links", () => {
  it("reads a playlist share link and drops the tracking query", () => {
    const link = parseMusicLink(`https://open.spotify.com/playlist/${PL}?si=abc123`);
    assert.deepEqual(link, {
      provider: "spotify",
      kind: "playlist",
      id: PL,
      embedUrl: `https://open.spotify.com/embed/playlist/${PL}`,
      openUrl: `https://open.spotify.com/playlist/${PL}`,
      uri: `spotify:playlist:${PL}`,
    });
  });

  it("reads album, track and artist links", () => {
    for (const kind of ["album", "track", "artist"] as const) {
      const link = parseMusicLink(`https://open.spotify.com/${kind}/${PL}`);
      assert.equal(link?.kind, kind);
      assert.equal(link?.embedUrl, `https://open.spotify.com/embed/${kind}/${PL}`);
    }
  });

  it("reads localised and embed links", () => {
    assert.equal(parseMusicLink(`https://open.spotify.com/intl-de/album/${PL}`)?.kind, "album");
    assert.equal(parseMusicLink(`https://open.spotify.com/embed/playlist/${PL}`)?.id, PL);
  });

  it("reads a Spotify URI", () => {
    assert.equal(parseMusicLink(`spotify:track:${PL}`)?.uri, `spotify:track:${PL}`);
  });

  it("trims pasted whitespace", () => {
    assert.equal(parseMusicLink(`  https://open.spotify.com/playlist/${PL}\n`)?.id, PL);
  });

  it("rejects ids of the wrong shape and unsupported kinds", () => {
    assert.equal(parseMusicLink("https://open.spotify.com/playlist/short"), null);
    assert.equal(parseMusicLink(`https://open.spotify.com/episode/${PL}`), null);
    assert.equal(parseMusicLink("spotify:playlist:not-an-id"), null);
  });
});

describe("apple music links", () => {
  it("reads a playlist link", () => {
    const link = parseMusicLink(
      "https://music.apple.com/gb/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
    );
    assert.deepEqual(link, {
      provider: "apple",
      kind: "playlist",
      id: "pl.f4d106fed2bd41149aaacabb233eb5eb",
      embedUrl:
        "https://embed.music.apple.com/gb/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
      openUrl:
        "https://music.apple.com/gb/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
      storefront: "gb",
    });
  });

  it("reads a shared user playlist id", () => {
    const link = parseMusicLink("https://music.apple.com/us/playlist/mine/pl.u-8aAVZAoFVlDZvV");
    assert.equal(link?.id, "pl.u-8aAVZAoFVlDZvV");
  });

  it("reads an album link with and without a slug", () => {
    assert.equal(parseMusicLink("https://music.apple.com/us/album/blue/1440857781")?.kind, "album");
    const bare = parseMusicLink("https://music.apple.com/us/album/1440857781");
    assert.equal(bare?.embedUrl, "https://embed.music.apple.com/us/album/1440857781");
  });

  it("treats an album link with ?i= as that one song", () => {
    const link = parseMusicLink("https://music.apple.com/us/album/blue/1440857781?i=1440857782");
    assert.equal(link?.kind, "track");
    assert.equal(link?.id, "1440857782");
    assert.equal(
      link?.embedUrl,
      "https://embed.music.apple.com/us/album/blue/1440857781?i=1440857782",
    );
  });

  it("maps song links to tracks", () => {
    assert.equal(parseMusicLink("https://music.apple.com/us/song/blue/1440857782")?.kind, "track");
  });

  it("rejects malformed apple links", () => {
    assert.equal(parseMusicLink("https://music.apple.com/usa/album/x/1440857781"), null);
    assert.equal(parseMusicLink("https://music.apple.com/us/album/x/not-a-number"), null);
    assert.equal(parseMusicLink("https://music.apple.com/us/playlist/x/1440857781"), null);
    assert.equal(parseMusicLink("https://music.apple.com/us/album/x/1440857781?i=abc"), null);
    assert.equal(parseMusicLink("https://music.apple.com/us/album/a/b/c/1440857781"), null);
  });
});

describe("untrusted input", () => {
  it("never produces an embed for a host it does not own", () => {
    for (const bad of [
      `https://evil.example/playlist/${PL}`,
      `https://open.spotify.com.evil.example/playlist/${PL}`,
      `http://open.spotify.com/playlist/${PL}`,
      `javascript:alert(1)`,
      `https://music.apple.com.evil.example/us/album/x/1440857781`,
      "",
      "not a link",
    ]) {
      assert.equal(parseMusicLink(bad), null, bad);
    }
  });

  it("never carries a hostile slug into the embed url", () => {
    const link = parseMusicLink("https://music.apple.com/us/album/%22%3E%3Cscript%3E/1440857781");
    // URL parsing leaves it percent-encoded, so it can only ever be inert text.
    assert.ok(link);
    assert.ok(!link.embedUrl.includes("<"));
    assert.ok(!link.embedUrl.includes('"'));
  });

  it("refuses absurdly long input", () => {
    assert.equal(
      parseMusicLink(`https://open.spotify.com/playlist/${PL}?x=${"a".repeat(3000)}`),
      null,
    );
  });
});

describe("embed sizes", () => {
  it("uses the compact spotify player and the apple list player", () => {
    assert.equal(embedHeight(parseMusicLink(`spotify:playlist:${PL}`)!), 152);
    assert.equal(embedHeight(parseMusicLink("https://music.apple.com/us/song/x/1")!), 175);
    assert.equal(embedHeight(parseMusicLink("https://music.apple.com/us/album/x/1")!), 450);
  });
});

describe("apple queue", () => {
  it("maps each playable kind to the MusicKit queue option", () => {
    const q = (u: string) => appleQueueFor(parseMusicLink(u)!);
    assert.deepEqual(q("https://music.apple.com/us/playlist/x/pl.u-8aAVZAoFVlDZvV"), {
      playlist: "pl.u-8aAVZAoFVlDZvV",
    });
    assert.deepEqual(q("https://music.apple.com/us/album/x/1440857781"), { album: "1440857781" });
    assert.deepEqual(q("https://music.apple.com/us/album/x/1440857781?i=1440857782"), {
      song: "1440857782",
    });
  });

  it("has no queue for artists or spotify links", () => {
    assert.equal(appleQueueFor(parseMusicLink("https://music.apple.com/us/artist/x/12345")!), null);
    assert.equal(appleQueueFor(parseMusicLink(`spotify:playlist:${PL}`)!), null);
  });
});
