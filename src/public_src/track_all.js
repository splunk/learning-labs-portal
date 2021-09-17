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
