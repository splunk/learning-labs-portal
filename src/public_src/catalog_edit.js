import React from 'react'
import ReactDOM from 'react-dom'
import $ from 'jquery'
import 'bootstrap/dist/js/bootstrap.bundle'
import 'bootstrap'
import { CatalogEditDocs } from './components/catalog_edit_docs.jsx'

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

document.querySelectorAll('.catalog-edit-docs')
  .forEach(domContainer => {
    ReactDOM.render(
      <CatalogEditDocs />,
      domContainer
    )
  })
