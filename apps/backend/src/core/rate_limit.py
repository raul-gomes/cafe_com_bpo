from slowapi import Limiter
from slowapi.util import get_remote_address
from src.core.config import get_settings

# Rate limit tiers — shared for use across routers
AUTH_LOGIN_LIMIT = "10/minute"
AUTH_REGISTER_LIMIT = "3/minute"
AUTH_FORGOT_PASSWORD_LIMIT = "3/minute"
AUTH_REFRESH_LIMIT = "10/minute"


class TestAwareLimiter(Limiter):
    """Limiter that disables rate limiting in test mode."""

    def _check_request_limit(self, request, endpoint_func=None, in_middleware=True):
        if get_settings().mode == "test":
            request.state.view_rate_limit = None
            request.state._rate_limiting_complete = True
            return
        return super()._check_request_limit(request, endpoint_func, in_middleware)


limiter = TestAwareLimiter(key_func=get_remote_address)
