"""Generate a VAPID key pair for Web Push.

    python scripts/generate_vapid_keys.py

Put the two values into .env locally and into the Vercel project's
environment variables for production.
"""
import base64

from cryptography.hazmat.primitives.asymmetric import ec


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_numbers = private_key.public_key().public_numbers()

    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = (
        b"\x04"
        + public_numbers.x.to_bytes(32, "big")
        + public_numbers.y.to_bytes(32, "big")
    )

    print("VAPID_PUBLIC_KEY=" + b64(public_raw))
    print("VAPID_PRIVATE_KEY=" + b64(private_raw))


if __name__ == "__main__":
    main()
