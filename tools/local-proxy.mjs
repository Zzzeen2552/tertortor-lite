// Proxy HTTP lokal untuk muse4ai (user 2026-11-11). muse4ai menolak koneksi langsung: tiap akun wajib lewat proxy.
// Kita hanya pakai satu akun Muse, jadi proxy ini cukup meneruskan lalu lintas lewat internet laptop sendiri
// (IP yang sama dengan browsing biasa). Hanya mendengar di 127.0.0.1, tanpa log isi.
// Pakai: node tools/local-proxy.mjs [port]   → di muse4ai isi proxy: 127.0.0.1:8899
import http from "node:http";
import net from "node:net";

const PORT = Number(process.argv[2] || process.env.LOCAL_PROXY_PORT || 8899);

const server = http.createServer((req, res) => {
  // Permintaan HTTP biasa: req.url berisi URL absolut.
  let target;
  try { target = new URL(req.url); } catch { res.writeHead(400).end("bad url"); return; }
  if (target.protocol !== "http:") { res.writeHead(400).end("http only"); return; }
  const headers = { ...req.headers };
  delete headers["proxy-connection"];
  delete headers["proxy-authorization"];
  const up = http.request(
    { host: target.hostname, port: target.port || 80, method: req.method, path: target.pathname + target.search, headers },
    (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); },
  );
  up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(up);
});

// HTTPS: terowongan CONNECT host:port.
server.on("connect", (req, client, head) => {
  const [host, portStr] = String(req.url).split(":");
  const port = Number(portStr) || 443;
  const up = net.connect(port, host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(client);
    client.pipe(up);
  });
  const close = () => { up.destroy(); client.destroy(); };
  up.on("error", () => { try { client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); } catch {} close(); });
  client.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => console.log(`local-proxy siap di 127.0.0.1:${PORT}`));
