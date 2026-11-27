// Static-IP relay for Upstox. Runs on the VM (pm2 process "upstox-relay", port 3000).
// Forwards `${VM_RELAY_URL}<path>` to the Upstox API with the caller's bearer token,
// so Upstox always sees the VM's registered static IP.
//
// Deploy:  RELAY_SECRET=<same as VM_RELAY_SECRET> pm2 restart upstox-relay --update-env
// (CommonJS on purpose: it is a standalone script, not part of the ESM app.)

const http = require("http");

// Keeps the VM from being reclaimed as idle (Oracle Always Free). Remove if not needed.
const keepAliveBuffer = Buffer.alloc(270 * 1024 * 1024, 1);

const SECRET = process.env.RELAY_SECRET;
if (!SECRET) {
  console.error("RELAY_SECRET is not set");
  process.exit(1);
}

// Upstox v3 order endpoints live on a dedicated host; everything else on api.upstox.com.
const hostFor = (url) =>
  url.startsWith("/v3/order") ? "https://api-hft.upstox.com" : "https://api.upstox.com";

http
  .createServer(async (req, res) => {
    if (req.headers["x-secret"] !== SECRET) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const upstoxRes = await fetch(hostFor(req.url) + req.url, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: req.headers["authorization"] || "",
          ...(req.headers["x-api-key"] ? { "x-api-key": req.headers["x-api-key"] } : {}),
        },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
        signal: AbortSignal.timeout(15000),
      });

      const data = await upstoxRes.text();
      res.writeHead(upstoxRes.status, { "Content-Type": "application/json" });
      res.end(data);
    } catch (err) {
      console.error("forward failed:", req.method, req.url, err.cause?.code || err.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  })
  .listen(3000, () => console.log("Upstox Relay running on port 3000"));
