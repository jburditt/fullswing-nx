import { escapeHtml } from './layout.js';

export function renderLoginPage(authorizationUrl: string): string {
  const safeAuthorizationUrl = escapeHtml(authorizationUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Login | Fullswing CMS</title>
    <link rel="icon" href="/assets/logo.jpg" type="image/jpeg" />
    <link rel="stylesheet" href="/assets/cms.css" />
  </head>
  <body class="cms-login-page">
    <main class="cms-login">
      <a class="cms-brand" href="/login"><img src="/assets/logo.jpg" alt="Fullswing" /></a>
      <h1>Fullswing CMS</h1>
      <a class="cms-primary-action" href="${safeAuthorizationUrl}">Sign in with Microsoft</a>
    </main>
  </body>
</html>`;
}