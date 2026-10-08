# Data safety form: answers to confirm

> Play checks this against the app's behaviour. A TWA's data handling **is the website's**,
> so answer for revoot.in. ⚠️ Mark each line true/false for your site before submitting.

| Question | Likely answer for a swap marketplace |
|---|---|
| Collects or shares user data? | **Yes** |
| Encrypted in transit? | **Yes** (HTTPS) |
| Users can request deletion? | **Must be Yes**: add a "Delete account" option, plus a public URL such as `revoot.in/delete-account` that Play asks for |

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name, email, phone | ✔ | ✘ | Account management | Required |
| Address / approx. location | ✔ if delivery or nearby | to courier partner? | App functionality | — |
| Photos | ✔ (item listings) | ✘ | App functionality | Required to list |
| Messages (in-app chat) | ✔ if chat exists | ✘ | App functionality | — |
| Purchase history | ✔ if payments | to payment gateway | App functionality | — |
| App interactions / diagnostics | ✔ if GA / Clarity / Sentry etc. | to that vendor | Analytics | — |

**Account deletion URL is mandatory** for any app with accounts. No URL means rejection.
