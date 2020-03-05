const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Parse Json Input
 * @param {Array<([string] | [string, string | number])|({labelName: string, value: string | number})>} json
 * @return {Array<{labelName: string, value: string | number}>}
 */
function parseJsonInput(json) {
    if (!Array.isArray(json)) {
        throw new Error('JSON Input must be an array');
    }

    return json.map((item) => {
        if (!item) {
            core.warning('there is falsy item in the json input array');
            return null;
        }

        if (Array.isArray(item) && item.length === 0) {
            core.warning('there is empty item in the json input array');
            return null;
        }

        if (Array.isArray(item)) {
            return {
                labelName: item[0].trim(),
                value: (item.length > 1 ? item[1] : item[0]).trim()
            };
        }

        if (!('labelName' in item)) {
            throw Error('No labelName in json input')
        }

        return {
            labelName: item.labelName,
            value: 'value' in item ? item.value : item.labelName
        };
    }).filter(item => item);
}

/**
 * Parse multiline input
 * @param {string} input
 * @return {Array<{labelName: string, value: string | number}>}
 */
function parseMultilineInput(input) {
    return input
        .split('\n')
        .map((item) => item.split(','))
        .map((item) => {
            if (item.length === 1 && item[0].trim() === '') {
                return null;
            }

            return {
                labelName: item[0].trim(),
                value: (item.length > 1 ? item[1] : item[0]).trim()
            };
        }).filter(item => item);
}

/**
 * Get input
 * @param {string} input
 * @return {Array<{labelName: string, value: string | number}>}
 */
function parseInput(input) {
    if (!input) {
        throw new Error('Input can\'t be null');
    }

    let parsedJson;

    try {
        parsedJson = JSON.parse(input);
    } catch (e) {
        // Not JSON type
        return parseMultilineInput(input);
    }

    return parseJsonInput(parsedJson);
}

/**
 *
 * @return {Promise<Octokit.PullsListResponseItem>}
 */
async function getPullRequest() {
    const token = core.getInput('GitHubToken');

    if(!token) {
        return Promise.reject(new Error('No GitHub Token'));
    }

    const octokit = new github.GitHub(token);

    const allPulls = (await octokit.pulls.list({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 20
    })).data;

    const pullRequest = allPulls.find(pull => pull.merge_commit_sha === github.context.sha);

    if (!pullRequest) {
        return Promise.reject(new Error('no pull request'));
    }

    return pullRequest;
}

const OutputErrorCodes = {
    NO_ERROR: 0,
    NO_PULL_REQUEST: 1,
    NO_WANTED_LABEL: 2
};

async function run() {
    // The default
    core.setOutput('error', OutputErrorCodes.NO_ERROR);

    let labels;

    try {
        labels = parseInput(core.getInput('labels'));
    } catch (e) {
        e.message = e.message ? `Error on parsing input labels. Error Message: ${e.message}` : 'Error on parsing input labels.';
        core.setFailed(e.message);
        throw e;
    }

    let pullRequest;

    try {
        pullRequest = github.context.payload.pull_request ? github.context.payload.pull_request : await getPullRequest();
    } catch (e) {
        // eslint-disable-next-line no-ex-assign
        e =  e || new Error('Error on getting pull request');
        e.message = e.message || 'Error on getting pull request';

        if (e.message === 'no pull request') {
            core.setOutput('error', OutputErrorCodes.NO_PULL_REQUEST);
            core.info('Not a pull request');
            return;
        }

        core.setFailed(e.message);
        core.error(e.message);

        throw e;
    }

    const strongestLabel = labels.find(({labelName}) => pullRequest.labels.find((pullRequestLabel) => pullRequestLabel.name === labelName));

    if(!strongestLabel) {
        core.setOutput('error', OutputErrorCodes.NO_WANTED_LABEL);
        core.info('pull request labels don\'t contain one of your labels');
        return;
    }

    core.setOutput("strongestLabelName", strongestLabel.labelName);

    core.setOutput("strongestLabelValue", strongestLabel.value);

    core.info(`What is the strongest label in the 'pull_request'?: ${strongestLabel.labelName} which is ${strongestLabel.value}`);
    core.info(`You can use this output as 'steps.<step id>.outputs.strongestLabelName' or steps.<step id>.outputs.strongestLabelValue `);
}

module.exports = {
    parseJsonInput,
    parseMultilineInput,
    parseInput,
    getPullRequest,
    OutputErrorCodes,
    run
};
