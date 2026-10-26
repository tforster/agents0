# Shaping Work for Agents <!-- omit in toc -->

How Dev0 shapes work into epics and stories, and why that matters most when the doer is an AI coding agent. The architect and doer roles, and the tests that define simplicity, are defined in [Dev0](https://github.com/tforster/dev0); this document assumes them. It moved here from the Dev0 philosophy when the toolkit became Agents0, because it is about delivering Dev0 through agents rather than about Dev0 itself.

## Table of Contents <!-- omit in toc -->

- [1. How Work Is Shaped](#1-how-work-is-shaped)
- [2. Dev0 and Agents](#2-dev0-and-agents)

## 1. How Work Is Shaped

Dev0 is architecture-first, and that shapes how work is broken down, whether it lives in Jira, a Markdown file or sticky notes on a whiteboard.

- **An epic holds the architecture.** It is a container for enough work to deliver one feature, and it carries the design: detailed enough to answer most questions before they are asked. It lives as a document beside the code, not crammed into a ticket field.
- **A story is a day or less of work.** It points at the sections of the epic it implements and carries acceptance criteria written as behaviour: given, when, then.
- **Work too small for an epic is a story with its own blueprint.** This is the exception: most work, perhaps four pieces in five, still shapes into an epic. When a piece of work does not justify one, the story carries the design itself, in the same kind of document beside the code.
- **A doer needs nothing beyond the story and its blueprint**, the epic's or the story's own. Not the roadmap, not the dozen other epics, not the reasoning behind the business. If the story and its blueprint do not answer a question, the design has a gap.
- **Gaps are asked, not guessed.** The doer stops and asks; the architect answers; the answer goes back into the blueprint so the next person does not have to ask.

Acceptance criteria and design are different things, and confusing them explains a lot of bad results. Acceptance criteria tell you whether you are done. They do not tell you what to build. Hand someone only acceptance criteria and they have to invent the design, and their invention is not yours. It will be plausible, and it will be the median.

## 2. Dev0 and Agents

This matters more now than at any point in my career, because a growing share of code is written by AI coding agents.

If you have used one seriously, you know the moment. The agent finishes. The tests pass. You open the diff and start deleting: a defensive check on an argument that cannot be wrong, a `utils/` folder holding one function with one caller, a validation library pulled in to check two fields. None of it is wrong, exactly. It is just not what an experienced engineer would have written. An agent is trained on the public corpus of software, and that corpus is overwhelmingly framework-first, defensive and dependency-happy -- a corpus of things people said yes to. It writes very good median code.

Dev0 works the same with agents as with people. An agent is a doer, and a very fast one. Give it a design that closes the decisions, and it builds what you meant; give it only acceptance criteria, and it builds the median. So the architect's job moves upstream: spend your judgement before the code is written, once, on the design, instead of afterwards, stripping every diff by hand. A design constrains every file an agent touches. An edit after the fact fixes one.

Which answers the question every senior engineer is asking right now. Agents are very good at construction and will get better. But look at what Dev0 asks of an architect: drawing boundaries, saying no, closing decisions before they become code, recognising correct code for the wrong problem, and taste. None of that gets cheaper when construction gets cheaper. It gets more valuable, because an architect's judgement now shapes every file the agents write, not just the files one person can type.

The engineers most exposed are the ones who let the agent make the architectural decisions by default. Some notice and spend their days editing the median into shape. Many never notice at all, and their codebases quietly grow into tangles, carrying debt no one knows is there until it comes due.

[← Back to Explanation](./README.md)
