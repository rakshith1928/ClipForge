# backend/middleware.py

"""
This module exports the route protection dependencies.
As per the implementation plan, routes like /upload, /analyze,
and /calendar will use `get_current_user` to ensure the user is authenticated.

This fulfills the architectural plan of decoupling the dependency 
imports for protected routes.
"""

from auth import get_current_user

__all__ = ["get_current_user"]
