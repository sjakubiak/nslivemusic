import crypto from "node:crypto";
import https from "node:https";
import tls from "node:tls";

/**
 * Some small venue sites serve their TLS certificate without the intermediate
 * certificate. Browsers quietly download the missing intermediate (from the
 * "CA Issuers" URL inside the certificate, a.k.a. AIA fetching); Node doesn't,
 * and fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY.
 *
 * This does what browsers do: read the site's certificate, download its
 * issuer from the AIA URL, and retry with that intermediate added to the
 * normal trusted roots. Verification stays fully on: the chain must still
 * end at a trusted root and match the hostname.
 */
const MISSING_CHAIN = new Set(["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);
const intermediates = new Map<string, string[]>(); // host → PEM chain

export function isMissingChainError(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  return Boolean(code && MISSING_CHAIN.has(code));
}

/** Read the leaf certificate's "CA Issuers" URL. The connection is closed without sending a request. */
function issuerUrl(host: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      resolve(cert.infoAccess?.["CA Issuers - URI"]?.[0]);
    });
    sock.setTimeout(10_000, () => sock.destroy(new Error("timeout reading certificate")));
    sock.on("error", reject);
  });
}

let rootSubjects: Set<string> | undefined;
function isTrustedRootIssuer(cert: crypto.X509Certificate): boolean {
  rootSubjects ??= new Set(tls.rootCertificates.map((pem) => new crypto.X509Certificate(pem).subject));
  return rootSubjects.has(cert.issuer) || cert.issuer === cert.subject;
}

async function download(url: string): Promise<crypto.X509Certificate> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} downloading intermediate from ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Usually DER; some CAs serve PEM. (PKCS#7 bundles aren't handled.)
  return new crypto.X509Certificate(buf.toString("utf8").includes("BEGIN CERTIFICATE") ? buf.toString("utf8") : buf);
}

/**
 * Walk "CA Issuers" links upward until we reach a certificate issued by a
 * trusted root (some chains have two intermediates, e.g. Sectigo → USERTrust).
 */
async function intermediatesFor(host: string): Promise<string[]> {
  const cached = intermediates.get(host);
  if (cached) return cached;
  let url = await issuerUrl(host);
  if (!url) throw new Error(`no CA Issuers URL in ${host}'s certificate`);
  const chain: string[] = [];
  for (let depth = 0; url && depth < 4; depth++) {
    const cert = await download(url);
    chain.push(cert.toString());
    if (isTrustedRootIssuer(cert)) break;
    url = cert.infoAccess?.match(/CA Issuers - URI:(\S+)/)?.[1];
  }
  console.log(
    `[tls] ${host}: fetched ${chain.length} intermediate(s): ` +
      chain.map((pem) => { const c = new crypto.X509Certificate(pem); return `${c.subject.split("\n").find((l) => l.startsWith("CN="))} <- ${c.issuer.split("\n").find((l) => l.startsWith("CN="))}`; }).join(" | "),
  );
  intermediates.set(host, chain);
  return chain;
}

/** GET with the site's missing intermediate supplied. Follows up to 3 redirects. */
export async function getWithFetchedChain(url: string, headers: Record<string, string>, redirects = 3): Promise<{ status: number; body: string }> {
  const u = new URL(url);
  const ca = [...tls.rootCertificates, ...(await intermediatesFor(u.hostname))];
  return new Promise((resolve, reject) => {
    const req = https.get(u, { headers, ca, timeout: 20_000 }, (res) => {
      const loc = res.headers.location;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc && redirects > 0) {
        res.resume();
        resolve(getWithFetchedChain(new URL(loc, u).toString(), headers, redirects - 1));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
