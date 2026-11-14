## Description
What changed, and why.

---

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Test
- [ ] Breaking change
- [ ] Dependency update

---

## Testing
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes when the bundle, nginx, or the manifest entry changes
- [ ] Manual check when a screen changes: list, editor, export, and a notice in English

---

## Checklist
- [ ] No secrets, `.env` values, or connector secrets in BPMN, storage, logs, or metric labels
- [ ] User-facing text is a catalog key in `src/app/configuration/locales/en.json`
- [ ] `CHANGELOG.md` `[Unreleased]` updated when this pull request touches `src/`, `package.json`, `package-lock.json`, `Dockerfile`, `nginx/`, `rsbuild.config.ts`, `config/`, `public/config/`, or `index.html`
- [ ] A contract change is reflected in [VERSIONING.md](../VERSIONING.md)

## Related issue
Closes #

## Deployment notes
Manifest entry, SDK version, or nginx path changes an operator needs.
