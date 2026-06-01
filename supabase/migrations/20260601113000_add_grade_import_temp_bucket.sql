-- Temporary bucket for hybrid grade import image uploads.
-- Edge functions upload image evidence here during processing and delete it after use.

insert into storage.buckets (id, name, public)
values ('grade-import-temp', 'grade-import-temp', false)
on conflict (id) do update
set public = excluded.public;
