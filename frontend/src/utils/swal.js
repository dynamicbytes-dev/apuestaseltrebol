import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/**
 * Instancia personalizada de SweetAlert2 con la paleta y estética de Matrix Bet.
 */
export const matrixBetSwal = Swal.mixin({
  customClass: {
    popup: 'trebol-swal-popup',
    title: 'trebol-swal-title',
    htmlContainer: 'trebol-swal-content',
    confirmButton: 'trebol-swal-confirm-btn',
    cancelButton: 'trebol-swal-cancel-btn',
    denyButton: 'trebol-swal-deny-btn',
    input: 'trebol-swal-input',
  },
  buttonsStyling: false,
  background: 'var(--bg-surface, #1E1E1E)',
  color: 'var(--text-primary, #FFFFFF)',
});

export const elTrebolSwal = matrixBetSwal;

/**
 * Diálogo de confirmación interactivo tipo modal.
 * Reemplazo directo y asíncrono para window.confirm.
 *
 * @param {Object} options
 * @param {string} options.title - Título del diálogo
 * @param {string} [options.text] - Descripción o detalle
 * @param {string} [options.confirmButtonText='Confirmar'] - Texto botón confirmación
 * @param {string} [options.cancelButtonText='Cancelar'] - Texto botón cancelación
 * @param {boolean} [options.isDestructive=false] - Si la acción es crítica/eliminar
 * @param {'warning'|'error'|'success'|'info'|'question'} [options.icon='warning'] - Ícono
 * @returns {Promise<boolean>} Resuelve true si el usuario confirmó, false si canceló
 */
export const showConfirm = async ({
  title = '¿Estás seguro?',
  text = '',
  confirmButtonText = 'Confirmar',
  cancelButtonText = 'Cancelar',
  isDestructive = false,
  icon = 'warning',
} = {}) => {
  const result = await matrixBetSwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: isDestructive,
    customClass: {
      popup: 'trebol-swal-popup',
      title: 'trebol-swal-title',
      htmlContainer: 'trebol-swal-content',
      confirmButton: isDestructive
        ? 'trebol-swal-confirm-btn trebol-swal-destructive-btn'
        : 'trebol-swal-confirm-btn',
      cancelButton: 'trebol-swal-cancel-btn',
    },
  });

  return result.isConfirmed;
};

/**
 * Cuadro de diálogo modal informativo o de notificación.
 * Reemplazo directo para window.alert.
 *
 * @param {Object} options
 * @param {string} options.title - Título
 * @param {string} [options.text] - Mensaje
 * @param {'info'|'success'|'warning'|'error'} [options.icon='info'] - Ícono
 * @param {string} [options.confirmButtonText='Aceptar'] - Texto botón
 * @returns {Promise<import('sweetalert2').SweetAlertResult>}
 */
export const showAlert = async ({
  title,
  text = '',
  icon = 'info',
  confirmButtonText = 'Aceptar',
} = {}) => {
  return matrixBetSwal.fire({
    title,
    text,
    icon,
    confirmButtonText,
  });
};

/**
 * Notificación de Éxito
 */
export const showSuccess = async (text, title = '¡Operación Exitosa!') => {
  return matrixBetSwal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonText: 'Entendido',
  });
};

/**
 * Notificación de Error
 */
export const showError = async (text, title = 'Error') => {
  return matrixBetSwal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'Aceptar',
  });
};

/**
 * Notificación de Advertencia
 */
export const showWarning = async (text, title = 'Atención') => {
  return matrixBetSwal.fire({
    title,
    text,
    icon: 'warning',
    confirmButtonText: 'Entendido',
  });
};

/**
 * Cuadro modal para solicitud de texto o valor numérico.
 * Reemplazo directo y elegante para window.prompt.
 *
 * @param {Object} options
 * @param {string} options.title - Título
 * @param {string} [options.text] - Texto explicativo
 * @param {string} [options.inputLabel] - Label sobre el input
 * @param {string} [options.inputValue=''] - Valor inicial
 * @param {string} [options.inputPlaceholder=''] - Placeholder
 * @param {'text'|'number'|'password'} [options.inputType='text'] - Tipo de entrada
 * @param {string} [options.confirmButtonText='Guardar']
 * @param {string} [options.cancelButtonText='Cancelar']
 * @param {(value: string) => (string|null|Promise<string|null>)} [options.inputValidator] - Validador de SweetAlert2
 * @returns {Promise<string|null>} Retorna el valor ingresado o null si se cancela
 */
export const showPrompt = async ({
  title,
  text = '',
  inputLabel = '',
  inputValue = '',
  inputPlaceholder = '',
  inputType = 'text',
  confirmButtonText = 'Guardar',
  cancelButtonText = 'Cancelar',
  inputValidator = null,
} = {}) => {
  const result = await matrixBetSwal.fire({
    title,
    text,
    input: inputType,
    inputLabel,
    inputValue,
    inputPlaceholder,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    inputValidator,
  });

  if (result.isConfirmed) {
    return result.value;
  }
  return null;
};

/**
 * Notificación flotante (Toast) no bloqueante en la esquina superior.
 */
export const showToast = ({
  title,
  icon = 'success',
  timer = 3000,
  position = 'top-end',
} = {}) => {
  const Toast = Swal.mixin({
    toast: true,
    position,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    background: 'var(--bg-surface-elevated, #2A2A2A)',
    color: 'var(--text-primary, #FFFFFF)',
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon,
    title,
  });
};

export default matrixBetSwal;
