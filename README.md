# CJ F&B POS — Public Test Build

A mobile-first, local-first ordering, cashier, and kitchen workflow for small F&B businesses.

## Try the public demo

**Live URL:** https://cjchan09.github.io/golden-sea-laksa-pos/

- Customer ordering: choose **Try sample store / 试用示范店**.
- Staff console: choose **Staff console** and use the demo password `admin123`.
- Kitchen display: choose **KDS** from the home page.

Suggested test flow:

1. Add a menu item and complete its required options.
2. Submit a dine-in cash order.
3. Open Staff console → Active and mark the order paid.
4. Open KDS and mark the order completed.
5. Return to Staff console → History and confirm the order total.

## Public test boundaries

- This build stores test data in the current browser/device. It is not a cloud account.
- Different phones and computers do not automatically share orders.
- The staff password is only a local demo gate and is not production security.
- Do not enter real customer data, bank QR codes, passwords, or business records.
- Google Sheet sync is disabled in the public build.
- Installation, offline reopening, and native Android/iOS packaging are not included yet.

To reset your test data, clear this site's browser storage.

## Run locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Verify

```bash
npm run lint
npm test
npm run build
```

The GitHub Pages workflow builds from `main`. The public deployment intentionally does not inject private API, Google Apps Script, or Google Sheet values.
