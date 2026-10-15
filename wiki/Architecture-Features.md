# Architecture and Features

## Components

| Component | Purpose |
| --- | --- |
| `public/index.html`, `style.css`, `main.js` | Marketing pages, guides and saved enquiry form |
| `public/app.html`, `app.js`, `app.css` | Job board, account dialogs and role-specific workspaces |
| `server/core.mjs` | Validation, authentication, sessions, jobs, applications, PDF access and moderation |
| `netlify/functions/api.mjs` | Netlify Blobs adapter and production API entry |
| `server/local.mjs` | Local HTTP server and private file-backed development adapter |
| `test/flows.test.mjs` | Synthetic end-to-end API and authorization checks |

## Data and roles

Candidates apply and see their own application progress. Employers create pending vacancies, review applicants to their own jobs and update progress. An unlocked administrator session can publish/reject/close vacancies and resolve enquiries. Users cannot choose administrator during registration.

Account passwords use salted scrypt hashes. Session cookies are HttpOnly, Secure in production, and SameSite=Lax. CVs are private PDF attachments, up to 2 MB, accessible through authorized API endpoints. Production Blobs storage is separate from deploy-preview storage. Conditional creation prevents duplicate accounts/applications.

## Main API routes

`/register`, `/login`, `/logout`, `/me`, `/profile`, `/password`, `/account`, `/jobs`, `/jobs/mine`, `/applications`, `/applications/:id/cv`, `/enquiries`, `/admin/unlock` and `/admin/overview`. Check `server/core.mjs` for permitted methods and status validation.
