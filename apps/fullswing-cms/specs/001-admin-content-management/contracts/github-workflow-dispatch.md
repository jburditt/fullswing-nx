# GitHub Workflow Dispatch Contract

## Configuration

The server-side configuration identifies:

- Repository owner and repository name.
- Workflow ID or workflow file name.
- Branch or tag reference to run.
- Optional non-secret input values declared by that workflow.
- A reference to a fine-grained GitHub token scoped to the target repository with Actions write permission.

The GitHub workflow must declare the `workflow_dispatch` event. Validate required values when configuration is saved. The CMS must not accept a different owner, repository, workflow, ref, API base URL, or arbitrary input object from the dispatch request.

Non-secret settings are persisted through the server-side configuration store. The GitHub token is written to a deployment-provided secret store; forms may replace it, but never retrieve or display its saved value. Neither token nor request authorization headers may be logged.

## Dispatch Operation

- Access: allowlisted administrator session plus CSRF validation.
- Input: dispatch intent only; target and inputs are loaded from saved configuration.
- API operation: GitHub REST `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`.
- Success: return `Accepted` only for GitHub's documented success response; record the returned run ID/URL when supplied. Explain that workflow execution may still be running.
- Failure: map invalid settings, authorization failure, missing/unavailable workflow, rate limiting, and provider errors to explicit non-sensitive failure categories. Never report dispatch as accepted after an error.
- No operation in this feature polls the run, retries a mutating dispatch automatically, or claims deployment completion.

## Security and Tests

The GitHub adapter receives its credential only from the server-side secret store. Restrict configuration to one selected repository/workflow target and a bounded set of non-secret declared inputs. Test accepted responses, invalid credentials, missing workflow/dispatch trigger, invalid configuration, throttling, CSRF rejection, and unauthorized users using a mocked Octokit client. Verify secrets do not appear in HTML, client assets, errors, or logs.