# Code Readability Guidelines

This document outlines the code readability standards for the GEI project, drawing from "Clean Code" by Robert C. Martin and other industry best practices.

## 1. Meaningful Names

- **Use Intention-Revealing Names:** Variable, function, and class names should tell you why it exists, what it does, and how it is used.
  - *Bad:* `const d = 5; // days elapsed`
  - *Good:* `const daysElapsed = 5;`
- **Avoid Disinformation:** Avoid names that mean something else in other contexts (e.g., `accountList` if it's not actually a `List`).
- **Use Pronounceable Names:** If you can't pronounce it, you can't discuss it without sounding like an idiot.
- **Use Searchable Names:** Single-letter names and numeric constants are hard to find in a body of text.
- **Class Names:** Should be noun or noun phrases (e.g., `User`, `Account`). Avoid `Data` or `Info` suffixes.
- **Method Names:** Should be verbs or verb phrases (e.g., `postPayment`, `deletePage`, `save`).

## 2. Functions

- **Small!:** Functions should be small. Then they should be smaller than that.
- **Do One Thing:** Functions should do one thing. They should do it well. They should do it only.
- **One Level of Abstraction per Function:** Mixing levels of abstraction within a function is confusing.
- **Function Arguments:** Ideally zero. Then one (monadic), then two (dyadic). Three (triadic) should be avoided where possible. More than three (polyadic) requires very special justification.
- **Have No Side Effects:** A function should not do hidden things (e.g., modifying global variables or state unexpectedly).
- **Command Query Separation:** Functions should either do something (command) or answer something (query), but not both.

## 3. Comments

- **Don't Comment Bad Code — Rewrite It:** Comments are often used to cover up failure to express ourselves in code.
- **Explain Yourself in Code:** Prefer making the code clear over adding a comment.
- **Good Comments:**
  - Legal comments (copyright).
  - Informative comments (e.g., explaining a regex).
  - Clarification of intent.
  - Warning of consequences.
  - TODO comments (sparingly).

## 4. Formatting

- **Vertical Openness:** Keep related lines of code together and separate distinct sections with blank lines.
- **Vertical Density:** Lines of code that are tightly related should appear vertically dense.
- **Vertical Ordering:** High-level concepts should come first, with details following below (like a newspaper article).
- **Horizontal Formatting:** Avoid long lines. Use Prettier to maintain consistent line lengths and indentation.

## 5. TypeScript Specifics

- **Prefer Interfaces for Object Shapes:** Use `interface` for public APIs and `type` for unions/intersections.
- **Be Explicit with Return Types:** Especially for exported functions and complex logic.
- **Avoid `any`:** Use `unknown` if the type is truly unknown, or better, define a proper type/interface.
- **Use Enums or Literal Types:** For sets of related constants.
- **Stay Strict:** Maintain `strict: true` in `tsconfig.json`.

## 6. React & Next.js Components

- **Component Size:** Keep components small. If a component exceeds 200 lines, consider splitting it.
- **Prop Destructuring:** Destructure props in the function signature for clarity.
- **Hooks Order:** Follow the standard React hooks order (useState, useEffect, useMemo, etc.).
- **Custom Hooks:** Extract complex logic into custom hooks.
- **File Structure:** One component per file. Use descriptive filenames (e.g., `SearchableSelect.tsx`).

## 7. Tailwind CSS

- **Consistency:** Follow a consistent order for classes (e.g., layout -> spacing -> typography -> colors). Prettier plugin for Tailwind handles this.
- **Readability:** If a class list is too long, consider using `cn()` utility or breaking it into multiple lines if appropriate.
- **Avoid Over-optimization:** Don't abstract Tailwind classes into CSS variables unless they are truly reusable theme tokens.

## 8. Database (SQL)

- **Keywords in Uppercase:** `SELECT`, `FROM`, `WHERE`, `JOIN`.
- **Meaningful Table/Column Names:** Use snake_case.
- **Indentation:** Align keywords and maintain readable spacing in complex queries.
- **RLS Policies:** Keep policy expressions simple. If complex, extract into a Postgres function.

## 9. Error Handling

- **Use Exceptions over Return Codes:** Prefer `try-catch` or specialized error handling libraries.
- **Provide Context:** Include enough information in error messages to diagnose the problem.
- **Don't Return Null:** Avoid returning `null` from methods; consider throwing an exception or returning a "Special Case" object.
