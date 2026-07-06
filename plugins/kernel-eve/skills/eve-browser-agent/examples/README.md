# Example: a Kernel browser agent on eve

A minimal, runnable [Vercel eve](https://vercel.com/eve) agent that browses the web through a [Kernel](https://www.kernel.sh) cloud browser. This tree mirrors an eve `agent/` directory — copy the files into your own agent.

```
agent/
  agent.ts                 # model config
  instructions.md          # the browser-agent system prompt
  tools/
    create_browser.ts      # create a Kernel browser -> { session_id, live_view_url }
    browser_execute.ts     # run Playwright in the browser's VM (the control surface)
    release_browser.ts     # delete the session when done
  channels/
    slack.ts               # the working channel (HITL prompts become Slack buttons)
```

## Setup

```bash
npx eve@latest init my-browser-agent
cd my-browser-agent
npm install @onkernel/sdk
export KERNEL_API_KEY=<api-key>   # from https://www.kernel.sh
```

Copy `agent.ts`, `instructions.md`, and `tools/` into your project's `agent/` directory.

## Run it on the default HTTP channel (zero config)

eve's HTTP channel is on by default — no channel file needed.

```bash
npm run dev

curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Go to https://news.ycombinator.com and return the top 5 story titles."}'
```

The agent will `create_browser`, drive it with `browser_execute`, and return the titles.

## Add the Slack channel

`channels/slack.ts` is the working channel. Credentials run through Vercel Connect, so there's no bot token or signing secret in your code, and human-in-the-loop prompts (a login wall, the live view link) render as Slack buttons.

```bash
npm install -g vercel@latest && export FF_CONNECT_ENABLED=1
vercel connect create slack --triggers
vercel connect detach <uid> --yes
vercel connect attach <uid> --triggers --trigger-path /eve/v1/slack --yes

npm install @vercel/connect
# copy channels/slack.ts into agent/channels/ and set your Connect UID
VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1 vercel deploy --prod
```

Then `@mention` the agent in Slack: *"log into example.com and download last month's invoice."* When it needs you, it posts the live view link and waits.
