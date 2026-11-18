<p align="center">
  <img src="src/app/icon.svg" alt="MabatID logo" width="72" height="72" />
</p>

<h1 align="center">MabatID</h1>

<p align="center"><strong>One step unlocks the next.</strong></p>
<p align="center">A clearer path from baseline documents to Philippine government IDs.</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#contributors">Contributors</a> ·
  <a href="#feedback">Feedback</a>
</p>

## About

Getting your first valid ID can feel circular: you need an ID to apply for another ID. **MabatID** helps students, young adults and first-time jobseekers understand where to start, what to prepare, and which documents can unlock their next application.

Explore an interactive ID path, compare application routes, and follow practical checklists based on the documents you already have. Try it as a guest, or create a profile to save your progress.

MabatID is an independent guidance project and is not affiliated with a government agency. Requirements, fees and acceptance can vary by office and change over time; confirm the latest details with the issuing agency before applying.

## Features

- **Interactive ID path** — Explore connected IDs and documents, pan and zoom through the graph, and open a guide from any supported target.
- **Personalized planning** — Find routes from your current documents to a target ID, compare alternatives, and prioritize fewer documents or lower estimated fees.
- **Search and filters** — Browse IDs and documents by type, purpose, estimated cost and application preference.
- **Application guides** — Review prerequisites, eligibility questions, estimated fees, application channels and preparation steps.
- **Progress tracking** — Save what you already have, track goals, choose a priority ID and work through application checklists.
- **Profiles and guest previews** — Save your IDs, preferences and progress, or explore the ID path before creating a profile.
- **Backup and device transfer** — Export and restore JSON backups, review differences before replacing progress, or move a profile with an expiring transfer code.
- **Weekly likes and private feedback** — Leave a weekly like, or use a completed device profile to submit an optional star rating and feedback from Settings.

The catalog currently includes **21 acquisition guides** and **9 supplementary inventory items**. Credential groups describe an item's purpose; they are not difficulty levels or a requirement to collect every ID.

## How it works

1. **Start with what you have.** Select existing IDs and documents, then answer relevant eligibility questions.
2. **Choose a goal.** Explore suggested next IDs or select a specific target from the tree or Browse view.
3. **Compare your options.** Review document requirements, remaining questions, application routes and estimated fees.
4. **Prepare and track.** Follow the checklist and record progress as you complete each step.

Under the hood, the planner works backward from a target through **AND / OR / at-least-N requirements**, detects circular dependencies, and orders the chosen route using topological sorting. Search is bounded, and the interface discloses incomplete exploration. Unknown eligibility stays a question rather than being treated as confirmed.

## Tech stack

| Area | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shared design tokens and CSS animations |
| UI components | Base UI, shadcn/ui, Lucide icons |
| Interactive graph | React Flow (`@xyflow/react`) and Dagre |
| Planning | Custom TypeScript requirement evaluator and bounded search engine |
| Data and services | Supabase Postgres, browser storage, Web Locks and Web Crypto |
| Testing and tooling | Node.js test runner, `tsx`, ESLint and Turbopack |

## Feedback

Anyone can leave a weekly like from the **Rates & Feedbacks** section. After completing profile setup, users can submit written feedback and an optional 1–5 star rating from **Settings**.

Feedback is private to the MabatID team. Please leave out ID numbers, document scans and other sensitive personal information.

## Contributors

| Contributor | Role | Contributions |
| --- | --- | --- |
| **[Xavier Imbang](https://github.com/sagembng)** | Product Lead & Frontend Designer | Product concept, frontend design, user experience, prerequisite research and application guides. |
| **[Kristian Lawrence Villaraza](https://github.com/kitarsin)** | Backend & Database Engineer | Backend services, database, planning logic, prerequisite modeling, category filtering and APIs. |

## Report an issue

Found a bug or an outdated requirement? Open a [GitHub issue](https://github.com/sagembng/MabatID/issues) with a description of the problem. For guide corrections, include the issuing agency's source and any relevant location or applicant conditions.

Technical setup and maintenance notes are available in the team's [technical reference](docs/technical-reference.md).

## License

A license has not yet been specified in this repository.
