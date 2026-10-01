# Licensing and third-party inventory — preparation note

The public repository currently has no repository-wide `LICENSE` file. The owner is confirming the source license and the rights to distribute media. This note records what was checked; it does **not** grant rights to code or assets. `src/App.tsx` has carried an `SPDX-License-Identifier: Apache-2.0` notice since the repository's initial commit. Keep that notice intact when choosing a repository-wide license.

## JavaScript packages

`package.json` and `package-lock.json` define the web build. License fields in the installed direct package metadata were checked on 2026-10-01:

| License field | Direct packages |
| --- | --- |
| MIT | `@tailwindcss/vite`, `@vitejs/plugin-react`, `clsx`, `date-fns`, `motion`, `react`, `react-dom`, `tailwind-merge`, `uuid`, `write-excel-file`, `@types/node`, `autoprefixer`, `tailwindcss`, `vite`, `vite-plugin-pwa`, `vitest` |
| ISC | `lucide-react` |
| Apache-2.0 | `typescript` |

This is a direct-dependency inventory, not a complete software bill of materials. Transitive dependencies and their license notices remain governed by their upstream packages. The native project declares Android Gradle Plugin 8.4.2 and `androidx.webkit:webkit:1.11.0`; check their upstream notices when packaging or redistributing the Android app.

## Media, branding and generated binaries

The repository already tracks photos and illustrations in `public/assets/`, app icons in `public/icon-options/`, a narrated guide in `public/media/`, and debug test APKs in `public/downloads/`. Publication on the demo site does not establish that every asset may be reused under a future source-code license. Record provenance and permission per asset before applying any broad media license or asking contributors to reuse those files. The guide video and narration need their own rights/attribution decision. The APK is a compiled test artifact and does not replace source, signing or release documentation.

Merchant-created backups, menu snapshots, customer receipts, QR images, reports, device logs and QA snapshots are data, not contribution examples. Do not commit real copies. Issue reports and pull requests should use synthetic examples only.
