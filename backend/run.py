#!/usr/bin/env python
"""
Run script for the Drone Simulation Backend.

Usage:
    python run.py [--host HOST] [--port PORT] [--reload]
"""

import argparse
import uvicorn

from app.config import settings


def main():
    parser = argparse.ArgumentParser(description="Run Drone Simulation Backend")
    parser.add_argument(
        "--host",
        default=settings.HOST,
        help=f"Host to bind to (default: {settings.HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.PORT,
        help=f"Port to bind to (default: {settings.PORT})",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.DEBUG,
        help="Enable auto-reload on code changes",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )

    args = parser.parse_args()

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║       Drone Design & Failure Prediction System               ║
║                    Backend Server                            ║
╠══════════════════════════════════════════════════════════════╣
║  Host: {args.host:<53} ║
║  Port: {args.port:<53} ║
║  Debug: {str(settings.DEBUG):<52} ║
║  Reload: {str(args.reload):<51} ║
╠══════════════════════════════════════════════════════════════╣
║  API Docs:    http://{args.host}:{args.port}/docs{' ' * (38 - len(str(args.port)))}║
║  Health:      http://{args.host}:{args.port}/api/health{' ' * (31 - len(str(args.port)))}║
║  Socket.IO:   ws://{args.host}:{args.port}/{' ' * (40 - len(str(args.port)))}║
╚══════════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "app.main:socketio_app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
    )


if __name__ == "__main__":
    main()
