# Amanah Admin

Standalone React + Vite administration portal for Amanah, with a centered logo and sign-in form. Owned by **reimage-demo**. Convex is the only database and authentication backend.

- Repository: https://github.com/reimage-demo/amanah-admin
- Portal: https://reimage-demo.github.io/amanah-admin/
- Public website repository: https://github.com/reimage-demo/amanah
- Production Convex project: https://dashboard.convex.dev/t/re-image-business-solutions/amanah
- Production deployment: `fast-roadrunner-39`

## Local use

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Set `VITE_CONVEX_URL` in `.env.local` for development. The checked-in `.env.production` contains only public production endpoints. `VITE_PUBLIC_SITE_URL` controls links back to the public website; it defaults to the existing Amanah preview. Set it to `https://amanah.com` when that public domain is live.

The existing administrator credentials and all production data are preserved. Credentials are hashed by Convex Auth, never embedded in frontend code. Public registration is disabled. All record queries and mutations enforce server-side admin authorization.

## Independent publishing and domain

```sh
npm run publish:pages
```

This builds only this portal and publishes `dist/` to this repository’s `gh-pages` branch. GitHub Pages must use that branch, root directory. The public website deploys independently from `reimage-demo/amanah`.

To connect `admin.amanah.com`, set **this repository’s** Settings → Pages → Custom domain to `admin.amanah.com`, then add an `admin` CNAME in your domain DNS pointing to `reimage-demo.github.io`. Add `public/CNAME` containing `admin.amanah.com` before subsequent builds so the domain configuration is retained, and enable HTTPS once the certificate is available. These domain/DNS changes have not been made. The public repository has its own independent Pages custom-domain field for `amanah.com`.

The Vite base is relative, so the same build supports the GitHub Pages preview and the custom-domain root. No shared source folder or cross-repository build dependency is required.

## Convex backend ownership

This repository owns `convex/` and the backend tests. Deploy backend changes from here with `npx convex deploy --yes`, using your authenticated Convex CLI. The public website posts to the existing production HTTP endpoint; moving this source does not move or reset the database.
