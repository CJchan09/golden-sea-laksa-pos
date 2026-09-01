# CJ F&B POS — Public Test Build

A mobile-first, local-first ordering, cashier, and kitchen workflow for small F&B businesses.

## Try the public demo

**Live URL:** https://pos.cj-chan.work/

- Customer ordering: choose **Try sample store / 试用示范店**.
- Menu editing: choose **Edit demo menu / 编辑菜单**. It opens directly without a password.
- Staff History and Kitchen Display also open directly in the public demo.

Suggested test flow:

1. Open **Edit demo menu**, add a dish and create option groups such as Size, Rice type, Protein, or Add-ons. Every choice can have its own extra price. Then choose **Save on this device**.
2. Return home, open the sample store, and submit a dine-in cash order using the item you added.
3. Open the Staff console on the same phone. Use **Active** for payment and **Kitchen** for orders that are not served yet.
4. Mark the order completed in Kitchen.
5. Open **History**, confirm the total, and download the selected date range as a two-sheet Excel workbook.
6. On supported Android browsers, choose **Install** when prompted. Reopen the installed test app after disconnecting the network.

## Public test boundaries

- This build stores test data in the current browser/device. It is not a cloud account.
- Each browser/device profile gets one local copy. Tabs in the same browser share it; saving cannot change the published baseline or data on another device.
- Different phones and computers do not automatically share orders.
- The public demo intentionally bypasses the Staff, KDS, and History password gates. This is not production authentication.
- Do not enter real customer data, bank QR codes, passwords, or business records.
- Google Sheet sync is disabled in the public build.
- The current deliverable is an installable Web/PWA test build with offline reopening. It is not yet the signed Google Play Android package.
- The first visit and version updates need internet access. Default remote menu images are cached after they are viewed online.

To reset your test data, choose **Reset Demo / 恢复示范资料** on the landing page or menu editor. The reset only removes this product's demo data from the current device; it preserves passwords and unrelated browser data.

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

The GitHub Pages workflow builds from `main` for the root custom domain. The public deployment intentionally does not inject private API, Google Apps Script, or Google Sheet values.
