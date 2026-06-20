import { createPortal } from 'react-dom'

function AdminDialog({ message, onConfirm, onCancel }) {
  if (!message) return null

  return createPortal(
    <>
      <div className="dialog-overlay" onClick={onCancel} />
      <div className="dialog">
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className="dialog-btn dialog-btn--confirm" onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

export default AdminDialog