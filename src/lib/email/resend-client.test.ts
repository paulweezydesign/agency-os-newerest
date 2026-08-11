import { describe, expect, it } from "vitest";
import {
  createInMemoryResendClient,
  ResendClientError,
} from "./resend-client";

describe("createInMemoryResendClient", () => {
  it("records sent emails and returns ids", async () => {
    const resend = createInMemoryResendClient();

    const result = await resend.sendEmail({
      to: "lead@example.com",
      subject: "Welcome",
      body: "Hello",
      clientId: "client-1",
    });

    expect(result.id).toBe("resend_1");
    expect(resend.sendCount()).toBe(1);
    expect(resend.sent[0]?.to).toBe("lead@example.com");
  });

  it("rejects invalid recipients", async () => {
    const resend = createInMemoryResendClient();

    await expect(
      resend.sendEmail({
        to: "not-an-email",
        subject: "x",
        body: "y",
      }),
    ).rejects.toBeInstanceOf(ResendClientError);
  });
});
