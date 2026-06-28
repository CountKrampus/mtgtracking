export function getAuthHeaders() {
  const token = localStorage.getItem('mtg_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
