# CJ F&B POS — Public Test Build

A mobile-first, local-first ordering, cashier, and kitchen workflow for small F&B businesses.

## Try the public demo

**Live URL:** https://cjchan09.github.io/golden-sea-laksa-pos/

- Customer ordering: choose **Try sample store / 试用示范店**.
- Menu editing: choose **Edit demo menu / 编辑菜单**. It opens directly without a password.
- Staff History and Kitchen Display also open directly in the public demo.

Suggested test flow:

1. Open **Edit demo menu**, add a dish plus any sizes, noodles, or add-ons, then choose **Save Changes**.
2. Return home, open the sample store, and submit a dine-in cash order using the item you added.
3. Open Staff console → Active and mark the order paid.
4. Open KDS and mark the order completed.
5. Return to Staff console → History and confirm the order total.

## Public test boundaries

- This build stores test data in the current browser/device. It is not a cloud account.
- Different phones and computers do not automatically share orders.
- The public demo intentionally bypasses the Staff, KDS, and History password gates. This is not production authentication.
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

Local development defaults to public demo mode. To verify the private/formal password gates, set `VITE_PUBLIC_DEMO="false"` before starting Vite.

## Verify

```bash
npm run lint
npm test
npm run build
```

The GitHub Pages workflow builds from `main`. The public deployment intentionally does not inject private API, Google Apps Script, or Google Sheet values.
