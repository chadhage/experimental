# Pending GitHub Actions workflows

These workflow files were committed here (instead of `.github/workflows/`) because the credential
used for the initial push did not have the GitHub **`workflow`** OAuth scope, which is required to
create or update files under `.github/workflows/`.

## How to activate them

Once you push with a credential that has the `workflow` scope (a PAT with `repo` + `workflow`, or
`gh auth login` / Git Credential Manager re-auth), move them back:

```powershell
git mv .github/workflows-pending/ci.yml     .github/workflows/ci.yml
git mv .github/workflows-pending/deploy.yml .github/workflows/deploy.yml
Remove-Item .github/workflows-pending -Recurse -Force -ErrorAction SilentlyContinue
git add -A
git commit -m "Activate CI/CD workflows"
git push
```

- [ci.yml](ci.yml) — build API + web, validate all Terraform environments
- [deploy.yml](deploy.yml) — build/push images and `terraform apply` per tier (Azure/AWS/GCP OIDC)
