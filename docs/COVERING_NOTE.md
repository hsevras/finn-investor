Subject: ENAM - IIT screening - 2027

Hi ENAM team,

I built FINN around two investor workflows: a portfolio briefing that makes important changes easier to spot, and a research desk that takes a question back to the company’s own documents.

The prototype watches 18 NSE companies across sectors. It prioritises exchange disclosures, collapses routine updates, and applies configurable EOD price and volume thresholds. Rules, watchlists, saved items and a deduplicated alert inbox persist on the backend. Research discovers primary reports and call transcripts beyond the demo portfolio and returns evidence with original PDF page links.

I chose TypeScript/React, a Worker backend and D1 so the same project can run locally or as a hosted application. Arithmetic and triage do not need model calls. The default research path ranks original evidence without an API key; an optional Groq adapter adds cited synthesis. Real dated caches keep the demonstration useful when public endpoints throttle requests, and the UI identifies source coverage and failures.

I deliberately left out financial-table normalisation, automated four-quarter guidance scoring, OCR and OS push. The current product does not pretend that raw PDF text is a verified financial model. My next step would be a guidance ledger that checks period, currency and accounting basis before judging what management delivered.

Prototype: https://finn-investor-sarvesh.epicdulse16.chatgpt.site (private preview; evaluator access must be granted before submission)
GitHub: https://github.com/hsevras/finn-investor
AI build history: [attach the conversation export or add its share link; the repository also includes a build journal]

Regards,
Sarvesh Bharambe
IIT Kanpur
