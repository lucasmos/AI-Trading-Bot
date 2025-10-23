<!--
SYNC IMPACT REPORT
================================================================================
Version Bump: 0.0.0 → 1.0.0 (MAJOR: Initial constitution establishment)

PRINCIPLES DEFINED:
  ✓ Principle 1: Universal Theme Compatibility (NEW)
  ✓ Principle 2: Component Stability & Non-Breaking Changes (NEW)
  ✓ Principle 3: Type Safety (Declarative TypeScript) (NEW)
  ✓ Principle 4: React/Next.js Best Practices (NEW)
  ✓ Principle 5: Test-First Development (Conditional) (NEW)
  ✓ Principle 6: Dependency Constraint (NEW)

SECTIONS ADDED:
  ✓ Theme Implementation Standards (NEW)
  ✓ Security & Performance (NEW)
  ✓ Development Workflow (NEW)
  ✓ Governance (NEW with amendment procedure)

TEMPLATES VALIDATED:
  ✓ .specify/templates/plan-template.md - Has "Constitution Check" gate; validates principle alignment
  ✓ .specify/templates/spec-template.md - User stories prioritized per principle IV (React best practices)
  ✓ .specify/templates/tasks-template.md - Task phases support principle V (test-first) and principle VI (dependency constraint)

RUNTIME GUIDANCE FILES:
  ✓ copilot.instructions.md - Aligned; emphasizes functional TypeScript, theme support via styled-components/Tailwind
  ✓ README.md - No update needed; tech stack documented; no breaking changes
  ✓ docs/blueprint.md - Color palette aligns with constitution Theme Implementation Standards

DEFERRED ITEMS: None. All core principles and governance fully established.

FOLLOW-UP: 
  - When creating new features, use plan-template.md to verify "Constitution Check" passes
  - When reviewing PRs, cross-reference against core principles (checklist: Themes? TypeScript? Non-breaking? Tests? No new packages?)
  - Weekly spot-check one merged feature for principle compliance

Report Generated: 2025-10-23
================================================================================
-->

# AI-Trading-Bot Constitution

## Core Principles

### I. Universal Theme Compatibility
Every new feature MUST support Light, Dark, and AMOLED theme modes without breaking existing component
styling. Theme implementation MUST use TailwindCSS dark mode and AMOLED-specific color classes. Test
all features across all three themes before considering implementation complete. Colors must pass
contrast requirements for accessibility.

### II. Component Stability & Non-Breaking Changes
Component styling updates MUST NOT alter the visual structure or layout of existing components. New
features MUST extend existing components contextually; refactoring of core components requires
migration plan. Breaking changes to component APIs prohibited without version increment and migration
path documented in `MANUAL_QA_VERIFICATION_REPORT.md`.

### III. Type Safety (Declarative TypeScript)
All code MUST use TypeScript with strict mode enabled. Use functional components with interfaces;
avoid classes and enums. Maintain strong typing across React components, API routes, and services.
Generic types MUST be properly bounded. No `any` types permitted without documented exception.

### IV. React/Next.js Best Practices
Use React 18+ functional components with hooks. Leverage Next.js API routes and server components
where appropriate. Implement proper error boundaries for graceful error handling. Use React Query
(via hooks) for data fetching and state management; minimize useState usage. Keep components
focused and modular; extract hooks for reusable logic.

### V. Test-First Development (Conditional)
New features affecting core trading logic, state management, or data calculations MUST include unit
tests via Jest and React Native Testing Library. Test files should mirror source structure in
`__tests__/` directories. Integration tests required for API routes and multi-component interactions.
UI smoke tests acceptable for display-only components. Tests MUST pass before PR merge.

### VI. Dependency Constraint
NO new packages may be added to `package.json` without explicit approval. Current tech stack
(Next.js, React, TypeScript, TailwindCSS, Prisma, NextAuth, Recharts, Radix UI, React Query) is
sufficient. If a feature cannot be implemented with existing dependencies, justify the addition in
a feature specification with cost-benefit analysis before proceeding.

## Theme Implementation Standards

**Color Palette Requirements**:
- **Light Mode**: Neutral grays, professional blues (#1A202C), teal accents (#4DC0B5)
- **Dark Mode**: Dark blue backgrounds (#1A202C family), light text for readability, teal accents maintained
- **AMOLED Mode**: True black backgrounds (#000000), white/light gray text, high contrast colors for visibility

**Implementation Pattern**:
- Use TailwindCSS `dark:` prefix for Dark mode overrides
- Create AMOLED-specific color classes in `globals.css` with `@media (prefers-color-scheme: dark)` and
  context-based AMOLED detection
- Test with browser DevTools dark mode toggle AND actual AMOLED mode setting if available
- Ensure all text meets WCAG AA contrast requirements (4.5:1 minimum for body text)

## Security & Performance

**Security Baseline**:
- All user inputs sanitized via Zod validation schemas
- API routes protected with NextAuth session checks where applicable
- Sensitive data (passwords, tokens) encrypted at rest via bcrypt or react-native-encrypted-storage
- HTTPS enforced; no http:// in production

**Performance Standards**:
- React components MUST be memoized if they receive expensive props (use `memo` or useMemo)
- Avoid unnecessary re-renders; use useCallback for event handlers passed to children
- Images optimized: lazy-load with `expo-image` or Next.js Image component
- Database queries optimized; avoid N+1 patterns; use Prisma select/include selectively

## Development Workflow

**Git & PR Process**:
- Feature branches named `###-feature-name` (e.g., `001-light-theme-update`)
- PRs MUST reference related spec/plan docs in `.specify/specs/`
- Before merge: (1) All tests pass, (2) Theme validation across all three modes, (3) No breaking changes to existing
  components, (4) TypeScript strict mode validation passes, (5) Code style via Prettier
- Commit messages: `type: description` (e.g., `feat: add AMOLED support to trade-history component`)

**Quality Gates**:
- ESLint must pass with zero errors (warnings acceptable with justification in PR)
- TypeScript compiler must pass with no errors (`npm run typecheck`)
- Jest tests (if applicable) must pass: `npm run test`
- Manual QA: Verify all three themes render correctly; test on mobile and desktop viewports
- Update `MANUAL_QA_VERIFICATION_REPORT.md` with theme test results

## Governance

**Constitution Authority**:
This constitution supersedes all informal practices. All feature development MUST comply with core
principles. Violations require documented exception in the feature spec with justification and
approval from project lead before implementation.

**Amendment Process**:
- Propose changes via PR to `.specify/memory/constitution.md`
- Include rationale for each change; reference specific principles affected
- Version bump: MAJOR for principle removals/redefinitions, MINOR for new principles/standards,
  PATCH for clarifications
- Upon merge, update all affected `.specify/templates/` files and regenerate affected plans/specs
- Document amendment in Sync Impact Report (HTML comment at top of this file)

**Compliance Review**:
- Weekly: Random feature review against principles (use template checklist in PR comments)
- Monthly: Update constitution version if needed; assess if principles remain adequate
- Upon release: Full audit of merged features for principle violations

**Guidance Documents**:
- Runtime development guidance in: `copilot.instructions.md` (user-facing Copilot rules) and this constitution
- Feature templates in `.specify/templates/` MUST be validated against latest constitution version
- Breaking changes to constitution MUST be communicated to entire team with migration path

**Deferred Items**: None at present. All core principles established.

---

**Version**: 1.0.0 | **Ratified**: 2025-10-23 | **Last Amended**: 2025-10-23
