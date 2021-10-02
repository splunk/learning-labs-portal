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

import _ from 'lodash'
import $ from 'jquery'
import 'bootstrap/dist/js/bootstrap.bundle'
import 'bootstrap'

//-------------------------------------------------------------
// Helper Function
//-------------------------------------------------------------

function memoize(func){
    let cache;
    return function(){
        if (cache){
            return cache;
        }
        cache = func.apply(null, arguments);
        return cache;
    }
}

//-------------------------------------------------------------
// Data Access
//-------------------------------------------------------------
async function getAllUsers(){
    try {
        const response = await fetch('/api/auth');
        const result = await response.json();
        return result.data;
    }
    catch (err){
        return [];
    }
}
const getAllUsersCached = memoize(getAllUsers);

async function getAllWorkshops(){
    try {
        const response = await fetch('/api/catalog');
        const result = await response.json();
        return _.sortBy(result.data, 'title');
    }
    catch (err){
        console.log(err);
    }
}
const getAllWorkshopsCached = memoize(getAllWorkshops);

async function updateTrack(id, data){
    const url = `/api/track/${id}`;
    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        return true;
    }
    catch (err){
        return false;
    }
}

async function updateWorkshopState(id, state){
    const url = `/api/catalog/${id}/state`;
    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({state})
        });
        const result = await response.json();
        return result.data;
    }
    catch (err){
        console.log(err);
        return false;
    }
}

const targetToPathVar = {
  WORKSHOP: 'catalog',
  TRACK: 'track'
}

async function updateAlias (id, targetType, alias) {
  const pathVar = targetToPathVar[targetType]
  const url = `/api/${pathVar}/${id}/alias`
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ alias })
    })
    const result = await response.json()
    return result.data
  } catch (err) {
    console.log(err)
    return false
  }
}

//-------------------------------------------------------------
// Views
//-------------------------------------------------------------

// Message View

function addMessage(select, message, type, duration = 5){
    $('.message.alert').remove();
    const html = `
        <div class="message alert alert-${type}" role="alert">
            ${message}
        </div>`;
    $elem = $(html);
    $(select).after($elem);
    setTimeout(() => {
        $elem.slideUp('slow', function(){ $elem.remove(); });
    }, duration * 1000);
}

// Tile View

function getTileIds(){
    return $('.sortables li.item').map(function(){ return $(this).attr('_id'); }).get();
}

function getExtraItems(){
    const items = {};
    $('.sortables li.item').each(function(){
        const id = $(this).attr('_id');
        if (id[0] == '#'){
            const type = id.split(':')[0].substr(1);
            const title = $(this).find('.tile-title').html();
            const desc = $(this).find('.tile-desc').html();
            items[id] = {title:title, description:desc, type:type, _id: id};
        }
    });
    return items;
}


/**
 * NOTE: When updating this function, update tile_sortable_item.ejs as well
 */
function addTileItem({_id, title, description}){
    let extraClass = '';
    if (_id.includes('#')){
        extraClass = 'tile-sortable-' + _id.split(':')[0].substr(1);
    }
    const html = `
        <li class="item ui-state-default" _id="${_id}" style="display: none;">
            <div class="content ${extraClass}">
                <div class="body">
                    <button type="button" class="close" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                    <h3 class="tile-title">${title}</h3>
                    <p class="tile-desc">${description}</p>
                </div>
                <div class="footer">
                </div>
            </div>
        </li>`;
    const $newElem = $(html);
    $newElem.find('.close').click(function(){
        const $target = $(this).parents('li.item');
        $target.hide('slow', function(){ $target.remove(); });
    });
    $newElem.appendTo('.sortables').show('slow');
}

// Modal View

function addModalSelectionItem(item){
    const html = `
        <div class="item" _id="${item._id}">
            <div>
                <h3>${item.title}</h3>
                <h4>${item.description}</h4>
            </div>
            <div>
                <i class="fa fa-check invisible"></i>
            </div>
        </div>`
    const $elem = $(html);
    $elem.click(function(){
        $target = $(this);
        if ($target.attr('selected')){
            $(this).find('i').addClass('invisible');
            $(this).attr('selected', false);
        }
        else {
            $(this).find('i').removeClass('invisible');
            $(this).attr('selected', true);
        }
    });
    return $elem;
}

function getSelectedModalItems(){
    return $('.modal-dialog .item[selected="selected"').map(function(){ 
        return $(this).attr('_id') 
    }).get();
}

function addToolTip(){
  $('[data-toggle="tooltip"]').tooltip()
}

export{ updateWorkshopState, updateAlias }
