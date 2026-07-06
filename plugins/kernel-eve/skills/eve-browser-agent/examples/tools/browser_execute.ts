import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

export default defineTool({
  description:
    "Run Playwright/TypeScript against a live Kernel browser. `page`, `context`, and `browser` are in scope, and the code runs inside the browser's VM. End with a `return` to get data back. Binary data (screenshots, downloads) does not serialize through this tool — use dedicated Kernel APIs for those.",
  inputSchema: z.object({
    session_id: z.string().describe("Session id from create_browser."),
    code: z
      .string()
      .describe("Playwright body. Example: await page.goto('https://example.com'); return await page.title();"),
    timeout_sec: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .describe("Max execution time in seconds. Default 60."),
  }),
  async execute({ session_id, code, timeout_sec }) {
    const res = await kernel.browsers.playwright.execute(session_id, { code, timeout_sec });
    if (!res.success) {
      throw new Error(res.error ?? res.stderr ?? "Playwright execution failed");
    }
    return { result: res.result, stdout: res.stdout };
  },
});
