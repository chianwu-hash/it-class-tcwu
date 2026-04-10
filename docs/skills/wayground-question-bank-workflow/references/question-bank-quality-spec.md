# Question Bank Quality Spec

Use this spec before any local bank is sent to Wayground.
This document makes quiz quality requirements explicit so the first draft is stronger and fewer review loops are needed.

## Purpose

The local bank should not merely be usable.
It should already be:
- within scope
- factually correct
- clear for elementary students
- hard enough to distinguish understanding levels
- resistant to being solved by pure common sense or tone-matching

## Non-negotiable gates

Do not move a bank to Wayground if any of these are still true:
- there is a suspected wrong answer
- the stem is missing information needed to solve the problem
- there are two plausible best answers
- there are obvious duplicate questions
- the requested question count is wrong
- the requested range is wrong
- the difficulty split is obviously off
- the item is testing test-design knowledge, teaching goals, or workflow meta-knowledge instead of the student-facing subject content
- the answer could change based on a student's personal life experience, household norms, or subjective category judgment

## Source-of-truth rules

1. The textbook scope is the primary source of truth.
2. The local bank is the review object.
3. Gemini is a second reviewer, not the final judge.
4. If Gemini conflicts with the textbook, re-check the textbook first.
5. Local exam style should be preserved in spirit, but items still have to fit the actual Wayground delivery format.

## Platform-fit rule

Wayground is not a paper test.
When a local school exam commonly uses a certain item type, preserve the testing goal and style if it can be expressed well as a Wayground single-choice item.

If a paper-style item does not fit Wayground directly:
- translate it into the closest valid single-choice form
- keep the same underlying skill or concept when possible
- do not force a direct copy if that would make the item distorted, vague, or multi-answer

If a paper-style item cannot be converted cleanly into a good single-choice item, do not use it just to imitate the paper format.

## Quality dimensions

Review every bank across these six dimensions.

### 1. Scope match

Check:
- every question belongs to the requested lesson, unit, or chapter range
- no question depends on knowledge from later units
- examples and wording still align with the actual textbook emphasis

Pass standard:
- no out-of-scope questions
- no "probably from another unit" questions

### 2. Answer correctness

Check:
- the keyed answer is actually correct
- the stem contains enough information
- there is only one best answer
- calculations and data are internally consistent
- the item does not rely on subjective category boundaries such as whether something "counts" as a hobby, chore, good behavior, or free time activity unless the context clearly defines the category

Pass standard:
- zero known wrong answers
- zero under-specified calculation questions
- zero dual-correct questions
- zero items whose answer depends on personal interpretation rather than the provided language or content

### 3. Coverage balance

Check:
- the bank does not over-focus on one idea while ignoring others
- repeated concepts are intentional and limited
- the requested range is represented reasonably evenly
- the bank still reflects the expected item-type structure of the subject and the local exam style, not just the content scope

Pass standard:
- the same concept should usually not appear more than twice unless the user explicitly wants drill practice
- if a concept appears three times or more, each question must test a different layer
- if the local exam style consistently includes foundational item types, those item types should still appear unless the user explicitly requests a different structure
- the bank should preserve the local exam structure in a Wayground-appropriate form rather than copying paper-only formats mechanically

Allowed different layers:
- recognition
- explanation
- application
- comparison
- judgment in context

### 4. Wording clarity

Check:
- the stem is readable for the target grade
- the question asks one thing at a time
- wording is not vague, abstract, or teacher-facing
- the student can tell what is being compared or judged
- the item is student-facing and does not ask about distractor design, difficulty labels, review categories, or curriculum-planning logic
- if the item uses a category label, the category is defined by the sentence, dialogue, text, chart, or lesson context rather than left to the student's personal interpretation

Pass standard:
- no ambiguous stems
- no meta-teaching wording such as "the unit mainly wants to teach..."
- no phrasing that requires guessing the teacher's intention
- no "meta" items that ask students to evaluate how a question was designed instead of answering the subject matter
- no bare classification items where multiple answers could become reasonable under different home or life contexts

### 5. Distractor quality

This is the most important improvement area.

Bad distractors:
- absurd options
- joke-like options
- options unrelated to the stem
- options that can be removed by tone alone
- options that are obviously "bad attitude" while the correct answer is obviously "good attitude"

Good distractors:
- reflect likely student misconceptions
- sound plausible at first glance
- are close enough that the student must understand the lesson
- differ for a real reason, not just because one sounds nicer

Pass standard:
- at least two distractors in most medium or hard questions should be plausible enough that a student could reasonably hesitate
- the correct answer should not simply be the longest, nicest, or most morally positive option
- avoid making the wrong options wildly extreme unless the item is intentionally easy

#### Special rule for synthesis and summary questions

Questions that ask students to identify the "core spirit," "common theme," or "main message" across multiple texts or units are especially prone to weak distractors.

For these questions, every wrong option must correspond to a specific misreading that a student could arrive at by only partially engaging with the material — for example, reading one text but not integrating across all, or focusing on a surface detail while missing the deeper theme.

Wrong options that represent moral positions no text in the unit would convey are not valid distractors for these questions, even if they are clearly false. A student who read all three texts carefully should still need to think before eliminating each wrong option.

### 6. Difficulty control

Difficulty should come from thinking depth, not only wording length.

Easy questions should test:
- key fact recognition
- basic meaning
- direct textbook recall

Medium questions should test:
- understanding
- simple application
- choosing between similar ideas

Hard questions should test:
- comparison
- multi-factor judgment
- interpreting a situation using the lesson concept
- distinguishing between two plausible options

Pass standard:
- hard questions must not be hard only because they are longer
- a hard question should usually require actual comparison or reasoning
- if the answer is obvious because three options are ridiculous, it is not hard

## Subject-specific reminders

### Math

- never leave a quantity implied if the problem needs it
- verify all arithmetic
- if approximate answers are used, options must support the expected rounding method
- if the local paper test often uses fill-in or calculation items, convert them into strong single-choice items with plausible computational distractors instead of flattening the whole bank into concept-only questions

### Language / World Languages / Chinese

- avoid vague "which is better" wording without textual basis
- make sure options are anchored in the lesson, not only in general morals
- if testing vocabulary or meaning, make the contrast precise
- do not let the whole bank collapse into reading-comprehension items if the local Chinese exam style normally includes foundational language items
- when the local exam style consistently includes things like zhuyin, character form/sound, idioms, or correction items, keep an appropriate share of those item types unless the user explicitly asks for a reading-only bank
- if a paper item is not directly usable on Wayground, rewrite it as a clean single-choice item such as pronunciation judgment, character-form discrimination, or sentence-based usage checking

### English

- check that only one answer fits the sentence or dialogue naturally
- avoid multiple socially acceptable closings unless the prompt narrows the context
- avoid naked category questions like "Which one is a free time activity?" when choices could be interpreted differently in real life; anchor the judgment in a sentence, dialogue, or short scenario instead
- if the local paper exam uses listening-style items, preserve the listening feel with short natural dialogues or scenario-based prompts when true audio is not part of the current Wayground build

### Social studies

- avoid turning every question into a values question
- use realistic misconceptions as distractors
- do not over-repeat the same civic attitude in different wording
- if the local paper exam uses many true/false or statement-judgment items, keep that structure through well-written single-choice statement evaluation items

### Science

- make sure the question tests the intended concept, not only common sense
- if a phenomenon has multiple causes, narrow the question clearly
- if the local paper exam relies on figures, experiments, or grouped items, convert them into textually clear single-choice sets without losing the key observational or data-reading task

## Recommended review workflow

### Tier 1: mandatory local review

The working AI must always do this.

Checklist:
- scope
- answer key
- duplicates
- wording
- distractors
- difficulty

### Tier 2: Gemini review for higher-risk banks

Use Gemini especially for:
- social studies
- language subjects
- banks where distractors feel weak
- banks where many items are judgment-based

Do not send every bank by default if cost is a concern.

### Tier 3: targeted revision only

After review, revise only:
- flagged questions
- overlapping concepts
- weak distractors

Do not rebuild the whole bank unless the bank is broadly flawed.

## Stop conditions

A bank is good enough to proceed when:
- no definite errors remain
- no dual-answer items remain
- no under-specified items remain
- concept repetition is acceptable
- distractors are no longer obviously lazy

Perfection is not required.
If the remaining issues are minor suggestions rather than correctness or discrimination problems, stop and move forward.
