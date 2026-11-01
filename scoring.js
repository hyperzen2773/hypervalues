// Shared scoring helpers for results.html and description.html. Load data.js first.
//
// Closest matches use a Naive Bayes score built only from the value sets of the ideologies in data.js:
//   - Every value set (key) of an ideology is one way of holding that ideology.
//   - For each category the set specifies, an identical value adds ln((1 - m) / b) and a different value adds
//     ln(m / (1 - b)), where m = 0.1 is the chance that someone holding the set answers differently and b is how
//     common the value is among all value sets (rarer values count for more).
//   - Categories you did not answer, or the set does not specify, add nothing.
//   - The score of an ideology is ln of the sum of exp(score) over its value sets (a log-sum-exp), so having
//     several value sets neither helps nor hurts it.
//   - Ties go to the ideology with more identical values, then with more specified categories, then to data.js order.
// Sub-groups (subCategories, incompatibleSubCategories in data.js) are only used for the rings on the ideology page.
const HV = (function () {
    const MISMATCH_CHANCE = 0.1;

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

    // How a required value relates to the user's value in the same category (only used for the rings):
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

    // Number of value sets per ideology, order of the ideologies in data.js, and how many value sets use each value
    const valueSetsPerIdeology = {};
    const labelOrder = {};
    const setsUsingValue = {};
    Object.keys(labelMapping).forEach(key => {
        const label = labelMapping[key];
        valueSetsPerIdeology[label] = (valueSetsPerIdeology[label] || 0) + 1;
        if (!(label in labelOrder)) labelOrder[label] = Object.keys(labelOrder).length;
        new Set(key.split('|')).forEach(part => {
            setsUsingValue[part] = (setsUsingValue[part] || 0) + 1;
        });
    });

    // How common each value is among the value sets of its category (smoothed by +1), as log scores
    const logMatch = {};
    const logMismatch = {};
    Object.keys(resultsMapping).forEach(cat => {
        const ids = Object.keys(resultsMapping[cat]).filter(id => categoryOf[id] === cat);
        const total = ids.reduce((sum, id) => sum + (setsUsingValue[id] || 0) + 1, 0);
        ids.forEach(id => {
            const common = ((setsUsingValue[id] || 0) + 1) / total;
            logMatch[id] = Math.log((1 - MISMATCH_CHANCE) / common);
            logMismatch[id] = Math.log(MISMATCH_CHANCE / (1 - common));
        });
    });

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

    // Score of one value set against the user's answers (results maps category -> value)
    function scoreKey(results, key) {
        const requiredParts = key.split('|');
        let score = 0;
        let identicalCount = 0;
        let mismatchCount = 0;
        requiredParts.forEach(reqVal => {
            const category = categoryOf[reqVal];
            const userVal = category ? results[category] : null;
            if (!userVal) return;
            if (userVal === reqVal) {
                score += logMatch[reqVal];
                identicalCount++;
            } else {
                score += logMismatch[reqVal];
                mismatchCount++;
            }
        });
        return {
            key,
            label: labelMapping[key],
            score,
            identicalCount,
            mismatchCount,
            totalRequired: requiredParts.length
        };
    }

    const rounded = score => Math.round(score * 1e9);

    // Higher score first; then more identical values; then more specified categories.
    // Equal in all: the order in data.js decides (the sort is stable).
    function compareItems(a, b) {
        return (rounded(b.score) - rounded(a.score)) ||
            (b.identicalCount - a.identicalCount) ||
            (b.totalRequired - a.totalRequired);
    }

    function rankKeys(results, keys) {
        return (keys || Object.keys(labelMapping))
            .map(key => scoreKey(results, key))
            .sort(compareItems);
    }

    // Every ideology, best first. Its score is the log-sum-exp of the scores of its value sets;
    // key, identicalCount and totalRequired come from its best value set.
    function rankIdeologies(results) {
        const byLabel = {};
        rankKeys(results).forEach(item => {
            (byLabel[item.label] = byLabel[item.label] || []).push(item);
        });
        return Object.keys(byLabel)
            .map(label => {
                const items = byLabel[label];
                const best = items[0];
                const sum = items.reduce((total, item) => total + Math.exp(item.score - best.score), 0);
                return Object.assign({}, best, { score: best.score + Math.log(sum) });
            })
            .sort((a, b) => compareItems(a, b) || (labelOrder[a.label] - labelOrder[b.label]));
    }

    // The best ideologies other than excludeLabel; each must match at least one of your values
    function closestIdeologies(results, excludeLabel, count) {
        return rankIdeologies(results)
            .filter(item => item.label !== excludeLabel && item.identicalCount > 0)
            .slice(0, count);
    }

    return {
        categoryOf, relation, ringClass, valuesByCategory, keysOf, scoreKey, rankKeys,
        rankIdeologies, closestIdeologies, valueSetsPerIdeology
    };
})();
