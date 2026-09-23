import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  authorizeUrl,
  codeChallenge,
  codeExchangeBody,
  needsRefresh,
  randomString,
  readTokenResponse,
  refreshBody,
  SPOTIFY_SCOPES,
} from "./pkce.ts";

describe("pkce", () => {
  it("matches the RFC 7636 appendix B test vector", async () => {
    assert.equal(
      await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("agrees with an independent SHA-256 for random verifiers", async () => {
    for (let i = 0; i < 20; i++) {
      const v = randomString(64);
      assert.equal(await codeChallenge(v), createHash("sha256").update(v).digest("base64url"));
    }
  });

  it("makes verifiers of the requested length from the unreserved alphabet", () => {
    for (const n of [43, 64, 128]) {
      const v = randomString(n);
      assert.equal(v.length, n);
      assert.match(v, /^[A-Za-z0-9]+$/);
    }
    assert.notEqual(randomString(), randomString());
  });

  it("builds the authorize url Spotify expects", () => {
    const url = new URL(
      authorizeUrl({
        clientId: "client-1",
        redirectUri: "https://atlas.example/",
        challenge: "chal",
        state: "st8",
      }),
    );
    assert.equal(url.origin + url.pathname, "https://accounts.spotify.com/authorize");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      response_type: "code",
      client_id: "client-1",
      scope: SPOTIFY_SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge: "chal",
      redirect_uri: "https://atlas.example/",
      state: "st8",
    });
  });

  it("builds the code exchange and refresh bodies", () => {
    assert.deepEqual(
      Object.fromEntries(
        codeExchangeBody({ clientId: "c", code: "k", redirectUri: "https://s/", verifier: "v" }),
      ),
      {
        client_id: "c",
        grant_type: "authorization_code",
        code: "k",
        redirect_uri: "https://s/",
        code_verifier: "v",
      },
    );
    assert.deepEqual(Object.fromEntries(refreshBody({ clientId: "c", refreshToken: "r" })), {
      client_id: "c",
      grant_type: "refresh_token",
      refresh_token: "r",
    });
  });
});

describe("tokens", () => {
  it("reads a token response into an absolute expiry", () => {
    assert.deepEqual(
      readTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 3600 }, 1_000),
      { accessToken: "a", refreshToken: "r", expiresAt: 1_000 + 3_600_000 },
    );
  });

  it("keeps the old refresh token when a refresh does not rotate it", () => {
    assert.equal(
      readTokenResponse({ access_token: "a2", expires_in: 60 }, 0, "r1")?.refreshToken,
      "r1",
    );
  });

  it("rejects an error body or a response with no refresh token at all", () => {
    assert.equal(readTokenResponse({ error: "invalid_grant" }, 0), null);
    assert.equal(readTokenResponse({ access_token: "a", expires_in: 60 }, 0), null);
    assert.equal(readTokenResponse(null, 0), null);
  });

  it("refreshes a minute before expiry, not after", () => {
    const t = { accessToken: "a", refreshToken: "r", expiresAt: 100_000 };
    assert.equal(needsRefresh(t, 30_000), false);
    assert.equal(needsRefresh(t, 40_000), true);
    assert.equal(needsRefresh(t, 200_000), true);
  });
});
