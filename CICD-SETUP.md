# CI/CD setup (Backend)

This repo deploys to Hetzner on every push to `main` via `.github/workflows/deploy-backend.yml`.

Server path: `/var/www/mtd/backend`  
PM2 process: `mtd-backend`  
Health URL: `http://localhost:3500/api/v1/health`  
Public API: `https://app.mytaxdiary.co.uk/api`

## Required GitHub secrets

Create these in **GitHub → MTD-Backend → Settings → Secrets and variables → Actions**.

Also create a GitHub Environment named `production` (Settings → Environments → New environment). The workflow uses `environment: production`.

| Secret | Example | Notes |
|---|---|---|
| `DEPLOY_HOST` | `1.2.3.4` or `app.mytaxdiary.co.uk` | Server IP or hostname |
| `DEPLOY_USER` | `deploy` | Non-root SSH user |
| `DEPLOY_SSH_KEY` | full private key PEM | Includes `-----BEGIN ... KEY-----` lines |
| `DEPLOY_PORT` | `22` | SSH port |

Do not put `.env` values in GitHub. Migrations and the NestJS app read the existing `.env` on the server. The pipeline never overwrites it.

## Generate a dedicated deploy SSH key

You can reuse the same deploy user/key as the frontend if both repos deploy to the same server, or create a separate key:

```bash
ssh-keygen -t ed25519 -C "github-actions-mtd-backend" -f ./mtd-backend-deploy -N ""
```

This creates:

- `mtd-backend-deploy` (private key → GitHub secret `DEPLOY_SSH_KEY`)
- `mtd-backend-deploy.pub` (public key → server)

## Add the public key on the Hetzner server

If the `deploy` user already exists for the frontend, append this public key to the same `authorized_keys` file (or reuse the same key in both GitHub repos).

Otherwise:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
# paste contents of mtd-backend-deploy.pub
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

Give the deploy user access to the backend directory:

```bash
sudo chown -R deploy:deploy /var/www/mtd/backend
```

Confirm this user can run PM2 restarts and that `npm run migration:run` works with the server `.env` when run as that user.

Test SSH:

```bash
ssh -i ./mtd-backend-deploy -p 22 deploy@YOUR_SERVER_IP
```

## Add the private key in GitHub

1. Open `mtd-backend-deploy` and copy the full private key.
2. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret.
3. Name: `DEPLOY_SSH_KEY`
4. Value: paste the private key.
5. Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT` the same way.

Never commit the private key.

## How to test the pipeline

1. Confirm secrets and the `production` environment exist.
2. Make a small commit on `main` (or merge a PR into `main`).
3. Open GitHub → Actions → **Deploy Backend**.
4. Confirm **Lint, test and build** passes, then **Deploy to Hetzner** passes.
5. Check `https://app.mytaxdiary.co.uk/api/v1/health` (or your public health route) and confirm the API is healthy.

## Manual rollback if deploy fails

On the server as the deploy user:

```bash
cd /var/www/mtd/backend
git log --oneline -5
git checkout <previous-good-commit>
npm ci
# Only revert a migration if you know it is safe for this release:
# npm run migration:revert
npm run build
pm2 restart mtd-backend --update-env
pm2 save
curl -fsS http://localhost:3500/api/v1/health
```

To return to latest `main` later:

```bash
git checkout main
git merge --ff-only origin/main
npm ci
npm run migration:run
npm run build
pm2 restart mtd-backend --update-env
pm2 save
```

## Notes

- Migrations run before `npm run build` and before the PM2 restart. If a migration fails, the deploy stops.
- Pipeline uses `git merge --ff-only` (no `git reset --hard`).
- Uploads under the server (for example portal files) and `.env` are not deleted.
- Frontend and backend use separate concurrency groups.
