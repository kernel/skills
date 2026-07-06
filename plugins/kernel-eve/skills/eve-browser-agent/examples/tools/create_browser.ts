import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

export default defineTool({
  description:
    "Create a Kernel cloud browser and return its session id and live view URL. Reuse one session across turns; only create another when you need a fresh browser. Turn on stealth for sites with bot detection, pass a proxy for IP/geo control, and pass a profile name to reuse saved logins.",
  inputSchema: z.object({
    stealth: z.boolean().optional().describe("Reduce anti-bot detection. Recommended for real sites."),
    proxy_id: z.string().optional().describe("Route traffic through a configured Kernel proxy."),
    profile_name: z.string().optional().describe("Load a pre-created profile so saved logins are available."),
    start_url: z.string().url().optional().describe("URL to open when the browser starts."),
    timeout_seconds: z
      .number()
      .int()
      .optional()
      .describe("Inactivity timeout before the browser is destroyed. Default 60; raise for long tasks."),
  }),
  async execute({ stealth, proxy_id, profile_name, start_url, timeout_seconds }) {
    const browser = await kernel.browsers.create({
      stealth,
      proxy_id,
      start_url,
      timeout_seconds,
      profile: profile_name ? { name: profile_name } : undefined,
    });
    return {
      session_id: browser.session_id,
      live_view_url: browser.browser_live_view_url,
    };
  },
});
