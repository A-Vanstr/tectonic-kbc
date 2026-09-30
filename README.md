# Tectonic KBC

KBC-inspired banking prototype with dummy accounts, transactions, payments, cards and insurance. Kate answers questions through OpenRouter using `qwen/qwen3.5-9b`; she cannot perform actions.

## Run locally

Requires Node.js 22+. No dependencies to install.

```sh
cp .env.example .env
# Set OPENROUTER_KEY in .env
npm start
```

Open [localhost:4173](http://localhost:4173). The API key stays server-side; `.env` is ignored by Git. Optional settings: `OPENROUTER_MODEL` and `PORT`.

`npm run dev` enables server restarts. `npm test` runs backend tests without calling OpenRouter.

UI and dummy data: `public/`. Local backend: `server.js`. Project notes: `docs/`. Demo changes reset on reload.

Independent mockup, inspired by [KBC Touch](https://www.kbc.be/retail/en/products/payments/self-banking/on-your-pc/what-is-touch.html). All banking data is fictional.
