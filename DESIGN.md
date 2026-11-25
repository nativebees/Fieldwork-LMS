# Design

Fieldwork is a warm editorial workbench: paper surfaces, a strong type hierarchy, ruled sections and compact professional controls. These are Fieldwork's own choices, inspired by Claude's visual language. They are not a reproduction of Anthropic's website or an assertion about official typography.

## Tokens

All tokens live in `src/styles/index.css` under `@theme`. `src/styles/tokens.test.ts` reads that file and asserts the contrast of every text pairing, so the check cannot drift from what ships.

| Token                       | Value                 | Use                                                      |
| --------------------------- | --------------------- | -------------------------------------------------------- |
| `canvas`                    | `#FAF9F5`             | Page background                                          |
| `paper`                     | `#FFFFFF`             | Working surfaces                                         |
| `surface`                   | `#E8E6DC`             | Subtle fills, segmented controls                         |
| `surface-soft`              | `#F3F1EA`             | Footers of cards, quiet panels                           |
| `ink`                       | `#141413`             | Primary text, primary buttons                            |
| `ink-2`                     | `#5C5B57`             | Secondary text                                           |
| `ink-3`                     | `#6E6C66`             | Tertiary text on light surfaces only                     |
| `rule`                      | `#E5E2DC`             | Hairlines                                                |
| `rule-strong`               | `#CFCBC2`             | Section rules, card borders                              |
| `control`                   | `#8F8C84`             | Input borders, 3:1 against paper                         |
| `terracotta`                | `#D97757`             | Selected states, small accents, the focus mark in charts |
| `terracotta-deep`           | `#A8482A`             | Terracotta text and filled buttons, 5.8:1 with white     |
| `sage`                      | `#788C5D`             | Supporting structure                                     |
| `sage-deep`                 | `#4C6035`             | Positive text                                            |
| `ochre-deep` / `ochre-wash` | `#7A5A12` / `#F7EFD9` | "Needs review" states                                    |

The base terracotta and sage are too light for small text (3.1:1 and 3.7:1 on white), which is why the deep variants exist. A test pins that fact.

## Type

| Role               | Family                                   | Notes                                              |
| ------------------ | ---------------------------------------- | -------------------------------------------------- |
| Titles             | Newsreader (variable, optical size axis) | Account, program and lesson titles, sponsor speech |
| Controls and body  | Instrument Sans (variable)               | Navigation, forms, instructions                    |
| Technical metadata | IBM Plex Mono                            | Rule ids, dates, counts in meta lines              |

Fonts are bundled from Fontsource under the SIL Open Font License, Latin subset only, with system fallbacks. There is no font CDN at runtime. Metrics in columns use tabular figures.

## Layout

Every view has one focal point. On the account page it is the next decision, marked with a terracotta rule. In the rehearsal it is the current choice. In the studio it is the journey. In the preview it is the lesson. In the review it is the comparison.

The studio is a three-column workbench on wide screens: a 240px lesson library, a flexible journey and a 300px inspector. Below 1024px the columns stack in the same task order. The library becomes a horizontal strip and the inspector opens as a drawer from each lesson's edit button.

Radii are small (2 to 8px), borders are fine, and shadow appears only where something is lifted: a dragged card, a dialog, a tooltip. A faint static paper grain sits on the canvas as an inline SVG.

## Interaction

Drag and drop uses dnd-kit. A lesson can be dragged from the library into the journey, and lessons can be reordered within and across modules. The second module's header sits inside the sortable list, so dragging past it moves a lesson between modules without a separate container.

Keyboard users get the same actions. The drag handle is a focusable button: space picks up, arrows move, space drops, escape cancels. Each step announces the resulting position, for example "would move to position 3 of 4, in Repeat it with confidence". Move up and move down buttons are a second route, and the library's plus button adds a lesson without dragging. On touch screens only the handle starts a drag, so the page still scrolls.

Nothing replaces the author's work without consent. Every tailoring action and every change suggested by the customer's constraint opens a preview that lists each change, and the author applies or cancels it. Removing a lesson shows an undo bar that stays until dismissed.

Motion runs 120 to 180ms and is limited to reordering, selection and entering content. `prefers-reduced-motion` reduces all of it to nothing, including the drop animation.

Dialogs and drawers trap focus, close on escape or backdrop click and return focus to the control that opened them.

## Status and colour

Status is never carried by colour alone. Every state has an icon and words: present, missing, needs review, demonstrated, not yet.

This matters more than usual here. The palette validator showed that terracotta and sage are nearly indistinguishable under protanopia (a colour difference of 0.7, where 8 is the target). So the two are never used as the only difference between two states, and the cohort chart does not place them side by side.

## The cohort chart

The cohort breakdown is a table with a thin segmented bar per row, because the reader needs the figures and the bar only shows the split. The chart palette is a fixed order of terracotta `#D97757`, blue `#3F74AD` and green `#7A9A3E`, with neutral grays for other and inactive seats. That set passes the lightness, chroma, colour-vision and contrast checks on white. An unavailable value is drawn as a hatch, never as an empty or zero-length bar. Hover and keyboard focus show each part's name, count and share, and the table carries every number as text.

## Pip

Pip is an original terracotta ink-seed with a folded-paper corner, drawn as inline SVG in `src/components/Pip.tsx`. It is not the Claude mascot or an altered Anthropic logo. It has four states: ready, considering, a helpful nudge and task complete.

Pip appears in three situations only: when asked on a recommendation, after an unsuccessful practice attempt, and when an attempt meets every criterion. It sits inline in the page, never floats over the work, never animates continuously and never claims to have feelings. Its copy is about the decision, for example "This could be an access issue. Check the permission before assigning training."

## Persistent boundaries

A strip at the top of every page shows "Independent portfolio concept by Sean Gillespie", "Demo · synthetic customer data", the coaching mode and the save state. The coaching label comes from the active provider, so it reads "Scenario coaching" unless a real provider is available. The "How this works" drawer holds the synthetic and live boundaries, the architecture and the source list, which keeps technical explanation out of the learning flow.
