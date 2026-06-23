import { Inngest } from "inngest";

const signingKey = typeof process !== "undefined" ? process.env.INNGEST_SIGNING_KEY : undefined;
const eventKey = typeof process !== "undefined" ? process.env.INNGEST_EVENT_KEY : undefined;

export const inngest = new Inngest({
  id: "mybrainpadi",
  signingKey,
  eventKey,
});
