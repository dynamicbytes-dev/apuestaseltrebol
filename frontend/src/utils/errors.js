export function getErrorMessage(error) {
  const data = error?.response?.data;

  if (data?.errors) {
    return Object.values(data.errors).flat().join(' ');
  }

  if (data?.message) {
    return data.message;
  }

  // No hubo respuesta del servidor. Casi siempre es que la API no esta
  // levantada, o que el frontend apunta a un puerto que no es el del backend.
  if (error?.request || error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'No se pudo conectar con el servidor. Revisa que el backend este levantado ' +
      '(php artisan serve en backend/) y que VITE_API_TARGET (frontend/.env) ' +
      'apunte al puerto correcto.';
  }

  return 'Ocurrió un error inesperado.';
}
