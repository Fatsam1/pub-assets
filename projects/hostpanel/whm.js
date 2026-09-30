import { config } from "./config.js";

const BASE = `https://${config.whm.host}:${config.whm.port}/json-api`;

// WHM's cert is for its hostname, not the IP we dial. Node's built-in https
// supports a per-request `rejectUnauthorized:false`, which the global fetch does
// not — so we use https directly for these direct-to-IP calls.
import https from "node:https";

function whmRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        rejectUnauthorized: false,
        headers: { Authorization: `whm ${config.whm.user}:${config.whm.token}` },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body));
      }
    );
    req.on("error", reject);
    // createacct can take 60s+; give WHM calls a generous window.
    req.setTimeout(120000, () => req.destroy(new Error("WHM request timed out")));
    req.end();
  });
}

async function whmCall(fn, params = {}) {
  const url = new URL(`${BASE}/${fn}`);
  url.searchParams.set("api.version", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const text = await whmRequest(url);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`WHM ${fn}: non-JSON response: ${text.slice(0, 200)}`);
  }
  const meta = data.metadata || {};
  if (meta.result !== 1) {
    throw new Error(`WHM ${fn} failed: ${meta.reason || "unknown error"}`);
  }
  return data.data || {};
}

// Read a file from a cPanel account's public_html via WHM Fileman API
export async function readFile(cpanelUser, filename) {
  const url = new URL(`${BASE}/cpanel`);
  url.searchParams.set("api.version", "1");
  url.searchParams.set("cpanel_jsonapi_apiversion", "3");
  url.searchParams.set("cpanel_jsonapi_user", cpanelUser);
  url.searchParams.set("cpanel_jsonapi_module", "Fileman");
  url.searchParams.set("cpanel_jsonapi_func", "get_file_content");
  url.searchParams.set("dir", `/home/${cpanelUser}/public_html`);
  url.searchParams.set("file", filename);
  const text = await whmRequest(url);
  try {
    const d = JSON.parse(text);
    return d?.result?.data?.[0]?.content ?? null;
  } catch { return null; }
}

// Write a file to a cPanel account's public_html via WHM Fileman API
export async function saveFile(cpanelUser, filename, content) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      "api.version": "1",
      cpanel_jsonapi_apiversion: "3",
      cpanel_jsonapi_user: cpanelUser,
      cpanel_jsonapi_module: "Fileman",
      cpanel_jsonapi_func: "save_file_content",
      dir: `/home/${cpanelUser}/public_html`,
      file: filename,
      content,
    }).toString();
    const opts = {
      method: "POST",
      rejectUnauthorized: false,
      headers: {
        Authorization: `whm ${config.whm.user}:${config.whm.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const urlObj = new URL(`${BASE}/cpanel`);
    const req = https.request(urlObj, opts, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try {
          const d = JSON.parse(body);
          resolve(d?.result?.status === 1);
        } catch { resolve(false); }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.write(postData);
    req.end();
  });
}

export async function listAccounts() {
  const d = await whmCall("listaccts");
  return (d.acct || []).map((a) => ({
    domain: a.domain,
    user: a.user,
    ip: a.ip,
    plan: a.plan,
    email: a.email,
    suspended: a.suspended === 1 || a.suspended === "1",
    diskused: a.diskused,
    disklimit: a.disklimit,
  }));
}

export async function listPackages() {
  const d = await whmCall("listpkgs");
  return (d.pkg || []).map((p) => p.name);
}

// Create a new cPanel account. Returns { user, domain, ip }.
export async function createAccount({ domain, username, password, plan, contactemail }) {
  const params = {
    domain,
    username,
    password,
    contactemail: contactemail || "",
  };
  if (plan) params.plan = plan;
  const d = await whmCall("createacct", params);
  return d;
}

// Attach an external domain to an existing cPanel account as an addon domain.
// This is how you "link a domain you own from another registrar" onto one of
// your cPanels. cpanel-api must be enabled on the token.
export async function addAddonDomain({ cpanelUser, domain, subdir }) {
  const dir = subdir || domain.replace(/[^a-z0-9]/gi, "");
  return whmCall("cpanel", {
    cpanel_jsonapi_user: cpanelUser,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: "AddonDomain",
    cpanel_jsonapi_func: "addaddondomain",
    newdomain: domain,
    subdomain: dir,
    dir: `public_html/${dir}`,
  });
}

// Add SPF / DKIM style records handled by cPanel's mail auth; here we ensure the
// zone exists and can be edited. Returns the zone records.
export async function getDnsZone(domain) {
  const d = await whmCall("dumpzone", { domain });
  return d.zone || [];
}

// Install / read DKIM + SPF that cPanel manages for a domain's mail.
export async function ensureMailAuth(domain) {
  // enable_dkim / install_spf are cPanel-side; on WHM we can trigger via
  // the email deliverability tooling if the token allows it. Kept best-effort.
  try {
    await whmCall("install_dkim_keys", { domain });
  } catch (e) {
    /* token may lack privilege; non-fatal */
  }
  return true;
}
