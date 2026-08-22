import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HTTP_STATUS,
  isCanonicalHttpStatusCode
} from "../src/constants/httpStatusContract.js";

const canonicalStatusCodes = [
  200,
  201,
  400,
  401,
  403,
  404,
  409,
  413,
  415,
  422,
  429,
  500,
  503
] as const;

test("Sprint 8 exposes one canonical HTTP status contract for supported server outcomes", () => {
  assert.deepEqual(
    Object.values(HTTP_STATUS).sort((left, right) => left - right),
    [...canonicalStatusCodes]
  );

  for (const statusCode of canonicalStatusCodes) {
    assert.equal(isCanonicalHttpStatusCode(statusCode), true);
  }
});

test("protocol and upstream status codes stay outside the contract until architecture requires them", () => {
  assert.equal(isCanonicalHttpStatusCode(101), false);
  assert.equal(isCanonicalHttpStatusCode(502), false);
  assert.equal(isCanonicalHttpStatusCode(504), false);
});

test("canonical symbolic names keep HTTP meanings explicit instead of scattering magic numbers", () => {
  assert.equal(HTTP_STATUS.OK, 200);
  assert.equal(HTTP_STATUS.CREATED, 201);
  assert.equal(HTTP_STATUS.BAD_REQUEST, 400);
  assert.equal(HTTP_STATUS.UNAUTHORIZED, 401);
  assert.equal(HTTP_STATUS.FORBIDDEN, 403);
  assert.equal(HTTP_STATUS.NOT_FOUND, 404);
  assert.equal(HTTP_STATUS.CONFLICT, 409);
  assert.equal(HTTP_STATUS.PAYLOAD_TOO_LARGE, 413);
  assert.equal(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, 415);
  assert.equal(HTTP_STATUS.UNPROCESSABLE_CONTENT, 422);
  assert.equal(HTTP_STATUS.TOO_MANY_REQUESTS, 429);
  assert.equal(HTTP_STATUS.INTERNAL_SERVER_ERROR, 500);
  assert.equal(HTTP_STATUS.SERVICE_UNAVAILABLE, 503);
});
