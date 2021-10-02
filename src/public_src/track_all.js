/**
 * Copyright 2021 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. 
 */

import $ from 'jquery'
import 'bootstrap/dist/js/bootstrap.bundle'
import 'bootstrap'

// -------------------------------------------------------------
// Event Handlers
// -------------------------------------------------------------
async function createTrack () {
  const userEmail = await getUserEmail()
  var trackData = {
    name: $('#inputModal #track-title').val().trim(),
    description: $('#inputModal #track-desc').val().trim(),
    maintainer: [userEmail],
    docs: []
  }
  try {
    const response = await fetch('/api/track',
      {
        method: 'POST',
        body: JSON.stringify(trackData),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    const track = await response.json()
    const trackId = track.data._id
    const newTrackPage = `/track/${trackId}`
    window.location.href = newTrackPage
  } catch (error) {
    console.log('Error creating new track.')
  }
}

async function getUserEmail () {
  try {
    const response = await fetch('/api/auth/me')
    const userInfo = await response.json()
    const userEmail = userInfo.email
    return userEmail
  } catch (error) {
    console.log('Error retrieving user credentials.')
  }
}

async function launchModal () {
  $('#inputModal').modal()
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
$(function () {
  // creates a new track with hardcoded attributes
  // $('#button-create-track').click(createTrack);
  $('#button-create-track').click(launchModal)
  $('#button-add-track').click(createTrack)
})
