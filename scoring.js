// Shared scoring helpers for results.html and description.html. Load data.js first.
//
// Closest-match score of one value set (key) of an ideology:
//   (identical + 0.5 x same sub-group - clash penalties) x (identical / required values)
//   / (number of value sets of the ideology) ^ 0.25
// Every value is weighted by how rare it is across all ideologies. The penalty of a clash depends on the
// pair of sub-groups (see incompatibleSubCategories in data.js).
const HV = (function () {
    const VARIANT_EXPONENT = 0.25;
    const WEIGHT_MIN = 0.5;
    const WEIGHT_MAX = 2;

    const categoryOf = {};
    Object.keys(resultsMapping).forEach(cat => {
        Object.keys(resultsMapping[cat]).forEach(id => {
            if (!(id in categoryOf)) categoryOf[id] = cat;
        });
    });

    function groupsOf(category, value) {
        const groups = subCategories[category] || {};
        return Object.keys(groups).filter(name => groups[name].includes(value));
    }

    // How a required value relates to the user's value in the same category:
    // identical, similar (shares a sub-group), clash (every pair of sub-groups clashes) or other.
    function relation(category, userVal, reqVal) {
        if (userVal === reqVal) return { type: 'identical', severity: 0 };
        const userGroups = groupsOf(category, userVal);
        const reqGroups = groupsOf(category, reqVal);
        if (userGroups.some(g => reqGroups.includes(g))) return { type: 'similar', severity: 0 };
        if (userGroups.length && reqGroups.length) {
            let mildest = Infinity;
            for (const a of userGroups) {
                for (const b of reqGroups) {
                    const severity = (incompatibleSubCategories[a] || {})[b];
                    if (severity === undefined) return { type: 'other', severity: 0 };
                    if (severity < mildest) mildest = severity;
                }
            }
            return { type: 'clash', severity: mildest };
        }
        return { type: 'other', severity: 0 };
    }

    // CSS class for the ring around a value icon
    function ringClass(rel) {
        if (rel.type === 'identical') return 'ring-identical';
        if (rel.type === 'similar') return 'ring-similar';
        if (rel.type === 'clash') {
            if (rel.severity <= 0.5) return 'ring-clash-mild';
            if (rel.severity <= 1.5) return 'ring-clash-strong';
            return 'ring-clash-extreme';
        }
        return 'ring-neutral';
    }

    // Rarity weights and number of value sets per ideology
    const ideologiesUsingValue = {};
    const valueSetsPerIdeology = {};
    const allKeyParts = [];
    Object.keys(labelMapping).forEach(key => {
        const label = labelMapping[key];
        valueSetsPerIdeology[label] = (valueSetsPerIdeology[label] || 0) + 1;
        key.split('|').forEach(part => {
            (ideologiesUsingValue[part] = ideologiesUsingValue[part] || new Set()).add(label);
            allKeyParts.push(part);
        });
    });
    const totalIdeologies = Object.keys(valueSetsPerIdeology).length;
    const rawWeight = {};
    Object.keys(ideologiesUsingValue).forEach(value => {
        rawWeight[value] = Math.log(1 + totalIdeologies / ideologiesUsingValue[value].size);
    });
    const meanWeight = allKeyParts.reduce((sum, part) => sum + rawWeight[part], 0) / allKeyParts.length;
    function valueWeight(value) {
        const weight = (rawWeight[value] || meanWeight) / meanWeight;
        return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight));
    }

    function valuesByCategory(key) {
        const byCategory = {};
        key.split('|').forEach(part => {
            const cat = categoryOf[part];
            if (cat) byCategory[cat] = part;
        });
        return byCategory;
    }

    // all value sets (keys) of one ideology, in data.js order
    function keysOf(label) {
        return Object.keys(labelMapping).filter(key => labelMapping[key] === label);
    }

    function scoreKey(results, key) {
        const requiredParts = key.split('|');
        const label = labelMapping[key];
        let credit = 0;
        let identicalWeight = 0;
        let totalWeight = 0;
        let identicalCount = 0;
        let broaderCount = 0;
        let clashCount = 0;

        requiredParts.forEach(reqVal => {
            const weight = valueWeight(reqVal);
            totalWeight += weight;
            const category = categoryOf[reqVal];
            if (!category) return;
            const userVal = results[category];
            if (!userVal) return;
            const rel = relation(category, userVal, reqVal);
            if (rel.type === 'identical') {
                credit += weight;
                identicalWeight += weight;
                identicalCount++;
            } else if (rel.type === 'similar') {
                credit += weight * 0.5;
                broaderCount++;
            } else if (rel.type === 'clash') {
                credit -= weight * rel.severity;
                clashCount++;
            }
        });

        let score = identicalCount > 0 ? (credit * identicalWeight) / totalWeight : 0;
        score = score / Math.pow(valueSetsPerIdeology[label], VARIANT_EXPONENT);
        return {
            key,
            label,
            score,
            identicalCount,
            broaderCount,
            clashCount,
            totalRequired: requiredParts.length
        };
    }

    // Higher score first; on equal scores the value set with more identical values wins.
    // Equal in both: the order in data.js decides.
    function rankKeys(results, keys) {
        return (keys || Object.keys(labelMapping))
            .map(key => scoreKey(results, key))
            .sort((a, b) => (b.score - a.score) || (b.identicalCount - a.identicalCount));
    }

    // Best value set of every ideology with a positive score, best ideology first
    function closestIdeologies(results, excludeLabel, count) {
        const seen = new Set();
        const out = [];
        for (const item of rankKeys(results)) {
            if (item.label === excludeLabel || seen.has(item.label)) continue;
            seen.add(item.label);
            if (item.score > 0) out.push(item);
            if (out.length >= count) break;
        }
        return out;
    }

    return {
        categoryOf, relation, ringClass, valuesByCategory, keysOf, scoreKey, rankKeys,
        closestIdeologies, valueSetsPerIdeology
    };
})();
