\pset pager off
SELECT u.id AS user_id, lower(trim(u.email)) AS email, u.tenant_id,
       t.name AS tenant_name, u.role, u.is_active
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE lower(replace(u.email, ' ', '')) IN (
  'zaiquepermue@gmail.com',
  'zaiqueperfume@gmail.com'
)
ORDER BY u.email;

SELECT t.id AS tenant_id, t.name AS tenant_name,
       string_agg(lower(trim(u.email)), ', ' ORDER BY u.email) AS users,
       count(DISTINCT rs.id) AS retail_sales,
       coalesce(sum(DISTINCT rs.total_amount), 0) AS revenue
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
LEFT JOIN retail_sales rs ON rs.tenant_id = t.id
WHERE lower(trim(t.name)) = 'zaique perfume'
GROUP BY t.id ORDER BY t.created_at;
