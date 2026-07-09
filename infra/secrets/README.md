# infra/secrets/

Drop the production JWT RSA keypair here (git-ignored — never committed):

- `jwt_private.pem` — RSA private key (PKCS#8)
- `jwt_public.pem`  — RSA public key

Generate a fresh 2048-bit keypair (do NOT reuse the dev keys):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
chmod 600 jwt_private.pem
```

`deploy.sh` reads these files and injects their contents as the
`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` environment variables for the backend
container. Keep a secure offsite copy — losing them invalidates all issued tokens.
