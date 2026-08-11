export type ResendEmail = {
  to: string;
  subject: string;
  body: string;
  clientId?: string;
};

export type ResendClient = {
  sendEmail: (email: ResendEmail) => Promise<{ id: string }>;
};

export class ResendClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendClientError";
  }
}

export type InMemoryResendClient = ResendClient & {
  sent: ResendEmail[];
  sendCount: () => number;
  clear: () => void;
};

export const createInMemoryResendClient = (): InMemoryResendClient => {
  const sent: ResendEmail[] = [];
  let seq = 0;

  return {
    sent,
    sendCount: () => sent.length,
    clear: () => {
      sent.length = 0;
    },
    sendEmail: async (email) => {
      if (!email.to.includes("@")) {
        throw new ResendClientError(`Invalid recipient: ${email.to}`);
      }

      sent.push(email);
      seq += 1;
      return { id: `resend_${seq}` };
    },
  };
};
