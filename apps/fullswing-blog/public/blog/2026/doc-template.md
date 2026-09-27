The following is a documentation template standard for software development that I use on some of my documentation. It helps to add all/most of the sections, since the granular details are often missed and can be crucial for new developers trying to understand the software without the original author's background.

```markdown
## OVERVIEW
This section will have an executive summary and will list any important notes, links to subsections, list of repositories and related applications.

Repository: <link to github repository>
Authors: <author name>
Version: #.#.#

## PREREQUISITES
This section will list any prerequisites, dependencies, database/app configuration, and setup required. If it only runs on a certain OS, list the OS. If it runs on multiple OS, list any OS-specific steps. Consider all the steps needed to setup if you started on a new computer.

## BUILD
This section will include all steps required to build/compile the project. List all dependencies to build e.g. build docker, maven, msbuild, Java 8+, powershell. List which OS you can compile project on and any OS-specific steps.

## DEVELOP
This section will include all requirements to develop, maintain the code, and add features. List any tools required e.g. Visual Studio and all dependencies e.g. dotnet SDK 2.2, Java 8+.

## RUN
This section will include all steps required to run the project. Try to be as explicit as possible so the next developer can run the steps easily without needing to fill any gaps.

## DEPLOY
This section will include all steps required to deploy the project. Provide a list links to TeamCity, Octopus, Azure DevOps, Bitbucket Pipelline, etc builds that build and deploy the project.

## DEBUG
This section will include any extra steps needed to debug the project and the location(s) of the logs. List any logging or monitoring tools used, if any.

## TEST
This section will include all steps required to run all unit tests. If applicable, also include steps to run automation or integration tests.

## DISCOVERY
This section will include all non-discoverable code. Include anything like Fody, interceptors, anything decoupled that cannot be “debugged into”, and anything that is not intuitive without prior knowledge of how the system works.

## RESOURCES
This section will include a list of all resources used by the project. List Cloud, server, VM, etc resources used by the project. This is helpful when we need to make a new deployment or if we need to destroy an older version.
```
