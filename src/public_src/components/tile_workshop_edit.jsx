'use strict'
import React, { useState, useEffect } from 'react'
import $ from 'jquery'
import { ENUM_CATALOG_STATE as CATALOG_STATE } from '../front_end_constant'
import { ConfigureSettingsModal } from './configure_settings_modal.jsx'

const WORKSHOP_DETAILS = {
  [CATALOG_STATE.PUBLISHED]: {
    badgeText: 'Published',
    badgeClass: 'badge-success',
    contentBody: [
      'When a workshop is drafted, users will no longer have ' +
        'access to this workshop. ',
      'If this workshop is already added to a track, users will ' +
        'continue to have access to this workshop from the track ' +
        'where it belongs to.'
    ]
  },
  [CATALOG_STATE.STAGED]: {
    badgeText: 'Staged',
    badgeClass: 'badge-warning'
  },
  [CATALOG_STATE.DRAFTED]: {
    badgeText: 'Draft',
    badgeClass: 'badge-secondary',
    contentBody: [
      'Once this workshop is published, this this workshop will be ' +
        'available to all users. ',
      'Also, track maintainers may add this workshop to the tracks ' +
        'they maintain.'
    ]
  }
}

function TileWorkshopEdit ({
  workshopTitle,
  workshopDesc,
  docId,
  docAlias,
  currState,
  maintainers,
  onChangeStateSubmit
}) {
  const {
    badgeClass,
    badgeText,
    contentBody = []
  } = WORKSHOP_DETAILS[currState]

  return (
    <div class='doc workshop-edit'>
      <div className='content'>
        <div className='body'>
          <h3>{workshopTitle}</h3>
          <p>{workshopDesc}</p>
        </div>
        <div className='footer'>
          <div>
            <ConfigureSettingsModal
              workshopTitle={workshopTitle}
              workshopDesc={workshopDesc}
              maintainers={maintainers}
              currState={currState}
              docId={docId}
              docAlias={docAlias}
              contentBody={contentBody}
              onChangeStateSubmit={onChangeStateSubmit}
            />
          </div>
          <div>
            <p
              class={'badge ' + badgeClass + ' float-right'}
              docId={docId}
              data-toggle='tooltip'
              data-placement='bottom'
            >
              {badgeText}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { TileWorkshopEdit }
