# Status and Verification

## Verified

The app deployed automatically from GitHub. The live API reported connected storage. A temporary production verification account was created, its profile survived sign-out/sign-in, its private application endpoint worked, and the account was removed after testing.

Synthetic local browser flows passed at 390 and 1440 px: registration → job discovery → PDF application → candidate tracking → employer receipt. API tests cover moderation, cross-employer isolation, CV validation and privacy, duplicate records, withdrawal, enquiries, password/session revocation, account deletion and cross-origin rejection.

## Pending and limits

Administrator activation requires the Netlify environment key; hosting sign-in is still incomplete. Production has no invented vacancies. Email delivery, email verification and password recovery by email are not implemented. PDFs are type/size checked but not malware-scanned. Employer identity is not automatically verified. The key/value design suits a small application; large-scale search and transactional workflows need a database design review.

Before collecting real applicants at scale, the business owner must confirm operator contact details, privacy/retention procedures and download-scanning practice. See `public/privacy.html` and the root README.

## Maintenance

After code or deployment changes, update these pages and relevant README links. Use synthetic test data. Do not commit passwords, tokens, private client details or real applicant records into documentation.
