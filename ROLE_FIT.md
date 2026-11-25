# Role fit

Fieldwork was built as a response to one role: Head of Enablement Experience & Innovation at Anthropic. This note maps what the posting asks for to what the prototype shows, and it is just as specific about what the prototype does not show.

The mapping was written from the posting text Sean supplied on 2026-11-25. The choices here are derived from that public posting. They do not describe Anthropic's internal systems.

## The posting in one sentence

Enablement built on Claude that is personalized for each seller, delivered in the flow of work and measured by what it changes.

The posting also names what it wants to leave behind: courses, content libraries and one-size-fits-all programs. That is the main design constraint for Fieldwork. The seller never opens a course. They prepare for a real account conversation, make a call, hear the customer and revise.

## What is asked, what is shown

| The posting asks for                                                  | Where Fieldwork shows it                                                                                                                                                                                                                                                                   | What it does not show                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Learning tailored to each seller's role, tenure and live deals        | The account page states its three inputs under the next decision: role, tenure and live deal. The decision, the question to ask, the success criteria, the note on the deal, the rehearsal options and the bar for measurement all change with the seller's profile.                       | Two scripted profiles and one deal. No model tailors anything at runtime.  |
| Guidance in the tools sellers already use, at the moment they need it | The journey opens on a preparation task for an account review seven days away. The "In the flow of work" panel shows where the brief would surface.                                                                                                                                        | The CRM entry point is simulated. Nothing is embedded in a real tool.      |
| Measured by what it changes, beyond completion and satisfaction       | Practice is scored on decisions and on the plan the seller actually built. The review's "Seller impact" section proposes four levels: use in the flow of work, behaviour in the live conversation, customer outcome, then ramp time, win rate and attainment.                              | No measure has been collected. There are no results.                       |
| Knowledge that stays accurate, current and easy to find               | Every piece of advice carries its source, the date it was checked and a "needs review" flag where no review date exists. Unreviewed advice is shown as a question to ask, not a fact.                                                                                                      | A small fixed knowledge pack. No search and no automatic refresh.          |
| Run enablement like a product, tested on live deals before scaling    | The review proposes a staggered pilot on live adoption reviews in one segment. `EVIDENCE.md` lists the tests that exist and the user testing that does not.                                                                                                                                | No discovery with sellers has happened. No one has used it on a live deal. |
| Standards for responsible AI use and data governance                  | Eight standards are listed in the "How this works" drawer and enforced in the interface: a hypothesis is never a diagnosis, unavailable is never zero, customer data needs customer authorization, nothing is applied without a preview, scripted output is never labeled as model output. | No legal, privacy or security review.                                      |
| Fast experiments with new Claude capabilities                         | The coaching and analytics providers are replaceable interfaces, so a real call can be swapped in without touching the views.                                                                                                                                                              | No Claude capability is used at runtime.                                   |

## The gaps an interviewer will notice

**It does not call Claude.** The posting is about enablement built on Claude, and this prototype was built with Claude Code but runs on scripted rules. That is the largest gap between the demo and the role. It is labeled on every screen, and `docs/LIVE_COACHING.md` describes the one genuine call that would close it. A static host such as GitHub Pages cannot hold an API key, so that step needs a small server-side route.

**It has no users.** The posting asks for someone who has shipped experiences at scale and can show that people used them and performed better. A prototype cannot show that. Sean's own history has to carry that claim, and the two should be kept apart in any conversation.

**Its most visible surface is a program builder.** A drag-and-drop lesson builder can read as the course-and-content model the posting wants to move past. In Fieldwork the builder is the seller's work product for a customer, and the seller's own learning happens in the account decision and the rehearsal. The walkthrough should say so in the first fifteen seconds.

**It covers one segment and two roles.** The posting mentions multiple geographies, segments and roles. Fieldwork has an Enterprise AE and a CSM on one Enterprise account.

## If one thing is taken further

Add one genuine, grounded Claude call behind a server-side route, for a single moment in the journey: feedback on the seller's own words in the rehearsal reflection. It would turn "not automatically assessed" into the one place where Claude does something scripted rules cannot, and it would make the central claim of the role visible in the product.
