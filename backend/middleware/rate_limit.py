import os
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_user_or_ip(request):
    """Key func: try user_id from Bearer token else fallback to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from auth import decode_token

            uid = decode_token(auth[7:])
            if uid:
                return uid
        except Exception:
            pass
    return get_remote_address(request)


storage_uri = os.getenv("REDIS_URL", "memory://")
limiter = Limiter(key_func=get_user_or_ip, storage_uri=storage_uri)
