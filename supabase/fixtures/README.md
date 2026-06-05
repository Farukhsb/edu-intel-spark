# Supabase Fixtures

Smoke fixture workflow:

```sql
select public.clear_smoke_training_fixture();
select public.seed_smoke_training_fixture();
```

Or reset and reseed in one step:

```sql
select public.refresh_smoke_training_fixture();
```

The smoke fixture is only for the hidden training tenant used in local and remote verification.
