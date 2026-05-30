"""Предпросмотр ссылок для новостей (Open Graph / Twitter cards)."""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_MAX_HTML_BYTES = 256_000
_MAX_REDIRECTS = 5
_USER_AGENT = "PropSignalsBot/1.0 (+https://t.me/)"

_OG_KEYS = {
    "og:title": "title",
    "twitter:title": "title",
    "og:description": "description",
    "twitter:description": "description",
    "description": "description",
    "og:image": "image_url",
    "twitter:image": "image_url",
    "twitter:image:src": "image_url",
}


@dataclass(frozen=True)
class LinkPreview:
    url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.page_title: str | None = None
        self._in_title = False
        self._title_buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "meta":
            data = {k.lower(): (v or "") for k, v in attrs}
            key = (data.get("property") or data.get("name") or "").lower()
            content = data.get("content") or ""
            if key and content and key not in self.meta:
                self.meta[key] = content
        elif tag.lower() == "title":
            self._in_title = True
            self._title_buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title" and self._in_title:
            self._in_title = False
            title = "".join(self._title_buf).strip()
            if title:
                self.page_title = title

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_buf.append(data)


def normalize_link_url(raw: str) -> str | None:
    text = raw.strip()
    if not text:
        return None
    if not re.match(r"^https?://", text, re.I):
        text = f"https://{text}"
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return text


def _host_is_public(host: str) -> bool:
    lowered = host.lower().strip(".")
    if lowered in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return False
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            return False
    return True


def _is_safe_url(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        return False
    return _host_is_public(host)


def _clip(text: str | None, limit: int) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", unescape(text.strip()))
    if not cleaned:
        return None
    return cleaned[:limit]


def _extract_preview(base_url: str, html: str) -> LinkPreview:
    parser = _MetaParser()
    try:
        parser.feed(html)
    except Exception:
        pass

    fields: dict[str, str] = {}
    for meta_key, field in _OG_KEYS.items():
        val = parser.meta.get(meta_key)
        if val and field not in fields:
            fields[field] = val

    title = _clip(fields.get("title") or parser.page_title, 300)
    description = _clip(fields.get("description"), 500)
    image_raw = fields.get("image_url")
    image_url = urljoin(base_url, image_raw) if image_raw else None
    if image_url and not image_url.startswith(("http://", "https://")):
        image_url = None

    if not title:
        parsed = urlparse(base_url)
        title = _clip(parsed.netloc, 300)

    return LinkPreview(
        url=base_url,
        title=title,
        description=description,
        image_url=image_url,
    )


async def fetch_link_preview(raw_url: str) -> LinkPreview | None:
    url = normalize_link_url(raw_url)
    if url is None or not _is_safe_url(url):
        return None

    timeout = settings.price_http_timeout_seconds
    current = url
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        ) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                if not _is_safe_url(current):
                    return None
                resp = await client.get(current)
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    if not location:
                        return None
                    current = urljoin(current, location)
                    continue
                if resp.status_code != 200:
                    logger.info("link preview HTTP %s for %s", resp.status_code, current[:120])
                    return LinkPreview(url=url, title=_clip(urlparse(url).netloc, 300))
                content_type = (resp.headers.get("content-type") or "").lower()
                if "html" not in content_type and "text/" not in content_type:
                    return LinkPreview(url=url, title=_clip(urlparse(url).netloc, 300))
                html = resp.text[:_MAX_HTML_BYTES]
                preview = _extract_preview(current, html)
                return LinkPreview(
                    url=url,
                    title=preview.title,
                    description=preview.description,
                    image_url=preview.image_url,
                )
    except Exception as e:
        logger.warning("link preview failed for %s: %s", url[:120], e)
    return LinkPreview(url=url, title=_clip(urlparse(url).netloc, 300))
