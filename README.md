# ApplyFlow

ApplyFlow is an AI-assisted job application workspace. It brings job discovery, candidate information, application drafting, review, and application tracking into one browser-based experience.

## The Problem

Job seekers often have to repeat the same work across many job boards and employer application forms:

- Finding relevant roles across a large and noisy set of opportunities
- Comparing job requirements with their profile
- Re-entering the same personal, experience, education, and resume information
- Keeping track of drafts, submitted applications, and changing statuses

ApplyFlow gives the candidate one place to manage this workflow and makes the application process accessible to an AI agent through WebMCP.

## What We Are Building

The app provides a complete candidate workflow:

1. Discover and filter jobs by keyword, location, experience, work mode, salary, and job type.
2. Open a job to inspect its responsibilities, requirements, and fit information.
3. Create a pre-filled application draft from the candidate profile.
4. Review and complete the application in the existing UI.
5. Validate the application before submitting it.
6. Track application status from the applications workspace.

This repository is currently a frontend prototype. Jobs, candidate data, and applications are local app data, and application changes are persisted in browser `localStorage`.

## WebMCP Integration

ApplyFlow uses the browser's native WebMCP/model context interface to expose read-only application data as tools. On startup, `src/main.tsx` calls `registerWebMcpTools()`. The integration feature-detects `document.modelContext` first, with `navigator.modelContext` as a compatibility fallback, then registers tools imperatively with `registerTool()`. Unsupported browsers continue to work normally and show a non-blocking diagnostic.

The available tools are:

| Tool | Purpose | Changes application state? |
| --- | --- | --- |
| `search_jobs` | Find jobs using a keyword and result limit | No |
| `get_job_details` | Read the full details for a known job ID | No |
| `get_application_status` | Read application status by application ID or job ID | No |
| `get_profile_summary` | Read the signed-in candidate profile summary | No |

Each tool has a description and a JSON Schema input contract so the agent can select the appropriate action and provide structured arguments. Tool execution calls the same read-only application, candidate, and job services used by the React UI. Registration uses an `AbortController` retained for the page lifetime and aborted during page teardown. ApplyFlow does not expose application submission, messaging, profile mutation, or other state-changing actions through WebMCP.

## Using ChatGPT in the App Browser

The intended experience is to open ApplyFlow in a ChatGPT-capable in-app browser or another browser host that supports WebMCP. In that setup, ChatGPT acts as the agent and uses the tools exposed by the page to interact with ApplyFlow:

```text
User: Find database roles.
ChatGPT: Calls search_jobs with the requested query.
User: Show me the best match.
ChatGPT: Calls get_job_details for the selected job.
User: What is my application status?
ChatGPT: Calls get_application_status.
```

The agent does not need to simulate clicks or scrape page content for these operations. It uses the structured WebMCP tools made available by the live page. State-changing actions are intentionally not exposed until explicit user-confirmation handling is implemented.

If the host does not support WebMCP, ApplyFlow still works as a normal web app. The WebMCP diagnostic panel will show `This browser does not support WebMCP.` and agent tool calls will not be available.

## Development

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

The app is served on the local Vite URL shown in the terminal. To create a production build:

```bash
npm run build
```