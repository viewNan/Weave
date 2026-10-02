UPDATE study_suggestions
SET activity_type = 'work'
WHERE id IN ('preset-apply', 'preset-weave', 'preset-glasses', 'preset-test')
  AND activity_type = 'study';
