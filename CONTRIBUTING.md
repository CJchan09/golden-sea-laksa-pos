# Contributing to CJ POS

Thanks for helping improve CJ POS. The current release is a public **test** for small food businesses. Start with an [Issue](https://github.com/CJchan09/golden-sea-laksa-pos/issues) for bugs, behavior changes or large features so the intended workflow is clear before a pull request.

## Before sharing anything

- Use synthetic shop names, phone numbers, addresses, menu photos, QR images and orders. Never attach real `.cjpos`, `.cjmenu`, `.cjorder`, XLSX exports, database dumps, screenshots with customer details, signing keys or private QA logs.
- A `.cjpos` file is a full merchant backup. A `.cjmenu` file contains public menu data and the shop's WhatsApp number. A `.cjorder` file can contain customer contact information. Treat all three as potentially sensitive.
- Do not put secrets in `VITE_*` variables: Vite embeds them in the browser bundle.
- Keep changes focused. Preserve existing local data and migrations; describe any storage or format change in the pull request.

## Develop and verify

Use Node.js 20 or newer:

```bash
npm ci
npm run dev
```

The web dev server opens at `http://localhost:3000/`. Public demo mode is on by default in development. The public demo skips staff password screens, so it must never be used as proof of production authentication.

For code changes, run:

```bash
npm run lint
npm test
npm run build
```

In a pull request, explain the problem, what changed, and which checks you actually ran. For UI changes, include a screenshot using only synthetic data and mention the tested viewport. For Android changes, include the native source and build instructions; do not attach a rebuilt APK or a signing key unless a maintainer explicitly asks.

## Product rules to preserve

- Orders, settings and photos belong to the current device. The web and Android test apps have no cloud account or automatic cross-device sync.
- A customer `.cjorder` is an untrusted request. The merchant app validates it and recalculates prices from the local menu. Receiving a request creates an unpaid order only after merchant confirmation; it cannot confirm payment.
- Kitchen completion and payment are independent. Revenue reports include confirmed payments on non-cancelled orders.
- Exports and backups can contain customer data. Changes to these formats need backward compatibility or an explicit migration path.

## License status

There is no repository-wide `LICENSE` file yet. The owner is confirming source and media rights; `src/App.tsx` has an existing Apache-2.0 file notice. Open an Issue for proposals while this is resolved. Maintainers will clarify licensing before accepting substantial code or asset contributions. Third-party packages and media must retain their own attribution and permissions.
