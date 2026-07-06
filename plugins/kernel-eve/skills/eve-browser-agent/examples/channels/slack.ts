import { slackChannel } from "eve/channels/slack";
import { connectSlackCredentials } from "@vercel/connect/eve";

// Credentials run through Vercel Connect — no SLACK_BOT_TOKEN or signing secret
// to manage. Replace "slack/my-agent" with your Connect client UID.
// Setup: https://vercel.com/docs/eve (Channels > Slack)
export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  // Inject earlier thread replies on each mention, only what's new since the last agent reply.
  threadContext: { since: "last-agent-reply" },
});
