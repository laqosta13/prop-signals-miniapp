import time
from collections import defaultdict

_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_calls: int = 5, window_seconds: float = 60.0) -> bool:
    now = time.monotonic()
    _buckets[key] = [t for t in _buckets[key] if now - t < window_seconds]
    if len(_buckets[key]) >= max_calls:
        return False
    _buckets[key].append(now)
    return True
