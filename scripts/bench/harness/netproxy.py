#!/usr/bin/env python3
"""Allow-listed HTTP CONNECT proxy and in-sandbox bridge for benchmark arms.

Host side:   netproxy.py serve <unix-socket> <log-file> <host[,host...]|*>
  Accepts CONNECT host:port over a Unix socket; tunnels only allow-listed hosts, logs every
  attempt (host, allowed/denied). Plain HTTP requests are refused.
Sandbox side: netproxy.py bridge <unix-socket> <tcp-port>
  Inside a network namespace with only loopback: forwards 127.0.0.1:<port> to the Unix socket,
  so HTTPS_PROXY=http://127.0.0.1:<port> reaches the host proxy.
"""
import asyncio, sys, time


async def pipe(reader, writer):
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def serve(sock_path, log_path, allow):
    allowed = None if allow == "*" else set(allow.split(","))
    log = open(log_path, "a", buffering=1)

    async def handle(reader, writer):
        try:
            head = await reader.readuntil(b"\r\n\r\n")
        except Exception:
            writer.close()
            return
        line = head.split(b"\r\n", 1)[0].decode(errors="replace")
        parts = line.split()
        if len(parts) < 2 or parts[0] != "CONNECT":
            log.write(f"{time.strftime('%H:%M:%S')} DENY non-CONNECT {line[:80]}\n")
            writer.write(b"HTTP/1.1 403 Forbidden\r\n\r\n")
            writer.close()
            return
        host, _, port = parts[1].rpartition(":")
        ok = allowed is None or host in allowed
        log.write(f"{time.strftime('%H:%M:%S')} {'ALLOW' if ok else 'DENY'} {host}:{port}\n")
        if not ok:
            writer.write(b"HTTP/1.1 403 Forbidden\r\n\r\n")
            writer.close()
            return
        try:
            up_r, up_w = await asyncio.open_connection(host, int(port))
        except Exception:
            writer.write(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            writer.close()
            return
        writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await writer.drain()
        await asyncio.gather(pipe(reader, up_w), pipe(up_r, writer))

    server = await asyncio.start_unix_server(handle, path=sock_path)
    async with server:
        await server.serve_forever()


async def bridge(sock_path, port):
    async def handle(reader, writer):
        try:
            up_r, up_w = await asyncio.open_unix_connection(sock_path)
        except Exception:
            writer.close()
            return
        await asyncio.gather(pipe(reader, up_w), pipe(up_r, writer))

    server = await asyncio.start_server(handle, "127.0.0.1", int(port))
    async with server:
        await server.serve_forever()


def registry(sock_path, log_path, block):
    """Filtering npm registry mirror on a Unix socket: forwards to npmjs.org, 404s blocked names."""
    import os, re, socketserver, urllib.request, urllib.error
    from http.server import BaseHTTPRequestHandler
    blocked = re.compile(block)
    log = open(log_path, "a", buffering=1)

    class Handler(BaseHTTPRequestHandler):
        def address_string(self):
            return "sandbox"

        def log_message(self, *args):
            pass

        def do_GET(self):
            if blocked.search(urllib.request.unquote(self.path)):
                log.write(f"{time.strftime('%H:%M:%S')} REGISTRY DENY {self.path[:100]}\n")
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error":"Not found"}')
                return
            req = urllib.request.Request("https://registry.npmjs.org" + self.path, headers={
                "Accept": self.headers.get("Accept", "application/json"), "Accept-Encoding": "identity",
                "User-Agent": self.headers.get("User-Agent", "npm")})
            try:
                with urllib.request.urlopen(req, timeout=120) as up:
                    body, status, ctype = up.read(), up.status, up.headers.get("Content-Type", "")
            except urllib.error.HTTPError as e:
                body, status, ctype = e.read(), e.code, e.headers.get("Content-Type", "")
            except Exception:
                body, status, ctype = b"", 502, "text/plain"
            log.write(f"{time.strftime('%H:%M:%S')} REGISTRY {status} {self.path[:100]}\n")
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
        daemon_threads = True

    if os.path.exists(sock_path):
        os.unlink(sock_path)
    Server(sock_path, Handler).serve_forever()


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "serve":
        asyncio.run(serve(sys.argv[2], sys.argv[3], sys.argv[4]))
    elif mode == "registry":
        registry(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        asyncio.run(bridge(sys.argv[2], sys.argv[3]))
