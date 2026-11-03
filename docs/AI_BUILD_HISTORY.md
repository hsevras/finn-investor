# AI-assisted build journal

This is an honest summary of this build session. It is **not** a fabricated conversation transcript or a substitute for the actual ChatGPT conversation export requested by ENAM. Attach/share the real conversation separately.

## Original user prompt

> I've attached two PDFs for the ENAM AI Engineer Build Challenge: the main assignment and the reference document. Read both carefully and help me build the actual working prototype, not just a plan.
>
> I want to make a strong submission, so focus on what the evaluators care about: creativity, product sense, clean design, technical decisions and a working product.
>
> You can choose the tech stack, architecture and features. Prioritize a few well-executed features over trying to implement everything. The app should be mobile-first, visually polished, interactive and genuinely useful to an investor. Cover both push and pull functionality, using the data sources mentioned in the assignment. Keep the research grounded in primary sources and make sure it can work with companies beyond the demo portfolio.
>
> Use free tools and APIs wherever possible. Make reasonable technical decisions yourself instead of repeatedly asking me questions. Don't just generate a good-looking interface with fake functionality. Implement the backend, connect real data wherever feasible, and clearly identify any demo or fallback data.
>
> I want you to build the complete runnable project, check the code for errors, and test whatever you can. Also provide the repository structure, setup instructions, deployment guidance and a short covering note explaining the decisions, trade-offs and future improvements.
>
> Follow the assignment requirements closely, but use your own judgment to make the product stand out. Don't stop at suggestions or planning—actually implement as much as possible and clearly explain anything that couldn't be completed.

## Decisions and evidence from the session

1. Read both supplied PDFs. Chose two small workflows: attention-first portfolio briefing and primary-document research.
2. Set up a TypeScript/React Worker project with D1 rather than a frontend-only simulation. Chose an 18-company cross-sector portfolio and outside-portfolio research examples.
3. Probed actual public providers. Yahoo query1 rate-limited; query2 returned histories. NSE announcements and Screener links were reachable. BSE PDF downloads returned 403.
4. Added generic NSE annual-report and company-transcript discovery. Retained direct document URLs, publication times, physical page numbers and retrieval time. The Node collector generated the checked-in real caches.
5. Implemented deterministic announcement triage, exact EOD threshold math, persistent settings/inbox/reading list, filtering and same-origin APIs. Added input/size/timeout bounds and owner scoping.
6. Implemented PDF extraction and a zero-key evidence retriever. Added an optional Groq adapter with source-only prompting and citation-ID validation. Did not invent financial tables or claim that citation checks guarantee entailment.
7. Built a responsive sage/cream interface, inspected it in the browser at desktop and a 390px embedded viewport, and increased text contrast/size after visual review.
8. Found and fixed practical gaps during verification: BSE fallback route, missing saved-item persistence across digest windows, complete filing-log access, mobile removal controls, bounded evidence lengths, source chunk boundaries, and the need to filter broad exchange responses before storing them.
9. Seven core tests and eight compiled-Worker/D1 integration checks passed. A generic COFORGE annual-report probe worked in Node; hosted development discovery failed and remained visibly reported.
10. Prepared setup/deployment documentation, covering email draft and submission handoff. The user then created https://github.com/hsevras/finn-investor and the complete source was uploaded using the connected GitHub tools. A genuine conversation-share link still needs the actual conversation export.

No subagents were used. No external model key was supplied; optional live model synthesis remains untested. Refer to TEST_REPORT.md for scope and limitations rather than treating this journal as proof of unexecuted checks.
