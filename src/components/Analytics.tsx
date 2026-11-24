/**
 * Cloudflare Web Analytics: free, no cookies, nothing stored on the visitor's
 * device, so no cookie banner is needed. It only counts browsers that actually
 * run the page's JavaScript, which leaves out most bots and crawlers.
 *
 * The token comes from Cloudflare (Analytics & Logs > Web Analytics > Add a site)
 * and is public: it ends up in every page's HTML anyway. It's read at build
 * time from CF_WEB_ANALYTICS_TOKEN (a GitHub Actions variable). With no token,
 * nothing is added to the page.
 */
export default function Analytics() {
  const token = process.env.CF_WEB_ANALYTICS_TOKEN;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return null;
  return (
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token })} />
  );
}
