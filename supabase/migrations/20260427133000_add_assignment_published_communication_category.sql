alter table public.communication_messages
drop constraint if exists communication_messages_category_check;

alter table public.communication_messages
add constraint communication_messages_category_check
check (
  category in (
    'feedback-summary',
    'at-risk-alert',
    'grade-released',
    'intervention-follow-up',
    'submission-received',
    'ai-grading-ready',
    'integrity-check-ready',
    'assignment-published'
  )
);
