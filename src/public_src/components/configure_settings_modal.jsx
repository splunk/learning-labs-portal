import React, { useState, useEffect } from 'react'
import Button from '@splunk/react-ui/Button'
import ControlGroup from '@splunk/react-ui/ControlGroup'
import Modal from '@splunk/react-ui/Modal'
import P from '@splunk/react-ui/Paragraph'
import Select from '@splunk/react-ui/Select'
import Text from '@splunk/react-ui/Text'
import StaticContent from '@splunk/react-ui/StaticContent'

function ConfigureSettingsModal ({
  workshopTitle,
  workshopDesc,
  maintainers,
  currState,
  docId,
  docAlias,
  contentBody,
  onChangeStateSubmit
}) {
  const [open, setOpen] = useState(false)
  const [pubState, setPubState] = useState(currState)
  const listMaintainers = maintainers.map((user, index) => (
    <p key={index} style={{ margin: 0 }}>
      {user}
    </p>
  ))
  const [aliasError, setAliasError] = useState(false)
  const [alias, setAlias] = useState(docAlias)

  const handleAlias = async (newAlias, uuid) => {
    const aliasLookupData = await fetch(`/api/aliases/${newAlias}`)
    const aliasLookup = await aliasLookupData.json()
    const aliasIsTaken = aliasLookup.data.uuid && aliasLookup.data.uuid !== uuid
    const aliasIsAlphaNumeric = newAlias.match(/^[0-9a-z]+$/i)
    const aliasError = aliasIsTaken || !aliasIsAlphaNumeric
    setAlias(newAlias)
    setAliasError(aliasError)
  }

  const handleCancel = async () => {
    setOpen(false)
    setAlias(docAlias)
  }

  useEffect(() => {
    setAlias(docAlias)
  }, [])

  return (
    <div>
      <Button
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'black',
          boxShadow: 'none'
        }}
        onClick={() => setOpen(true)}
      >
        <i className='fa fa-cog mr-2' />
      </Button>
      <Modal
        onRequestClose={() => handleCancel()}
        open={open}
        style={{ width: '600px' }}
      >
        <Modal.Header
          title='Configure Workshop Settings'
          onRequestClose={() => handleCancel()}
        />
        <Modal.Body>
          <P>
            Below, you may change the properties of your workshop and press
            submit to save.
          </P>
          <ControlGroup label='Title'>
            {/* <Text canClear defaultValue={workshopTitle} /> */}
            <StaticContent>{workshopTitle}</StaticContent>
          </ControlGroup>
          <ControlGroup label='Description'>
            {/* <Text canClear defaultValue={workshopDesc} /> */}
            <StaticContent>{workshopDesc}</StaticContent>
          </ControlGroup>
          <ControlGroup
            label='Alias'
            key='AliasInput'
            tooltip='The workshop alias must be unique and contain only alphanumeric characters.
              Note that aliases are case sensitive'
            help={
              aliasError
                ? 'This alias is invalid. Either it is already taken or contains unallowed characters.'
                : `Once set, users will be able to navigate to your workshop at 
              ${window.location.origin}/learn/${alias || '<alias>'}.`
            }
            error={aliasError}
          >
            <Text
              canClear
              defaultValue={alias}
              placeholder='alias'
              onChange={(e, input) => handleAlias(input.value, docId)}
              error={aliasError}
            />
          </ControlGroup>
          <ControlGroup label='Maintainers'>
            {/* <Text canClear defaultValue={maintainers} /> */}
            <StaticContent>
              <ul style={{ padding: 0 }}>{listMaintainers}</ul>
            </StaticContent>
          </ControlGroup>
          <ControlGroup label='Publication Status' help={contentBody}>
            <Select
              defaultValue={pubState}
              onChange={(e, option) => setPubState(option.value)}
            >
              <Select.Option label='Published' value='published' />
              <Select.Option label='Drafted' value='drafted' />
            </Select>
          </ControlGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance='secondary'
            onClick={() => handleCancel()}
            label='Cancel'
          />
          <Button
            appearance='primary'
            label='Submit'
            onClick={() => {
              onChangeStateSubmit(docId, pubState, 'WORKSHOP', alias)
              setOpen(false)
            }}
          />
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export { ConfigureSettingsModal }
