# Setup and Deployment

## Requirements

Node.js 22 and npm.

```sh
npm ci
npm test
npm run build
npm start
```

Local development serves http://127.0.0.1:8888/app.html using private files in `.data/`. A local-only `WORKREADY_ADMIN_KEY` enables the review queue; set it through your shell environment, never in committed code.

## Netlify

Use the repository root as base directory. `netlify.toml` configures `npm run build`, publish directory `dist`, Functions directory `netlify/functions` and the `/api/*` rewrite. A static file-only upload does not deploy the API.

Netlify supplies Blobs credentials to its deployed Function. Set a private random `WORKREADY_ADMIN_KEY` of at least 32 characters with Functions scope, then redeploy. Sign into an application account and open `/app.html#admin` to unlock that session. This environment value is still pending configuration as of the documentation review.

Check `/api/health`: storage should be connected. A response with `adminConfigured: false` means job publication remains unavailable.
