fullswing-cms is a content management system for enhanced markdown files, and html pages with optional svelte web components. The content is synced to a configured OneDrive folder. Only admin users can manage the files, so authentication with latest OAuth is required to access all pages except the Login page.

Sitemap:
Login - A compact login form that loads on all page routes when the user is not authenticated
Dashboard - A page that lists all of the blogs and pages. At the top show a filter icon that drops down a modal window with filtering options for blogs, pages, date range, author dropdown, etc. Use repository in shared library for database calls
Add/Edit markdown file - A page with a form to add/edit metadata for the .json sidecar files and a textarea for adding/editing markdown files. The textarea should validate the markdown and have a status bar with green checkbox or red x when validation changes. At the top there is a tab to switch from markdown editing or markdown preview. The preview shows the markdown formatted. There should be a toolbar above the textarea that applies the markdown syntax to the selected text. The toolbar should also have a button to add a file, it uploads to OneDrive with a progress bar to display the upload progress and inserts a link to the file in the textarea cursor position. Ideally, there would be an icon by the file hyperlink that shows the file type e.g. Word icon for .doc and .docx files.
Add/Edit html file - A blank page for now.
Configuration - A page to define the configuration values needed for GitHub action run by API, and the OneDrive integration

Layout:
The layout should include:
- the fullswing logo, same logo used in fullswing-blog
- logout icon link, use a logout icon
- A navigation bar with links for dashboard, add blog/page
- Horizontally centered content that will display the page contents depeneding on the route

Database:
- the database will be a OneDrive folder that contains the blogs and html pages

Technology:
- typescript, Node, svelte web components, OneDrive integration, latest OAuth

Plan:
Analyze fullswing-blog/src/lib folder and verify what code should be moved to shared libs/ folder in root folder
