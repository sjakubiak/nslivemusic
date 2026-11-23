import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is rendered on request from the bundled events, so no cache store is needed.
export default defineCloudflareConfig({});
