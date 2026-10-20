---
name: zod
description: Zod schema validation best practices for type safety, parsing and error handling. Use when defining z.object schemas, string validations, safeParse/parse, z.infer, refinements, transforms, discriminated unions or error formatting, or when reviewing code that imports zod. Does not cover React Hook Form integration or OpenAPI client generation.
---

# Zod Best Practices

Comprehensive schema validation guide for Zod in TypeScript applications. Contains 43 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new Zod schemas
- Choosing between parse() and safeParse()
- Implementing type inference with z.infer
- Handling validation errors for user feedback
- Composing complex object schemas
- Using refinements and transforms
- Optimizing bundle size and validation performance
- Reviewing Zod code for best practices

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Schema Definition | CRITICAL | `schema-` |
| 2 | Parsing & Validation | CRITICAL | `parse-` |
| 3 | Type Inference | HIGH | `type-` |
| 4 | Error Handling | HIGH | `error-` |
| 5 | Object Schemas | MEDIUM-HIGH | `object-` |
| 6 | Schema Composition | MEDIUM | `compose-` |
| 7 | Refinements & Transforms | MEDIUM | `refine-` |
| 8 | Performance & Bundle | LOW-MEDIUM | `perf-` |

## Quick Reference

### 1. Schema Definition (CRITICAL)

- [`schema-use-primitives-correctly`](references/schema-use-primitives-correctly.md) - Use correct primitive schemas for each type
- [`schema-use-unknown-not-any`](references/schema-use-unknown-not-any.md) - Use z.unknown() instead of z.any() for type safety
- [`schema-avoid-optional-abuse`](references/schema-avoid-optional-abuse.md) - Avoid overusing optional fields
- [`schema-string-validations`](references/schema-string-validations.md) - Apply string validations at schema definition
- [`schema-use-enums`](references/schema-use-enums.md) - Use enums for fixed string values
- [`schema-coercion-for-form-data`](references/schema-coercion-for-form-data.md) - Use coercion for form and query data

### 2. Parsing & Validation (CRITICAL)

- [`parse-use-safeparse`](references/parse-use-safeparse.md) - Use safeParse() for user input
- [`parse-async-for-async-refinements`](references/parse-async-for-async-refinements.md) - Use parseAsync for async refinements
- [`parse-handle-all-issues`](references/parse-handle-all-issues.md) - Handle all validation issues not just first
- [`parse-validate-early`](references/parse-validate-early.md) - Validate at system boundaries
- [`parse-avoid-double-validation`](references/parse-avoid-double-validation.md) - Avoid validating same data twice
- [`parse-never-trust-json`](references/parse-never-trust-json.md) - Never trust JSON.parse output

### 3. Type Inference (HIGH)

- [`type-use-z-infer`](references/type-use-z-infer.md) - Use z.infer instead of manual types
- [`type-input-vs-output`](references/type-input-vs-output.md) - Distinguish z.input from z.infer for transforms
- [`type-export-schemas-and-types`](references/type-export-schemas-and-types.md) - Export both schemas and inferred types
- [`type-branded-types`](references/type-branded-types.md) - Use branded types for domain safety
- [`type-enable-strict-mode`](references/type-enable-strict-mode.md) - Enable TypeScript strict mode

### 4. Error Handling (HIGH)

- [`error-custom-messages`](references/error-custom-messages.md) - Provide custom error messages
- [`error-use-flatten`](references/error-use-flatten.md) - Use flatten() for form error display
- [`error-path-for-nested`](references/error-path-for-nested.md) - Use issue.path for nested error location
- [`error-i18n`](references/error-i18n.md) - Implement internationalized error messages
- [`error-avoid-throwing-in-refine`](references/error-avoid-throwing-in-refine.md) - Return false instead of throwing in refine

### 5. Object Schemas (MEDIUM-HIGH)

- [`object-strict-vs-strip`](references/object-strict-vs-strip.md) - Choose strict() vs strip() for unknown keys
- [`object-partial-for-updates`](references/object-partial-for-updates.md) - Use partial() for update schemas
- [`object-pick-omit`](references/object-pick-omit.md) - Use pick() and omit() for schema variants
- [`object-extend-for-composition`](references/object-extend-for-composition.md) - Use extend() for adding fields
- [`object-optional-vs-nullable`](references/object-optional-vs-nullable.md) - Distinguish optional() from nullable()
- [`object-discriminated-unions`](references/object-discriminated-unions.md) - Use discriminated unions for type narrowing

### 6. Schema Composition (MEDIUM)

- [`compose-shared-schemas`](references/compose-shared-schemas.md) - Extract shared schemas into reusable modules
- [`compose-intersection`](references/compose-intersection.md) - Use intersection() for type combinations
- [`compose-lazy-recursive`](references/compose-lazy-recursive.md) - Use z.lazy() for recursive schemas
- [`compose-preprocess`](references/compose-preprocess.md) - Use preprocess() for data normalization
- [`compose-pipe`](references/compose-pipe.md) - Use pipe() for multi-stage validation

### 7. Refinements & Transforms (MEDIUM)

- [`refine-vs-superrefine`](references/refine-vs-superrefine.md) - Choose refine() vs superRefine() correctly
- [`refine-transform-coerce`](references/refine-transform-coerce.md) - Distinguish transform() from refine() and coerce()
- [`refine-add-path`](references/refine-add-path.md) - Add path to refinement errors
- [`refine-defaults`](references/refine-defaults.md) - Use default() for optional fields with defaults
- [`refine-catch`](references/refine-catch.md) - Use catch() for fault-tolerant parsing

### 8. Performance & Bundle (LOW-MEDIUM)

- [`perf-cache-schemas`](references/perf-cache-schemas.md) - Cache schema instances
- [`perf-zod-mini`](references/perf-zod-mini.md) - Use Zod Mini for bundle-sensitive applications
- [`perf-avoid-dynamic-creation`](references/perf-avoid-dynamic-creation.md) - Avoid dynamic schema creation in hot paths
- [`perf-lazy-loading`](references/perf-lazy-loading.md) - Lazy load large schemas
- [`perf-arrays`](references/perf-arrays.md) - Optimize large array validation

## How to Use

Read individual reference files for detailed explanations and code examples. Each
rule lives in `references/{prefix}-{slug}.md` and is linked from the Quick Reference
above.

## Full Compiled Document

There is no compiled document: the Quick Reference above is the index, and each
linked file holds the full rule with incorrect/correct examples.

## Related Skills

- Where parsing belongs in a layered backend (parse at the perimeter, trust inside):
  `engineering-paved-path:onion-architecture` §8
- React Hook Form integration and OpenAPI client generation are out of scope

## Sources

- [Zod Official Documentation](https://zod.dev/)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod GitHub Repository](https://github.com/colinhacks/zod)
- [Zod Mini](https://zod.dev/packages/mini)
- [Total TypeScript Zod Tutorial](https://www.totaltypescript.com/tutorials/zod)
