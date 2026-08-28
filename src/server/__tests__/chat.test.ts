import { describe, expect, it } from "vitest";
import { validateMessagePayload, userCanSendInMatch, MESSAGE_LIMIT } from "@/server/chat";

describe("chat validation", () => {
  it("message should belong to match participant", () => {
    expect(userCanSendInMatch("u1", { userAId: "u1", userBId: "u2", status: "ACTIVE" })).toBe(true);
    expect(userCanSendInMatch("u3", { userAId: "u1", userBId: "u2", status: "ACTIVE" })).toBe(false);
  });

  it("cannot send message to ended/foreign match", () => {
    expect(userCanSendInMatch("u1", { userAId: "u1", userBId: "u2", status: "ENDED" })).toBe(false);
    expect(userCanSendInMatch("u1", null)).toBe(false);
  });

  it("cannot send empty message", () => {
    expect(validateMessagePayload("   ").ok).toBe(false);
  });

  it("message length limit works", () => {
    const longText = "a".repeat(MESSAGE_LIMIT + 1);
    expect(validateMessagePayload(longText).ok).toBe(false);
  });
});
