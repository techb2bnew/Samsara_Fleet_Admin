# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Deploying

### Why `vercel.json` exists

The console is a single-page app: React Router draws `/drivers` in the
browser, and no file of that name is ever built. Vercel serves files, so
loading `/drivers` directly — a refresh, a bookmark, a link somebody pasted —
looked for a file that is not there and returned `404: NOT_FOUND`. Clicking to
the same page from inside the app worked, which is what made it confusing.

The rewrite hands every path that is not a real file to `index.html`, and the
router takes it from there. Vercel checks the filesystem first, so `/assets/*`
and the favicon are still served as themselves.

Delete that file and every refresh on any page but the dashboard 404s again.
