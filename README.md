# CJ POS — 0.1.4 public test

CJ POS is a local-first ordering, cashier, kitchen and sales-reporting app for small food businesses. The interface supports English, Chinese and Malay. This repository contains the web/PWA source and an Android WebView test wrapper.

> 测试版：菜单、订单和照片保存在当前设备。不同设备之间不会自动同步。

## Try it

- [Public web demo](https://pos.cj-chan.work/) — start at the landing page, or open the [staff register](https://pos.cj-chan.work/#/cashier) directly.
- [Customer demo](https://pos.cj-chan.work/#/menu?demo=1) — try the separate guest ordering flow without a shop's menu file.
- [Android 0.1.4 test APK](https://pos.cj-chan.work/downloads/CJ_POS_0.1.4_Test.apk) — a debug-signed test package, not a Google Play release.

The public web demo opens staff screens without a password and is for sample data. The Android APK is an on-device test build with the same open staff entrance. You can use it for your own shop data; it has no cloud sync, so save a private `.cjpos` backup.

## Current workflows

| Area | What it does |
| --- | --- |
| [Register](https://pos.cj-chan.work/#/cashier) | Add items and options, change quantities, choose dine-in or takeaway, then create an unpaid order or confirm a payment already received. |
| [Edit menu](https://pos.cj-chan.work/#/cashier/edit) | Edit the shop name, prices, photos and option groups. Changes are saved on this device. |
| [Payments](https://pos.cj-chan.work/#/cashier/active) and [Kitchen](https://pos.cj-chan.work/#/cashier/kitchen) | Collect and confirm payment separately from preparing and completing an order. A completed order can still be unpaid. |
| [History](https://pos.cj-chan.work/#/cashier/history) | Review orders and export a four-sheet XLSX: Summary, Daily, Orders and Order Items. Receipts include only confirmed payments on non-cancelled orders. |
| [Share menu](https://pos.cj-chan.work/#/cashier/share) | Create a `.cjmenu` snapshot and share its file manually, for example through WhatsApp. The menu file contains selected public menu information, not merchant orders or backups. |
| [Guest menu](https://pos.cj-chan.work/#/menu) | Open a received `.cjmenu`, fill an order and return a `.cjorder` file or link manually. The guest reader uses its own local storage. |
| [Receive order](https://pos.cj-chan.work/#/cashier/receive) | Preview a returned receipt, check it against the current local menu and confirm it into the merchant's orders as unpaid/Pending. Receiving it does not clear the register cart. |

The WhatsApp flow uses files or links that people send themselves. The app does not automatically receive WhatsApp messages, synchronize orders between devices, confirm bank transfers or accept customer-provided payment status. Internet is needed to open the web app for the first time and to send through WhatsApp; an already loaded guest menu can be filled offline.

## Local data and backups

Orders, settings, cart and photos are stored locally in IndexedDB. A `.cjpos` backup contains the full merchant dataset, including any order/customer details and photos. Keep backup files private. The web app can export a backup manually; the Android test app also supports local file export. Clearing browser/app data can remove local orders if no backup was saved.

The public demo includes **Reset Demo**, which replaces CJ POS demo data on the current device. No cloud account or Google Sheet sync is used by the public build.

## Run from source

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/`. Development defaults to public demo mode. The GitHub Pages workflow builds with `VITE_PUBLIC_DEMO=true`; a local build can use `VITE_PUBLIC_DEMO=false` to exercise the existing staff gate. That gate is local UI access control, not production authentication. See `.env.example` for optional experimental variables. Every `VITE_*` value is exposed to browser code, so never put a secret there.

```bash
npm run lint
npm test
npm run build
```

The web release is built by [the Pages workflow](.github/workflows/deploy.yml). Android native source and the exact safe publication scope are documented in [Android source publication](docs/open-source/android-source-publication.md). A published APK is a test binary and does not replace the native source or a reproducible release build.

## Contribute

Bug reports and improvements are welcome through [Issues](https://github.com/CJchan09/golden-sea-laksa-pos/issues) and pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md) before sharing logs, screenshots or sample files. Keep real merchant/customer data and signing material out of submissions.

## License status

This public repository does not yet have a repository-wide `LICENSE` file. Its owner is confirming the source and media licensing scope. `src/App.tsx` carries an existing Apache-2.0 file notice, and third-party dependencies retain their own licenses. See [licensing and asset notes](docs/open-source/THIRD_PARTY.md). Until a repository-wide license is published, do not assume that public visibility grants permission to reuse every file.
