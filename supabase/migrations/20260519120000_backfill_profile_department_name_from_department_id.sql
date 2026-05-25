update public.profiles
set department_name = department_id
where department_name is null
  and department_id is not null;
