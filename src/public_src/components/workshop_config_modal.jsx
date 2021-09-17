'use strict'
import React from 'react'

function WorkshopConfigModal ({
  buttonText,
  buttonClass,
  changeState,
  contentBody,
  docId,
  workshopTitle,
  onChangeStateSubmit
}) {
  return (
    <div class='modal fade' tabindex='-1' role='dialog' id={`modal-${docId}`}>
      <div className='modal-dialog modal-blocked' role='document'>
        <div className='modal-content state-change'>
          <div className='modal-header'>
            <h3 className='modal-title'>
              <i className='fa fa-exclamation mr-3' />
              {buttonText} Workshop
            </h3>
            <button
              type='button'
              className='close'
              data-dismiss='modal'
              aria-label='Close'
            >
              <span aria-hidden='true'>&times;</span>
            </button>
          </div>
          <div className='modal-body'>
            <h3 className='mb-3'>Workshop: {workshopTitle}</h3>
            {contentBody.map((paragraph, index) => {
              return <p key={index}>{paragraph}</p>
            })}
            <p />
          </div>
          <div className='modal-footer'>
            <button
              type='button'
              className={`btn ${buttonClass} submit`}
              docId={docId}
              changeState={changeState}
              data-dismiss='modal'
              onClick={() => onChangeStateSubmit(docId, changeState)}
            >
              {buttonText}
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              data-dismiss='modal'
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { WorkshopConfigModal }
