export function getErrorMessage(error) {
  const data = error?.response?.data;

  if (data?.errors) {
    return Object.values(data.errors).flat().join(' ');
  }

  return data?.message ?? 'Ocurrió un error inesperado.';
}
