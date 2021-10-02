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

'use strict';

const _ = require('underscore');
const models = require('../models');

async function populateRequirements(docs, email) {
    const progress = await models.progress.get(email);
    const requirements = _.union.apply(null, docs.map(doc => doc.requirements));
    const query = { _id: { $in: requirements }, state: 'published' };
    const requiredDocsById = _.indexBy(await models.catalog.getAll(query), '_id');
    docs.forEach((doc) => {
        if (doc.requirements) {
            // Make sure workshop IDs within requirements are valid
            doc.requirements = doc.requirements
                .filter(docId => requiredDocsById[docId]);
            // Check if all requirements are completed
            const diff = _.difference(doc.requirements, progress.completed);
            doc.locked = diff.length > 0;
            doc.required = diff.map((id) => requiredDocsById[id]);
            if (doc.locked) {
                return;
            }
        }
        doc.attempted = _.indexOf(progress.attempted, doc._id) >= 0;
        doc.completed = _.indexOf(progress.completed, doc._id) >= 0;
    });
}

exports.populateRequirements = populateRequirements;