-- Global dashboard options for reasons/outcomes
CREATE TABLE IF NOT EXISTS dashboard_options (
  id INTEGER PRIMARY KEY,
  reasons JSONB NOT NULL,
  outcomes JSONB NOT NULL,
  pipeline_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO dashboard_options (id, reasons, outcomes, pipeline_values, report_fields)
VALUES (
  1,
  '["New booking","Reschedule","Pricing inquiry","Service follow-up","Emergency request"]'::jsonb,
  '[{"label":"Booked","action_required":true,"pipeline_values":[]},{"label":"Quote sent","action_required":false,"pipeline_values":[]},{"label":"Follow-up required","action_required":true,"pipeline_values":[]},{"label":"No answer","action_required":false,"pipeline_values":[]},{"label":"Unqualified","action_required":false,"pipeline_values":[]}]'::jsonb,
  '[{"id":"base","name":"Standard booking","value":"250"},{"id":"premium","name":"Premium install","value":"650"}]'::jsonb,
  '[{"id":"transcript","label":"Transcript","required":true,"global":true},{"id":"summary","label":"Summary","required":true,"global":true},{"id":"name","label":"Name","required":true,"global":true},{"id":"call_number","label":"Call Number","required":true,"global":true},{"id":"email","label":"Email","required":false,"global":true},{"id":"address","label":"Address","required":false,"global":true}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
