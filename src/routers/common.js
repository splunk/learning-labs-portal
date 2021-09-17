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