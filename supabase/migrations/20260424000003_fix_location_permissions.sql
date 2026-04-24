-- Grant LOCATION.VIEW to STORE_MANAGER and SITE_ENGINEER so they can use the Location picker.
INSERT INTO role_permissions (role_id, module_id, action_id) VALUES
  ('STORE_MANAGER', 'LOCATION', 'VIEW'),
  ('SITE_ENGINEER', 'LOCATION', 'VIEW')
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;
