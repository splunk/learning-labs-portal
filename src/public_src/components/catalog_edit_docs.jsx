'use strict'
import React, { useState, useEffect } from 'react'
import { TileWorkshopEdit } from './tile_workshop_edit.jsx'
import { updateAlias, updateWorkshopState } from '../common_lib.js'

function CatalogEditDocs () {
  const [docs, setDocs] = useState([])

  const getDocs = async () => {
    try {
      const userData = await fetch('/api/auth/me')
      const userJson = await userData.json()
      const userEmail = userJson.email
      const docsData = await fetch('/api/catalog?maintainer=' + userEmail)
      const docs = await docsData.json()
      setDocs(docs.data)
    } catch (error) {
      console.log('Error accessing docs data')
    }
  }

  useEffect(() => {
    getDocs()
  }, [])

  const onChangeStateSubmit = async (docId, changeState, targetType, alias) => {
    console.log(docId, changeState)
    await updateWorkshopState(docId, changeState)
    await updateAlias(docId, targetType, alias)
    getDocs()
  }

  return (
    <div class='docs'>
      {docs.map(doc => {
        return (
          <TileWorkshopEdit
            key={doc._id}
            workshopTitle={doc.title}
            workshopDesc={doc.description}
            docId={doc._id}
            docAlias={doc.alias}
            currState={doc.state}
            maintainers={doc.maintainer}
            onChangeStateSubmit={onChangeStateSubmit}
          />
        )
      })}
    </div>
  )
}

export { CatalogEditDocs }
