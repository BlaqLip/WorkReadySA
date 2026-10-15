# WorkReadySA

A full-stack recruitment application for South African job seekers and employers. The existing marketing site links to a responsive jobs/workspace app at `/app.html`.

## Working flows

- Candidate and employer registration/login, salted scrypt passwords, HttpOnly/Secure sessions, sign-out and password changes.
- Private profiles, self-service account deletion and session revocation.
- Employer vacancy creation; vacancies stay pending until administrator review. Admin can publish/reject/close; employers can close their own jobs.
- Public search by keyword, province and employment type. Closed/expired jobs are excluded.
- Candidates submit an application note and PDF CV (2 MB maximum), track status and withdraw.
- Employers see only applicants to their own vacancies, download private CVs and update progress.
- Enquiries persist to an administrator inbox, with resolved status.
- No invented jobs, candidate counts or successful placements are seeded in production.

## Hosting

Node 22, Netlify Functions and `@netlify/blobs` 10.5.0. The Function owns all storage access; browser clients never receive storage credentials. Production uses a site-wide store named `workready-production`. Preview deployments use deploy-specific names and cannot access production records. Strong consistency and conditional creation prevent duplicate accounts/applications. Blobs is a small-app key/value backend; migrate to a relational database for large-scale searching, indexing and transactional workflows.

`netlify.toml` defines build/publish/function paths and security headers. Connect this repository to the existing Netlify project with repository root as base directory, `npm run build` as build command and `dist` as publish directory. Functions must be deployed through a Git/CLI build; a static drag-and-drop upload of `dist` does not deploy the API.

### Owner configuration

Set `WORKREADY_ADMIN_KEY` to a private random value of at least 32 characters in the Netlify project's **Functions** environment, then redeploy. Do not put it in GitHub or frontend code. Sign in with a regular account, navigate to `/app.html#admin` and enter the key to grant administrator access to that session. Public registration can never select administrator. Each administrator must sign in and unlock their own session. No default password is included. Rotate the key and revoke admin sessions in private storage if access must be removed.

Netlify automatically supplies Blobs credentials to the deployed Function; no separate database API key is required. Check `/api/health` after deployment: it must return `storage: "connected"`. Without the admin key, accounts, enquiries and candidate/employer workflows work, but job publication stays unavailable.

## Local development

```
npm ci
WORKREADY_ADMIN_KEY='<local-only-test-key>' npm start
```

Open `http://127.0.0.1:8888/app.html`. Local development uses private `.data/` files, not production Blobs. Never use this local server as an Internet-facing server. `WORKREADY_DATA_DIR` can point to another local data folder. Do not commit `.data`, `.env` or real CVs.

## Checks

```
npm test
npm run build
```

Tests exercise registration, login, job submission/publication, filtered search, PDF validation, duplicate applications, private CV access, cross-employer isolation, application status updates, withdrawal, enquiries, password/session revocation, account deletion, request limits and cross-origin rejection. Tests use synthetic data only.

## Current limits

- No outbound email, email ownership verification, password reset emails or employment-alert delivery. Updates appear in the workspace.
- No automated employer identity checks or CV malware scanning. CV downloads are attachments; employers must scan them before opening. PDF header/type and size checks are not antivirus scanning.
- Administrator review does not guarantee employer legitimacy or an employment outcome.
- Privacy notice and explicit application consent are included. The business owner must supply verified operator contact details and retention procedures before collecting real applicants at scale.
- Rate-limit reservation records are bucketed every 15 minutes; periodically remove old `limits/` records through the private storage dashboard. Sessions expire after seven days; expired rows may also be removed there.
- Build/deployment and a live storage check are required before describing the hosted app as operational.
