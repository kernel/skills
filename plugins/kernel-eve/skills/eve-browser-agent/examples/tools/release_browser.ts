import { defineTool } from "eve/tools";
import { z } from "zod";
import { Kernel } from "@onkernel/sdk";

const kernel = new Kernel();

export default defineTool({
  description:
    "Delete a Kernel browser session when the task is done, freeing the resource. Skip this only if you intend to resume the same session in a later turn.",
  inputSchema: z.object({
    session_id: z.string().describe("Session id from create_browser."),
  }),
  async execute({ session_id }) {
    await kernel.browsers.deleteByID(session_id);
    return { released: session_id };
  },
});
