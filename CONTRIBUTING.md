# Contributing to GradeAI

Thank you for your interest in contributing to GradeAI.

GradeAI is an academic workflow platform, so contributions should be made carefully. The project handles assessment flows, student-facing feedback, moderation, academic integrity signals, and early support features. Changes should protect student data, preserve lecturer oversight, and avoid presenting AI output as a final academic decision.

## Before You Contribute

Please keep these principles in mind:

- do not commit `.env` files, API keys, tokens, or secrets
- do not add real student data, real submissions, or private academic records to the repository
- do not expose unreleased grades or provisional AI feedback to students
- do not weaken role boundaries between students, lecturers, moderators, and admins
- do not make integrity or support features sound like automatic judgements
- keep AI-assisted workflows human-reviewed and explainable

## How to Contribute

1. Fork the repository.
2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/edu-intel-spark.git
   ```

3. Create a branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes.
5. Run the relevant checks:

   ```bash
   npm run build
   npm run test
   ```

6. Commit your changes with a clear message:

   ```bash
   git commit -m "Describe your change clearly"
   ```

7. Push your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

8. Open a pull request.

## Pull Request Guidelines

A good pull request should include:

- a clear summary of what changed
- why the change was needed
- screenshots for UI changes
- test notes or build results
- any database or Supabase migration notes
- any privacy, security, or role-boundary impact

For changes involving grading, moderation, integrity checks, student support signals, or student visibility, explain how the change preserves lecturer review and protects students from seeing unapproved or unreleased content.

## Security and Privacy

Do not include:

- real student names or emails
- real submissions
- private lecturer notes
- Supabase service keys
- Sentry DSNs in source code
- private PostHog keys or other analytics secrets
- screenshots containing sensitive student data

If a change affects authentication, roles, RLS policies, Edge Functions, file access, or monitoring, please describe the security impact in the pull request.

## Testing Expectations

At minimum, run:

```bash
npm run build
```

Where relevant, also run:

```bash
npm run test
npm run test:e2e
```

Critical areas should have stronger test coverage, especially:

- student visibility rules
- grade approval and release
- moderation gating
- academic integrity review
- early support signals
- role-based access

## Documentation

Update documentation when a change affects:

- product behaviour
- lecturer or student workflows
- security model
- rollout readiness
- test strategy
- Supabase or deployment setup

Useful docs include:

- `README.md`
- `docs/SECURITY_MODEL.md`
- `docs/TEST_COVERAGE_STRATEGY.md`
- `docs/ROLLOUT_PLAN.md`

## Code of Conduct

Please be respectful and constructive. This project deals with education and student support, so contributors should use language that is professional, fair, and non-accusatory.

## License

By contributing, you agree that your contributions will be licensed under the project's license.
