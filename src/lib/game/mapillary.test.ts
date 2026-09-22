import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mapillaryImage, mapillaryImageUrl, mapillaryNearby } from "./mapillary.ts";

const realFetch = globalThis.fetch;

function mockFetch(payload: unknown, ok = true) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return {
      ok,
      json: async () => payload,
    } as Response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const sample = {
  id: "123",
  is_pano: true,
  compass_angle: 210.5,
  thumb_2048_url: "https://cdn.mapillary.com/123.jpg",
  captured_at: 1_700_000_000_000,
  quality_score: 0.9,
  computed_geometry: { type: "Point", coordinates: [4.89, 52.37] },
};

describe("mapillary provider", () => {
  it("parses an image entity with coordinates and pano flag", async () => {
    const calls = mockFetch(sample);
    const image = await mapillaryImage("123", "TOKEN");
    assert.ok(image);
    assert.equal(image.id, "123");
    assert.equal(image.isPano, true);
    assert.equal(image.latitude, 52.37);
    assert.equal(image.longitude, 4.89);
    assert.equal(image.compassAngle, 210.5);
    assert.match(calls[0], /graph\.mapillary\.com\/123\?/);
    assert.match(calls[0], /access_token=TOKEN/);
  });

  it("returns null when no token is configured", async () => {
    mockFetch(sample);
    assert.equal(await mapillaryImage("123", undefined), null);
  });

  it("returns null on a failed request", async () => {
    mockFetch({ error: "nope" }, false);
    assert.equal(await mapillaryImage("123", "TOKEN"), null);
  });

  it("sorts nearby images by pano, quality and recency", async () => {
    mockFetch({
      data: [
        { ...sample, id: "a", is_pano: false, quality_score: 0.95, captured_at: 10 },
        { ...sample, id: "b", is_pano: true, quality_score: 0.5, captured_at: 5 },
        { ...sample, id: "c", is_pano: true, quality_score: 0.8, captured_at: 1 },
      ],
    });
    const images = await mapillaryNearby(52.37, 4.89, { token: "TOKEN" });
    assert.deepEqual(
      images.map((i) => i.id),
      ["c", "b", "a"],
    );
  });

  it("clamps the radius to the API maximum of 50 m", async () => {
    const calls = mockFetch({ data: [] });
    await mapillaryNearby(52.37, 4.89, { token: "TOKEN", radius: 500 });
    assert.match(calls[0], /radius=50/);
  });

  it("resolves the display URL", async () => {
    mockFetch(sample);
    assert.equal(await mapillaryImageUrl("123", "TOKEN"), "https://cdn.mapillary.com/123.jpg");
  });

  it("asks for every thumbnail size and prefers the widest that came back", async () => {
    const calls = mockFetch({
      ...sample,
      thumb_original_url: "https://cdn.mapillary.com/123-original.jpg",
      thumb_1024_url: "https://cdn.mapillary.com/123-1024.jpg",
    });
    const image = await mapillaryImage("123", "TOKEN");
    assert.match(calls[0], /thumb_original_url/);
    assert.match(calls[0], /thumb_1024_url/);
    assert.equal(image?.thumbUrl, "https://cdn.mapillary.com/123-original.jpg");
    assert.deepEqual(image?.thumbUrls, [
      "https://cdn.mapillary.com/123-original.jpg",
      "https://cdn.mapillary.com/123.jpg",
      "https://cdn.mapillary.com/123-1024.jpg",
    ]);
  });

  it("falls down the ladder when the wider sizes are missing", async () => {
    mockFetch({ ...sample, thumb_2048_url: undefined, thumb_1024_url: "https://cdn/small.jpg" });
    assert.equal(await mapillaryImageUrl("123", "TOKEN"), "https://cdn/small.jpg");
  });
});
