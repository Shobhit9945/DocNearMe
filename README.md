![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Shobhit9945/DocNearMe?utm_source=oss&utm_medium=github&utm_campaign=Shobhit9945%2FDocNearMe&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## Environment setup

Copy `.env.example` to `.env` and fill in the required values. Phone verification requires Twilio Verify credentials (`TWILIO_VERIFY_SERVICE_SID`, `TWILIO_SID`, `TWILIO_SECRET`).

## Medical Vault Security

### Threat model (summary)
- Vault documents are encrypted in the browser using a random Data Encryption Key (DEK).
- DocNearMe never receives Vault Passwords or Recovery Keys.
- The server stores only encrypted data, wrapped keys, salts, and KDF parameters.

### What the server stores
- Password-wrapped DEK and Recovery-wrapped DEK
- Salts, IVs/nonces, and KDF parameters
- Encrypted vault documents (ciphertext + iv + optional AAD)

### If the Vault Password and Recovery Key are lost
The vault is unrecoverable. DocNearMe cannot reset or decrypt the vault without either key.
