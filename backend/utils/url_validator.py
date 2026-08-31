import ipaddress
import socket
from urllib.parse import urlparse
from fastapi import HTTPException

ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "youtu.be", "www.youtu.be",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
    "vimeo.com", "www.vimeo.com",
}

def is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_reserved
    except ValueError:
        return False

def _resolve_ips(hostname: str) -> list[str]:
    try:
        _, _, ips = socket.gethostbyname_ex(hostname)
        return ips
    except socket.gaierror:
        return []

def validate_upload_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL scheme must be http or https")
    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL: missing host")
    # Direct IP literal check — must happen before allowlist so SSRF via IP
    # is reported as "private" (test expects "private" in detail)
    if is_private_ip(host):
        raise HTTPException(status_code=400, detail=f"URL resolves to private IP: {host}")
    # Allowlist check
    host_lower = host.lower()
    is_allowed = any(host_lower == h or host_lower.endswith("." + h) for h in ALLOWED_HOSTS)
    if not is_allowed:
        raise HTTPException(status_code=400, detail=f"URL host not allowed: {host}")
    # Private IP check via DNS
    for ip in _resolve_ips(host):
        if is_private_ip(ip):
            raise HTTPException(status_code=400, detail=f"URL resolves to private IP: {ip}")
    return {"host": host, "is_allowed": is_allowed}
