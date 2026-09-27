# Research: Remote Code Fences

## Decision: Retrieve sources during publication

**Rationale**: The project publishes static HTML and must remain readable without a browser-side
source-fetching runtime. Build-time retrieval also makes failures visible before deployment.

**Alternatives considered**: Fetching from the browser would keep HTML smaller but introduces
runtime availability, CORS, CSP, and third-party dependency concerns for every visitor.

## Decision: Use the existing Node.js runtime fetch capability

**Rationale**: Node.js >=20.19.0 is already required, and the feature needs only HTTPS text
retrieval. Adding a dependency would increase the generator's maintenance surface.

**Alternatives considered**: A new HTTP client library is unnecessary for the bounded GET requests
needed by this feature.

## Decision: Restrict sources to approved HTTPS hosts

**Rationale**: A source directive controls a build-time network request. Protocol and host
validation prevents accidental retrieval from arbitrary internal or untrusted destinations. The
initial approved host is `raw.githubusercontent.com`, matching the requested use case.

**Alternatives considered**: Allowing every URL is more flexible but creates an avoidable SSRF and
content-trust boundary for a static build.

## Decision: Bound requests and cache by URL per publication

**Rationale**: Timeouts and response-size limits prevent a remote source from hanging or exhausting
the build. A per-publication cache prevents duplicate requests from producing inconsistent blocks
and reduces network traffic.

**Alternatives considered**: An unbounded fetch has poor failure behavior; a persistent cache adds
state and invalidation concerns that are not needed for one build.

## Decision: Recommend version-specific source URLs

**Rationale**: Branch URLs are convenient but mutable. Commit-specific URLs preserve the exact source
snapshot used by an article and make repeated publications reproducible.

**Alternatives considered**: Branch-only references are simpler but cannot guarantee stable output.
