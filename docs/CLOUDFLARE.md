# Hosting on Cloudflare

The site runs on Cloudflare Workers (free plan) using the OpenNext adapter.
Cloudflare has no disk, so events are gathered at build time:

- The GitHub workflow **Deploy to Cloudflare** (`.github/workflows/cloudflare.yml`)
  runs the event ingest, builds the site and deploys it.
- It runs on every push to `main`, every 6 hours, and whenever the admin
  approves or edits a night (the site asks GitHub to run it; takes a few minutes).
- Until the `CLOUDFLARE_API_TOKEN` secret exists, the workflow does nothing,
  so Render keeps working as before.

## One-time setup

1. **Cloudflare account.** Sign up free at dash.cloudflare.com.
2. **API token.** In Cloudflare: your profile icon > *My Profile* > *API Tokens* >
   *Create Token* > use the **Edit Cloudflare Workers** template > *Continue* >
   *Create Token*. Copy it.
3. **Account ID.** Cloudflare dashboard > *Workers & Pages*. The Account ID is in the
   right-hand column. Copy it.
4. **GitHub secrets** (used while building). In the GitHub repo: *Settings* >
   *Secrets and variables* > *Actions* > *New repository secret*. Add:
   - `CLOUDFLARE_API_TOKEN` (step 2)
   - `CLOUDFLARE_ACCOUNT_ID` (step 3)
   - `EVENTBRITE_TOKEN` (same value as on Render)
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (same values as on Render)
5. **First deploy.** GitHub repo > *Actions* > *Deploy to Cloudflare* > *Run workflow*.
   When it's green, the site is at `https://nslivemusic.<your-subdomain>.workers.dev`
   (shown in Cloudflare under *Workers & Pages* > *nslivemusic*).
6. **Site secrets** (used while the site runs). Cloudflare > *Workers & Pages* >
   *nslivemusic* > *Settings* > *Variables and Secrets* > *Add*, type **Secret**:
   - `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as Render)
   - `GITHUB_DEPLOY_TOKEN`: so approvals show up within minutes. On GitHub:
     *Settings* (your account) > *Developer settings* > *Personal access tokens* >
     *Fine-grained tokens* > *Generate new token*; repository access: only
     `nslivemusic`; permissions: *Actions: Read and write*. Without it, approved
     changes appear at the next 6-hourly rebuild.
7. **Optional: your own domain.** *Workers & Pages* > *nslivemusic* > *Settings* >
   *Domains & Routes* > *Add* > *Custom domain*.

Once the Cloudflare site looks right, the Render service can be deleted.

## Local preview of the Cloudflare build

```
npm run cf:preview   # builds and serves it in the Workers runtime at localhost:8787
```
