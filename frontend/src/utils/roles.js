export function homePathForRole(role) {
  if (role === 'administrador') {
    return '/dashboard';
  }

  if (role === 'supervisor') {
    return '/supervisor';
  }

  if (role === 'taquilla') {
    return '/taquilla';
  }

  return '/login';
}
